// Minimal Home Assistant frontend types used by the card.

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed?: string;
  last_updated?: string;
}

export interface HassEntityRegistryDisplayEntry {
  entity_id: string;
  device_id?: string;
  area_id?: string;
  platform?: string;
  hidden?: boolean;
  entity_category?: string | null;
  name?: string | null;
}

export interface HassDevice {
  id: string;
  area_id?: string | null;
  name?: string | null;
  name_by_user?: string | null;
}

export interface HassArea {
  area_id: string;
  name: string;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  entities?: Record<string, HassEntityRegistryDisplayEntry>;
  devices?: Record<string, HassDevice>;
  areas?: Record<string, HassArea>;
  language?: string;
  locale?: { language: string };
  themes?: { darkMode?: boolean };
  callService(domain: string, service: string, data?: Record<string, any>, target?: Record<string, any>): Promise<any>;
  callWS<T = any>(msg: Record<string, any>): Promise<T>;
  hassUrl?(path?: string): string;
}

export interface OutputConfig {
  entity?: string;
  name?: string;
  icon?: string;
  browser?: boolean;
}

export interface DiscoveryConfig {
  /** auto: Music Assistant players when installed, otherwise speakers; music_assistant; speakers; all */
  source?: 'auto' | 'music_assistant' | 'speakers' | 'all';
  /** players added by hand on top of what is found */
  also?: string[];
  include?: string[];
  exclude?: string[];
  include_areas?: string[];
  exclude_areas?: string[];
  include_integrations?: string[];
  exclude_integrations?: string[];
  prefer_music_assistant?: boolean;
  group_by?: 'none' | 'area' | 'integration';
  show_unavailable?: boolean;
  /** per-entity overrides from the editor: rename, icon, hide, order */
  overrides?: Record<string, { name?: string; icon?: string; hidden?: boolean; order?: number }>;
}

export interface LibraryConfig {
  sources?: 'auto' | string[];
  folders?: { path: string; name?: string }[];
  start?: string;
  open?: 'collapsed' | 'expanded';
  height?: number;
  view?: 'columns' | 'list';
  audio_only?: boolean;
  cache_hours?: number;
}

export interface CardConfig {
  type: string;
  /** storage key for what this card remembers per browser (output, theme, drawer); set it when two cards would otherwise share */
  key?: string;
  entity?: string;
  outputs?: 'auto' | OutputConfig[];
  discovery?: DiscoveryConfig;
  default_output?: string;
  output_helper?: string;
  remember_output?: boolean;
  unavailable?: 'dim' | 'hide';
  browser_player?: boolean;

  theme?: 'streamer' | 'console';
  theme_switch?: boolean;
  remember_theme?: boolean;
  mode?: 'auto' | 'dark' | 'light';
  accent?: string | number;
  spectrum_colors?: (string | number)[];
  brand?: string;
  model?: string;
  background?: 'theme' | 'card' | 'transparent';
  fonts?: 'web' | 'system';
  placeholder_art?: string;

  layout?: 'auto' | 'wide' | 'compact' | 'mini';
  max_height?: number;
  show?: Partial<Record<'art' | 'spectrum' | 'meters' | 'seek' | 'outputs' | 'switches' | 'chips' | 'volume' | 'theme_switch', boolean>>;
  idle_text?: string;

  skip?: { back?: number; forward?: number };
  volume?: { step?: number; max?: number; confirm_timeout?: number };
  visualizer?: 'auto' | 'animated' | 'off';
  reduced_motion?: 'auto' | boolean;
  pause_offscreen?: boolean;
  language?: string;

  library?: boolean | LibraryConfig;
}

export interface Output {
  id: string;          // entity id, or "browser"
  entity?: string;
  name: string;
  icon?: string;
  browser?: boolean;
  area?: string;
  integration?: string;
  group?: string;
  ma?: boolean;        // provided by Music Assistant
  na?: boolean;        // currently unavailable
}

export interface PlayerView {
  state: string;
  attributes: Record<string, any>;
}
