/**
 * 第二轮补图的验收截图
 * ------------------------------------------------------------------
 * 分别截取：
 *   1. 张良 —— 新补的《明人画张良像轴》（L1）
 *   2. 李渊 —— 新补的《唐高祖立像》轴（L1）
 *   3. 杨广 —— 新补的清刻《说唐演义全传》绣像（L2）
 *   4. 李斯 —— 仍无真图者，验证「图档检索结果」说明是否到位
 *   5. 画布全景 —— 确认新图已进主视图
 *
 * 用法：CHROME_EXE=<chrome 路径> node scripts/shots/round2-shot.mjs
 */
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('C:/Users/时嘉庆/.workbuddy/binaries/node/workspace/');
const puppeteer = require('puppeteer-core');

const ROOT = 'out';
const PORT = 4455;
const OUT = '.audit';
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

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('requestfailed', (r) => errors.push(`REQ FAIL ${r.url()}`));

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3500));
await page.screenshot({ path: `${OUT}/round2-canvas.png` });

/** 用检索面板定位某人，并切到「画像」页签 */
async function shotPerson(name, file) {
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => /检索/.test(x.textContent || ''));
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.type(name, { delay: 90 });
  await new Promise((r) => setTimeout(r, 1100));
  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 1800));

  const ok = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => /画像/.test(x.textContent || ''));
    if (b) {
      b.click();
      return true;
    }
    return false;
  });
  await new Promise((r) => setTimeout(r, 1400));
  await page.screenshot({ path: `${OUT}/${file}` });
  console.log(`  ${ok ? '✓' : '✗'} ${name} → ${file}`);

  // 关闭抽屉，回到画布，准备下一位
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 900));
}

for (const [name, file] of [
  ['张良', 'round2-zhangliang.png'],
  ['李渊', 'round2-liyuan.png'],
  ['杨广', 'round2-yangguang.png'],
  ['李斯', 'round2-lisi.png'],
]) {
  await shotPerson(name, file);
}

await browser.close();
server.close();
console.log(errors.length ? `\n控制台异常 ${errors.length} 条：\n${errors.slice(0, 10).join('\n')}` : '\n无控制台异常');
