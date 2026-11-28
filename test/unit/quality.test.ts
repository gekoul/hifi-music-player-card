import { describe, expect, it } from 'vitest';
import { formatBadges, formatLine, formatShort, fromJellyHA, fromPath, playingFormat } from '../../src/quality';

describe('audio format', () => {
  it('reads JellyHA fields (bitrate in bit/s)', () => {
    const f = fromJellyHA({ audio_codec: 'flac', audio_bit_depth: 24, audio_sample_rate: 96000, audio_bit_rate: 4608000, audio_channels: 2, is_lossless: true, is_hi_res: true });
    expect(formatLine(f)).toBe('FLAC · 24-bit / 96 kHz · 4.6 Mbps');
    expect(formatShort(f)).toBe('FLAC 24/96 4608K');
    expect(formatBadges(f)).toEqual(['HI-RES', 'LOSSLESS']);
  });
  it('shows only what is known', () => {
    expect(formatLine(fromJellyHA({ audio_codec: 'mp3', audio_bit_rate: 320000 }))).toBe('MP3 · 320 kbps');
    expect(formatLine(fromJellyHA({ audio_sample_rate: 44100 }))).toBe('44.1 kHz');
    expect(fromJellyHA({})).toBeUndefined();
    expect(formatLine(undefined)).toBe('');
  });
  it('derives lossless and hi-res when the source does not say', () => {
    expect(formatBadges(fromJellyHA({ audio_codec: 'flac', audio_bit_depth: 16, audio_sample_rate: 44100 }))).toEqual(['LOSSLESS']);
    expect(formatBadges(fromJellyHA({ audio_codec: 'aac', audio_sample_rate: 96000 }))).toEqual(['HI-RES']);
    expect(formatBadges(fromJellyHA({ audio_codec: 'mp3', audio_channels: 1 }))).toEqual(['MONO']);
  });
  it('takes the codec from a file name or URL', () => {
    expect(fromPath('/music/01 Song.FLAC')?.codec).toBe('FLAC');
    expect(fromPath('http://x/stream.mp3?token=1')?.codec).toBe('MP3');
    expect(fromPath('media-source://radio_browser/abc')).toBeUndefined();
  });
  it('uses the This-browser format and does not guess for other players', () => {
    const hass: any = { services: {}, callWS: async () => ({}) };
    expect(playingFormat(hass, { hifi_format: { codec: 'FLAC' } }, () => {})?.codec).toBe('FLAC');
    expect(playingFormat(hass, { media_content_id: 'library://track/12' }, () => {})).toBeUndefined();
  });
});
