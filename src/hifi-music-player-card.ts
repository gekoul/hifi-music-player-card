import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { buildOutputs } from './discovery';
import { BROWSER_CAPS, caps, type Caps } from './features';
import { localizer, type Localize } from './localize';
import { cardStyles } from './styles';
import { compact, consoleWide, mini, streamerWide, type Status, type VM } from './themes';
import type { CardConfig, HomeAssistant, LibraryConfig, Output, PlayerView } from './types';
import { LS, SH, SW, TEAL, AMBER, clamp, fmt } from './ui';
import { WebPlayer } from './web-player';
import './library';
import './editor';

declare const __VERSION__: string;
export const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '1.0.0';

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Share+Tech+Mono&family=DotGothic16&display=swap';

function ink(hex: unknown) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  if (!m) return '#000';
  const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#0b0c0d' : '#ffffff';
}

function hash(s: string) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

export class HifiMusicPlayerCard extends LitElement {
  static override styles = cardStyles;
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _theme: { state: true },
    _layout: { state: true },
    _selId: { state: true },
    _dlg: { state: true },
    _light: { state: true },
    _tick: { state: true },
  };

  hass?: HomeAssistant;
  private _config!: CardConfig;
  private _theme: 'streamer' | 'console' = 'streamer';
  private _layout: 'wide' | 'compact' | 'mini' = 'wide';
  private _selId?: string;
  private _dlg = false;
  private _light = true;
  private _tick = 0;

  private _outputs: Output[] = [];
  private _t: Localize = localizer();
  private _scale = 1;
  private _width = 0;
  private _ro?: ResizeObserver;
  private _io?: IntersectionObserver;
  private _visible = true;
  private _raf = 0;
  private _ct = 0;
  private _mt = 0;
  private _m = { l: 0, r: 0, pl: 0, pr: 0, pt: 0, nl: 0, nr: 0, ph: 0, spec: [] as number[] };
  private _vol: number | null = null;
  private _pend: { v: number; t: number; ent: string } | null = null;
  private _drag = false;
  private _dur = 0;
  private _pos0 = 0;
  private _posT = 0;
  private _state: string = 'idle';
  private _helperSeen?: string;
  private _idle = false;
  private _wpSub = () => { if (this._out()?.browser) this._tick++; };
  private _rm = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  // ── Lovelace API ──
  static getConfigElement() { return document.createElement('hifi-music-player-card-editor'); }
  static getStubConfig(): Partial<CardConfig> { return { outputs: 'auto' }; }

  setConfig(c: CardConfig) {
    if (!c) throw new Error('Invalid configuration');
    if (c.outputs !== undefined && c.outputs !== 'auto' && !Array.isArray(c.outputs)) throw new Error('outputs must be "auto" or a list');
    // rows the editor is still filling in (no entity yet) are ignored rather than rejected
    this._config = { ...c, ...(Array.isArray(c.outputs) ? { outputs: c.outputs.filter((o) => o && (o.browser || o.entity)) } : {}) };
    // a theme picked on the card wins until the configured theme itself changes
    const cfgTheme = c.theme === 'console' ? 'console' : 'streamer';
    const [savedFor, saved] = String((c.remember_theme !== false && LS.get(this._key('theme'))) || '').split('|');
    this._theme = saved && savedFor === cfgTheme ? (saved === 'console' ? 'console' : 'streamer') : cfgTheme;
    this._light = LS.get(this._key('light'), '1') === '1';
    if (c.fonts !== 'system') this._loadFonts();
  }
  getCardSize() { return this._layout === 'mini' ? 1 : this._layout === 'compact' ? 6 : 9; }
  getGridOptions() { return { columns: 'full', rows: 'auto', min_columns: 6 }; }

  /** Per-card storage key: the `key` option, or a hash of what identifies the card (its players). */
  private _key(k: string) {
    const c = this._config || ({} as CardConfig);
    const id = c.key || c.output_helper || c.entity || 'c' + hash(JSON.stringify([c.outputs, c.discovery?.source, c.discovery?.include, c.discovery?.also, c.discovery?.include_areas]));
    return `hifi_mpc_${k}:${id}`;
  }
  private _loadFonts() {
    if (document.getElementById('hifi-mpc-fonts')) return;
    const l = document.createElement('link'); l.id = 'hifi-mpc-fonts'; l.rel = 'stylesheet'; l.href = FONT_LINK;
    document.head.appendChild(l);
  }

  // ── lifecycle ──
  override connectedCallback() {
    super.connectedCallback();
    WebPlayer.subs.add(this._wpSub);
    this._ro = new ResizeObserver(() => this._measure());
    this._ro.observe(this);
    if (this._config?.pause_offscreen !== false && 'IntersectionObserver' in window) {
      this._io = new IntersectionObserver((e) => { this._visible = e.some((x) => x.isIntersecting); });
      this._io.observe(this);
    }
    this._raf = requestAnimationFrame((t) => this._frame(t));
  }
  override disconnectedCallback() {
    super.disconnectedCallback();
    WebPlayer.subs.delete(this._wpSub);
    this._ro?.disconnect(); this._io?.disconnect();
    cancelAnimationFrame(this._raf); this._raf = 0;
  }
  private _measure() {
    const w = this.clientWidth || this.getBoundingClientRect().width;
    if (!w) return;
    this._width = w;
    const c = this._config;
    let l: 'wide' | 'compact' | 'mini';
    if (c.layout && c.layout !== 'auto') l = c.layout;
    else {
      // a little hysteresis so a scrollbar appearing does not flip the layout back and forth
      const cur = this._layout, wideAt = cur === 'wide' ? 880 : 900, compactAt = cur === 'mini' ? 490 : 480;
      l = w >= wideAt ? 'wide' : w >= compactAt ? 'compact' : 'mini';
    }
    if (l === 'wide' && c.max_height && (w / SW) * SH > c.max_height) l = 'compact';
    this._layout = l;
    this._scale = w / SW;
    const st = this.renderRoot.querySelector<HTMLElement>('.st'), wrap = this.renderRoot.querySelector<HTMLElement>('.wrap');
    if (st && wrap) { st.style.transform = `scale(${this._scale})`; wrap.style.height = `${SH * this._scale}px`; }
  }

  protected override willUpdate(ch: PropertyValues) {
    if (!this.hass || !this._config) return;
    if (ch.has('hass') || ch.has('_config')) {
      this._t = localizer(this.hass, this._config.language);
      let outs = buildOutputs(this.hass, this._config);
      outs.forEach((o) => { o.na = !o.browser && (!this.hass!.states[o.entity!] || this.hass!.states[o.entity!].state === 'unavailable'); });
      if (this._config.unavailable === 'hide') outs = outs.filter((o) => !o.na || o.id === this._selId);
      this._outputs = outs;
      this._resolveSel();
    }
  }
  private _resolveSel() {
    const c = this._config, outs = this._outputs;
    if (!outs.length) { this._selId = undefined; return; }
    if (c.output_helper) {
      // follow the helper only when its state actually changes (another card or an automation picked an output)
      const v = this.hass?.states[c.output_helper]?.state;
      if (v !== this._helperSeen) {
        this._helperSeen = v;
        const o = outs.find((x) => x.name === v || x.id === v);
        if (o) { this._selId = o.id; return; }
      }
    }
    if (this._selId && outs.some((o) => o.id === this._selId)) return;
    const saved = c.remember_output !== false ? LS.get(this._key('out')) : null;
    const d = outs.find((o) => o.id === saved)
      || outs.find((o) => o.id === c.default_output || o.name === c.default_output)
      || outs.find((o) => !o.browser && this.hass?.states[o.entity!]?.state === 'playing')
      || outs.find((o) => !o.na) || outs[0];
    this._selId = d.id;
  }
  private _out(): Output | undefined { return this._outputs.find((o) => o.id === this._selId); }
  private _view(o?: Output): PlayerView {
    if (!o) return { state: 'unavailable', attributes: {} };
    if (o.browser) return WebPlayer.state();
    return this.hass?.states[o.entity!] || { state: 'unavailable', attributes: {} };
  }
  private _caps(o?: Output): Caps { return o?.browser ? BROWSER_CAPS : caps(this._view(o).attributes.supported_features); }

  // ── actions ──
  private _pick(i: number) {
    const o = this._outputs[i]; if (!o) return;
    this._selId = o.id; this._pend = null;
    if (this._config.remember_output !== false) LS.set(this._key('out'), o.id);
    if (this._config.output_helper) {
      this._helperSeen = this.hass?.states[this._config.output_helper]?.state;
      const opts: string[] = this.hass?.states[this._config.output_helper]?.attributes.options || [];
      const opt = opts.find((x) => x === o.name) || opts.find((x) => x === o.id);
      if (opt) void this.hass!.callService('input_select', 'select_option', { entity_id: this._config.output_helper, option: opt });
    }
  }
  private _setTheme(t: 'streamer' | 'console') {
    this._theme = t;
    if (this._config.remember_theme !== false) LS.set(this._key('theme'), `${this._config.theme === 'console' ? 'console' : 'streamer'}|${t}`);
  }
  private _pos() {
    let p = this._pos0 || 0;
    if (this._state === 'playing') p += (Date.now() - this._posT) / 1000;
    return this._dur ? Math.min(this._dur, p) : p;
  }
  private _seekTo(p: number) {
    const o = this._out(); if (!o) return;
    if (o.browser) { WebPlayer.cmd('seek', p); return; }
    void this.hass!.callService('media_player', 'media_seek', { entity_id: o.entity, seek_position: Math.max(0, p) });
  }
  private _onSeek = (e: MouseEvent) => {
    if (!this._dur || !this._caps(this._out()).seek) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this._seekTo(clamp((e.clientX - r.left) / r.width, 0, 1) * this._dur);
  };
  private _keyAction = (k: string) => {
    const o = this._out(); if (!o) return;
    const a = this._view(o).attributes, sk = this._skip();
    if (k === 'light') { this._light = !this._light; LS.set(this._key('light'), this._light ? '1' : '0'); return; }
    if (k === 'toggle') k = this._state === 'playing' ? (this._caps(o).pause ? 'pause' : 'stop') : 'play';
    if (o.browser) {
      if (k === 'rew') WebPlayer.cmd('seek', this._pos() - sk.back);
      else if (k === 'ff') WebPlayer.cmd('seek', this._pos() + sk.forward);
      else if (k === 'volup' || k === 'voldown') this._sendVol(clamp((this._vol ?? 0) + (k === 'volup' ? 1 : -1) * this._step(), 0, 1));
      else WebPlayer.cmd(k);
      return;
    }
    const svc = (s: string, d: Record<string, any> = {}) => this.hass!.callService('media_player', s, { entity_id: o.entity, ...d });
    const map: Record<string, () => unknown> = {
      prev: () => svc('media_previous_track'), next: () => svc('media_next_track'),
      play: () => svc('media_play'), pause: () => svc('media_pause'), stop: () => svc('media_stop'),
      rew: () => svc('media_seek', { seek_position: Math.max(0, this._pos() - sk.back) }),
      ff: () => svc('media_seek', { seek_position: this._pos() + sk.forward }),
      shuffle: () => svc('shuffle_set', { shuffle: !a.shuffle }),
      repeat: () => svc('repeat_set', { repeat: ({ off: 'all', all: 'one', one: 'off' } as Record<string, string>)[a.repeat || 'off'] }),
      mute: () => svc('volume_mute', { is_volume_muted: !a.is_volume_muted }),
      volup: () => (this._caps(o).volSet && this._vol != null ? this._sendVol(clamp(this._vol + this._step(), 0, 1)) : svc('volume_up')),
      voldown: () => (this._caps(o).volSet && this._vol != null ? this._sendVol(clamp(this._vol - this._step(), 0, 1)) : svc('volume_down')),
    };
    map[k]?.();
  };
  private _skip() { return { back: this._config.skip?.back ?? 10, forward: this._config.skip?.forward ?? 30 }; }
  private _step() { return this._config.volume?.step ?? 0.02; }
  private _maxVol() { return clamp(this._config.volume?.max ?? 1, 0.05, 1); }

  // ── volume knob ──
  private _sendVol(v: number) {
    const o = this._out(); if (!o) return;
    v = Math.round(clamp(v, 0, this._maxVol()) * 100) / 100;
    this._pend = { v, t: Date.now(), ent: o.id };
    this._vol = v; this._paintKnob();
    if (o.browser) { WebPlayer.setVol(v); return; }
    void this.hass!.callService('media_player', 'volume_set', { entity_id: o.entity, volume_level: v });
  }
  private _stepOnly() { const o = this._out(); const c = this._caps(o); return !c.volSet && c.volStep; }
  private _bindKnobs() {
    const root = this.renderRoot as ShadowRoot;
    let y0 = 0, v0 = 0, el: HTMLElement | null = null, acc = 0;
    root.addEventListener('pointerdown', (e: Event) => {
      const pe = e as PointerEvent, k = (pe.target as HTMLElement).closest<HTMLElement>('[data-vk]'); if (!k) return;
      pe.preventDefault(); el = k; k.setPointerCapture(pe.pointerId); y0 = pe.clientY; acc = 0;
      if (this._stepOnly()) return;
      if (this._vol == null) { el = null; return; }
      this._drag = true; v0 = this._vol; this._paintKnob();
    });
    root.addEventListener('pointermove', (e: Event) => {
      const pe = e as PointerEvent; if (!el) return;
      const sc = this._layout === 'wide' ? this._scale : 1;
      if (this._stepOnly()) { acc += (y0 - pe.clientY); y0 = pe.clientY; while (Math.abs(acc) > 24) { this._keyAction(acc > 0 ? 'volup' : 'voldown'); acc -= Math.sign(acc) * 24; } return; }
      this._vol = clamp(v0 + (y0 - pe.clientY) / (180 * sc) * this._maxVol(), 0, this._maxVol()); this._paintKnob();
    });
    const end = () => { if (!el) return; el = null; if (!this._drag) return; this._drag = false; this._sendVol(this._vol ?? 0); };
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
    let wt = 0;
    const nudge = (d: number) => {
      if (this._stepOnly() || this._vol == null) { this._keyAction(d > 0 ? 'volup' : 'voldown'); return; }
      this._vol = clamp(this._vol + d, 0, this._maxVol()); this._pend = { v: this._vol, t: Date.now(), ent: this._selId! }; this._paintKnob();
      clearTimeout(wt); wt = window.setTimeout(() => this._sendVol(this._vol ?? 0), 300);
    };
    root.addEventListener('wheel', (e: Event) => {
      const we = e as WheelEvent; if (!(we.target as HTMLElement).closest('[data-vk]')) return;
      we.preventDefault(); nudge(we.deltaY < 0 ? this._step() : -this._step());
    }, { passive: false });
    root.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent; if (!(ke.target as HTMLElement).closest('[data-vk]')) return;
      const s = this._step();
      const d = ({ ArrowUp: s, ArrowRight: s, ArrowDown: -s, ArrowLeft: -s, PageUp: s * 5, PageDown: -s * 5 } as Record<string, number>)[ke.key];
      if (d) { ke.preventDefault(); nudge(d); }
    });
  }
  private _syncVol() {
    if (this._drag) return;
    const o = this._out(); const a = this._view(o).attributes;
    const real = typeof a.volume_level === 'number' ? a.volume_level : null;
    const p = this._pend, to = (this._config.volume?.confirm_timeout ?? 20) * 1000;
    if (p && (p.ent !== o?.id || (real != null && Math.abs(real - p.v) < 0.02) || Date.now() - p.t > to)) this._pend = null;
    this._vol = this._pend ? this._pend.v : real;
  }
  private _paintKnob() {
    const v = this._vol, max = this._maxVol(), step = this._stepOnly();
    const pend = !!(this._drag || this._pend || v == null);
    const f = v == null ? 0 : clamp(v / max, 0, 1);
    const acc = this._accent();
    this.renderRoot.querySelectorAll<HTMLElement>('[data-vk]').forEach((k) => {
      const ki = k.querySelector<HTMLElement>('.ki'); if (ki) ki.style.transform = `rotate(${-135 + 270 * f}deg)`;
      k.classList.toggle('kpend', pend && !step); k.classList.toggle('kstep', step);
      k.setAttribute('aria-valuenow', String(Math.round((v ?? 0) * 100)));
    });
    this.renderRoot.querySelectorAll('[data-ring]').forEach((r) => {
      r.querySelectorAll<SVGCircleElement>('[data-rl]').forEach((c) => {
        const on = v != null && +c.dataset.rl! / 26 <= f + 1e-6;
        c.setAttribute('fill', on ? (pend ? '#8b9096' : acc) : 'rgba(128,128,128,.18)');
        c.style.filter = on && !pend ? `drop-shadow(0 0 3px ${acc})` : '';
      });
    });
    this.renderRoot.querySelectorAll('[data-k="vv"]').forEach((e) => { e.textContent = step ? this._t('step_only') : v == null ? '—' : String(Math.round(v * 100)); });
  }

  /** Accent colour as a concrete colour: CSS variables are resolved, anything unusable falls back to the theme colour. */
  private _accent() {
    const def = this._theme === 'console' ? AMBER : TEAL;
    let a = this._config.accent == null ? '' : String(this._config.accent).trim();
    const v = /^var\(\s*(--[\w-]+)/.exec(a);
    if (v) a = getComputedStyle(this).getPropertyValue(v[1]).trim();
    if (/^[0-9a-f]{6}$/i.test(a)) a = '#' + a;
    return a && CSS.supports('color', a) ? a : def;
  }
  private _mode(): 'dark' | 'light' {
    const m = this._config.mode || 'dark';
    if (m === 'auto') return this.hass?.themes?.darkMode === false ? 'light' : 'dark';
    return m === 'light' ? 'light' : 'dark';
  }
  private _show = (k: string) => {
    const s = this._config.show || {};
    if (k === 'theme_switch') return this._config.theme_switch !== false && s.theme_switch !== false;
    return (s as Record<string, boolean | undefined>)[k] !== false;
  };

  // ── frame loop: progress + meters ──
  private _frame(t: number) {
    if (!this._raf) return;
    this._raf = requestAnimationFrame((x) => this._frame(x));
    if (!this.hass || !this._visible || document.hidden) return;
    if (t - this._ct > 250) {
      this._ct = t;
      const pos = this._pos(), dur = this._dur, p = dur ? clamp(pos / dur, 0, 1) : 0;
      const live = !dur && this._state === 'playing';
      this.renderRoot.querySelectorAll<HTMLElement>('[data-k="el"]').forEach((e) => { e.textContent = fmt(pos); });
      this.renderRoot.querySelectorAll<HTMLElement>('[data-k="rm"]').forEach((e) => { e.textContent = dur ? '-' + fmt(dur - pos) : live ? this._t('live').toLocaleUpperCase('el') : ''; });
      this.renderRoot.querySelectorAll<HTMLElement>('[data-k="cel"]').forEach((e) => { e.textContent = fmt(pos); });
      this.renderRoot.querySelectorAll<HTMLElement>('[data-k="crm"]').forEach((e) => { e.textContent = dur ? '-' + fmt(dur - pos) : ''; });
      this.renderRoot.querySelectorAll<HTMLElement>('[data-k="pfill"],[data-k="cfill"]').forEach((e) => { const w = e.dataset.w!; e.style.width = w === '%' ? `${p * 100}%` : `${p * +w}px`; });
      this.renderRoot.querySelectorAll<HTMLElement>('[data-k="pdot"]').forEach((e) => { e.style.left = `${p * +e.dataset.w! - 6}px`; });
      if (this._pend) { this._syncVol(); this._paintKnob(); }
    }
    if (t - this._mt > 45) { this._mt = t; this._meters(); }
  }
  private _motion(): 'real' | 'animated' | 'off' {
    const c = this._config;
    const reduce = c.reduced_motion === true || (c.reduced_motion !== false && this._rm?.matches);
    if (c.visualizer === 'off' || reduce) return 'off';
    return c.visualizer === 'animated' ? 'animated' : 'real';
  }
  private _meters() {
    const m = this._m, playing = this._state === 'playing', mode = this._motion();
    const B = this._layout === 'wide' ? (this._theme === 'console' ? 180 : 120) : 72;
    const real = mode !== 'off' && this._out()?.browser ? WebPlayer.levels(B) : null;
    const fake = mode === 'animated' && playing && !real;
    const tgt = () => (fake ? 0.55 + Math.random() * 0.4 : 0);
    m.l = real ? Math.max(real.l, m.l * 0.82) : fake ? m.l * 0.45 + tgt() * 0.55 : m.l * 0.7;
    m.r = real ? Math.max(real.r, m.r * 0.82) : fake ? m.r * 0.45 + tgt() * 0.55 : m.r * 0.7;
    const now = performance.now();
    if (m.l >= m.pl || m.r >= m.pr) m.pt = now;
    m.pl = Math.max(m.l, now - m.pt > 900 ? m.pl - 0.012 : m.pl); m.pr = Math.max(m.r, now - m.pt > 900 ? m.pr - 0.012 : m.pr);
    if (m.spec.length !== B) m.spec = new Array(B).fill(0);
    m.ph += 0.15;
    for (let b = 0; b < B; b++) {
      const f = b / B, base = 0.8 - 0.35 * f + 0.12 * Math.sin(f * 9 + m.ph);
      const tv = real ? real.spec[b] || 0 : fake ? clamp(base + (Math.random() - 0.4) * 0.55, 0, 1) : 0;
      m.spec[b] = tv > m.spec[b] ? m.spec[b] * 0.35 + tv * 0.65 : m.spec[b] * 0.8 + tv * 0.2;
    }
    // nothing moving: draw the resting state once, then stop redrawing until something plays
    const still = !real && !fake && m.l < 0.003 && m.r < 0.003 && m.pl < 0.003 && m.pr < 0.003 && Math.abs(m.nl) < 0.003 && Math.abs(m.nr) < 0.003 && m.spec.every((x) => x < 0.003);
    if (still && this._idle) return;
    this._idle = still;
    const root = this.renderRoot, acc = this._accent();
    root.querySelectorAll<HTMLCanvasElement>('[data-cv="spc"]').forEach((cv) => {
      const g = cv.getContext('2d'); if (!g) return;
      const W = cv.width, H = cv.height, pal = cv.dataset.pal;
      const sig = `${acc}|${(this._config.spectrum_colors || []).join(',')}|${H}`;
      if ((cv as any)._sig !== sig) {
        const gr = g.createLinearGradient(0, H, 0, 0);
        const cols = this._config.spectrum_colors?.length ? this._config.spectrum_colors : pal === 's' ? [acc, acc, '#c8fff3', '#ffffff'] : [acc, '#ffc04d', '#fff0c8', '#ff3b30'];
        cols.forEach((c2, i) => { try { gr.addColorStop(cols.length > 1 ? i / (cols.length - 1) : 0, String(c2)); } catch { gr.addColorStop(cols.length > 1 ? i / (cols.length - 1) : 0, acc); } });
        (cv as any)._grad = gr; (cv as any)._sig = sig;
      }
      g.clearRect(0, 0, W, H);
      const pitch = W / B, bw = Math.max(1, pitch - 2);
      g.globalAlpha = 0.08; g.fillStyle = acc; for (let b = 0; b < B; b++) g.fillRect(b * pitch, 0, bw, H);
      g.globalAlpha = 1; g.fillStyle = (cv as any)._grad;
      for (let b = 0; b < B; b++) { const h = Math.max(2, m.spec[b] * H); g.fillRect(b * pitch, H - h, bw, h); }
    });
    root.querySelectorAll<HTMLCanvasElement>('[data-cv="mtr"]').forEach((mt) => {
      const g = mt.getContext('2d'); if (!g) return;
      const W = mt.width, N = 60, gap = 2, sw = (W - gap * (N - 1)) / N;
      g.clearRect(0, 0, W, mt.height);
      ([[m.l, m.pl, 0], [m.r, m.pr, 20]] as const).forEach(([lv, pk, y]) => {
        for (let i = 0; i < N; i++) { const f = i / N; g.globalAlpha = f < lv ? 1 : 0.1; g.fillStyle = f < 0.7 ? acc : f < 0.86 ? '#ffd166' : '#ff5a5a'; g.fillRect(i * (sw + gap), y, sw, 10); }
        g.globalAlpha = 1; if (pk > 0.02) { g.fillStyle = '#fff'; g.fillRect(Math.min(N - 1, Math.round(pk * N)) * (sw + gap), y, sw, 10); }
      });
    });
    if (this._theme === 'console') {
      m.nl += (m.l - m.nl) * 0.18; m.nr += (m.r - m.nr) * 0.18;
      ([['L', m.nl], ['R', m.nr]] as const).forEach(([c, lv]) => root.querySelectorAll<SVGLineElement>(`[data-ndl="${c}"]`).forEach((n) => {
        n.setAttribute('transform', `rotate(${(-48 + lv * 90).toFixed(1)} ${n.getAttribute('x1')} ${n.getAttribute('y1')})`);
      }));
    }
  }

  // ── render ──
  private _vm(): VM {
    const t = this._t, o = this._out(), st = this._view(o), a = st.attributes;
    const state = st.state;
    this._state = state;
    this._dur = Number(a.media_duration) || 0;
    this._pos0 = Number(a.media_position) || 0;
    this._posT = a.media_position_updated_at ? Date.parse(a.media_position_updated_at) : Date.now();
    const status: Status = state === 'playing' ? 'playing' : state === 'paused' ? 'paused' : state === 'unavailable' ? 'unavailable' : 'idle';
    const live = !this._dur && (status === 'playing' || status === 'paused');
    const title = a.media_title || (status === 'unavailable' ? t('output_unavailable') : this._config.idle_text || t('nothing_playing'));
    const chips: [string, string][] = [];
    if (o?.browser) chips.push([t('this_browser').toLocaleUpperCase('el'), 't']); else if (a.app_name) chips.push([String(a.app_name).toLocaleUpperCase('el'), 't']);
    if (a.media_content_type) chips.push([String(a.media_content_type).toLocaleUpperCase('el'), '']);
    if (live) chips.push([t('live').toLocaleUpperCase('el'), 'a']);
    if (a.shuffle) chips.push([t('shuffle').toLocaleUpperCase('el'), '']);
    if (a.repeat && a.repeat !== 'off') chips.push([`${t('repeat').toLocaleUpperCase('el')} ${String(a.repeat).toLocaleUpperCase('el')}`, '']);
    if (a.is_volume_muted) chips.push([t('muted').toLocaleUpperCase('el'), 'a']);
    const an = String(a.app_name || '');
    const pic = a.entity_picture_local || a.entity_picture || '';
    const outs = this._outputs;
    return {
      t, outputs: outs, out: o, sel: Math.max(0, outs.findIndex((x) => x.id === this._selId)),
      status, title: String(title), artist: String(a.media_artist || ''), album: String(a.media_album_name || ''),
      art: pic && this.hass?.hassUrl && pic.startsWith('/') ? this.hass.hassUrl(pic) : pic,
      placeholder: this._config.placeholder_art,
      chips, short: live ? t('live').toLocaleUpperCase('el') : o?.browser ? 'BROWSER' : (an.length > 9 ? an.split(/\s+/).map((w) => w[0]).join('') : an).toLocaleUpperCase('el'),
      caps: this._caps(o), shuffle: !!a.shuffle, repeat: String(a.repeat || 'off'), muted: !!a.is_volume_muted,
      light: this._light, brand: this._config.brand || '', model: this._config.model || '',
      show: this._show, themeSwitch: this._show('theme_switch'), theme: this._theme, skip: this._skip(),
      srcLine: o?.browser ? t('plays_in_tab') : [o?.area, this.hass?.states[o?.entity || '']?.attributes.friendly_name].filter(Boolean).join(' · '),
      key: this._keyAction, pick: (i) => this._pick(i), setTheme: (th) => this._setTheme(th), seek: this._onSeek,
      nextOutput: () => { const i = outs.findIndex((x) => x.id === this._selId); this._pick((i + 1) % outs.length); },
      outName: (x) => (x.browser ? (Array.isArray(this._config.outputs) ? x.name : t('this_browser')) : x.name),
    };
  }

  private _libCfg(): LibraryConfig | null {
    const l = this._config.library;
    if (l === false) return null;
    return { sources: 'auto', open: 'collapsed', height: 420, view: 'columns', audio_only: true, cache_hours: 12, ...(typeof l === 'object' ? l : {}) };
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this._config || !this.hass) return nothing;
    const vm = this._vm();
    const acc = this._accent();
    const bg = this._config.background || 'theme';
    const cls = `${this._mode() === 'light' && this._theme === 'streamer' ? 'light' : ''} bg-${bg}`;
    const style = `--acc:${acc};--acc-ink:${ink(acc)}`;
    if (!this._outputs.length) return html`<ha-card class=${cls} style=${style}><div class="empty">${this._t('no_players')}</div></ha-card>`;
    const lib = this._libCfg();
    let body: TemplateResult;
    if (this._layout === 'wide') {
      body = html`<div class="wrap" style="height:${SH * this._scale}px"><div class="st ${this._theme}" style="transform:scale(${this._scale})">
        ${this._theme === 'console' ? consoleWide(vm) : streamerWide(vm)}</div></div>`;
    } else if (this._layout === 'compact') body = compact(vm);
    else body = mini(vm, () => { this._dlg = true; });
    return html`<ha-card class=${cls} style=${style}>
      ${body}
      ${lib && this._layout !== 'mini' ? html`<hifi-library .hass=${this.hass} .cfg=${lib} .output=${vm.out} .caps=${vm.caps} .t=${this._t}
        .theme=${this._theme} .outName=${vm.outName(vm.out || { id: '', name: '—' })} .storeKey=${this._key('lib')}></hifi-library>` : nothing}
      ${this._dlg ? html`<div class="dlg" role="dialog" aria-modal="true" aria-label=${vm.title}
          @click=${(e: Event) => { if (e.target === e.currentTarget) this._dlg = false; }} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') this._dlg = false; }}>
        <div class="dlg-in"><button type="button" class="dlg-x" aria-label="Close" @click=${() => { this._dlg = false; }}>✕</button>${compact(vm)}
        ${lib ? html`<hifi-library .hass=${this.hass} .cfg=${{ ...lib, view: 'list' }} .output=${vm.out} .caps=${vm.caps} .t=${this._t} .theme=${this._theme}
          .outName=${vm.outName(vm.out || { id: '', name: '—' })} .storeKey=${this._key('lib')}></hifi-library>` : nothing}</div></div>` : nothing}
    </ha-card>`;
  }

  protected override firstUpdated() { this._bindKnobs(); this._measure(); }
  /** Re-render only when something this card shows has changed, not on every state change in the house. */
  protected override shouldUpdate(ch: PropertyValues) {
    if (ch.size !== 1 || !ch.has('hass')) return true;
    const old = ch.get('hass') as HomeAssistant | undefined, h = this.hass;
    if (!old || !h || old.language !== h.language || old.locale?.language !== h.locale?.language || old.themes?.darkMode !== h.themes?.darkMode) return true;
    const ids = this._outputs.map((o) => o.entity).filter(Boolean) as string[];
    if (this._config.output_helper) ids.push(this._config.output_helper);
    if (ids.some((id) => old.states[id] !== h.states[id])) return true;
    // a media player appearing or disappearing changes what discovery finds
    return this._playerSig(h) !== this._playerSig(old);
  }
  private _sigCache = new WeakMap<object, string>();
  private _playerSig(h: HomeAssistant) {
    let s = this._sigCache.get(h.states);
    if (s === undefined) {
      s = Object.keys(h.states).filter((k) => k.startsWith('media_player.')).map((k) => k + (h.states[k].state === 'unavailable' ? '0' : '1')).join(',');
      this._sigCache.set(h.states, s);
    }
    return s;
  }
  protected override updated(ch: PropertyValues) {
    if (ch.has('_dlg') && this._dlg) this.renderRoot.querySelector<HTMLElement>('.dlg-x')?.focus();
    this._idle = false;   // canvases may be new: draw them once
    this.toggleAttribute('fonts', false);
    if (this._config?.fonts === 'system') this.setAttribute('fonts', 'system');
    this._syncVol(); this._paintKnob();
    if (this._layout === 'wide') {
      const st = this.renderRoot.querySelector<HTMLElement>('.st');
      if (st && Math.abs(this._scale - (this._width || SW) / SW) > 1e-3) this._measure();
    }
  }
}

if (!customElements.get('hifi-music-player-card')) customElements.define('hifi-music-player-card', HifiMusicPlayerCard);

(window as any).customCards = (window as any).customCards || [];
if (!(window as any).customCards.some((c: any) => c.type === 'hifi-music-player-card')) {
  (window as any).customCards.push({
    type: 'hifi-music-player-card',
    name: 'HiFi Music Player',
    description: 'Hi-fi music player with Streamer and VU Console themes, automatic outputs and a built-in media browser.',
    preview: true,
    documentationURL: 'https://github.com/gekoul/hifi-music-player-card',
  });
}
console.info(`%c HIFI-MUSIC-PLAYER-CARD %c ${VERSION} `, 'background:#3ee6c4;color:#000;font-weight:700', 'background:#222;color:#fff');
