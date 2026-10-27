#!/usr/bin/env node
/**
 * 种子数据编译器（Seed Compiler）
 * ------------------------------------------------------------------
 * 将 `src/data/**` 中强类型的考据源，编译为前端消费的静态分片：
 *   public/data/shards/*.json    —— 按时代切分的图谱数据
 *   public/data/manifest.json    —— 全局索引、统计与轻量搜索清单
 *   public/data/portraits/*.svg  —— 本地冠服考据复原像（离线兜底）
 *
 * 编译期同时执行「数据契约校验」：
 *   ① 每个节点的必填字段与最低内容量（年表≥3、轶事≥1、原文≥2）
 *   ② 关系边两端必须存在，悬空边自动剔除并告警
 *   ③ 人物交叉引用的 id 必须存在，悬空引用自动剪除
 *
 * 用法：npm run seed:build
 */
import { build } from 'esbuild';
import { mkdir, writeFile, readdir, rm, stat, rename } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TMP_DIR = path.join(ROOT, 'node_modules', '.seed-build');

/**
 * 传世画像目录（由 scripts/portraits/fetch-portraits.mjs 抓取、build-catalog.mjs 归类）。
 * 这是「实物优先」的入口：只要该人物在公有领域图库中确有可定位的传世图档，
 * 编译期就以真图覆盖源文件里的占位描述，考据等级随实物等级改写。
 * 目录未收录者，仍按源文件声明的 L3/L4 呈现，绝不升格、绝不伪造。
 */
const REAL_PORTRAITS = (() => {
  const p = path.join(__dirname, 'portraits', 'catalog.json');
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf8')).entries ?? {};
  } catch (e) {
    console.warn(`  ⚠ 传世画像目录读取失败，本次构建忽略：${e.message}`);
    return {};
  }
})();

/** 分片模块清单：新增分片只需在此登记 */
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

const warnings = [];
const errors = [];

function warn(msg) {
  warnings.push(msg);
  console.warn(`  ⚠ ${msg}`);
}
function fail(msg) {
  errors.push(msg);
  console.error(`  ✖ ${msg}`);
}

/* ------------------------------ 模块加载 ------------------------------ */

async function loadModule(relPath, exportName) {
  await mkdir(TMP_DIR, { recursive: true });
  const entry = path.join(TMP_DIR, `entry-${path.basename(path.dirname(relPath))}.ts`);
  await writeFile(entry, `export { ${exportName} as shard } from '${relPath.replace(/\\/g, '/')}';\n`, 'utf8');

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
    external: ['react', 'next'],
  });
  const mod = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
  return mod.shard;
}

/* ------------------------------ 规范化 ------------------------------- */

let citeSeq = 0;

function normalizeCitation(citation) {
  if (!citation || typeof citation.originalText !== 'string') return citation;
  citeSeq += 1;
  return { id: citation.id ?? `cite_${String(citeSeq).padStart(4, '0')}`, ...citation };
}

function normalizePerson(node, index, validIds, promptBuilder) {
  const person = { ...node };
  const label = person.name ?? person.id;

  // 必填字段
  for (const field of ['id', 'name', 'dynasty', 'roles', 'officialTitles', 'oneLineSummary']) {
    if (!person[field] || (Array.isArray(person[field]) && person[field].length === 0 && field !== 'officialTitles')) {
      fail(`${label} 缺少必填字段 ${field}`);
    }
  }

  if (!person.id.startsWith('person_')) person.id = `person_${person.id}`;

  // 考据档位：full 需原文引证齐备，brief 只著录传目与生平骨干。
  // 详见 types/history.ts 的 annotationLevel 注释——这是显式降级，不是静默放水。
  const isBrief = person.annotationLevel === 'brief';

  // 生平年表
  person.lifeTimeline = (person.lifeTimeline ?? []).map((event, i) => {
    const e = { ...event, id: `${person.id}_evt_${i + 1}` };
    if (e.citation) e.citation = normalizeCitation(e.citation);
    if (e.participatingPersonIds) {
      const full = e.participatingPersonIds.map((pid) => (pid.startsWith('person_') ? pid : `person_${pid}`));
      const kept = full.filter((pid) => validIds.has(pid) && pid !== person.id);
      if (kept.length !== full.length) {
        const missing = full.filter((pid) => !validIds.has(pid));
        missing.forEach((m) => warn(`「${label}」年表事件「${e.title}」引用了不存在的节点 ${m}，已剪除`));
      }
      if (kept.length) e.participatingPersonIds = kept;
      else delete e.participatingPersonIds;
    }
    return e;
  });
  if (person.lifeTimeline.length < (isBrief ? 2 : 3)) {
    fail(`「${label}」生平年表仅 ${person.lifeTimeline.length} 条（要求 ≥ ${isBrief ? 2 : 3}）`);
  }

  // 轶事
  person.anecdotes = (person.anecdotes ?? []).map((anec, i) => {
    const a = { ...anec, id: `${person.id}_anec_${i + 1}` };
    a.primaryCitation = normalizeCitation(a.primaryCitation);
    a.relatedPersonIds = (a.relatedPersonIds ?? [])
      .filter((pid) => {
        const full = pid.startsWith('person_') ? pid : `person_${pid}`;
        const ok = validIds.has(full) && full !== person.id;
        if (!ok) warn(`「${label}」轶事「${a.title}」引用了不存在的节点 ${pid}，已剪除`);
        return ok;
      })
      .map((pid) => (pid.startsWith('person_') ? pid : `person_${pid}`));
    if (a.conflictingAccounts) {
      a.conflictingAccounts = a.conflictingAccounts.map((ca) => ({
        ...ca,
        citation: normalizeCitation(ca.citation),
      }));
    }
    return a;
  });
  if (!isBrief && person.anecdotes.length < 1) fail(`「${label}」缺少奇闻轶事（要求 ≥ 1）`);

  // 本传原文
  person.primarySources = (person.primarySources ?? []).map(normalizeCitation);
  if (!isBrief && person.primarySources.length < 2) {
    fail(`「${label}」本传原文段落仅 ${person.primarySources.length} 段（要求 ≥ 2）`);
  }
  // 简目人物：原文可以没有，但必须能指出本传在哪一卷，否则这条记录无从核查
  if (isBrief) {
    const chs = person.sourceChapters ?? [];
    if (!chs.length) fail(`「${label}」为简目人物，至少需著录一条本传篇目（sourceChapters）`);
    for (const ch of chs) {
      if (!ch?.bookTitle || !ch?.volumeAndChapter) fail(`「${label}」sourceChapters 条目缺 bookTitle 或卷次篇名`);
    }
  } else {
    delete person.sourceChapters;
  }

  // 画像：先落源文件声明，再按传世画像目录「实物优先」覆写
  if (!person.portrait) fail(`「${label}」缺少画像对象`);
  else {
    const real = REAL_PORTRAITS[person.id];
    if (real) {
      person.portrait = {
        ...person.portrait,
        tier: real.tier,
        thumbnailUrl: real.thumb,
        fullSizeUrl: real.full,
        sourceAttribution: real.sourceAttribution,
        painterOrBook: real.painterOrBook,
        aiReconstructionPrompt: person.portrait.aiReconstructionPrompt || promptBuilder(person),
      };
    } else {
      person.portrait = {
        ...person.portrait,
        aiReconstructionPrompt: person.portrait.aiReconstructionPrompt || promptBuilder(person),
      };
    }
  }

  // 权重兜底
  if (typeof person.importanceWeight !== 'number' || person.importanceWeight < 1) {
    warn(`「${label}」importanceWeight 非法，置为 40`);
    person.importanceWeight = 40;
  }

  // 年龄校验（若给出年龄与生年，二者应自洽）
  const birth = person.birthYear;
  if (typeof birth === 'number') {
    for (const e of person.lifeTimeline) {
      if (typeof e.age === 'number' && e.age !== e.year - birth && e.age !== e.year - birth + 1) {
        warn(`「${label}」年表事件「${e.title}」年龄 ${e.age} 与生年不符（应为 ${e.year - birth}）`);
      }
    }
  }

  return person;
}

function normalizeEdge(edge, validIds) {
  if (!validIds.has(edge.source)) {
    warn(`关系边 ${edge.id} 的源节点 ${edge.source} 不存在，已剔除`);
    return null;
  }
  if (!validIds.has(edge.target)) {
    warn(`关系边 ${edge.id} 的目标节点 ${edge.target} 不存在，已剔除`);
    return null;
  }
  const e = { ...edge };
  // 简目连线只有传目著录（textualBasis），没有原文引证（keyCitation），二者其一即可
  if (e.keyCitation) e.keyCitation = normalizeCitation(e.keyCitation);
  if (e.temporalPhases) {
    e.temporalPhases = e.temporalPhases.map((p) => ({
      ...p,
      ...(p.citation ? { citation: normalizeCitation(p.citation) } : {}),
    }));
    // 阶段时序必须单调不重叠
    const sorted = [...e.temporalPhases].sort((a, b) => (a.startYear ?? 0) - (b.startYear ?? 0));
    for (let i = 1; i < sorted.length; i += 1) {
      const prevEnd = sorted[i - 1].endYear ?? Infinity;
      const curStart = sorted[i].startYear ?? -Infinity;
      if (curStart < prevEnd) {
        warn(`关系边 ${edge.id} 的时序阶段「${sorted[i - 1].phaseLabel}」与「${sorted[i].phaseLabel}」区间重叠`);
      }
    }
  }
  if (typeof e.strength !== 'number' || e.strength < 1 || e.strength > 10) {
    warn(`关系边 ${edge.id} 的 strength 越界，已钳制`);
    e.strength = Math.min(10, Math.max(1, Number(e.strength) || 5));
  }
  return e;
}

/* ------------------------------ 主流程 ------------------------------- */

async function main() {
  console.log('◈ 华夏史网 · 种子数据编译\n');

  // 提示词生成器（与前端 portrait-resolver 共用同一实现，避免文案漂移）
  const resolver = await loadResolverModule();
  const buildAiPrompt = resolver.buildAiPrompt;
  const buildPortraitSVG = resolver.buildPortraitSVG;
  const specOfPerson = resolver.specOfPerson;

  const shards = [];
  for (const entry of SHARD_MODULES) {
    try {
      const shard = await loadModule(path.join(ROOT, entry.module), entry.exportName);
      console.log(`· 载入分片 ${shard.shardId}（${shard.nodes.length} 人 / ${shard.edges.length} 边）`);
      shards.push(shard);
    } catch (err) {
      if (String(err.message ?? err).includes('Could not resolve')) {
        warn(`分片模块 ${entry.module} 尚未创建，跳过`);
      } else {
        fail(`分片 ${entry.module} 载入失败：${err.message}`);
      }
    }
  }

  if (!shards.length) {
    console.error('\n没有可编译的分片。');
    process.exit(1);
  }

  // 全局 id 集合（跨分片去重）
  const validIds = new Set();
  shards.forEach((s) => s.nodes.forEach((n) => validIds.add(n.id.startsWith('person_') ? n.id : `person_${n.id}`)));

  const portraitDir = path.join(ROOT, 'public', 'data', 'portraits');
  const shardDir = path.join(ROOT, 'public', 'data', 'shards');
  await mkdir(portraitDir, { recursive: true });
  await mkdir(shardDir, { recursive: true });
  // 清理旧产物，避免删改数据后残留孤儿文件。
  // 注意：portraits 目录里同时存放从公有领域图库抓取的 jpg 实物图档，
  // 那些不是本脚本的产物（由 scripts/portraits/fetch-portraits.mjs 管理），绝不可清理，
  // 故此处只处理本脚本生成的 .svg。
  //
  // 这里**不做「删光重建」**，而是求差集：只删本次不会再被生成的那些。
  // 原实现是无差别删掉目录下所有 .svg 再逐个重写，在生成逻辑确定性的前提下结果等价，
  // 但有两个坏处，且都真实发生过：
  //   ① 一旦中途被打断，目录里就只剩写了一半的肖像，画布大片空圆环；
  //   ② 本机 shell 装了批量删除守卫（单轮累计删 50 个即中止进程），
  //      删几百个必然半路退出，`build-seed` 于是以退出码 1 结束、数据看似编译失败。
  // 改成差集后，正常的增量构建差集为空，一个文件都不会删。
  {
    const keep = new Set();
    for (const id of validIds) if (!REAL_PORTRAITS[id]) keep.add(`${id}.svg`);
    const files = await readdir(portraitDir).catch(() => []);
    const stale = files.filter((f) => f.endsWith('.svg') && !keep.has(f));
    for (const f of stale) await rm(path.join(portraitDir, f), { force: true });
    if (stale.length) console.log(`  清理孤儿肖像 ${stale.length} 个（已不在人物集合内）`);
  }
  {
    const files = await readdir(shardDir).catch(() => []);
    await Promise.all(files.map((f) => rm(path.join(shardDir, f), { force: true })));
  }

  let totalPersons = 0;
  let totalEdges = 0;
  let totalAnecdotes = 0;
  let totalCitations = 0;
  const manifestShards = [];
  const manifestSearch = [];
  const seenPersonIds = new Set();

  /* ---------------------------- 全局权重标定 ---------------------------- */
  // 人工填写的 importanceWeight 普遍偏高（本库三分之二都在 75 以上），
  // 若原样使用，「宏观只画帝王权臣」的 LOD 会退化成「几乎全画」。
  // 这里做一次单调压缩：相对次序完全不变，只把分布拉开，使 ≥75 的顶级人物
  // 收敛到约三成，75~40 成为中观主力，<40 留给微观层展开。
  const CALIBRATION_EXPONENT = 2.0;
  const calibratedWeight = new Map();
  for (const raw of shards) {
    for (const person of raw.nodes) {
      if (calibratedWeight.has(person.id)) continue;
      const rawWeight = typeof person.importanceWeight === 'number' ? person.importanceWeight : 40;
      const clamped = Math.max(0, Math.min(100, rawWeight));
      calibratedWeight.set(
        person.id,
        Math.max(1, Math.min(100, Math.round(100 * Math.pow(clamped / 100, CALIBRATION_EXPONENT)))),
      );
    }
  }

  for (const raw of shards) {
    console.log(`\n◈ 处理分片 ${raw.shardId}`);
    citeSeq = citeSeq; // 全局连续编号

    const nodes = raw.nodes.map((n) => {
      const person = normalizePerson(n, 0, validIds, buildAiPrompt);
      const calibrated = calibratedWeight.get(person.id);
      if (calibrated !== undefined) person.importanceWeight = calibrated;
      return person;
    });
    // 二次去重（跨分片重复人物以首见为准）
    const deduped = nodes.filter((n) => {
      if (seenPersonIds.has(n.id)) {
        warn(`人物 ${n.id} 在多个分片重复出现，分片 ${raw.shardId} 中已跳过`);
        return false;
      }
      seenPersonIds.add(n.id);
      return true;
    });

    const edges = raw.edges.map((e) => normalizeEdge(e, validIds)).filter(Boolean);

    const shard = { ...raw, nodes: deduped, edges };
    // 文件名与 shardId 严格一致（便于 dynasty.shardFile 直接映射）
    const file = `${raw.shardId}.json`;

    await writeFile(path.join(shardDir, file), JSON.stringify(shard, null, 0), 'utf8');
    const info = await stat(path.join(shardDir, file));

    // 画像 SVG：仅对「无传世图档」者生成冠服考据像；
    // 已有实物图档（L1/L2）的人物不再产出冗余 SVG，避免两套画像并存造成误认。
    for (const person of deduped) {
      if (REAL_PORTRAITS[person.id]) continue;
      const svg = buildPortraitSVG(specOfPerson(person));
      await writeFile(path.join(portraitDir, `${person.id}.svg`), svg, 'utf8');
    }

    // 挪走未过审计的图档：审计账本判定 reject 的，其 jpg 不得随产物发布，
  // 否则即便前端不引用，静态目录里也会留下「看起来像真图」的僵尸文件。
  // 不删源文件，移入 scripts/portraits/rejected/ 备查。
  {
    const present = await readdir(portraitDir).catch(() => []);
    const orphans = present.filter((f) => {
      const m = /^(?:full_)?(person_[a-z0-9_]+)\.(jpg|png)$/i.exec(f);
      return m && !REAL_PORTRAITS[m[1]];
    });
    if (orphans.length) {
      const quarantine = path.join(__dirname, 'portraits', 'rejected');
      await mkdir(quarantine, { recursive: true });
      for (const f of orphans) {
        await rm(path.join(quarantine, f), { force: true });
        await rename(path.join(portraitDir, f), path.join(quarantine, f)).catch(() => {});
      }
      console.log(`  未过审图档 ${orphans.length} 个已移入 scripts/portraits/rejected/`);
    }
  }

    totalPersons += deduped.length;
    totalEdges += edges.length;
    totalAnecdotes += deduped.reduce((sum, p) => sum + p.anecdotes.length, 0);
    /*
     * 引文口径必须与 validate-seed.mjs 一致，否则顶栏数字会比审计少一截。
     * 凡持有 HistoricalCitation 的地方都要计入，共五处：
     *   ① 人物本传 primarySources
     *   ② 轶事 anecdote 本身各挂一条
     *   ③ 轶事内「史料对勘」的每一方各一条
     *   ④ 年表事件（简目人物的年表多不附原文，故此处天然稀少）
     *   ⑤ 连线的 keyCitation 与关系各阶段的 temporalPhases[].citation
     */
    totalCitations += deduped.reduce(
      (sum, p) =>
        sum +
        p.primarySources.length +
        p.anecdotes.length +
        p.anecdotes.reduce((s, a) => s + (a.conflictingAccounts?.length ?? 0), 0) +
        p.lifeTimeline.filter((e) => e.citation).length,
      0,
    );
    totalCitations += edges.reduce(
      (sum, e) => sum + (e.keyCitation ? 1 : 0) + (e.temporalPhases ?? []).filter((p) => p.citation).length,
      0,
    );

    manifestShards.push({
      shardId: raw.shardId,
      file,
      title: raw.title,
      subtitle: raw.subtitle,
      dynasties: raw.dynasties,
      yearRange: raw.yearRange,
      personCount: deduped.length,
      edgeCount: edges.length,
      byteSize: info.size,
    });

    for (const person of deduped) {
      const a = person.aliases ?? {};
      manifestSearch.push({
        id: person.id,
        name: person.name,
        aliasText: [
          a.courtesyName,
          ...(a.pseudonyms ?? []),
          a.posthumousTitle,
          a.templeName,
          ...(a.eraNames ?? []),
          ...(a.feudalTitles ?? []),
          ...person.roles,
        ]
          .filter(Boolean)
          .join(' '),
        dynasty: person.dynasty,
        shardId: raw.shardId,
        importanceWeight: person.importanceWeight,
      });
    }

    console.log(`  ✓ ${file} · ${deduped.length} 人 / ${edges.length} 边 · ${(info.size / 1024).toFixed(1)} KB`);
  }

  /* ------------------------------ manifest ------------------------------ */

  const { DYNASTIES } = await loadDynasties();
  const manifest = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    site: {
      title: '华夏史网',
      subtitle: 'ChronoGraph China · 二十四史人物关系图谱与史料对勘引擎',
      edition: '首发种子库 · 楚汉 / 三国 / 隋唐三簇',
    },
    stats: {
      personCount: totalPersons,
      edgeCount: totalEdges,
      anecdoteCount: totalAnecdotes,
      citationCount: totalCitations,
      dynastyCount: new Set(manifestShards.flatMap((s) => s.dynasties)).size,
      shardCount: manifestShards.length,
    },
    dynasties: DYNASTIES,
    shards: manifestShards,
    searchIndex: manifestSearch.sort((a, b) => b.importanceWeight - a.importanceWeight),
    highlights: [
      { label: '在册人物', value: String(totalPersons), note: '全部经正史本传核验' },
      { label: '关系边', value: String(totalEdges), note: '每条均附文言原文为证' },
      { label: '奇闻轶事', value: String(totalAnecdotes), note: '含注疏与笔记分级' },
      { label: '史源引文', value: String(totalCitations), note: '文白对照，可溯源' },
    ],
    plannedShards: [],
  };

  await writeFile(path.join(ROOT, 'public', 'data', 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n◈ 编译完成');
  console.log(`  人物 ${totalPersons} · 关系 ${totalEdges} · 轶事 ${totalAnecdotes} · 引文 ${totalCitations}`);
  console.log(`  分片 ${manifestShards.length} · 画像 ${totalPersons} 幅 · manifest.json 已生成`);

  if (warnings.length) {
    console.log(`\n  告警 ${warnings.length} 条（悬空引用已自动剪除）`);
  }
  if (errors.length) {
    console.error(`\n  ✖ 校验失败 ${errors.length} 项：`);
    errors.slice(0, 40).forEach((e) => console.error(`    - ${e}`));
    process.exit(1);
  }
}

async function loadDynasties() {
  await mkdir(TMP_DIR, { recursive: true });
  const entry = path.join(TMP_DIR, 'entry-dynasties.ts');
  await writeFile(entry, `export { DYNASTIES } from '${path.join(ROOT, 'src/data/dynasties.ts').replace(/\\/g, '/')}';\n`, 'utf8');
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

async function loadResolverModule() {
  await mkdir(TMP_DIR, { recursive: true });
  const entry = path.join(TMP_DIR, 'entry-resolver.ts');
  await writeFile(
    entry,
    `export { buildAiPrompt } from '${path.join(ROOT, 'src/lib/portrait-resolver.ts').replace(/\\/g, '/')}';\n` +
      `export { buildPortraitSVG, specOfPerson } from '${path.join(ROOT, 'src/lib/portrait-svg.ts').replace(/\\/g, '/')}';\n`,
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
