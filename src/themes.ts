import { html, nothing, type TemplateResult } from 'lit';
import type { Caps } from './features';
import type { Localize } from './localize';
import type { Output } from './types';
import { AMBER, BRUSH, GLASS, HERO, KNOB_ALU, KNOB_DARK, MONO, VFD, WELL, WOOD, knob, pos, vu } from './ui';

export type Status = 'playing' | 'paused' | 'idle' | 'unavailable';
export type ThemeId = 'streamer' | 'console' | 'helm';
/** Every theme, in menu order, with the colours its menu swatch shows. */
export const THEMES: { id: ThemeId; swatch: string[] }[] = [
  { id: 'streamer', swatch: ['#0c0d0f', '#3ee6c4', '#f4f6f8'] },
  { id: 'console', swatch: ['#6e4024', '#c6cad0', '#ffb347'] },
  { id: 'helm', swatch: ['#ff9c3a', '#cc99ff', '#99ccff'] },
];

export interface VM {
  t: Localize;
  outputs: Output[];
  out?: Output;
  sel: number;
  status: Status;
  title: string;
  artist: string;
  album: string;
  art: string;
  placeholder?: string;
  chips: [string, string][];
  short: string;          // console chip (app name or LIVE)
  fmtLine: string;        // FLAC · 24-bit / 96 kHz · 4.6 Mbps
  fmtShort: string;       // FLAC 24/96 4608K
  caps: Caps;
  shuffle: boolean;
  repeat: string;
  muted: boolean;
  light: boolean;
  brand: string;
  model: string;
  show: (k: string) => boolean;
  themeSwitch: boolean;
  theme: ThemeId;
  themes: ThemeId[];
  menuOpen: boolean;
  toggleMenu: () => void;
  toggleLibrary: () => void;
  hasLibrary: boolean;
  setVol: (f: number) => void;
  fmtBadges: string[];
  skip: { back: number; forward: number };
  srcLine: string;
  key: (k: string) => void;
  pick: (i: number) => void;
  setTheme: (t: ThemeId) => void;
  seek: (e: MouseEvent) => void;
  nextOutput: () => void;
  outName: (o: Output) => string;
}

const statusHTML = (vm: VM) => {
  const s = vm.status, t = vm.t;
  const lab = s === 'playing' ? html`<span style="color:var(--acc)">● ${t('playing').toLocaleUpperCase('el')}</span>`
    : s === 'paused' ? html`<span style="color:#ffd166">❚❚ ${t('paused').toLocaleUpperCase('el')}</span>`
      : s === 'unavailable' ? html`<span style="color:#ff6b6b">● ${t('offline').toLocaleUpperCase('el')}</span>`
        : html`■ ${t('stopped').toLocaleUpperCase('el')}`;
  return html`${lab}&nbsp;&nbsp;·&nbsp;&nbsp;${(vm.out ? vm.outName(vm.out) : '—').toLocaleUpperCase('el')}`;
};

/** Theme button (current theme name) that opens a menu of all offered themes with colour swatches. */
const themeToggle = (vm: VM, _dark?: string) => vm.themeSwitch && vm.themes.length > 1 ? html`<div class="tmenu ${vm.theme}">
  <button type="button" class="tbtn" aria-haspopup="menu" aria-expanded=${vm.menuOpen} aria-label="${vm.t('theme')}: ${vm.t(vm.theme)}"
    @click=${(e: Event) => { e.stopPropagation(); vm.toggleMenu(); }}>${vm.t(vm.theme).toLocaleUpperCase('el')} ▾</button>
  ${vm.menuOpen ? html`<div class="tlist" role="menu" @keydown=${(e: KeyboardEvent) => {
    const items = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role=menuitemradio]')];
    const i = items.indexOf(e.target as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus(); }
    if (e.key === 'Escape' || e.key === 'Tab') vm.toggleMenu();
  }}>
    ${THEMES.filter((x) => vm.themes.includes(x.id)).map((x) => html`<button type="button" role="menuitemradio" aria-checked=${vm.theme === x.id}
      class=${vm.theme === x.id ? 'on' : ''} @click=${(e: Event) => { e.stopPropagation(); vm.setTheme(x.id); vm.toggleMenu(); }}>
      <span class="sw3">${x.swatch.map((c) => html`<i style="background:${c}"></i>`)}</span>${vm.t(x.id)}${vm.theme === x.id ? html`<span class="ck" aria-hidden="true"></span>` : nothing}</button>`)}
  </div>` : nothing}
</div>` : nothing;

const outputSelect = (vm: VM, cls: string, style = '') => html`<select class="osel ${cls}" style=${style} aria-label=${vm.t('output')} @change=${(e: Event) => vm.pick(+(e.target as HTMLSelectElement).value)}>
  ${groups(vm.outputs).map(([g, list]) => g ? html`<optgroup label=${g}>${list.map(([o, i]) => html`<option value=${i} ?selected=${i === vm.sel}>${vm.outName(o)}</option>`)}</optgroup>`
    : list.map(([o, i]) => html`<option value=${i} ?selected=${i === vm.sel}>${vm.outName(o)}</option>`))}
</select>`;

function groups(outs: Output[]): [string | undefined, [Output, number][]][] {
  const m = new Map<string | undefined, [Output, number][]>();
  outs.forEach((o, i) => { const g = o.browser ? undefined : o.group; if (!m.has(g)) m.set(g, []); m.get(g)!.push([o, i]); });
  return [...m.entries()];
}

const placeholderArt = html`<svg aria-hidden="true" viewBox="0 0 300 300" style="position:absolute;inset:0;width:100%;height:100%"><defs><linearGradient id="hmpsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d2a3f"></stop><stop offset=".55" stop-color="#1f5a6e"></stop><stop offset="1" stop-color="#d98a3d"></stop></linearGradient></defs><rect width="300" height="300" fill="url(#hmpsky)"></rect><circle cx="150" cy="150" r="92" fill="#0b0c0e"></circle><circle cx="150" cy="150" r="80" fill="none" stroke="#24272c" stroke-dasharray="1 3"></circle><circle cx="150" cy="150" r="60" fill="none" stroke="#1c1f23"></circle><circle cx="150" cy="150" r="26" fill="var(--acc)"></circle><circle cx="150" cy="150" r="4" fill="#0b0c0e"></circle></svg>`;

export const artBox = (vm: VM) => html`${vm.placeholder ? html`<img alt="" src=${vm.placeholder} style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : placeholderArt}
  ${vm.art ? html`<img alt="" src=${vm.art} style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" @error=${(e: Event) => { (e.target as HTMLElement).hidden = true; }}>` : nothing}`;

interface Btn { k: string; ic: string; label: string; size: number }
function transport(vm: VM): Btn[] {
  const c = vm.caps, t = vm.t, b: Btn[] = [];
  if (c.shuffle) b.push({ k: 'shuffle', ic: '⇄', label: t('shuffle'), size: 30 });
  if (c.prev) b.push({ k: 'prev', ic: '⏮', label: t('prev'), size: 40 });
  if (c.seek) b.push({ k: 'rew', ic: `↺${vm.skip.back}`, label: `${t('back')} ${vm.skip.back}s`, size: 40 });
  if (c.play || c.pause) b.push({ k: 'toggle', ic: vm.status === 'playing' ? '❚❚' : '▶', label: vm.status === 'playing' ? t('pause') : t('play'), size: 62 });
  if (c.seek) b.push({ k: 'ff', ic: `${vm.skip.forward}↻`, label: `${t('forward')} ${vm.skip.forward}s`, size: 40 });
  if (c.next) b.push({ k: 'next', ic: '⏭', label: t('next'), size: 40 });
  if (c.repeat) b.push({ k: 'repeat', ic: '⟳', label: t('repeat'), size: 30 });
  return b;
}

// ─────────────────────────── Streamer, wide ───────────────────────────
export function streamerWide(vm: VM): TemplateResult {
  const t = vm.t, sh = vm.show;
  const artOn = sh('art');
  const X = artOn ? 372 : 60, IW = artOn ? 480 : 792;
  let x = X;
  const btns = transport(vm).map((b) => {
    const el = html`<button type="button" class="tb ${b.size === 62 ? 'big' : ''} ${(b.k === 'shuffle' && vm.shuffle) || (b.k === 'repeat' && vm.repeat !== 'off') ? 'act' : ''}"
      style="${pos(x, 376 - b.size / 2, b.size, b.size)}" aria-label=${b.label} @click=${() => vm.key(b.k)}>${b.ic}</button>`;
    x += b.size + 22; return el;
  });
  const many = vm.outputs.length > 10;
  return html`
  <div class="panel" style="${pos(14, 14, 1172, 432)}border-radius:18px;${HERO}"></div>
  <div style="${pos(14, 14, 1172, 432)}border-radius:18px;pointer-events:none;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.03) 48%,transparent 56%)"></div>
  ${artOn ? html`<div style="${pos(40, 40, 300, 300)}border-radius:10px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.06)">${artBox(vm)}</div>
  <div class="s-lab" style="${pos(40, 356)}">${t('now_playing_on').toLocaleUpperCase('el')}</div>
  <div class="s-out" style="${pos(40, 372, 300)}">${vm.out ? vm.outName(vm.out) : '—'}</div>
  <div class="s-src" style="${pos(40, 394, 300)}">${vm.srcLine}</div>` : nothing}
  <div class="s-status" style="${pos(X, 44)}">${statusHTML(vm)}</div>
  ${sh('chips') ? html`<div style="${pos(X, 64, IW, 22)}display:flex;gap:6px">${vm.chips.map(([c, k]) => html`<span class="chip ${k}">${c}</span>`)}</div>` : nothing}
  <div class="s-title" style="${pos(X, 96, IW)}">${vm.title}</div>
  <div class="s-artist" style="${pos(X, 144, IW)}">${vm.artist}</div>
  <div class="s-album" style="${pos(X, 170, IW)}">${vm.album}</div>
  ${sh('seek') ? html`<div style="${pos(X, 198, IW, 16)}cursor:${vm.caps.seek ? 'pointer' : 'default'}" @click=${vm.seek}>
      <div style="${pos(0, 6, IW, 4)}border-radius:2px;background:rgba(128,128,128,.25)">
        <div data-k="pfill" data-w=${IW} style="${pos(0, 0, 0, 4)}border-radius:2px;background:var(--acc);box-shadow:0 0 8px var(--acc)"></div>
        ${vm.caps.seek ? html`<div data-k="pdot" data-w=${IW} style="${pos(-6, -4, 12, 12)}border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.6)"></div>` : nothing}
      </div></div>
    ${vm.fmtLine ? html`<div class="s-fmt" style="${pos(X + 60, 214, IW - 120)}">${vm.fmtLine}</div>` : nothing}
    <div class="s-time" data-k="el" style="${pos(X, 214)}">0:00</div><div class="s-time" data-k="rm" style="${pos(X + IW - 40, 214, 40)}text-align:right"></div>` : nothing}
  ${sh('spectrum') ? html`<canvas data-cv="spc" data-pal="s" width=${IW * 2} height="108" style="${pos(X, 236, IW, 54)}"></canvas>` : nothing}
  ${sh('meters') ? html`<div class="s-ch" style="${pos(X, 298)}">L</div><div class="s-ch" style="${pos(X, 308)}">R</div>
    <canvas data-cv="mtr" width=${(IW - 14) * 2} height="40" style="${pos(X + 14, 300, IW - 14, 20)}"></canvas>` : nothing}
  ${btns}
  ${vm.caps.stop ? html`<button type="button" class="tb pill" style="${pos(x + 6, 366, 70, 20)}" @click=${() => vm.key('stop')}>■ ${t('stop').toLocaleUpperCase('el')}</button>` : nothing}
  <div style="${pos(884, 40, 1, 380)}background:linear-gradient(180deg,transparent,rgba(128,128,128,.2),transparent)"></div>
  ${sh('volume') ? html`${knob('s', 1035, 140, 120, KNOB_DARK, 18, t('volume'))}
    <div class="s-vol" style="${pos(955, 230, 160)}">${t('volume').toLocaleUpperCase('el')} <b data-k="vv">—</b></div>` : nothing}
  ${sh('outputs') ? html`<div class="s-lab" style="${pos(912, 258)}">${t('play_on').toLocaleUpperCase('el')}</div>
    ${many ? outputSelect(vm, 's', pos(912, 276, 240, 30)) : vm.outputs.map((o, i) => html`<button type="button" class="ob ${i === vm.sel ? 'on' : ''} ${o.na ? 'na' : ''}" style="${pos(912 + (i % 2) * 124, 274 + Math.floor(i / 2) * 31, 116, 26)}" @click=${() => vm.pick(i)}><span class="od"></span>${vm.outName(o)}</button>`)}` : nothing}
  <div style="position:absolute;right:30px;top:20px;z-index:3">${themeToggle(vm, 'rgba(128,128,128,.14)')}</div>`;
}

// ─────────────────────────── VU Console, wide ───────────────────────────
export function consoleWide(vm: VM): TemplateResult {
  const t = vm.t, sh = vm.show;
  const len = vm.title.length;
  const tsize = len > 32 ? 14 : len > 26 ? 16 : len > 22 ? 19 : 22;
  const keys: [string, string, string][] = [];
  const c = vm.caps;
  if (c.prev) keys.push(['prev', '⏮', t('prev')]);
  if (c.seek) keys.push(['rew', '◀◀', `${vm.skip.back}s`]);
  if (c.play) keys.push(['play', '▶', t('play')]);
  if (c.pause) keys.push(['pause', '❚❚', t('pause')]);
  if (c.stop) keys.push(['stop', '■', t('stop')]);
  if (c.seek) keys.push(['ff', '▶▶', `${vm.skip.forward}s`]);
  if (c.next) keys.push(['next', '⏭', t('next')]);
  const kw = keys.length ? Math.min(114, (856 - (keys.length - 1) * 8) / keys.length) : 0;
  const sw: [string, string, boolean][] = [];
  if (c.shuffle) sw.push(['shuffle', t('shuffle'), vm.shuffle]);
  if (c.repeat) sw.push(['repeat', t('repeat'), vm.repeat !== 'off']);
  if (c.mute) sw.push(['mute', t('mute'), vm.muted]);
  if (sh('meters')) sw.push(['light', t('meter_light'), vm.light]);
  const n = vm.outputs.length, list = n <= 9;
  const step = n > 1 ? 120 / (n - 1) : 0;
  const selA = list ? -60 + vm.sel * step : 0;
  const on = (k: string) => (k === 'play' && vm.status === 'playing') || (k === 'pause' && vm.status === 'paused') || (k === 'stop' && vm.status === 'idle');
  const mode = vm.status === 'playing' ? `▶ ${t('play').toLocaleUpperCase('el')}` : vm.status === 'paused' ? `❚❚ ${t('pause').toLocaleUpperCase('el')}` : vm.status === 'unavailable' ? `— ${t('offline').toLocaleUpperCase('el')}` : `■ ${t('stop').toLocaleUpperCase('el')}`;
  const meters = sh('meters');
  const DX = meters ? 490 : 60, DW = meters ? 426 : 856;
  return html`
  <div style="${pos(0, 10, 34, 440)}border-radius:8px 0 0 8px;${WOOD}"></div>
  <div style="${pos(1166, 10, 34, 440)}border-radius:0 8px 8px 0;${WOOD}"></div>
  <div class="panel" style="${pos(34, 10, 1132, 440)}background:${BRUSH},linear-gradient(180deg,#2a2c30 0%,#18191c 60%,#111214 100%);box-shadow:inset 0 1px 0 rgba(255,250,240,.18),inset 0 -1px 0 rgba(0,0,0,.6),0 14px 30px rgba(0,0,0,.55)"></div>
  ${vm.brand ? html`<div class="c-brand" style="${pos(60, 26)}">${vm.brand}</div>` : nothing}
  ${vm.model ? html`<div class="c-lab" style="${pos(vm.themeSwitch ? 400 : 640, 29, 460)}text-align:${vm.themeSwitch ? 'right' : 'left'};font-size:10px;letter-spacing:.26em">${vm.model}</div>` : nothing}
  <div class="${vm.light ? '' : 'dim'}">${meters ? html`${vu(60, 56, 200, 160, 'L', t('left'))}${vu(274, 56, 200, 160, 'R', t('right'))}` : nothing}</div>
  <div style="${pos(DX, 56, DW, 160)}border-radius:6px;background:radial-gradient(ellipse at 50% 130%,#1a1006 0%,#050403 70%);overflow:hidden;${WELL}">
    <div class="vfd-s" style="${pos(16, 12, DW - 32)}">${mode} · ${(vm.out ? vm.outName(vm.out) : '—').toLocaleUpperCase('el')}</div>
    <div class="vfd" style="${pos(16, 32, DW - 32)}font-size:${tsize}px;letter-spacing:.1em">${vm.title.toLocaleUpperCase('el')}</div>
    <div class="vfd-s" style="${pos(16, 62, DW - 32)}font-size:12px">${vm.artist.toLocaleUpperCase('el')}</div>
    <div class="vfd" data-k="cel" style="${pos(16, 86)}font-size:34px">0:00</div>
    <div class="vfd-s" data-k="crm" style="${pos(150, 100)}font-family:${VFD};font-size:15px;letter-spacing:0"></div>
    <div class="vfd-s" style="${pos(DW - 236, 90, 220)}text-align:right;letter-spacing:.12em">${vm.fmtShort || vm.short}</div>
    ${sh('seek') ? html`<div style="${pos(16, 134, DW - 32, 2)}background:rgba(255,200,120,.15)"><div data-k="cfill" data-w=${DW - 32} style="${pos(0, 0, 0, 2)}background:var(--acc);box-shadow:0 0 6px var(--acc)"></div></div>` : nothing}
    ${GLASS}
  </div>
  ${sh('spectrum') ? html`<div style="${pos(60, 238, 856, 70)}border-radius:6px;background:#050506;overflow:hidden;${WELL}">
    <canvas data-cv="spc" data-pal="c" width="1664" height="100" style="${pos(12, 10, 832, 50)}"></canvas>${GLASS}</div>` : nothing}
  ${keys.map(([k, ic, l], i) => html`<button type="button" class="ck ${on(k) ? 'on' : ''}" style="${pos(60 + i * (kw + 8), 334, kw, 42)}" aria-label=${l} @click=${() => vm.key(k)}><span>${ic}</span><span>${l.toLocaleUpperCase('el')}</span></button>`)}
  ${sh('switches') ? sw.map(([k, l, v], i) => html`<button type="button" class="tg ${v ? 'on' : ''}" aria-pressed=${v} style="${pos(60 + i * 150, 396)}" @click=${() => vm.key(k)}><span class="sw"><i></i></span><span class="tl">${l.toLocaleUpperCase('el')}</span></button>`) : nothing}
  ${sh('outputs') ? (list ? html`
    <button type="button" aria-label=${t('next_output')} style="${pos(936, 96, 72, 72)}border-radius:50%;cursor:pointer;background:radial-gradient(circle at 45% 30%,#f6f7f8,#b8bcc2 60%,#7c8188);box-shadow:inset 0 2px 2px rgba(255,255,255,.8),0 4px 8px rgba(0,0,0,.6),0 0 0 1px #000" @click=${vm.nextOutput}>
      <div style="${pos(34, 5, 4, 12)}border-radius:2px;background:#2b2e33;transform-origin:2px 31px;transform:rotate(${selA}deg)"></div></button>
    ${vm.outputs.map((o, i) => html`<button type="button" class="cl ${i === vm.sel ? 'on' : ''} ${o.na ? 'na' : ''}" style="${pos(1030, 70 + i * (n > 1 ? 136 / (n - 1) : 0), 128)}" @click=${() => vm.pick(i)}><i class="cd"></i>${vm.outName(o).toLocaleUpperCase('el')}</button>`)}`
    : outputSelect(vm, 'c', pos(940, 110, 210, 30)))
    : nothing}
  ${sh('outputs') ? html`<div class="c-lab" style="${pos(912, 190, 120)}text-align:center;font-size:9px;letter-spacing:.3em">${t('output').toLocaleUpperCase('el')}</div>` : nothing}
  ${sh('volume') ? html`${knob('c', 1060, 330, 104, KNOB_ALU, 14, t('volume'))}
    <div class="c-lab" style="${pos(990, 408, 140)}text-align:center;font-size:9px;letter-spacing:.3em">${t('volume').toLocaleUpperCase('el')} <b data-k="vv" style="color:#ffe2b0">—</b></div>` : nothing}
  <div style="position:absolute;right:30px;top:20px;z-index:3">${themeToggle(vm, '#0b0b0c')}</div>`;
}

// ─────────────────────────── Helm, wide ───────────────────────────
const HC = { or: '#ff9c3a', pe: '#ffcc99', la: '#cc99ff', pu: '#9966cc', bl: '#99ccff', rd: '#ff5a4a', tn: '#d9a066', ye: '#ffdd55' };
export function helmWide(vm: VM): TemplateResult {
  const t = vm.t, sh = vm.show, c = vm.caps;
  const pill = (x: number, y: number, w: number, h: number, col: string, side: 'both' | 'left' | 'right' = 'both') =>
    `${pos(x, y, w, h)}background:${col};border-radius:${side === 'both' ? `${h / 2}px` : side === 'left' ? `${h / 2}px 0 0 ${h / 2}px` : `0 ${h / 2}px ${h / 2}px 0`};`;
  const len = vm.title.length, tsize = len > 30 ? 30 : len > 24 ? 38 : 48;
  const keys: [string, string, string, string][] = [];
  if (c.prev) keys.push(['prev', '⏮', t('prev'), HC.la]);
  if (c.seek) keys.push(['rew', '◀◀', `${vm.skip.back} S`, HC.bl]);
  if (c.play) keys.push(['play', '▶', t('play'), HC.or]);
  if (c.pause) keys.push(['pause', '❚❚', t('pause'), HC.pe]);
  if (c.stop) keys.push(['stop', '■', t('stop'), HC.rd]);
  if (c.seek) keys.push(['ff', '▶▶', `${vm.skip.forward} S`, HC.bl]);
  if (c.next) keys.push(['next', '⏭', t('next'), HC.la]);
  const kw = keys.length ? Math.min(106, (776 - (keys.length - 1) * 6) / keys.length) : 0;
  const on = (k: string) => (k === 'play' && vm.status === 'playing') || (k === 'pause' && vm.status === 'paused') || (k === 'stop' && vm.status === 'idle');
  const segs = 24;
  const blocks: [string, string, string][] = [
    [HC.or, t('output'), String(vm.sel + 1).padStart(2, '0')], [HC.pe, t('volume'), ''], [HC.la, 'KHZ', vm.fmtShort.split(' ')[1]?.split('/')[1] || '—'],
    [HC.bl, 'BIT', vm.fmtShort.split(' ')[1]?.split('/')[0] || '—'], [HC.tn, 'KBPS', (vm.fmtShort.split(' ')[2] || '').replace('K', '') || '—']];
  return html`
  <div class="hm" style="${pos(0, 0, 1200, 460)}background:#000"></div>
  <!-- top bar -->
  <div style="${pill(12, 12, 90, 36, HC.or, 'left')}"></div><div style="${pos(108, 12, 260, 36)}background:${HC.pe}"></div><div style="${pos(374, 12, 60, 36)}background:${HC.la}"></div>
  <div class="hm-title" style="${pos(446, 12, 400, 36)}">${(vm.brand || t('audio_console')).toLocaleUpperCase('el')}</div>
  <div style="${pos(860, 12, 90, 36)}background:${HC.bl}"></div><div style="${pos(956, 12, 90, 36)}background:${HC.la}"></div>
  <div style="${pos(1052, 12, 136, 36)}z-index:4">${vm.themeSwitch && vm.themes.length > 1 ? themeToggle(vm) : html`<div style="${pill(0, 0, 136, 36, HC.or, 'right')}"></div>`}</div>
  <!-- numbered side blocks -->
  ${blocks.map(([col, lab, val], i) => html`<div class="hm-blk" style="${pos(12, 58 + i * 52, 90, 46)}background:${col}"><small>${lab.toLocaleUpperCase('el')}</small>${i === 1 ? html`<b data-k="vv">—</b>` : val}</div>`)}
  <!-- display -->
  <div style="${pos(116, 58, 760, 300)}border:3px solid ${HC.pu};border-radius:28px 0 0 28px;border-right:none;box-sizing:border-box"></div>
  <div style="${pos(876, 58, 8, 300)}background:${HC.pu}"></div>
  <div class="hm-stat" style="${pos(146, 76, 520)}">${statusHTML(vm)}</div>
  <div class="hm-tt" style="${pos(146, 100, 540)}font-size:${tsize}px">${vm.title.toLocaleUpperCase('el')}</div>
  <div class="hm-ar" style="${pos(146, 152, 540)}">${[vm.artist, vm.album].filter(Boolean).join(' / ').toLocaleUpperCase('el')}</div>
  ${sh('quality') && vm.fmtLine ? html`<div class="hm-fmt" style="${pos(146, 182, 540)}">${vm.fmtLine.toLocaleUpperCase('el')}${vm.fmtBadges.map((b, i) => html`<span style="background:${[HC.ye, HC.la, HC.bl][i % 3]}">${b}</span>`)}</div>` : nothing}
  ${sh('seek') ? html`<div class="hm-clk" data-k="el" style="${pos(690, 92, 176)}">0:00</div>
    <div class="hm-rem" style="${pos(690, 166, 176)}">${t('remaining').toLocaleUpperCase('el')} <span data-k="rm"></span></div>` : nothing}
  ${sh('spectrum') ? html`<canvas data-cv="spc" data-pal="h" width="1400" height="192" style="${pos(146, 214, 700, 96)}"></canvas>` : nothing}
  ${sh('seek') ? html`<div style="${pos(146, 320, 700, 10)}cursor:${c.seek ? 'pointer' : 'default'}" @click=${vm.seek}><div style="${pos(0, 2, 700, 6)}background:#20140a;border-radius:3px">
    <div data-k="pfill" data-w="700" style="${pos(0, 0, 0, 6)}background:var(--acc);border-radius:3px"></div></div></div>` : nothing}
  <!-- right column -->
  ${sh('volume') ? html`<div class="hm-volp" style="${pill(898, 58, 290, 40, HC.or)}">${t('volume').toLocaleUpperCase('el')} <b data-k="vv">—</b></div>
    <div data-vk="h" role="slider" tabindex="0" aria-label=${t('volume')} aria-valuemin="0" aria-valuemax="100" class="hm-vseg" style="${pos(898, 108, 290, 26)}">
      ${Array.from({ length: segs }, (_, i) => html`<i data-vseg=${i} style="left:${i * (290 / segs)}px;width:${290 / segs - 3}px;background:${i >= segs - 3 ? HC.rd : HC.pe}"
        @click=${(e: Event) => { e.stopPropagation(); vm.setVol((i + 1) / segs); }}></i>`)}
    </div>` : nothing}
  ${sh('meters') ? html`<div class="hm-ch" style="${pos(898, 146)}">L</div><div class="hm-ch" style="${pos(898, 164)}">R</div>
    <canvas data-cv="mtr" width="548" height="40" style="${pos(914, 148, 274, 20)}"></canvas>` : nothing}
  ${sh('switches') ? html`${c.shuffle ? html`<div class="hm-lab" style="${pos(898, 192)}">${t('shuffle').toLocaleUpperCase('el')}</div>
      <button type="button" class="hm-pill ${vm.shuffle ? 'on' : ''}" aria-pressed=${vm.shuffle} style="${pos(990, 190, 56, 22)}" @click=${() => vm.key('shuffle')}>${vm.shuffle ? 'ON' : 'OFF'}</button>` : nothing}
    ${c.repeat ? html`<div class="hm-lab" style="${pos(1062, 192)}">${t('repeat').toLocaleUpperCase('el')}</div>
      <button type="button" class="hm-pill ${vm.repeat !== 'off' ? 'on' : ''}" style="${pos(1132, 190, 56, 22)}" @click=${() => vm.key('repeat')}>${vm.repeat.toLocaleUpperCase('el')}</button>` : nothing}` : nothing}
  ${sh('outputs') ? html`<div class="hm-lab or" style="${pos(898, 226)}">${t('play_on').toLocaleUpperCase('el')}</div>
    <div class="hm-outs" style="${pos(898, 250, 290, 108)}">${vm.outputs.map((o, i) => html`<button type="button" class="hm-out ${i === vm.sel ? 'on' : ''} ${o.na ? 'na' : ''}" @click=${() => vm.pick(i)}>${i === vm.sel ? '● ' : ''}${vm.outName(o).toLocaleUpperCase('el')}</button>`)}</div>` : nothing}
  <!-- bottom bar: transport -->
  <div style="${pill(12, 372, 90, 76, HC.la, 'left')}"></div>
  ${keys.map(([k, ic, l, col], i) => html`<button type="button" class="hm-key ${on(k) ? 'on' : ''}" aria-label=${l} style="${pos(108 + i * (kw + 6), 372, kw, 76)}background:${col}" @click=${() => vm.key(k)}><span>${ic}</span><span>${l.toLocaleUpperCase('el')}</span></button>`)}
  ${vm.hasLibrary ? html`<button type="button" class="hm-lib" style="${pill(898, 372, 290, 76, HC.pu, 'right')}" @click=${vm.toggleLibrary}>${t('library').toLocaleUpperCase('el')} ▾</button>`
    : html`<div style="${pill(898, 372, 290, 76, HC.pu, 'right')}"></div>`}`;
}

// ─────────────────────────── compact (all themes) ───────────────────────────
export function compact(vm: VM): TemplateResult {
  const t = vm.t, sh = vm.show, con = vm.theme === 'console', helm = vm.theme === 'helm';
  const btns = transport(vm);
  return html`<div class="cp ${con ? 'con' : helm ? 'helm' : 'str'}">
    <div class="cp-top">
      ${con ? (sh('meters') ? html`<div class="cp-vu ${vm.light ? '' : 'dim'}"><div class="cp-vuw">${vu(0, 0, 130, 100, 'L', t('left'))}</div><div class="cp-vuw">${vu(0, 0, 130, 100, 'R', t('right'))}</div></div>` : nothing)
        : helm ? html`<div class="cp-hblocks"><span style="background:#ff9c3a">${String(vm.sel + 1).padStart(2, '0')}</span><span style="background:#cc99ff"><b data-k="vv">—</b></span><span style="background:#99ccff">${vm.fmtShort.split(' ')[0] || '—'}</span></div>`
        : sh('art') ? html`<div class="cp-art">${artBox(vm)}</div>` : nothing}
      <div class="cp-info ${con ? 'cp-vfd' : ''}">
        <div class="cp-status">${statusHTML(vm)}</div>
        <div class="cp-title">${con || helm ? vm.title.toLocaleUpperCase('el') : vm.title}</div>
        <div class="cp-artist">${con ? vm.artist.toLocaleUpperCase('el') : vm.artist}</div>
        ${vm.fmtLine ? html`<div class="cp-fmt">${con ? vm.fmtShort : vm.fmtLine}</div>` : nothing}
        ${sh('chips') && !con ? html`<div class="cp-chips">${vm.chips.map(([c, k]) => html`<span class="chip ${k}">${c}</span>`)}</div>` : nothing}
        ${sh('seek') ? html`<div class="cp-seek" @click=${vm.seek}><div data-k="pfill" data-w="%" class="cp-fill"></div></div>
          <div class="cp-times"><span data-k="el">0:00</span><span data-k="rm"></span></div>` : nothing}
      </div>
    </div>
    ${sh('spectrum') ? html`<div class="cp-spc"><canvas data-cv="spc" data-pal=${con ? 'c' : helm ? 'h' : 's'} width="1200" height="80"></canvas></div>` : nothing}
    <div class="cp-bot">
      <div class="cp-tr">${btns.map((b) => html`<button type="button" class="tb ${b.size === 62 ? 'big' : ''} ${(b.k === 'shuffle' && vm.shuffle) || (b.k === 'repeat' && vm.repeat !== 'off') ? 'act' : ''}" aria-label=${b.label} @click=${() => vm.key(b.k)}>${b.ic}</button>`)}
        ${vm.caps.stop ? html`<button type="button" class="tb" aria-label=${t('stop')} @click=${() => vm.key('stop')}>■</button>` : nothing}
        ${vm.caps.mute ? html`<button type="button" class="tb ${vm.muted ? 'act' : ''}" aria-label=${t('mute')} @click=${() => vm.key('mute')}>${vm.muted ? '🔇' : '🔈'}</button>` : nothing}</div>
      <div class="cp-right">
        ${sh('outputs') ? outputSelect(vm, con ? 'c' : 's') : nothing}
        ${sh('volume') ? (helm ? html`<div data-vk="h" role="slider" tabindex="0" aria-label=${t('volume')} class="hm-vseg cp-hvseg">
            ${Array.from({ length: 16 }, (_, i) => html`<i data-vseg=${i} style="left:${i * 10}px;width:7px;background:${i >= 14 ? '#ff5a4a' : '#ffcc99'}" @click=${(e: Event) => { e.stopPropagation(); vm.setVol((i + 1) / 16); }}></i>`)}</div>`
          : html`<div class="cp-knob">${knob('k', 44, 44, 64, con ? KNOB_ALU : KNOB_DARK, 12, t('volume'))}</div>`) : nothing}
        ${sh('volume') ? html`<div class="cp-vv"><b data-k="vv">—</b></div>` : nothing}
        ${themeToggle(vm, con ? '#0b0b0c' : 'rgba(128,128,128,.14)')}
      </div>
    </div>
  </div>`;
}

// ─────────────────────────── mini (one row) ───────────────────────────
export function mini(vm: VM, open: () => void): TemplateResult {
  const t = vm.t, con = vm.theme === 'console', helm = vm.theme === 'helm';
  return html`<div class="mn ${con ? 'con' : helm ? 'helm' : 'str'}">
    <button type="button" class="mn-open" aria-label=${vm.title} @click=${open}>
      ${con ? html`<div class="mn-vu ${vm.light ? '' : 'dim'}">${vu(0, 0, 72, 52, 'L', t('left'))}</div>` : helm ? html`<span class="mn-cap"></span>` : html`<div class="mn-art">${artBox(vm)}</div>`}
      <span class="mn-txt"><span class="mn-title">${vm.title}</span><span class="mn-artist">${vm.artist || (vm.out ? vm.outName(vm.out) : '')}</span></span>
    </button>
    ${vm.caps.play || vm.caps.pause ? html`<button type="button" class="tb big" aria-label=${vm.status === 'playing' ? t('pause') : t('play')} @click=${() => vm.key('toggle')}>${vm.status === 'playing' ? '❚❚' : '▶'}</button>` : nothing}
    ${vm.caps.next ? html`<button type="button" class="tb" aria-label=${t('next')} @click=${() => vm.key('next')}>⏭</button>` : nothing}
    ${vm.show('volume') ? html`<button type="button" class="tb" aria-label="${t('volume')} −" @click=${() => vm.key('voldown')}>−</button><b class="mn-vv" data-k="vv">—</b><button type="button" class="tb" aria-label="${t('volume')} +" @click=${() => vm.key('volup')}>+</button>` : nothing}
  </div>`;
}

export const AM = AMBER;
export { MONO };
