/**
 * 渲染压力自检台的「干净测量」：每测一档前重载页面，保证初始状态一致
 * ------------------------------------------------------------------
 * 起因：同一页面内连测两次 ×1，首测 125 FPS、复测 36.5 FPS，稳定复现。
 * 排查发现差异不在数据规模——bench 的 pathNodeIds 恒定非空，画布本应每帧全量重绘；
 * 首测偏高的那段很可能是画布尚未进入「流光持续重绘」的空转帧。
 * 故测量纪律改为：每档 reload 一次，只采信重载后的首测值。
 */
import http from 'node:http';
import { createReadStream, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/时嘉庆/.workbuddy/binaries/node/workspace/');
const puppeteer = require('puppeteer-core');

const ROOT = 'out';
const PORT = 4343;
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

const clickByText = (t) =>
  page.evaluate((txt) => {
    const el = [...document.querySelectorAll('button')].find((e) => e.textContent?.trim() === txt);
    if (el) {
      el.click();
      return true;
    }
    return false;
  }, t);

const results = [];
for (const mult of ['×1', '×3', '×5']) {
  await page.goto(`http://127.0.0.1:${PORT}/bench`, { waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 3500));
  const picked = await clickByText(mult);
  // 等布局算完：按钮从 disabled 变为可点即视为就绪
  await page
    .waitForFunction(
      () => {
        const b = [...document.querySelectorAll('button')].find((e) => e.textContent?.includes('开始采样'));
        return b && !b.disabled;
      },
      { timeout: 180000 },
    )
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 800));
  const started = await clickByText('开始采样');
  await new Promise((r) => setTimeout(r, 7000));
  const raw = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
  const pick = (label) => raw.match(new RegExp(`${label} \\| ([^|]+)`))?.[1]?.trim() ?? '?';
  const row = {
    mult,
    picked,
    started,
    nodes: pick('节点 / 关系'),
    layout: pick('力导向布局'),
    onScreen: pick('屏内节点'),
    fps: pick('平均帧率'),
    p95: pick('p95 帧间隔'),
    worst: pick('最慢一帧'),
  };
  results.push(row);
  console.log(`--- ${mult} ---`);
  console.log(JSON.stringify(row, null, 0));
  await page.screenshot({ path: `${OUT}/bench2-${mult.replace('×', 'x')}.png` });
}

await browser.close();
server.close();
console.log('\n汇总');
for (const r of results) {
  console.log(`${r.mult}\t${r.nodes}\t屏内 ${r.onScreen}\t${r.fps}\tp95 ${r.p95}\t布局 ${r.layout}`);
}
