// Plays audio in this browser tab, with real level analysis through Web Audio.
// Two elements: one connected to an analyser (same-origin / CORS-enabled streams),
// one plain (cross-origin streams that would play silent through Web Audio).

import type { AudioFormat } from './quality';

export interface Track {
  fmt?: AudioFormat;
  url: string;
  id?: string;          // the library item it came from (to show what is playing)
  title?: string;
  artist?: string;
  album?: string;
  art?: string;
  dur?: number;
  cross?: boolean;
}

export interface Levels { l: number; r: number; spec: number[] }

const isCross = (u: string) => { try { return new URL(u, location.href).origin !== location.origin; } catch { return true; } };
const VOL_KEY = 'hifi_mpc_browser_vol';
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } };

class WebPlayerImpl {
  private audio: HTMLAudioElement | null = null;
  private audioX: HTMLAudioElement | null = null;
  private active: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private an: { L: AnalyserNode; R: AnalyserNode; S: AnalyserNode; tl: Float32Array<ArrayBuffer>; tr: Float32Array<ArrayBuffer>; f: Uint8Array<ArrayBuffer> } | null = null;
  private noGraph = false;
  private zero = 0;
  private stopped = false;
  queue: Track[] = [];
  idx = -1;
  gen = 0;
  readonly subs = new Set<() => void>();

  constructor() {
    setInterval(() => {
      if (!this.active || this.active.paused) return;
      this.checkSilence();
      this.emit();
    }, 1000);
  }

  private mk() {
    const a = new Audio();
    a.preload = 'auto';
    const v = lsGet(VOL_KEY);
    if (v !== null) a.volume = Math.min(1, Math.max(0, +v));
    a.addEventListener('ended', () => { if (a === this.active) this.next(true); });
    ['play', 'pause', 'loadedmetadata', 'volumechange', 'emptied', 'seeked', 'error'].forEach((ev) => a.addEventListener(ev, () => { if (a === this.active) this.emit(); }));
    return a;
  }
  private el() { if (!this.audio) this.audio = this.mk(); return this.audio; }
  private elX() { if (!this.audioX) this.audioX = this.mk(); return this.audioX; }
  media() { return this.active || this.el(); }

  private graph() {
    if (this.noGraph) return;
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const C = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new C();
      const src = ctx.createMediaElementSource(this.el());
      const split = ctx.createChannelSplitter(2);
      const mk = (n: number) => { const x = ctx.createAnalyser(); x.fftSize = n; x.smoothingTimeConstant = 0.6; return x; };
      const L = mk(1024), R = mk(1024), S = mk(4096);
      src.connect(ctx.destination); src.connect(S); src.connect(split); split.connect(L, 0); split.connect(R, 1);
      this.ctx = ctx;
      this.an = { L, R, S, tl: new Float32Array(1024), tr: new Float32Array(1024), f: new Uint8Array(S.frequencyBinCount) };
    } catch { this.ctx = null; this.an = null; }
  }

  load(list: Track[], start = 0) {
    this.queue = list.filter((t) => t && t.url).map((t) => ({ ...t, cross: t.cross ?? isCross(t.url) }));
    this.idx = Math.max(0, start) - 1;
    this.gen++;
    this.next();
    return this.gen;
  }
  append(gen: number, t: Track) {
    if (gen !== this.gen || !t?.url) return;
    this.queue.push({ ...t, cross: t.cross ?? isCross(t.url) });
    if (this.idx >= this.queue.length - 1 && this.media().ended) this.next();
  }
  next(auto = false) {
    if (this.idx + 1 >= this.queue.length) { if (auto) this.idx = this.queue.length; this.emit(); return; }
    this.idx++;
    const t = this.queue[this.idx];
    const a = t.cross || this.noGraph ? this.elX() : this.el();
    if (this.active && this.active !== a) this.active.pause();
    this.active = a; this.stopped = false; this.zero = 0;
    if (a === this.audio) this.graph();
    a.src = t.url;
    a.play().catch(() => this.emit());
    this.emit();
  }
  prev() {
    const a = this.media();
    if (a.currentTime > 3 || this.idx <= 0) { try { a.currentTime = 0; } catch { /* live */ } return; }
    this.idx -= 2; this.next();
  }
  cur(): Track | undefined { return this.queue[this.idx]; }

  cmd(k: string, arg?: number) {
    const a = this.media();
    if (k === 'play') { const c = this.cur(); if (c) { if (a === this.audio) this.graph(); if (this.stopped && c.cross) a.src = c.url; a.play().catch(() => {}); } }
    else if (k === 'pause') a.pause();
    else if (k === 'stop') { a.pause(); try { if (this.cur()?.cross) { a.removeAttribute('src'); a.load(); } else a.currentTime = 0; } catch { /* not seekable */ } this.stopped = true; this.emit(); return; }
    else if (k === 'next') this.next();
    else if (k === 'prev') this.prev();
    else if (k === 'seek' && arg !== undefined) { try { a.currentTime = Math.max(0, arg); } catch { /* live */ } }
    else if (k === 'mute') { a.muted = !a.muted; this.emit(); return; }
    if (['play', 'next', 'prev', 'seek'].includes(k)) this.stopped = false;
  }
  setVol(v: number) {
    [this.audio, this.audioX].forEach((x) => { if (x) x.volume = v; });
    if (!this.audio) this.el().volume = v;
    lsSet(VOL_KEY, String(v));
    this.emit();
  }

  state(): { state: string; attributes: Record<string, any> } {
    const a = this.active, t = this.cur();
    const sv = lsGet(VOL_KEY);
    const vol = a ? a.volume : sv === null ? 1 : +sv;
    if (!a || !t) return { state: 'idle', attributes: { volume_level: vol } };
    const live = !Number.isFinite(a.duration);
    return {
      state: this.stopped || a.ended ? 'idle' : a.paused ? 'paused' : 'playing',
      attributes: {
        media_title: t.title, media_artist: t.artist, media_content_id: t.id || t.url, hifi_format: t.fmt, media_album_name: t.album, entity_picture: t.art,
        media_duration: live ? (t.cross ? 0 : t.dur) : a.duration,
        media_position: a.currentTime, media_position_updated_at: new Date().toISOString(),
        volume_level: vol, is_volume_muted: a.muted,
      },
    };
  }

  /** Real levels while the analysed element plays; null otherwise. */
  levels(B: number): Levels | null {
    const an = this.an;
    if (!an || !this.ctx || !this.audio || this.active !== this.audio || this.audio.paused) return null;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const rms = (x: AnalyserNode, buf: Float32Array<ArrayBuffer>) => { x.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); };
    const lvl = (r: number) => Math.min(1, Math.max(0, (20 * Math.log10(r + 1e-9) + 43) / 50));
    an.S.getByteFrequencyData(an.f);
    const ny = this.ctx.sampleRate / 2, N = an.f.length, spec = new Array<number>(B);
    for (let b = 0; b < B; b++) {
      const f0 = 31 * Math.pow(16000 / 31, b / B), f1 = 31 * Math.pow(16000 / 31, (b + 1) / B);
      const i0 = Math.floor(f0 / ny * N), i1 = Math.max(i0 + 1, Math.ceil(f1 / ny * N));
      let mx = 0;
      for (let i = i0; i < i1 && i < N; i++) mx = Math.max(mx, an.f[i]);
      spec[b] = Math.pow(mx / 255, 1.4);
    }
    const l = rms(an.L, an.tl), r = rms(an.R, an.tr);
    return { l: lvl(l), r: lvl(r), spec };
  }
  /**
   * A stream from a server without CORS headers reads as exact digital zero through Web Audio and plays muted.
   * Checked once a second from the player itself (so it works even when no card is drawing meters):
   * after 4 s of exact zero the track moves to the plain element. Only that track: the next one tries Web Audio again.
   */
  private checkSilence() {
    const an = this.an;
    if (!an || !this.audio || this.active !== this.audio || this.audio.paused || this.audio.currentTime < 2) { this.zero = 0; return; }
    an.L.getFloatTimeDomainData(an.tl); an.R.getFloatTimeDomainData(an.tr);
    const zero = an.tl.every((x) => x === 0) && an.tr.every((x) => x === 0);
    if (!zero) { this.zero = 0; return; }
    if (++this.zero >= 4) this.fallback();
  }
  private fallback() {
    const old = this.audio!, t = old.currentTime, src = old.src;
    old.pause(); old.removeAttribute('src'); old.load();
    this.zero = 0;
    const cur = this.cur(); if (cur) cur.cross = true;
    const a = this.elX(); this.active = a; a.src = src;
    a.addEventListener('loadedmetadata', () => { try { a.currentTime = t; } catch { /* not seekable */ } }, { once: true });
    a.play().catch(() => this.emit());
  }
  emit() { this.subs.forEach((f) => { try { f(); } catch { /* subscriber gone */ } }); }
}

// One player per page, shared by every card instance (and other cards that want it).
const KEY = '__hifiWebPlayer';
export const WebPlayer: WebPlayerImpl = (window as any)[KEY] || ((window as any)[KEY] = new WebPlayerImpl());
