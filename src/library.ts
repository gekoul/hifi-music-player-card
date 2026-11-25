import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import type { Caps } from './features';
import type { Localize } from './localize';
import type { HomeAssistant, LibraryConfig, Output } from './types';
import { LS, fixText, fmt } from './ui';
import { WebPlayer, type Track } from './web-player';

// ── data model ──
interface Item {
  kind?: 'head' | 'msg';
  t: string;
  s?: string;
  ic?: string;
  img?: string;
  dur?: number;
  nav?: boolean;      // opens a column
  play?: boolean;     // can be played
  src?: 'ms' | 'ma' | 'pb' | 'sec';
  id?: string;        // media_content_id / MA uri / section key
  ctype?: string;     // media_content_type / MA media type
  mclass?: string;
  entity?: string;    // entity used to browse (pb)
}
interface Col {
  title: string;
  items: Item[];
  sel?: number;
  loading?: boolean;
  err?: string;
  parent?: Item;
  wide?: boolean;
  playAll?: Item;
  paged?: { media_type: string; offset: number; size: number; more?: boolean };
}
interface BrowseNode {
  title: string;
  media_class: string;
  media_content_id: string;
  media_content_type: string;
  can_play: boolean;
  can_expand: boolean;
  children_media_class?: string | null;
  thumbnail?: string | null;
  children?: BrowseNode[];
}

const NOT_MUSIC_CLASS = new Set(['video', 'movie', 'tv_show', 'season', 'episode', 'image', 'game', 'app']);
const NOT_MUSIC_SOURCE = /^media-source:\/\/(tts|camera|image_upload|frigate|xbox|google_photos|nest|ring|reolink|synology_dsm|immich|motioneye|unifiprotect|ai_task|image)(\/|$)/;
const SOURCE_KEYS: Record<string, RegExp> = {
  folders: /^media-source:\/\/media_source(\/|$)/,
  jellyfin: /^media-source:\/\/jellyfin(\/|$)/,
  dlna: /^media-source:\/\/dlna_dms(\/|$)/,
  radio: /^media-source:\/\/radio_browser(\/|$)/,
  plex: /^media-source:\/\/plex(\/|$)/,
};
const CLASS_ICON: Record<string, string> = {
  directory: 'mdi:folder', album: 'mdi:album', artist: 'mdi:account-music', playlist: 'mdi:playlist-music', music: 'mdi:music-note',
  track: 'mdi:music-note', podcast: 'mdi:podcast', genre: 'mdi:tag-music', channel: 'mdi:radio', radio: 'mdi:radio', composer: 'mdi:account-music',
};
const CACHE = 'hifi_lib_cache_v1';
const START_NAMES = /^(multimedia|music|μουσική|musik|musique|música)$/i;

export class HifiLibrary extends LitElement {
  static override properties = {
    hass: { attribute: false }, cfg: { attribute: false }, output: { attribute: false }, caps: { attribute: false },
    t: { attribute: false }, theme: {}, outName: {}, storeKey: {},
    _open: { state: true }, _cols: { state: true }, _toast: { state: true }, _narrow: { state: true },
  };
  hass?: HomeAssistant;
  cfg!: LibraryConfig;
  output?: Output;
  caps?: Caps;
  t!: Localize;
  theme = 'streamer';
  outName = '';
  storeKey = 'hifi_lib';

  private _open = false;
  private _cols: Col[] = [];
  private _toast: { text: string; ok: boolean } | null = null;
  private _narrow = false;
  private _inited = false;
  private _maEntry?: string | null;
  private _maBrowse?: string;
  private _tt = 0;
  private _ro?: ResizeObserver;

  // ── lifecycle ──
  override connectedCallback() {
    super.connectedCallback();
    this._ro = new ResizeObserver(() => { this._narrow = this.clientWidth < 640; });
    this._ro.observe(this);
  }
  override disconnectedCallback() { super.disconnectedCallback(); this._ro?.disconnect(); }
  protected override willUpdate(ch: PropertyValues) {
    if (ch.has('cfg') && !this._inited) {
      const saved = LS.get(this.storeKey + ':open');
      this._open = saved ? saved === '1' : this.cfg.open === 'expanded';
    }
    if (this.hass && !this._inited && this._open) this._init();
  }
  private _toggle() {
    this._open = !this._open;
    LS.set(this.storeKey + ':open', this._open ? '1' : '0');
    if (this._open && !this._inited) this._init();
  }

  // ── helpers ──
  private async _ws<T = any>(msg: Record<string, any>): Promise<T> { return this.hass!.callWS<T>(msg); }
  private async _svc(domain: string, service: string, data: Record<string, any>, target?: Record<string, any>) {
    const msg: Record<string, any> = { type: 'call_service', domain, service, service_data: data, return_response: true };
    if (target) msg.target = target;
    return (await this._ws<any>(msg))?.response;
  }
  private _cacheGet(id: string): BrowseNode | null {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE) || '{}');
      const e = c[id];
      if (e && Date.now() - e.t < (this.cfg.cache_hours ?? 12) * 3600e3) return e.n;
    } catch { /* no cache */ }
    return null;
  }
  private _cachePut(id: string, n: BrowseNode) {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE) || '{}');
      const slim = { ...n, children: (n.children || []).map((x) => ({ title: x.title, media_class: x.media_class, media_content_id: x.media_content_id, media_content_type: x.media_content_type, can_play: x.can_play, can_expand: x.can_expand, children_media_class: x.children_media_class, thumbnail: x.thumbnail })) };
      c[id] = { t: Date.now(), n: slim };
      const keys = Object.keys(c);
      if (keys.length > 150) keys.sort((a, b) => c[a].t - c[b].t).slice(0, keys.length - 150).forEach((k) => delete c[k]);
      localStorage.setItem(CACHE, JSON.stringify(c));
    } catch { /* storage full or blocked */ }
  }
  private async _browseMS(id: string, fresh = false): Promise<BrowseNode> {
    if (!fresh) { const c = this._cacheGet(id); if (c) return c; }
    const n = await this._ws<BrowseNode>({ type: 'media_source/browse_media', media_content_id: id });
    this._cachePut(id, n);
    return n;
  }
  private async _browseEntity(entity: string, id?: string, type?: string): Promise<BrowseNode> {
    const msg: Record<string, any> = { type: 'media_player/browse_media', entity_id: entity };
    if (id) { msg.media_content_id = id; msg.media_content_type = type || 'music'; }
    return this._ws<BrowseNode>(msg);
  }
  private _audioOnly(n: BrowseNode) {
    if (this.cfg.audio_only === false) return true;
    if (NOT_MUSIC_CLASS.has(n.media_class)) return false;
    if (n.children_media_class && NOT_MUSIC_CLASS.has(n.children_media_class)) return false;
    if (/^(video|image)\//.test(n.media_content_type || '')) return false;
    return true;
  }
  private _msItem(n: BrowseNode, src: 'ms' | 'pb' = 'ms', entity?: string): Item {
    const t = fixText(n.title) || '(untitled)';
    const m = /^(.*?) - (.*)$/.exec(t);
    const split = (n.media_class === 'track' || n.media_class === 'music') && m && src === 'pb';
    return {
      src, entity, t: split ? m![2] : t, s: split ? m![1] : undefined, ic: CLASS_ICON[n.media_class] || (n.can_expand ? 'mdi:folder' : 'mdi:music-note'),
      img: n.thumbnail ? this._url(n.thumbnail) : undefined, nav: n.can_expand, play: n.can_play || n.can_expand,
      id: n.media_content_id, ctype: n.media_content_type, mclass: n.media_class,
    };
  }
  private _url(u: string) { return u.startsWith('/') && this.hass?.hassUrl ? this.hass.hassUrl(u) : u; }
  private _want(key: string) { const s = this.cfg.sources; return !s || s === 'auto' || s.includes(key); }

  private async _maEntryId(): Promise<string | null> {
    if (this._maEntry !== undefined) return this._maEntry;
    const ents = Object.values(this.hass!.entities || {}).filter((e) => e.platform === 'music_assistant' && e.entity_id.startsWith('media_player.'));
    this._maBrowse = ents[0]?.entity_id;
    if (!ents.length) return (this._maEntry = null);
    try {
      const r = await this._ws<any[]>({ type: 'config_entries/get', domain: 'music_assistant' });
      this._maEntry = r?.find((e) => e.state === 'loaded')?.entry_id || r?.[0]?.entry_id || null;
    } catch {
      try { const r = await this._ws<any>({ type: 'config/entity_registry/get', entity_id: ents[0].entity_id }); this._maEntry = r?.config_entry_id || null; } catch { this._maEntry = null; }
    }
    return this._maEntry ?? null;
  }

  // ── root column ──
  private async _init() {
    this._inited = true;
    const items: Item[] = [];
    const pins = this.cfg.folders || [];
    if (pins.length) {
      items.push({ kind: 'head', t: this.t('pinned') });
      pins.forEach((p) => items.push({ src: 'ms', id: p.path, t: p.name || p.path.split('/').pop() || p.path, ic: 'mdi:folder-star', nav: true, play: true, mclass: 'directory' }));
    }
    this._cols = [{ title: this.t('sources'), items: [...items, { kind: 'msg', t: this.t('loading') }] }];
    let root: BrowseNode | null = null;
    try { root = await this._browseMS('media-source://'); } catch { root = null; }
    const kids = (root?.children || []).filter((n) => !NOT_MUSIC_SOURCE.test(n.media_content_id) && this._audioOnly(n));
    // Local media: list its folders directly
    const local = kids.find((n) => SOURCE_KEYS.folders.test(n.media_content_id));
    let startItem: Item | undefined;
    if (local && this._want('folders')) {
      try {
        const ln = await this._browseMS(local.media_content_id);
        let dirs = (ln.children || []).filter((n) => this._audioOnly(n));
        // a single media dir: show what is inside it
        if (dirs.length === 1 && dirs[0].can_expand) { const inner = await this._browseMS(dirs[0].media_content_id); dirs = (inner.children || []).filter((n) => this._audioOnly(n)); }
        if (dirs.length) {
          items.push({ kind: 'head', t: this.t('folders') });
          dirs.forEach((n) => { const it = this._msItem(n); items.push(it); if (!startItem && START_NAMES.test(it.t)) startItem = it; });
        }
      } catch { /* no local media */ }
    }
    // Music Assistant library
    if (this._want('music_assistant') && await this._maEntryId()) {
      items.push({ kind: 'head', t: this.t('ma_library') });
      ([['fav', 'mdi:heart', 'favourites'], ['recent', 'mdi:new-box', 'recent'], ['artist', 'mdi:account-music', 'artists'], ['album', 'mdi:album', 'albums'],
        ['playlist', 'mdi:playlist-music', 'playlists'], ['radio', 'mdi:radio', 'radio']] as const)
        .forEach(([k, ic, l]) => items.push({ src: 'sec', id: k, t: this.t(l), ic, nav: true }));
    }
    // Other libraries (Jellyfin, DLNA servers, Radio Browser, Plex, …)
    const others = kids.filter((n) => !SOURCE_KEYS.folders.test(n.media_content_id)).filter((n) => {
      const k = Object.entries(SOURCE_KEYS).find(([, re]) => re.test(n.media_content_id))?.[0];
      return k ? this._want(k) : this.cfg.sources === 'auto' || !this.cfg.sources || this.cfg.sources.includes(n.media_content_id);
    });
    const plex = this._want('plex') && !others.some((n) => SOURCE_KEYS.plex.test(n.media_content_id))
      ? Object.values(this.hass!.entities || {}).find((e) => e.platform === 'plex' && e.entity_id.startsWith('media_player.') && this.hass!.states[e.entity_id]?.state !== 'unavailable') : undefined;
    if (others.length || plex) {
      items.push({ kind: 'head', t: this.t('library') });
      others.forEach((n) => items.push({ ...this._msItem(n), ic: n.media_content_id.includes('radio_browser') ? 'mdi:radio' : 'mdi:bookshelf', play: false }));
      if (plex) items.push({ src: 'pb', entity: plex.entity_id, t: 'Plex', ic: 'mdi:plex', nav: true });
    }
    if (!items.length) items.push({ kind: 'msg', t: this.t('nothing_here') });
    this._cols = [{ title: this.t('sources'), items }];
    // open the start folder
    const start = this.cfg.start;
    if (start) { const it: Item = { src: 'ms', id: start, t: start.split('/').pop() || start, nav: true, play: true, mclass: 'directory' }; await this._push(0, it); }
    else if (startItem) { this._cols[0].sel = items.indexOf(startItem); await this._push(0, startItem); }
  }

  // ── columns ──
  private async _openRow(ci: number, ri: number) {
    const col = this._cols[ci], it = col.items[ri];
    if (!it || it.kind) return;
    col.sel = ri;
    if (!it.nav) { this._cols = this._cols.slice(0, ci + 1); if (it.play) void this._play(it, undefined, col); return; }
    await this._push(ci, it);
  }
  private async _push(ci: number, it: Item) {
    const nc: Col = { title: it.t, items: [], loading: true, parent: it };
    this._cols = [...this._cols.slice(0, ci + 1), nc];
    this._scrollEnd();
    try { await this._fill(nc, it); } catch (e: any) { nc.err = String(e?.message || e); }
    nc.loading = false;
    this._cols = [...this._cols];
    this._scrollEnd();
  }
  private async _fill(nc: Col, it: Item) {
    if (it.src === 'ms') {
      const n = await this._browseMS(it.id!);
      const kids = (n.children || []).filter((x) => this._audioOnly(x));
      nc.items = kids.map((x) => this._msItem(x));
      const files = kids.filter((x) => x.can_play && !x.can_expand).length;
      if (files) { nc.wide = true; nc.playAll = it; }
      // refresh in the background when the cached copy is older than half its life
      void this._browseMS(it.id!, true).then((f) => {
        const fresh = (f.children || []).filter((x) => this._audioOnly(x)).map((x) => this._msItem(x));
        if (fresh.length !== nc.items.length && this._cols.includes(nc)) { nc.items = fresh; this._cols = [...this._cols]; }
      }).catch(() => {});
    } else if (it.src === 'pb') {
      const n = await this._browseEntity(it.entity!, it.id, it.ctype);
      const kids = (n.children || []).filter((x) => this._audioOnly(x));
      nc.items = kids.map((x) => this._msItem(x, 'pb', it.entity));
      if (kids.some((x) => x.can_play && !x.can_expand)) { nc.wide = true; nc.playAll = it.id ? it : undefined; }
    } else if (it.src === 'sec') {
      const k = it.id!;
      if (k === 'fav') {
        const kinds = ['playlist', 'album', 'artist', 'radio', 'track'];
        const rs = await Promise.all(kinds.map((m) => this._lib({ media_type: m, favorite: true, limit: 50, order_by: 'name' }).catch(() => null)));
        nc.items = rs.flatMap((r) => (r?.items || []).map((x: any) => this._maItem(x)));
      } else if (k === 'recent') {
        const r = await this._lib({ media_type: 'album', limit: 100, order_by: 'timestamp_added_desc' }).catch(() => this._lib({ media_type: 'album', limit: 100 }));
        nc.items = (r?.items || []).map((x: any) => this._maItem(x));
      } else {
        nc.paged = { media_type: k, offset: 0, size: 200 };
        await this._page(nc);
      }
    } else if (it.src === 'ma') {
      const ent = this._maBrowse || (this.output?.ma ? this.output.entity : undefined);
      if (!ent) throw new Error('No Music Assistant player');
      const n = await this._browseEntity(ent, it.id, it.ctype);
      nc.items = (n.children || []).map((x) => ({ ...this._msItem(x, 'pb', ent), src: 'ma' as const, id: x.media_content_id, ctype: x.media_class === 'music' ? 'track' : x.media_class }));
      if (['album', 'playlist', 'artist'].includes(it.ctype || '')) { nc.wide = it.ctype !== 'artist'; nc.playAll = it; }
    }
  }
  private _lib(d: Record<string, any>) { return this._svc('music_assistant', 'get_library', { config_entry_id: this._maEntry, ...d }); }
  private async _page(nc: Col) {
    const p = nc.paged!;
    const r = await this._lib({ media_type: p.media_type, limit: p.size, offset: p.offset, order_by: 'name' });
    const got = (r?.items || []).map((x: any) => this._maItem(x));
    nc.items = nc.items.concat(got); p.offset += got.length; p.more = got.length === p.size;
  }
  private _maItem(x: any): Item {
    const t = x.media_type || 'track';
    const artists = (x.artists || []).map((a: any) => fixText(a.name)).filter(Boolean).slice(0, 2).join(', ');
    return {
      src: 'ma', t: fixText(x.name) || '(untitled)', s: t === 'track' ? [artists, fixText(x.album?.name)].filter(Boolean).join(' · ') : artists || undefined,
      ic: CLASS_ICON[t] || 'mdi:music', img: typeof x.image === 'string' ? x.image : undefined, id: x.uri, ctype: t,
      nav: ['artist', 'album', 'playlist'].includes(t), play: true, dur: x.duration,
    };
  }

  private async _search(term: string) {
    if (!term) return;
    const nc: Col = { title: this.t('search_results', { term }), items: [], loading: true, wide: true };
    this._cols = [{ ...this._cols[0], sel: undefined }, nc];
    const lt = term.toLowerCase();
    try {
      if (await this._maEntryId()) {
        const r = await this._svc('music_assistant', 'search', { config_entry_id: this._maEntry, name: term, limit: 12 });
        ([['artists', r?.artists], ['albums', r?.albums], ['tracks', r?.tracks], ['playlists', r?.playlists], ['radio', r?.radio]] as const)
          .forEach(([h, list]) => { if (list?.length) { nc.items.push({ kind: 'head', t: this.t(h) }); list.forEach((x: any) => nc.items.push(this._maItem(x))); } });
      }
      // folders and files already seen (cache)
      const hits: Item[] = [];
      try {
        const c = JSON.parse(localStorage.getItem(CACHE) || '{}');
        for (const e of Object.values<any>(c)) for (const n of (e.n?.children || []) as BrowseNode[]) {
          if (hits.length >= 40) break;
          if (fixText(n.title).toLowerCase().includes(lt) && this._audioOnly(n) && !hits.some((h) => h.id === n.media_content_id)) hits.push(this._msItem(n));
        }
      } catch { /* no cache */ }
      if (hits.length) { nc.items.push({ kind: 'head', t: this.t('folders') }); nc.items.push(...hits); }
    } catch (e: any) { nc.err = String(e?.message || e); }
    nc.loading = false;
    this._cols = [...this._cols];
  }

  // ── playback ──
  private async _files(it: Item): Promise<Item[]> {
    if (it.src === 'ms') {
      const n = await this._browseMS(it.id!);
      return (n.children || []).filter((x) => x.can_play && !x.can_expand && this._audioOnly(x)).map((x) => this._msItem(x)).slice(0, 300);
    }
    if (it.src === 'pb') {
      const n = await this._browseEntity(it.entity!, it.id, it.ctype);
      return (n.children || []).filter((x) => x.can_play && !x.can_expand && this._audioOnly(x)).map((x) => this._msItem(x, 'pb', it.entity)).slice(0, 300);
    }
    return [];
  }
  private async _resolve(it: Item): Promise<Track | null> {
    if (it.src !== 'ms') return null;
    const r = await this._ws<{ url: string; mime_type?: string }>({ type: 'media_source/resolve_media', media_content_id: it.id }).catch(() => null);
    if (!r?.url) return null;
    return { url: this._url(r.url), title: it.t, artist: it.s, art: it.img };
  }
  private async _play(it: Item, enqueue?: 'next' | 'add', col?: Col) {
    const out = this.output, t = this.t;
    if (!out || !this.hass) return;
    const name = this.outName;
    try {
      if (out.browser) {
        if (it.src !== 'ms') throw new Error(t('browser_cant'));
        let list: Item[];
        let start = 0;
        if (it.nav) list = await this._files(it);
        else { const sib = (col?.items || []).filter((x) => x.src === 'ms' && x.play && !x.nav); start = Math.max(0, sib.indexOf(it)); list = sib.length ? sib : [it]; }
        if (enqueue) list = [it];
        const first = await this._resolve(list[start]);
        if (!first) throw new Error(t('browser_cant'));
        if (enqueue) { WebPlayer.append(WebPlayer.gen, first); this._say(t('queued_on', { output: name, title: it.t }), true); return; }
        const gen = WebPlayer.load([first]);
        void (async () => { for (let i = start + 1; i < list.length; i++) { if (gen !== WebPlayer.gen) return; const tr = await this._resolve(list[i]); if (tr) WebPlayer.append(gen, tr); } })();
        this._say(t('playing_on', { output: name, title: it.t }), true);
        return;
      }
      if (it.src === 'ma') {
        if (!out.ma) throw new Error('needs a Music Assistant player');
        await this.hass.callService('music_assistant', 'play_media', { media_id: it.id, media_type: it.ctype, enqueue: enqueue || 'replace' }, { entity_id: out.entity });
      } else if (it.nav) {
        // play a folder: first file now, the rest queued when the player supports a queue
        const files = await this._files(it);
        if (!files.length) throw new Error(t('nothing_here'));
        const pm = (f: Item, e?: string) => this.hass!.callService('media_player', 'play_media', {
          entity_id: out.entity, media_content_id: f.id, media_content_type: f.ctype || 'music', ...(e && this.caps?.enqueue ? { enqueue: e } : {}),
        });
        await pm(files[0], enqueue || 'replace');
        if (this.caps?.enqueue && !enqueue) for (const f of files.slice(1)) await pm(f, 'add');
      } else {
        await this.hass.callService('media_player', 'play_media', {
          entity_id: out.entity, media_content_id: it.id, media_content_type: it.ctype || 'music',
          ...(this.caps?.enqueue ? { enqueue: enqueue || 'play' } : {}),
        });
      }
      this._say(t(enqueue ? 'queued_on' : 'playing_on', { output: name, title: it.t }), true);
    } catch (e: any) {
      this._say(t('cant_play', { output: name, title: it.t, error: String(e?.message || e) }), false);
    }
  }
  private _say(text: string, ok: boolean) {
    this._toast = { text, ok };
    clearTimeout(this._tt);
    this._tt = window.setTimeout(() => { this._toast = null; }, ok ? 3000 : 7000);
  }

  // ── keyboard ──
  private _onKey(e: KeyboardEvent) {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.r');
    if (!row) return;
    const ci = +row.dataset.c!, ri = +row.dataset.r!;
    const rows = [...this.renderRoot.querySelectorAll<HTMLElement>(`.r[data-c="${ci}"]`)];
    const i = rows.indexOf(row);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      const it = this._cols[ci].items[ri];
      if (e.key === 'Enter' && !it.nav && it.play) { void this._play(it, undefined, this._cols[ci]); return; }
      void this._openRow(ci, ri).then(() => this.updateComplete).then(() => this.renderRoot.querySelector<HTMLElement>(`.r[data-c="${ci + 1}"]`)?.focus());
    } else if (e.key === 'ArrowLeft' && ci > 0) {
      e.preventDefault();
      const p = this._cols[ci - 1];
      this.renderRoot.querySelector<HTMLElement>(`.r[data-c="${ci - 1}"][data-r="${p.sel ?? 0}"]`)?.focus();
    }
  }
  private _scrollEnd() {
    void this.updateComplete.then(() => { const m = this.renderRoot.querySelector('.mill'); if (m) m.scrollLeft = m.scrollWidth; });
  }

  // ── render ──
  protected override render() {
    if (!this.cfg) return nothing;
    const t = this.t, list = this.cfg.view === 'list' || this._narrow;
    const cols = list ? this._cols.slice(-1) : this._cols;
    const base = list ? this._cols.length - 1 : 0;
    return html`<div class="lib ${this.theme}">
      <div class="bar">
        <button type="button" class="tog" aria-expanded=${this._open} @click=${this._toggle}>
          <span class="chev ${this._open ? 'up' : ''}">▾</span>${(this._open ? t('close_library') : t('library')).toUpperCase()}</button>
        ${this._open ? html`<label class="q"><span aria-hidden="true">⌕</span><input type="search" placeholder=${t('search')} aria-label=${t('search')}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this._search((e.target as HTMLInputElement).value.trim()); }}></label>` : nothing}
        <span class="on">${t('play_on').toUpperCase()} · <b>${this.outName}</b></span>
      </div>
      ${this._open ? html`<div class="mill" style="--lh:${this.cfg.height ?? 420}px" @keydown=${this._onKey}>
        ${this._toast ? html`<div class="toast ${this._toast.ok ? 'ok' : ''}" role="status">${this._toast.text}</div>` : nothing}
        ${cols.map((c, k) => this._col(c, base + k, list))}
      </div>` : nothing}
    </div>`;
  }
  private _col(c: Col, ci: number, list: boolean) {
    const t = this.t;
    const count = c.items.filter((x) => !x.kind).length;
    return html`<div class="col ${c.wide || list ? 'wide' : ''}" role="listbox" aria-label=${c.title}>
      <div class="ch">
        ${list && ci > 0 ? html`<button type="button" class="back" aria-label=${t('back')} @click=${() => { this._cols = this._cols.slice(0, ci); }}>‹</button>` : nothing}
        <span class="ct">${c.title}</span>${ci && count ? html`<span class="cn">${count}${c.paged?.more ? '+' : ''}</span>` : nothing}
        ${c.playAll ? html`<button type="button" class="pa" @click=${() => this._play(c.playAll!)}>▶ ${t('play_all').toUpperCase()}</button>` : nothing}
      </div>
      <div class="rows" @scroll=${(e: Event) => { const r = e.target as HTMLElement; if (c.paged?.more && r.scrollTop + r.clientHeight > r.scrollHeight - 80) void this._more(c); }}>
        ${c.loading ? html`<div class="msg">${t('loading')}</div>` : c.err ? html`<div class="msg">${t('could_not_load', { error: c.err })}</div>`
          : !c.items.length ? html`<div class="msg">${t('nothing_here')}</div>`
            : c.items.map((it, ri) => it.kind === 'head' ? html`<div class="hd">${it.t.toUpperCase()}</div>` : it.kind === 'msg' ? html`<div class="msg">${it.t}</div>`
              : html`<div class="r ${it.mclass === 'directory' ? 'dir' : ''} ${c.sel === ri ? 'sel' : ''}" role="option" tabindex="0" aria-selected=${c.sel === ri}
                  data-c=${ci} data-r=${ri} @click=${() => this._openRow(ci, ri)}>
                <span class="ri"><ha-icon icon=${it.ic || 'mdi:music'}></ha-icon>${it.img ? html`<img src=${it.img} loading="lazy" alt="" @error=${(e: Event) => (e.target as HTMLElement).remove()}>` : nothing}</span>
                <span class="rt"><span class="rn">${it.t}</span>${it.s ? html`<span class="rs">${it.s}</span>` : nothing}</span>
                ${ci && it.play ? html`<button type="button" class="rp" title=${t('play')} aria-label="${t('play')} ${it.t}" @click=${(e: Event) => { e.stopPropagation(); void this._play(it, undefined, c); }}>▶</button>
                  ${this.caps?.enqueue || (it.src === 'ma' && this.output?.ma) ? html`<button type="button" class="rq" title=${t('play_next')} aria-label="${t('play_next')} ${it.t}" @click=${(e: Event) => { e.stopPropagation(); void this._play(it, 'next', c); }}>⤵</button>
                  <button type="button" class="rq" title=${t('add_queue')} aria-label="${t('add_queue')} ${it.t}" @click=${(e: Event) => { e.stopPropagation(); void this._play(it, 'add', c); }}>+</button>` : nothing}` : nothing}
                ${it.dur ? html`<span class="rd">${fmt(it.dur)}</span>` : it.nav ? html`<span class="rc">›</span>` : nothing}
              </div>`)}
        ${c.paged?.more ? html`<button type="button" class="more" @click=${() => this._more(c)}>${t('load_more')}</button>` : nothing}
      </div>
    </div>`;
  }
  private _busy = false;
  private async _more(c: Col) {
    if (this._busy || !c.paged?.more) return;
    this._busy = true;
    try { await this._page(c); } finally { this._busy = false; }
    this._cols = [...this._cols];
  }

  static override styles = css`
:host{display:block;font-family:var(--hf,Inter,Roboto,system-ui,sans-serif)}
.lib{margin-top:8px;border-radius:16px;overflow:hidden;color:#d6d6d6}
.lib.streamer{background:linear-gradient(180deg,#141618,#0c0d0f);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 0 0 1px rgba(0,0,0,.6)}
.lib.console{background:linear-gradient(180deg,#2a2c30,#18191c);box-shadow:inset 0 1px 0 rgba(255,250,240,.16),0 0 0 1px #000;border-left:14px solid #5a331b;border-right:14px solid #5a331b}
.bar{display:flex;align-items:center;gap:12px;padding:8px 14px;flex-wrap:wrap}
button{font-family:inherit;border:none;background:none;color:inherit;cursor:pointer;padding:0}
button:focus-visible,.r:focus-visible,input:focus-visible{outline:2px solid #7dd3fc;outline-offset:-2px}
.tog{display:flex;align-items:center;gap:8px;font:700 10px inherit;font-weight:700;font-size:10px;letter-spacing:.18em;color:#c9ccd1;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,.05);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.console .tog{background:linear-gradient(180deg,#f6f7f8,#c6cad0 50%,#a3a8af);color:#2b2e33;box-shadow:inset 0 1px 0 #fff,0 2px 0 #4a4e55}
.chev{display:inline-block;transition:transform .2s;color:var(--acc)}.chev.up{transform:rotate(180deg)}
.console .chev{color:#5b3608}
.on{margin-left:auto;font-size:10px;letter-spacing:.12em;color:#8b949e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.on b{color:var(--acc);font-weight:600}
.q{display:flex;align-items:center;gap:6px;background:#0b0c0d;border:1px solid #333;border-radius:8px;padding:0 8px;min-width:180px;flex:0 1 320px;color:#6f6f6f}
.q input{flex:1;min-width:0;background:none;border:none;outline:none;color:#eee;font-size:12px;padding:7px 0;font-family:inherit}
.mill{display:flex;height:var(--lh,420px);overflow-x:auto;overflow-y:hidden;position:relative;border-top:1px solid rgba(255,255,255,.06)}
.col{flex:0 0 232px;display:flex;flex-direction:column;border-right:1px solid rgba(255,255,255,.05);min-width:0;background:rgba(0,0,0,.18)}
.col:first-child{flex-basis:210px;background:rgba(0,0,0,.28)}
.col.wide{flex:1 0 340px}
.ch{display:flex;align-items:center;gap:6px;padding:8px 10px 6px;border-bottom:1px solid rgba(255,255,255,.05);min-height:30px}
.back{font-size:20px;line-height:1;color:var(--acc);padding:0 6px}
.ct{flex:1;min-width:0;font-size:10px;letter-spacing:.12em;color:#8f8f8f;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cn{font-size:9px;color:#5f5f5f}
.pa{border:1px solid var(--acc);color:var(--acc);border-radius:12px;font-size:9px;letter-spacing:.1em;padding:3px 8px;white-space:nowrap}
.pa:hover{background:var(--acc);color:var(--acc-ink,#000)}
.rows{flex:1;overflow-y:auto;padding:2px 0 8px}
.rows::-webkit-scrollbar,.mill::-webkit-scrollbar{width:6px;height:6px}.rows::-webkit-scrollbar-thumb,.mill::-webkit-scrollbar-thumb{background:#2c2d30;border-radius:3px}
.hd{font-size:9px;letter-spacing:.18em;color:#6b737d;padding:12px 12px 4px}
.r{display:flex;align-items:center;gap:8px;padding:5px 8px 5px 10px;cursor:pointer;border-left:2px solid transparent;user-select:none;min-height:32px}
.r:hover{background:rgba(255,255,255,.04)}
.r.sel{background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 18%,transparent),transparent);border-left-color:var(--acc)}
.r.sel .rn{color:#fff}
.ri{flex:none;width:28px;height:28px;border-radius:4px;background:#1c1d20;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
.ri ha-icon{--mdc-icon-size:16px;color:color-mix(in srgb,var(--acc) 70%,#888)}
.ri img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.r.dir .ri{background:none}.r.dir .ri ha-icon{color:#c9a54a}
.rt{flex:1;min-width:0;display:flex;flex-direction:column}
.rn{font-size:12px;color:#e4e4e4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs{font-size:10px;color:#808080;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd{font-size:10px;color:#6f6f6f;font-family:ui-monospace,Menlo,Consolas,monospace}
.rc{color:#555;font-size:14px;width:10px;text-align:center}
.rp,.rq{flex:none;width:24px;height:24px;border-radius:50%;display:none;align-items:center;justify-content:center;font-size:10px}
.rp{border:1px solid var(--acc);color:var(--acc)}.rq{border:1px solid #444;color:#aaa}
.rp:hover{background:var(--acc);color:var(--acc-ink,#000)}.rq:hover{color:#fff;border-color:#888}
.r:hover .rp,.r:hover .rq,.r:focus-within .rp,.r:focus-within .rq,.r.sel .rp,.r.sel .rq{display:flex}
@media (hover:none){.rp,.rq{display:flex}}
.msg{padding:14px 12px;font-size:11px;color:#7a7a7a}
.more{padding:8px 12px;font-size:10px;color:var(--acc)}
.toast{position:sticky;left:12px;top:10px;z-index:3;align-self:flex-start;margin:10px 0 0 12px;max-width:min(560px,calc(100% - 24px));flex:none;position:absolute;padding:8px 12px;border-radius:8px;background:rgba(40,12,10,.96);border:1px solid rgba(255,90,78,.5);color:#ffb3ac;font-size:12px}
.toast.ok{background:rgba(8,32,28,.96);border-color:var(--acc);color:#dffdf6}
`;
}

if (!customElements.get('hifi-library')) customElements.define('hifi-library', HifiLibrary);
