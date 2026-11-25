import { LitElement, css, html, nothing } from 'lit';
import { buildOutputs } from './discovery';
import type { CardConfig, HomeAssistant, OutputConfig } from './types';

type Tab = 'players' | 'library' | 'look' | 'layout' | 'controls';

const LABELS: Record<string, string> = {
  include: 'Only these players', exclude: 'Never show these players', include_areas: 'Only these areas', exclude_areas: 'Leave out these areas',
  prefer_music_assistant: 'Show Music Assistant players instead of duplicates', group_by: 'Group outputs by', show_unavailable: 'List offline players',
  browser_player: 'Add "This browser" as an output', default_output: 'Output selected on first load', output_helper: 'Sync output with an input_select helper (optional)',
  remember_output: 'Remember the chosen output in this browser', unavailable: 'Unavailable players',
  enabled: 'Show the media browser', sources: 'Sources (empty = all found)', start: 'Start folder (media-source path)', open: 'Drawer on load', height: 'Drawer height (px)',
  view: 'View', audio_only: 'Hide video and image files', cache_hours: 'Cache the folder tree for (hours)',
  theme: 'Theme', theme_switch: 'Show the theme switch', remember_theme: 'Remember the theme per browser', mode: 'Streamer colour mode', accent: 'Accent colour (hex)',
  brand: 'Brand text (Console, top left)', model: 'Model text (Console, top right)', background: 'Background', fonts: 'Fonts', placeholder_art: 'Placeholder artwork URL',
  layout: 'Layout', max_height: 'Maximum height (px)', idle_text: 'Text when nothing plays',
  art: 'Artwork', spectrum: 'Spectrum', meters: 'Level meters / VU', seek: 'Seek bar', outputs: 'Output selector', switches: 'Switches (Console)', chips: 'Badges', volume: 'Volume knob',
  back: 'Skip back (s)', forward: 'Skip forward (s)', step: 'Volume step (0–1)', max: 'Maximum volume (0–1)', confirm_timeout: 'Wait for the player to confirm volume (s)',
  visualizer: 'Visualiser', reduced_motion: 'Reduced motion', pause_offscreen: 'Pause animation when off screen', language: 'Language',
};
const sel = (options: [string, string][]) => ({ select: { mode: 'dropdown', options: options.map(([value, label]) => ({ value, label })) } });

export class HifiMusicPlayerCardEditor extends LitElement {
  static override properties = { hass: { attribute: false }, _config: { state: true }, _tab: { state: true } };
  hass?: HomeAssistant;
  private _config!: CardConfig;
  private _tab: Tab = 'players';

  setConfig(c: CardConfig) { this._config = { ...c }; }

  override connectedCallback() {
    super.connectedCallback();
    // make sure HA's form elements are loaded (they are lazy-loaded by the frontend)
    void (async () => {
      if (customElements.get('ha-form') && customElements.get('ha-entity-picker')) return;
      try { const h = await (window as any).loadCardHelpers?.(); const c = await h?.createCardElement({ type: 'entities', entities: [] }); await c?.constructor?.getConfigElement?.(); } catch { /* best effort */ }
      this.requestUpdate();
    })();
  }

  private _emit(c: CardConfig) {
    this._config = c;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: c }, bubbles: true, composed: true }));
  }
  private _set(path: string[], v: unknown) {
    const c: any = structuredClone(this._config);
    let o = c;
    path.slice(0, -1).forEach((k) => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; });
    const last = path[path.length - 1];
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete o[last]; else o[last] = v;
    this._emit(c);
  }
  private _form(data: Record<string, any>, schema: any[], onChange: (v: Record<string, any>) => void) {
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${schema} .computeLabel=${(s: any) => LABELS[s.name] || s.name}
      @value-changed=${(e: CustomEvent) => onChange(e.detail.value)}></ha-form>`;
  }
  private _merge(base: string[] | null, v: Record<string, any>) {
    const c: any = structuredClone(this._config);
    let o = c;
    (base || []).forEach((k) => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; });
    for (const [k, x] of Object.entries(v)) { if (x === undefined || x === '' || (Array.isArray(x) && !x.length)) delete o[k]; else o[k] = x; }
    this._emit(c);
  }

  // ── tabs ──
  private _players() {
    const c = this._config, manual = Array.isArray(c.outputs) || !!c.entity;
    const d = c.discovery || {};
    const found = this.hass && !manual ? buildOutputs(this.hass, { ...c, discovery: { ...d, overrides: Object.fromEntries(Object.entries(d.overrides || {}).map(([k, v]) => [k, { ...v, hidden: false }])) }, browser_player: false }) : [];
    const ov = d.overrides || {};
    return html`
      <div class="row"><span class="lab">Outputs</span>
        <div class="seg">
          <button type="button" class=${manual ? '' : 'on'} @click=${() => { const n: any = { ...c, outputs: 'auto' }; delete n.entity; this._emit(n); }}>Find automatically</button>
          <button type="button" class=${manual ? 'on' : ''} @click=${() => { const n: any = { ...c, outputs: (found.length ? found : []).map((o) => ({ entity: o.entity, name: o.name })) }; delete n.entity; this._emit(n); }}>Choose by hand</button>
        </div></div>
      ${manual ? this._manual() : html`
        ${this._form(d, [
          { name: 'include', selector: { entity: { multiple: true, filter: { domain: 'media_player' } } } },
          { name: 'exclude', selector: { entity: { multiple: true, filter: { domain: 'media_player' } } } },
          { name: 'include_areas', selector: { area: { multiple: true } } },
          { name: 'exclude_areas', selector: { area: { multiple: true } } },
          { name: 'group_by', selector: sel([['area', 'Area'], ['integration', 'Integration'], ['none', 'No groups']]) },
          { name: 'prefer_music_assistant', selector: { boolean: {} } },
          { name: 'show_unavailable', selector: { boolean: {} } },
        ], (v) => this._merge(['discovery'], v))}
        <div class="sub">Players found (${found.length}) — rename, hide or reorder</div>
        ${found.map((o, i) => html`<div class="pl ${ov[o.id]?.hidden ? 'hid' : ''}">
          <span class="pid" title=${o.entity || ''}>${o.area ? html`<small>${o.area}</small>` : nothing}${o.entity}</span>
          <input type="text" .value=${ov[o.id]?.name || ''} placeholder=${o.name} aria-label="Name for ${o.entity}"
            @change=${(e: Event) => this._set(['discovery', 'overrides', o.id, 'name'], (e.target as HTMLInputElement).value.trim() || undefined)}>
          <button type="button" title="Move up" ?disabled=${i === 0} @click=${() => this._move(found.map((x) => x.id), i, -1)}>▲</button>
          <button type="button" title="Move down" ?disabled=${i === found.length - 1} @click=${() => this._move(found.map((x) => x.id), i, 1)}>▼</button>
          <button type="button" title=${ov[o.id]?.hidden ? 'Show' : 'Hide'} @click=${() => this._set(['discovery', 'overrides', o.id, 'hidden'], ov[o.id]?.hidden ? undefined : true)}>${ov[o.id]?.hidden ? 'Show' : 'Hide'}</button>
        </div>`)}`}
      ${this._form(c, [
        ...(manual ? [] : [{ name: 'browser_player', selector: { boolean: {} } }]),
        { name: 'default_output', selector: { text: {} } },
        { name: 'remember_output', selector: { boolean: {} } },
        { name: 'unavailable', selector: sel([['dim', 'Dim'], ['hide', 'Hide']]) },
        { name: 'output_helper', selector: { entity: { filter: { domain: 'input_select' } } } },
      ], (v) => this._merge(null, v))}`;
  }
  private _move(ids: string[], i: number, d: number) {
    const order = [...ids];
    const [x] = order.splice(i, 1); order.splice(i + d, 0, x);
    const c: any = structuredClone(this._config);
    c.discovery = c.discovery || {}; c.discovery.overrides = c.discovery.overrides || {};
    order.forEach((id, k) => { c.discovery.overrides[id] = { ...(c.discovery.overrides[id] || {}), order: k }; });
    this._emit(c);
  }
  private _manual() {
    const list: OutputConfig[] = Array.isArray(this._config.outputs) ? this._config.outputs : this._config.entity ? [{ entity: this._config.entity }] : [];
    const put = (l: OutputConfig[]) => { const n: any = { ...this._config, outputs: l }; delete n.entity; this._emit(n); };
    return html`${list.map((o, i) => html`<div class="mo">
      ${o.browser ? html`<span class="pid">This browser</span>` : html`<ha-selector .hass=${this.hass} .selector=${{ entity: { filter: { domain: 'media_player' } } }} .value=${o.entity}
        @value-changed=${(e: CustomEvent) => { const l = [...list]; l[i] = { ...o, entity: e.detail.value }; put(l); }}></ha-selector>`}
      <input type="text" .value=${o.name || ''} placeholder="Name" aria-label="Name" @change=${(e: Event) => { const l = [...list]; l[i] = { ...o, name: (e.target as HTMLInputElement).value.trim() || undefined }; put(l); }}>
      <button type="button" title="Move up" ?disabled=${i === 0} @click=${() => { const l = [...list]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; put(l); }}>▲</button>
      <button type="button" title="Remove" @click=${() => put(list.filter((_, k) => k !== i))}>✕</button>
    </div>`)}
    <div class="adds"><button type="button" class="add" @click=${() => put([...list, { entity: '' }])}>+ Add player</button>
      ${list.some((o) => o.browser) ? nothing : html`<button type="button" class="add" @click=${() => put([...list, { browser: true, name: 'This browser' }])}>+ Add "This browser"</button>`}</div>`;
  }
  private _library() {
    const l = this._config.library;
    const on = l !== false, data = { enabled: on, ...(typeof l === 'object' ? l : {}) } as Record<string, any>;
    const srcs = Array.isArray(data.sources) ? data.sources : [];
    return html`${this._form({ ...data, sources: srcs }, [
      { name: 'enabled', selector: { boolean: {} } },
      ...(on ? [
        { name: 'sources', selector: { select: { multiple: true, mode: 'list', options: [
          { value: 'folders', label: 'Local and network-share folders' }, { value: 'music_assistant', label: 'Music Assistant library' },
          { value: 'jellyfin', label: 'Jellyfin' }, { value: 'plex', label: 'Plex' }, { value: 'dlna', label: 'DLNA / UPnP servers' }, { value: 'radio', label: 'Radio Browser' }] } } },
        { name: 'start', selector: { text: {} } },
        { name: 'open', selector: sel([['collapsed', 'Collapsed'], ['expanded', 'Open']]) },
        { name: 'view', selector: sel([['columns', 'Columns'], ['list', 'List']]) },
        { name: 'height', selector: { number: { min: 200, max: 1200, step: 10, mode: 'box' } } },
        { name: 'audio_only', selector: { boolean: {} } },
        { name: 'cache_hours', selector: { number: { min: 0, max: 168, mode: 'box' } } },
      ] : []),
    ], (v) => {
      const { enabled, ...rest } = v;
      if (!enabled) { this._set(['library'], false); return; }
      const clean: Record<string, any> = {};
      for (const [k, x] of Object.entries(rest)) if (x !== undefined && x !== '' && !(Array.isArray(x) && !x.length)) clean[k] = x;
      this._set(['library'], Object.keys(clean).length ? clean : undefined);
    })}
    <p class="hint">Network shares (Samba/NFS) are added once in Home Assistant: Settings → System → Storage → Add network storage, usage "Media". They then appear under Folders.</p>`;
  }
  private _look() {
    return this._form(this._config, [
      { name: 'theme', selector: sel([['streamer', 'Streamer'], ['console', 'VU Console']]) },
      { name: 'theme_switch', selector: { boolean: {} } },
      { name: 'remember_theme', selector: { boolean: {} } },
      { name: 'mode', selector: sel([['dark', 'Dark'], ['light', 'Light'], ['auto', 'Follow Home Assistant']]) },
      { name: 'accent', selector: { text: {} } },
      { name: 'brand', selector: { text: {} } },
      { name: 'model', selector: { text: {} } },
      { name: 'background', selector: sel([['theme', 'Theme panel'], ['card', 'Card background'], ['transparent', 'Transparent']]) },
      { name: 'fonts', selector: sel([['web', 'Web fonts (Google Fonts)'], ['system', 'System fonts (offline)']]) },
      { name: 'placeholder_art', selector: { text: {} } },
    ], (v) => this._merge(null, v));
  }
  private _layoutTab() {
    const s = this._config.show || {};
    return html`${this._form(this._config, [
      { name: 'layout', selector: sel([['auto', 'Automatic (by width)'], ['wide', 'Wide'], ['compact', 'Compact'], ['mini', 'Mini']]) },
      { name: 'max_height', selector: { number: { min: 120, max: 1200, mode: 'box' } } },
      { name: 'idle_text', selector: { text: {} } },
    ], (v) => this._merge(null, v))}
    <div class="sub">Shown parts</div>
    ${this._form(Object.fromEntries(['art', 'spectrum', 'meters', 'seek', 'outputs', 'switches', 'chips', 'volume'].map((k) => [k, (s as any)[k] !== false])),
      ['art', 'spectrum', 'meters', 'seek', 'outputs', 'switches', 'chips', 'volume'].map((name) => ({ name, selector: { boolean: {} } })),
      (v) => { const n: Record<string, boolean> = {}; Object.entries(v).forEach(([k, x]) => { if (x === false) n[k] = false; }); this._set(['show'], Object.keys(n).length ? n : undefined); })}`;
  }
  private _controls() {
    return html`${this._form(this._config.skip || {}, [
      { name: 'back', selector: { number: { min: 1, max: 120, mode: 'box' } } },
      { name: 'forward', selector: { number: { min: 1, max: 300, mode: 'box' } } },
    ], (v) => this._merge(['skip'], v))}
    ${this._form(this._config.volume || {}, [
      { name: 'step', selector: { number: { min: 0.01, max: 0.2, step: 0.01, mode: 'box' } } },
      { name: 'max', selector: { number: { min: 0.05, max: 1, step: 0.05, mode: 'box' } } },
      { name: 'confirm_timeout', selector: { number: { min: 1, max: 60, mode: 'box' } } },
    ], (v) => this._merge(['volume'], v))}
    ${this._form(this._config, [
      { name: 'visualizer', selector: sel([['auto', 'Real levels only'], ['animated', 'Animate when no real levels'], ['off', 'Off']]) },
      { name: 'pause_offscreen', selector: { boolean: {} } },
      { name: 'language', selector: sel([['', 'Home Assistant language'], ['en', 'English'], ['el', 'Ελληνικά']]) },
    ], (v) => this._merge(null, v))}`;
  }

  protected override render() {
    if (!this._config) return nothing;
    const tabs: [Tab, string][] = [['players', 'Players'], ['library', 'Library'], ['look', 'Look'], ['layout', 'Layout'], ['controls', 'Controls']];
    return html`<div class="tabs" role="tablist">${tabs.map(([k, l]) => html`<button type="button" role="tab" aria-selected=${this._tab === k} class=${this._tab === k ? 'on' : ''} @click=${() => { this._tab = k; }}>${l}</button>`)}</div>
      <div class="body">${this._tab === 'players' ? this._players() : this._tab === 'library' ? this._library() : this._tab === 'look' ? this._look() : this._tab === 'layout' ? this._layoutTab() : this._controls()}</div>`;
  }

  static override styles = css`
:host{display:block}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--divider-color);margin-bottom:12px;overflow-x:auto}
.tabs button{border:none;background:none;padding:10px 12px;font:500 14px var(--paper-font-body1_-_font-family,inherit);color:var(--secondary-text-color);cursor:pointer;border-bottom:2px solid transparent}
.tabs button.on{color:var(--primary-color);border-bottom-color:var(--primary-color)}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.lab{font-weight:500}
.seg{display:flex;border:1px solid var(--divider-color);border-radius:8px;overflow:hidden}
.seg button{border:none;background:none;padding:8px 12px;cursor:pointer;color:var(--primary-text-color)}
.seg button.on{background:var(--primary-color);color:var(--text-primary-color,#fff)}
.sub{margin:16px 0 8px;font-weight:500;color:var(--secondary-text-color)}
.pl,.mo{display:flex;align-items:center;gap:6px;margin-bottom:6px}
.pl.hid{opacity:.5}
.pid{flex:1;min-width:0;font-size:12px;color:var(--secondary-text-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;flex-direction:column}
.pid small{font-size:10px;opacity:.8}
.mo ha-selector{flex:1;min-width:0}
input[type=text]{flex:1;min-width:0;padding:8px;border-radius:6px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);font:inherit}
.pl button,.mo button,.add{border:1px solid var(--divider-color);background:none;border-radius:6px;padding:6px 8px;cursor:pointer;color:var(--primary-text-color)}
.pl button:disabled,.mo button:disabled{opacity:.3;cursor:default}
.adds{display:flex;gap:8px;margin:8px 0 16px}
.hint{font-size:12px;color:var(--secondary-text-color)}
ha-form{display:block;margin-bottom:12px}
`;
}

if (!customElements.get('hifi-music-player-card-editor')) customElements.define('hifi-music-player-card-editor', HifiMusicPlayerCardEditor);
