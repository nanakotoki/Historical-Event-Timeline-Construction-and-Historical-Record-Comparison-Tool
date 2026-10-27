/**
 * 单片视觉验收（通用）：整库首屏 → 只留目标片 → 纪年泳道，共三张图。
 *
 * 用法：
 *   CHROME_EXE=<chrome> node scripts/shots/verify-shard.mjs 宋元明清
 *   CHROME_EXE=<chrome> node scripts/shots/verify-shard.mjs 新莽 4341
 *
 * 判据与 expansion-shot 一致：逼帧 → 等 canvas[data-intro=done] → 量墨量，空白抛错。
 * **人数断言从 manifest 读**，不写死在脚本里：写死的「含 47」这类探测，
 * 每加一批人就退化成永远返回 false 的僵尸判断（这个坑在 verify-live 里踩过一次）。
 *
 * 两个易错点，都在这里踩过：
 *  1. 卸片只能按 title 里的「点击加载/卸载」筛选——底部时间轴的朝代切片也是 button，
 *     其文案同样是「先秦」「三国」，按文案匹配会误点成纪年过滤。
 *  2. 泳道名是画在 canvas 上的，DOM 里读不到，只能出图人工比对；
 *     脚本只能保证「切换后画布确有重绘且未空白」。
 */
import http from 'node:http';
import { createReadStream, statSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/时嘉庆/.workbuddy/binaries/node/workspace/');
const puppeteer = require('puppeteer-core');

const ROOT = 'out';
const TARGET = process.argv[2];
const PORT = Number(process.argv[3] ?? 4341);
const OUT = 'C:/tmp/shots';
mkdirSync(OUT, { recursive: true });

if (!TARGET) {
  console.error('用法: node scripts/shots/verify-shard.mjs <分片简称，如 宋元明清> [端口]');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync('public/data/manifest.json', 'utf8'));
const targetShard = manifest.shards.find((s) => s.title.startsWith(TARGET));
if (!targetShard) {
  console.error(`manifest 里没有以「${TARGET}」开头的分片。可选：`);
  console.error(manifest.shards.map((s) => '  ' + s.title).join('\n'));
  process.exit(1);
}
const TAG = TARGET.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
console.log(`目标分片: ${targetShard.title} · ${targetShard.personCount} 人 / ${targetShard.edgeCount} 边`);

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
await page.screenshot({ path: `${OUT}/${TAG}-01-overview.png` });
const head = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 340));
console.log('整库首屏: ' + head);
console.log('整库墨量: ' + full.ink);

const unloaded = await page.evaluate((shardId) => {
  const clicked = [];
  for (const b of [...document.querySelectorAll('button')]) {
    if (b.dataset.shardId === undefined) continue;
    if (b.dataset.shardId === shardId) continue;
    b.click();
    clicked.push(b.dataset.shardId.replace('shard_', ''));
  }
  return clicked;
}, targetShard.shardId);
console.log('已卸载: ' + JSON.stringify(unloaded));

const solo = await waitCanvasSettled();
await page.screenshot({ path: `${OUT}/${TAG}-02-solo.png` });

const soloText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
console.log('单片墨量: ' + solo.ink);

/* 断言必须读右上的「可见 N/M」，不能拿全页文本 includes 一个数字：
   分片按钮上本来就印着人数，那种断言无论卸载对不对都会通过（实测踩过）。

   期望值也不能直接用 personCount 当分母：单片激活后时间窗收窄到该片的 yearRange，
   卒于起始年之前的人会被剔掉（两晋片的阮籍 263、嵇康 262 卒，就不在 265—589 里）。
   这里按前端的同一口径（birthYear ≤ end && deathYear ≥ start）自己算一遍，
   再要求「可见 = 可见总数 = 窗口内人数」——整片丢失、部分丢失、被 LOD 裁掉，三种都会失败。 */
const shardJson = JSON.parse(readFileSync(path.join('public/data/shards', targetShard.file), 'utf8'));
const [wStart, wEnd] = targetShard.yearRange;
const expectedInWindow = shardJson.nodes.filter((n) => {
  const birth = n.birthYear ?? -Infinity;
  const death = n.deathYear ?? Infinity;
  return birth <= wEnd && death >= wStart;
}).length;

const seen = soloText.match(/可见\s*(\d+)\s*\/\s*(\d+)/);
if (!seen) throw new Error('单片视图没读到「可见 N/M」，无法断言可见人数');
const [seenN, seenM] = [Number(seen[1]), Number(seen[2])];
if (seenN !== expectedInWindow || seenM !== expectedInWindow) {
  throw new Error(
    `单片可见人数不符：可见 ${seenN}/${seenM}，按 ${wStart}—${wEnd} 窗口应为 ${expectedInWindow}（片内共 ${shardJson.nodes.length} 人）`,
  );
}
if (!soloText.includes(String(manifest.stats.personCount))) {
  throw new Error(`单片视图缺全站在册人数 ${manifest.stats.personCount}`);
}
console.log(
  `✓ 单片可见 ${seenN}/${seenM} 人（片内 ${shardJson.nodes.length} 人，${expectedInWindow} 人落在 ${wStart}—${wEnd} 窗口内）· 全站 ${manifest.stats.personCount} 人`,
);

await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '纪年泳道');
  b?.click();
});
const lane = await waitCanvasSettled();
await page.screenshot({ path: `${OUT}/${TAG}-03-lanes.png` });
console.log('泳道视角墨量: ' + lane.ink);
console.log('console errors: ' + (errors.length ? JSON.stringify(errors.slice(0, 3)) : 'none'));
if (errors.length) throw new Error('控制台有错误');

await browser.close();
server.close();
