import { expect, test } from '@playwright/test';
import { calls, clearCalls, load } from './helpers';

const sr = (page: any, fn: string) => page.evaluate(`(() => { const R = el.shadowRoot; return (${fn})(R); })()`);

test('theme menu lists all themes with swatches and switches theme', async ({ page }) => {
  const errors = await load(page, { remember_theme: false });
  await sr(page, `(R) => R.querySelector('.tbtn').click()`);
  const items = await sr(page, `(R) => [...R.querySelectorAll('.tlist [role=menuitemradio]')].map((b) => b.textContent.trim())`);
  expect(items).toEqual(['Streamer', 'VU Console', 'Helm']);
  expect(await sr(page, `(R) => R.querySelectorAll('.tlist .sw3 i').length`)).toBe(9);
  await sr(page, `(R) => [...R.querySelectorAll('.tlist button')].find((b) => b.textContent.includes('Helm')).click()`);
  await expect.poll(() => sr(page, `(R) => !!R.querySelector('.st.helm .hm-tt')`)).toBe(true);
  expect(await sr(page, `(R) => R.querySelector('.tlist')`)).toBe(null);
  expect(errors).toEqual([]);
});

test('themes option limits the menu; Escape closes it', async ({ page }) => {
  await load(page, { themes: ['streamer', 'helm'], remember_theme: false });
  await sr(page, `(R) => R.querySelector('.tbtn').click()`);
  expect(await sr(page, `(R) => R.querySelectorAll('.tlist button').length`)).toBe(2);
  await sr(page, `(R) => R.querySelector('.tlist button').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }))`);
  await expect.poll(() => sr(page, `(R) => R.querySelector('.tlist')`)).toBe(null);
});

test('Helm: transport, volume segments and library key work', async ({ page }) => {
  const errors = await load(page, { theme: 'helm', remember_theme: false });
  await expect(page.locator('hifi-music-player-card')).toContainText('BROTHERS IN ARMS');
  await clearCalls(page);
  await sr(page, `(R) => [...R.querySelectorAll('.hm-key')].find((b) => b.textContent.includes('NEXT')).click()`);
  // a real mouse click on the 12th of 24 segments (pointer events, not element.click())
  await page.locator('[data-vseg="11"]').click();
  await expect.poll(() => calls(page)).toEqual([
    ['media_player', 'media_next_track', { entity_id: 'media_player.wiim_pro_6a20' }],
    ['media_player', 'volume_set', { entity_id: 'media_player.wiim_pro_6a20', volume_level: 0.5 }],
  ]);
  await sr(page, `(R) => R.querySelector('.hm-lib').click()`);
  await expect.poll(() => sr(page, `(R) => !!R.querySelector('hifi-library').shadowRoot.querySelector('.mill')`)).toBe(true);
  expect(errors).toEqual([]);
});

for (const [w, sel] of [[720, '.cp.helm'], [400, '.mn.helm']] as const) {
  test(`Helm at ${w}px uses its own compact style`, async ({ page }) => {
    await load(page, { theme: 'helm', remember_theme: false }, w);
    await expect.poll(() => sr(page, `(R) => !!R.querySelector('${sel}')`)).toBe(true);
  });
}

test('Helm: dragging along the volume bar follows the pointer', async ({ page }) => {
  await load(page, { theme: 'helm', remember_theme: false });
  await clearCalls(page);
  const bar = await page.locator('.hm-vseg').boundingBox();
  await page.mouse.move(bar!.x + 5, bar!.y + bar!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar!.x + bar!.width * 0.74, bar!.y + bar!.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => calls(page)).toEqual([['media_player', 'volume_set', { entity_id: 'media_player.wiim_pro_6a20', volume_level: 0.75 }]]);
});

test('Helm: long titles wrap onto two lines and side blocks hide unknown values', async ({ page }) => {
  await load(page, { theme: 'helm', remember_theme: false });
  await page.evaluate(() => { const w = window as any, id = 'media_player.wiim_pro_6a20', st = w.hass.states[id];
    w.hass = { ...w.hass, states: { ...w.hass.states, [id]: { ...st, attributes: { ...st.attributes, media_title: 'Dostlar bizim halaya - come to dance with the whole village tonight' } } } }; w.el.hass = w.hass; });
  await expect.poll(() => sr(page, `(R) => { const t = R.querySelector('.hm-tt'); return t.classList.contains('two') && t.getBoundingClientRect().height > 50; }`)).toBe(true);
  const blocks = await sr(page, `(R) => [...R.querySelectorAll('.hm-blk')].map((b) => b.textContent.trim())`);
  expect(blocks[0]).toMatch(/01/);
  expect(blocks.slice(2)).toEqual(['', '', '']);
});
