/**
 * 画像人工核验对照表
 * ------------------------------------------------------------------
 * 抓取脚本只验证「Commons 上确有此题名的图片文件」，验证不了
 * 「图里画的确实是这个人」。题名可能挂错、可能是雕像照片、可能是
 * 影视剧照——这些都必须由人来过目。
 *
 * 本脚本把本轮抓到的缩略图拼成一张带姓名标注的对照表，
 * 一张图看完所有新图，避免几十次单图查看。
 *
 * 用法：node scripts/portraits/contact-sheet.mjs <id1,id2,...> [输出路径]
 */
import { readFile, readFileSync, statSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import http from 'node:http';
const require = createRequire('C:/Users/时嘉庆/.workbuddy/binaries/node/workspace/');
const puppeteer = require('puppeteer-core');

const ids = (process.argv[2] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const OUT = process.argv[3] ?? 'C:/tmp/shots/portrait-sheet.png';
const DIR = 'public/data/portraits';

if (!ids.length) {
  console.error('用法: node scripts/portraits/contact-sheet.mjs <id1,id2,...>');
  process.exit(1);
}

/** 记录每张图的字节大小与修改时间——抓取时间异常早的（比如复用了旧缓存）要多留个心眼 */
const rows = [];
for (const id of ids) {
  const thumb = path.join(DIR, `${id}.jpg`);
  if (!existsSync(thumb)) {
    rows.push({ id, missing: true });
    continue;
  }
  const st = statSync(thumb);
  const manifest = JSON.parse(readFileSync('scripts/portraits/manifest.json', 'utf8'));
  const entry = (manifest.entries ?? {})[id];
  rows.push({ id, thumb, bytes: st.size, mtime: st.mtime.toISOString().slice(0, 10), file: entry?.file ?? '?' });
}

/* 本地静态服务：img src 直接用 file:// 在部分 Chrome 配置下会被拦 */
const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(process.cwd(), decodeURIComponent((req.url ?? '').split('?')[0]));
  try {
    statSync(file);
  } catch {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  require('node:fs').createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const cells = rows
  .map((r) =>
    r.missing
      ? `<div class="cell miss"><div class="imgbox">无图</div><div class="cap">${r.id}</div></div>`
      : `<div class="cell"><div class="imgbox"><img src="http://127.0.0.1:${port}/${r.thumb}"></div>
         <div class="cap">${r.id}<br><span class="meta">${r.file}</span><br><span class="meta">${r.bytes} B · ${r.mtime}</span></div></div>`,
  )
  .join('\n');

const html = `<!doctype html><meta charset="utf-8">
<style>
  body { font: 12px/1.4 "Microsoft YaHei", sans-serif; background: #fff; margin: 10px; }
  .grid { display: grid; grid-template-columns: repeat(6, 200px); gap: 10px; }
  .cell { border: 1px solid #ccc; border-radius: 6px; overflow: hidden; }
  .miss { background: #fdd; text-align: center; color: #900; padding: 40px 0; }
  .imgbox { width: 200px; height: 200px; background: #f4f0e6; display: flex; align-items: center; justify-content: center; }
  img { max-width: 100%; max-height: 100%; }
  .cap { padding: 4px 6px; font-size: 11px; word-break: break-all; }
  .meta { color: #777; font-size: 10px; }
</style>
<div class="grid">${cells}</div>`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_EXE,
  headless: true,
  args: ['--no-sandbox'],
  defaultViewport: { width: 1300, height: 900, deviceScaleFactor: 1.5 },
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
server.close();
console.log('对照表已写出: ' + OUT);
