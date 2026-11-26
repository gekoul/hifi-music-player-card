import { describe, expect, it } from 'vitest';
import { buildOutputs, hasMusicAssistant, looksLikeSpeaker } from '../../src/discovery';
import { F } from '../../src/features';
import type { HomeAssistant } from '../../src/types';

const SPK = F.PLAY | F.PAUSE | F.PLAY_MEDIA | F.VOLUME_SET;
function hass(players: [string, string, Record<string, any>, string?, string?][]): HomeAssistant {
  const states: any = {}, entities: any = {};
  for (const [id, platform, attrs, state = 'idle', area] of players) {
    states[id] = { entity_id: id, state, attributes: { supported_features: SPK, ...attrs } };
    entities[id] = { entity_id: id, platform, area_id: area };
  }
  return { states, entities, areas: { attic: { area_id: 'attic', name: 'Attic' } }, devices: {}, callService: async () => ({}), callWS: async () => ({}) } as any;
}

describe('discovery', () => {
  const withMA = hass([
    ['media_player.wiim_ma', 'music_assistant', { friendly_name: 'WiiM Attic' }, 'idle', 'attic'],
    ['media_player.wiim', 'linkplay', { friendly_name: 'WiiM Attic' }],
    ['media_player.pc', 'hass_agent', { friendly_name: 'GKOUL PC' }],
    ['media_player.jellyha_library_browser', 'jellyha', { friendly_name: 'JellyHA Library browser' }],
    ['media_player.tv', 'samsungtv', { friendly_name: 'TV', device_class: 'tv' }],
    ['media_player.echo', 'alexa_devices', { friendly_name: 'Echo' }],
    ['media_player.buzzer', 'sonoff', { friendly_name: 'Buzzer' }],
    ['media_player.offline_ma', 'music_assistant', { friendly_name: 'Offline' }, 'unavailable'],
  ]);

  it('uses Music Assistant players when Music Assistant is installed', () => {
    expect(hasMusicAssistant(withMA)).toBe(true);
    expect(buildOutputs(withMA, { type: 'x' }).map((o) => o.id)).toEqual(['media_player.wiim_ma']);
  });
  it('adds This browser and players listed in discovery.also', () => {
    const ids = buildOutputs(withMA, { type: 'x', browser_player: true, discovery: { also: ['media_player.echo'] } }).map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['media_player.wiim_ma', 'media_player.echo', 'browser']));
    expect(ids[ids.length - 1]).toBe('browser');
  });
  it('filters non-speakers in speakers mode and hides native twins of MA players', () => {
    const ids = buildOutputs(withMA, { type: 'x', discovery: { source: 'speakers' } }).map((o) => o.id);
    expect(ids).toContain('media_player.echo');
    for (const bad of ['media_player.pc', 'media_player.jellyha_library_browser', 'media_player.tv', 'media_player.buzzer']) expect(ids).not.toContain(bad);
  });
  it('keeps the native twin when prefer_music_assistant is off', () => {
    const ids = buildOutputs(withMA, { type: 'x', discovery: { source: 'all', prefer_music_assistant: false } }).map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['media_player.wiim', 'media_player.wiim_ma']));
  });
  it('shows offline players only when asked', () => {
    expect(buildOutputs(withMA, { type: 'x', discovery: { show_unavailable: true } }).map((o) => o.id)).toContain('media_player.offline_ma');
  });
  it('applies overrides: rename, hide, order', () => {
    const h = hass([['media_player.a', 'music_assistant', { friendly_name: 'A' }], ['media_player.b', 'music_assistant', { friendly_name: 'B' }], ['media_player.c', 'music_assistant', { friendly_name: 'C' }]]);
    const outs = buildOutputs(h, { type: 'x', discovery: { overrides: { 'media_player.c': { order: 0, name: 'Kitchen' }, 'media_player.b': { hidden: true } } } });
    expect(outs.map((o) => o.name)).toEqual(['Kitchen', 'A']);
  });
  it('falls back to speaker-like players without Music Assistant', () => {
    const h = hass([['media_player.sonos', 'sonos', { friendly_name: 'Sonos' }], ['media_player.tv', 'webostv', { friendly_name: 'TV' }], ['media_player.nf', 'x', { friendly_name: 'No volume', supported_features: F.PLAY | F.PLAY_MEDIA }]]);
    expect(buildOutputs(h, { type: 'x' }).map((o) => o.id)).toEqual(['media_player.sonos']);
    expect(looksLikeSpeaker(h, 'media_player.nf')).toBe(false);
  });
  it('honours a hand-made output list and the single entity form', () => {
    expect(buildOutputs(withMA, { type: 'x', outputs: [{ entity: 'media_player.tv', name: 'Telly' }, { browser: true }] }).map((o) => [o.id, o.name]))
      .toEqual([['media_player.tv', 'Telly'], ['browser', 'This browser']]);
    expect(buildOutputs(withMA, { type: 'x', entity: 'media_player.echo' }).map((o) => o.id)).toEqual(['media_player.echo']);
  });
  it('survives a hass object without the registries', () => {
    const h = { states: { 'media_player.x': { entity_id: 'media_player.x', state: 'idle', attributes: { supported_features: SPK, friendly_name: 'X' } } } } as any;
    expect(buildOutputs(h, { type: 'x' }).map((o) => o.id)).toEqual(['media_player.x']);
  });
});

describe('discovery: review fixes', () => {
  it('include selects non-Music-Assistant players even when Music Assistant is installed', () => {
    const h = hass([['media_player.ma', 'music_assistant', { friendly_name: 'MA' }], ['media_player.sonos', 'sonos', { friendly_name: 'Sonos' }]]);
    expect(buildOutputs(h, { type: 'x', discovery: { include: ['media_player.sonos'] } }).map((o) => o.id)).toEqual(['media_player.sonos']);
  });
});
