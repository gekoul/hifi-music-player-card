import { F } from './features';
import type { CardConfig, HomeAssistant, Output } from './types';

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
  const ov = d.overrides || {};
  let list: Output[] = [];
  for (const [eid, st] of Object.entries(hass.states)) {
    if (!eid.startsWith('media_player.')) continue;
    const reg = hass.entities?.[eid];
    if (reg?.hidden || reg?.entity_category) continue;
    const sf = Number(st.attributes.supported_features) || 0;
    if (!(sf & F.PLAY_MEDIA)) continue;
    if (!d.show_unavailable && st.state === 'unavailable') continue;
    const o = mk(hass, eid);
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
    list = list.filter((o) => o.ma || (!maNames.has(norm(o.name)) && !maDevices.has(hass.entities?.[o.entity!]?.device_id)));
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
