/**
 * 渲染压力自检台实测：×3 与 ×7 两档，读回页面上的帧率统计
 * ------------------------------------------------------------------
 * 分片扩容后（三片共 444 人 / 781 边），×7 已是 3,108 人，
 * 远超规范要求的「500 节点以上守 60FPS」，故需重测一次。
 */
import http from 'node:http';
import { createReadStream, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/时嘉庆/.workbuddy/binaries/node/workspace/');
const puppeteer = require('puppeteer-core');

const ROOT = 'out';
const PORT = 4341;
const OUT = '/tmp/shots';
mkdirSync(OUT, { recursive: true });

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
  let file = path.join(ROOT, decodeURIComponent((req.url ?? '/').split('?')[0]));
  try {
    if (statSync(file).isDirectory()) file = path.join(file, 'index.html');
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

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_EXE,
  headless: true,
  args: ['--no-sandbox'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/bench`, { waitUntil: 'networkidle0', timeout: 90000 });
await new Promise((r) => setTimeout(r, 3000));

const clickByText = (txt) =>
  page.evaluate((t) => {
    const els = [...document.querySelectorAll('button')];
    const el = els.find((e) => e.textContent?.trim() === t);
    if (el) {
      el.click();
      return true;
    }
    return false;
  }, txt);

for (const [round, mult] of [['A', '×1'], ['A-again', '×1'], ['B-reload', '×1']]) {
  if (round === 'B-reload') {
    await page.reload({ waitUntil: 'networkidle0', timeout: 90000 });
    await new Promise((r) => setTimeout(r, 3500));
  }
  const ok = await clickByText(mult);
  console.log(`选择 ${mult}: ${ok}`);
  await new Promise((r) => setTimeout(r, 2500));
  const started = await clickByText('开始采样');
  console.log(`  开始采样: ${started}`);
  await new Promise((r) => setTimeout(r, 12000));
  const text = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
  console.log(`--- ${round} ${mult} 结果 ---`);
  console.log(text.slice(0, 700));
  await page.screenshot({ path: `${OUT}/bench-${mult.replace('×', 'x')}.png` });
}

await browser.close();
server.close();
