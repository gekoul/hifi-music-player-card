// Finds a stream a browser can play for a radio station that Music Assistant lists.
// Music Assistant streams radio to its own players only, so for the "This browser" output the card
// looks the station up in the public Radio Browser directory (the same directory Music Assistant and
// Home Assistant use) and plays the station's own stream.

export interface RbStation {
  stationuuid: string;
  name: string;
  url?: string;
  url_resolved?: string;
  favicon?: string;
  codec?: string;
  bitrate?: number;
  hls?: number;
  lastcheckok?: number;
  votes?: number;
}

const SERVERS = ['de1', 'de2', 'fi1', 'nl1', 'at1'].map((s) => `https://${s}.api.radio-browser.info`);

/** Lower case, no "radio"/"fm", no punctuation or spaces: "Rock FM 96.9" → "rock969". */
const FILLER = new Set(['fm', 'radio', 'ραδιο', 'ραδιοφωνο']);
export const normStation = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .split(/[^a-z0-9\u0370-\u03ff]+/).filter((w) => w && !FILLER.has(w)).join('');

/** The part of an image address that identifies it (file name without extension), to match favicons. */
const imgKey = (u?: string) => { const k = String(u || '').split('?')[0].split('/').pop()?.split('.')[0] || ''; return k.length > 6 ? k : ''; };

/** Streams the station is known by in Music Assistant's uri, before any lookup. */
export function urisFromId(uri: string): { uuid?: string; url?: string } {
  const u = String(uri || '');
  const id = u.match(/^radiobrowser:\/\/radio\/([0-9a-f-]{36})/i);
  if (id) return { uuid: id[1] };
  const url = u.match(/^[a-z_]+:\/\/radio\/(https?(?::|%3a).+)$/i);
  if (url) { try { return { url: decodeURIComponent(url[1]) }; } catch { return { url: url[1] }; } }
  return {};
}

/** Best matches first: same name, same favicon, working, https, most votes. */
export function rankStations(list: RbStation[], name: string, img?: string): RbStation[] {
  const want = normStation(name), key = imgKey(img);
  const score = (s: RbStation) => {
    const n = normStation(s.name);
    let v = 0;
    if (key && imgKey(s.favicon) === key) v += 100;
    if (n === want) v += 50; else if (want && (n.startsWith(want) || want.startsWith(n))) v += 20; else if (want && n.includes(want)) v += 8; else v -= 100;
    if (s.lastcheckok === 0) v -= 30;
    if (/^https:/i.test(s.url_resolved || s.url || '')) v += 5;
    if (s.hls) v -= 3;
    return v + Math.min(10, Math.log10((s.votes || 0) + 1) * 3);
  };
  return list.map((s) => ({ s, v: score(s) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).map((x) => x.s);
}

/**
 * Orders stream addresses for this page: on an https page an http stream is blocked (mixed content),
 * so its https form is tried first and plain http only when the page itself is http.
 * HLS (.m3u8) goes last when the browser can't play it natively.
 */
export function orderUrls(urls: string[], pageHttps: boolean, hlsOk: boolean): string[] {
  const out: string[] = [];
  const add = (u: string) => { if (u && !out.includes(u)) out.push(u); };
  urls.forEach((u) => { if (/^https:/i.test(u)) add(u); });
  urls.forEach((u) => { if (/^http:/i.test(u)) add(u.replace(/^http:/i, 'https:')); });
  if (!pageHttps) urls.forEach((u) => { if (/^http:/i.test(u)) add(u); });
  const hls = (u: string) => /\.m3u8(\?|$)/i.test(u);
  return hlsOk ? out : [...out.filter((u) => !hls(u)), ...out.filter(hls)];
}

async function api<T>(path: string): Promise<T | null> {
  for (const s of SERVERS) {
    try {
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(s + path, { signal: ctl.signal }).finally(() => clearTimeout(tm));
      if (r.ok) return await r.json() as T;
    } catch { /* next server */ }
  }
  return null;
}

const found = new Map<string, string[]>();

/** Stream addresses for a station, best first. Empty when nothing was found. */
export async function radioStreams(st: { uri?: string; name: string; img?: string }, extra: string[] = []): Promise<string[]> {
  const k = `${st.uri}|${st.name}`;
  if (found.has(k)) return found.get(k)!;
  const { uuid, url } = urisFromId(st.uri || '');
  const urls = [...extra];
  if (url) urls.push(url);
  if (uuid && !urls.length) {
    const r = await api<RbStation[]>(`/json/stations/byuuid/${uuid}`);
    r?.forEach((s) => urls.push(s.url_resolved || s.url || ''));
  }
  if (!urls.length && st.name) {
    const r = await api<RbStation[]>(`/json/stations/byname/${encodeURIComponent(st.name)}?hidebroken=true&order=votes&reverse=true&limit=40`)
      || [];
    let best = rankStations(r, st.name, st.img);
    if (!best.length) {
      // names in Music Assistant are sometimes shortened or decorated: search by the main word
      const word = st.name.split(/[\s·|\-–]+/).sort((a, b) => b.length - a.length)[0];
      if (word && word !== st.name) best = rankStations(await api<RbStation[]>(`/json/stations/byname/${encodeURIComponent(word)}?hidebroken=true&order=votes&reverse=true&limit=60`) || [], st.name, st.img);
    }
    // the first matches are usually the same station listed more than once with other stream addresses
    best.slice(0, 4).forEach((s) => urls.push(s.url_resolved || s.url || ''));
  }
  const a = typeof document !== 'undefined' ? document.createElement('audio') : null;
  const out = orderUrls(urls.filter(Boolean), typeof location !== 'undefined' && location.protocol === 'https:', !!a?.canPlayType('application/vnd.apple.mpegurl'));
  if (out.length) found.set(k, out);
  return out;
}
