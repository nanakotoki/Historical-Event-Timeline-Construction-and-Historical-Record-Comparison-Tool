#!/usr/bin/env node
/**
 * 布局 A/B 视觉对照
 * ------------------------------------------------------------------
 * 换算法最怕的不是慢，是「看不出来但已经不一样了」。`compare-layout.mjs`
 * 给的是数字（距离相关性 0.996），但数字再高也不如两张图叠在一起看。
 *
 * 这里把同一份数据跑两遍——旧的 O(n²) 精确斥力、新的四叉树近似——
 * 各画成一张同尺度、同配色的点线图，并列输出一张 PNG：
 *   左：精确（改造前）  右：四叉树 θ=0.85（改造后）
 * 两栏共用同一包围盒与同一缩放，所以簇的位置与松紧可以直接目视比对。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire('C:/Users/时嘉庆/.workbuddy/binaries/node/workspace/');
const puppeteer = require('puppeteer-core');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const TMP = path.join(ROOT, 'node_modules', '.seed-build');
const OUT = '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

const CHROME = process.env.CHROME_EXE ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function loadLayout() {
  fs.mkdirSync(TMP, { recursive: true });
  const entry = path.join(TMP, 'entry-ab.ts');
  const target = path.join(ROOT, 'src/lib/graph-layout.ts').replace(/\\/g, '/');
  fs.writeFileSync(entry, `export { computeForceLayout } from '${target}';\n`, 'utf8');
  const outfile = entry.replace(/\.ts$/, '.mjs');
  await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
}

function loadMerged() {
  const dir = path.join(ROOT, 'public/data/shards');
  const nodes = [];
  const edges = [];
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;
    const shard = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    nodes.push(...shard.nodes);
    edges.push(...shard.edges);
  }
  return { nodes, edges };
}

/** 每个朝代一个稳定色相，两栏配色一致才可比 */
function paletteOf(nodes) {
  const dynasties = [...new Set(nodes.map((n) => n.dynasty))].sort();
  const map = new Map();
  dynasties.forEach((d, i) => map.set(d, `hsl(${Math.round((i * 360) / dynasties.length)} 62% 52%)`));
  return map;
}

const W = 720;
const H = 400;

function panel(nodes, edges, pos, bounds, palette, title, sub) {
  // 两栏共用同一包围盒与缩放：否则一栏被放大、一栏被压缩，看起来的松紧就没意义
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  const s = Math.min(W / spanX, H / spanY);
  const ox = W / 2 - ((bounds.minX + bounds.maxX) / 2) * s;
  const oy = H / 2 - ((bounds.minY + bounds.maxY) / 2) * s;
  const px = (p) => `${(p.x * s + ox).toFixed(1)},${(p.y * s + oy).toFixed(1)}`;

  const lines = [];
  for (const e of edges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) continue;
    lines.push(`<line x1="${a.x * s + ox}" y1="${a.y * s + oy}" x2="${b.x * s + ox}" y2="${b.y * s + oy}" />`);
  }
  const dots = [];
  for (const n of nodes) {
    const p = pos.get(n.id);
    if (!p) continue;
    dots.push(`<circle cx="${(p.x * s + ox).toFixed(1)}" cy="${(p.y * s + oy).toFixed(1)}" r="1.7" fill="${palette.get(n.dynasty)}" />`);
  }

  return `<figure>
    <figcaption><b>${title}</b><span>${sub}</span></figcaption>
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="#fbfaf7" />
      <g stroke="#c9c4ba" stroke-width="0.35" opacity="0.5">${lines.join('')}</g>
      <g>${dots.join('')}</g>
    </svg>
  </figure>`;
}

const { computeForceLayout } = await loadLayout();
const { nodes, edges } = loadMerged();

const t0 = process.hrtime.bigint();
const exact = computeForceLayout(nodes, edges, { exactRepulsion: true });
const msExact = Number(process.hrtime.bigint() - t0) / 1e6;

const t1 = process.hrtime.bigint();
const approx = computeForceLayout(nodes, edges, { theta: 0.85 });
const msApprox = Number(process.hrtime.bigint() - t1) / 1e6;

const palette = paletteOf(nodes);
// 统一用精确布局的包围盒，两栏尺度因此完全一致
const b = exact.bounds;

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 18px; background: #f4f2ed; font: 13px/1.5 system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; color: #2a2723; width: ${W * 2 + 60}px; }
  h1 { font-size: 15px; margin: 0 0 4px; font-weight: 600; }
  .note { color: #6b655c; margin: 0 0 14px; font-size: 12px; }
  .row { display: flex; gap: 20px; }
  figure { margin: 0; }
  figcaption { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; font-size: 12px; }
  figcaption span { color: #6b655c; font-variant-numeric: tabular-nums; }
  svg { display: block; border: 1px solid #ddd8ce; border-radius: 4px; }
</style></head><body>
  <h1>力导向布局 A/B 对照 · ${nodes.length} 人 / ${edges.length} 边</h1>
  <p class="note">同一份数据、同一初始种子、同一套簇心与重力，唯一差别是斥力的求法。两栏共用同一包围盒与缩放，位置可直接目视比对。</p>
  <div class="row">
    ${panel(nodes, edges, exact.positions, b, palette, '改造前：两两精确 O(n²)', `${msExact.toFixed(0)} ms`)}
    ${panel(nodes, edges, approx.positions, b, palette, '改造后：四叉树 θ=0.85', `${msApprox.toFixed(0)} ms`)}
  </div>
</body></html>`;

const htmlPath = path.join(TMP, 'layout-ab.html');
fs.writeFileSync(htmlPath, html, 'utf8');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: W * 2 + 60, height: 520, deviceScaleFactor: 2 });
await page.goto(`${pathToFileURL(htmlPath).href}`, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 400));
const png = path.join(OUT, 'layout-ab.png');
await page.screenshot({ path: png, fullPage: true });
await browser.close();

console.log(`✓ 精确 ${msExact.toFixed(0)} ms · 四叉树 ${msApprox.toFixed(0)} ms`);
console.log(`✓ 对照图 ${png}`);
