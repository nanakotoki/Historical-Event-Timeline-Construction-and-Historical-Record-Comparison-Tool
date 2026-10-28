/**
 * 泳道统计：按 FACTION_RULES 归并后，逐片报告泳道数与单人道清单。
 * ------------------------------------------------------------------
 * 为什么需要这个脚本：
 *   阵营归并是「首匹配表 + 静默失配」——某个 faction 写错一个字，
 *   正则不报错、构建不报错、validate-seed 也不报错，只是画布上多出一条
 *   只有一个人的道。这类问题只能靠「按规则重算一遍再数」发现。
 *
 * 判据（来自 .workbuddy/memory/MEMORY.md）：
 *   - 未归并清单必须为 0（散道要**故意**留，不能是失配）
 *   - 单人道要么有史实理由，要么补人/改规则
 *
 * 用法：node scripts/lane-stats.mjs [片名关键字]
 */
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SHARD_MODULES = [
  { module: 'src/data/pre-qin/index.ts', exportName: 'preQinShard' },
  { module: 'src/data/chu-han/index.ts', exportName: 'chuHanShard' },
  { module: 'src/data/three-kingdoms/index.ts', exportName: 'threeKingdomsShard' },
  { module: 'src/data/jin-nanbeichao/index.ts', exportName: 'jinNanbeichaoShard' },
  { module: 'src/data/sui-tang/index.ts', exportName: 'suiTangShard' },
  { module: 'src/data/song-ming-qing/index.ts', exportName: 'songMingQingShard' },
  { module: 'src/data/five-dynasties/index.ts', exportName: 'fiveDynastiesShard' },
  { module: 'src/data/xin-mang/index.ts', exportName: 'xinMangShard' },
];

async function bundle(contents, outfile) {
  await build({
    stdin: { contents, resolveDir: ROOT, sourcefile: 'lane-entry.ts', loader: 'ts' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    outfile,
    logLevel: 'silent',
  });
  return import(`file://${outfile}?t=${Date.now()}`);
}

const filter = process.argv[2] ?? '';

let totalPeople = 0;
let totalLanes = 0;
let totalSingles = 0;
let totalUnmerged = 0;

for (const entry of SHARD_MODULES) {
  const tag = path.basename(path.dirname(entry.module));
  const outfile = path.join(ROOT, '.tmp', `lane-${tag}.mjs`);
  let mod;
  try {
    mod = await bundle(
      `export { ${entry.exportName} as shard } from './${entry.module}';\n` +
        `export { factionGroupOf, FACTION_RULES } from './src/lib/graph-layout';\n`,
      outfile,
    );
  } catch (err) {
    console.error(`✖ ${tag} 载入失败：${err.message}`);
    process.exitCode = 1;
    continue;
  }

  const { shard, factionGroupOf, FACTION_RULES } = mod;
  if (filter && !shard.title.includes(filter)) continue;

  const lanes = new Map();
  /* 未归并判据：**原始 faction 不命中任何一条规则**。
     不能拿「组名 === 原值」判定——规则把「齐国」映射到「齐国」时两者本就相等，
     那样会把整片正常运行的数据报成 338 人失配（曾如此误报）。 */
  const matched = (raw) => FACTION_RULES.some(([pattern]) => pattern.test(raw));
  for (const node of shard.nodes) {
    const group = factionGroupOf(node);
    if (!lanes.has(group)) lanes.set(group, []);
    lanes.get(group).push(node.name);
  }

  const singles = [];
  const merged = [...lanes.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [group, names] of merged) if (names.length === 1) singles.push(`${group}（${names[0]}）`);

  const unmerged = shard.nodes
    .filter((n) => (n.factionOrClan ?? '') && !matched(n.factionOrClan))
    .map((n) => `${n.name}:${n.factionOrClan}`);

  totalPeople += shard.nodes.length;
  totalLanes += lanes.size;
  totalSingles += singles.length;
  totalUnmerged += unmerged.length;

  console.log(
    `\n◈ ${shard.title} · ${shard.nodes.length} 人 · ${lanes.size} 道 · 单人道 ${singles.length} · 未归并 ${unmerged.length}`,
  );
  console.log(`   ${merged.map(([g, n]) => `${g} ${n.length}`).join(' / ')}`);
  if (singles.length) console.log(`   单人道：${singles.join('、')}`);
  if (unmerged.length) console.log(`   ⚠ 未命中规则：${unmerged.join('、')}`);
}

console.log(
  `\n合计 ${totalPeople} 人 · ${totalLanes} 道 · 单人道 ${totalSingles} · 未命中规则 ${totalUnmerged}`,
);
if (totalUnmerged > 0) {
  /* 不 fail：faction 原值本身就可以是泳道名（「赵地群雄」「南越」皆如此），
     这类「未命中」是合法的。真正的失配是**拼写错了一个字导致两条道被劈开**，
     那种情形肉眼比脚本可靠——脚本只负责把清单摊出来供人确认。
     要判定失配，看的是「同名势力是否出现在两条道上」，不是这一行计数。 */
  console.log('   以上未命中规则的 faction 直接充当泳道名，逐个确认是「有意散道」还是「拼写失配」。');
}
if (totalSingles > 0) {
  console.log('   单人道须有史实理由，否则补族人/僚属或改归并规则。');
}
