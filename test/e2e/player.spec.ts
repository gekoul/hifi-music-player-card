import { expect, test } from '@playwright/test';
import { calls, clearCalls, load } from './helpers';

test('renders both themes without errors', async ({ page }) => {
  const errors = await load(page, { theme: 'streamer', remember_theme: false });
  await expect(page.locator('hifi-music-player-card')).toContainText('Brothers in Arms');
  await page.evaluate(() => [...(window as any).el.shadowRoot.querySelectorAll('.thb')].find((b: any) => b.textContent.includes('CONSOLE')).click());
  await expect(page.locator('hifi-music-player-card')).toContainText('BROTHERS IN ARMS');
  await expect.poll(() => page.evaluate(() => (window as any).el.shadowRoot.querySelectorAll('[data-ndl]').length)).toBe(2);
  expect(errors).toEqual([]);
});

test('lists Music Assistant players and This browser', async ({ page }) => {
  await load(page);
  const names = await page.evaluate(() => [...(window as any).el.shadowRoot.querySelectorAll('.ob')].map((b: any) => b.textContent.trim()));
  expect(names).toEqual(['WiiM Attic', 'This browser']);
});

test('transport and volume call the right services', async ({ page }) => {
  await load(page);
  await clearCalls(page);
  await page.evaluate(() => (window as any).el.shadowRoot.querySelector('.tb.big').click());
  await page.evaluate(() => { const k = (window as any).el.shadowRoot.querySelector('[data-vk]'); k.focus(); k.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true })); });
  await expect.poll(() => calls(page)).toEqual([
    ['media_player', 'media_pause', { entity_id: 'media_player.wiim_pro_6a20' }],
    ['media_player', 'volume_set', { entity_id: 'media_player.wiim_pro_6a20', volume_level: 0.44 }],
  ]);
});

test('hides controls a player does not support', async ({ page }) => {
  await load(page, { discovery: { also: ['media_player.kitchen_echo'] } });
  await page.evaluate(() => [...(window as any).el.shadowRoot.querySelectorAll('.ob')].find((b: any) => b.textContent.includes('Kitchen')).click());
  const labels = await page.evaluate(() => [...(window as any).el.shadowRoot.querySelectorAll('.tb')].map((b: any) => b.getAttribute('aria-label')));
  expect(labels).toEqual(['Play']);
});

for (const [w, layout] of [[720, '.cp'], [400, '.mn']] as const) {
  test(`switches layout at ${w}px`, async ({ page }) => {
    await load(page, {}, w);
    await expect.poll(() => page.evaluate((s) => !!(window as any).el.shadowRoot.querySelector(s), layout)).toBe(true);
  });
}

test('shows Greek text when Home Assistant is in Greek', async ({ page }) => {
  await page.goto('/test/harness.html?w=1200&lang=el');
  await expect(page.locator('hifi-music-player-card')).toContainText('ΑΝΑΠΑΡΑΓΩΓΗ');
});
