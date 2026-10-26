/**
 * 扩容后的视觉验收：首屏、分片切换、简目人物档案页
 */
import http from 'node:http';
import { createReadStream, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/时嘉庆/.workbuddy/binaries/node/workspace/');
const puppeteer = require('puppeteer-core');

const ROOT = 'out';
const PORT = 4339;
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

const errors = [];
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_EXE,
  headless: true,
  args: ['--no-sandbox'],
  defaultViewport: { width: 1512, height: 950, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

/**
 * 等到画布「真的画完」再截图。
 *
 * 踩过的坑：无头浏览器会节流 requestAnimationFrame，整页常常只画出**一帧**。
 * 而入场动画（720ms 渐显 + 按权重错峰）若赶在这唯一一帧启动阶段，
 * 每个节点都会因 `appear <= 0` 被 continue 掉，截出来就是一张近乎空白的画布——
 * 之前那张「切到宋元明清后全空」的图就是这么来的，跟相机适配没有关系。
 *
 * 所以：① 反复触发合成帧（每次 screenshot 会逼出一个 BeginFrame），
 * ② 认 canvas 上的 data-intro="done"（draw() 在 intro>=1 时置位），
 * ③ 最后量一次墨量，空白直接判失败，不再让坏图悄悄通过。
 */
async function waitCanvasSettled(label, budgetMs = 20000) {
  const t0 = Date.now();
  let last = -1;
  while (Date.now() - t0 < budgetMs) {
    // 逼帧：一张 1px 的截图足够引发合成，不必整屏重画
    await page.screenshot({ clip: { x: 0, y: 0, width: 1, height: 1 } });
    const state = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { ready: false, ink: 0 };
      const ctx = canvas.getContext('2d');
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let ink = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 8) ink++;
      return { ready: canvas.dataset.intro === 'done', ink };
    });
    if (state.ready && state.ink > 20000) {
      console.log(`  画布就绪（${label}）：墨量 ${state.ink}，耗时 ${Date.now() - t0}ms`);
      return state;
    }
    if (state.ready && state.ink === last) {
      console.log(`  ⚠ 画布已就绪但墨量偏低（${label}）：${state.ink}，仍继续`);
      return state;
    }
    last = state.ink;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`画布 ${budgetMs}ms 内未完成绘制：${label}`);
}

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0', timeout: 90000 });
await waitCanvasSettled('首屏六片');
await page.screenshot({ path: `${OUT}/01-overview.png` });

/* 页面上的文字摘要：确认统计数已刷新到 785 */
const summary = await page.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g, ' ');
  return {
    head: t.slice(0, 500),
    has785: t.includes('785'),
    shardNames: t.match(/先秦|楚汉|三国|两晋|隋唐|宋元明清/g)?.slice(0, 14) ?? [],
  };
});
console.log('页面首段文字: ' + summary.head.slice(0, 300));
console.log('出现「785」: ' + summary.has785);
if (!summary.has785) throw new Error('顶栏统计未刷到 785 人，分片未全量加载');
console.log('分片名出现次数: ' + JSON.stringify(summary.shardNames));

/* 切到楚汉分片：点分片标签 */
const shardClick = await page.evaluate(() => {
  const els = [...document.querySelectorAll('button, [role="tab"], a, div')];
  const target = els.find((e) => e.textContent?.trim().startsWith('宋元明清'));
  if (target) {
    target.click();
    return target.tagName + ':' + target.textContent?.trim();
  }
  return null;
});
console.log('点击「宋元明清」分片标签: ' + shardClick);
await waitCanvasSettled('卸载宋元明清后');
await page.screenshot({ path: `${OUT}/02-song.png` });

/* 分片标签是「加载/卸载」切换：刚才是卸载，再点一次装回去，
   否则下面的检索会搜不到两晋人物——这个坑第一次跑时踩过。 */
await page.evaluate(() => {
  const els = [...document.querySelectorAll('button')];
  els.find((e) => e.textContent?.trim().startsWith('宋元明清'))?.click();
});
await waitCanvasSettled('装回宋元明清后');

/* 打开检索，搜一位新增简目人物「王羲之」 */
await page.keyboard.down('Control');
await page.keyboard.press('KeyK');
await page.keyboard.up('Control');
await new Promise((r) => setTimeout(r, 900));
await page.keyboard.type('苏轼', { delay: 80 });
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${OUT}/03-search.png` });

const hit = await page.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g, ' ');
  const i = t.indexOf('苏轼');
  return i >= 0 ? t.slice(Math.max(0, i - 60), i + 160) : null;
});
console.log('检索命中片段: ' + (hit ?? '未命中'));

/* 点第一条结果，看档案页 */
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 2600));
await page.screenshot({ path: `${OUT}/04-drawer.png` });

const drawer = await page.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g, ' ');
  return {
    hasBrief: t.includes('简目'),
    hasChapter: /《宋史》|《元史》|《明史》|《清史稿》/.test(t),
    snippet: t.slice(0, 600),
  };
});
console.log('档案页含「简目」档位声明: ' + drawer.hasBrief);
console.log('档案页引到《宋史》/《元史》/《明史》/《清史稿》卷次: ' + drawer.hasChapter);
console.log('档案页首段: ' + drawer.snippet.slice(0, 260));

/* 画像是否加载 */
const imgs = await page.evaluate(() =>
  performance
    .getEntriesByType('resource')
    .filter((e) => e.name.includes('/data/portraits/'))
    .map((e) => e.name.split('/').pop()),
);
console.log('已请求画像资源 ' + imgs.length + ' 个: ' + imgs.slice(0, 6).join(', '));

await browser.close();
server.close();
console.log('console errors: ' + (errors.length ? JSON.stringify(errors.slice(0, 6)) : 'none'));
