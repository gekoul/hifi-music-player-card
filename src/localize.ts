import en from './translations/en.json';
import el from './translations/el.json';
import type { HomeAssistant } from './types';

const LANGS: Record<string, Record<string, string>> = { en, el };
export type Key = keyof typeof en;

export function localizer(hass?: HomeAssistant, forced?: string) {
  const lang = (forced || hass?.locale?.language || hass?.language || 'en').split('-')[0];
  const table = LANGS[lang] || en;
  return (key: Key, vars?: Record<string, string | number>) => {
    let s = table[key] ?? (en as Record<string, string>)[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
}
export type Localize = ReturnType<typeof localizer>;
