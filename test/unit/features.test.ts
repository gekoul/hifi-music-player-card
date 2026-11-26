import { describe, expect, it } from 'vitest';
import { F, caps } from '../../src/features';

describe('caps', () => {
  it('reads nothing from 0 or undefined', () => {
    expect(Object.values(caps(undefined)).some(Boolean)).toBe(false);
    expect(Object.values(caps(0)).some(Boolean)).toBe(false);
  });
  it('detects each feature bit', () => {
    const c = caps(F.PAUSE | F.SEEK | F.VOLUME_SET | F.VOLUME_MUTE | F.NEXT_TRACK | F.SHUFFLE_SET | F.REPEAT_SET | F.MEDIA_ENQUEUE);
    expect(c).toMatchObject({ pause: true, play: true, seek: true, volSet: true, volStep: true, mute: true, next: true, prev: false, shuffle: true, repeat: true, enqueue: true, stop: false });
  });
  it('treats volume_step without volume_set as step-only', () => {
    const c = caps(F.VOLUME_STEP | F.PLAY);
    expect(c.volSet).toBe(false);
    expect(c.volStep).toBe(true);
  });
});
