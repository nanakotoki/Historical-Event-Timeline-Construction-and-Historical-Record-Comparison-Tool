/**
 * 线上验收：直接访问 GitHub Pages 地址，等画布画完再截图，并统计 4xx/5xx。
 */
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/时嘉庆/.workbuddy/binaries/node/workspace/');
const puppeteer = require('puppeteer-core');

const URL = 'https://nanakotoki.github.io/Historical-Event-Timeline-Construction-and-Historical-Record-Comparison-Tool/';

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_EXE,
  headless: true,
  args: ['--no-sandbox'],
  defaultViewport: { width: 1512, height: 950, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const errors = [];
const bad = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
page.on('response', (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 180000 });

async function waitCanvasSettled(budgetMs = 30000) {
  const t0 = Date.now();
  let last = -1;
  while (Date.now() - t0 < budgetMs) {
    await page.screenshot({ clip: { x: 0, y: 0, width: 1, height: 1 } });
    const st = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return { ready: false, ink: 0 };
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) ink++;
      return { ready: c.dataset.intro === 'done', ink };
    });
    if (st.ready && st.ink > 20000) return st;
    last = st.ink;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`画布未就绪，最后墨量 ${last}`);
}

const ink = await waitCanvasSettled();
await page.screenshot({ path: 'C:/tmp/shots/live-pages.png' });

const info = await page.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g, ' ');
  return { has824: t.includes('824'), head: t.slice(0, 120) };
});

console.log('墨量: ' + ink.ink);
console.log('标题段: ' + info.head);
console.log('出现 824: ' + info.has824);
console.log('console errors: ' + (errors.length ? JSON.stringify(errors.slice(0, 3)) : 'none'));
console.log('HTTP 4xx/5xx: ' + (bad.length ? JSON.stringify(bad.slice(0, 5)) : 'none'));

await browser.close();
