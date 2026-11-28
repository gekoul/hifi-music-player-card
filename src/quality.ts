import type { HomeAssistant } from './types';

/** What is known about a track's audio format. Every field is optional: unknown stays unknown, never guessed. */
export interface AudioFormat {
  codec?: string;      // FLAC, MP3, AAC, ALAC, OPUS, WAV, DSD …
  bits?: number;       // bit depth
  rate?: number;       // sample rate in Hz
  kbps?: number;       // bitrate in kbit/s
  channels?: number;
  lossless?: boolean;
  hires?: boolean;
}

const LOSSLESS = new Set(['FLAC', 'ALAC', 'WAV', 'AIFF', 'DSD', 'DSF', 'DFF', 'APE', 'WV', 'PCM']);
const EXT = /\.(flac|mp3|m4a|aac|alac|ogg|opus|wav|aiff?|dsf|dff|ape|wv|wma)(?:$|[?#])/i;
const EXT_CODEC: Record<string, string> = { m4a: 'AAC', ogg: 'VORBIS', aif: 'AIFF', dsf: 'DSD', dff: 'DSD' };

/** Builds a format from JellyHA's item fields (audio_codec, audio_bit_depth, …). */
export function fromJellyHA(x: any): AudioFormat | undefined {
  if (!x) return undefined;
  const codec = String(x.audio_codec || x.container || '').trim();
  const f: AudioFormat = {
    codec: codec ? codec.toUpperCase() : undefined,
    bits: num(x.audio_bit_depth),
    rate: num(x.audio_sample_rate),
    kbps: num(x.audio_bit_rate) ? Math.round(num(x.audio_bit_rate)! / (num(x.audio_bit_rate)! > 20000 ? 1000 : 1)) : undefined,
    channels: num(x.audio_channels),
    lossless: x.is_lossless === true ? true : undefined,
    hires: x.is_hi_res === true ? true : undefined,
  };
  return complete(f);
}

/** Only the codec, from a file name or URL ending in a known extension. */
export function fromPath(p?: string): AudioFormat | undefined {
  const m = EXT.exec(String(p || ''));
  if (!m) return undefined;
  const e = m[1].toLowerCase();
  return complete({ codec: EXT_CODEC[e] || e.toUpperCase() });
}

function num(v: unknown): number | undefined { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; }
function complete(f: AudioFormat): AudioFormat | undefined {
  if (f.codec === 'ALAC' || f.codec && LOSSLESS.has(f.codec)) f.lossless = f.lossless ?? true;
  if ((f.bits && f.bits >= 24) || (f.rate && f.rate > 48000) || f.codec === 'DSD') f.hires = f.hires ?? true;
  return f.codec || f.bits || f.rate || f.kbps ? f : undefined;
}

const khz = (hz: number) => { const k = hz / 1000; return Number.isInteger(k) ? String(k) : k.toFixed(1); };
const rateText = (kbps: number) => (kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${Math.round(kbps)} kbps`);

/** "FLAC · 24-bit / 96 kHz · 4.6 Mbps" — only the parts that are known. */
export function formatLine(f?: AudioFormat): string {
  if (!f) return '';
  const res = f.bits && f.rate ? `${f.bits}-bit / ${khz(f.rate)} kHz` : f.rate ? `${khz(f.rate)} kHz` : f.bits ? `${f.bits}-bit` : '';
  return [f.codec, res, f.kbps ? rateText(f.kbps) : ''].filter(Boolean).join(' · ');
}
/** "FLAC 24/96 4608K" for the Console's dot-matrix display. */
export function formatShort(f?: AudioFormat): string {
  if (!f) return '';
  const res = f.bits && f.rate ? `${f.bits}/${khz(f.rate)}` : f.rate ? `${khz(f.rate)}K` : '';
  return [f.codec, res, f.kbps ? `${Math.round(f.kbps)}K` : ''].filter(Boolean).join(' ');
}
/** Badges: HI-RES, LOSSLESS, MONO / 5.1 / 7.1. */
export function formatBadges(f?: AudioFormat): string[] {
  if (!f) return [];
  const b: string[] = [];
  if (f.hires) b.push('HI-RES');
  if (f.lossless) b.push('LOSSLESS');
  if (f.channels === 1) b.push('MONO'); else if (f.channels === 6) b.push('5.1'); else if (f.channels === 8) b.push('7.1');
  return b;
}

// ── what a player is playing ──
const JH_STREAM = /\/api\/jellyha\/stream\/[^/]+\/([0-9a-f]{32})/i;
const cache = new Map<string, AudioFormat | null>();
const pending = new Map<string, Promise<AudioFormat | null>>();

/**
 * Format of what a media player reports as playing. Returns what is known right now (sync), and
 * calls `onReady` once when a lookup (JellyHA item details) finishes.
 */
export function playingFormat(hass: HomeAssistant, attrs: Record<string, any>, onReady: () => void): AudioFormat | undefined {
  if (attrs.hifi_format) return attrs.hifi_format as AudioFormat;          // This browser
  const id = String(attrs.media_content_id || '');
  const m = JH_STREAM.exec(id);
  if (m && (hass as any).services?.jellyha?.get_item) {
    const key = 'jh:' + m[1];
    if (cache.has(key)) return cache.get(key) || fromPath(id);
    if (!pending.has(key)) {
      pending.set(key, hass.callWS<any>({ type: 'call_service', domain: 'jellyha', service: 'get_item', service_data: { item_id: m[1] }, return_response: true })
        .then((r) => { const x = r?.response; const it = x?.item || x?.items?.[0] || x; const f = fromJellyHA(it) || null; cache.set(key, f); return f; })
        .catch(() => { cache.set(key, null); return null; })
        .finally(() => { pending.delete(key); onReady(); }));
    }
    return fromPath(id);
  }
  return fromPath(id);
}
