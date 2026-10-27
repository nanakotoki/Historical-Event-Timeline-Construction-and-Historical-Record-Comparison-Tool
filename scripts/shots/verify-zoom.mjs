/**
 * 缩放能力验收：从整库全景一路滚到最大倍率，逐档存证。
 *
 * 用法：
 *   CHROME_EXE=<chrome> node scripts/shots/verify-zoom.mjs [端口]
 *
 * 为什么单独写一个脚本：
 *   别的截图脚本只验「画面非空」，验不出「放大上限够不够」。
 *   这一支直接往画布上打真实滚轮事件（page.mouse.wheel，走 CDP 的
 *   Input.dispatchMouseEvent，不是 JS 合成的假事件），再从右上角的
 *   「缩放 x.xx×」读数里取真值——**读界面，不读内部变量**，
 *   免得将来改实现时断言还在对着一个已经不存在的字段自说自话。
 *
 * 判据：
 *   1. 最大倍率必须 ≥ 10×（旧实现在 3.6× 就顶死，滚轮滚到底也认不出人）；
 *   2. 每一档画面墨量必须为正且不塌成空白；
 *   3. 控制台零错误——滚轮监听若退回 React 的被动委托，
 *      preventDefault 会抛 "Unable to preventDefault inside passive event listener"，
 *      这条断言就是那道闸。
 */
import http from 'node:http';
import { createReadStream, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/时嘉庆/.workbuddy/binaries/node/workspace/');
const puppeteer = require('puppeteer-core');

const ROOT = 'out';
const PORT = Number(process.argv[2] ?? 4355);
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

/** 画布墨量 + 就绪标记 */
async function probe() {
  return page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return { ready: false, ink: 0, scale: 0 };
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) ink++;
    const m = document.body.innerText.match(/缩放\s*([\d.]+)×/);
    return { ready: c.dataset.intro === 'done', ink, scale: m ? Number(m[1]) : 0 };
  });
}

async function waitSettled(minInk = 20000, budgetMs = 30000) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < budgetMs) {
    // 逼帧：无头下 rAF 会被节流，1px 截图能触发一次 BeginFrame
    await page.screenshot({ clip: { x: 0, y: 0, width: 1, height: 1 } });
    const st = await probe();
    if (st.ready && st.ink >= minInk) {
      // 再确认一次，避免拍到补间动画的中间帧
      await page.screenshot({ clip: { x: 0, y: 0, width: 1, height: 1 } });
      const again = await probe();
      if (Math.abs(again.ink - st.ink) < Math.max(40, st.ink * 0.02)) return again;
    }
    last = st;
    await new Promise((r) => setTimeout(r, 220));
  }
  throw new Error(`画布未稳定，最后墨量 ${last?.ink}（要求 ≥ ${minInk}）`);
}

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0', timeout: 90000 });
const fit = await waitSettled();
await page.screenshot({ path: `${OUT}/zoom-01-fit.png` });
console.log(`全景  倍率 ${fit.scale}×  墨量 ${fit.ink}`);

/* 把鼠标挪到画面中心，滚轮以光标为锚——锚点就是之后被「凑近看」的那个人 */
const box = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const r = c.getBoundingClientRect();
  return { x: r.left + r.width * 0.52, y: r.top + r.height * 0.46 };
});
await page.mouse.move(box.x, box.y);

/** 连打滚轮直到倍率达到 target 或打满 maxSteps */
async function zoomTo(target, maxSteps = 40) {
  let st = await probe();
  for (let i = 0; i < maxSteps && st.scale < target * 0.995; i += 1) {
    await page.mouse.wheel({ deltaY: -240 });
    await new Promise((r) => setTimeout(r, 90));
    st = await probe();
    if (st.scale <= 0) throw new Error('读数里没有「缩放 x.xx×」，界面结构可能变了');
  }
  return st;
}

const stages = [
  { key: '02-mid', target: 1.0, shot: 'zoom-02-1x.png', lane: 1 },
  { key: '03-oldcap', target: 3.6, shot: 'zoom-03-old-cap-3.6x.png', lane: 1 },
  { key: '04-deep', target: 6.0, shot: 'zoom-04-6x.png', lane: 1 },
  { key: '05-max', target: 12, shot: 'zoom-05-max.png', lane: 1 },
];

let maxScale = fit.scale;
for (const s of stages) {
  const st = await zoomTo(s.target);
  const settled = await waitSettled(1200);
  await page.screenshot({ path: `${OUT}/${s.shot}` });
  maxScale = Math.max(maxScale, settled.scale);
  const visible = await page.evaluate(() => {
    const m = document.body.innerText.match(/可见\s*(\d+)\/(\d+)/);
    return m ? Number(m[1]) : -1;
  });
  console.log(`${s.key}  倍率 ${settled.scale}×  墨量 ${settled.ink}  可见 ${visible} 人`);
}

/* 画布中心是否真有人在画面里：中心 3×3 采样点全透明 → 这个倍率下对着空气 */
const centerHit = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const g = c.getContext('2d');
  const dpr = c.width / c.clientWidth;
  const cx = Math.floor(c.width * 0.52);
  const cy = Math.floor(c.height * 0.46);
  let solid = 0;
  for (let dx = -6; dx <= 6; dx += 3) {
    for (let dy = -6; dy <= 6; dy += 3) {
      const p = g.getImageData(cx + dx * dpr, cy + dy * dpr, 1, 1).data;
      if (p[3] > 40) solid += 1;
    }
  }
  return solid;
});

console.log('光标锚点处不透明采样点: ' + centerHit + '/25');
console.log('console errors: ' + (errors.length ? JSON.stringify(errors.slice(0, 3)) : 'none'));

const failures = [];
if (maxScale < 10) failures.push(`最大倍率仅 ${maxScale}×，未达 10×`);
if (errors.length) failures.push('控制台有错误');
if (centerHit < 8) failures.push('最大倍率下光标处几乎是空白，等于没放大到人身上');

await browser.close();
server.close();

if (failures.length) {
  console.error('✗ ' + failures.join('；'));
  process.exit(1);
}
console.log(`✓ 最大 ${maxScale}×，光标处有实体节点，可凑近辨认`);
