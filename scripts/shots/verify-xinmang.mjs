/**
 * 新莽分片验收：整库总档、以及只加载新莽一片时的独立视图。
 * 判据与 expansion-shot 一致：逼帧 → 等 canvas[data-intro=done] → 量墨量，空白抛错。
 */
import http from 'node:http';
import { createReadStream, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/时嘉庆/.workbuddy/binaries/node/workspace/');
const puppeteer = require('puppeteer-core');

const ROOT = 'out';
const PORT = 4341;
const OUT = 'C:/tmp/shots';
mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent((req.url ?? '/').split('?')[0]));
  try {
    if (statSync(file).isDirectory()) file = path.join(file, 'index.html');
    statSync(file);
  } catch {
    file = path.join(ROOT, 'index.html');
  }
  try {
    statSync(file);
  } catch {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const errors = [];
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_EXE,
  headless: true,
  args: ['--no-sandbox'],
  defaultViewport: { width: 1512, height: 950, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

async function waitCanvasSettled(budgetMs = 25000) {
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

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0', timeout: 90000 });

const full = await waitCanvasSettled();
await page.screenshot({ path: `${OUT}/xm-01-overview.png` });

const head = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 340));
console.log('整库首屏: ' + head);
console.log('整库墨量: ' + full.ink);

/* 只留新莽：把其余七片的胶囊逐个点掉。
   注意只能按 title 里的「点击加载/卸载」筛选——底部时间轴的朝代切片也是 button，
   其文案同样是「先秦」「三国」，按文案匹配会误点成纪年过滤（第一次跑就踩了）。 */
const unloaded = await page.evaluate(() => {
  const clicked = [];
  for (const b of [...document.querySelectorAll('button')]) {
    const t = b.textContent?.trim() ?? '';
    if (!(b.title ?? '').includes('点击加载/卸载')) continue;
    if (t.startsWith('新莽')) continue;
    b.click();
    clicked.push(t.slice(0, 4));
  }
  return clicked;
});
console.log('已卸载: ' + JSON.stringify(unloaded));

const solo = await waitCanvasSettled();
await page.screenshot({ path: `${OUT}/xm-02-solo.png` });

const soloText = await page.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g, ' ');
  return {
    head: t.slice(0, 200),
    has47: t.includes('47'),
    has877: t.includes('877'),
    shards: t.match(/先秦|楚汉|三国|两晋|隋唐|宋元明清|五代十国|新莽/g) ?? [],
  };
});
console.log('单片首屏: ' + soloText.head);
console.log('单片刻度墨量: ' + solo.ink);
console.log('单片含 47: ' + soloText.has47 + ' · 顶部总档 877: ' + soloText.has877);

/* 纪年泳道：泳道名是画在 canvas 上的，DOM 里读不到，只能出图人工比对。
   这里只保证「切换后画布确有重绘且未空白」，分组是否正确由看图确认。 */
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '纪年泳道');
  b?.click();
});
const lane = await waitCanvasSettled();
await page.screenshot({ path: `${OUT}/xm-03-lanes.png` });
console.log('泳道视角墨量: ' + lane.ink);
console.log('console errors: ' + (errors.length ? JSON.stringify(errors.slice(0, 3)) : 'none'));

await browser.close();
server.close();
