// media_player supported_features bits (homeassistant.components.media_player.MediaPlayerEntityFeature)
export const F = {
  PAUSE: 1,
  SEEK: 2,
  VOLUME_SET: 4,
  VOLUME_MUTE: 8,
  PREVIOUS_TRACK: 16,
  NEXT_TRACK: 32,
  TURN_ON: 128,
  TURN_OFF: 256,
  PLAY_MEDIA: 512,
  VOLUME_STEP: 1024,
  SELECT_SOURCE: 2048,
  STOP: 4096,
  CLEAR_PLAYLIST: 8192,
  PLAY: 16384,
  SHUFFLE_SET: 32768,
  SELECT_SOUND_MODE: 65536,
  BROWSE_MEDIA: 131072,
  REPEAT_SET: 262144,
  GROUPING: 524288,
  MEDIA_ENQUEUE: 2097152,
} as const;

export interface Caps {
  play: boolean;
  pause: boolean;
  stop: boolean;
  prev: boolean;
  next: boolean;
  seek: boolean;
  volSet: boolean;
  volStep: boolean;
  mute: boolean;
  shuffle: boolean;
  repeat: boolean;
  playMedia: boolean;
  enqueue: boolean;
}

export const BROWSER_CAPS: Caps = {
  play: true, pause: true, stop: true, prev: true, next: true, seek: true,
  volSet: true, volStep: true, mute: true, shuffle: false, repeat: false, playMedia: true, enqueue: true,
};

export function caps(sf: number | undefined): Caps {
  const f = Number(sf) || 0;
  const has = (b: number) => (f & b) === b;
  return {
    play: has(F.PLAY) || has(F.PAUSE),
    pause: has(F.PAUSE),
    stop: has(F.STOP),
    prev: has(F.PREVIOUS_TRACK),
    next: has(F.NEXT_TRACK),
    seek: has(F.SEEK),
    volSet: has(F.VOLUME_SET),
    volStep: has(F.VOLUME_STEP) || has(F.VOLUME_SET),
    mute: has(F.VOLUME_MUTE),
    shuffle: has(F.SHUFFLE_SET),
    repeat: has(F.REPEAT_SET),
    playMedia: has(F.PLAY_MEDIA),
    enqueue: has(F.MEDIA_ENQUEUE),
  };
}
