const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 1100 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8790/test/harness.html?w=1200');
  await p.waitForTimeout(600);
  const L = 'el.shadowRoot.querySelector("hifi-library").shadowRoot';
  await p.evaluate(`${L}.querySelector('.tog').click()`); await p.waitForTimeout(800);
  console.log(await p.evaluate(`[...${L}.querySelectorAll('.col')].map((c) => c.querySelector('.ct').textContent + ': ' + [...c.querySelectorAll('.rn,.hd')].map((r) => r.textContent).join(' | '))`));
  // open first dir (9910 Hellas? sorted) -> Rock -> Dire Straits -> Brothers
  const open = async (ci, txt) => { await p.evaluate(`[...${L}.querySelectorAll('.r[data-c="${ci}"]')].find((r) => r.textContent.includes('${txt}')).click()`); await p.waitForTimeout(400); };
  await open(0, 'Jellyfin · Folders'); await open(1, 'Rock'); await open(2, 'Dire Straits'); await open(3, 'Brothers');
  console.log(await p.evaluate(`[...${L}.querySelectorAll('.col')].slice(-1).map((c) => c.querySelector('.ct').textContent + ': ' + [...c.querySelectorAll('.rn')].map((r) => r.textContent).join(' | ') + (c.querySelector('.pa') ? ' [PLAY ALL]' : ''))`));
  await p.evaluate(`[...${L}.querySelectorAll('.col')].slice(-1)[0].querySelector('.pa').click()`); await p.waitForTimeout(300);
  await p.evaluate(`[...${L}.querySelectorAll('.col')].slice(-1)[0].querySelectorAll('.r')[1].querySelector('.rp').click()`); await p.waitForTimeout(300);
  console.log(JSON.stringify(await p.evaluate(() => calls.filter((c) => c[0] !== 'ws').map((c) => [c[0], c[1], c[2]]))));
  await p.screenshot({ path: 'test/out/jh.png' });
  console.log('errors', errs);
  await b.close();
})();
