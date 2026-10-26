/**
 * 第三轮（人物简目扩容）验收截图
 * ------------------------------------------------------------------
 * 看点：
 *   1. 画布全景 —— 三国簇从 36 人扩到 156 人后的密度
 *   2. 张昭 —— 简目人物，档案页须显示「简目」档位声明与传目
 *   3. 诸葛诞 —— 简目人物，且与既有节点有多条简目连线
 *   4. 邓艾 —— 简目人物，验证年表与因缘
 *
 * 用法：CHROME_EXE=<chrome 路径> node scripts/shots/round3-shot.mjs
 */
import http from 'node:http';
import { statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('C:/Users/时嘉庆/.workbuddy/binaries/node/workspace/');
const puppeteer = require('puppeteer-core');

const ROOT = 'out';
const PORT = 4456;
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
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
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
await new Promise((r) => setTimeout(r, 4000));
await page.screenshot({ path: `${OUT}/round3-canvas.png` });

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
  await new Promise((r) => setTimeout(r, 1200));
  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: `${OUT}/${file}` });
  console.log(`  ✓ ${name} → ${file}`);
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 900));
}

for (const [name, file] of [
  ['张昭', 'round3-zhangzhao.png'],
  ['诸葛诞', 'round3-zhugedan.png'],
  ['邓艾', 'round3-dengai.png'],
]) {
  await shotPerson(name, file);
}

await browser.close();
server.close();
console.log(errors.length ? `\n控制台异常 ${errors.length} 条：\n${errors.slice(0, 10).join('\n')}` : '\n无控制台异常');
