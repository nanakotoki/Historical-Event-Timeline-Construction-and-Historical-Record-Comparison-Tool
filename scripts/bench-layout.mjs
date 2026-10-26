#!/usr/bin/env node
/**
 * 布局耗时基准（Layout Bench）
 * ------------------------------------------------------------------
 * 为什么不用浏览器量这一项：`/bench` 测的是帧率，帧率受光栅化、头像缓存、
 * 流光重绘影响，同一档位连测两次能差三倍（README 里记过这件事）。
 * 但「力导向布局」这一列是可以确定复现的——它是一次纯计算，与渲染无关。
 * 所以单独成脚本：读真实分片 JSON，把全部分片合并后直接调 computeForceLayout，
 * 报出耗时。这样一来 README 里那张表的布局列随时可以用一条命令复核。
 *
 * 用法：
 *   node scripts/bench-layout.mjs              # 合并全部分片
 *   node scripts/bench-layout.mjs --repeat 3   # 连测三次取中位数
 *   node scripts/bench-layout.mjs --multiply 3 # 整体复制 3 份（同 /bench 页的 ×3 档）
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

const DATA = path.resolve(ROOT, flag('data', 'public/data'));
const REPEAT = Number(flag('repeat', 3));
const MULTIPLY = Number(flag('multiply', 1));
/** 四叉树近似阈值。0 等价于精确两两计算，见 src/lib/barnes-hut.ts */
const THETA = Number(flag('theta', 0.85));
/** 强制走旧的 O(n²) 精确路径，用来复现改造前的基线 */
const EXACT = argv.includes('--exact');

async function loadLayout() {
  fs.mkdirSync(TMP, { recursive: true });
  const entry = path.join(TMP, 'entry-layout.ts');
  const target = path.join(ROOT, 'src/lib/graph-layout.ts').replace(/\\/g, '/');
  fs.writeFileSync(entry, `export { computeForceLayout } from '${target}';\n`, 'utf8');
  const outfile = entry.replace(/\.ts$/, '.mjs');
  await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
}

function loadMerged() {
  const dir = path.join(DATA, 'shards');
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

const { computeForceLayout } = await loadLayout();
const base = loadMerged();
const { nodes, edges } = MULTIPLY > 1 ? multiply(base, MULTIPLY) : base;

/** 与 /bench 页同一套做法：人物、关系全是真数据，只给 id 加副本后缀 */
function multiply({ nodes, edges }, times) {
  const outN = [];
  const outE = [];
  for (let k = 0; k < times; k += 1) {
    const tag = k === 0 ? '' : `__x${k}`;
    for (const n of nodes) outN.push({ ...n, id: `${n.id}${tag}` });
    for (const e of edges) outE.push({ ...e, id: `${e.id}${tag}`, source: `${e.source}${tag}`, target: `${e.target}${tag}` });
  }
  return { nodes: outN, edges: outE };
}

const times = [];
for (let i = 0; i < REPEAT; i += 1) {
  const t0 = process.hrtime.bigint();
  computeForceLayout(nodes, edges, { theta: THETA, exactRepulsion: EXACT });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  times.push(ms);
  console.log(`  第 ${i + 1} 次：${ms.toFixed(0)} ms`);
}

times.sort((a, b) => a - b);
const median = times[Math.floor(times.length / 2)];
const mode = EXACT ? '精确 O(n²)' : `四叉树 θ=${THETA}`;
console.log(
  `\n✓ ${nodes.length} 人 / ${edges.length} 边 → 力导向布局中位耗时 ${median.toFixed(0)} ms（${(median / 1000).toFixed(1)} s）· ${mode}`,
);
