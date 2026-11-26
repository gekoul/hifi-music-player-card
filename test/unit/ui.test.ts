import { describe, expect, it } from 'vitest';
import { clamp, fixText, fmt } from '../../src/ui';
import { localizer } from '../../src/localize';

describe('fixText', () => {
  it('decodes Greek stored as cp1253 read as latin-1', () => {
    expect(fixText('Ìßêçò ÈåïäùñÜêçò')).toBe('Μίκης Θεοδωράκης');
  });
  it('leaves normal text alone and trims whitespace', () => {
    expect(fixText('  Dire   Straits ')).toBe('Dire Straits');
    expect(fixText('Τζίμης Πανούσης')).toBe('Τζίμης Πανούσης');
    expect(fixText('Café del Mar')).toBe('Café del Mar');
    expect(fixText(null)).toBe('');
  });
});

describe('helpers', () => {
  it('formats times', () => {
    expect(fmt(0)).toBe('0:00');
    expect(fmt(95.7)).toBe('1:35');
    expect(fmt(-3)).toBe('0:00');
  });
  it('clamps', () => { expect(clamp(5, 0, 1)).toBe(1); expect(clamp(-1, 0, 1)).toBe(0); });
});

describe('localizer', () => {
  it('uses the HA language and falls back to English', () => {
    const el = localizer({ locale: { language: 'el' } } as any);
    expect(el('library')).toBe('Βιβλιοθήκη');
    const fr = localizer({ locale: { language: 'fr' } } as any);
    expect(fr('library')).toBe('Library');
    expect(localizer(undefined, 'en')('playing_on', { output: 'WiiM', title: 'X' })).toBe('Playing on WiiM: X');
  });
  it('has the same keys in every language', async () => {
    const en = (await import('../../src/translations/en.json')).default;
    const el = (await import('../../src/translations/el.json')).default;
    expect(Object.keys(el).sort()).toEqual(Object.keys(en).sort());
  });
});
