#!/usr/bin/env node
/**
 * 孤立节点检查（Orphan Check）
 * ------------------------------------------------------------------
 * 为什么单独成脚本：每批新人入库后，若忘了接线，画布上就是一群浮着的点，
 * 图谱退化成名录——而这个错误不会让编译失败，也不会被 validate-seed 拦下，
 * 只能靠度数统计发现。三国首批曾一次冒出 46 个孤点，楚汉 106 个，隋唐 121 个。
 *
 * 判定：某节点在 edges 中既非 source 亦非 target，度数即为 0，视为孤立。
 *
 * 用法：node scripts/check-orphans.mjs [--data public/data]
 * 退出码：有孤点时返回 1，便于串进 CI。
 */
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const i = argv.indexOf('--data');
const DATA = path.resolve(i === -1 ? 'public/data' : argv[i + 1] ?? 'public/data');
const SHARD_DIR = path.join(DATA, 'shards');

let total = 0;
let orphansAll = 0;

for (const file of fs.readdirSync(SHARD_DIR).sort()) {
  if (!file.endsWith('.json')) continue;
  const shard = JSON.parse(fs.readFileSync(path.join(SHARD_DIR, file), 'utf8'));
  const degree = new Map();
  for (const node of shard.nodes) degree.set(node.id, 0);
  for (const edge of shard.edges) {
    if (degree.has(edge.source)) degree.set(edge.source, degree.get(edge.source) + 1);
    if (degree.has(edge.target)) degree.set(edge.target, degree.get(edge.target) + 1);
  }
  const orphans = [...degree].filter(([, d]) => d === 0).map(([id]) => id);
  const avg = shard.nodes.length ? ((shard.edges.length * 2) / shard.nodes.length).toFixed(2) : '0';
  total += shard.nodes.length;
  orphansAll += orphans.length;
  const flag = orphans.length ? '✖' : '✓';
  console.log(`${flag} ${file.padEnd(34)} ${String(shard.nodes.length).padStart(4)} 人 · ${String(shard.edges.length).padStart(4)} 边 · 人均度数 ${avg} · 孤立 ${orphans.length}`);
  if (orphans.length) console.log(`     ${orphans.join(' ')}`);
}

console.log(`\n合计 ${total} 人，孤立 ${orphansAll} 个`);
process.exit(orphansAll ? 1 : 0);
