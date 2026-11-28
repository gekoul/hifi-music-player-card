import { test, expect } from '@playwright/test';
import { load, lib, openLibrary } from './helpers';

const toast = (page: any) => lib<string>(page, `(L) => L.querySelector('.toast')?.textContent || ''`);
const cur = (page: any) => page.evaluate(() => { const c = (window as any).__hifiWebPlayer.cur(); return c && { url: c.url, alt: c.alt, live: c.live, title: c.title }; });

async function openMaRadio(page: any) {
  await page.evaluate(() => [...(window as any).el.shadowRoot.querySelectorAll('.ob')].find((b: any) => b.textContent.includes('browser')).click());
  await openLibrary(page);
  await lib(page, `(L) => [...L.querySelectorAll('.r[data-c="0"]')].find((r) => r.innerText.split('\\n').map((x) => x.trim()).includes('Radio')).click()`);
  await page.waitForFunction(() => (window as any).el.shadowRoot.querySelector('hifi-library').shadowRoot.querySelector('.r[data-c="1"]')?.textContent.includes('Rock FM'));
}

test('Music Assistant radio plays on This browser through the station\'s own stream', async ({ page }) => {
  const asked: string[] = [];
  await page.route('https://*.api.radio-browser.info/**', (r) => {
    asked.push(r.request().url());
    return r.fulfill({ json: [
      { stationuuid: 'u1', name: 'Rock FM 96.9', url_resolved: 'http://stream.example/rock.mp3', favicon: 'https://img.example/rockfm969logo.png', votes: 900, lastcheckok: 1 },
      { stationuuid: 'u2', name: 'Rock FM 96.9', url_resolved: 'https://stream2.example/rock.aac', favicon: '', votes: 50, lastcheckok: 1 },
      { stationuuid: 'u3', name: 'Classic Rock Radio', url_resolved: 'https://other.example/x.mp3', votes: 5000, lastcheckok: 1 },
    ] });
  });
  const tried: string[] = [];
  await page.route(/(stream\d?|other)\.example\//, (r) => { tried.push(r.request().url()); return r.fulfill({ status: 404, body: '' }); });
  await load(page);
  await openMaRadio(page);
  await lib(page, `(L) => L.querySelector('.r[data-c="1"] .rp').click()`);
  await expect.poll(() => asked.length).toBeGreaterThan(0);
  expect(asked[0]).toContain('/json/stations/byname/Rock%20FM%2096.9');
  await expect.poll(() => page.evaluate(() => (window as any).__hifiWebPlayer.queue[0]?.title)).toBe('Rock FM 96.9');
  expect(await page.evaluate(() => (window as any).__hifiWebPlayer.queue[0].live)).toBe(true);
  // every address fails here: each is tried in turn (https first), then the card says so instead of staying silent
  await expect.poll(() => toast(page), { timeout: 20000 }).toContain('did not start');
  const uniq = [...new Set(tried)];
  expect(uniq[0]).toBe('https://stream2.example/rock.aac');
  expect(uniq).toContain('https://stream.example/rock.mp3');
  expect(uniq.join(' ')).not.toContain('other.example');
  expect(await cur(page)).toBeTruthy();
});

test('a station that is not found gives a clear message', async ({ page }) => {
  await page.route('https://*.api.radio-browser.info/**', (r) => r.fulfill({ json: [] }));
  await load(page);
  await openMaRadio(page);
  await lib(page, `(L) => L.querySelector('.r[data-c="1"] .rp').click()`);
  await expect.poll(() => toast(page)).toContain('no stream for this station');
});

test('a working station plays and shows as live', async ({ page }) => {
  // 3 s of a quiet tone as a WAV, standing in for the stream
  const rate = 8000, n = rate * 3, buf = new Uint8Array(44 + n * 2), v = new DataView(buf.buffer);
  const str = (o: number, x: string) => [...x].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(i / 8) * 2000), true);
  await page.route('https://*.api.radio-browser.info/**', (r) => r.fulfill({ json: [{ stationuuid: 'u1', name: 'Rock FM 96.9', url_resolved: 'https://stream.example/rock.wav', votes: 9, lastcheckok: 1 }] }));
  await page.route('https://stream.example/**', (r) => r.fulfill({ status: 200, contentType: 'audio/wav', body: buf as any }));
  await load(page);
  await openMaRadio(page);
  await lib(page, `(L) => L.querySelector('.r[data-c="1"] .rp').click()`);
  await expect.poll(() => page.evaluate(() => (window as any).__hifiWebPlayer.state().state), { timeout: 10000 }).toBe('playing');
  const st = await page.evaluate(() => (window as any).__hifiWebPlayer.state().attributes);
  expect(st.media_title).toBe('Rock FM 96.9');
  expect(st.media_artist).toBe('Live radio');
  await page.waitForTimeout(1500);
  expect(await toast(page)).not.toContain('did not start');
});
