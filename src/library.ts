import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import type { Caps } from './features';
import type { Localize } from './localize';
import type { HomeAssistant, LibraryConfig, Output } from './types';
import { LS, fixText, fmt } from './ui';
import { WebPlayer, type Track } from './web-player';
import { formatBadges, fromJellyHA, fromPath, type AudioFormat } from './quality';

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
  src?: 'ms' | 'ma' | 'pb' | 'sec' | 'jh';
  id?: string;        // media_content_id / MA uri / section key
  ctype?: string;     // media_content_type / MA media type
  mclass?: string;
  entity?: string;    // entity used to browse (pb)
  jk?: 'tree' | 'dir' | 'album' | 'playlists' | 'playlist' | 'track';  // JellyHA item kind
  jdir?: JhNode;
  url?: string;       // JellyHA signed stream URL
  album?: string;
  fmt?: AudioFormat;
}
interface JhNode { name: string; rel: string; dirs: JhNode[]; map: Map<string, JhNode>; albumId?: string }
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
const NOT_MUSIC_SOURCE = /^media-source:\/\/(tts|camera|image_upload|frigate|xbox|google_photos|nest|ring|reolink|synology_dsm|immich|motioneye|unifiprotect|ai_task|image|dahua|hikvision|blink|eufy|onvif|llmvision)(\/|$)/;
const NOT_MUSIC_TYPE = new Set(['movie', 'movies', 'tvshow', 'tv_show', 'tvshows', 'episode', 'season', 'video', 'videos']);
const JH_CACHE = 'hifi_jh_folders_v1';
const PLATFORM_NAME: Record<string, string> = {
  plex: 'Plex', sonos: 'Sonos', kodi: 'Kodi', squeezebox: 'Squeezebox', emby: 'Emby', spotify: 'Spotify', roon: 'Roon', heos: 'HEOS', bluesound: 'Bluesound',
  volumio: 'Volumio', jellyfin: 'Jellyfin', mpd: 'MPD', forked_daapd: 'OwnTone', yamaha_musiccast: 'MusicCast', denonavr: 'Denon AVR', openhome: 'OpenHome',
  linkplay: 'LinkPlay', bang_olufsen: 'Bang & Olufsen', russound_rio: 'Russound', arcam_fmj: 'Arcam', snapcast: 'Snapcast', frontier_silicon: 'Frontier Silicon',
};
/** Integrations whose players browse one shared library (the same from any of its players). */
const SERVER_LIBS = new Set(['plex', 'emby', 'jellyfin', 'kodi', 'squeezebox', 'spotify', 'roon', 'forked_daapd', 'mpd', 'volumio', 'sonos', 'heos', 'bluesound',
  'openhome', 'subsonic', 'navidrome', 'plexamp', 'tidal', 'deezer', 'youtube_music', 'qobuz', 'apple_music']);
const PLATFORM_ICON: Record<string, string> = { plex: 'mdi:plex', spotify: 'mdi:spotify', kodi: 'mdi:kodi', sonos: 'mdi:speaker-multiple', emby: 'mdi:emby' };
const SOURCE_KEYS: Record<string, RegExp> = {
  folders: /^media-source:\/\/media_source(\/|$)/,
  jellyfin: /^media-source:\/\/(jellyfin|jellyha)(\/|$)/,
  dlna: /^media-source:\/\/dlna_dms(\/|$)/,
  radio: /^media-source:\/\/radio_browser(\/|$)/,
  plex: /^media-source:\/\/plex(\/|$)/,
};
const CLASS_ICON: Record<string, string> = {
  directory: 'mdi:folder', album: 'mdi:album', artist: 'mdi:account-music', playlist: 'mdi:playlist-music', music: 'mdi:music-note',
  track: 'mdi:music-note', podcast: 'mdi:podcast', genre: 'mdi:tag-music', channel: 'mdi:radio', radio: 'mdi:radio', composer: 'mdi:account-music',
};
const CACHE = 'hifi_lib_cache_v1';
const MEM: Map<string, { t: number; n: any }> = (window as any).__hifiLibCache || ((window as any).__hifiLibCache = new Map());
/** Title for matching: no file extension, no leading track number, lower case. */
const normTitle = (s?: string) => String(s || '').toLowerCase().replace(/\.(mp3|flac|m4a|aac|ogg|opus|wav|wma|alac|aiff?)$/, '').replace(/^\s*(\d{1,3}[\s.\-_)]+)+/, '').replace(/\s+/g, ' ').trim();
const shuffled = <T,>(a: T[]): T[] => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const START_NAMES = /^(multimedia|music|μουσική|musik|musique|música)$/i;

export class HifiLibrary extends LitElement {
  static override properties = {
    hass: { attribute: false }, cfg: { attribute: false }, output: { attribute: false }, caps: { attribute: false },
    t: { attribute: false }, theme: {}, outName: {}, storeKey: {}, now: { attribute: false }, quality: { type: Boolean },
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
  /** Show codec / HI-RES tags on track rows. */
  quality = true;
  /** What the selected output is playing: highlighted in the list and followed when the track changes. */
  now?: { id?: string; title?: string; artist?: string };

  private _isNow(it: Item) {
    const n = this.now;
    if (!n || it.kind || it.nav || !it.play) return false;
    if (n.id && it.id && (n.id === it.id || n.id.endsWith('/' + it.id) || (it.url && n.id === it.url))) return true;
    if (!n.title) return false;
    const a = normTitle(it.t), b = normTitle(n.title);
    if (!a || a !== b) return false;
    return !n.artist || !it.s || normTitle(it.s).includes(normTitle(n.artist).split(',')[0]) || normTitle(n.artist).includes(normTitle(it.s));
  }
  private _nowKey = '';
  /** When the playing track changes, select it in the right-most column and scroll it into view. */
  private _followNow() {
    const n = this.now, key = n ? `${n.id || ''}|${n.title || ''}|${n.artist || ''}` : '';
    if (key === this._nowKey) return;
    this._nowKey = key;
    if (!key || !this._open) return;
    const ci = this._cols.length - 1, col = this._cols[ci];
    if (!col) return;
    const ri = col.items.findIndex((x) => this._isNow(x));
    if (ri < 0 || col.sel === ri) return;
    col.sel = ri;
    this._cols = [...this._cols];
    void this.updateComplete.then(() => this.renderRoot.querySelector(`.r[data-c="${ci}"][data-r="${ri}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }
  protected override updated(ch: PropertyValues) { if (ch.has('now')) this._followNow(); }

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
  private _cfgSig = '';
  protected override willUpdate(ch: PropertyValues) {
    if (ch.has('cfg')) {
      const sig = JSON.stringify(this.cfg);
      if (this._inited && this._cfgSig && sig !== this._cfgSig) { this._inited = false; this._cols = []; this._jhRoot = undefined; }
      this._cfgSig = sig;
    }
    if (ch.has('cfg') && !this._inited && !this._openSet) {
      this._openSet = true;
      const saved = LS.get(this.storeKey + ':open');
      this._open = saved ? saved === '1' : this.cfg.open === 'expanded';
    }
    if (this.hass && !this._inited && this._open) this._init();
    if (ch.has('output') && this._inited && this._cols.length) void this._here();
  }
  private _openSet = false;
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
  /** Folder listings: kept in memory, and in localStorage up to ~1 MB (it is shared with Home Assistant's own data). */
  private _cacheRead(id: string): { t: number; n: BrowseNode } | null {
    const ttl = (this.cfg.cache_hours ?? 12) * 3600e3;
    let e = MEM.get(id);
    if (!e) {
      try { e = JSON.parse(localStorage.getItem(CACHE) || '{}')[id]; if (e) MEM.set(id, e); } catch { e = undefined; }
    }
    return e && Date.now() - e.t < ttl ? e : null;
  }
  private _cachePut(id: string, n: BrowseNode) {
    const slim: BrowseNode = { ...n, children: (n.children || []).slice(0, 2000).map((x) => ({ title: x.title, media_class: x.media_class, media_content_id: x.media_content_id, media_content_type: x.media_content_type, can_play: x.can_play, can_expand: x.can_expand, children_media_class: x.children_media_class, thumbnail: x.thumbnail })) };
    const e = { t: Date.now(), n: slim };
    MEM.set(id, e);
    clearTimeout(this._saveT);
    this._saveT = window.setTimeout(() => {
      try {
        const all = [...MEM.entries()].sort((a, b) => b[1].t - a[1].t);
        const out: Record<string, unknown> = {};
        let size = 2;
        for (const [k, v] of all) { const len = JSON.stringify(v).length + k.length + 4; if (size + len > 1_000_000) break; out[k] = v; size += len; }
        localStorage.setItem(CACHE, JSON.stringify(out));
      } catch { /* storage full or blocked */ }
    }, 1500);
  }
  private _saveT = 0;
  private async _browseMS(id: string, fresh = false): Promise<BrowseNode> {
    if (!fresh) { const c = this._cacheRead(id); if (c) return c.n; }
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
    if (NOT_MUSIC_TYPE.has(String(n.media_content_type || '').toLowerCase())) return false;
    if (/\/livetv(\/|$)/.test(n.media_content_id)) return false;
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
      fmt: n.can_expand ? undefined : fromPath(n.title) || fromPath(n.media_content_id),
    };
  }
  private _url(u: string) { return u.startsWith('/') && this.hass?.hassUrl ? this.hass.hassUrl(u) : u; }
  private _want(key: string) { const s = this.cfg.sources; return !s || s === 'auto' || s.includes(key); }

  /**
   * Finds integrations whose media players expose their own music library through browse_media.
   * One entity per integration is probed; an integration is kept when its root lists something
   * other than apps, TV inputs or Home Assistant's own media sources (which are listed already).
   */
  private async _playerLibraries(msDomains: Set<string>, jh: boolean): Promise<Item[]> {
    const SKIP = new Set(['music_assistant', 'browser_mod', 'group', 'universal', 'media_extractor']);
    if (jh) SKIP.add('jellyha');
    const byPlatform = new Map<string, string[]>();
    for (const e of Object.values(this.hass!.entities || {})) {
      if (!e.entity_id.startsWith('media_player.') || !e.platform || SKIP.has(e.platform) || msDomains.has(e.platform)) continue;
      const st = this.hass!.states[e.entity_id];
      if (!st || !((Number(st.attributes.supported_features) || 0) & 131072)) continue;   // BROWSE_MEDIA
      if (!this._want(e.platform)) continue;
      const l = byPlatform.get(e.platform) || []; l.push(e.entity_id); byPlatform.set(e.platform, l);
    }
    // a library shared by every player of the integration; device content (presets, queue) is shown under "On this player" instead
    for (const [p, l] of [...byPlatform]) if (!SERVER_LIBS.has(p) && l.length > 1) byPlatform.delete(p);
    const NOT_LIB = new Set(['app', 'channel', 'url', 'game', 'video', 'movie', 'tv_show', 'image']);
    const probe = async (platform: string, ents: string[]): Promise<Item | null> => {
      const order = [...ents].sort((a, b) => Number(this.hass!.states[a]?.state === 'unavailable') - Number(this.hass!.states[b]?.state === 'unavailable'));
      for (const ent of order.slice(0, 2)) {
        try {
          const n = await Promise.race([this._browseEntity(ent), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
          const kids = (n.children || []).filter((c) => !c.media_content_id.startsWith('media-source://') && !NOT_LIB.has(c.media_class) && this._audioOnly(c));
          if (!kids.length) return null;
          return { src: 'pb', entity: ent, t: PLATFORM_NAME[platform] || platform.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toLocaleUpperCase('el')), ic: PLATFORM_ICON[platform] || 'mdi:library-shelves', nav: true };
        } catch { /* try the next entity */ }
      }
      return null;
    };
    const found = await Promise.all([...byPlatform.entries()].map(([p, e]) => probe(p, e)));
    return found.filter((x): x is Item => !!x).sort((a, b) => a.t.localeCompare(b.t));
  }

  // ── JellyHA (custom Jellyfin integration): folder tree from album paths, signed streams ──
  private _hasJH() { return !!(this.hass as any)?.services?.jellyha?.search; }
  private _jh(d: Record<string, any>) { return this._svc('jellyha', 'search', d); }
  private _jhTrack(x: any): Item {
    return {
      src: 'jh', jk: 'track', id: x.id, t: fixText(x.name).trim() || fixText(String(x.path || '').split('/').pop()), s: fixText(x.artist_name),
      ic: 'mdi:music-note', img: x.image_url ? this._url(x.image_url) : undefined, dur: x.duration_seconds, play: true, url: x.stream_url ? this._url(x.stream_url) : undefined,
      album: fixText(x.album), fmt: fromJellyHA(x) || fromPath(x.path),
    };
  }
  private async _jhTracks(parentId: string): Promise<Item[]> {
    let off = 0, all: any[] = [];
    for (let i = 0; i < 40; i++) {
      const r = await this._jh({ parent_id: parentId, media_type: 'Audio', limit: 50, offset: off, sort_by: 'SortName', sort_order: 'Ascending' });
      const got = r?.items || []; all = all.concat(got); off += got.length;
      if (got.length < 50) break;
    }
    all.sort((a, b) => ((a.disc_number || 0) - (b.disc_number || 0)) || ((a.track_number || 0) - (b.track_number || 0)) || String(a.path).localeCompare(String(b.path)));
    return all.map((x) => this._jhTrack(x));
  }
  private _jhDir(n: JhNode): Item {
    return { src: 'jh', jk: 'dir', jdir: n, t: n.name, s: n.dirs.length ? `${n.dirs.length} ${this.t('folders').toLowerCase()}` : undefined,
      ic: n.dirs.length ? 'mdi:folder' : 'mdi:folder-music', nav: true, play: !!n.albumId, mclass: 'directory', id: n.albumId };
  }
  private _jhRoot?: JhNode;

  /** The selected output's own content (presets, favourites, queue, its server library), when it has any. */
  private _hereFor?: string;
  private async _here() {
    const o = this.output;
    if (!this._cols.length || !o || this._hereFor === o.id) return;
    this._hereFor = o.id;
    const root = this._cols[0];
    const drop = () => { root.items = root.items.filter((x) => !(x as any).here); };
    if (o.browser || o.ma || !o.entity) { drop(); this._cols = [...this._cols]; return; }
    const st = this.hass!.states[o.entity];
    if (!st || !((Number(st.attributes.supported_features) || 0) & 131072)) { drop(); this._cols = [...this._cols]; return; }
    let ok = false;
    try {
      const n = await this._browseEntity(o.entity);
      ok = (n.children || []).some((c) => !c.media_content_id.startsWith('media-source://') && !['app', 'game', 'url'].includes(c.media_class) && this._audioOnly(c));
    } catch { ok = false; }
    if (this._hereFor !== o.id) return;
    const before = root.items.length, selItem = root.sel !== undefined ? root.items[root.sel] : undefined;
    const wasHere = !!(selItem as any)?.here;
    drop();
    if (ok) {
      const item = { src: 'pb' as const, entity: o.entity, t: this.outName, ic: 'mdi:speaker', nav: true, here: true };
      root.items.unshift({ kind: 'head', t: this.t('on_this_player'), here: true } as Item, item as Item);
    }
    void before;
    if (wasHere) { root.sel = undefined; this._cols = [root]; }       // the open column belonged to the previous output
    else { root.sel = selItem ? root.items.indexOf(selItem) : undefined; this._cols = [...this._cols]; }
  }
  private async _jhTree(progress: (n: number) => void): Promise<JhNode> {
    if (this._jhRoot) return this._jhRoot;
    let list: [string, string][] | null = null;
    try { const c = JSON.parse(localStorage.getItem(JH_CACHE) || 'null'); if (c && Date.now() - c.t < (this.cfg.cache_hours ?? 12) * 3600e3) list = c.a; } catch { /* no cache */ }
    if (!list) {
      list = [];
      for (let off = 0, i = 0; i < 400; i++) {
        const r = await this._jh({ media_type: 'MusicAlbum', limit: 50, offset: off, sort_by: 'SortName', sort_order: 'Ascending' });
        const got = r?.items || [];
        got.forEach((x: any) => { const p = x.path || x.filepath; if (p) list!.push([x.id, p]); });
        off += got.length; progress(list.length);
        if (got.length < 50) break;
      }
      // large libraries stay in memory only: localStorage is shared with Home Assistant's own data
      try { const js = JSON.stringify({ t: Date.now(), a: list }); if (js.length < 1_500_000) localStorage.setItem(JH_CACHE, js); else localStorage.removeItem(JH_CACHE); } catch { /* storage full or blocked */ }
    }
    // drop the common prefix (e.g. /mnt/media/music)
    const parts = list.map(([, p]) => p.split('/').filter(Boolean));
    let common = parts.length ? parts[0].slice(0, -1) : [];
    parts.forEach((p) => { let i = 0; while (i < common.length && i < p.length - 1 && common[i] === p[i]) i++; common = common.slice(0, i); });
    const root: JhNode = { name: '/', rel: '', dirs: [], map: new Map() };
    list.forEach(([id, p]) => {
      let n = root;
      const seg = p.split('/').filter(Boolean).slice(common.length);
      seg.forEach((sg, i) => {
        let c = n.map.get(sg);
        if (!c) { c = { name: fixText(sg), rel: (n.rel ? n.rel + ' / ' : '') + fixText(sg), dirs: [], map: new Map() }; n.map.set(sg, c); n.dirs.push(c); }
        n = c;
        if (i === seg.length - 1) n.albumId = id;
      });
    });
    const sortRec = (n: JhNode) => { n.dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })); n.dirs.forEach(sortRec); };
    sortRec(root);
    return (this._jhRoot = root);
  }

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
  private _acted = false;
  private _initGen = 0;
  private async _init() {
    this._inited = true;
    const gen = ++this._initGen;
    this._acted = false;
    const items: Item[] = [];
    const pins = this.cfg.folders || [];
    if (pins.length) {
      items.push({ kind: 'head', t: this.t('pinned') });
      pins.forEach((p) => items.push({ src: 'ms', id: p.path, t: p.name || p.path.split('/').pop() || p.path, ic: 'mdi:folder-star', nav: true, play: true, mclass: 'directory' }));
    }
    this._cols = [{ title: this.t('sources'), items: [...items, { kind: 'msg', t: this.t('loading') }] }];
    let root: BrowseNode | null = null;
    try { root = await this._browseMS('media-source://'); } catch { root = null; }
    // every top-level source has media_class "app": filter by source id only
    const kids = (root?.children || []).filter((n) => !NOT_MUSIC_SOURCE.test(n.media_content_id));
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
      const dom = n.media_content_id.replace('media-source://', '').split('/')[0];
      return (k && this._want(k)) || this._want(dom) || (this.cfg.sources !== 'auto' && !!this.cfg.sources?.includes(n.media_content_id));
    });
    const msDomains = new Set(others.map((n) => n.media_content_id.replace('media-source://', '').split('/')[0]));
    const jh = this._want('jellyfin') && this._hasJH();
    // libraries reached through an integration's players (Plex, Sonos, Kodi, Squeezebox, Emby, Spotify, Roon, …)
    const players = await this._playerLibraries(msDomains, jh);
    let jhTree: Item | undefined;
    if (others.length || players.length || jh) {
      items.push({ kind: 'head', t: this.t('library') });
      if (jh) {
        jhTree = { src: 'jh', jk: 'tree', t: 'Jellyfin · ' + this.t('folders'), ic: 'mdi:folder-music', nav: true };
        items.push(jhTree, { src: 'jh', jk: 'playlists', t: 'Jellyfin · ' + this.t('playlists'), ic: 'mdi:playlist-music', nav: true });
      }
      others.forEach((n) => items.push({ ...this._msItem(n), ic: n.media_content_id.includes('radio_browser') ? 'mdi:radio' : 'mdi:bookshelf', play: false }));
      items.push(...players);
    }
    // only open a start folder that has something in it; otherwise Jellyfin folders
    if (startItem) { try { const n = await this._browseMS(startItem.id!); if (!(n.children || []).some((x) => this._audioOnly(x))) startItem = undefined; } catch { startItem = undefined; } }
    if (!startItem && jhTree) startItem = jhTree;
    if (!items.length) items.push({ kind: 'msg', t: this.t('nothing_here') });
    if (gen !== this._initGen) return;
    // the user may already have opened a pinned folder or searched while sources were being found: keep that
    if (this._acted && this._cols.length > 1) { this._cols = [{ ...this._cols[0], items, sel: undefined }, ...this._cols.slice(1)]; this._hereFor = undefined; void this._here(); return; }
    this._cols = [{ title: this.t('sources'), items }];
    this._hereFor = undefined; void this._here();
    if (this._acted) return;
    // open the start folder
    const start = this.cfg.start;
    if (start) { const it: Item = { src: 'ms', id: start, t: start.split('/').pop() || start, nav: true, play: true, mclass: 'directory' }; await this._push(0, it); }
    else if (startItem) { this._cols[0].sel = items.indexOf(startItem); await this._push(0, startItem); }
  }

  // ── columns ──
  private async _openRow(ci: number, ri: number) {
    const col = this._cols[ci], it = col.items[ri];
    if (!it || it.kind) return;
    this._acted = true;
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
      const cached = this._cacheRead(it.id!);
      const apply = (n: BrowseNode) => {
        const kids = (n.children || []).filter((x) => this._audioOnly(x));
        nc.items = kids.map((x) => this._msItem(x));
        const files = kids.some((x) => x.can_play && !x.can_expand);
        nc.wide = files; nc.playAll = files ? it : undefined;
      };
      apply(cached ? cached.n : await this._browseMS(it.id!));
      // refresh in the background when the cached copy is older than half its life
      if (cached && Date.now() - cached.t > (this.cfg.cache_hours ?? 12) * 1800e3) {
        void this._browseMS(it.id!, true).then((f) => {
          if (!this._cols.includes(nc)) return;
          const before = JSON.stringify(nc.items.map((x) => x.id));
          apply(f);
          if (JSON.stringify(nc.items.map((x) => x.id)) !== before) { nc.sel = undefined; this._cols = this._cols.slice(0, this._cols.indexOf(nc) + 1); }
        }).catch(() => {});
      }
    } else if (it.src === 'pb') {
      const n = await this._browseEntity(it.entity!, it.id, it.ctype);
      // the media sources a player lists at its root are already in the drawer
      const kids = (n.children || []).filter((x) => this._audioOnly(x) && !(it.id === undefined && x.media_content_id.startsWith('media-source://')) && !['app', 'game'].includes(x.media_class));
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
    } else if (it.src === 'jh') {
      if (it.jk === 'tree') {
        const root = await this._jhTree((n) => { nc.items = [{ kind: 'msg', t: `${this.t('loading')} ${n}` }]; this._cols = [...this._cols]; });
        nc.items = root.dirs.map((d) => this._jhDir(d));
      } else if (it.jk === 'dir') {
        const n = it.jdir!;
        nc.items = n.dirs.map((d) => this._jhDir(d));
        if (n.albumId) { nc.wide = true; nc.playAll = { ...it, jk: 'album' }; nc.items = nc.items.concat(await this._jhTracks(n.albumId)); }
      } else if (it.jk === 'playlists') {
        const r = await this._svc('jellyha', 'get_playlists', { limit: 500 });
        nc.items = (r?.playlists || []).map((x: any) => ({ src: 'jh' as const, jk: 'playlist' as const, id: x.id, t: fixText(x.name), ic: 'mdi:playlist-music',
          img: x.image_url ? this._url(x.image_url) : undefined, nav: true, play: true }));
      } else if (it.jk === 'playlist' || it.jk === 'album') {
        nc.items = await this._jhTracks(it.id!); nc.wide = true; nc.playAll = it;
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
    this._acted = true;
    const nc: Col = { title: this.t('search_results', { term }), items: [], loading: true, wide: true };
    this._cols = [{ ...this._cols[0], sel: undefined }, nc];
    const lt = term.toLowerCase();
    try {
      if (await this._maEntryId()) {
        const r = await this._svc('music_assistant', 'search', { config_entry_id: this._maEntry, name: term, limit: 12 });
        ([['artists', r?.artists], ['albums', r?.albums], ['tracks', r?.tracks], ['playlists', r?.playlists], ['radio', r?.radio]] as const)
          .forEach(([h, list]) => { if (list?.length) { nc.items.push({ kind: 'head', t: this.t(h) }); list.forEach((x: any) => nc.items.push(this._maItem(x))); } });
      }
      if (this._want('jellyfin') && this._hasJH()) {
        const [al, tr] = await Promise.all([
          this._jh({ query: term, media_type: 'MusicAlbum', limit: 20, sort_by: 'SortName', sort_order: 'Ascending' }).catch(() => null),
          this._jh({ query: term, media_type: 'Audio', limit: 30, sort_by: 'SortName', sort_order: 'Ascending' }).catch(() => null),
        ]);
        if (al?.items?.length) { nc.items.push({ kind: 'head', t: 'Jellyfin · ' + this.t('albums') }); al.items.forEach((x: any) => nc.items.push({ src: 'jh', jk: 'album', id: x.id, t: fixText(x.name).trim() || fixText(String(x.path || '').split('/').pop()), s: fixText(x.album_artist || x.artist_name), ic: 'mdi:album', img: x.image_url ? this._url(x.image_url) : undefined, nav: true, play: true })); }
        if (tr?.items?.length) { nc.items.push({ kind: 'head', t: 'Jellyfin · ' + this.t('tracks') }); tr.items.forEach((x: any) => nc.items.push(this._jhTrack(x))); }
        if (this._jhRoot) {
          const hits: JhNode[] = [];
          const walk = (n: JhNode) => n.dirs.forEach((d) => { if (hits.length < 20 && d.name.toLowerCase().includes(lt)) hits.push(d); walk(d); });
          walk(this._jhRoot);
          if (hits.length) { nc.items.push({ kind: 'head', t: 'Jellyfin · ' + this.t('folders') }); hits.forEach((d) => nc.items.push({ ...this._jhDir(d), s: d.rel })); }
        }
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
    return { id: it.id, url: this._url(r.url), title: it.t, artist: it.s, art: it.img, fmt: it.fmt || fromPath(r.mime_type?.replace('audio/', '.')) };
  }
  /**
   * Plays an item. `order` is set by the column buttons: 'shuffle' plays the whole list in random order,
   * 'inorder' (Play all) plays it in order; a single row leaves the player's shuffle setting alone.
   */
  private _playGen = 0;
  private async _play(it: Item, enqueue?: 'next' | 'add', col?: Col, order?: 'shuffle' | 'inorder') {
    const out = this.output, t = this.t;
    if (!out || !this.hass) return;
    if (!enqueue) this._playGen++;   // stops a folder that is still being queued
    const name = this.outName, mix = order === 'shuffle';
    // speakers that shuffle by themselves: set it before playing a whole list
    const setShuffle = async (on: boolean) => {
      if (order && !out.browser && this.caps?.shuffle) await this.hass!.callService('media_player', 'shuffle_set', { entity_id: out.entity, shuffle: on }).catch(() => {});
    };
    try {
      if (it.src === 'jh') { await this._playJH(it, enqueue, col, order); return; }
      if (out.browser) {
        if (it.src !== 'ms') throw new Error(t('browser_cant'));
        let list: Item[];
        let start = 0;
        if (it.nav) list = await this._files(it);
        else { const sib = (col?.items || []).filter((x) => x.src === 'ms' && x.play && !x.nav); start = Math.max(0, sib.indexOf(it)); list = sib.length ? sib : [it]; }
        if (enqueue) list = [it];
        if (mix) { list = shuffled(list); start = 0; }
        if (!list.length) throw new Error(t('nothing_here'));
        const first = await this._resolve(list[start]);
        if (!first) throw new Error(t('browser_cant'));
        if (enqueue) { WebPlayer.append(WebPlayer.gen, first); this._say(t('queued_on', { output: name, title: it.t }), true); return; }
        const gen = WebPlayer.load([first]);
        void (async () => { for (let i = start + 1; i < list.length; i++) { if (gen !== WebPlayer.gen) return; const tr = await this._resolve(list[i]); if (tr) WebPlayer.append(gen, tr); } })();
        this._say(t(mix ? 'shuffling_on' : 'playing_on', { output: name, title: it.t }), true);
        return;
      }
      if (it.src === 'ma') {
        if (!out.ma) throw new Error('needs a Music Assistant player');
        await setShuffle(mix);
        await this.hass.callService('music_assistant', 'play_media', { media_id: it.id, media_type: it.ctype, enqueue: enqueue || 'replace' }, { entity_id: out.entity });
      } else if (it.nav) {
        // play a folder: first file now, the rest queued when the player supports a queue
        let files = await this._files(it);
        if (!files.length) throw new Error(t('nothing_here'));
        if (mix) files = shuffled(files);
        await setShuffle(false);    // the order is already ours
        const pm = (f: Item, e?: string) => this.hass!.callService('media_player', 'play_media', {
          entity_id: out.entity, media_content_id: f.id, media_content_type: f.ctype || 'music', ...(e && this.caps?.enqueue ? { enqueue: e } : {}),
        });
        await pm(files[0], enqueue || 'replace');
        const pg = ++this._playGen;
        if (this.caps?.enqueue && !enqueue) for (const f of files.slice(1)) { if (pg !== this._playGen) break; await pm(f, 'add'); }
      } else {
        await setShuffle(mix);
        await this.hass.callService('media_player', 'play_media', {
          entity_id: out.entity, media_content_id: it.id, media_content_type: it.ctype || 'music',
          ...(this.caps?.enqueue ? { enqueue: enqueue || 'play' } : {}),
        });
      }
      this._say(t(enqueue ? 'queued_on' : mix ? 'shuffling_on' : 'playing_on', { output: name, title: it.t }), true);
    } catch (e: any) {
      this._say(t('cant_play', { output: name, title: it.t, error: String(e?.message || e) }), false);
    }
  }
  private async _playJH(it: Item, enqueue: 'next' | 'add' | undefined, col?: Col, order?: 'shuffle' | 'inorder') {
    const out = this.output!, t = this.t, name = this.outName, mix = order === 'shuffle';
    let tracks: Item[] = [], start = 0;
    if (it.jk === 'track') {
      const sib = (col?.items || []).filter((x) => x.jk === 'track');
      tracks = sib.length ? sib : [it]; start = Math.max(0, sib.indexOf(it));
    } else if (it.jk === 'dir' || it.jk === 'album' || it.jk === 'playlist') {
      const id = it.jk === 'dir' ? it.jdir?.albumId : it.id;
      if (!id) throw new Error(t('nothing_here'));
      if (out.browser || it.jk === 'playlist') tracks = await this._jhTracks(id);
    }
    if (out.browser) {
      const q = (x: Item) => ({ id: x.id, fmt: x.fmt, url: x.url!, title: x.t, artist: x.s, album: x.album, art: x.img, dur: x.dur });
      let list = tracks.filter((x) => x.url);
      if (!list.length) throw new Error(t('browser_cant'));
      if (enqueue) { WebPlayer.append(WebPlayer.gen, q(it.jk === 'track' ? it : list[0])); this._say(t('queued_on', { output: name, title: it.t }), true); return; }
      if (mix) { list = shuffled(list); start = 0; }
      WebPlayer.load(list.map(q), Math.min(start, list.length - 1));
    } else {
      if (order && this.caps?.shuffle) await this.hass!.callService('media_player', 'shuffle_set', { entity_id: out.entity, shuffle: mix }).catch(() => {});
      if (it.jk === 'playlist') await this.hass!.callService('jellyha', 'play_playlist', { entity_id: out.entity, playlist: it.id, shuffle: mix });
      else {
        const id = it.jk === 'dir' ? it.jdir?.albumId : it.id;
        await this.hass!.callService('jellyha', 'play_music', { entity_id: out.entity, item_id: id, ...(it.jk === 'track' ? {} : { search_type: 'album' }) });
      }
      if (mix && it.jk !== 'playlist' && !this.caps?.shuffle) { this._say(t('no_shuffle', { output: name }), false); return; }
    }
    this._say(t(mix ? 'shuffling_on' : 'playing_on', { output: name, title: it.t }), true);
  }
  private _say(text: string, ok: boolean) {
    this._toast = { text, ok };
    clearTimeout(this._tt);
    this._tt = window.setTimeout(() => { this._toast = null; }, ok ? 3000 : 7000);
  }

  // ── keyboard ──
  private _onKey(e: KeyboardEvent) {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.r');
    if (!row || e.target !== row) return;   // keys on the row's own buttons do what the button does
    const ci = +row.dataset.c!, ri = +row.dataset.r!;
    const rows = [...this.renderRoot.querySelectorAll<HTMLElement>(`.r[data-c="${ci}"]`)];
    const i = rows.indexOf(row);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      const it = this._cols[ci].items[ri];
      if (e.key === 'Enter' && !it.nav && it.play) { void this._play(it, undefined, this._cols[ci]); return; }
      void this._openRow(ci, ri).then(() => this.updateComplete).then(() => this.renderRoot.querySelector<HTMLElement>(`.r[data-c="${ci + 1}"]`)?.focus());
    } else if (e.key === 'ArrowLeft' && ci > 0 && (this.cfg.view === 'list' || this._narrow)) {
      e.preventDefault();
      this._cols = this._cols.slice(0, ci);
      void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(`.r[data-c="${ci - 1}"][data-r="${this._cols[ci - 1]?.sel ?? 0}"]`)?.focus());
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
          <span class="chev ${this._open ? 'up' : ''}">▾</span>${(this._open ? t('close_library') : t('library')).toLocaleUpperCase('el')}</button>
        ${this._open ? html`<label class="q"><span aria-hidden="true">⌕</span><input type="search" placeholder=${t('search')} aria-label=${t('search')}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this._search((e.target as HTMLInputElement).value.trim()); }}></label>` : nothing}
        <span class="on">${t('play_on').toLocaleUpperCase('el')} · <b>${this.outName}</b></span>
      </div>
      ${this._open ? html`<div class="mill" style="--lh:${this.cfg.height ?? 420}px" @keydown=${this._onKey}>
        ${this._toast ? html`<div class="toast ${this._toast.ok ? 'ok' : ''}" role="status">${this._toast.text}</div>` : nothing}
        ${cols.map((c, k) => this._col(c, base + k, list, k === cols.length - 1))}
      </div>` : nothing}
    </div>`;
  }
  private _col(c: Col, ci: number, list: boolean, last: boolean) {
    const t = this.t;
    const count = c.items.filter((x) => !x.kind).length;
    return html`<div class="col ${c.wide || list ? 'wide' : ''} ${last ? 'last' : ''}" role="list" aria-label=${c.title}>
      <div class="ch">
        ${list && ci > 0 ? html`<button type="button" class="back" aria-label=${t('back')} @click=${() => { this._cols = this._cols.slice(0, ci); }}>‹</button>` : nothing}
        <span class="ct">${c.title}</span>${ci && count ? html`<span class="cn">${count}${c.paged?.more ? '+' : ''}</span>` : nothing}
        ${c.playAll ? html`<button type="button" class="pa" title=${t('play_all')} @click=${() => this._play(c.playAll!, undefined, c, 'inorder')}>▶ ${t('play_all').toLocaleUpperCase('el')}</button>
          <button type="button" class="pa" title=${t('shuffle_play')} aria-label="${t('shuffle_play')} ${c.title}" @click=${() => this._play(c.playAll!, undefined, c, 'shuffle')}>⇄ ${t('shuffle').toLocaleUpperCase('el')}</button>` : nothing}
      </div>
      <div class="rows" @scroll=${(e: Event) => { const r = e.target as HTMLElement; if (c.paged?.more && r.scrollTop + r.clientHeight > r.scrollHeight - 80) void this._more(c); }}>
        ${c.loading ? html`<div class="msg">${t('loading')}</div>` : c.err ? html`<div class="msg">${t('could_not_load', { error: c.err })}</div>`
          : !c.items.length ? html`<div class="msg">${t('nothing_here')}</div>`
            : c.items.map((it, ri) => it.kind === 'head' ? html`<div class="hd">${it.t.toLocaleUpperCase('el')}</div>` : it.kind === 'msg' ? html`<div class="msg">${it.t}</div>`
              : html`<div class="r ${it.mclass === 'directory' ? 'dir' : ''} ${c.sel === ri ? 'sel' : ''} ${this._isNow(it) ? 'now' : ''}" role="listitem" tabindex="0" aria-current=${this._isNow(it) ? 'true' : c.sel === ri ? 'step' : 'false'}
                  title=${[it.t, it.s].filter(Boolean).join(' — ')} data-c=${ci} data-r=${ri} @click=${() => this._openRow(ci, ri)}>
                <span class="ri"><ha-icon icon=${it.ic || 'mdi:music'}></ha-icon>${it.img ? html`<img src=${it.img} loading="lazy" alt="" @error=${(e: Event) => (e.target as HTMLElement).remove()}>` : nothing}</span>
                <span class="rt"><span class="rn">${it.t}</span>${it.s ? html`<span class="rs">${it.s}</span>` : nothing}</span>
                ${this._isNow(it) ? html`<span class="eq" aria-label=${t('playing')}><i></i><i></i><i></i></span>` : nothing}
                ${ci && it.play ? html`<span class="acts"><button type="button" class="rp" title=${t('play')} aria-label="${t('play')} ${it.t}" @click=${(e: Event) => { e.stopPropagation(); void this._play(it, undefined, c); }}>▶</button>
                  ${(it.src !== 'jh' && this.caps?.enqueue) || (it.src === 'ma' && this.output?.ma) || (it.src === 'jh' && this.output?.browser) ? html`<button type="button" class="rq" title=${t('play_next')} aria-label="${t('play_next')} ${it.t}" @click=${(e: Event) => { e.stopPropagation(); void this._play(it, 'next', c); }}>⤵</button>
                  <button type="button" class="rq" title=${t('add_queue')} aria-label="${t('add_queue')} ${it.t}" @click=${(e: Event) => { e.stopPropagation(); void this._play(it, 'add', c); }}>+</button>` : nothing}</span>` : nothing}
                ${this.quality && it.fmt?.codec && !it.nav ? html`<span class="qt" title=${[it.fmt.codec, ...formatBadges(it.fmt)].join(' · ')}>${it.fmt.codec}${it.fmt.hires ? html`<b>HR</b>` : nothing}</span>` : nothing}
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
.col{flex:0 0 auto;width:max-content;min-width:190px;max-width:340px;display:flex;flex-direction:column;border-right:1px solid rgba(255,255,255,.05);background:rgba(0,0,0,.18)}
.col:first-child{background:rgba(0,0,0,.28)}
/* the right-most column takes the remaining width and never cuts a title: long ones wrap */
.col.last{flex:1 0 auto;width:auto;min-width:300px;max-width:none}
.col.last .rn,.col.last .rs{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere}
.col.wide:not(.last){max-width:420px}
.ch{display:flex;align-items:center;gap:6px;padding:8px 10px 6px;border-bottom:1px solid rgba(255,255,255,.05);min-height:30px}
.back{font-size:20px;line-height:1;color:var(--acc);padding:0 6px}
.ct{flex:1;min-width:0;font-size:10px;letter-spacing:.12em;color:#8f8f8f;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cn{font-size:9px;color:#5f5f5f}
.pa{border:1px solid var(--acc);color:var(--acc);border-radius:12px;font-size:9px;letter-spacing:.1em;padding:3px 8px;white-space:nowrap}
.pa:hover{background:var(--acc);color:var(--acc-ink,#000)}
.rows{flex:1;overflow-y:auto;padding:2px 0 8px}
.rows::-webkit-scrollbar,.mill::-webkit-scrollbar{width:6px;height:6px}.rows::-webkit-scrollbar-thumb,.mill::-webkit-scrollbar-thumb{background:#2c2d30;border-radius:3px}
.hd{font-size:9px;letter-spacing:.18em;color:#6b737d;padding:12px 12px 4px}
.r{position:relative;display:flex;align-items:center;gap:8px;padding:5px 10px 5px 10px;cursor:pointer;border-left:2px solid transparent;user-select:none;min-height:32px}
.r.now .rn{color:var(--acc);font-weight:600}.r.now{background:color-mix(in srgb,var(--acc) 10%,transparent)}
.eq{flex:none;display:flex;align-items:flex-end;gap:2px;height:12px}
.eq i{width:3px;background:var(--acc);animation:eq 1s ease-in-out infinite}.eq i:nth-child(2){animation-delay:-.4s}.eq i:nth-child(3){animation-delay:-.7s}
@keyframes eq{0%,100%{height:3px}50%{height:12px}}
@media (prefers-reduced-motion: reduce){.eq i{animation:none;height:8px}}
/* play / queue buttons float over the end of the row instead of taking room from the title */
.acts{position:absolute;right:6px;top:50%;transform:translateY(-50%);display:flex;gap:4px;padding:2px 2px 2px 18px;opacity:0;pointer-events:none;
  background:linear-gradient(90deg,transparent,#15171a 16px)}
.r:hover .acts,.r:focus-within .acts,.col.last .r.sel .acts{opacity:1;pointer-events:auto}
.col.last .acts{position:static;transform:none;background:none;padding:0}
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
.qt{flex:none;font:700 8px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;color:#8b949e;border:1px solid #3a3d42;border-radius:3px;padding:1px 4px;display:flex;gap:3px}
.qt b{color:var(--acc);font-weight:700}
.rd{font-size:10px;color:#6f6f6f;font-family:ui-monospace,Menlo,Consolas,monospace}
.rc{color:#555;font-size:14px;width:10px;text-align:center}
.rp,.rq{flex:none;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;background:#15171a}
.rp{border:1px solid var(--acc);color:var(--acc)}.rq{border:1px solid #444;color:#aaa}
.rp:hover{background:var(--acc);color:var(--acc-ink,#000)}.rq:hover{color:#fff;border-color:#888}

@media (hover:none){.col.last .acts{opacity:1;pointer-events:auto;position:static;transform:none;background:none;padding:0}}
.msg{padding:14px 12px;font-size:11px;color:#7a7a7a}
.more{padding:8px 12px;font-size:10px;color:var(--acc)}
.toast{position:sticky;left:12px;top:10px;z-index:3;align-self:flex-start;margin:10px 0 0 12px;max-width:min(560px,calc(100% - 24px));flex:none;position:absolute;padding:8px 12px;border-radius:8px;background:rgba(40,12,10,.96);border:1px solid rgba(255,90,78,.5);color:#ffb3ac;font-size:12px}
.toast.ok{background:rgba(8,32,28,.96);border-color:var(--acc);color:#dffdf6}
`;
}

if (!customElements.get('hifi-library')) customElements.define('hifi-library', HifiLibrary);
