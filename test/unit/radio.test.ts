import { describe, it, expect } from 'vitest';
import { normStation, orderUrls, rankStations, urisFromId } from '../../src/radio';

describe('radio streams', () => {
  it('reads stream addresses from Music Assistant uris', () => {
    expect(urisFromId('radiobrowser://radio/96062a7b-0601-11e8-ae97-52543be04c81')).toEqual({ uuid: '96062a7b-0601-11e8-ae97-52543be04c81' });
    expect(urisFromId('builtin://radio/https%3A%2F%2Fs.example%2Flive.mp3')).toEqual({ url: 'https://s.example/live.mp3' });
    expect(urisFromId('library://radio/7')).toEqual({});
  });
  it('normalizes names', () => {
    expect(normStation('Rock FM 96.9')).toBe('rock969');
    expect(normStation('Ραδιόφωνο Μελωδία')).toBe(normStation('μελωδια'));
  });
  it('ranks the same station first and drops others', () => {
    const r = rankStations([
      { stationuuid: 'a', name: 'Classic Rock', votes: 9999 },
      { stationuuid: 'b', name: 'Rock FM 96.9', votes: 3, url_resolved: 'http://x' },
      { stationuuid: 'c', name: 'ROCK FM 96,9', votes: 1, url_resolved: 'https://y', favicon: 'https://i/rockfm969logo.png' },
    ], 'Rock FM 96.9', 'https://img/rockfm969logo.png');
    expect(r.map((s) => s.stationuuid)).toEqual(['c', 'b']);
  });
  it('orders https first and never plain http on a secure page', () => {
    expect(orderUrls(['http://a/x.mp3', 'https://b/y.m3u8', 'https://c/z.aac'], true, false)).toEqual(['https://c/z.aac', 'https://a/x.mp3', 'https://b/y.m3u8']);
    expect(orderUrls(['http://a/x.mp3'], false, true)).toEqual(['https://a/x.mp3', 'http://a/x.mp3']);
  });
});
