import { expect, test } from '@playwright/test';
import { calls, clearCalls, clickRow, lastCol, lib, load, openLibrary } from './helpers';

test('lists music sources only', async ({ page }) => {
  await load(page);
  await openLibrary(page);
  const root = await lib<string>(page, `(L) => L.querySelector('.col').innerText`);
  for (const want of ['Multimedia', 'Favourites', 'Jellyfin · Folders', 'Radio Browser', 'JellyHA', 'Plex']) expect(root).toContain(want);
  for (const bad of ['Text-to-speech', 'Camera', 'Dahua', 'Photos']) expect(root).not.toContain(bad);
});

test('plays a folder and a single file on a speaker', async ({ page }) => {
  await load(page);
  await openLibrary(page);
  await clickRow(page, 1, 'Dire Straits');
  await clearCalls(page);
  await lib(page, `(L) => L.querySelector('.r[data-c="2"][data-r="1"] .rp').click()`);
  await lib(page, `(L) => [...L.querySelectorAll('.col')][2].querySelector('.pa').click()`);
  await expect.poll(() => calls(page)).toEqual([
    ['media_player', 'play_media', { entity_id: 'media_player.wiim_pro_6a20', media_content_id: 'ms/ds/2', media_content_type: 'audio/mpeg', enqueue: 'play' }],
    ['media_player', 'shuffle_set', { entity_id: 'media_player.wiim_pro_6a20', shuffle: false }],
    ['media_player', 'play_media', { entity_id: 'media_player.wiim_pro_6a20', media_content_id: 'ms/ds/1', media_content_type: 'audio/mpeg', enqueue: 'replace' }],
    ['media_player', 'play_media', { entity_id: 'media_player.wiim_pro_6a20', media_content_id: 'ms/ds/2', media_content_type: 'audio/mpeg', enqueue: 'add' }],
    ['media_player', 'play_media', { entity_id: 'media_player.wiim_pro_6a20', media_content_id: 'ms/ds/3', media_content_type: 'audio/mpeg', enqueue: 'add' }],
  ]);
});

test('JellyHA folders: tree from album paths, Play all and Shuffle', async ({ page }) => {
  await load(page);
  await openLibrary(page);
  await clickRow(page, 0, 'Jellyfin · Folders');
  expect(await lastCol(page)).toContain('9910 Hellas');
  await clickRow(page, 1, 'Rock'); await clickRow(page, 2, 'Dire Straits'); await clickRow(page, 3, 'Brothers');
  expect(await lastCol(page)).toMatch(/So Far Away.*Money for Nothing/);
  await clearCalls(page);
  await lib(page, `(L) => [...L.querySelectorAll('.col')].pop().querySelectorAll('.pa')[1].click()`);
  await expect.poll(() => calls(page)).toEqual([
    ['media_player', 'shuffle_set', { entity_id: 'media_player.wiim_pro_6a20', shuffle: true }],
    ['jellyha', 'play_music', { entity_id: 'media_player.wiim_pro_6a20', item_id: 'a3', search_type: 'album' }],
  ]);
});

test('This browser resolves media-source files to streams', async ({ page }) => {
  await load(page);
  await page.evaluate(() => [...(window as any).el.shadowRoot.querySelectorAll('.ob')].find((b: any) => b.textContent.includes('browser')).click());
  await openLibrary(page);
  await clickRow(page, 1, 'Dire Straits');
  await page.evaluate(() => { (window as any).calls.length = 0; });
  await lib(page, `(L) => L.querySelector('.r[data-c="2"][data-r="0"] .rp').click()`);
  await expect.poll(() => page.evaluate(() => (window as any).calls.filter((c: any[]) => c[1] === 'media_source/resolve_media').length)).toBeGreaterThan(0);
  await expect.poll(() => lib<string>(page, `(L) => L.querySelector('.toast')?.textContent || ''`)).toContain('Playing on This browser');
});

test('On this player follows the selected output', async ({ page }) => {
  await load(page, { discovery: { also: ['media_player.wiim_kitchen'] } });
  await openLibrary(page);
  expect(await lib<string>(page, `(L) => L.querySelector('.col').innerText`)).not.toContain('ON THIS PLAYER');
  await page.evaluate(() => [...(window as any).el.shadowRoot.querySelectorAll('.ob')].find((b: any) => b.textContent.includes('WiiM Kitchen')).click());
  await expect.poll(() => lib<string>(page, `(L) => L.querySelector('.col').innerText`)).toContain('ON THIS PLAYER');
  await clickRow(page, 0, 'WiiM Kitchen');
  expect(await lastCol(page)).toMatch(/Presets.*Queue/);
  expect(await lastCol(page)).not.toContain('Camera');
});

test('Plex library through its player, without movies', async ({ page }) => {
  await load(page);
  await openLibrary(page);
  await clickRow(page, 0, 'Plex');
  const col = await lastCol(page);
  expect(col).toContain('Music');
  expect(col).not.toContain('Movies');
});
