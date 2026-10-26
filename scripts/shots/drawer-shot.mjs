/**
 * 人物档案抽屉的「画像」页签验收
 */
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/时嘉庆/.workbuddy/binaries/node/workspace/');
const puppeteer = require('puppeteer-core');

const ROOT = 'out';
const PORT = 4333;
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
  defaultViewport: { width: 1512, height: 950, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));

// 用检索面板选中曹操（比在画布上猜坐标可靠）
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => /检索/.test(x.textContent || ''));
  b?.click();
});
await new Promise((r) => setTimeout(r, 700));
await page.keyboard.type('曹操', { delay: 60 });
await new Promise((r) => setTimeout(r, 900));
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: '/tmp/shot-drawer-1.png' });

// 切到最后一个页签（画像）
const tabs = await page.$$('button[role="tab"], [data-tab]');
const labels = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim()).filter(Boolean).slice(0, 40),
);
console.log('buttons:', labels.join(' | '));

const ok = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find((x) => /画像/.test(x.textContent || ''));
  if (b) { b.click(); return true; }
  return false;
});
console.log('切换到画像页签:', ok);
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: '/tmp/shot-drawer-2.png' });

await browser.close();
server.close();
console.log('ok');
