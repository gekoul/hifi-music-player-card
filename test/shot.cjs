const { chromium } = require('playwright');
(async () => {
const [,, name, w, cfg = '{}', act = ''] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w + 32, height: 1200 }, deviceScaleFactor: 1 });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://localhost:8790/test/harness.html?w=${w}&cfg=${encodeURIComponent(cfg)}`);
await p.waitForTimeout(800);
if (act) { await p.evaluate(act); await p.waitForTimeout(900); }
await p.screenshot({ path: `test/out/${name}.png`, fullPage: true });
console.log(name, 'errors:', errs.length ? errs : 'none');
console.log(JSON.stringify(await p.evaluate(() => window.calls.filter((c) => c[0] !== 'ws').slice(-5))));
await b.close();
})();
