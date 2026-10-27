/**
 * 线上验收：直接访问 GitHub Pages 地址，等画布画完再截图，并统计 4xx/5xx。
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('C:/Users/时嘉庆/.workbuddy/binaries/node/workspace/');
const puppeteer = require('puppeteer-core');

const URL = 'https://nanakotoki.github.io/Historical-Event-Timeline-Construction-and-Historical-Record-Comparison-Tool/';

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
page.on('response', (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));

/**
 * 不要用 networkidle0 判「加载完成」：首屏会预取近千张画像 SVG，
 * 线上链路下连接池几乎一直有活动请求，500ms 内零连接的窗口可能根本不出现——
 * 实测 180s 直接超时，而站点本身 0.8s 就返回 200。
 * 真正的就绪判据只有一个：画布画出 intro=done 且墨量够（见 waitCanvasSettled）。
 */
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });

async function waitCanvasSettled(budgetMs = 60000) {
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

const ink = await waitCanvasSettled();
await page.screenshot({ path: 'C:/tmp/shots/live-pages.png' });

/* 断言口径从「本地 public/data/manifest.json」取，不写死在脚本里。
   原先这里写的是 `has824`（探页面是否残留上一版的旧统计），
   这种写法每加一批人就退化成一个只会返回 false 的僵尸判断——
   所以改成读真值：页面上的在册人数、关系条数必须与本地产物一致。 */
const manifest = JSON.parse(readFileSync('public/data/manifest.json', 'utf8'));
const expectPersons = String(manifest.stats.personCount);
const expectEdges = String(manifest.stats.edgeCount);
const expectShards = String(manifest.stats.shardCount);

const info = await page.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g, ' ');
  return { text: t, head: t.slice(0, 120) };
});

console.log('墨量: ' + ink.ink);
console.log('标题段: ' + info.head);
console.log(`本地期望: ${expectPersons} 人 / ${expectEdges} 条 / ${expectShards} 片`);

const missing = [
  ['在册人数', expectPersons],
  ['关系条数', expectEdges],
].filter(([, v]) => !info.text.includes(v));
if (missing.length) {
  throw new Error(`页面统计与本地产物不一致，缺: ${missing.map(([k, v]) => `${k} ${v}`).join('、')}`);
}

console.log('console errors: ' + (errors.length ? JSON.stringify(errors.slice(0, 3)) : 'none'));
console.log('HTTP 4xx/5xx: ' + (bad.length ? JSON.stringify(bad.slice(0, 5)) : 'none'));
if (errors.length || bad.length) throw new Error('线上存在控制台错误或 HTTP 失败');

await browser.close();
