#!/usr/bin/env node
/**
 * 冠服考据肖像渲染器（Portrait Renderer）
 * ------------------------------------------------------------------
 * Python ETL（`scripts/etl/build_shards.py`）产出的分片里只有人物考据数据，
 * 没有画像文件；而 L3/L4 肖像的生成逻辑（朝代冠冕、服色、纹样、题款）
 * 写在 TypeScript 的 `src/lib/portrait-svg.ts` 里，无法用 Python 复刻。
 *
 * 本脚本就是那座桥：读任意分片 JSON，用同一份 TS 实现为每个缺失肖像的人物
 * 生成 SVG，写到 `<data>/portraits/<person_id>.svg`。这样两条数据链路
 * （种子库 src/data → build-seed，ETL → build_shards）产出的画像风格完全一致。
 *
 * 用法：
 *   node scripts/render-portraits.mjs --data public/data
 *   node scripts/render-portraits.mjs --data build/out --force
 */

import { build } from 'esbuild';
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TMP_DIR = path.join(ROOT, 'node_modules', '.seed-build');

const argv = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
};

const dataDir = path.resolve(ROOT, String(flag('data', 'public/data')));
const force = Boolean(flag('force', false));

async function loadPortraitModule() {
  await mkdir(TMP_DIR, { recursive: true });
  const entry = path.join(TMP_DIR, 'entry-portrait-render.ts');
  await writeFile(
    entry,
    `export { buildPortraitSVG, specOfPerson } from '${path
      .join(ROOT, 'src/lib/portrait-svg.ts')
      .replace(/\\/g, '/')}';\n`,
    'utf8',
  );
  const outfile = entry.replace(/\.ts$/, '.mjs');
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    logLevel: 'silent',
    alias: { '@': path.join(ROOT, 'src') },
  });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
}

async function main() {
  const shardDir = path.join(dataDir, 'shards');
  const portraitDir = path.join(dataDir, 'portraits');
  await mkdir(portraitDir, { recursive: true });

  const files = (await readdir(shardDir).catch(() => [])).filter((f) => f.endsWith('.json'));
  if (!files.length) {
    console.error(`✖ ${shardDir} 下没有分片文件`);
    process.exit(1);
  }

  const { buildPortraitSVG, specOfPerson } = await loadPortraitModule();
  let rendered = 0;
  let skipped = 0;

  for (const file of files) {
    const shard = JSON.parse(await readFile(path.join(shardDir, file), 'utf8'));
    for (const person of shard.nodes ?? []) {
      const target = path.join(portraitDir, `${person.id}.svg`);
      if (!force) {
        const exists = await stat(target).then(() => true).catch(() => false);
        if (exists) {
          skipped += 1;
          continue;
        }
      }
      const svg = buildPortraitSVG(specOfPerson(person));
      await writeFile(target, svg, 'utf8');
      rendered += 1;
    }
  }

  console.log(`◈ 肖像渲染完成：新生成 ${rendered} 幅，已存在跳过 ${skipped} 幅`);
  console.log(`  输出 ${portraitDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
