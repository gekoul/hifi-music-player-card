import { html, nothing, type TemplateResult } from 'lit';
import type { Caps } from './features';
import type { Localize } from './localize';
import type { Output } from './types';
import { AMBER, BRUSH, GLASS, HERO, KNOB_ALU, KNOB_DARK, MONO, VFD, WELL, WOOD, knob, pos, vu } from './ui';

export type Status = 'playing' | 'paused' | 'idle' | 'unavailable';

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
  caps: Caps;
  shuffle: boolean;
  repeat: string;
  muted: boolean;
  light: boolean;
  brand: string;
  model: string;
  show: (k: string) => boolean;
  themeSwitch: boolean;
  theme: 'streamer' | 'console';
  skip: { back: number; forward: number };
  srcLine: string;
  key: (k: string) => void;
  pick: (i: number) => void;
  setTheme: (t: 'streamer' | 'console') => void;
  seek: (e: MouseEvent) => void;
  nextOutput: () => void;
  outName: (o: Output) => string;
}

const statusHTML = (vm: VM) => {
  const s = vm.status, t = vm.t;
  const lab = s === 'playing' ? html`<span style="color:var(--acc)">● ${t('playing').toUpperCase()}</span>`
    : s === 'paused' ? html`<span style="color:#ffd166">❚❚ ${t('paused').toUpperCase()}</span>`
      : s === 'unavailable' ? html`<span style="color:#ff6b6b">● ${t('offline').toUpperCase()}</span>`
        : html`■ ${t('stopped').toUpperCase()}`;
  return html`${lab}&nbsp;&nbsp;·&nbsp;&nbsp;${(vm.out ? vm.outName(vm.out) : '—').toUpperCase()}`;
};

const themeToggle = (vm: VM, dark: string) => vm.themeSwitch ? html`<div class="tsw" role="group" aria-label=${vm.t('theme')} style="background:${dark}">
  ${(['streamer', 'console'] as const).map((th) => html`<button type="button" class="thb ${vm.theme === th ? 'on' : ''}" aria-pressed=${vm.theme === th} @click=${() => vm.setTheme(th)}>${vm.t(th).toUpperCase()}</button>`)}
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
  <div class="s-lab" style="${pos(40, 356)}">${t('now_playing_on').toUpperCase()}</div>
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
    <div class="s-time" data-k="el" style="${pos(X, 214)}">0:00</div><div class="s-time" data-k="rm" style="${pos(X + IW - 40, 214, 40)}text-align:right"></div>` : nothing}
  ${sh('spectrum') ? html`<canvas data-cv="spc" data-pal="s" width=${IW * 2} height="108" style="${pos(X, 236, IW, 54)}"></canvas>` : nothing}
  ${sh('meters') ? html`<div class="s-ch" style="${pos(X, 298)}">L</div><div class="s-ch" style="${pos(X, 308)}">R</div>
    <canvas data-cv="mtr" width=${(IW - 14) * 2} height="40" style="${pos(X + 14, 300, IW - 14, 20)}"></canvas>` : nothing}
  ${btns}
  ${vm.caps.stop ? html`<button type="button" class="tb pill" style="${pos(x + 6, 366, 70, 20)}" @click=${() => vm.key('stop')}>■ ${t('stop').toUpperCase()}</button>` : nothing}
  <div style="${pos(884, 40, 1, 380)}background:linear-gradient(180deg,transparent,rgba(128,128,128,.2),transparent)"></div>
  ${sh('volume') ? html`${knob('s', 1035, 140, 120, KNOB_DARK, 18, t('volume'))}
    <div class="s-vol" style="${pos(955, 230, 160)}">${t('volume').toUpperCase()} <b data-k="vv">—</b></div>` : nothing}
  ${sh('outputs') ? html`<div class="s-lab" style="${pos(912, 258)}">${t('play_on').toUpperCase()}</div>
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
  const mode = vm.status === 'playing' ? `▶ ${t('play').toUpperCase()}` : vm.status === 'paused' ? `❚❚ ${t('pause').toUpperCase()}` : vm.status === 'unavailable' ? `— ${t('offline').toUpperCase()}` : `■ ${t('stop').toUpperCase()}`;
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
    <div class="vfd-s" style="${pos(16, 12, DW - 32)}">${mode} · ${(vm.out ? vm.outName(vm.out) : '—').toUpperCase()}</div>
    <div class="vfd" style="${pos(16, 32, DW - 32)}font-size:${tsize}px;letter-spacing:.1em">${vm.title.toUpperCase()}</div>
    <div class="vfd-s" style="${pos(16, 62, DW - 32)}font-size:12px">${vm.artist.toUpperCase()}</div>
    <div class="vfd" data-k="cel" style="${pos(16, 86)}font-size:34px">0:00</div>
    <div class="vfd-s" data-k="crm" style="${pos(150, 100)}font-family:${VFD};font-size:15px;letter-spacing:0"></div>
    <div class="vfd-s" style="${pos(DW - 100, 90, 84)}text-align:right;letter-spacing:.14em">${vm.short}</div>
    ${sh('seek') ? html`<div style="${pos(16, 134, DW - 32, 2)}background:rgba(255,200,120,.15)"><div data-k="cfill" data-w=${DW - 32} style="${pos(0, 0, 0, 2)}background:var(--acc);box-shadow:0 0 6px var(--acc)"></div></div>` : nothing}
    ${GLASS}
  </div>
  ${sh('spectrum') ? html`<div style="${pos(60, 238, 856, 70)}border-radius:6px;background:#050506;overflow:hidden;${WELL}">
    <canvas data-cv="spc" data-pal="c" width="1664" height="100" style="${pos(12, 10, 832, 50)}"></canvas>${GLASS}</div>` : nothing}
  ${keys.map(([k, ic, l], i) => html`<button type="button" class="ck ${on(k) ? 'on' : ''}" style="${pos(60 + i * (kw + 8), 334, kw, 42)}" aria-label=${l} @click=${() => vm.key(k)}><span>${ic}</span><span>${l.toUpperCase()}</span></button>`)}
  ${sh('switches') ? sw.map(([k, l, v], i) => html`<button type="button" class="tg ${v ? 'on' : ''}" aria-pressed=${v} style="${pos(60 + i * 150, 396)}" @click=${() => vm.key(k)}><span class="sw"><i></i></span><span class="tl">${l.toUpperCase()}</span></button>`) : nothing}
  ${sh('outputs') ? (list ? html`
    <button type="button" aria-label=${t('next_output')} style="${pos(936, 96, 72, 72)}border-radius:50%;cursor:pointer;background:radial-gradient(circle at 45% 30%,#f6f7f8,#b8bcc2 60%,#7c8188);box-shadow:inset 0 2px 2px rgba(255,255,255,.8),0 4px 8px rgba(0,0,0,.6),0 0 0 1px #000" @click=${vm.nextOutput}>
      <div style="${pos(34, 5, 4, 12)}border-radius:2px;background:#2b2e33;transform-origin:2px 31px;transform:rotate(${selA}deg)"></div></button>
    ${vm.outputs.map((o, i) => html`<button type="button" class="cl ${i === vm.sel ? 'on' : ''} ${o.na ? 'na' : ''}" style="${pos(1030, 70 + i * (n > 1 ? 136 / (n - 1) : 0), 128)}" @click=${() => vm.pick(i)}><i class="cd"></i>${vm.outName(o).toUpperCase()}</button>`)}`
    : outputSelect(vm, 'c', pos(940, 110, 210, 30)))
    : nothing}
  ${sh('outputs') ? html`<div class="c-lab" style="${pos(912, 190, 120)}text-align:center;font-size:9px;letter-spacing:.3em">${t('output').toUpperCase()}</div>` : nothing}
  ${sh('volume') ? html`${knob('c', 1060, 330, 104, KNOB_ALU, 14, t('volume'))}
    <div class="c-lab" style="${pos(990, 408, 140)}text-align:center;font-size:9px;letter-spacing:.3em">${t('volume').toUpperCase()} <b data-k="vv" style="color:#ffe2b0">—</b></div>` : nothing}
  <div style="position:absolute;right:30px;top:20px;z-index:3">${themeToggle(vm, '#0b0b0c')}</div>`;
}

// ─────────────────────────── compact (both themes) ───────────────────────────
export function compact(vm: VM): TemplateResult {
  const t = vm.t, sh = vm.show, con = vm.theme === 'console';
  const btns = transport(vm);
  return html`<div class="cp ${con ? 'con' : 'str'}">
    <div class="cp-top">
      ${con ? (sh('meters') ? html`<div class="cp-vu ${vm.light ? '' : 'dim'}"><div class="cp-vuw">${vu(0, 0, 130, 100, 'L', t('left'))}</div><div class="cp-vuw">${vu(0, 0, 130, 100, 'R', t('right'))}</div></div>` : nothing)
        : sh('art') ? html`<div class="cp-art">${artBox(vm)}</div>` : nothing}
      <div class="cp-info ${con ? 'cp-vfd' : ''}">
        <div class="cp-status">${statusHTML(vm)}</div>
        <div class="cp-title">${con ? vm.title.toUpperCase() : vm.title}</div>
        <div class="cp-artist">${con ? vm.artist.toUpperCase() : vm.artist}</div>
        ${sh('chips') && !con ? html`<div class="cp-chips">${vm.chips.map(([c, k]) => html`<span class="chip ${k}">${c}</span>`)}</div>` : nothing}
        ${sh('seek') ? html`<div class="cp-seek" @click=${vm.seek}><div data-k="pfill" data-w="%" class="cp-fill"></div></div>
          <div class="cp-times"><span data-k="el">0:00</span><span data-k="rm"></span></div>` : nothing}
      </div>
    </div>
    ${sh('spectrum') ? html`<div class="cp-spc"><canvas data-cv="spc" data-pal=${con ? 'c' : 's'} width="1200" height="80"></canvas></div>` : nothing}
    <div class="cp-bot">
      <div class="cp-tr">${btns.map((b) => html`<button type="button" class="tb ${b.size === 62 ? 'big' : ''} ${(b.k === 'shuffle' && vm.shuffle) || (b.k === 'repeat' && vm.repeat !== 'off') ? 'act' : ''}" aria-label=${b.label} @click=${() => vm.key(b.k)}>${b.ic}</button>`)}
        ${vm.caps.stop ? html`<button type="button" class="tb" aria-label=${t('stop')} @click=${() => vm.key('stop')}>■</button>` : nothing}
        ${vm.caps.mute ? html`<button type="button" class="tb ${vm.muted ? 'act' : ''}" aria-label=${t('mute')} @click=${() => vm.key('mute')}>${vm.muted ? '🔇' : '🔈'}</button>` : nothing}</div>
      <div class="cp-right">
        ${sh('outputs') ? outputSelect(vm, con ? 'c' : 's') : nothing}
        ${sh('volume') ? html`<div class="cp-knob">${knob('k', 44, 44, 64, con ? KNOB_ALU : KNOB_DARK, 12, t('volume'))}</div><div class="cp-vv"><b data-k="vv">—</b></div>` : nothing}
        ${themeToggle(vm, con ? '#0b0b0c' : 'rgba(128,128,128,.14)')}
      </div>
    </div>
  </div>`;
}

// ─────────────────────────── mini (one row) ───────────────────────────
export function mini(vm: VM, open: () => void): TemplateResult {
  const t = vm.t, con = vm.theme === 'console';
  return html`<div class="mn ${con ? 'con' : 'str'}">
    <button type="button" class="mn-open" aria-label=${vm.title} @click=${open}>
      ${con ? html`<div class="mn-vu ${vm.light ? '' : 'dim'}">${vu(0, 0, 72, 52, 'L', t('left'))}</div>` : html`<div class="mn-art">${artBox(vm)}</div>`}
      <span class="mn-txt"><span class="mn-title">${vm.title}</span><span class="mn-artist">${vm.artist || (vm.out ? vm.outName(vm.out) : '')}</span></span>
    </button>
    ${vm.caps.play || vm.caps.pause ? html`<button type="button" class="tb big" aria-label=${vm.status === 'playing' ? t('pause') : t('play')} @click=${() => vm.key('toggle')}>${vm.status === 'playing' ? '❚❚' : '▶'}</button>` : nothing}
    ${vm.caps.next ? html`<button type="button" class="tb" aria-label=${t('next')} @click=${() => vm.key('next')}>⏭</button>` : nothing}
    ${vm.show('volume') ? html`<button type="button" class="tb" aria-label="${t('volume')} −" @click=${() => vm.key('voldown')}>−</button><b class="mn-vv" data-k="vv">—</b><button type="button" class="tb" aria-label="${t('volume')} +" @click=${() => vm.key('volup')}>+</button>` : nothing}
  </div>`;
}

export const AM = AMBER;
export { MONO };
