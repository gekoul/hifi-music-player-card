const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 1100 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8790/test/harness.html?w=1200'); await p.waitForTimeout(600);
  const L = 'el.shadowRoot.querySelector("hifi-library").shadowRoot';
  await p.evaluate(`${L}.querySelector('.tog').click()`); await p.waitForTimeout(900);
  const click = (ci, txt) => p.evaluate(`[...${L}.querySelectorAll('.r[data-c="${ci}"]')].find((r) => r.textContent.includes(${JSON.stringify(txt)})).click()`);
  await click(0, 'Jellyfin · Folders'); await p.waitForTimeout(300); await click(1, 'Rock'); await p.waitForTimeout(300); await click(2, 'Dire Straits'); await p.waitForTimeout(300); await click(3, 'Brothers'); await p.waitForTimeout(400);
  const hdr = await p.evaluate(`[...${L}.querySelectorAll('.col')].slice(-1)[0].querySelector('.ch').innerText`);
  console.log('header:', hdr.replace(/\n/g, ' | '));
  await p.evaluate(`[...${L}.querySelectorAll('.col')].slice(-1)[0].querySelectorAll('.pa')[1].click()`); await p.waitForTimeout(300);
  await p.evaluate(`[...${L}.querySelectorAll('.col')].slice(-1)[0].querySelectorAll('.pa')[0].click()`); await p.waitForTimeout(300);
  console.log(JSON.stringify(await p.evaluate(() => calls.filter((c) => c[0] !== 'ws').map((c) => [c[0], c[1], c[2]]))));
  console.log('toast:', await p.evaluate(`${L}.querySelector('.toast')?.textContent`));
  await p.screenshot({ path: 'test/out/shuffle.png', clip: { x: 0, y: 470, width: 1250, height: 160 } });
  console.log('errors', errs); await b.close();
})();
