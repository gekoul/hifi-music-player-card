import { expect, test } from '@playwright/test';
import { calls, clearCalls, clickRow, lib, load, openLibrary } from './helpers';

for (const accent of ['var(--primary-color)', 333333, 'not-a-colour']) {
  test(`unusual accent ${JSON.stringify(accent)} does not break drawing`, async ({ page }) => {
    const errors = await load(page, { accent, spectrum_colors: ['#00ff00', 'bogus'] });
    await page.waitForTimeout(600);
    expect(errors).toEqual([]);
    await expect(page.locator('hifi-music-player-card')).toContainText('Brothers in Arms');
  });
}

test('an output row without an entity (editor mid-edit) is ignored', async ({ page }) => {
  const errors = await load(page, { outputs: [{ entity: 'media_player.kitchen_echo' }, { entity: '' }] });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => (window as any).el.shadowRoot.querySelectorAll('.ob').length)).toBe(1);
});

test('output_helper does not undo a pick it cannot store', async ({ page }) => {
  await load(page, { output_helper: 'input_select.music_output' });
  await page.evaluate(() => [...(window as any).el.shadowRoot.querySelectorAll('.ob')].find((b: any) => b.textContent.includes('browser')).click());
  // an unrelated state change arrives
  await page.evaluate(() => { const w = window as any; w.el.hass = { ...w.hass, states: { ...w.hass.states, 'sensor.x': { entity_id: 'sensor.x', state: '1', attributes: {} } } }; });
  await page.waitForTimeout(200);
  const on = await page.evaluate(() => (window as any).el.shadowRoot.querySelector('.ob.on')?.textContent.trim());
  expect(on).toBe('This browser');
});

test('Enter on the add-to-queue button queues instead of playing', async ({ page }) => {
  await load(page);
  await openLibrary(page);
  await clickRow(page, 1, 'Dire Straits');
  await clearCalls(page);
  await lib(page, `(L) => { const b = L.querySelector('.r[data-c="2"][data-r="1"] .rq:last-of-type'); b.focus(); b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })); b.click(); }`);
  await expect.poll(() => calls(page)).toEqual([
    ['media_player', 'play_media', { entity_id: 'media_player.wiim_pro_6a20', media_content_id: 'ms/ds/2', media_content_type: 'audio/mpeg', enqueue: 'add' }],
  ]);
});

test('a folder opened once is not fetched twice', async ({ page }) => {
  await load(page);
  await openLibrary(page);
  await page.evaluate(() => { (window as any).calls.length = 0; });
  await clickRow(page, 1, 'Dire Straits');
  await page.waitForTimeout(300);
  const n = await page.evaluate(() => (window as any).calls.filter((c: any[]) => c[1] === 'media_source/browse_media' && c[2].media_content_id === 'ms/ds').length);
  expect(n).toBe(1);
});

test('mini dialog is a modal that closes with Escape', async ({ page }) => {
  await load(page, {}, 400);
  await page.evaluate(() => (window as any).el.shadowRoot.querySelector('.mn-open').click());
  await expect.poll(() => page.evaluate(() => (window as any).el.shadowRoot.querySelector('[role=dialog][aria-modal=true]') !== null)).toBe(true);
  await page.evaluate(() => (window as any).el.shadowRoot.querySelector('.dlg-x').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true })));
  await expect.poll(() => page.evaluate(() => (window as any).el.shadowRoot.querySelector('.dlg'))).toBe(null);
});
