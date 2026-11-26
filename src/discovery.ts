import { F } from './features';
import type { CardConfig, HomeAssistant, Output } from './types';

/** Integrations whose media_player entities are not audio outputs (sessions, remotes, browsers, buzzers, satellites). */
const NOT_SPEAKER = new Set(['jellyha', 'jellyfin', 'emby', 'plex', 'browser_mod', 'hass_agent', 'iotlink', 'mobile_app', 'androidtv_remote', 'sonoff', 'ewelink',
  'webostv', 'samsungtv', 'braviatv', 'philips_js', 'vizio', 'roku', 'androidtv', 'firetv', 'panasonic_viera', 'hisense_aehw4a1', 'kodi', 'apple_tv',
  'xbox', 'playstation_network', 'ps4', 'steam_online', 'nvidia_shield', 'tvheadend', 'universal', 'group', 'media_extractor']);
const NOT_SPEAKER_NAME = /\b(buzzer|siren|doorbell|chime|satellite|sat[ _]voice|library[ _]browser|pc|desktop|computer|workstation)\b/i;

/** True when Music Assistant provides players in this Home Assistant. */
export function hasMusicAssistant(hass: HomeAssistant) {
  return Object.values(hass.entities || {}).some((e) => e.platform === 'music_assistant' && e.entity_id.startsWith('media_player.'));
}

/** A media player that is plausibly a speaker: plays media, has a volume, is not a TV or a known non-audio entity. */
export function looksLikeSpeaker(hass: HomeAssistant, eid: string) {
  const st = hass.states[eid], reg = hass.entities?.[eid];
  if (!st) return false;
  const sf = Number(st.attributes.supported_features) || 0;
  if (!(sf & F.PLAY_MEDIA) || !(sf & (F.VOLUME_SET | F.VOLUME_STEP))) return false;
  if (st.attributes.device_class === 'tv') return false;
  if (reg?.platform && NOT_SPEAKER.has(reg.platform)) return false;
  if (NOT_SPEAKER_NAME.test(`${eid} ${st.attributes.friendly_name || ''}`)) return false;
  return true;
}

const norm = (s: string) =>
  String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\b(music assistant|ma)\b/g, '').replace(/[^a-z0-9Ͱ-Ͽ]+/g, '');

export function areaOf(hass: HomeAssistant, eid: string): string | undefined {
  const e = hass.entities?.[eid];
  const aid = e?.area_id || (e?.device_id ? hass.devices?.[e.device_id]?.area_id : undefined);
  return aid ? hass.areas?.[aid]?.name || aid : undefined;
}

/** Builds the output list: either the hand-made list, or every media player found automatically. */
export function buildOutputs(hass: HomeAssistant, c: CardConfig): Output[] {
  const browser: Output = { id: 'browser', name: 'This browser', icon: 'mdi:web', browser: true };
  if (c.entity) {
    const out: Output[] = [mk(hass, c.entity)];
    if (c.browser_player) out.push(browser);
    return out;
  }
  if (Array.isArray(c.outputs)) {
    return c.outputs.map((o) => (o.browser
      ? { ...browser, name: o.name || browser.name, icon: o.icon || browser.icon }
      : { ...mk(hass, o.entity!), ...(o.name ? { name: o.name } : {}), ...(o.icon ? { icon: o.icon } : {}) }));
  }
  const d = c.discovery || {};
  const preferMA = d.prefer_music_assistant !== false;
  // which players are candidates: Music Assistant players when it is installed, otherwise anything that looks like a speaker
  const source = d.source || 'auto';
  const maOnly = source === 'music_assistant' || (source === 'auto' && hasMusicAssistant(hass));
  const also = new Set(d.also || []);
  const ov = d.overrides || {};
  let list: Output[] = [];
  for (const [eid, st] of Object.entries(hass.states)) {
    if (!eid.startsWith('media_player.')) continue;
    const reg = hass.entities?.[eid];
    if (reg?.hidden || reg?.entity_category) continue;
    const sf = Number(st.attributes.supported_features) || 0;
    if (!(sf & F.PLAY_MEDIA)) continue;
    if (!d.show_unavailable && st.state === 'unavailable' && !also.has(eid)) continue;
    const o = mk(hass, eid);
    if (!also.has(eid)) {
      if (maOnly ? !o.ma : source === 'all' ? false : !looksLikeSpeaker(hass, eid)) continue;
    }
    if (d.include?.length && !d.include.includes(eid)) continue;
    if (d.exclude?.includes(eid)) continue;
    if (d.include_areas?.length && !d.include_areas.some((a) => a === o.area || a === reg?.area_id)) continue;
    if (d.exclude_areas?.some((a) => a === o.area || a === reg?.area_id)) continue;
    if (d.include_integrations?.length && !d.include_integrations.includes(o.integration || '')) continue;
    if (d.exclude_integrations?.includes(o.integration || '')) continue;
    if (ov[eid]?.hidden) continue;
    list.push(o);
  }
  if (preferMA) {
    const maNames = new Set(list.filter((o) => o.ma).map((o) => norm(o.name)));
    const maDevices = new Set(list.filter((o) => o.ma).map((o) => hass.entities?.[o.entity!]?.device_id).filter(Boolean));
    list = list.filter((o) => o.ma || also.has(o.id) || (!maNames.has(norm(o.name)) && !maDevices.has(hass.entities?.[o.entity!]?.device_id)));
  }
  list.forEach((o) => {
    const x = ov[o.id];
    if (x?.name) o.name = x.name;
    if (x?.icon) o.icon = x.icon;
    o.group = d.group_by === 'none' ? undefined : d.group_by === 'integration' ? o.integration : o.area;
  });
  list.sort((a, b) => (ov[a.id]?.order ?? 999) - (ov[b.id]?.order ?? 999)
    || String(a.group || '~').localeCompare(String(b.group || '~')) || a.name.localeCompare(b.name));
  if (c.browser_player) list.push(browser);
  return list;
}

function mk(hass: HomeAssistant, eid: string): Output {
  const st = hass.states[eid];
  const reg = hass.entities?.[eid];
  const name = String(st?.attributes.friendly_name || reg?.name || eid.split('.')[1]);
  return {
    id: eid,
    entity: eid,
    name,
    icon: st?.attributes.icon,
    area: areaOf(hass, eid),
    integration: reg?.platform,
    ma: reg?.platform === 'music_assistant' || st?.attributes.mass_player_type !== undefined,
  };
}

export function isGroup(hass: HomeAssistant, eid?: string) {
  const m = eid ? hass.states[eid]?.attributes.group_members : undefined;
  return Array.isArray(m) && m.length > 1;
}
