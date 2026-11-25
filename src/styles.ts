import { css, unsafeCSS } from 'lit';
import { MONO, SH, SW, VFD } from './ui';

const mono = unsafeCSS(MONO), vfd = unsafeCSS(VFD);

export const cardStyles = css`
:host{display:block;--hf:Inter,Roboto,system-ui,sans-serif}
:host([fonts=system]){--hf:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
ha-card{overflow:hidden;background:transparent;border:none;box-shadow:none;font-family:var(--hf)}
ha-card.bg-card{background:var(--ha-card-background,var(--card-background-color));border-radius:var(--ha-card-border-radius,12px)}
.wrap{position:relative;width:100%;overflow:hidden}
.st{position:absolute;left:0;top:0;width:${SW}px;height:${SH}px;transform-origin:0 0;font-family:var(--hf);-webkit-tap-highlight-color:transparent}
button{font-family:var(--hf);border:none;padding:0;cursor:pointer;outline:none;color:inherit}
button:focus-visible,select:focus-visible,[role=slider]:focus-visible{box-shadow:0 0 0 2px #7dd3fc!important;outline:none}
.empty{padding:24px;text-align:center;color:var(--secondary-text-color)}

/* theme switch */
.tsw{display:flex;gap:2px;padding:3px;border-radius:16px;box-shadow:inset 0 1px 3px rgba(0,0,0,.7),0 1px 0 rgba(255,255,255,.08)}
.thb{border-radius:13px;padding:0 12px;height:26px;font:700 9px var(--hf);letter-spacing:.16em;background:transparent;color:#8b949e}
.thb.on{background:var(--acc);color:var(--acc-ink);box-shadow:0 0 10px color-mix(in srgb,var(--acc) 35%,transparent)}

/* ── Streamer ── */
.streamer .panel{background:linear-gradient(160deg,#17191c 0%,#0c0d0f 60%,#070809 100%)}
.bg-card .streamer .panel{background:var(--ha-card-background,var(--card-background-color))}
.bg-transparent .streamer .panel{background:transparent;box-shadow:none}
.s-lab{white-space:nowrap;font:700 9px var(--hf);letter-spacing:.22em;color:#6b737d}
.s-out{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:600 13px var(--hf);color:#e8edf2}
.s-src{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:500 11px var(--hf);color:#8b949e}
.s-status{white-space:nowrap;font:700 10px var(--hf);letter-spacing:.2em;color:#8b949e}
.s-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:700 36px var(--hf);letter-spacing:-.01em;color:#f4f6f8}
.s-artist{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:500 18px var(--hf);color:#c1c8cf}
.s-album{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:500 12px var(--hf);color:#6b737d}
.s-time{font:500 11px ${mono};color:#8b949e}
.s-ch{font:500 10px ${mono};color:#6b737d}
.s-vol{text-align:center;font:700 10px var(--hf);letter-spacing:.24em;color:#8b949e}.s-vol b{color:#f4f6f8}
.tb{border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 13px var(--hf);background:rgba(255,255,255,.06);color:#d6dbe0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.tb:hover{background:rgba(255,255,255,.12)}.tb.act{color:var(--acc);box-shadow:inset 0 0 0 1px var(--acc)}
.tb.big{font-size:22px;background:#f4f6f8;color:#0c0d0f;box-shadow:0 0 18px color-mix(in srgb,var(--acc) 35%,transparent),0 6px 14px rgba(0,0,0,.6)}
.tb.pill{border-radius:10px;font-size:9px;letter-spacing:.14em;background:transparent;color:#aab2bb;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.tb:active{transform:scale(.95)}
.ob{border-radius:8px;display:flex;align-items:center;gap:8px;padding:0 10px;font:600 11px var(--hf);text-align:left;white-space:nowrap;overflow:hidden;background:rgba(255,255,255,.04);color:#aab2bb;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
.ob .od{flex:none;width:6px;height:6px;border-radius:50%;background:#4a5058}
.ob.on{background:color-mix(in srgb,var(--acc) 12%,transparent);color:#fff;box-shadow:inset 0 0 0 1px var(--acc)}.ob.on .od{background:var(--acc);box-shadow:0 0 6px var(--acc)}
.ob.na,.cl.na{opacity:.4}
.chip{padding:3px 8px;border-radius:4px;border:1px solid #8b949e;color:#c9d1d9;font:700 9px var(--hf);letter-spacing:.12em;white-space:nowrap}
.chip.t{border-color:var(--acc);color:var(--acc)}.chip.a{border-color:#ffb347;color:#ffb347}
.osel{font:600 12px var(--hf);border-radius:8px;padding:0 10px;height:30px;appearance:auto;cursor:pointer}
.osel.s{background:#15171a;color:#e8edf2;border:1px solid rgba(255,255,255,.14)}
.osel.c{background:#0b0b0c;color:#ffd79a;border:1px solid #3a3022;font-family:${mono};letter-spacing:.06em}

/* Streamer light */
.light .streamer .panel{background:linear-gradient(160deg,#fbfcfd 0%,#eef1f4 60%,#e4e8ec 100%);box-shadow:0 1px 0 #fff inset,0 2px 4px rgba(0,0,0,.08),0 10px 24px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.08)}
.light .streamer .s-title,.light .streamer .s-out{color:#14171a}
.light .streamer .s-artist{color:#3b4249}.light .streamer .s-album,.light .streamer .s-lab,.light .streamer .s-ch{color:#7a838c}
.light .streamer .s-status,.light .streamer .s-src,.light .streamer .s-time,.light .streamer .s-vol{color:#5b646d}.light .streamer .s-vol b{color:#14171a}
.light .streamer .tb{background:rgba(0,0,0,.05);color:#2b3035;box-shadow:inset 0 0 0 1px rgba(0,0,0,.1)}
.light .streamer .tb.big{background:#14171a;color:#fff}
.light .streamer .tb.pill{color:#4b535b;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
.light .streamer .ob{background:rgba(0,0,0,.04);color:#3b4249;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
.light .streamer .ob.on{color:#062019}
.light .streamer .chip{color:#3b4249;border-color:#9aa3ab}
.light .streamer .osel.s{background:#fff;color:#14171a;border-color:rgba(0,0,0,.15)}

/* ── Console ── */
.c-brand{white-space:nowrap;font:800 14px var(--hf);letter-spacing:.44em;color:#e8e2d4}
.c-lab{white-space:nowrap;font-weight:700;font-family:var(--hf);color:#c9ccd1;text-shadow:0 1px 0 rgba(0,0,0,.8)}
.vfd{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:${vfd};color:#ffe2b0;text-shadow:0 0 3px var(--acc),0 0 10px color-mix(in srgb,var(--acc) 50%,transparent)}
.vfd-s{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:400 11px ${mono};letter-spacing:.2em;color:#c79a5a}
.vu .vul{position:absolute;inset:0;background:linear-gradient(160deg,rgba(255,255,255,.28) 0%,transparent 35%),radial-gradient(ellipse at 50% 120%,rgba(255,170,60,.25),transparent 60%);transition:opacity .3s}
.vu .vud{position:absolute;inset:0;background:rgba(0,0,0,.45);opacity:0;transition:opacity .3s}
.dim .vul{opacity:.15}.dim .vud{opacity:1}
.ck{border-radius:6px;display:flex;align-items:center;justify-content:center;gap:7px;font:700 10px var(--hf);letter-spacing:.14em;color:#2b2e33;background:linear-gradient(180deg,#f6f7f8 0%,#c6cad0 50%,#a3a8af 100%);box-shadow:inset 0 1px 0 #fff,0 2px 0 #4a4e55,0 4px 6px rgba(0,0,0,.5),0 8px 14px rgba(0,0,0,.3);transition:transform .08s;white-space:nowrap;overflow:hidden}
.ck.on,.ck:active{transform:translateY(2px);color:#5b3608;box-shadow:inset 0 2px 4px rgba(0,0,0,.35),inset 0 0 14px color-mix(in srgb,var(--acc) 30%,transparent),0 1px 0 #555}
.tg{display:flex;align-items:center;gap:8px;background:transparent}
.tg .sw{position:relative;width:26px;height:14px;border-radius:7px;background:#2a2c30;box-shadow:inset 0 1px 2px rgba(0,0,0,.6)}
.tg .sw i{position:absolute;left:2px;top:2px;width:10px;height:10px;border-radius:50%;background:linear-gradient(180deg,#fff,#c6cad0);transition:left .15s}
.tg.on .sw{background:var(--acc);box-shadow:inset 0 1px 2px rgba(0,0,0,.6),0 0 8px var(--acc)}.tg.on .sw i{left:14px}
.tg .tl{font:700 9px var(--hf);letter-spacing:.18em;color:#c9ccd1;text-shadow:0 1px 0 rgba(0,0,0,.8)}
.cl{display:flex;align-items:center;gap:7px;height:14px;background:transparent;font:700 9px var(--hf);letter-spacing:.08em;color:#8f939a;white-space:nowrap;overflow:hidden;text-align:left}
.cl .cd{flex:none;width:6px;height:6px;border-radius:50%;background:#2a2c30;box-shadow:inset 0 1px 1px #000}
.cl.on{color:var(--acc);text-shadow:0 0 6px var(--acc)}.cl.on .cd{background:var(--acc);box-shadow:0 0 6px var(--acc)}
.kpend .ki{background:#8b9096!important;box-shadow:none!important}
.kstep .ki{opacity:.35}

/* ── compact ── */
.cp{position:relative;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px}
.cp.str{background:linear-gradient(160deg,#17191c 0%,#0c0d0f 60%,#070809 100%);color:#f4f6f8}
.light .cp.str{background:linear-gradient(160deg,#fbfcfd,#e9edf0);color:#14171a}
.bg-card .cp.str{background:var(--ha-card-background,var(--card-background-color))}
.cp.con{background:linear-gradient(180deg,#2a2c30,#141517);border-left:14px solid #5a331b;border-right:14px solid #5a331b;color:#ffe2b0}
.cp-top{display:flex;gap:14px;align-items:stretch;min-width:0}
.cp-art{position:relative;flex:none;width:132px;height:132px;border-radius:8px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.5)}
.cp-vu{display:flex;gap:8px;flex:none}
.cp-vuw{position:relative;width:130px;height:100px}
.cp-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;justify-content:center}
.cp-vfd{border-radius:6px;padding:8px 12px;background:radial-gradient(ellipse at 50% 130%,#1a1006,#050403 70%);box-shadow:inset 0 4px 12px rgba(0,0,0,.9)}
.cp-status{font:700 9px var(--hf);letter-spacing:.18em;color:#8b949e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-title{font:700 22px var(--hf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-artist{font:500 14px var(--hf);opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-vfd .cp-title{font:400 18px ${vfd};color:#ffe2b0;text-shadow:0 0 3px var(--acc)}
.cp-vfd .cp-artist,.cp-vfd .cp-status{font:400 11px ${mono};letter-spacing:.16em;color:#c79a5a}
.cp-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.cp-seek{position:relative;height:14px;cursor:pointer;margin-top:4px}
.cp-seek::before{content:'';position:absolute;left:0;right:0;top:5px;height:4px;border-radius:2px;background:rgba(128,128,128,.25)}
.cp-fill{position:absolute;left:0;top:5px;height:4px;border-radius:2px;background:var(--acc);width:0}
.cp-times{display:flex;justify-content:space-between;font:500 11px ${mono};opacity:.6}
.cp-spc{height:40px;border-radius:6px;overflow:hidden;background:rgba(0,0,0,.35)}
.cp-spc canvas{width:100%;height:100%;display:block}
.cp-bot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.cp-tr{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.cp-tr .tb{width:40px;height:40px}.cp-tr .tb.big{width:52px;height:52px}
.light .cp.str .tb{background:rgba(0,0,0,.05);color:#2b3035}.light .cp.str .tb.big{background:#14171a;color:#fff}
.cp-right{display:flex;align-items:center;gap:10px}
.cp-knob{position:relative;width:88px;height:88px}
.cp-vv{font:700 12px ${mono};min-width:28px}
.cp-right{flex-wrap:wrap;justify-content:flex-end}

/* ── mini ── */
.mn{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:14px}
.mn.str{background:linear-gradient(160deg,#17191c,#0c0d0f);color:#f4f6f8}
.light .mn.str{background:#f2f4f6;color:#14171a}
.mn.con{background:linear-gradient(180deg,#2a2c30,#141517);color:#ffe2b0}
.mn-open{flex:1;min-width:0;display:flex;align-items:center;gap:10px;background:transparent;text-align:left}
.mn-art{position:relative;flex:none;width:44px;height:44px;border-radius:6px;overflow:hidden}
.mn-vu{position:relative;flex:none;width:72px;height:52px}
.mn-txt{min-width:0;display:flex;flex-direction:column}
.mn-title{font:700 14px var(--hf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mn-artist{font:500 12px var(--hf);opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mn .tb{flex:none;width:34px;height:34px}.mn .tb.big{width:40px;height:40px;font-size:16px}
.mn-vv{font:700 11px ${mono};min-width:22px;text-align:center}
.dlg{position:fixed;inset:0;z-index:20;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:12px}
.dlg-in{width:min(760px,100%);position:relative}
.dlg-x{position:absolute;right:-6px;top:-6px;z-index:2;width:32px;height:32px;border-radius:50%;background:#222;color:#fff;font-size:16px}

@media (prefers-reduced-motion: reduce){.tg .sw i,.ck{transition:none}}
`;
