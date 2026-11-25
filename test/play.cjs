const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 1200 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8790/test/harness.html?w=1200');
  await p.waitForTimeout(600);
  const lib = () => p.evaluate(() => el.shadowRoot.querySelector('hifi-library').shadowRoot);
  await p.evaluate(() => el.shadowRoot.querySelector('hifi-library').shadowRoot.querySelector('.tog').click());
  await p.waitForTimeout(500);
  // open Dire Straits (column 1, first row)
  await p.evaluate(() => el.shadowRoot.querySelector('hifi-library').shadowRoot.querySelector('.r[data-c="1"][data-r="0"]').click());
  await p.waitForTimeout(400);
  // play second track
  await p.evaluate(() => el.shadowRoot.querySelector('hifi-library').shadowRoot.querySelector('.r[data-c="2"][data-r="1"] .rp').click());
  await p.waitForTimeout(300);
  // play all
  await p.evaluate(() => el.shadowRoot.querySelector('hifi-library').shadowRoot.querySelectorAll('.col')[2].querySelector('.pa').click());
  await p.waitForTimeout(300);
  console.log(JSON.stringify(await p.evaluate(() => calls.filter((c) => c[0] !== 'ws').map((c) => [c[0], c[1], c[2]]))));
  await p.screenshot({ path: 'test/out/play.png' });
  // pick an output: Kitchen Echo, then volume up via keyboard
  await p.evaluate(() => { calls.length = 0; [...el.shadowRoot.querySelectorAll('.ob')].find((b) => b.textContent.includes('Kitchen')).click(); });
  await p.waitForTimeout(200);
  await p.evaluate(() => { const k = el.shadowRoot.querySelector('[data-vk]'); k.focus(); k.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true })); });
  await p.waitForTimeout(500);
  await p.evaluate(() => { el.shadowRoot.querySelector('.tb.big').click(); });
  console.log(JSON.stringify(await p.evaluate(() => calls.map((c) => [c[0], c[1], c[2]]))));
  const btns = await p.evaluate(() => [...el.shadowRoot.querySelectorAll('.tb')].map((b) => b.getAttribute('aria-label') || b.textContent.trim()));
  console.log('kitchen buttons', btns);
  // browser output: play a file
  await p.evaluate(() => { calls.length = 0; [...el.shadowRoot.querySelectorAll('.ob')].find((b) => b.textContent.includes('browser')).click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => el.shadowRoot.querySelector('hifi-library').shadowRoot.querySelector('.r[data-c="2"][data-r="0"] .rp').click());
  await p.waitForTimeout(600);
  console.log(JSON.stringify(await p.evaluate(() => calls.map((c) => [c[0], c[1]]))));
  console.log('toast', await p.evaluate(() => el.shadowRoot.querySelector('hifi-library').shadowRoot.querySelector('.toast')?.textContent));
  console.log('errors', errs);
  await b.close();
})();
