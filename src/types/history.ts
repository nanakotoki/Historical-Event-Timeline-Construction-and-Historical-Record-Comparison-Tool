/**
 * 华夏史网 ChronoGraph China —— 核心史学数据模型
 * ------------------------------------------------------------------
 * 本文件为全站唯一的数据契约（Single Source of Truth）。
 * Python ETL 侧 `scripts/etl/schema_validator.py` 的 Pydantic 模型与
 * 下述 TypeScript 接口逐字段对齐，任何一侧改动都必须同步另一侧。
 *
 * 设计要点：
 *  1. 多称谓体系（字 / 号 / 谥号 / 庙号 / 年号 / 封爵 / 避讳）
 *  2. 时序动态关系（TemporalRelationPhase 状态机，支持时间轴变色）
 *  3. 正史 / 注疏 / 笔记三级史源可信度分级（杜绝幻觉）
 *  4. 互见法（official_history_hujian）与「罗生门」史料对勘
 *  5. 四级画像体系（真迹 → 版画 → AI 复原 → 冠服剪影）
 */

/**
 * 1. 历史朝代与二十四史对应枚举
 */
export type DynastyId =
  | 'pre_qin' // 先秦（《史记》五帝至战国）
  | 'qin' // 秦（前221 - 前207，《史记》）
  | 'chu_han' // 楚汉之际（前206 - 前202，《史记》《汉书》）
  | 'western_han' // 西汉（前202 - 8，《史记》《汉书》）
  | 'xin' // 新朝与更始（9 - 25，《汉书》《后汉书》）
  | 'eastern_han' // 东汉（25 - 220，《后汉书》《三国志》）
  | 'three_kingdoms' // 三国（220 - 280，《三国志》）
  | 'jin' // 西晋与东晋（266 - 420，《晋书》）
  | 'southern_northern' // 南北朝（420 - 589，《宋书》《南齐书》《梁书》《陈书》《魏书》《北齐书》《周书》《南史》《北史》）
  | 'sui' // 隋（581 - 618，《隋书》）
  | 'tang' // 唐（618 - 907，《旧唐书》《新唐书》）
  | 'five_dynasties' // 五代十国（907 - 979，《旧五代史》《新五代史》）
  | 'song' // 北宋与南宋（960 - 1279，《宋史》）
  | 'liao_jin_xia' // 辽、金、西夏（907 - 1234，《辽史》《金史》《宋史》）
  | 'yuan' // 元（1271 - 1368，《元史》）
  | 'ming' // 明（1368 - 1644，《明史》）
  | 'qing'; // 清（1636 - 1912，《清史稿》延伸）

export interface DynastyMeta {
  id: DynastyId;
  name: string; // 如 "三国"
  startYear: number; // 如 220（公元前为负数）
  endYear: number; // 如 280
  primaryColor: string; // 朝代主题色 Hex，用于节点外圈与图例
  canonicalBooks: string[]; // 对应二十四史书目，如 ["《三国志》", "《后汉书》", "《晋书》"]
  shardFile: string; // 对应的数据分片文件名
}

/**
 * 2. 史料来源分级与引用模型（杜绝 AI 幻觉的核心约束）
 */
export type SourceReliability =
  | 'official_history_primary' // 二十四史本传/本纪/世家正文（最高权威度）
  | 'official_history_hujian' // 二十四史"互见法"他传记载（如在《项羽本纪》中记载刘邦言行）
  | 'authoritative_commentary' // 权威史家注疏（如裴松之《三国志注》、司马贞《史记索隐》、张守节《史记正义》、颜师古《汉书注》）
  | 'chronicle_corroboration' // 编年体与政书佐证（如司马光《资治通鉴》《资治通鉴考异》、《通典》）
  | 'literary_anecdotal'; // 魏晋唐宋笔记小说与野史轶闻（如《世说新语》《西京杂记》《朝野佥载》《太平广记》）

export interface HistoricalCitation {
  id: string;
  bookTitle: string; // 史书名，如 "《三国志》" 或 "《三国志注》引《魏氏春秋》"
  volumeAndChapter: string; // 卷次与篇名，如 "卷三十五·蜀书·诸葛亮传"
  authorOrCommentator?: string; // 撰者或注者，如 "陈寿 撰 / 裴松之 注"
  originalText: string; // 严格的文言文原文摘录（必须与传世文本一致）
  modernTranslation: string; // 准确通顺的现代汉语白话译文
  reliability: SourceReliability; // 史源可信度分级
  historiographicalNote?: string; // 史学按语/考异说明（用于解释史料背景或真伪辨析）
  wikisourceUrl?: string; // 维基文库或中国哲学书电子化计划（CText）对应篇章链接
}

/**
 * 3. 多源史料对勘模型（"罗生门"争议历史事件视图）
 */
export interface ConflictingAccount {
  sourceName: string; // 史书来源，如 "《旧唐书·隐太子建成传》" vs "《资治通鉴考异》"
  stanceOrBias: string; // 史官立场分析，如 "贞观官修史书倾向"
  citation: HistoricalCitation;
}

/**
 * 4. 奇闻轶事与人物性格切面模型
 */
export type AnecdoteCategory =
  | 'eccentric_demeanor' // 魏晋风度/怪癖性情（如竹林七贤、扪虱而谈、好驴鸣）
  | 'wit_and_strategem' // 急智诡道/妙语机锋（如捉刀人、望梅止渴、唾面自干）
  | 'physiognomy_omen' // 异相奇征/方术预言（如重瞳、隆准龙颜、顾自见其耳）
  | 'culinary_lifestyle' // 饮食起居/生活细节（如东坡肉、王恺石崇斗富、啖生彘肩）
  | 'literary_romance' // 诗酒风流/情感轶事（如文君夜奔、却扇诗、沈园春游）
  | 'historical_mystery'; // 史海疑云/罗生门争议（如烛影斧声、太史慈死年之谜）

export interface Anecdote {
  id: string;
  title: string; // 轶事标题，如 "床头捉刀人"、"闻鸡起舞"、"泣下沾襟"
  idiomOrAllusion?: string; // 衍生出的成语或典故，如 "捉刀"、"闻鸡起舞"
  category: AnecdoteCategory;
  narrativeSummary: string; // 轶事背景与白话故事脉络
  relatedPersonIds: string[]; // 该轶事涉及的其他人物节点 ID（支持点击跳转）
  primaryCitation: HistoricalCitation; // 核心史料出处
  conflictingAccounts?: ConflictingAccount[]; // 若不同史书对此事记载矛盾，提供"史料对勘"数组
}

/**
 * 5. 四级画像考据与视觉模型
 */
export type PortraitTier =
  | 'tier1_authentic_painting' // L1: 传世古画真迹/宫廷定本（如故宫南薰殿帝王像、阎立本历代帝王图）
  | 'tier2_ancient_woodcut' // L2: 明清古籍木刻版画（如《三才图会》《晚笑堂竹庄画传》《古圣贤像传略》）
  | 'tier3_ai_reconstructed' // L3: 据二十四史外貌描写原文 + 朝代冠服规制 AI 复原图
  | 'tier4_attire_silhouette'; // L4: 符合朝代、官阶与性别的传统白描冠冕剪影

export interface PortraitInfo {
  thumbnailUrl: string; // 画布节点渲染用的圆形头像 URL
  fullSizeUrl: string; // 点开大图（Lightbox）展示的高清完整立轴/半身像 URL
  tier: PortraitTier; // 画像考据等级
  /**
   * 圆里头像的取景窗口，归一化到整幅宽高（side 为相对图宽的边长）。
   * 由 scripts/portraits/build-crops.mjs 依版式算出、逐件过目后写入；
   * 缺省时画布按纵横比兜底。**这不是装饰参数**——取景错位会把
   * 半身像裁成一顶帽子，让「有画像的人」看起来像没有画像。
   */
  crop?: { sx: number; sy: number; side: number; lum?: number; lo?: number; hi?: number };
  sourceAttribution: string; // 馆藏或古籍出处，如 "台北故宫博物院藏《南薰殿历代帝王像》绢本设色"
  painterOrBook?: string; // 画师或版画书名，如 "（唐）阎立本" 或 "（明）王圻《三才图会》"
  classicalAppearanceQuote?: {
    // 史书关于此人外貌、身高、神态的原文记载
    quote: string; // 如 "身长八尺，容貌甚伟，时人异焉"
    bookSource: string; // 如 "《三国志·蜀书·诸葛亮传》"
    translation: string; // 白话解释
  };
  aiReconstructionPrompt?: string; // 若为 L3/L4，自动附带严格考据的古画复原提示词供用户复制或重绘
}

/**
 * 6. 生平时间线与地理空间坐标模型
 */
export interface GeoLocation {
  ancientName: string; // 历史古地名，如 "琅邪阳都"、"沛国谯县"、"黄州"
  modernName: string; // 现代行政区划名，如 "山东省临沂市沂南县"
  /**
   * [经度 lng, 纬度 lat]，用于历史轨迹地图绘制。
   *
   * **可缺省。** 伶人、画工、宦官、寒门女子这一类，正史往往只记「不知何许人」；
   * 此时该记的是「籍贯史载不详」，而不是给一个人为坐标——后者会让轨迹地图
   * 在几内亚湾画出一个点，比留白更糟。缺省者不参与轨迹绘制。
   */
  coordinates?: [number, number];
}

export interface LifeEvent {
  id: string;
  year: number; // 公元纪年（公元前用负数，如 -206 表示公元前206年）
  eraNameYear?: string; // 帝王年号纪年，如 "汉高帝元年"、"建安十三年"
  age?: number; // 当时年龄
  title: string; // 事件名称，如 "鸿门宴"、"隆中对"、"赤壁之战"
  description: string; // 事件详细经过
  location?: GeoLocation; // 事件发生地点（用于绘制人物一生空间迁徙轨迹）
  participatingPersonIds?: string[]; // 共同参与该事件的人物 ID
  citation?: HistoricalCitation; // 史料依据
}

/**
 * 7. 人物节点全息模型（HistoricalPersonNode）
 */
export interface HistoricalPersonNode {
  id: string; // 全局唯一且可读的 ID，如 "person_liu_bang", "person_cao_cao"
  cbdbId?: number; // 对应的哈佛 CBDB 人物 ID（如曹操为 11495），便于学术库联查
  name: string; // 主显示姓名，如 "曹操"
  aliases: {
    courtesyName?: string; // 字，如 "孟德"
    pseudonyms?: string[]; // 号/小字/别称，如 ["阿瞒", "吉利"]
    posthumousTitle?: string; // 谥号，如 "武皇帝" / "忠武侯"
    templeName?: string; // 庙号，如 "太祖" / "高祖"
    eraNames?: string[]; // 年号（帝王专属），如 ["贞观"]
    feudalTitles?: string[]; // 封爵或常见史书称谓，如 ["魏王", "武平侯", "曹公"]
    tabooNotes?: string; // 避讳说明，如 "因避唐太宗李世民讳，唐修史书或省作'民'或改称"
  };
  gender: 'male' | 'female' | 'eunuch';
  dynasty: DynastyId; // 主要归属朝代
  factionOrClan?: string; // 所属政治集团或门阀世家，如 "曹魏集团"、"蜀汉集团"、"琅琊王氏"、"关陇集团"
  birthYear?: number; // 出生公元年份（不确定可为近似值）
  deathYear?: number; // 逝世公元年份
  birthYearUncertain?: boolean; // 生卒年是否史载不详
  birthplace?: GeoLocation; // 籍贯/郡望
  roles: string[]; // 核心身份标签，如 ["开国皇帝", "军事家"] 或 ["丞相", "文学家", "书法家"]
  officialTitles: string[]; // 历任核心官职，如 ["司空", "丞相", "领冀州牧"]
  importanceWeight: number; // 历史中心度权重 (1 ~ 100)，决定宏观缩放（LOD）时的显示层级与节点半径
  portrait: PortraitInfo; // 四级画像与相貌考据对象
  oneLineSummary: string; // 50字以内的史学定评/核心定位
  structuredBiography: {
    earlyLife: string; // 早年经历与崛起背景
    majorAchievements: string; // 核心历史功业与重大决策
    turningPointsAndEnd: string; // 人生转折与最终结局
    /**
     * 历代史官原话总评（如"太史公曰"、"陈寿评曰"、"赞曰"）。
     * 简目人物多无专评，此时整块缺省——宁可不写，也不代史官立言。
     */
    historianAssessment?: {
      commentator: string; // 如 "陈寿《三国志》评曰"
      originalQuote: string; // 如 "汉末，天下大乱，雄豪并起……抑可谓非常之人，超世之杰矣。"
      translation: string;
    };
  };
  lifeTimeline: LifeEvent[]; // 纵向生平大事年表（同时驱动空间轨迹图）
  anecdotes: Anecdote[]; // 奇闻轶事与他传互见列表
  primarySources: HistoricalCitation[]; // 二十四史本传核心文白对照段落

  /**
   * 考据深度档位——决定这个节点「有多少证据撑着」。
   *
   * - `full`（默认）：本传原文 ≥ 2 段、轶事 ≥ 1 则、史官评语原话齐备。
   * - `brief`：只著录可核查的传目与生平骨干，**不附原文引证**。
   *
   * 为什么要有这一档：全站要铺到六百人量级，而维基文库与 ctext 在本机均不可达，
   * 文言原文只能人工录入。规模一上来，记错一句就是伪造引文——那比少几个人严重得多。
   * 与其让五百条引文里混进讹误，不如把「此人只到简目」写在脸上：
   * 档案页显式标注档位，读者一眼能看出哪条有原文撑着、哪条只是传目著录。
   */
  annotationLevel?: 'full' | 'brief'; // 缺省视为 full

  /**
   * 简目人物专用：本传所在的卷次篇名。
   * 这是**可核查的著录信息**（此人确有传、在哪一卷），不是原文引证，
   * 因此与 `primarySources` 分开建模，避免读者把篇目当成已核的引文。
   */
  sourceChapters?: { bookTitle: string; volumeAndChapter: string }[];
}

/**
 * 8. 多维时序人物关系边模型（HistoricalRelationEdge）
 */
export type RelationCategory =
  | 'kinship_blood' // 直系/旁系血亲（父子、母子、兄弟、叔侄、祖孙）
  | 'kinship_marriage' // 姻亲与后宫（夫妻、岳婿、连襟、外戚联姻）
  | 'monarch_subject' // 君臣、主公与谋士/武将、上下级统属
  | 'political_ally' // 政治盟友、同党、举荐（伯乐与千里马）
  | 'political_rival' // 朝堂政敌、党争对手、夺嫡之争、构陷诛杀
  | 'military_adversary' // 沙场宿敌、战役交锋对手
  | 'mentor_disciple' // 师承、座主与门生、学术传承
  | 'literary_bosom'; // 诗酒至交、文学唱和、竹林之游

export interface TemporalRelationPhase {
  startYear?: number; // 该阶段关系起始年
  endYear?: number; // 该阶段关系结束年
  phaseLabel: string; // 阶段关系定性，如 "结义反秦" -> "鸿门猜忌" -> "楚汉死敌"
  category: RelationCategory; // 该阶段对应的关系大类（支持随时间轴动态变色！）
  description: string; // 该阶段两人互动的具体史实
  citation?: HistoricalCitation;
}

export interface HistoricalRelationEdge {
  id: string;
  source: string; // 源节点 Person ID
  target: string; // 目标节点 Person ID
  primaryCategory: RelationCategory; // 默认主关系类别
  specificLabel: string; // 画布连线上显示的精炼标签（2~6字），如 "父子"、"三顾茅庐"、"赤壁对手"、"玄武门相残"
  directed: boolean; // 是否为有向边（如 父->子、君->臣、师->徒 为 true；同僚、夫妻、对手为 false）
  strength: number; // 关系紧密程度 (1 ~ 10)，决定力导向图的弹簧距离（Strength 越大距离越近）
  startYear?: number; // 两人产生历史交集的起始年份
  endYear?: number; // 交集结束年份
  overallSummary: string; // 两人一生恩怨交集综述
  temporalPhases?: TemporalRelationPhase[]; // 时序关系演变状态机（用于展示复杂多变的历史人际关系）
  /**
   * 证明两人关系的核心二十四史引文。
   * 简目人物之间的连线可能只有传目可指，此时本字段缺省，改由 textualBasis 承载。
   */
  keyCitation?: HistoricalCitation;
  /**
   * 简目连线专用：该关系见于某书某卷的著录（可核查的元数据，不是原文引证）。
   * 与 keyCitation 二选一，至少要有一个，否则这条边无从追溯。
   */
  textualBasis?: { bookTitle: string; volumeAndChapter: string };
}

/* ==================================================================
 * 以下为前端运行时所需的派生类型（数据分片 / 清单 / 视图状态）
 * ================================================================== */

export interface ShardDataset {
  shardId: string;
  title: string;
  subtitle: string;
  dynasties: DynastyId[];
  yearRange: [number, number];
  heroPersonIds: string[];
  nodes: HistoricalPersonNode[];
  edges: HistoricalRelationEdge[];
}

export interface ManifestShardEntry {
  shardId: string;
  file: string;
  title: string;
  subtitle: string;
  dynasties: DynastyId[];
  yearRange: [number, number];
  personCount: number;
  edgeCount: number;
  byteSize?: number;
}

export interface ManifestSearchEntry {
  id: string;
  name: string;
  /** 全量检索别名（字、号、谥号、庙号、封爵、官职）以空格连接 */
  aliasText: string;
  dynasty: DynastyId;
  shardId: string;
  importanceWeight: number;
}

export interface GraphManifest {
  schemaVersion: string;
  generatedAt: string;
  site: {
    title: string;
    subtitle: string;
    edition: string;
  };
  stats: {
    personCount: number;
    edgeCount: number;
    anecdoteCount: number;
    citationCount: number;
    dynastyCount: number;
    shardCount: number;
  };
  dynasties: DynastyMeta[];
  shards: ManifestShardEntry[];
  searchIndex: ManifestSearchEntry[];
  /** 首页欢迎面板的高亮统计条 */
  highlights: { label: string; value: string; note: string }[];
  /** 尚未入库、但在路线图中已规划的时代分片 */
  plannedShards?: { shardId: string; title: string; status: string }[];
}

/** 图谱视图布局模式 */
export type GraphLayoutMode = 'force' | 'lineage' | 'swimlane';

/** 主题模式 */
export type ThemeMode = 'light' | 'dark';

/** 画布 LOD 层级 */
export type LodLevel = 1 | 2 | 3;

/** 时间轴过滤状态 */
export interface TimeWindow {
  startYear: number;
  endYear: number;
  /** 单年历史截面模式（此时 startYear === endYear，关系边按 temporalPhases 动态变色） */
  singleYearMode: boolean;
}
