#!/usr/bin/env node
/**
 * 种子库独立审计器（Seed Auditor）
 * ------------------------------------------------------------------
 * 与 `build-seed.mjs` 的「编译期校验」相互独立：
 *   build-seed  在**写盘之前**校验源数据，可自动剪除悬空引用；
 *   validate-seed 在**写盘之后**只读审计已发布的静态产物，
 *                 确保 public/data/ 下的 JSON 真能被前端安全消费。
 *
 * 审计项（任一 HARD 项失败即 exit 1，WARN 项仅提示）：
 *   A. 清单完整性：manifest.json 结构、统计数与实际分片一致、searchIndex 覆盖全量人物
 *   B. 配额红线：合计人物 ≥ 60、关系边 ≥ 120（规范 5.1）
 *   C. 节点契约：必填字段、字号谥号、生卒年、籍贯经纬度、年表 ≥3、轶事 ≥1、本传引文 ≥2、史官总评
 *   D. 引文契约：originalText 为文言非空、modernTranslation 非空、reliability 在允许枚举内、id 全局唯一
 *   E. 关系契约：两端节点存在、strength ∈ [1,10]、有向性布尔、temporalPhases 时序单调不重叠
 *   F. 画像四级梯度：tier 合法、缩略图/大图 URL 存在、本地 SVG 已生成
 *   G. 时序合理性：生年 ≤ 卒年、事件年落在人物生卒区间外挂容忍窗口、坐标经纬度合法
 *
 * 用法：
 *   npm run seed:validate
 *   node scripts/validate-seed.mjs --data public/data --strict
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* ------------------------------ 参数解析 ------------------------------ */

const argv = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
};

const DATA_DIR = path.resolve(ROOT, String(flag('data', 'public/data')));
const STRICT = Boolean(flag('strict', false));
/** 高密度种子库的配额红线（规范 5.1：合计不少于 60~80 人 / 120~180 边） */
const MIN_PERSONS = Number(flag('min-persons', 60));
const MIN_EDGES = Number(flag('min-edges', 120));

/* ------------------------------ 契约枚举 ------------------------------ */

const DYNASTY_IDS = new Set([
  'pre_qin', 'qin', 'chu_han', 'western_han', 'xin', 'eastern_han', 'three_kingdoms', 'jin',
  'southern_northern', 'sui', 'tang', 'five_dynasties', 'song', 'liao_jin_xia', 'yuan', 'ming', 'qing',
]);

const RELIABILITY = new Set([
  'official_history_primary',
  'official_history_hujian',
  'authoritative_commentary',
  'chronicle_corroboration',
  'literary_anecdotal',
]);

const RELATION_CATEGORIES = new Set([
  'kinship_blood', 'kinship_marriage', 'monarch_subject', 'political_ally',
  'political_rival', 'military_adversary', 'mentor_disciple', 'literary_bosom',
]);

const ANECDOTE_CATEGORIES = new Set([
  'eccentric_demeanor', 'wit_and_strategem', 'physiognomy_omen',
  'culinary_lifestyle', 'literary_romance', 'historical_mystery',
]);

/** 角色名里出现这些词，即视为该人物在关系中可充当「君」或统属上级 */
const RULER_ROLES = [
  '皇帝', '天子', '太子', '皇子', '公子', '王', '公', '侯', '君主', '主公',
  '盟主', '单于', '可汗', '国主', '军阀', '权臣', '丞相', '大将军', '都督',
  '节度使', '统帅', '监军', '首领',
];

const PORTRAIT_TIERS = new Set([
  'tier1_authentic_painting',
  'tier2_ancient_woodcut',
  'tier3_ai_reconstructed',
  'tier4_attire_silhouette',
]);

/** 允许的公元纪年硬边界：商周之际 ~ 近现代 */
const YEAR_FLOOR = -1100;
const YEAR_CEIL = 1950;

/* ------------------------------ 结果收集 ------------------------------ */

const hard = [];
const warn = [];
const stats = {
  shards: 0, persons: 0, edges: 0, anecdotes: 0, citations: 0,
  timelineEvents: 0, phases: 0, conflicting: 0,
  personasWithGeo: 0, personasWithPortraitFile: 0, personasWithAlias: 0,
  personasWithAssessment: 0, personasWithAppearance: 0,
  edgesWithPhases: 0, citationsWithUrl: 0,
  fullPersonas: 0, briefPersonas: 0,
};

const fail = (where, msg) => hard.push(`[${where}] ${msg}`);
const note = (where, msg) => warn.push(`[${where}] ${msg}`);

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** 文言文原文的最低可信度：去除标点后至少 4 个汉字，且不是明显的现代汉语口吻 */
function looksLikeClassical(text) {
  if (!isNonEmptyString(text)) return false;
  const han = text.replace(/[^\u4e00-\u9fa5]/g, '');
  if (han.length < 4) return false;
  // 现代白话高频词在正史原文中极少出现，命中过多则判定为「译文误填进原文栏」
  const modernMarkers = ['的了', '我们', '他们', '这个', '那个', '因为', '所以', '非常', '一个', '就是', '可以'];
  const hits = modernMarkers.filter((m) => text.includes(m)).length;
  return hits < 2;
}

/* ------------------------------ 引文审计 ------------------------------ */

const citationIds = new Map(); // id -> 出现位置

function auditCitation(where, cite, { required = true } = {}) {
  if (!cite || typeof cite !== 'object') {
    if (required) fail(where, '缺少史料引文对象');
    return;
  }
  stats.citations += 1;

  if (!isNonEmptyString(cite.bookTitle)) fail(where, '引文缺少 bookTitle');
  if (!isNonEmptyString(cite.volumeAndChapter)) fail(where, '引文缺少 volumeAndChapter（卷次篇名）');
  if (!isNonEmptyString(cite.originalText)) fail(where, '引文 originalText 为空');
  else if (!looksLikeClassical(cite.originalText)) {
    note(where, `引文原文疑似非文言或过短：「${cite.originalText.slice(0, 24)}…」`);
  }
  if (!isNonEmptyString(cite.modernTranslation)) fail(where, '引文缺少 modernTranslation 白话译文');
  if (!RELIABILITY.has(cite.reliability)) {
    fail(where, `引文 reliability 非法：${cite.reliability}`);
  }
  if (isNonEmptyString(cite.wikisourceUrl)) {
    stats.citationsWithUrl += 1;
    if (!/^https?:\/\//.test(cite.wikisourceUrl)) fail(where, `wikisourceUrl 不是合法 URL：${cite.wikisourceUrl}`);
  }
  if (isNonEmptyString(cite.id)) {
    if (citationIds.has(cite.id)) fail(where, `引文 id 重复：${cite.id}（首见于 ${citationIds.get(cite.id)}）`);
    else citationIds.set(cite.id, where);
  } else {
    fail(where, '引文缺少 id');
  }
}

/* ------------------------------ 节点审计 ------------------------------ */

const allPersonIds = new Set();
/** 已声明（存在）的人物 id 集合，用于关系边与交叉引用判定 */
const declaredIds = new Set();
const personIndex = new Map();

function auditPerson(where, p) {
  const label = `${where} · ${p?.name ?? p?.id ?? '未命名'}`;
  // 简目人物：只到「传目 + 生平骨干」这一层，不附原文引证。见 types/history.ts。
  const isBrief = p?.annotationLevel === 'brief';
  if (isBrief) stats.briefPersonas += 1; else stats.fullPersonas += 1;

  for (const f of ['id', 'name', 'dynasty', 'oneLineSummary']) {
    if (!isNonEmptyString(p[f])) fail(label, `缺少必填字段 ${f}`);
  }
  if (!p.id?.startsWith('person_')) fail(label, `id 未使用 person_ 前缀：${p.id}`);
  if (allPersonIds.has(p.id)) fail(label, `人物 id 全局重复：${p.id}`);
  allPersonIds.add(p.id);
  personIndex.set(p.id, p);

  if (!DYNASTY_IDS.has(p.dynasty)) fail(label, `dynasty 非法：${p.dynasty}`);
  if (!['male', 'female', 'eunuch'].includes(p.gender)) fail(label, `gender 非法：${p.gender}`);

  // —— 多称谓体系：字 / 号 / 谥号 / 庙号 / 年号 / 封爵 至少命中一项
  const a = p.aliases ?? {};
  const aliasHits = [
    a.courtesyName, a.posthumousTitle, a.templeName,
    ...(a.pseudonyms ?? []), ...(a.eraNames ?? []), ...(a.feudalTitles ?? []),
  ].filter(isNonEmptyString);
  if (!aliasHits.length) {
    // 部分人物史书确无字号谥号（如扶苏、赵高、蒙恬），此时宁可留白也不得杜撰；
    // 档案页会对这类人物显示「史传未载」，故此处仅作统计，不视为缺陷
    note(label, '字号/谥号/庙号/封爵俱无史载——留白正确，档案页将明示「史传未载」');
  } else stats.personasWithAlias += 1;

  // —— 生卒年
  if (isNum(p.birthYear) && (p.birthYear < YEAR_FLOOR || p.birthYear > YEAR_CEIL)) {
    fail(label, `birthYear 越界：${p.birthYear}`);
  }
  if (isNum(p.deathYear) && (p.deathYear < YEAR_FLOOR || p.deathYear > YEAR_CEIL)) {
    fail(label, `deathYear 越界：${p.deathYear}`);
  }
  if (isNum(p.birthYear) && isNum(p.deathYear) && p.birthYear > p.deathYear) {
    fail(label, `生年 ${p.birthYear} 晚于卒年 ${p.deathYear}`);
  }

  // —— 籍贯经纬度
  const bp = p.birthplace;
  if (!bp || !isNonEmptyString(bp.ancientName) || !isNonEmptyString(bp.modernName)) {
    fail(label, '缺少籍贯（ancientName / modernName）');
  } else if (!Array.isArray(bp.coordinates) || bp.coordinates.length !== 2) {
    fail(label, '籍贯 coordinates 必须是 [lng, lat]');
  } else {
    const [lng, lat] = bp.coordinates;
    if (!isNum(lng) || !isNum(lat)) fail(label, '籍贯坐标不是数值');
    else if (lng < -180 || lng > 180 || lat < -90 || lat > 90) fail(label, `籍贯坐标越界：${lng}, ${lat}`);
    else if (lng < 60 || lng > 150 || lat < 5 || lat > 60) {
      // 中国历史地理范围之外的坐标，多半是 [lat, lng] 写反了
      note(label, `籍贯坐标 ${lng}, ${lat} 落在中国史地常规范围之外，请确认经纬顺序`);
    } else stats.personasWithGeo += 1;
  }

  if (!Array.isArray(p.roles) || !p.roles.length) fail(label, 'roles 为空');
  if (!Array.isArray(p.officialTitles)) fail(label, 'officialTitles 不是数组');
  if (!isNum(p.importanceWeight) || p.importanceWeight < 1 || p.importanceWeight > 100) {
    fail(label, `importanceWeight 越界：${p.importanceWeight}`);
  }

  // —— 生平年表
  const tl = p.lifeTimeline ?? [];
  stats.timelineEvents += tl.length;
  if (tl.length < (isBrief ? 2 : 3)) fail(label, `生平年表仅 ${tl.length} 条（要求 ≥ ${isBrief ? 2 : 3}）`);
  const eventIds = new Set();
  for (const e of tl) {
    if (!isNonEmptyString(e.id)) fail(label, '年表事件缺少 id');
    else if (eventIds.has(e.id)) fail(label, `年表事件 id 重复：${e.id}`);
    else eventIds.add(e.id);
    if (!isNum(e.year)) fail(label, `年表事件「${e.title}」year 非数值`);
    else if (e.year < YEAR_FLOOR || e.year > YEAR_CEIL) fail(label, `年表事件「${e.title}」年份越界：${e.year}`);
    if (!isNonEmptyString(e.title)) fail(label, '年表事件缺少 title');
    if (!isNonEmptyString(e.description)) fail(label, `年表事件「${e.title}」缺少 description`);
    if (e.citation) auditCitation(`${label} 年表「${e.title}」`, e.citation);
    if (e.location) {
      const c = e.location.coordinates;
      if (Array.isArray(c) && c.length === 2) {
        const [lng, lat] = c;
        if (!isNum(lng) || !isNum(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
          fail(label, `年表事件「${e.title}」地点坐标非法`);
        }
      }
    }
    // 生卒区间交叉校验（留 1 年宽容，古人年龄常以虚岁计）
    if (isNum(e.year) && isNum(p.birthYear) && e.year < p.birthYear - 1) {
      note(label, `年表事件「${e.title}」早于生年 ${p.birthYear}`);
    }
    if (isNum(e.year) && isNum(p.deathYear) && e.year > p.deathYear + 1) {
      note(label, `年表事件「${e.title}」晚于卒年 ${p.deathYear}`);
    }
  }

  // —— 奇闻轶事
  const anec = p.anecdotes ?? [];
  stats.anecdotes += anec.length;
  if (!isBrief && anec.length < 1) fail(label, '缺少奇闻轶事（要求 ≥ 1）');
  for (const an of anec) {
    const aw = `${label} 轶事「${an.title ?? an.id}」`;
    if (!isNonEmptyString(an.id)) fail(aw, '缺少 id');
    if (!isNonEmptyString(an.title)) fail(aw, '缺少 title');
    if (!ANECDOTE_CATEGORIES.has(an.category)) fail(aw, `category 非法：${an.category}`);
    if (!isNonEmptyString(an.narrativeSummary)) fail(aw, '缺少 narrativeSummary');
    if (!Array.isArray(an.relatedPersonIds)) fail(aw, 'relatedPersonIds 不是数组');
    auditCitation(aw, an.primaryCitation);
    for (const ca of an.conflictingAccounts ?? []) {
      stats.conflicting += 1;
      if (!isNonEmptyString(ca.sourceName)) fail(aw, '对勘条目缺少 sourceName');
      if (!isNonEmptyString(ca.stanceOrBias)) fail(aw, '对勘条目缺少 stanceOrBias 史官立场分析');
      auditCitation(`${aw} 对勘`, ca.citation);
    }
  }

  // —— 本传原文
  const ps = p.primarySources ?? [];
  if (!isBrief && ps.length < 2) fail(label, `本传原文仅 ${ps.length} 段（要求 ≥ 2）`);
  ps.forEach((c, i) => auditCitation(`${label} 本传第 ${i + 1} 段`, c));

  // —— 简目人物：可以没有原文，但必须指出本传在哪一卷，否则无从核查
  if (isBrief) {
    const chs = p.sourceChapters ?? [];
    if (!chs.length) fail(label, '简目人物至少需著录一条本传篇目（sourceChapters）');
    for (const ch of chs) {
      if (!isNonEmptyString(ch?.bookTitle) || !isNonEmptyString(ch?.volumeAndChapter)) {
        fail(label, 'sourceChapters 条目缺 bookTitle 或卷次篇名');
      }
    }
  }

  // —— 三段式本传 + 史官总评
  const sb = p.structuredBiography ?? {};
  if (!isBrief) {
    for (const f of ['earlyLife', 'majorAchievements', 'turningPointsAndEnd']) {
      if (!isNonEmptyString(sb[f])) fail(label, `structuredBiography.${f} 为空`);
    }
  } else {
    // 简目人物允许只写能确证的那一段，其余留空；但至少得有一段，否则节点等于空壳
    const filled = ['earlyLife', 'majorAchievements', 'turningPointsAndEnd'].filter((f) => isNonEmptyString(sb[f]));
    if (!filled.length) fail(label, '简目人物也需至少填写一段 structuredBiography');
  }
  const ha = sb.historianAssessment;
  if (!isBrief) {
    if (!ha || !isNonEmptyString(ha.commentator) || !isNonEmptyString(ha.originalQuote) || !isNonEmptyString(ha.translation)) {
      fail(label, '史官总评（historianAssessment）不完整');
    } else {
      stats.personasWithAssessment += 1;
      if (!looksLikeClassical(ha.originalQuote)) note(label, '史官总评原话疑似非文言');
    }
  } else if (ha && isNonEmptyString(ha.originalQuote)) {
    // 简目人物若确实写出了评语原话，仍按 full 的标准校验，不允许半真半假
    stats.personasWithAssessment += 1;
    if (!looksLikeClassical(ha.originalQuote)) note(label, '史官总评原话疑似非文言');
  }

  // —— 画像四级梯度
  const pt = p.portrait;
  if (!pt) fail(label, '缺少 portrait');
  else {
    if (!PORTRAIT_TIERS.has(pt.tier)) fail(label, `portrait.tier 非法：${pt.tier}`);
    if (!isNonEmptyString(pt.sourceAttribution)) fail(label, '缺画像出处 sourceAttribution（防伪关键）');
    if (!isNonEmptyString(pt.aiReconstructionPrompt)) fail(label, '缺 aiReconstructionPrompt');

    // 远端图可为空：L3/L4 依 tier 降级到内置 SVG，由 portrait-resolver 运行时派生 URL
    const remoteTier = pt.tier === 'tier1_authentic_painting' || pt.tier === 'tier2_ancient_woodcut';
    const hasRemote = isNonEmptyString(pt.thumbnailUrl) || isNonEmptyString(pt.fullSizeUrl);
    if (remoteTier && !hasRemote) {
      fail(label, `${pt.tier} 属传世真迹/古籍版画，必须给出真实可用的图像 URL`);
    }
    for (const [k, v] of [
      ['thumbnailUrl', pt.thumbnailUrl],
      ['fullSizeUrl', pt.fullSizeUrl],
    ]) {
      if (!isNonEmptyString(v)) continue;
      if (!/^(https?:\/\/|\/|data:image\/)/.test(v)) fail(label, `portrait.${k} 既非 http(s)/站内路径，也不是 data URI：${v}`);
    }
    if (hasRemote && remoteTier) {
      // 传世作品的图源通常是 Wikimedia Commons / 故宫开放数据，附来源可追溯
      if (!/wikimedia|wikipedia|dpm\.org|commons/.test(pt.fullSizeUrl ?? '') && !/^\/data\//.test(pt.fullSizeUrl ?? '')) {
        note(label, 'L1/L2 图像 URL 非 Wikimedia Commons 等公版库，请确认版权归属');
      }
    }

    if (pt.classicalAppearanceQuote) {
      stats.personasWithAppearance += 1;
      const q = pt.classicalAppearanceQuote;
      if (!isNonEmptyString(q.quote) || !isNonEmptyString(q.bookSource) || !isNonEmptyString(q.translation)) {
        fail(label, 'classicalAppearanceQuote 三字段不全');
      } else if (!looksLikeClassical(q.quote)) {
        note(label, '相貌原文疑似非文言');
      }
    }
  }
}

/* ------------------------------ 关系边审计 ------------------------------ */

function auditEdge(where, e, seenEdgeIds) {
  const label = `${where} · 边 ${e.id ?? `${e.source}->${e.target}`}`;
  if (!isNonEmptyString(e.id)) fail(label, '缺少 id');
  else if (seenEdgeIds.has(e.id)) fail(label, `边 id 重复：${e.id}`);
  else seenEdgeIds.add(e.id);

  if (!declaredIds.has(e.source)) fail(label, `source 节点不存在：${e.source}`);
  if (!declaredIds.has(e.target)) fail(label, `target 节点不存在：${e.target}`);
  if (e.source === e.target) fail(label, '自环边（source === target）');
  if (!RELATION_CATEGORIES.has(e.primaryCategory)) fail(label, `primaryCategory 非法：${e.primaryCategory}`);
  if (!isNonEmptyString(e.specificLabel)) fail(label, '缺少 specificLabel 连线标签');
  else if (e.specificLabel.length > 8) note(label, `连线标签过长（${e.specificLabel.length} 字），画布上会被截断`);
  if (typeof e.directed !== 'boolean') fail(label, 'directed 必须是布尔值');
  if (!isNum(e.strength) || e.strength < 1 || e.strength > 10) fail(label, `strength 越界：${e.strength}`);
  if (!isNonEmptyString(e.overallSummary)) fail(label, '缺少 overallSummary 交集综述');
  // 原文引证与传目著录二选一：简目连线只有后者，但两者俱无的边不可接受
  if (e.keyCitation) auditCitation(label, e.keyCitation);
  else if (!isNonEmptyString(e.textualBasis?.bookTitle) || !isNonEmptyString(e.textualBasis?.volumeAndChapter)) {
    fail(label, '既无 keyCitation 原文引证，也无 textualBasis 传目著录');
  }

  if (isNum(e.startYear) && isNum(e.endYear) && e.startYear > e.endYear) {
    fail(label, `startYear ${e.startYear} 晚于 endYear ${e.endYear}`);
  }

  const phases = e.temporalPhases ?? [];
  if (phases.length) stats.edgesWithPhases += 1;
  stats.phases += phases.length;
  let prevEnd = -Infinity;
  for (const ph of [...phases].sort((x, y) => (x.startYear ?? -Infinity) - (y.startYear ?? -Infinity))) {
    const pw = `${label} 阶段「${ph.phaseLabel}」`;
    if (!isNonEmptyString(ph.phaseLabel)) fail(pw, '缺少 phaseLabel');
    if (!RELATION_CATEGORIES.has(ph.category)) fail(pw, `category 非法：${ph.category}`);
    if (!isNonEmptyString(ph.description)) fail(pw, '缺少 description');
    if (ph.citation) auditCitation(pw, ph.citation);
    if (isNum(ph.startYear) && isNum(ph.endYear) && ph.startYear > ph.endYear) {
      fail(pw, `startYear ${ph.startYear} 晚于 endYear ${ph.endYear}`);
    }
    if (isNum(ph.startYear) && ph.startYear < prevEnd) {
      fail(pw, `与前一阶段时序重叠（前一阶段止于 ${prevEnd}，本阶段起于 ${ph.startYear}）`);
    }
    prevEnd = isNum(ph.endYear) ? ph.endYear : prevEnd;
  }

  // —— 君臣边必须有「君」或「统属上级」在两端之一
  //
  // 这条规则拦的是两类硬伤：一是把政敌/盟友误标成君臣（史实层面错），
  // 二是把 A 的臣子挂到 B 身上（引用层面错，见图谱「曹操—刘备·君臣统属」旧例）。
  // 只记提示不判失败：扶苏以皇子监军、李建成以太子领东宫僚属，
  // 名分上确属统属，但未必带「皇帝」字样，需要人来判而不是机器。
  if (e.primaryCategory === 'monarch_subject') {
    const a = personIndex.get(e.source);
    const b = personIndex.get(e.target);
    const embodiesAuthority = (p) =>
      Boolean(p) &&
      (p.roles ?? []).some((role) => RULER_ROLES.some((kw) => String(role).includes(kw)));
    if (a && b && !embodiesAuthority(a) && !embodiesAuthority(b)) {
      note(
        label,
        `标为君臣统属，但两端（${a.name}／${b.name}）均无君主或统属上级身份，请复核是否应为盟友或政敌`,
      );
    }
  }
}

/* ------------------------------ 主流程 ------------------------------ */

function fmt(n) {
  return String(n).padStart(4, ' ');
}

async function main() {
  console.log('◈ 华夏史网 · 种子库独立审计');
  console.log(`  数据目录 ${DATA_DIR}\n`);

  const manifestPath = path.join(DATA_DIR, 'manifest.json');
  let manifestRaw;
  try {
    manifestRaw = await readFile(manifestPath, 'utf8');
  } catch {
    console.error(`✖ 找不到清单文件：${manifestPath}\n  请先执行 npm run seed:build`);
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (err) {
    console.error(`✖ manifest.json 不是合法 JSON：${err.message}`);
    process.exit(1);
  }

  // —— A. 清单结构
  if (!isNonEmptyString(manifest.schemaVersion)) fail('manifest', '缺少 schemaVersion');
  if (!isNonEmptyString(manifest.generatedAt) || Number.isNaN(Date.parse(manifest.generatedAt))) {
    fail('manifest', 'generatedAt 不是合法 ISO 时间');
  }
  if (!manifest.site?.title) fail('manifest', '缺少 site.title');
  if (!Array.isArray(manifest.shards) || !manifest.shards.length) fail('manifest', 'shards 为空');
  if (!Array.isArray(manifest.dynasties) || !manifest.dynasties.length) fail('manifest', 'dynasties 为空');
  if (!Array.isArray(manifest.searchIndex)) fail('manifest', 'searchIndex 不是数组');
  for (const d of manifest.dynasties ?? []) {
    if (!DYNASTY_IDS.has(d.id)) fail('manifest', `朝代枚举非法：${d.id}`);
    if (!isNum(d.startYear) || !isNum(d.endYear) || d.startYear > d.endYear) {
      fail('manifest', `朝代 ${d.id} 年份区间非法`);
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(d.primaryColor ?? '')) fail('manifest', `朝代 ${d.id} 主题色非 Hex`);
  }

  // —— 第一遍：载入全部分片并建立全局 id 索引（允许边跨分片前向引用）
  const loaded = [];
  for (const entry of manifest.shards ?? []) {
    const file = entry.file ?? `${entry.shardId}.json`;
    const shardPath = path.join(DATA_DIR, 'shards', file);
    let shard;
    try {
      shard = JSON.parse(await readFile(shardPath, 'utf8'));
    } catch (err) {
      fail(entry.shardId, `分片文件读取失败：${file}（${err.message}）`);
      continue;
    }
    loaded.push({ entry, shard, shardPath });
    for (const n of shard.nodes ?? []) if (n?.id) declaredIds.add(n.id);
  }

  // —— 第二遍：逐节点、逐边审计
  const seenEdgeIds = new Set();
  let actualPersons = 0;
  let actualEdges = 0;

  for (const { entry, shard, shardPath } of loaded) {
    stats.shards += 1;
    const where = entry.shardId;
    if (shard.shardId !== entry.shardId) fail(where, `分片内 shardId 与清单不符：${shard.shardId}`);
    if (!Array.isArray(shard.nodes) || !shard.nodes.length) fail(where, 'nodes 为空');
    if (!Array.isArray(shard.edges)) fail(where, 'edges 不是数组');
    if (!isNonEmptyString(shard.title) || !isNonEmptyString(shard.subtitle)) fail(where, '缺少 title / subtitle');
    if (!Array.isArray(shard.yearRange) || shard.yearRange.length !== 2) fail(where, 'yearRange 非法');
    if (!Array.isArray(shard.heroPersonIds) || !shard.heroPersonIds.length) fail(where, 'heroPersonIds 为空');

    for (const n of shard.nodes ?? []) auditPerson(where, n);
    for (const e of shard.edges ?? []) auditEdge(where, e, seenEdgeIds);

    for (const h of shard.heroPersonIds ?? []) {
      if (!isNonEmptyString(h)) fail(where, 'heroPersonIds 含空值');
    }

    actualPersons += shard.nodes?.length ?? 0;
    actualEdges += shard.edges?.length ?? 0;

    if ((shard.nodes?.length ?? 0) !== entry.personCount) {
      fail(where, `清单记 ${entry.personCount} 人，实际 ${shard.nodes?.length ?? 0} 人`);
    }
    if ((shard.edges?.length ?? 0) !== entry.edgeCount) {
      fail(where, `清单记 ${entry.edgeCount} 边，实际 ${shard.edges?.length ?? 0} 边`);
    }

    const size = (await stat(shardPath).catch(() => ({ size: 0 }))).size;
    console.log(
      `  · ${where.padEnd(26)} ${fmt(shard.nodes?.length ?? 0)} 人 / ${fmt(shard.edges?.length ?? 0)} 边 · ${(size / 1024).toFixed(1).padStart(6)} KB`,
    );
  }

  stats.persons = actualPersons;
  stats.edges = actualEdges;

  // —— A(续). 统计口径核对
  const s = manifest.stats ?? {};
  if (s.personCount !== actualPersons) fail('manifest', `stats.personCount ${s.personCount} ≠ 实际 ${actualPersons}`);
  if (s.edgeCount !== actualEdges) fail('manifest', `stats.edgeCount ${s.edgeCount} ≠ 实际 ${actualEdges}`);
  if (s.anecdoteCount !== stats.anecdotes) fail('manifest', `stats.anecdoteCount ${s.anecdoteCount} ≠ 实际 ${stats.anecdotes}`);
  if (s.shardCount !== (manifest.shards?.length ?? 0)) fail('manifest', `stats.shardCount 与分片数不符`);

  // —— B. 配额红线
  if (actualPersons < MIN_PERSONS) fail('quota', `合计人物 ${actualPersons} < 规范下限 ${MIN_PERSONS}`);
  if (actualEdges < MIN_EDGES) fail('quota', `合计关系边 ${actualEdges} < 规范下限 ${MIN_EDGES}`);

  // —— A(续). searchIndex 覆盖度
  const indexed = new Set((manifest.searchIndex ?? []).map((x) => x.id));
  const missing = [...declaredIds].filter((id) => !indexed.has(id));
  if (missing.length) fail('manifest', `searchIndex 漏收 ${missing.length} 人：${missing.slice(0, 6).join('、')}…`);
  const stale = [...indexed].filter((id) => !declaredIds.has(id));
  if (stale.length) fail('manifest', `searchIndex 含 ${stale.length} 个不存在的 id：${stale.slice(0, 6).join('、')}…`);
  for (const x of manifest.searchIndex ?? []) {
    if (!isNonEmptyString(x.aliasText)) note('manifest', `检索项 ${x.id} 的 aliasText 为空，仅能按姓名命中`);
  }

  // —— F. 本地画像落盘核对（传世图档为 .jpg，冠服装为 .svg，二者居其一即可）
  const portraitDir = path.join(DATA_DIR, 'portraits');
  const portraitFiles = new Set(await readdir(portraitDir).catch(() => []));
  for (const id of declaredIds) {
    const hasReal = portraitFiles.has(`${id}.jpg`) && portraitFiles.has(`full_${id}.jpg`);
    const hasSvg = portraitFiles.has(`${id}.svg`);
    if (hasReal) stats.personasWithRealPortrait = (stats.personasWithRealPortrait ?? 0) + 1;
    else if (hasSvg) stats.personasWithPortraitFile += 1;
    else note('portraits', `缺少本地画像 ${id}.jpg / ${id}.svg（画布将退回纯文字节点）`);
  }
  const orphans = [...portraitFiles].filter(
    (f) => f.endsWith('.svg') && !declaredIds.has(f.replace(/\.svg$/, '')),
  );
  if (orphans.length) note('portraits', `${orphans.length} 个孤儿画像文件（对应人物已移除）：${orphans.slice(0, 5).join('、')}`);
  if (stats.personasWithRealPortrait) {
    note(
      'portraits',
      `传世图档 ${stats.personasWithRealPortrait} 幅（jpg）／本站复原 ${stats.personasWithPortraitFile} 幅（svg）`,
    );
  }

  /* ------------------------------ 报告 ------------------------------ */

  const pct = (v) => `${((v / Math.max(1, stats.persons)) * 100).toFixed(1)}%`;

  console.log('\n◈ 内容丰满度');
  console.log(`  字号谥号齐备   ${fmt(stats.personasWithAlias)} / ${stats.persons}  ${pct(stats.personasWithAlias)}`);
  console.log(`  籍贯经纬度     ${fmt(stats.personasWithGeo)} / ${stats.persons}  ${pct(stats.personasWithGeo)}`);
  console.log(`  史官总评原话   ${fmt(stats.personasWithAssessment)} / ${stats.persons}  ${pct(stats.personasWithAssessment)}`);
  console.log(`  相貌原文考据   ${fmt(stats.personasWithAppearance)} / ${stats.persons}  ${pct(stats.personasWithAppearance)}`);
  console.log(
    `  画像覆盖       ${fmt(stats.personasWithPortraitFile + (stats.personasWithRealPortrait ?? 0))} / ${stats.persons}  ${pct(stats.personasWithPortraitFile + (stats.personasWithRealPortrait ?? 0))}` +
      `（传世图档 ${fmt(stats.personasWithRealPortrait ?? 0)} · 冠服复原 ${fmt(stats.personasWithPortraitFile)}）`,
  );
  console.log(`  年表事件总数   ${fmt(stats.timelineEvents)}（人均 ${(stats.timelineEvents / Math.max(1, stats.persons)).toFixed(1)} 条）`);
  console.log(`  轶事 / 引文    ${fmt(stats.anecdotes)} / ${fmt(stats.citations)}`);
  console.log(`  史料对勘条目   ${fmt(stats.conflicting)}`);
  console.log(`  带时序演变边   ${fmt(stats.edgesWithPhases)} / ${stats.edges}（共 ${stats.phases} 个关系阶段）`);
  console.log(`  引文附文库链接 ${fmt(stats.citationsWithUrl)} / ${stats.citations}`);

  if (warn.length) {
    console.log(`\n⚠ 提示 ${warn.length} 条`);
    warn.slice(0, STRICT ? warn.length : 20).forEach((w) => console.log(`   - ${w}`));
    if (!STRICT && warn.length > 20) console.log(`   … 另有 ${warn.length - 20} 条（--strict 可全部显示）`);
  }

  if (hard.length) {
    console.error(`\n✖ 硬性失败 ${hard.length} 项`);
    hard.slice(0, 60).forEach((h) => console.error(`   - ${h}`));
    if (hard.length > 60) console.error(`   … 另有 ${hard.length - 60} 项`);
    process.exit(1);
  }

  if (STRICT && warn.length) {
    console.error(`\n✖ --strict 模式下提示项视为失败`);
    process.exit(1);
  }

  console.log(`\n✓ 审计通过：${stats.persons} 人 / ${stats.edges} 边 / ${stats.anecdotes} 则轶事 / ${stats.citations} 条引文`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
