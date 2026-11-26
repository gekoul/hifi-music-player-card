const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 1100 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8790/test/harness.html?w=1200'); await p.waitForTimeout(600);
  const lib = () => 'el.shadowRoot.querySelector("hifi-library").shadowRoot';
  await p.evaluate(`${lib()}.querySelector('.tog').click()`); await p.waitForTimeout(900);
  const cols = () => p.evaluate(`[...${lib()}.querySelectorAll('.col')].map((c) => c.innerText.split('\\n').filter(Boolean).join(' | '))`);
  const click = (ci, txt) => p.evaluate(`[...${lib()}.querySelectorAll('.r[data-c="${ci}"]')].find((r) => r.textContent.includes(${JSON.stringify(txt)})).click()`);
  console.log('MA output:', (await cols())[0]);
  await p.evaluate(() => [...el.shadowRoot.querySelectorAll('.ob')].find((b) => b.textContent.includes('WiiM Kitchen')).click()); await p.waitForTimeout(700);
  console.log('WiiM Kitchen:', (await cols())[0]);
  await click(0, 'WiiM Kitchen'); await p.waitForTimeout(400);
  console.log('here col:', (await cols()).slice(1));
  await click(0, 'Plex'); await p.waitForTimeout(400);
  console.log('plex col:', (await cols()).slice(1));
  console.log('errors', errs); await b.close();
})();
