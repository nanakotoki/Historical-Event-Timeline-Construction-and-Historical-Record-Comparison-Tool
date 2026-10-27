/**
 * 种子数据构建工具（Seed Authoring Kit）
 * ------------------------------------------------------------------
 * 该模块只被 `src/data/*.ts`（考据源）与 `scripts/build-seed.mjs`（编译为静态分片）使用。
 * 前端运行时不引入它——前端只消费 `public/data/shards/*.json`。
 *
 * 设计目标：让人物考据数据「可读、可校验、少冗余」。
 *  - `C()`  史料引用：史书/卷次/原文/译文/可信度，id 由编译期统一生成
 *  - `G()`  古今地名与经纬度
 *  - `E()`  生平年表事件
 *  - `A()`  奇闻轶事
 *  - `P()`  人物节点（自动补全 id 前缀、画像、检索衍生物）
 */
import type {
  Anecdote,
  AnecdoteCategory,
  ConflictingAccount,
  DynastyId,
  GeoLocation,
  HistoricalCitation,
  HistoricalPersonNode,
  HistoricalRelationEdge,
  LifeEvent,
  PortraitInfo,
  PortraitTier,
  RelationCategory,
  SourceReliability,
  TemporalRelationPhase,
} from '../types/history';

/* ---------------------------------- 史料 ---------------------------------- */

export type CitationDraft = Omit<HistoricalCitation, 'id'>;

/**
 * 史料引用构造器。
 * @param bookTitle 史书名，如 "《三国志》"
 * @param volumeAndChapter 卷次篇名，如 "卷三十五·蜀书·诸葛亮传"
 * @param originalText 文言原文（必须与传世文本一致）
 * @param modernTranslation 白话译文
 * @param reliability 史源可信度
 * @param extra.authorOrCommentator 撰者/注者
 * @param extra.note 史学按语
 * @param extra.url 维基文库 / CText 链接
 */
export function C(
  bookTitle: string,
  volumeAndChapter: string,
  originalText: string,
  modernTranslation: string,
  reliability: SourceReliability = 'official_history_primary',
  extra: { author?: string; note?: string; url?: string } = {},
): CitationDraft {
  const citation: CitationDraft = {
    bookTitle,
    volumeAndChapter,
    originalText,
    modernTranslation,
    reliability,
  };
  if (extra.author) citation.authorOrCommentator = extra.author;
  if (extra.note) citation.historiographicalNote = extra.note;
  if (extra.url) citation.wikisourceUrl = extra.url;
  return citation;
}

/** 维基文库篇章常用直链前缀 */
export const WS = {
  shiji: (title: string) => `https://zh.wikisource.org/wiki/史記/${title}`,
  hanshu: (title: string) => `https://zh.wikisource.org/wiki/漢書/${title}`,
  houhanshu: (title: string) => `https://zh.wikisource.org/wiki/後漢書/${title}`,
  sanguozhi: (title: string) => `https://zh.wikisource.org/wiki/三國志/${title}`,
  jinshu: (title: string) => `https://zh.wikisource.org/wiki/晉書/${title}`,
  suishu: (title: string) => `https://zh.wikisource.org/wiki/隋書/${title}`,
  jiutangshu: (title: string) => `https://zh.wikisource.org/wiki/舊唐書/${title}`,
  xintangshu: (title: string) => `https://zh.wikisource.org/wiki/新唐書/${title}`,
  shishuoxinyu: (title: string) => `https://zh.wikisource.org/wiki/世說新語/${title}`,
  tongjian: (title: string) => `https://zh.wikisource.org/wiki/資治通鑑/${title}`,
};

/* --------------------------------- 地理 --------------------------------- */

export function G(ancientName: string, modernName: string, lng: number, lat: number): GeoLocation {
  return { ancientName, modernName, coordinates: [lng, lat] };
}

/* -------------------------------- 生平事件 -------------------------------- */

export function E(
  year: number,
  eraNameYear: string | undefined,
  age: number | undefined,
  title: string,
  description: string,
  location?: GeoLocation,
  participatingPersonIds?: string[],
  citation?: CitationDraft,
): LifeEvent {
  const event: LifeEvent = { id: 'tmp', year, title, description };
  if (eraNameYear) event.eraNameYear = eraNameYear;
  if (typeof age === 'number') event.age = age;
  if (location) event.location = location;
  if (participatingPersonIds?.length) event.participatingPersonIds = participatingPersonIds;
  if (citation) event.citation = citation as unknown as HistoricalCitation;
  return event;
}

/* -------------------------------- 奇闻轶事 -------------------------------- */

export function A(
  title: string,
  idiomOrAllusion: string | undefined,
  category: AnecdoteCategory,
  narrativeSummary: string,
  relatedPersonIds: string[],
  primaryCitation: CitationDraft,
  conflictingAccounts?: ConflictingAccount[],
): Anecdote {
  return {
    id: 'tmp',
    title,
    ...(idiomOrAllusion ? { idiomOrAllusion } : {}),
    category,
    narrativeSummary,
    relatedPersonIds,
    primaryCitation: primaryCitation as unknown as HistoricalCitation,
    ...(conflictingAccounts ? { conflictingAccounts } : {}),
  };
}

/** 史料对勘条目 */
export function CA(sourceName: string, stanceOrBias: string, citation: CitationDraft): ConflictingAccount {
  return { sourceName, stanceOrBias, citation: citation as unknown as HistoricalCitation };
}

/* -------------------------------- 四级画像 -------------------------------- */

/**
 * 画像构造器。
 * 首发种子库不依赖外网图床：L3/L4 一律由 `portrait-svg.ts` 依朝代冠服规制
 * 本地生成高清 SVG 立轴，编译期写入 `public/data/portraits/`。
 * 若上游 ETL 接入了真迹（L1）或版画（L2），则在此传入远端 URL。
 */
export function P(
  tier: PortraitTier,
  sourceAttribution: string,
  classicalAppearance?: { quote: string; bookSource: string; translation: string },
  options: { painterOrBook?: string; fullSizeUrl?: string; thumbnailUrl?: string } = {},
): Omit<PortraitInfo, 'aiReconstructionPrompt'> {
  return {
    thumbnailUrl: options.thumbnailUrl ?? '',
    fullSizeUrl: options.fullSizeUrl ?? '',
    tier,
    sourceAttribution,
    ...(options.painterOrBook ? { painterOrBook: options.painterOrBook } : {}),
    ...(classicalAppearance ? { classicalAppearanceQuote: classicalAppearance } : {}),
  };
}

/* -------------------------------- 人物节点 -------------------------------- */

export interface PersonDraft {
  /** 不带 person_ 前缀的短 id，如 'xiang_yu' */
  id: string;
  name: string;
  zi?: string;
  hao?: string[];
  shi?: string;
  miao?: string;
  nian?: string[];
  jue?: string[];
  hui?: string;
  cbdbId?: number;
  gender?: 'male' | 'female' | 'eunuch';
  dyn: DynastyId;
  faction?: string;
  born?: number;
  died?: number;
  uncertain?: boolean;
  origin?: GeoLocation;
  roles: string[];
  titles: string[];
  weight: number;
  summary: string;
  /** [早年与崛起, 核心功业, 转折与结局] */
  bio: [string, string, string];
  /** [史官署名, 原话, 白话] */
  assess: [string, string, string];
  portrait: Omit<PortraitInfo, 'aiReconstructionPrompt'>;
  timeline: LifeEvent[];
  anecdotes?: Anecdote[];
  sources: CitationDraft[];
}

export function p(draft: PersonDraft): HistoricalPersonNode {
  const aliases: HistoricalPersonNode['aliases'] = {};
  if (draft.zi) aliases.courtesyName = draft.zi;
  if (draft.hao?.length) aliases.pseudonyms = draft.hao;
  if (draft.shi) aliases.posthumousTitle = draft.shi;
  if (draft.miao) aliases.templeName = draft.miao;
  if (draft.nian?.length) aliases.eraNames = draft.nian;
  if (draft.jue?.length) aliases.feudalTitles = draft.jue;
  if (draft.hui) aliases.tabooNotes = draft.hui;

  return {
    id: `person_${draft.id}`,
    ...(draft.cbdbId ? { cbdbId: draft.cbdbId } : {}),
    name: draft.name,
    aliases,
    gender: draft.gender ?? 'male',
    dynasty: draft.dyn,
    ...(draft.faction ? { factionOrClan: draft.faction } : {}),
    ...(typeof draft.born === 'number' ? { birthYear: draft.born } : {}),
    ...(typeof draft.died === 'number' ? { deathYear: draft.died } : {}),
    ...(draft.uncertain ? { birthYearUncertain: true } : {}),
    ...(draft.origin ? { birthplace: draft.origin } : {}),
    roles: draft.roles,
    officialTitles: draft.titles,
    importanceWeight: draft.weight,
    portrait: {
      ...draft.portrait,
      aiReconstructionPrompt: '', // 编译期由 portrait-resolver 的提示词模板统一填充
    },
    oneLineSummary: draft.summary,
    structuredBiography: {
      earlyLife: draft.bio[0],
      majorAchievements: draft.bio[1],
      turningPointsAndEnd: draft.bio[2],
      historianAssessment: {
        commentator: draft.assess[0],
        originalQuote: draft.assess[1],
        translation: draft.assess[2],
      },
    },
    lifeTimeline: draft.timeline,
    anecdotes: draft.anecdotes ?? [],
    primarySources: draft.sources as unknown as HistoricalCitation[],
  };
}

/* ------------------------------ 简目人物构造 ------------------------------ */

/**
 * 简目人物草稿（annotationLevel = 'brief'）。
 *
 * 全站要铺到六百人量级，但维基文库与 ctext 在本机都不可达，文言原文只能人工录入。
 * 靠记忆默写五百段原文，错一句就是伪造引文——所以简目档**不写原文**，
 * 只著录三样可核查的东西：此人是谁、本传在哪一卷、生平骨架如何。
 *
 * 与 `p()` 的差别：
 *  - 不写 `sources`（原文引证），改写 `chapters`（传目著录）
 *  - 不写 `assess`（史官评语），没有就是没有
 *  - `timeline` 用 [年, 事件, 说明] 三元组，省掉模板噪声
 *  - 画像默认落 L4 冠服剪影，因为多数简目人物既无传世像、也无形貌记载；
 *    若画像流程真的取到了宫藏卷轴或古籍版画，由 build-seed 按实物覆写
 *
 * 档案页会把档位标出来，读者能分清哪条有原文撑着、哪条只是传目。
 */
export interface BriefPersonDraft {
  /** 不带 person_ 前缀的短 id，如 'ji_xin' */
  id: string;
  name: string;
  zi?: string;
  hao?: string[];
  /**
   * 庙号（如「圣宗」「熙宗」）。简目档同样需要，理由有二：
   *  ① 辽金西夏诸帝的本名（耶律隆绪、完颜亶）反不如庙号通行，
   *     读者搜「辽圣宗」必须能命中，否则等于搜不到；
   *  ② 帝王与后妃的「号」是尊号（应天太后），与庙号是两套东西，
   *     混进 `hao` 会让档案页把庙号显示成「别号」，是错的。
   * 故与考据档 `p()` 同口径，单列 templeName。
   */
  miao?: string;
  /** 年号，如 ['统和', '开泰', '太平'] */
  nian?: string[];
  dyn: DynastyId;
  faction?: string;
  /** 缺省为男；后妃、女官、才女须显式声明 */
  gender?: 'male' | 'female' | 'eunuch';
  born?: number;
  died?: number;
  /** 生卒史载不详或仅存大致时段时置 true */
  uncertain?: boolean;
  origin: GeoLocation;
  roles: string[];
  titles?: string[];
  weight: number;
  summary: string;
  /** 只写确实能确证的段落，顺序为「早年 / 功业 / 结局」；缺的留空 */
  bio?: [string?, string?, string?];
  /** [公元年, 事件标题, 事件说明] */
  timeline: Array<[number, string, string]>;
  /** [史书名, 卷次篇名]——例如 ['《三国志》', '卷三十五·蜀书·诸葛亮传'] */
  chapters: Array<[string, string]>;
  /** 仅当确有传世画像/古籍版画时才指定，否则留空走 L4 */
  portraitTier?: PortraitTier;
  portraitNote?: string;
}

export function pb(draft: BriefPersonDraft): HistoricalPersonNode {
  const aliases: HistoricalPersonNode['aliases'] = {};
  if (draft.zi) aliases.courtesyName = draft.zi;
  if (draft.hao?.length) aliases.pseudonyms = draft.hao;
  if (draft.miao) aliases.templeName = draft.miao;
  if (draft.nian?.length) aliases.eraNames = draft.nian;

  const [earlyLife, majorAchievements, turningPointsAndEnd] = draft.bio ?? [];

  return {
    id: `person_${draft.id}`,
    name: draft.name,
    aliases,
    gender: draft.gender ?? 'male',
    dynasty: draft.dyn,
    ...(draft.faction ? { factionOrClan: draft.faction } : {}),
    ...(typeof draft.born === 'number' ? { birthYear: draft.born } : {}),
    ...(typeof draft.died === 'number' ? { deathYear: draft.died } : {}),
    ...(draft.uncertain ? { birthYearUncertain: true } : {}),
    birthplace: draft.origin,
    roles: draft.roles,
    officialTitles: draft.titles ?? [],
    importanceWeight: draft.weight,
    portrait: {
      thumbnailUrl: '',
      fullSizeUrl: '',
      tier: draft.portraitTier ?? 'tier4_attire_silhouette',
      sourceAttribution:
        draft.portraitNote ?? '本站依朝代冠服制度生成的冠服剪影；此人无传世画像，本传亦未载形貌。',
      aiReconstructionPrompt: '',
    },
    oneLineSummary: draft.summary,
    structuredBiography: {
      earlyLife: earlyLife ?? '',
      majorAchievements: majorAchievements ?? '',
      turningPointsAndEnd: turningPointsAndEnd ?? '',
    },
    lifeTimeline: draft.timeline.map(([year, title, description]) => ({ id: 'tmp', year, title, description })),
    anecdotes: [],
    primarySources: [],
    annotationLevel: 'brief',
    sourceChapters: draft.chapters.map(([bookTitle, volumeAndChapter]) => ({ bookTitle, volumeAndChapter })),
  } as HistoricalPersonNode;
}

/* -------------------------------- 关系边 ---------------------------------- */

export function R(
  id: string,
  source: string,
  target: string,
  primaryCategory: RelationCategory,
  specificLabel: string,
  directed: boolean,
  strength: number,
  overallSummary: string,
  keyCitation: CitationDraft,
  extra: {
    startYear?: number;
    endYear?: number;
    temporalPhases?: TemporalRelationPhase[];
  } = {},
): HistoricalRelationEdge {
  const edge: HistoricalRelationEdge = {
    id: `edge_${id}`,
    source: `person_${source}`,
    target: `person_${target}`,
    primaryCategory,
    specificLabel,
    directed,
    strength,
    overallSummary,
    keyCitation: keyCitation as unknown as HistoricalCitation,
  };
  if (typeof extra.startYear === 'number') edge.startYear = extra.startYear;
  if (typeof extra.endYear === 'number') edge.endYear = extra.endYear;
  if (extra.temporalPhases?.length) edge.temporalPhases = extra.temporalPhases;
  return edge;
}

/**
 * 简目连线构造器。
 *
 * 与 `R()` 的差别只有一个：不传原文引证，改传 `[书名, 卷次篇名]`。
 * 简目人物之间多有确凿关系（同传、同案、同役），但我拿不到可逐字校对的原文，
 * 于是只著录「此关系见于某书某卷」，让读者能自行翻检，而不必相信我默写的句子。
 */
export function rb(
  id: string,
  source: string,
  target: string,
  primaryCategory: RelationCategory,
  specificLabel: string,
  directed: boolean,
  strength: number,
  overallSummary: string,
  basis: [bookTitle: string, volumeAndChapter: string],
  extra: {
    startYear?: number;
    endYear?: number;
    temporalPhases?: TemporalRelationPhase[];
  } = {},
): HistoricalRelationEdge {
  const edge: HistoricalRelationEdge = {
    id: `edge_${id}`,
    source: `person_${source}`,
    target: `person_${target}`,
    primaryCategory,
    specificLabel,
    directed,
    strength,
    overallSummary,
    textualBasis: { bookTitle: basis[0], volumeAndChapter: basis[1] },
  };
  if (typeof extra.startYear === 'number') edge.startYear = extra.startYear;
  if (typeof extra.endYear === 'number') edge.endYear = extra.endYear;
  if (extra.temporalPhases?.length) edge.temporalPhases = extra.temporalPhases;
  return edge;
}

/** 时序关系阶段 */
export function PH(
  phaseLabel: string,
  category: RelationCategory,
  startYear: number,
  endYear: number,
  description: string,
  citation?: CitationDraft,
): TemporalRelationPhase {
  return {
    phaseLabel,
    category,
    startYear,
    endYear,
    description,
    ...(citation ? { citation: citation as unknown as HistoricalCitation } : {}),
  };
}

/* ------------------------------- 检索工具 -------------------------------- */

export const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/** 公元年份 → 中文纪年文本，如 -206 → "公元前206年" */
export function yearLabel(year: number | undefined): string {
  if (typeof year !== 'number') return '史载不详';
  return year < 0 ? `公元前${Math.abs(year)}年` : `公元${year}年`;
}
