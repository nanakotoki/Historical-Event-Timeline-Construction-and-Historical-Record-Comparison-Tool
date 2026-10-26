#!/usr/bin/env node
/**
 * 布局一致性对照（A/B）
 * ------------------------------------------------------------------
 * `src/lib/barnes-hut.ts` 是近似算法，快 36 倍是好事，但**近似必须不改变图的样子**。
 * 这个脚本把同一份数据跑两遍——一遍旧的 O(n²) 精确斥力，一遍四叉树近似——
 * 然后比三件事：
 *
 *  1. 邻近距离相关性：抽样若干对节点，看「两套坐标下的距离」在对数尺度上是否同向。
 *     相关系数接近 1，说明谁离谁近这件事没被近似改掉。
 *  2. 边的平均长度与中位数：反映簇的松紧是否一致。
 *  3. 最近邻距离的最小值：检测有没有节点被挤到重叠。
 *
 * 另有按「时代列」的包围盒，检查各簇是否仍然各自成团、没有糊成一片。
 *
 * 用法：
 *   node scripts/compare-layout.mjs            # 642 人基准
 *   node scripts/compare-layout.mjs --sample 4000
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TMP = path.join(ROOT, 'node_modules', '.seed-build');

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const SAMPLE = Number(flag('sample', 3000));
const THETA = Number(flag('theta', 0.85));

async function loadLayout() {
  fs.mkdirSync(TMP, { recursive: true });
  const entry = path.join(TMP, 'entry-compare.ts');
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

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function edgeStats(nodes, edges, pos) {
  const lens = [];
  for (const e of edges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) continue;
    lens.push(dist(a, b));
  }
  lens.sort((x, y) => x - y);
  const mean = lens.reduce((s, v) => s + v, 0) / Math.max(1, lens.length);
  return { mean, median: lens[Math.floor(lens.length / 2)] ?? 0, count: lens.length };
}

/** 最近邻：抽样部分节点，取它们到最近另一个节点的距离，报告最小与中位 */
function nearestNeighbor(nodes, pos, take = 220) {
  const pts = [...pos.values()];
  const step = Math.max(1, Math.floor(pts.length / take));
  const mins = [];
  for (let i = 0; i < pts.length; i += step) {
    let best = Infinity;
    for (let j = 0; j < pts.length; j += 1) {
      if (i === j) continue;
      const d = dist(pts[i], pts[j]);
      if (d < best) best = d;
    }
    if (Number.isFinite(best)) mins.push(best);
  }
  mins.sort((a, b) => a - b);
  return { min: mins[0] ?? 0, median: mins[Math.floor(mins.length / 2)] ?? 0 };
}

/** 抽样节点对，比较两套坐标下距离的对数相关性（Pearson） */
function distanceCorrelation(nodes, pa, pb, sample) {
  const ids = nodes.map((n) => n.id).filter((id) => pa.has(id) && pb.has(id));
  const rnd = mulberry32(20261025);
  const xs = [];
  const ys = [];
  for (let k = 0; k < sample; k += 1) {
    const i = Math.floor(rnd() * ids.length);
    const j = Math.floor(rnd() * ids.length);
    if (i === j) continue;
    const da = dist(pa.get(ids[i]), pa.get(ids[j]));
    const db = dist(pb.get(ids[i]), pb.get(ids[j]));
    if (da < 1 || db < 1) continue;
    xs.push(Math.log(da));
    ys.push(Math.log(db));
  }
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  return { r: num / Math.sqrt(dx * dy), pairs: n };
}

/** 固定种子，保证每次抽样相同 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const { computeForceLayout } = await loadLayout();
const { nodes, edges } = loadMerged();

console.log(`数据：${nodes.length} 人 / ${edges.length} 边\n`);

const t0 = process.hrtime.bigint();
const exact = computeForceLayout(nodes, edges, { exactRepulsion: true });
const msExact = Number(process.hrtime.bigint() - t0) / 1e6;

const t1 = process.hrtime.bigint();
const approx = computeForceLayout(nodes, edges, { theta: THETA });
const msApprox = Number(process.hrtime.bigint() - t1) / 1e6;

const ea = edgeStats(nodes, edges, exact.positions);
const eb = edgeStats(nodes, edges, approx.positions);
const na = nearestNeighbor(nodes, exact.positions);
const nb = nearestNeighbor(nodes, approx.positions);
const corr = distanceCorrelation(nodes, exact.positions, approx.positions, SAMPLE);

const pct = (a, b) => `${(((b - a) / a) * 100).toFixed(1)}%`;
const row = (label, a, b, unit = '') =>
  `  ${label.padEnd(16)} ${String(a.toFixed(1) + unit).padStart(12)} ${String(b.toFixed(1) + unit).padStart(12)} ${pct(a, b).padStart(9)}`;

console.log(`                          精确 O(n²)   四叉树 θ=${THETA}       变化`);
console.log(row('布局耗时', msExact, msApprox, ' ms'));
console.log(row('平均边长', ea.mean, eb.mean));
console.log(row('边长中位数', ea.median, eb.median));
console.log(row('最近邻最小值', na.min, nb.min));
console.log(row('最近邻中位数', na.median, nb.median));
console.log(`\n  距离相关性（对数尺度，抽样 ${corr.pairs} 对）：r = ${corr.r.toFixed(4)}`);
console.log(`  包围盒  精确：${fmtBox(exact.bounds)}\n          四叉树：${fmtBox(approx.bounds)}`);

function fmtBox(b) {
  return `x [${b.minX.toFixed(0)}, ${b.maxX.toFixed(0)}]  y [${b.minY.toFixed(0)}, ${b.maxY.toFixed(0)}]`;
}
