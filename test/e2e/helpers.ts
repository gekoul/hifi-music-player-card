import type { Page } from '@playwright/test';

export async function load(page: Page, cfg: Record<string, unknown> = {}, width = 1200) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/test/harness.html?w=${width}&cfg=${encodeURIComponent(JSON.stringify(cfg))}`);
  await page.waitForFunction(() => (window as any).el?.shadowRoot?.querySelector('ha-card'));
  return errors;
}
export const calls = (page: Page) => page.evaluate(() => (window as any).calls.filter((c: any[]) => c[0] !== 'ws').map((c: any[]) => [c[0], c[1], c[2]]));
export const clearCalls = (page: Page) => page.evaluate(() => { (window as any).calls.length = 0; });
/** Runs JS against the library drawer's shadow root. */
export const lib = <T>(page: Page, fn: string) => page.evaluate(`(() => { const L = el.shadowRoot.querySelector('hifi-library').shadowRoot; return (${fn})(L); })()`) as Promise<T>;
export async function openLibrary(page: Page) {
  await lib(page, `(L) => L.querySelector('.tog').click()`);
  await page.waitForFunction(() => (window as any).el.shadowRoot.querySelector('hifi-library').shadowRoot.querySelectorAll('.col .r').length > 3);
}
export async function clickRow(page: Page, col: number, text: string) {
  await lib(page, `(L) => [...L.querySelectorAll('.r[data-c="${col}"]')].find((r) => r.textContent.includes(${JSON.stringify(text)})).click()`);
  await page.waitForFunction((c) => (window as any).el.shadowRoot.querySelector('hifi-library').shadowRoot.querySelectorAll('.col').length > c + 1
    && !(window as any).el.shadowRoot.querySelector('hifi-library').shadowRoot.querySelector('.col:last-child .msg')?.textContent?.startsWith('Loading'), col);
}
export const lastCol = (page: Page) => lib<string>(page, `(L) => [...L.querySelectorAll('.col')].pop().innerText.split('\\n').filter(Boolean).join(' | ')`);
