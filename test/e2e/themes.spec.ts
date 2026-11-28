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
  await sr(page, `(R) => R.querySelectorAll('[data-vseg]')[11].click()`);
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
