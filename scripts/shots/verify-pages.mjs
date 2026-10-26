/**
 * 部署前本地验收：把静态导出挂到 GitHub Pages 的真实子路径下，
 * 检查资源无 404、画布有墨、数据能取到。
 */
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/时嘉庆/.workbuddy/binaries/node/workspace/');
const puppeteer = require('puppeteer-core');

const ROOT = '.build';
const PREFIX = '/Historical-Event-Timeline-Construction-and-Historical-Record-Comparison-Tool';
const PORT = 4371;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (url === PREFIX) {
    res.writeHead(301, { location: PREFIX + '/' });
    res.end();
    return;
  }
  if (!url.startsWith(PREFIX + '/')) {
    res.writeHead(404);
    res.end('outside basePath');
    return;
  }
  let file = path.join(ROOT, url.slice(PREFIX.length));
  try {
    if (statSync(file).isDirectory()) file = path.join(file, 'index.html');
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
page.on('response', (r) => {
  if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
});
page.on('requestfailed', (r) => bad.push(`FAILED ${r.url()}`));

await page.goto(`http://127.0.0.1:${PORT}${PREFIX}/`, { waitUntil: 'networkidle0', timeout: 120000 });

/* 逼帧 + 等 data-intro=done + 量墨量，与 expansion-shot.mjs 同一判据 */
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
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`画布未就绪，最后墨量 ${last}`);
}

const ink = await waitCanvasSettled();
await page.screenshot({ path: 'C:/tmp/shots/pages-verify.png' });

const info = await page.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g, ' ');
  return {
    head: t.slice(0, 200),
    has824: t.includes('824'),
    shards: t.match(/先秦|楚汉|三国|两晋|隋唐|宋元明清|五代十国/g)?.slice(0, 12) ?? [],
  };
});

console.log('墨量: ' + ink.ink);
console.log('页面首段: ' + info.head);
console.log('出现 824: ' + info.has824);
console.log('分片标签: ' + JSON.stringify([...new Set(info.shards)]));
console.log('console errors: ' + (errors.length ? JSON.stringify(errors.slice(0, 3)) : 'none'));
console.log('HTTP 失败: ' + (bad.length ? JSON.stringify(bad.slice(0, 5)) : 'none'));

await browser.close();
server.close();
