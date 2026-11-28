import { expect, test } from '@playwright/test';
import { clickRow, lib, load, openLibrary } from './helpers';

test('track rows show codec and hi-res tags', async ({ page }) => {
  await load(page);
  await openLibrary(page);
  await clickRow(page, 0, 'Jellyfin · Folders'); await clickRow(page, 1, 'Rock'); await clickRow(page, 2, 'Dire Straits'); await clickRow(page, 3, 'Brothers');
  const tags = await lib<string[]>(page, `(L) => [...[...L.querySelectorAll('.col')].pop().querySelectorAll('.qt')].map((q) => q.textContent.trim())`);
  expect(tags).toEqual(['FLACHR', 'MP3']);
});

test('a speaker playing a JellyHA stream shows its format', async ({ page }) => {
  await load(page);
  await page.evaluate(() => {
    const w = window as any, id = 'media_player.wiim_pro_6a20', st = w.hass.states[id];
    w.hass = { ...w.hass, states: { ...w.hass.states, [id]: { ...st, attributes: { ...st.attributes, media_content_id: 'builtin://track/https://ha.local/api/jellyha/stream/01M2XR8M327DJGJK9BJ5E0P2W4/3ed8e2ec29e8be6beca6cf406f96a2f9?media_type=Audio' } } } };
    w.el.hass = w.hass;
  });
  await expect(page.locator('hifi-music-player-card')).toContainText('FLAC · 16-bit / 44.1 kHz · 1.0 Mbps');
  await expect(page.locator('hifi-music-player-card')).toContainText('LOSSLESS');
});

test('format can be switched off', async ({ page }) => {
  await load(page, { show: { quality: false } });
  await openLibrary(page);
  await clickRow(page, 0, 'Jellyfin · Folders'); await clickRow(page, 1, 'Rock'); await clickRow(page, 2, 'Dire Straits'); await clickRow(page, 3, 'Brothers');
  expect(await lib<number>(page, `(L) => L.querySelectorAll('.qt').length`)).toBe(0);
});
