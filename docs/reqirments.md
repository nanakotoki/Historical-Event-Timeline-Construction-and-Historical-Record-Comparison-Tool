# 华夏史网（ChronoGraph China）—— 二十四史全量人物关系图谱与数字人文史料引擎
## 全局系统架构与工程实现规范文档（Master Specification for AI Coding Agent）

---

## 0. Agent 执行最高准则（CRITICAL RULES FOR AI AGENT）

作为本项目的核心研发 Agent，你在编写任何代码、构建任何数据或设计任何组件时，必须严格遵守以下五条铁律：

1. **史料真实性铁律（Zero Historical Hallucination）**：
   - 严禁将演义小说（如《三国演义》《隋唐演义》《杨家将》）的情节混淆为正史（《三国志》《旧唐书》《宋史》）。
   - 所有人物的生平与奇闻轶事必须绑定 `HistoricalCitation` 对象，明确标注出自哪一部史书、哪一卷、哪一传，并提供准确的文言文原文摘录。
   - 若某则著名轶事出自注疏（如裴松之《三国志注》引《魏氏春秋》《世语》）或笔记小说（如刘义庆《世说新语》、葛洪《西京杂记》、李昉《太平广记》），必须在数据层将 `reliability` 字段标记为 `'commentary'` 或 `'anecdotal'`，并在前端 UI 渲染醒目的史源分级徽章。
2. **渲染性能底线（High-Performance Graph Rendering）**：
   - 图谱主画布严禁使用纯 HTML DOM / SVG 节点直接渲染超过 500 个节点。必须基于 HTML5 Canvas 2D 或 WebGL（推荐使用 `react-force-graph-2d` 或 `Sigma.js` + `Graphology`）实现硬件加速渲染。
   - 必须实现 **语义级缩放（Semantic Zoom / Level of Detail, LOD）** 与 **视口裁剪（Frustum/Viewport Culling）**，确保在加载数千至数万节点时保持 60 FPS 流畅交互。
3. **混合无服务器数据架构（Static-First & Dynamic-Ready）**：
   - 系统必须支持 **零后端成本的纯静态部署（Static Export / Vercel / GitHub Pages）**，同时预留动态 API 扩展能力。
   - 数据层采用 **“全局轻量级索引清单（Manifest Index） + 按朝代/时期切分的静态数据分片（JSON Shards） + 端侧内存/IndexedDB 缓存”** 架构，实现首屏秒开与按需流式加载。
4. **完整度与非占位符原则（No Placeholder Slop）**：
   - 严禁在核心功能组件中留下 `// TODO: implement later` 或空白面板。
   - 内置的首发种子数据集（Seed Dataset）必须包含真实、详尽、经过考据的二十四史核心人物、多维关系边、文言原文、白话译文、生平时间线及传世画像资源，确保项目启动后即为一个内容饱满、可深度把玩的数字人文产品。
5. **新中式数字人文美学（Neo-Chinese Digital Humanities UI）**：
   - 界面设计需融合中国传统书籍装帧美学（宋版书版式、宣纸肌理、朱砂批注、印章元素）与现代高密度数据可视化仪表盘设计，提供“宣纸日间模式（Parchment Light）”与“玄墨夜间模式（Obsidian Dark）”双主题。

---

## 1. 系统总体架构设计（System Architecture）

### 1.1 技术栈选型（Tech Stack）

| 层级 | 核心技术选型 | 用途与工程考量 |
| :--- | :--- | :--- |
| **核心框架** | Next.js 14/15 (App Router) + React 18+ + TypeScript 5+ | 支持静态生成（SSG）、增量静态再生（ISR）及 API Routes 混合部署，强类型保障复杂史学数据结构。 |
| **样式与动效** | Tailwind CSS + Framer Motion + Lucide Icons | 定制新中式色彩 Token（宣纸、朱砂、石青、泥金、松烟墨），利用 Framer Motion 实现丝滑的档案抽屉、时间轴与视图切换动画。 |
| **图谱可视化引擎** | `react-force-graph-2d` + `d3-force` + `d3-hierarchy` | 基于 Canvas 的高性能图渲染；结合 `d3-force` 实现自定义引力/斥力/朝代聚类力场，结合 `d3-hierarchy` 实现宗法世系树布局。 |
| **图算法与数据结构** | 自研轻量级 `GraphEngine` 或 `graphology` | 在前端内存中维护邻接表（Adjacency List），支持 $O(V + E)$ 复杂度的广度优先六度分隔寻路（BFS）、Ego-Network 邻域提取、共同邻居交集计算与介数中心性分析。 |
| **全文检索与索引** | `MiniSearch` 或 `Fuse.js`（支持拼音/字号/别名权重） | 在客户端对人物名、字、号、谥号、庙号、官职、成语典故、文言引文进行毫秒级模糊与精确匹配检索。 |
| **时空地理可视化** | 基于 SVG/Canvas 的定制中国历史疆域底图（或 `Leaflet` / `MapLibre`） | 展示人物籍贯分布（古今地名映射）、一生宦游/行军迁徙轨迹（Animated Polyline）及历史事件发生地。 |
| **数据工程流水线 (ETL)** | Python 3.10+ (`sqlite3`, `requests`, `pydantic`, `openai`/`anthropic`) | 位于 `/scripts/etl`，负责对接哈佛 CBDB（中国历代人物传记资料库）、维基文库二十四史原文解析、实体消歧与 JSON 分片编译。 |

### 1.2 标准项目目录结构（Directory Structure）

请严格按照以下模块化目录结构组织代码：

```text
chronograph-china/
├── public/
│   ├── data/
│   │   ├── manifest.json                 # 全局元数据清单：朝代列表、分片索引、统计指标、全局轻量搜索索引
│   │   ├── shards/                       # 按历史时期切分的图谱与人物全量数据分片
│   │   │   ├── shard_01_pre_qin_qin.json # 先秦与秦代（《史记》核心）
│   │   │   ├── shard_02_chu_han.json     # 楚汉争霸与西汉初期（《史记》《汉书》高密度核心簇）
│   │   │   ├── shard_03_three_kingdoms.json # 汉末三国鼎立（《三国志》《后汉书》高密度核心簇）
│   │   │   ├── shard_04_jin_nanbeichao.json # 两晋南北朝（《晋书》《世说新语》门阀与名士簇）
│   │   │   ├── shard_05_sui_tang.json    # 隋唐盛世（《旧唐书》《新唐书》玄武门与贞观开元簇）
│   │   │   └── shard_06_song_ming_qing.json # 宋元明清（《宋史》《明史》文臣武将簇）
│   │   └── portraits/                    # 本地兜底的朝代冠服 SVG 剪影与公版古籍版画缓存
│   └── textures/                         # 宣纸纹理、印章边框等轻量 SVG/WebP 素材
├── scripts/
│   └── etl/                              # 二十四史与 CBDB 自动化数据工程流水线
│       ├── README.md                     # 数据扩充与脚本运行指南
│       ├── schema_validator.py           # Pydantic 强类型校验器与原文子串核验器
│       ├── cbdb_connector.py             # 哈佛 CBDB 数据库（SQLite/API）人物与关系提取脚本
│       ├── wikisource_24histories.py     # 维基文库二十四史列传原文抓取与分卷解析器
│       ├── llm_extractor.py              # 基于大模型的生平年表、相貌考据、奇闻轶事与互见史料提取器
│       └── build_shards.py               # 实体消歧、图中心度（PageRank/Degree）计算与静态分片打包器
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # 全局字体（衬线宋体+现代无衬线）、主题 Provider 与元数据
│   │   ├── page.tsx                      # 主工作台视图（整合图谱画布、工具栏、时间轴、详情抽屉）
│   │   └── globals.css                   # 新中式设计系统 CSS 变量、宣纸背景与自定义滚动条
│   ├── types/
│   │   └── history.ts                    # 核心 TypeScript 类型定义（人物、多维动态关系、史料、轶事、画像）
│   ├── lib/
│   │   ├── graph-algorithms.ts           # 图算法库：BFS 最短路径、K-Paths、1~2度 Ego网络、共同关系交集、宗族树构建
│   │   ├── data-loader.ts                # 分片异步加载器、内存合并、去重与按时间轴切片过滤引擎
│   │   ├── search-engine.ts              # 支持名/字/号/谥号/典故/原文的多维全文检索引擎
│   │   └── portrait-resolver.ts          # 四级画像降级解析器与 AI 复原 Prompt 自动生成器
│   └── components/
│       ├── canvas/
│       │   ├── HistoryGraphCanvas.tsx    # 主图谱 Canvas 引擎（支持力导向、宗法世系树、朝代阵营泳道三种布局）
│       │   ├── GraphLegendAndControls.tsx# 图例面板、LOD 缩放控制、布局切换器、视觉图层开关
│       │   └── EdgeRelationModal.tsx     # 点击两人关系连线时的“交集详考与动态关系演变”悬浮窗
│       ├── drawer/
│       │   ├── PersonDetailDrawer.tsx    # 人物全息档案抽屉主容器
│       │   ├── TabBiography.tsx          # 【本传与年表】结构化生平、交互式纪年时间轴、行迹地图
│       │   ├── TabPortraitGallery.tsx    # 【丹青与相貌】全屏高清画像 Lightbox、史书外貌原文考据、AI 复原提示词面板
│       │   ├── TabAnecdotes.tsx          # 【奇闻与互见】分级奇闻轶事卡片流、他传互见记录、多史书“罗生门”对勘视图
│       │   └── TabClassicalSources.tsx   # 【二十四史原文】文白对照阅读器（支持人名实体高亮点击跳转）
│       ├── toolbar/
│       │   ├── TopOmniBar.tsx            # 顶部全能栏：品牌标识、Cmd+K 全局搜索触发器、六度分隔寻路入口、数据统计面板
│       │   ├── PathfindingModal.tsx      # “历史六度分隔”两人关系寻路与共同好友分析交互面板
│       │   ├── SearchCommandPalette.tsx  # 全局快捷键检索模态框（支持按人物、成语典故、史书篇目检索）
│       │   └── BottomTimelineBar.tsx     # 底部时空控制器：朝代切片切换器 + 公元纪年双滑块 + 历史大事件锚点
│       └── map/
│           └── HistoricalTrajectoryMap.tsx # 人物籍贯与一生宦游/征战空间轨迹示意图组件
└── package.json
```

---

## 2. 核心史学数据模型规范（Comprehensive TypeScript Schema）

请在 `src/types/history.ts` 中完整定义以下接口。该模型专门针对二十四史的**“多称谓体系”、“时序动态关系”、“正史/注疏/野史分级”、“互见法”与“四级画像体系”**进行了深度建模：

```typescript
/**
 * 1. 历史朝代与二十四史对应枚举
 */
export type DynastyId =
  | 'pre_qin'           // 先秦（《史记》五帝至战国）
  | 'qin'               // 秦（前221 - 前207，《史记》）
  | 'chu_han'           // 楚汉之际（前206 - 前202，《史记》《汉书》）
  | 'western_han'       // 西汉（前202 - 8，《史记》《汉书》）
  | 'xin'               // 新朝与更始（9 - 25，《汉书》《后汉书》）
  | 'eastern_han'       // 东汉（25 - 220，《后汉书》《三国志》）
  | 'three_kingdoms'    // 三国（220 - 280，《三国志》）
  | 'jin'               // 西晋与东晋（266 - 420，《晋书》）
  | 'southern_northern' // 南北朝（420 - 589，《宋书》《南齐书》《梁书》《陈书》《魏书》《北齐书》《周书》《南史》《北史》）
  | 'sui'               // 隋（581 - 618，《隋书》）
  | 'tang'              // 唐（618 - 907，《旧唐书》《新唐书》）
  | 'five_dynasties'    // 五代十国（907 - 979，《旧五代史》《新五代史》）
  | 'song'              // 北宋与南宋（960 - 1279，《宋史》）
  | 'liao_jin_xia'      // 辽、金、西夏（907 - 1234，《辽史》《金史》《宋史》）
  | 'yuan'              // 元（1271 - 1368，《元史》）
  | 'ming'              // 明（1368 - 1644，《明史》）
  | 'qing';             // 清（1636 - 1912，《清史稿》延伸）

export interface DynastyMeta {
  id: DynastyId;
  name: string;                  // 如 "三国"
  startYear: number;             // 如 220（公元前为负数）
  endYear: number;               // 如 280
  primaryColor: string;          // 朝代主题色 Hex，用于节点外圈与图例
  canonicalBooks: string[];      // 对应二十四史书目，如 ["《三国志》", "《后汉书》", "《晋书》"]
  shardFile: string;             // 对应的数据分片文件名
}

/**
 * 2. 史料来源分级与引用模型（杜绝 AI 幻觉的核心约束）
 */
export type SourceReliability =
  | 'official_history_primary'   // 二十四史本传/本纪/世家正文（最高权威度）
  | 'official_history_hujian'    // 二十四史“互见法”他传记载（如在《项羽本纪》中记载刘邦言行）
  | 'authoritative_commentary'   // 权威史家注疏（如裴松之《三国志注》、司马贞《史记索隐》、张守节《史记正义》、颜师古《汉书注》）
  | 'chronicle_corroboration'    // 编年体与政书佐证（如司马光《资治通鉴》《资治通鉴考异》、《通典》）
  | 'literary_anecdotal';        // 魏晋唐宋笔记小说与野史轶闻（如《世说新语》《西京杂记》《朝野佥载》《太平广记》）

export interface HistoricalCitation {
  id: string;
  bookTitle: string;             // 史书名，如 "《三国志》" 或 "《三国志注》引《魏氏春秋》"
  volumeAndChapter: string;      // 卷次与篇名，如 "卷三十五·蜀书·诸葛亮传"
  authorOrCommentator?: string;  // 撰者或注者，如 "陈寿 撰 / 裴松之 注"
  originalText: string;          // 严格的文言文原文摘录（必须与传世文本一致）
  modernTranslation: string;     // 准确通顺的现代汉语白话译文
  reliability: SourceReliability;// 史源可信度分级
  historiographicalNote?: string;// 史学按语/考异说明（用于解释史料背景或真伪辨析）
  wikisourceUrl?: string;        // 维基文库或中国哲学书电子化计划（CText）对应篇章链接
}

/**
 * 3. 多源史料对勘模型（“罗生门”争议历史事件视图）
 */
export interface ConflictingAccount {
  sourceName: string;            // 史书来源，如 "《旧唐书·隐太子建成传》" vs "《资治通鉴考异》"
  stanceOrBias: string;          // 史官立场分析，如 "贞观官修史书倾向"
  citation: HistoricalCitation;
}

/**
 * 4. 奇闻轶事与人物性格切面模型
 */
export type AnecdoteCategory =
  | 'eccentric_demeanor' // 魏晋风度/怪癖性情（如竹林七贤、扪虱而谈、好驴鸣）
  | 'wit_and_strategem'  // 急智诡道/妙语机锋（如捉刀人、望梅止渴、唾面自干）
  | 'physiognomy_omen'   // 异相奇征/方术预言（如重瞳、隆准龙颜、顾自见其耳）
  | 'culinary_lifestyle' // 饮食起居/生活细节（如东坡肉、王恺石崇斗富、啖生彘肩）
  | 'literary_romance'   // 诗酒风流/情感轶事（如文君夜奔、却扇诗、沈园春游）
  | 'historical_mystery';// 史海疑云/罗生门争议（如烛影斧声、太史慈死年之谜）

export interface Anecdote {
  id: string;
  title: string;                 // 轶事标题，如 "床头捉刀人"、"闻鸡起舞"、"泣下沾襟"
  idiomOrAllusion?: string;      // 衍生出的成语或典故，如 "捉刀"、"闻鸡起舞"
  category: AnecdoteCategory;
  narrativeSummary: string;      // 轶事背景与白话故事脉络
  relatedPersonIds: string[];    // 该轶事涉及的其他人物节点 ID（支持点击跳转）
  primaryCitation: HistoricalCitation; // 核心史料出处
  conflictingAccounts?: ConflictingAccount[]; // 若不同史书对此事记载矛盾，提供“史料对勘”数组
}

/**
 * 5. 四级画像考据与视觉模型
 */
export type PortraitTier =
  | 'tier1_authentic_painting'   // L1: 传世古画真迹/宫廷定本（如故宫南薰殿帝王像、阎立本历代帝王图）
  | 'tier2_ancient_woodcut'      // L2: 明清古籍木刻版画（如《三才图会》《晚笑堂竹庄画传》《古圣贤像传略》）
  | 'tier3_ai_reconstructed'     // L3: 据二十四史外貌描写原文 + 朝代冠服规制 AI 复原图
  | 'tier4_attire_silhouette';   // L4: 符合朝代、官阶与性别的传统白描冠冕剪影

export interface PortraitInfo {
  thumbnailUrl: string;          // 画布节点渲染用的圆形头像 URL
  fullSizeUrl: string;           // 点开大图（Lightbox）展示的高清完整立轴/半身像 URL
  tier: PortraitTier;            // 画像考据等级
  sourceAttribution: string;     // 馆藏或古籍出处，如 "台北故宫博物院藏《南薰殿历代帝王像》绢本设色"
  painterOrBook?: string;        // 画师或版画书名，如 "（唐）阎立本" 或 "（明）王圻《三才图会》"
  classicalAppearanceQuote?: {   // 史书关于此人外貌、身高、神态的原文记载
    quote: string;               // 如 "身长八尺，容貌甚伟，时人异焉"
    bookSource: string;          // 如 "《三国志·蜀书·诸葛亮传》"
    translation: string;         // 白话解释
  };
  aiReconstructionPrompt?: string; // 若为 L3/L4，自动附带严格考据的古画复原提示词供用户复制或重绘
}

/**
 * 6. 生平时间线与地理空间坐标模型
 */
export interface GeoLocation {
  ancientName: string;           // 历史古地名，如 "琅邪阳都"、"沛国谯县"、"黄州"
  modernName: string;            // 现代行政区划名，如 "山东省临沂市沂南县"
  coordinates: [number, number]; // [经度 lng, 纬度 lat]，用于历史轨迹地图绘制
}

export interface LifeEvent {
  id: string;
  year: number;                  // 公元纪年（公元前用负数，如 -206 表示公元前206年）
  eraNameYear?: string;          // 帝王年号纪年，如 "汉高帝元年"、"建安十三年"
  age?: number;                  // 当时年龄
  title: string;                 // 事件名称，如 "鸿门宴"、"隆中对"、"赤壁之战"
  description: string;           // 事件详细经过
  location?: GeoLocation;        // 事件发生地点（用于绘制人物一生空间迁徙轨迹）
  participatingPersonIds?: string[]; // 共同参与该事件的人物 ID
  citation?: HistoricalCitation; // 史料依据
}

/**
 * 7. 人物节点全息模型（HistoricalPersonNode）
 */
export interface HistoricalPersonNode {
  id: string;                    // 全局唯一且可读的 ID，如 "person_liu_bang", "person_cao_cao"
  cbdbId?: number;               // 对应的哈佛 CBDB 人物 ID（如曹操为 11495），便于学术库联查
  name: string;                  // 主显示姓名，如 "曹操"
  aliases: {
    courtesyName?: string;       // 字，如 "孟德"
    pseudonyms?: string[];       // 号/小字/别称，如 ["阿瞒", "吉利"]
    posthumousTitle?: string;    // 谥号，如 "武皇帝" / "忠武侯"
    templeName?: string;         // 庙号，如 "太祖" / "高祖"
    eraNames?: string[];         // 年号（帝王专属），如 ["贞观"]
    feudalTitles?: string[];     // 封爵或常见史书称谓，如 ["魏王", "武平侯", "曹公"]
    tabooNotes?: string;         // 避讳说明，如 "因避唐太宗李世民讳，唐修史书或省作‘民’或改称"
  };
  gender: 'male' | 'female' | 'eunuch';
  dynasty: DynastyId;            // 主要归属朝代
  factionOrClan?: string;        // 所属政治集团或门阀世家，如 "曹魏集团"、"蜀汉集团"、"琅琊王氏"、"关陇集团"
  birthYear?: number;            // 出生公元年份（不确定可为近似值）
  deathYear?: number;            // 逝世公元年份
  birthYearUncertain?: boolean;  // 生卒年是否史载不详
  birthplace?: GeoLocation;      // 籍贯/郡望
  roles: string[];               // 核心身份标签，如 ["开国皇帝", "军事家"] 或 ["丞相", "文学家", "书法家"]
  officialTitles: string[];      // 历任核心官职，如 ["司空", "丞相", "领冀州牧"]
  importanceWeight: number;      // 历史中心度权重 (1 ~ 100)，决定宏观缩放（LOD）时的显示层级与节点半径
  portrait: PortraitInfo;        // 四级画像与相貌考据对象
  oneLineSummary: string;        // 50字以内的史学定评/核心定位
  structuredBiography: {
    earlyLife: string;           // 早年经历与崛起背景
    majorAchievements: string;   // 核心历史功业与重大决策
    turningPointsAndEnd: string; // 人生转折与最终结局
    historianAssessment: {       // 历代史官原话总评（如“太史公曰”、“陈寿评曰”、“赞曰”）
      commentator: string;       // 如 "陈寿《三国志》评曰"
      originalQuote: string;     // 如 "汉末，天下大乱，雄豪并起……抑可谓非常之人，超世之杰矣。"
      translation: string;
    };
  };
  lifeTimeline: LifeEvent[];     // 纵向生平大事年表（同时驱动空间轨迹图）
  anecdotes: Anecdote[];         // 奇闻轶事与他传互见列表
  primarySources: HistoricalCitation[]; // 二十四史本传核心文白对照段落
}

/**
 * 8. 多维时序人物关系边模型（HistoricalRelationEdge）
 */
export type RelationCategory =
  | 'kinship_blood'     // 直系/旁系血亲（父子、母子、兄弟、叔侄、祖孙）
  | 'kinship_marriage'  // 姻亲与后宫（夫妻、岳婿、连襟、外戚联姻）
  | 'monarch_subject'   // 君臣、主公与谋士/武将、上下级统属
  | 'political_ally'    // 政治盟友、同党、举荐（伯乐与千里马）
  | 'political_rival'   // 朝堂政敌、党争对手、夺嫡之争、构陷诛杀
  | 'military_adversary'// 沙场宿敌、战役交锋对手
  | 'mentor_disciple'   // 师承、座主与门生、学术传承
  | 'literary_bosom';   // 诗酒至交、文学唱和、竹林之游

export interface TemporalRelationPhase {
  startYear?: number;            // 该阶段关系起始年
  endYear?: number;              // 该阶段关系结束年
  phaseLabel: string;            // 阶段关系定性，如 "结义反秦" -> "鸿门猜忌" -> "楚汉死敌"
  category: RelationCategory;    // 该阶段对应的关系大类（支持随时间轴动态变色！）
  description: string;           // 该阶段两人互动的具体史实
  citation?: HistoricalCitation;
}

export interface HistoricalRelationEdge {
  id: string;
  source: string;                // 源节点 Person ID
  target: string;                // 目标节点 Person ID
  primaryCategory: RelationCategory; // 默认主关系类别
  specificLabel: string;         // 画布连线上显示的精炼标签（2~6字），如 "父子"、"三顾茅庐"、"赤壁对手"、"玄武门相残"
  directed: boolean;             // 是否为有向边（如 父->子、君->臣、师->徒 为 true；同僚、夫妻、对手为 false）
  strength: number;              // 关系紧密程度 (1 ~ 10)，决定力导向图的弹簧距离（Strength 越大距离越近）
  startYear?: number;            // 两人产生历史交集的起始年份
  endYear?: number;              // 交集结束年份
  overallSummary: string;        // 两人一生恩怨交集综述
  temporalPhases?: TemporalRelationPhase[]; // 时序关系演变状态机（用于展示复杂多变的历史人际关系）
  keyCitation: HistoricalCitation; // 证明两人关系的核心二十四史引文
}
```

---

## 3. 视觉设计系统与多视图拓扑规范（UI/UX & Visualization Specs）

### 3.1 新中式数字人文配色方案（Color Tokens）

请在 `globals.css` 与 Tailwind 配置中实现以下双模式色彩体系：

- **背景与容器色**：
  - 宣纸日间模式（默认）：主画布底色 `#F6F3EB`（古宣纸色），卡片表面 `#FCFBF7`，边框色 `#E2D9C8`（竹简黄）。
  - 玄墨夜间模式：主画布底色 `#111318`（松烟墨），卡片表面 `#1A1D24`，边框色 `#2E3340`。
- **关系连线语义色（Edge Semantic Colors）**：
  - `kinship_blood` / `kinship_marriage`（宗族血缘与姻亲）：**朱砂红 `#C83E31`**（实线，血脉相连）
  - `monarch_subject`（君臣统属）：**泥金黄 `#C59B27`**（带方向箭头实线）
  - `political_ally` / `literary_bosom`（盟友与至交）：**石青/竹青 `#2B7A78`**（实线）
  - `mentor_disciple`（师承门生）：**松花绿 `#5B8C5A`**（带方向虚线）
  - `political_rival` / `military_adversary`（政敌与沙场宿敌）：**玄铁紫灰 `#6C5B7B` 或 绛紫 `#8E354A`**（双划线或动态虚线，体现冲突张力）
- **史料可信度徽章色（Reliability Badges）**：
  - `official_history_primary`（二十四史本传）：翡翠绿底金字 `[正史本传]`
  - `official_history_hujian`（二十四史他传互见）：青黛蓝底 `[他传互见]`
  - `authoritative_commentary`（史家注疏）：紫檀底 `[史家注疏]`
  - `literary_anecdotal`（稗官笔记/野史）：琥珀橙底 `[笔记轶闻·仅供参考]`

### 3.2 图谱画布的三大布局模式（Switchable Graph Layouts）

用户可通过画布左上角的切换器，在以下三种视图间无缝切换：

1. **【星云力导向视图（Force-Directed Network）】**：
   - 采用自定义 `d3-force` 物理引擎。
   - **朝代引力簇（Dynasty Clustering Force）**：同朝代、同阵营（`factionOrClan`）的人物受到微弱的中心向心力牵引，自然聚合成簇，而跨朝代的关系（如先祖与后裔、隔代师承）则形成连接不同星云的桥梁。
2. **【宗法世系与师承树（Genealogy & Lineage Tree）】**：
   - 仅过滤保留 `kinship_blood`、`kinship_marriage` 与 `mentor_disciple` 关系边，切换为自上而下的树状层级布局（Hierarchical DAG），专门用于梳理皇室帝系传承（如汉室刘氏世系、曹魏司马氏世系、李唐皇室世系）与门阀联姻。
3. **【纪年阵营泳道图（Chronological Faction Swimlanes）】**：
   - X 轴锁定为人物出生/活跃的公元年份，Y 轴按政治阵营或朝代分泳道排列（例如在三国分片下，自动分为“汉室/群雄”、“曹魏阵营”、“蜀汉阵营”、“东吴阵营”四条横向泳道），直观呈现历史同代人的时空并列关系。

### 3.3 语义级缩放（Semantic Zoom / LOD）渲染规则

在 `HistoryGraphCanvas.tsx` 的 `nodeCanvasObject` 自定义绘制函数中，根据当前相机缩放倍率 `globalScale` 动态调整绘制细节：

- **Level 1 宏观天下大势 (`globalScale < 0.7`)**：
  - 仅渲染 `importanceWeight >= 75` 的帝王、权臣、核心世家领袖节点。
  - 节点绘制为带朝代色彩光晕的实心圆点 + 粗体姓名标签，隐藏次要关系边，确保全图清爽不卡顿。
- **Level 2 中观群雄并起 (`0.7 <= globalScale < 1.6`)**：
  - 渲染 `importanceWeight >= 40` 的人物节点。
  - 节点内部裁剪绘制圆形人物画像缩略图（`ctx.clip()`），节点下方绘制姓名与核心头衔（如 `曹操 · 魏武帝`）。
- **Level 3 微观人物交游 (`globalScale >= 1.6`)**：
  - 渲染视野内的全部人物节点（含全部长尾人物）。
  - 节点外圈显示精致的双层古风边框，展示生卒年与字号（如 `诸葛亮 (字孔明 · 181-234)`），且所有连线居中位置绘制 `specificLabel` 关系胶囊标签（如 `三顾茅庐`、`隆中对策`、`赤壁交锋`）。

---

## 4. 八大核心功能模块详细规范（Core Feature Modules）

### 模块一：1~2 度人际关系网聚焦（Ego-Network Spotlight）
- 当用户单击任意人物节点 `Node A` 时：
  1. 画布平滑缩放并以 `Node A` 为中心居中。
  2. 调用 `getEgoNetwork(nodeId, maxDepth)` 算法，提取该人物的 **1 度直接关系节点** 与 **2 度间接关系节点**。
  3. 视觉高亮 `Node A` 及其关联子图，其余非相关节点与连线透明度降至 `0.12`。
  4. 支持在画布顶部悬浮条一键切换 `仅看 1 度核心圈` / `展开 2 度衍生圈` / `按关系类型过滤（如只看此人的血亲或只看此人的政敌）`。

### 模块二：两人关系连线“交集详考与动态演变”弹窗（Edge Relation Inspector）
- 当用户点击连接两个人物的连线（Edge）时，弹出精美的古籍卡片模态框：
  1. 展示两人头像对比、关系总括（如 `刘邦 ↔ 项羽：从结义灭秦到楚汉争霸`）。
  2. **时序关系状态机时间轴**：如果该关系包含 `temporalPhases`，以步骤条展示两人关系如何随时间演变（例如从盟友变为死敌的每一个转折年份与事件）。
  3. 底部附上《二十四史》证明两人交集的原文引文与白话翻译。

### 模块三：人物全息档案抽屉（4-Tab Holographic Dossier）
点击人物节点后，右侧滑出宽度为 `480px ~ 640px`（支持一键切换全屏模式）的档案抽屉，包含四个深度标签页：

1. **Tab 1【本传 · 生平与行迹】**：
   - **顶部名片区**：展示姓名、字、号、谥号、庙号、封爵、避讳说明、生卒年、古今籍贯对照、所属阵营及历史中心度评分。
   - **三段式正史生平**：清晰分栏展示【早年与崛起】、【核心历史功业】、【晚年与结局】。
   - **史官盖棺定论卡片**：高亮引用《史记》“太史公曰”、《汉书》“赞曰”或《三国志》“评曰”的史官原话与白话译文。
   - **交互式生平大事年表**：按公元纪年与年号纪年排列一生关键节点，点击事件中的关联人物胶囊（如点击“与周瑜共破曹操于赤壁”中的 `周瑜`），图谱直接平滑飞跃至周瑜节点！
   - **空间宦游/征战轨迹图（`HistoricalTrajectoryMap`）**：根据 `lifeTimeline` 中的经纬度坐标，在中国古今对照底图上动态连线展示该人物一生的足迹变迁。
2. **Tab 2【丹青 · 画像与相貌考据】**：
   - **高清立轴画框**：居中展示人物画像，右上角标注画像考据等级徽章（`L1 传世古画真迹` / `L2 明清古籍版画` / `L3 史料外貌复原` / `L4 朝代舆服剪影`）。
   - **全屏 Lightbox 看图器**：点击画像打开全屏高清画廊，支持鼠标滚轮 1x~5x 无损缩放、画布拖拽平移、查看画作馆藏出处与作者信息。
   - **二十四史相貌考据卡**：专门摘录正史或注疏中对该人物容貌、身高、声音、体态的原文描写（如项羽“目有重瞳子”、刘备“垂手下膝，顾自见其耳”、嵇康“身长七尺八寸，风姿特秀，见者叹曰：萧萧肃肃，爽朗清举”）。
   - **AI 古画复原工作台**：展示系统根据其朝代冠服规制与史书相貌描写自动生成的工笔重彩/水墨人物画 Prompt，支持一键复制。
3. **Tab 3【轶闻 · 奇闻轶事与罗生门对勘】**：
   - 支持按轶事类别（`魏晋风度`、`急智机锋`、`异相奇征`、`饮食起居`、`史海疑云`）筛选。
   - 每张轶事卡片包含：标题、衍生出的成语典故、故事脉络、**史源可信度徽章**、以及折叠/展开的《史书原文 + 白话译文》引用块。
   - **“史料对勘（罗生门视图）”**：若该轶事存在 `conflictingAccounts`（如不同史书或裴松之注提出了相反记载），以左右双栏对比卡片呈现不同史料的原文与史官立场剖析。
4. **Tab 4【史源 · 二十四史原文文白对照阅读器】**：
   - 展示该人物在二十四史中的核心列传原文段落，支持一键切换 `文白双栏对照` / `纯古籍竖排/横排阅读` / `仅看白话`。
   - **实体自动高亮链接（Entity Auto-Linking）**：原文文本中若出现图谱库中已存在的其他人名或字号，自动渲染为带朱砂下划线的可点击词条，点击即可在图谱中跳转至该人物。

### 模块四：“历史六度分隔”关系寻路与社交分析器（Pathfinding & SNA Studio）
- 用户可在顶部工具栏打开【关系寻路器】：
  1. **最短关系链寻路（BFS Shortest Path）**：选择任意“起点人物 A”与“终点人物 B”（支持跨朝代，如从 `刘邦` 寻路到 `刘备`，或从 `曹操` 寻路到 `王羲之`），实时计算出连接两人的最短历史关系路径，并在主画布上用流光动画高亮整条路径上的所有节点与关系边。
  2. **共同关系圈交集（Common Circle Intersection）**：自动列出人物 A 与人物 B 共同认识的所有历史人物，并按关系性质分组展示。

### 模块五：底部时空双轴控制器（Chronological & Dynasty Filter）
- 底部常驻可折叠的时空控制舱：
  1. **朝代快速切片**：点击朝代胶囊（如 `楚汉相争`、`三国鼎立`、`贞观开元`），自动加载对应分片并聚焦该时代星云。
  2. **公元纪年时间滑块（Time-Travel Slider）**：支持设定时间窗口 `[startYear, endYear]` 或开启“单年历史截面模式”（例如将滑块拖到 `公元 208 年 · 赤壁之战`）。
  3. **动态生死状态与关系变色**：开启单年截面模式后，在该年份尚未出生或已经逝世的人物自动半透明隐退；且正处于活跃期的人物关系边会根据 `temporalPhases` 自动切换为当年的关系状态（例如展示两人在当年究竟是盟友还是死敌）！

---

## 5. 数据工程与二十四史全量扩展流水线（Python ETL Pipeline）

请在 `/scripts/etl/` 目录下实现一套完整、可直接运行的 Python 数据工程工具链，用于支撑从首发种子库向二十四史万人级图谱的持续演进：

### 5.1 首发内置高密度种子库要求（Built-in Seed Shards）
为了确保前端应用开箱即用、体验震撼，请在 `public/data/shards/` 下预先构建并内置 **3 个高密度、全字段考据级的历史关系簇分片**（合计不少于 **60~80 位核心历史人物节点** 与 **120~180 条带原文引用的关系边**）：
1. **簇一：楚汉争霸与大汉开国簇（《史记》《汉书》）**
   - 核心节点：秦始皇、扶苏、李斯、赵高、陈胜、项羽、范增、虞姬、项伯、英布、彭越、刘邦、吕雉、戚夫人、刘盈、刘恒、萧何、张良、韩信、陈平、樊哙、曹参、周勃、郦食其、陆贾、叔孙通、蒯通、冒顿单于、李广、司马迁等。
2. **簇二：汉末三国群雄与门阀雏形簇（《三国志》《后汉书》《世说新语》）**
   - 核心节点：董卓、吕布、袁绍、曹操、曹丕、曹植、曹叡、郭嘉、荀彧、荀攸、贾诩、程昱、张辽、夏侯惇、司马懿、司马师、司马昭、嵇康、阮籍、刘备、刘禅、诸葛亮、关羽、张飞、赵云、马超、黄忠、庞统、法正、姜维、孙坚、孙策、孙权、周瑜、鲁肃、吕蒙、陆逊、大乔、小乔、华佗、孔融、祢衡、蔡琰（蔡文姬）等。
3. **簇三：隋唐鼎革与贞观开元盛世簇（《隋书》《旧唐书》《新唐书》）**
   - 核心节点：杨坚、独孤伽罗、杨广、宇文化及、李渊、李建成、李世民、长孙皇后、李元吉、李治、武则天、魏征、房玄龄、杜如晦、长孙无忌、尉迟恭、秦琼、李靖、李勣（徐懋功）、侯君集、程知节、褚遂良、狄仁杰、上官婉儿、李隆基、杨玉环、李白、杜甫、高力士、安禄山、郭子仪等。

> **数据质量硬性要求**：上述内置种子库中的每一个人物，都必须包含真实的**字号谥号、生卒年、籍贯经纬度、至少 3~5 个生平年表事件、至少 1~3 则带《史记》《三国志》《世说新语》《旧唐书》等真实文言原文引用的奇闻轶事、史官总评原话、以及真实可用的公版古画/版画 URL（Wikimedia Commons 直链或内置高清 SVG 古风肖像）**。

### 5.2 自动化扩充脚本设计（`/scripts/etl/`）
请编写以下 4 个核心 Python 脚本并配好 `README.md`：
1. `cbdb_connector.py`：
   - 支持连接哈佛大学 **CBDB（China Biographical Database）** 公开 SQLite 数据库文件或 REST API。
   - 自动查询指定朝代的人物基础表（`BIOG_MAIN`）、别名表（`ALTNAME_DATA`）、亲属关系表（`KIN_DATA`）与社会关系表（`ASSOC_DATA`），自动执行实体合并并导出为标准中间态 JSON。
2. `wikisource_24histories.py`：
   - 接入维基文库（Wikisource）MediaWiki API，支持按目录批量拉取《史记》《汉书》《后汉书》《三国志》《晋书》……直至《明史》共二十四部正史的列传原文 Markdown。
3. `llm_extractor.py`：
   - 利用 LLM Structured Outputs（基于 `Pydantic` 定义与前端 TypeScript 完全一致的 JSON Schema），从二十四史列传原文及裴松之注等文本中，自动抽取出 `structuredBiography`、`lifeTimeline`、`anecdotes`、`classicalAppearanceQuote` 及 `HistoricalCitation`。
   - **防幻觉校验函数 `verify_quote_in_source(quote, source_text)`**：脚本自动对比 LLM 提取出的 `originalText` 是否为维基文库原传文本的真实子串（忽略标点符号差异），若匹配度低于阈值则自动打回重抽或标记待人工复核。
4. `build_shards.py`：
   - 读取所有提取完的人物与关系数据，利用 `networkx` 计算全图节点的 **PageRank 与度数中心性（Degree Centrality）**，将其归一化为 `1 ~ 100` 的 `importanceWeight`，并按朝代自动打包输出到 `public/data/shards/*.json` 与全局 `manifest.json`。

---

## 6. Agent 分阶段执行路线图（Step-by-Step Implementation Plan）

请严格按照以下 5 个工程阶段推进，每完成一步请验证编译通过且无运行时错误：

### Phase 1: 基础架构与核心类型定义
1. 初始化 Next.js + TypeScript + Tailwind CSS 环境，安装 `lucide-react`、`framer-motion`（以及图渲染与检索依赖）。
2. 创建 `src/types/history.ts`，完整落地第 2 节定义的全部 TypeScript 接口。
3. 配置 `src/app/globals.css`，实现宣纸日间模式与玄墨夜间模式的新中式色彩变量、古籍衬线字体栈及自定义精致滚动条。

### Phase 2: 考据级首发种子数据库与图算法引擎构建
1. 构建 `public/data/manifest.json` 及 `public/data/shards/` 下的三大高密度历史分片（楚汉、三国、隋唐），或者在 `src/data/` 下编写模块化强类型数据源并编译为 JSON 分片，确保人物生平、奇闻轶事、文言引文、相貌考据与关系演变阶段数据翔实饱满。
2. 实现 `src/lib/graph-algorithms.ts`：
   - 邻接表构建与度中心性计算
   - `findShortestPaths(graph, startId, endId, maxPaths = 3)`（BFS 六度分隔寻路）
   - `getEgoNetwork(graph, centerId, degree = 1 | 2)`（局部关系网提取）
   - `getCommonNeighbors(graph, idA, idB)`（共同社交圈交集）
   - `buildLineageTree(graph, rootId)`（宗法世系与师承树转换）
3. 实现 `src/lib/search-engine.ts` 与 `src/lib/portrait-resolver.ts`（支持多称谓消歧检索与四级画像优雅降级及高颜值 SVG 朝代冠冕肖像生成）。

### Phase 3: WebGL/Canvas 多视图图谱渲染引擎
1. 开发 `src/components/canvas/HistoryGraphCanvas.tsx`：
   - 实现力导向布局（Force）、宗法世系树布局（Tree）、纪年阵营泳道布局（Swimlane）三种模式的坐标计算与平滑插值过渡。
   - 实现语义级缩放（LOD 3 级细节渐进呈现）、圆形头像裁剪绘制、朝代光环、有向箭头与关系名称胶囊绘制。
   - 实现鼠标悬停高亮、节点点击触发 Ego-Network 聚焦、连线点击触发 `EdgeRelationModal.tsx`（展示两人时序关系状态机演变与史料引文）。
2. 开发 `src/components/canvas/GraphLegendAndControls.tsx`，提供关系类型图例过滤开关、缩放控制、布局切换与视野重置。

### Phase 4: 全息人物档案抽屉、时空滑块与六度寻路工作台
1. 开发 `src/components/drawer/PersonDetailDrawer.tsx` 及其下属 4 个子标签页组件：
   - `TabBiography.tsx`（含三段式本传、史官原话总评、可点击跳转的生平大事年表、以及 `HistoricalTrajectoryMap.tsx` 空间行迹地图）。
   - `TabPortraitGallery.tsx`（含四级画像展示、全屏无级缩放 Lightbox、二十四史相貌原文考据卡、AI 复原提示词生成卡）。
   - `TabAnecdotes.tsx`（含分类筛选、史料可信度徽章、成语典故、以及多源史料“罗生门”左右对勘视图）。
   - `TabClassicalSources.tsx`（含二十四史本传文白双栏对照阅读器、文中人名实体自动高亮与点击跳转）。
2. 开发顶部 `TopOmniBar.tsx`、`SearchCommandPalette.tsx`（`Cmd/Ctrl + K` 全局检索）与 `PathfindingModal.tsx`（六度分隔寻路与共同关系圈对比）。
3. 开发底部 `BottomTimelineBar.tsx`，实现朝代分片切换与公元纪年双滑块时间过滤（支持单年截面动态关系变色）。

### Phase 5: Python 二十四史 ETL 扩充套件与整体验收
1. 在 `/scripts/etl/` 目录下编写完整的 `cbdb_connector.py`、`wikisource_24histories.py`、`llm_extractor.py`、`schema_validator.py`、`build_shards.py` 及详尽的 `README.md` 文档。
2. 执行 `npm run build` 或类型检查，修复所有潜在的 TypeScript 类型问题、SSR/CSR 水合（Hydration）问题与图像加载回退逻辑，确保项目达到生产级交付水准。