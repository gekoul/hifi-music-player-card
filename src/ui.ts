import { html, svg, nothing, type TemplateResult } from 'lit';

export const SW = 1200;
export const SH = 460;
export const FONT = "Inter,Roboto,system-ui,sans-serif";
export const SYS_FONT = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
export const MONO = "'Share Tech Mono',ui-monospace,Menlo,monospace";
export const VFD = "'DotGothic16','Share Tech Mono',ui-monospace,monospace";
export const TEAL = '#3ee6c4';
export const AMBER = '#ffb347';

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const fmt = (s: number) => { s = Math.max(0, Math.floor(s || 0)); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); };
export const pos = (x: number, y: number, w?: number, h?: number) =>
  `position:absolute;left:${x}px;top:${y}px;${w !== undefined ? `width:${w}px;` : ''}${h !== undefined ? `height:${h}px;` : ''}`;

export const LS = {
  get(k: string, d: string | null = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* blocked */ } },
};

/** Fixes Greek text stored as cp1253 bytes read as latin-1 ("ÁãÜðç" → "Αγάπη"). */
export function fixText(v: unknown): string {
  let s = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (/[À-ÿ]{2}/.test(s) && !/[Ͱ-Ͽ]/.test(s) && ![...s].some((c) => c.charCodeAt(0) > 255)) {
    try {
      const t = new TextDecoder('windows-1253').decode(Uint8Array.from([...s].map((c) => c.charCodeAt(0))));
      if (/[Ͱ-Ͽ]{2}/.test(t)) s = t;
    } catch { /* keep original */ }
  }
  return s;
}

/** Rotary knob with an optional 27-dot LED ring. Painting (angle, ring) is done by the card. */
export function knob(id: string, cx: number, cy: number, d: number, face: string, ring: number, label: string): TemplateResult {
  const r = d / 2;
  const R = r + ring;
  const dots = ring ? Array.from({ length: 27 }, (_, i) => {
    const a = (-135 + i * 270 / 26) * Math.PI / 180;
    return svg`<circle data-rl=${i} cx=${(R * Math.sin(a)).toFixed(1)} cy=${(-R * Math.cos(a)).toFixed(1)} r="2.2" fill="rgba(255,255,255,.08)"></circle>`;
  }) : [];
  return html`${ring ? html`<svg aria-hidden="true" data-ring=${id} style="${pos(cx - R - 4, cy - R - 4)}overflow:visible;pointer-events:none" width=${2 * R + 8} height=${2 * R + 8} viewBox="${-R - 4} ${-R - 4} ${2 * R + 8} ${2 * R + 8}">${dots}</svg>` : nothing}
  <div data-vk=${id} role="slider" tabindex="0" aria-label=${label} aria-valuemin="0" aria-valuemax="100"
    style="${pos(cx - r, cy - r, d, d)}border-radius:50%;cursor:ns-resize;touch-action:none;${face}">
    <div class="ki" style="${pos(r - 2, d * 0.07, 4, d * 0.16)}border-radius:2px;background:#f4f6f8;box-shadow:0 0 4px rgba(255,255,255,.4);transform-origin:2px ${r - d * 0.07}px"></div>
  </div>`;
}

/** Needle VU meter face. The needle (data-ndl) is rotated from -48° to +42° by the card. */
export function vu(x: number, y: number, w: number, h: number, ch: 'L' | 'R', label: string): TemplateResult {
  const R = Math.min(h + 6, (w / 2 - 16) / Math.sin(48 * Math.PI / 180));
  const cx = w / 2, cy = R < h + 6 ? R + 38 * (h / 160) : h + 40;
  const small = h < 120;
  const marks: [number, number][] = [[-20, -48], [-10, -32], [-7, -22], [-5, -14], [-3, -4], [-2, 2], [-1, 8], [0, 16], [1, 24], [2, 32], [3, 42]];
  const P = (r: number, a: number) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)];
  const arc = (r: number, a0: number, a1: number, col: string, sw: number) => {
    const [x0, y0] = P(r, a0), [x1, y1] = P(r, a1);
    return svg`<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke=${col} stroke-width=${sw}></path>`;
  };
  const ticks = marks.map(([v, a]) => {
    const col = v > 0 ? '#b3261e' : '#2a2622';
    const [x1, y1] = P(R - 14, a), [x2, y2] = P(R, a), [tx, ty] = P(R + 12, a);
    return svg`<line x1=${x1.toFixed(1)} y1=${y1.toFixed(1)} x2=${x2.toFixed(1)} y2=${y2.toFixed(1)} stroke=${col} stroke-width=${[-20, -10, 0, 3].includes(v) ? 2 : 1.3}></line>
      ${small && ![-20, -10, 0, 3].includes(v) ? nothing : svg`<text x=${tx.toFixed(1)} y=${(ty + 4).toFixed(1)} text-anchor="middle" font-family="Inter,sans-serif" font-size=${small ? 9 : 11} font-weight="600" fill=${col}>${Math.abs(v)}</text>`}`;
  });
  const gid = `vf${ch}${w}`;
  return html`<div class="vu" style="${pos(x, y, w, h)}border-radius:6px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(0,0,0,.5),0 0 0 3px #0b0b0c,0 0 0 4px rgba(255,255,255,.08),0 0 24px rgba(255,190,90,.18)">
    <svg aria-hidden="true" width=${w} height=${h} viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0">
      <defs><radialGradient id=${gid} cx=".5" cy=".85" r=".9"><stop offset="0" stop-color="#fff3d6"></stop><stop offset=".6" stop-color="#f3dfb0"></stop><stop offset="1" stop-color="#cfb27a"></stop></radialGradient></defs>
      <rect width=${w} height=${h} fill="url(#${gid})"></rect>
      ${arc(R - 7, -48, 16, '#2a2622', 1.4)}${arc(R - 7, 16, 42, '#b3261e', 5)}${ticks}
      <text x=${cx} y=${h - (small ? 30 : 54)} text-anchor="middle" font-family="Inter,sans-serif" font-size=${small ? 14 : 20} font-weight="800" fill="#2a2622" letter-spacing="2">VU</text>
      ${small ? nothing : svg`<text x=${cx} y=${h - 34} text-anchor="middle" font-family="Inter,sans-serif" font-size="9" font-weight="700" fill="#5a4c34" letter-spacing="3">${label.toUpperCase()}</text>`}
      <line data-ndl=${ch} x1=${cx} y1=${cy} x2=${cx} y2=${cy - R - 2} stroke="#121212" stroke-width="1.8" transform="rotate(-48 ${cx} ${cy})"></line>
      <circle cx=${cx} cy=${Math.min(cy, h + 4)} r=${R < h + 6 ? 16 * (h / 160) : 20} fill="#1a1612"></circle>
    </svg>
    <span class="vul" aria-hidden="true"></span><span class="vud" aria-hidden="true"></span>
  </div>`;
}

export const BRUSH = 'repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0,rgba(255,255,255,.05) 1px,rgba(0,0,0,.035) 1px,rgba(0,0,0,.035) 2px,transparent 2px,transparent 3px)';
export const HERO = 'box-shadow:inset 0 1px 0 rgba(255,250,240,.55),inset 0 -1px 0 rgba(0,0,0,.45),0 2px 4px rgba(0,0,0,.45),0 6px 12px rgba(0,0,0,.35),0 14px 28px rgba(0,0,0,.3),0 0 0 1px rgba(0,0,0,.6);';
export const WELL = 'box-shadow:inset 0 1px 0 rgba(255,250,240,.22),inset 0 10px 24px rgba(0,0,0,.95),inset 0 4px 10px rgba(0,0,0,.85),inset 0 -8px 20px rgba(0,0,0,.8),inset 4px 0 10px rgba(0,0,0,.6),inset -4px 0 10px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.95),0 1px 0 rgba(255,250,240,.45);';
export const GLASS = html`<span aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 120% 50% at 50% -10%,rgba(255,250,240,.08) 0%,transparent 55%),linear-gradient(125deg,transparent 32%,rgba(255,250,240,.035) 38%,rgba(255,250,240,.06) 43%,transparent 50%)"></span>`;
export const WOOD = 'background:repeating-linear-gradient(92deg,rgba(0,0,0,.12) 0,rgba(0,0,0,.12) 2px,transparent 2px,transparent 7px),linear-gradient(90deg,#4a2a16,#6e4024 50%,#3f2312);box-shadow:inset 0 1px 0 rgba(255,220,180,.25),0 6px 14px rgba(0,0,0,.5)';
export const KNOB_DARK = 'background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.05) 0deg 1deg,rgba(0,0,0,.12) 1deg 2deg),radial-gradient(circle at 45% 30%,#3b3f45,#131518 70%);box-shadow:0 8px 20px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.14),0 0 0 1px #000';
export const KNOB_ALU = 'background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.07) 0deg 1deg,rgba(0,0,0,.06) 1deg 2deg),radial-gradient(circle at 40% 30%,#f6f7f8 0%,#c6cad0 50%,#7c8188 100%);box-shadow:inset 0 2px 2px rgba(255,255,255,.8),0 4px 8px rgba(0,0,0,.6),0 10px 18px rgba(0,0,0,.35),0 0 0 1px #000';
