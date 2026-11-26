import { expect, test } from '@playwright/test';
import { clickRow, lib, load, openLibrary } from './helpers';

async function openAlbum(page: any) {
  await openLibrary(page);
  await clickRow(page, 0, 'Jellyfin · Folders');
  await clickRow(page, 1, 'Rock'); await clickRow(page, 2, 'Dire Straits'); await clickRow(page, 3, 'Brothers');
}
const setPlaying = (page: any, title: string) => page.evaluate((t: string) => {
  const w = window as any, id = 'media_player.wiim_pro_6a20', st = w.hass.states[id];
  w.hass = { ...w.hass, states: { ...w.hass.states, [id]: { ...st, attributes: { ...st.attributes, media_title: t, media_artist: 'Dire Straits' } } } };
  w.el.hass = w.hass;
}, title);
const nowRow = (page: any) => lib<string>(page, `(L) => L.querySelector('.r.now .rn')?.textContent || ''`);

test('the playing track is highlighted and followed when the player moves on', async ({ page }) => {
  await load(page);
  await setPlaying(page, 'So Far Away');
  await openAlbum(page);
  await expect.poll(() => nowRow(page)).toBe('So Far Away');
  await setPlaying(page, 'Money for Nothing');
  await expect.poll(() => nowRow(page)).toBe('Money for Nothing');
  expect(await lib<string>(page, `(L) => [...L.querySelectorAll('.col')].pop().querySelector('.r.sel .rn')?.textContent`)).toBe('Money for Nothing');
});

test('titles in the right-most column are never cut', async ({ page }) => {
  await load(page);
  await openAlbum(page);
  const cut = await lib<number>(page, `(L) => [...[...L.querySelectorAll('.col')].pop().querySelectorAll('.rn')].filter((e) => e.scrollWidth > e.clientWidth + 1).length`);
  expect(cut).toBe(0);
  const text = await lib<string>(page, `(L) => [...L.querySelectorAll('.col')].pop().innerText`);
  expect(text).toContain('(extended live version)');
});

test('row buttons do not take room from folder names', async ({ page }) => {
  await load(page);
  await openAlbum(page);
  // a folder column in the middle: its names fit (the column sizes to them)
  const cut = await lib<number>(page, `(L) => [...[...L.querySelectorAll('.col')][2].querySelectorAll('.rn')].filter((e) => e.scrollWidth > e.clientWidth + 1).length`);
  expect(cut).toBe(0);
});
