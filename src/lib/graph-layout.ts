/**
 * 图谱三态布局引擎（纯函数，无副作用）
 * ------------------------------------------------------------------
 *  - force    ：Fruchterman–Reingold 力导向（确定性初始播种，避免每次刷新乱跳）
 *  - lineage  ：宗法世系树（仅血亲/姻亲/师承），d3-hierarchy 紧凑树布局
 *  - swimlane ：纪年阵营泳道（X 轴为公元年份，Y 轴按朝代分层）
 *
 * 输出世界坐标（world space），由画布组件通过相机（scale/offset）投影到屏幕。
 *
 * 斥力用 Barnes-Hut 四叉树近似（见 `lib/barnes-hut.ts`）。原本是两两精确计算，
 * O(n²·iter)：642 人 0.9 秒尚可，但节点涨到三千要一分半。换成四叉树后
 * 三千人 2.5 秒，且距离相关性 0.996——换了算法，没换图。
 */
import { hierarchy, tree } from 'd3-hierarchy';
import { BarnesHut } from './barnes-hut';
import type { GraphIndex, LineageTreeNode } from './graph-algorithms';
import { buildLineageTree, findLineageRoots, personActiveRange } from './graph-algorithms';
import type { DynastyId, GraphLayoutMode, HistoricalPersonNode, HistoricalRelationEdge } from '@/types/history';

export type PositionedMap = Map<string, { x: number; y: number }>;

/** 时代分块（力导向布局）：概览层用来画极淡的底色与时代名，标出「这一片是哪一代」 */
export interface LayoutBlock {
  label: string;
  /** 块心（世界坐标） */
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * 块顶为时代名留出的横带厚度（世界坐标）。
   * 画布据此把标题摆在横带正中：横带之外的区域只放人，标题因此永远压不到头上。
   * 定死一个屏幕像素值不行——缩放从 0.25 到 12 倍，同一个世界厚度在屏幕上
   * 是七像素到四百像素，只有换算过才知道该给多大的字。
   */
  band?: number;
}

export interface LayoutResult {
  positions: PositionedMap;
  /** 世界坐标包围盒，供相机自适应 */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** 泳道模式下的分层标签 */
  lanes: { label: string; y: number; height: number }[];
  /** 力导向模式下的时代分块，其余布局为空 */
  blocks: LayoutBlock[];
}

/* ------------------------------- 确定性哈希 ------------------------------ */

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* --------------------------------- 归一化 -------------------------------- */

function normalize(
  positions: PositionedMap,
  targetWidth = 1720,
  targetAspect?: number,
  blocks: LayoutBlock[] = [],
): LayoutResult {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of positions.values()) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) {
    return { positions, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, lanes: [], blocks: [] };
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = targetWidth / spanX;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const out: PositionedMap = new Map();
  /**
   * 纵横比校正。
   * ------------------------------------------------------------------
   * 世界坐标最终会被 fitView 以 min(availW/spanX, availH/spanY) 装进画布：
   * 内容比例与可用视口不一致时，永远有一个方向留白，而**屏幕占用面积
   * 正比于 (可用区面积 / 内容面积)** —— 也就是说，一个 10:1 的扁条装进
   * 16:9 的画布，只剩下一成多的可视面积，节点必然挤成一条墨线。
   *
   * 力导向本身不知道画布长什么样，所以由这里把包围盒拉到目标比例。
   * 节点是屏幕空间绘制的圆，纵向拉伸不会变形；但这里只做缩放不做拉伸
   * （见下面的 sy），避免拉长后同簇内纵向间距失真。
   */
  const ratio = spanX / spanY;
  const sy = targetAspect && targetAspect > 0 ? scale * (ratio / targetAspect) : scale;
  for (const [id, p] of positions) {
    out.set(id, { x: (p.x - cx) * scale, y: (p.y - cy) * sy });
  }
  return {
    positions: out,
    bounds: {
      minX: -spanX * scale * 0.5,
      maxX: spanX * scale * 0.5,
      minY: -spanY * sy * 0.5,
      maxY: spanY * sy * 0.5,
    },
    lanes: [],
    blocks: blocks.map((b) => ({
      label: b.label,
      x: (b.x - cx) * scale,
      y: (b.y - cy) * sy,
      w: b.w * scale,
      h: b.h * sy,
      band: b.band === undefined ? undefined : b.band * sy,
    })),
  };
}

/**
 * 纪年大段（时代列）：把细碎朝代并成三五个叙事单元。
 * 若按 single dynasty 分列，汉末的「东汉 / 三国」会被拆成两列，
 * 七八列挤在一条画布上反而看不清；按时代归并后，一列就是一个历史场域。
 */
const ERA_TABLE: Partial<Record<DynastyId, string>> = {
  pre_qin: 'era_high_antiquity',
  qin: 'era_qin_han',
  chu_han: 'era_qin_han',
  western_han: 'era_qin_han',
  xin: 'era_qin_han',
  eastern_han: 'era_three_kingdoms',
  three_kingdoms: 'era_three_kingdoms',
  jin: 'era_wei_jin',
  southern_northern: 'era_wei_jin',
  sui: 'era_sui_tang',
  tang: 'era_sui_tang',
  five_dynasties: 'era_five_dynasties',
  song: 'era_song',
  liao_jin_xia: 'era_song',
  yuan: 'era_yuan',
  ming: 'era_ming',
  qing: 'era_qing',
};

export function eraOf(dynasty: DynastyId): string {
  return ERA_TABLE[dynasty] ?? dynasty;
}

/** 时代分块的中文名（概览层画在块角上，告诉读图的人「这一片是哪一代」） */
const ERA_LABEL: Record<string, string> = {
  era_high_antiquity: '上古·先秦',
  era_qin_han: '秦汉',
  era_three_kingdoms: '汉末·三国',
  era_wei_jin: '魏晋南北朝',
  era_sui_tang: '隋唐',
  era_five_dynasties: '五代十国',
  era_song: '宋·辽金西夏',
  era_yuan: '元',
  era_ming: '明',
  era_qing: '清',
};

/**
 * 阵营归并：把五花八门的 factionOrClan（「蜀汉集团（荆州派）」「颍川荀氏」
 * 「范阳·平卢·河东三镇」……）收敛成十几个可读的阵营名。
 * 泳道与力导向簇都需要「粗粒度阵营」——细到氏族一级，每条泳道只剩一两个人，
 * 反而看不出「谁与谁在同一边」。
 */
export const FACTION_RULES: [RegExp, string][] = [
  /* 三国十四道排在最前，理由有三，缺一条都会出事：
     ① **本片 22 条泳道里曾有 14 条只有一个人**（南中只有孟获、辽东只有公孙度、
        交州只有士燮、泰山只有臧霸、黑山只有张燕、五斗米道只有张鲁、徐州只有陶谦……）。
        这些阵营名都带**郡望或地名后缀**，须整串锚定：实测 /^辽东/ 会吞掉明代「辽东边将」、
        /^河东/ 会吞掉隋唐河东诸族、/^南阳/ 会吞掉新莽「南阳豪族」。故一律写全，
        宁可啰嗦（同新莽段那七条的理由）。
     ② **必须排在先秦之前**：孔融署「鲁国孔氏」，而先秦有 /^鲁国|^宋国|^郑国/，
        不先拦下，汉末的人就被挂进先秦的「中原诸国」泳道——朝代错位，
        界面上只表现为「先秦多了一个人」，不报错。
     ③ 「幽州军阀」与「徐州牧」两个值是官称不是势力（一个是州牧、一个是州牧的官名），
        归并为「幽州势力」「徐州陶谦」才看得出这是一块地方而不是一顶官帽子。
     另：张鲁的 faction 原值为「（五斗米道）」带全角括号，是排版遗留，
     已在数据侧改正；此处仍写 /^五斗米道/ 以锚整串，避免将来又被别的词抢走。 */
  [/^鲁国孔氏|^陈留蔡氏|^汉末名士/, '汉末文苑'],
  [/^颍川士族/, '颍川士族'],
  [/^太原王氏/, '太原王氏'],
  [/^南中豪帅/, '南中豪帅'],
  [/^范阳卢氏/, '范阳卢氏'],
  [/^南阳何氏/, '南阳何氏'],
  [/^幽州军阀/, '幽州势力'],
  [/^辽东公孙氏/, '辽东公孙氏'],
  [/^交州士氏/, '交州士氏'],
  [/^河东毌丘氏/, '河东毌丘氏'],
  [/^泰山群寇/, '泰山群寇'],
  [/^黑山军/, '黑山军'],
  [/^五斗米道/, '五斗米道'],
  [/^徐州牧/, '徐州陶谦'],
  /* 新莽更始排在最前：这一片有七个割据势力，faction 一律「地名 + 姓氏」，
     若落到后面的宽泛规则里，「梁地刘永」会被 /梁集团/ 抢成「汉室与功臣」、
     「并州卢芳」会被 /并州/ 抢成「汉末群雄」——朝代错位。

     **这些正则必须锚到完整阵营名，不能只写地名前缀。** 实测过：只写
     `/^南阳/` 会把三国的「南阳何氏」一并吞掉，`/^齐地/` 吞掉楚汉的「齐地群雄」，
     `/^并州/` 同时吞掉三国的「并州军事集团」与隋唐的「并州士族」——
     三条都是静默发生的，界面上只表现为「某代的人群变少了」。
     故此处一律写成「地名 + 姓氏」的整串，宁可啰嗦。
     另外「经生」必须显式归并：这一片不用「文人」「文苑」二字，
     因为那两词已被宋元明清与两晋的规则占住，写上去就会被抢走。 */
  [/^王氏外戚/, '王氏外戚'],
  [/^新室/, '新室'],
  [/^反莽起兵/, '反莽起兵'],
  [/^绿林/, '绿林'],
  [/^赤眉/, '赤眉'],
  [/^更始/, '更始政权'],
  [/^南阳豪族/, '南阳集团'],
  [/^云台/, '云台诸将'],
  [/^陇右隗嚣/, '陇右隗嚣'],
  [/^巴蜀成家/, '巴蜀成家'],
  [/^河西窦融/, '河西窦融'],
  [/^渔阳彭宠/, '渔阳彭宠'],
  [/^梁地刘永/, '梁地刘永'],
  [/^齐地张步/, '齐地张步'],
  [/^并州卢芳/, '并州卢芳'],
  [/^经生|^循吏/, '新莽经生'],
  [/^隐逸/, '新莽隐逸'],
  /* 五代十国排在最前：这一片的阵营名自带「后」字与「十国·」前缀，最为精确，
     放在前面不会抢走别代的词。十个国名归并为一条「十国」泳道——
     南唐、吴越、前后蜀加起来每国不足三人，各占一条泳道就是十条孤零零的散道。 */
  [/^后梁/, '后梁'],
  [/^后唐|^沙陀/, '后唐与沙陀'],
  [/^后晋/, '后晋'],
  [/^后汉/, '后汉'],
  [/^后周/, '后周'],
  [/^十国/, '十国'],
  [/^五代文臣/, '五代文臣'],
  [/^五代文苑|^五代画苑|^五代方外/, '五代文苑'],
  /* 宋元明清排在最前：这一片跨度九百五十年、阵营名最杂，而「文苑」「宦官」
     「武将」这类词在他代也有。若落到后面的宽泛规则里，宋人的词人会挂到明代泳道去。
     朝代名一律带「室」字（宋室、明室、清室），与先秦的「宋国」「卫国」明确区分。 */
  [/^宋室/, '赵宋皇室'],
  [/^北宋文臣|^新党|^旧党|^主战派|^主和派|^南宋文臣/, '宋代士大夫'],
  [/^北宋武将|^南宋武将/, '宋代武将'],
  [/^理学|^书画|^匠人/, '宋代文苑'],
  /* 辽金西夏：四个前缀必须逐个写全，不能图省事写成 /^辽/ ——
     实测 /^辽/ 会同时抢走两处：明代「辽东边将」（第 167 行那条规则排在后面，抢不过这里）
     与三国「辽东公孙氏」，一个词把三家分片的人拉进辽的泳道。
     同理 /^金/ 将来也可能撞上别的阵营名。**能写多具体就写多具体。** */
  [/^辽室|^辽将门|^辽汉臣|^西夏/, '辽与西夏'],
  [/^金室|^金宗室|^金将门|^金文苑/, '金室'],
  [/^蒙古诸部|^元室|^元臣|^元将门/, '蒙古与元'],
  /* 红巾军与元末三家割据从「蒙古与元」里拆出来单成一条泳道。
     按旧规则 /^红巾军/ 归入「蒙古与元」，等于把反元的一方画进元朝帐下——
     刘福通、韩林儿、陈友谅与元室同泳道，读图的人第一眼就会看错。
     本批补入元末群雄四人（韩林儿、陈友谅、张士诚、明玉珍）后此弊尤显，故拆之。 */
  [/^红巾军|^元末群雄/, '元末群雄'],
  [/^元曲|^元画/, '元曲与元画'],
  [/^明室/, '明皇室'],
  [/^明臣/, '明代士大夫'],
  [/^宦官|^流寇|^辽东边将|^南明/, '明代宦乱与边事'],
  /* 明代新分出的三条，理由与辽金西夏那一条同：**正则要锚到能区分朝代的整串**。
     本片「明代文苑」「明代将门」不用「文苑」「武将」二字，因为前者会被第 201 行的
     /^方外|^文苑/ 抢走、后者根本落不到具体规则上而自成散道。
     「明遗民」更不能写成「遗民」——两晋与先秦都另有遗民。 */
  [/^明代文苑|^明文苑/, '明代文苑'],
  [/^明代将门|^明将门/, '明代将门'],
  [/^明遗民/, '明遗民'],
  [/^清室/, '清皇室'],
  [/^清臣|^洋务派/, '清代士大夫'],
  [/^清代文苑|^清文苑/, '清代文苑'],
  [/^太平天国/, '太平天国'],
  [/^维新派/, '晚清维新'],
  /* 先秦诸国放在最前：其阵营名（秦国、楚国、齐国……）与他代不重叠，
     且「宋」「郑」「鲁」等小国若落到后面的宽泛规则里会被误并，故先行精确匹配。 */
  [/^周室/, '周王室'],
  [/^晋国/, '晋国'],
  [/^秦国/, '秦国'],
  [/^楚国/, '楚国'],
  /* 齐国单列：姜齐与田齐前后纵贯八百年，本片 15 人，比燕国（5 人）多出两倍，
     再并进「中原诸国」就与「燕国自成一道」自相矛盾，读者也看不出齐之分量。 */
  [/^齐国/, '齐国'],
  /* 春秋中小国原并作一条「中原诸国」，本片补入郑、卫、陈蔡人物后共 21 人，
     摊在一条道上连韩赵魏（16 人）都不如，而其中郑庄公小霸、子产铸刑书、
     卫武公入为王卿、陈完奔齐启田氏——每一桩都撑得起独立一道。
     故按国拆为五条。陈、蔡合一道：蔡仅哀侯一人，单列即成单人道。
     注意此五条必须排在 /^鲁国孔氏/ 之后（第 128 行），否则汉末孔融会被挂进「鲁国」。 */
  [/^郑国/, '郑国'],
  [/^宋国/, '宋国'],
  [/^鲁国/, '鲁国'],
  [/^卫国/, '卫国'],
  [/^陈国|^蔡国/, '陈蔡'],
  [/^吴国|^越国/, '吴越'],
  [/^魏国|^赵国|^韩国/, '三晋'],
  [/^燕国/, '燕国'],
  /* 楚汉的「纵横之士」必须拦在这一条之前：说客署「纵横之士」，
     若落到下面的 /^纵横/ 会并进「诸子百家」，而那道在楚汉片只有蒯通一人，
     等于把三条舌头（蒯通说韩信、随何说英布、侯公说项羽）拆散到两个朝代去。
     先秦的公孙衍仍署「纵横」二字，照旧并进诸子百家——两条规则的差别就在这里。 */
  [/^纵横之士/, '纵横之士'],
  [/^诸子|^纵横/, '诸子百家'],
  /* 两晋南北朝：门阀与胡族政权。必须排在「蜀汉/曹魏」之前——
     本片 faction 用的是「晋室」而非「司马」，若不先行匹配，
     会落到后面的宽泛规则里被误并；「南梁皇室」也会被「梁集团」抢走。 */
  [/^晋室外戚/, '晋室外戚'],
  [/^晋室/, '晋室与八王'],
  [/^琅琊王氏/, '琅琊王氏'],
  [/^颍川庾氏/, '颍川庾氏'],
  [/^高平郗氏/, '高平郗氏'],
  [/^陈郡谢氏/, '陈郡谢氏'],
  [/^谯国桓氏/, '谯国桓氏'],
  [/^刘宋皇室|^南齐皇室|^南梁皇室|^南陈皇室/, '南朝宋齐梁陈'],
  /* 「北魏士族」与「尔朱集团」并入同一条道，道名相应从「北魏与汉人士族」改为
     「北魏皇室与士族」：尔朱荣是秀容契胡，既非皇室亦非汉人士族，若照旧名归并就是
     把契胡权臣写进汉人士族，读图的人会误认族属。改名只是放宽了集合，不涉族属判断。
     李冲（陇西李氏）原拟用「清河崔氏」，但清河崔氏是特定郡望，不能拿来当通名。 */
  [/^北魏皇室|^清河崔氏|^北魏士族|^尔朱集团/, '北魏皇室与士族'],
  [/^北齐皇室/, '北齐高氏'],
  [/^北周皇室/, '北周宇文氏'],
  [/^氐秦|^羌秦|^鲜卑慕容|^羯胡|^侯景集团/, '十六国胡族'],
  [/^方外|^文苑/, '方外与文苑'],
  [/蜀汉/, '蜀汉集团'],
  [/曹魏|夏侯|司马|颍川荀/, '曹魏集团'],
  [/孙吴|江东|吴郡/, '孙吴集团'],
  [/^西楚/, '西楚集团'],
  /* 南越原先靠「faction 原值即道名」侥幸成道，写错一个字就会劈成两条。
     现补一条显式规则：南越片内五人（赵佗、赵胡、赵婴齐、赵兴、樛太后、吕嘉）同归一道。 */
  [/^南越/, '南越'],
  [/秦帝国|张楚/, '秦与张楚'],
  [/匈奴/, '匈奴'],
  [/汉室|丰沛|淮南|梁集团/, '汉室与功臣'],
  [/唐室|武周|内廷|降将/, '李唐皇室'],
  [/隋室/, '杨隋皇室'],
  [/关陇|独孤|长孙|弘农杨/, '关陇集团'],
  [/山东士族|山东豪杰|并州士族|文人/, '山东士族与文人'],
  [/三镇|朔方|藩镇/, '河朔藩镇'],
  [/袁氏|凉州|并州|兖州|汝南/, '汉末群雄'],
];

export function factionGroupOf(node: { factionOrClan?: string }): string {
  const raw = node.factionOrClan ?? '';
  if (!raw) return '';
  for (const [pattern, label] of FACTION_RULES) {
    if (pattern.test(raw)) return label;
  }
  return raw;
}

/* ------------------------------- 力导向布局 ------------------------------ */

export function computeForceLayout(
  nodes: HistoricalPersonNode[],
  edges: HistoricalRelationEdge[],
  options: {
    iterations?: number;
    targetWidth?: number;
    /** 目标包围盒宽高比（默认 1.8，对齐画布可用区，见文件内 normalise 注释） */
    aspect?: number;
    clusterPull?: number;
    gravity?: number;
    spread?: number;
    laneGap?: number;
    cellSize?: number;
    cellGap?: number;
    /** 块顶为时代名留出的横带厚度（世界单位），节点不会铺进来 */
    titleBand?: number;
    factionPull?: number;
    /** 四叉树近似阈值，见 lib/barnes-hut.ts；默认 0.85 */
    theta?: number;
    /** 置 true 则退回两两精确计算（O(n²)），只用于 A/B 对照，生产不要开 */
    exactRepulsion?: boolean;
  } = {},
): LayoutResult {
  const iterations = options.iterations ?? 800;
  const n = nodes.length;
  if (!n) return normalize(new Map());

  const seeds = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  nodes.forEach((node, i) => {
    const h = hashString(node.id);
    const angle = ((h % 4096) / 4096) * Math.PI * 2;
    const radius = Math.sqrt((i + 0.7) / n) * 620;
    seeds.set(node.id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    });
  });

  const idx = new Map<string, number>();
  const order = nodes.map((node, i) => {
    idx.set(node.id, i);
    return node.id;
  });

  const pairs: [number, number][] = [];
  for (const edge of edges) {
    const a = idx.get(edge.source);
    const b = idx.get(edge.target);
    if (a === undefined || b === undefined || a === b) continue;
    pairs.push([a, b]);
  }

  /**
   * 朝代引力簇：同朝代节点被微弱拉向各自的簇心，簇心均匀分布在一个横向椭圆上。
   * 作用有二——让「楚汉 / 三国 / 隋唐」自然聚成三团星云，跨朝代边成为连接星云的桥梁；
   * 同时避免全部节点挤成一个致密圆球，簇间留白后才看得清。
   */
  const dynastyIds = [...new Set(nodes.map((node) => node.dynasty))];
  const centerOf = new Map<string, { x: number; y: number }>();
  const laneCount = dynastyIds.length;
  dynastyIds.forEach((id, i) => {
    // 按时代先后自左向右分列（数据本身即按朝代编次），上下轻微交错避免成一条死线
    const x = laneCount <= 1 ? 0 : (i - (laneCount - 1) / 2) * (options.laneGap ?? 520);
    const y = laneCount <= 1 ? 0 : ((i % 2) - 0.5) * 300;
    centerOf.set(id, { x, y });
  });
  const dynastyOfIndex = nodes.map((node) => node.dynasty);

  /**
   * 阵营子簇：同一朝代内再按阵营分小簇，各簇心排在朝代簇心周围的小轨道上。
   * 只按朝代分簇的话，三国那一团里曹魏与蜀汉会混作一处，光靠边力分不开；
   * 有了子簇心，同阵营的人先聚拢，再被关系边拉到交界处，层次才出得来。
   */
  const factionOfIndex = nodes.map((node) => `${node.dynasty}::${factionGroupOf(node)}`);
  const factionCenterOf = new Map<string, { x: number; y: number }>();
  const factionsByDynasty = new Map<string, string[]>();
  nodes.forEach((node, i) => {
    const bucket = factionsByDynasty.get(node.dynasty) ?? [];
    if (!bucket.includes(factionOfIndex[i])) bucket.push(factionOfIndex[i]);
    factionsByDynasty.set(node.dynasty, bucket);
  });
  for (const [dynasty, keys] of factionsByDynasty) {
    const center = centerOf.get(dynasty);
    if (!center) continue;
    keys.forEach((key, i) => {
      const angle = (i / Math.max(1, keys.length)) * Math.PI * 2 - Math.PI / 2;
      const radius = keys.length === 1 ? 0 : 165;
      factionCenterOf.set(key, {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius * 0.85,
      });
    });
  }

  const k = Math.sqrt((1500 * 1000) / n) * (options.spread ?? 0.7);
  let temperature = 150;

  /* 斥力求解器。两两精确计算是 O(n²·iter)，642 人 0.9 秒、三千人一分半；
     四叉树近似把每轮降到 O(n log n)，物理模型（k²/d）不变，只换求和方式。
     旧的精确实现保留在 `exactRepulsion` 分支里，用于 A/B 对照与极端情况回退。 */
  const repulsion = new BarnesHut();
  const theta = options.theta ?? 0.85;
  const exact = options.exactRepulsion ?? false;

  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);
  order.forEach((id, i) => {
    const s = seeds.get(id)!;
    xs[i] = s.x;
    ys[i] = s.y;
  });

  for (let step = 0; step < iterations; step += 1) {
    dx.fill(0);
    dy.fill(0);

    // 斥力：默认走 Barnes-Hut 四叉树（O(n log n)），exactRepulsion 时退回两两精确
    if (exact) {
      for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
          let vx = xs[i] - xs[j];
          let vy = ys[i] - ys[j];
          let dist2 = vx * vx + vy * vy;
          if (dist2 < 0.01) {
            // 完全重合时按哈希给一个确定性的微小偏移，避免 NaN
            vx = ((hashString(order[i]) % 13) - 6) * 0.1 + 0.05;
            vy = ((hashString(order[j]) % 11) - 5) * 0.1 + 0.05;
            dist2 = vx * vx + vy * vy;
          }
          const dist = Math.sqrt(dist2);
          const force = (k * k) / dist;
          const ux = (vx / dist) * force;
          const uy = (vy / dist) * force;
          dx[i] += ux;
          dy[i] += uy;
          dx[j] -= ux;
          dy[j] -= uy;
        }
      }
    } else {
      repulsion.build(xs, ys, n);
      repulsion.apply(n, k, theta, dx, dy);
    }

    // 引力：沿边收缩
    for (const [a, b] of pairs) {
      const vx = xs[a] - xs[b];
      const vy = ys[a] - ys[b];
      const dist = Math.sqrt(vx * vx + vy * vy) || 0.01;
      const force = (dist * dist) / k;
      const ux = (vx / dist) * force;
      const uy = (vy / dist) * force;
      dx[a] -= ux;
      dy[a] -= uy;
      dx[b] += ux;
      dy[b] += uy;
    }

    // 朝代向心力（弱） + 全局向心重力（更弱） + 温度限制位移
    for (let i = 0; i < n; i += 1) {
      const center = centerOf.get(dynastyOfIndex[i]);
      if (center) {
        const pull = options.clusterPull ?? 0.09;
        dx[i] += (center.x - xs[i]) * pull;
        dy[i] += (center.y - ys[i]) * pull;
      }
      const factionCenter = factionCenterOf.get(factionOfIndex[i]);
      if (factionCenter) {
        // 子簇引力略强于朝代引力：先顾阵营，再顾朝代，
        // 否则两个力互相抵消，阵营边界会糊掉。
        const pull = options.factionPull ?? 0.035;
        dx[i] += (factionCenter.x - xs[i]) * pull;
        dy[i] += (factionCenter.y - ys[i]) * pull;
      }
      const gravity = options.gravity ?? 0.006;
      dx[i] -= xs[i] * gravity;
      dy[i] -= ys[i] * gravity;
      const d = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 0.01;
      const limited = Math.min(d, temperature);
      xs[i] += (dx[i] / d) * limited;
      ys[i] += (dy[i] / d) * limited;
    }

    temperature = Math.max(0.5, temperature * 0.9905);
  }

  /* ------------------------ 簇内整形 + 时代分块 ------------------------ */
  // 力导向跑完后各簇松紧不一：有的朝代抱成一团，有的被关系拉成长条。
  // 这里把每个时代收进一块自己的「版图」，十块拼成一幅按纪年编排的图——
  // 形状不乱动（节点圆是屏幕空间绘制的，坐标缩放不会让脸变形），
  // 只统一尺度与站位。
  //
  // 曾把这十来个时代格排成**一横排**。后果是灾难性的：十块横向铺开 7,560、
  // 纵向只有 560，包围盒 13.5 : 1；fitView 按宽度装进 1440 的画布后，
  // 整幅图只剩一条 120px 高的横带，1,136 人挤在 17 万像素里、平均间距 12px，
  // 而节点半径是 10px —— 于是全部重叠成一团，谁都认不出谁。
  // 屏幕占用面积只取决于「内容比例与画布比例是否一致」，排成横条就是丢掉七八成面积。
  const members = new Map<string, number[]>();
  order.forEach((_, i) => {
    const era = eraOf(dynastyOfIndex[i]);
    const bucket = members.get(era) ?? [];
    bucket.push(i);
    members.set(era, bucket);
  });
  /**
   * 分块必须按**纪年**排，不能按「谁先出现」排。
   * ------------------------------------------------------------------
   * `members` 是 Map，键序取决于节点在 `order` 里的首次出现顺序，而这个顺序
   * 由力导向的初始打散决定。后果是网格按行回读时王朝乱序：实测首屏读到的是
   * 「上古·先秦 / 秦汉 / 汉末·三国 / 魏晋南北朝」→「隋唐 / 宋 / 元 / 明」
   * →「清 / 五代十国」，五代十国被排到清代之后。一张按年编排的图，
   * 读序错了就失去索引价值。排序键取 ERA_LABEL 的声明顺序（该对象本就按年代逐条写），
   * 未登记的时代排到最后，不会打乱已知序列。
   */
  const ERA_ORDER = new Map(Object.keys(ERA_LABEL).map((key, i) => [key, i]));
  const lanes = [...members.keys()].sort(
    (a, b) => (ERA_ORDER.get(a) ?? 999) - (ERA_ORDER.get(b) ?? 999),
  );

  /**
   * 拼块方案：**面积正比于人数**的书架式排版，按纪年逐块填行。
   * ------------------------------------------------------------------
   * 早先每行等高、每块宽按人数开方缩放，于是「元」二十人占着与「宋」六十人
   * 一样高的格子，整块稀稀拉拉；这种人少的块一多，读图的人会以为「元代没什么人」。
   * 面积按人数配之后，密度到处一致：块的大小本身就是一条信息——谁的人多，
   * 谁的版图就大。
   *
   * 试过两种切法，都不合用，留此存照：
   *   ① 「等高行 + 行内按人数分宽」——小朝代被压成竖缝，元朝二十人只占一条
   *      六十宽的栏，点排成两列，像牢房栏杆；
   *   ② squarified treemap——块是方了，但它为了凑方会把大块竖着切开，
   *      读序随之错乱（五代十国被摆到隋唐右侧、清摆到元明之下），
   *      一张按年编排的图，读序比块形重要。
   *
   * 现在的做法是「书架」：按纪年顺序往一行里放方块（边长 ∝ √人数，故面积 ∝ 人数），
   * 放满一行或下一块会把本行最窄的块压得比 0.62 更瘦就换行；最后整行按宽度
   * 均摊补齐、整幅按高度均摊补齐，于是既不悬空也不留缝，长宽比全落在 0.62~1.6。
   */
  const ASPECT = options.aspect ?? 1.8;
  const totalW = options.targetWidth ?? 1600;
  const totalH = totalW / ASPECT;
  /** 块间距：世界单位。1600 宽 → 0.63 倍屏幕时约 17px，读得出「这是两块」 */
  const GAP = options.cellGap ?? 28;
  /** 块顶横带：留给时代名。节点只铺在横带以下，标题永远压不到人 */
  const BAND = options.titleBand ?? 34;

  const counts = lanes.map((lane) => members.get(lane)!.length);
  const totalCount = counts.reduce((a, b) => a + b, 0) || 1;
  const unitArea = (totalW * totalH) / totalCount;
  const sides = counts.map((c) => Math.sqrt(Math.max(1, c) * unitArea));

  type Cell = { cx: number; cy: number; w: number; h: number; lane: string };
  const cells: Cell[] = [];

  /** 行内按已排的方块宽度算出最窄那一块会被压到多瘦（1 表示正方的理想值） */
  const narrowestAspect = (row: number[], extra: number): number => {
    const span = row.reduce((a, i) => a + sides[i], 0) + (extra >= 0 ? sides[extra] : 0);
    const rowH = Math.max(...row.map((i) => sides[i]), extra >= 0 ? sides[extra] : 0);
    const densest = Math.max(...row.map((i) => sides[i]), extra >= 0 ? sides[extra] : 0);
    const stretch = totalW / Math.max(1e-6, span);
    return (Math.min(...row.map((i) => sides[i]), extra >= 0 ? sides[extra] : Infinity) * stretch) / rowH === 0
      ? 0
      : Math.min(
          (Math.min(...row.map((i) => sides[i]), extra >= 0 ? sides[extra] : Infinity) * stretch) / rowH,
          rowH / densest,
        );
  };

  const shelf: number[][] = [];
  let current: number[] = [];
  let currentSpan = 0;
  for (let i = 0; i < lanes.length; i += 1) {
    if (!current.length) {
      current = [i];
      currentSpan = sides[i];
      continue;
    }
    const overflow = currentSpan + sides[i] > totalW;
    const tooThin = narrowestAspect(current, i) < 0.62;
    if (overflow || tooThin) {
      shelf.push(current);
      current = [i];
      currentSpan = sides[i];
    } else {
      current.push(i);
      currentSpan += sides[i];
    }
  }
  if (current.length) shelf.push(current);

  // 行高先按行内最高块定，最后整体缩放填满高度；行内宽度按比例放大填满整行
  const rowHeights = shelf.map((row) => Math.max(...row.map((i) => sides[i])));
  const heightSum = rowHeights.reduce((a, b) => a + b, 0) || 1;
  const heightScale = (totalH - GAP * (shelf.length - 1)) / heightSum;

  let yTop = -totalH / 2;
  for (let ri = 0; ri < shelf.length; ri += 1) {
    const row = shelf[ri];
    const rowH = rowHeights[ri] * heightScale;
    const span = row.reduce((a, i) => a + sides[i], 0) || 1;
    const usableW = totalW - GAP * (row.length - 1);
    let xLeft = -totalW / 2;
    for (const i of row) {
      const w = (sides[i] / span) * usableW;
      cells.push({
        cx: xLeft + w / 2,
        cy: yTop + rowH / 2,
        w,
        h: rowH,
        lane: lanes[i],
      });
      xLeft += w + GAP;
    }
    yTop += rowH + GAP;
  }

  /**
   * 簇内碰撞松弛（去掉重合）。
   * ------------------------------------------------------------------
   * 力导向收敛后仍有大量点几乎重合：实测全库 1,136 人，最近邻中位数只有
   * 4.7 个世界单位，而按人均面积应得三十余 —— 差一个数量级。后果就是打开
   * 网站看到「所有人都糅合在一起」，无论怎么改包围盒比例都救不回来：
   * 比例决定的是**整幅图占多少屏幕**，而这里坏的是**簇内分布**。
   *
   * 这一道就是 d3-force 的 forceCollide：按「块内人均面积开方」定一个目标
   * 间距，以均匀网格找邻居，把靠得太近的一对对互相推开，直到不再有明显重叠。
   * 它只负责「不重叠」，时代分块不动，只在块内把人摊匀。
   */
  const relaxCluster = (
    idxs: number[],
    gapScale: number,
    area: { cx: number; cy: number; w: number; h: number },
  ) => {
    if (idxs.length < 2) return;
    const gap = Math.sqrt((area.w * area.h) / Math.max(1, idxs.length)) * gapScale;
    if (!Number.isFinite(gap) || gap <= 0) return;
    const push = new Float64Array(n * 2);
    for (let iter = 0; iter < 120; iter += 1) {
      const grid = new Map<string, number[]>();
      for (const i of idxs) {
        const key = `${Math.floor(xs[i] / gap)},${Math.floor(ys[i] / gap)}`;
        const bucket = grid.get(key);
        if (bucket) bucket.push(i);
        else grid.set(key, [i]);
      }
      push.fill(0);
      let moved = 0;
      for (const i of idxs) {
        const gx0 = Math.floor(xs[i] / gap);
        const gy0 = Math.floor(ys[i] / gap);
        let ax = 0;
        let ay = 0;
        for (let gx = gx0 - 1; gx <= gx0 + 1; gx += 1) {
          for (let gy = gy0 - 1; gy <= gy0 + 1; gy += 1) {
            const bucket = grid.get(`${gx},${gy}`);
            if (!bucket) continue;
            for (const j of bucket) {
              if (j === i) continue;
              let vx = xs[i] - xs[j];
              let vy = ys[i] - ys[j];
              let d2 = vx * vx + vy * vy;
              if (d2 >= gap * gap) continue;
              if (d2 < 1e-4) {
                // 完全重合：按索引拆开（不用随机数，同一份数据每次得到同一张图）
                vx = ((i % 7) - 3) * 0.05 + 0.07;
                vy = ((i % 5) - 2) * 0.05 + 0.03;
                d2 = vx * vx + vy * vy;
              }
              const d = Math.sqrt(d2);
              const step = ((gap - d) / d) * 0.5;
              ax += vx * step;
              ay += vy * step;
            }
          }
        }
        if (ax || ay) {
          const len = Math.hypot(ax, ay);
          const cap = gap * 0.5;
          const k2 = len > cap ? cap / len : 1;
          push[i * 2] = ax * k2;
          push[i * 2 + 1] = ay * k2;
          moved += 1;
        }
      }
      if (!moved) break;
      for (const i of idxs) {
        xs[i] += push[i * 2];
        ys[i] += push[i * 2 + 1];
        /**
         * 松弛限定在自己的块里。不设边界的话，簇会向外摊到别人的版图上，
         * 事后再按包围盒缩回来就等于把摊开的间距又压回去（实测最近邻
         * 19px → 12px，一半人重新重叠）。圈在块内松弛，摊匀与地界同时成立。
         */
        const mx0 = area.cx - area.w / 2 + gap * 0.35;
        const mx1 = area.cx + area.w / 2 - gap * 0.35;
        const my0 = area.cy - area.h / 2 + gap * 0.35;
        const my1 = area.cy + area.h / 2 - gap * 0.35;
        if (xs[i] < mx0) xs[i] = mx0;
        else if (xs[i] > mx1) xs[i] = mx1;
        if (ys[i] < my0) ys[i] = my0;
        else if (ys[i] > my1) ys[i] = my1;
      }
    }
  };

  const blocks: LayoutBlock[] = [];
  for (const cell of cells) {
    const idxs = members.get(cell.lane)!;
    /**
     * 内容区：块内四边各收 GAP/2（块与块之间的缝由此成形），块顶再让出 BAND。
     * 让出的横带是给时代名用的——标题画在横带里，永远不会压到人。
     */
    const inset = GAP * 0.5;
    const contentTop = cell.cy - cell.h / 2 + BAND;
    const contentH = Math.max(BAND + 1, cell.h - BAND - inset);
    const area = {
      cx: cell.cx,
      cy: contentTop + contentH / 2,
      w: Math.max(1, cell.w - inset * 2),
      h: contentH,
    };

    // 先按力导向的原形等比塞进这块内容区（形状保留），再松弛摊匀
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const i of idxs) {
      if (xs[i] < minX) minX = xs[i];
      if (xs[i] > maxX) maxX = xs[i];
      if (ys[i] < minY) minY = ys[i];
      if (ys[i] > maxY) maxY = ys[i];
    }
    const k = Math.min(
      area.w / Math.max(1e-6, maxX - minX),
      area.h / Math.max(1e-6, maxY - minY),
    );
    const mx = (minX + maxX) / 2;
    const my = (minY + maxY) / 2;
    for (const i of idxs) {
      xs[i] = area.cx + (xs[i] - mx) * k;
      ys[i] = area.cy + (ys[i] - my) * k;
    }

    relaxCluster(idxs, 1.0, area);

    /**
     * 微抖动：打散「打孔板」。
     * ------------------------------------------------------------------
     * 松弛的收敛态是完美点阵——每一行每一列都对齐，放大了看像一块穿孔板，
     * 不像人画出来的星图。加一点确定性抖动（同一个人每次落点相同，
     * 不能随机，否则每刷新一次整幅图都在跳），点阵的摩尔纹就散开了。
     *
     * 幅度按权重分档：显赫人物几乎不动（他们身上挂着名字与头像），
     * 长尾人物抖到间距的两成——视觉上「密而不齐」，最近邻仍留有余量。
     */
    const gapStep = Math.sqrt((area.w * area.h) / Math.max(1, idxs.length));
    for (const i of idxs) {
      const weight = nodes[i]?.importanceWeight ?? 50;
      const amp = gapStep * (weight >= 70 ? 0.06 : 0.34);
      const hx = (hashString(order[i]) % 1000) / 1000 - 0.5;
      const hy = (hashString(order[i] + '#y') % 1000) / 1000 - 0.5;
      xs[i] += hx * 2 * amp;
      ys[i] += hy * 2 * amp;
    }

    blocks.push({
      label: ERA_LABEL[cell.lane] ?? cell.lane,
      x: cell.cx,
      y: cell.cy,
      w: cell.w,
      h: cell.h,
      band: BAND,
    });
  }

  const positions: PositionedMap = new Map();
  order.forEach((id, i) => positions.set(id, { x: xs[i], y: ys[i] }));
  /**
   * 世界宽度取 1600、比例取 ASPECT。
   * 这两个数共同决定 fitView 之后的缩放：宽度 1600 落在 1440 宽屏上约 0.7×，
   * 比例与可用视口一致（1.8 对 1.885）时高度也刚好填满，此时首屏是
   * 「概览」而非「中观」——那正是该有的档位，详见 canvas 里的 LOD 说明。
   */
  return normalize(positions, options.targetWidth ?? 1600, ASPECT, blocks);
}

/* ------------------------------ 宗法世系树布局 --------------------------- */

export function computeLineageLayout(
  graph: GraphIndex,
  nodeIds?: Set<string>,
): LayoutResult {
  const pool = nodeIds ? graph.nodeList.filter((node) => nodeIds.has(node.id)) : graph.nodeList;
  if (!pool.length) return normalize(new Map());

  const poolIds = new Set(pool.map((node) => node.id));
  const primaryRoots = findLineageRoots(graph, poolIds);
  const roots: string[] = [];
  const covered = new Set<string>();

  for (const rootId of primaryRoots) {
    if (covered.has(rootId)) continue;
    roots.push(rootId);
    // 标记该树覆盖的节点，避免下一棵树重复
    const treeData = buildLineageTree(graph, rootId, 9);
    if (treeData) {
      const stack = [treeData];
      while (stack.length) {
        const cur = stack.pop()!;
        covered.add(cur.id);
        for (const child of cur.children) stack.push(child);
      }
    }
    if (roots.length >= 4) break;
  }

  const positions: PositionedMap = new Map();
  let cursorX = 0;
  const laneGap = 260;

  for (const rootId of roots) {
    const treeData = buildLineageTree(graph, rootId, 9);
    if (!treeData) continue;

    const root = hierarchy<LineageTreeNode>(treeData, (d) => (d.children.length ? d.children : undefined));
    const layout = tree<LineageTreeNode>().nodeSize([104, 172]);
    layout(root);

    let minX = Infinity;
    let maxX = -Infinity;
    root.each((n2) => {
      const nx = n2.x ?? 0;
      if (nx < minX) minX = nx;
      if (nx > maxX) maxX = nx;
    });

    root.each((n2) => {
      positions.set(n2.data.id, {
        x: (n2.x ?? 0) - minX + cursorX,
        y: n2.y ?? 0,
      });
    });
    cursorX += maxX - minX + laneGap;
  }

  // 未被世系树覆盖的节点（无血亲/姻亲/师承连接的孤立者），在下方按网格排布
  const leftovers = pool.filter((node) => !positions.has(node.id));
  if (leftovers.length) {
    let maxY = 0;
    for (const p of positions.values()) maxY = Math.max(maxY, p.y);
    const columns = Math.max(4, Math.ceil(Math.sqrt(leftovers.length * 1.6)));
    leftovers.forEach((node, i) => {
      positions.set(node.id, {
        x: cursorX + (i % columns) * 118,
        y: maxY + 180 + Math.floor(i / columns) * 118,
      });
    });
  }

  return normalize(positions, 1720);
}

/* ------------------------------- 纪年泳道布局 ---------------------------- */

const LANE_HEIGHT = 190;

export function computeSwimlaneLayout(
  nodes: HistoricalPersonNode[],
  dynastyOrder: DynastyId[],
  dynastyLabel: (id: DynastyId) => string,
): LayoutResult {
  if (!nodes.length) return normalize(new Map());

  const ranges = new Map<string, [number, number]>();
  let minYear = Infinity;
  let maxYear = -Infinity;
  for (const node of nodes) {
    const range = personActiveRange(node);
    ranges.set(node.id, range);
    minYear = Math.min(minYear, range[0]);
    maxYear = Math.max(maxYear, range[1]);
  }
  const span = Math.max(1, maxYear - minYear);
  const dynastyRank = new Map(dynastyOrder.map((id, i) => [id, i]));

  /**
   * 泳道按「阵营」划分，而不是按朝代。
   * 规范点名的场景是三国分片自动分出「汉室 / 群雄、曹魏、蜀汉、东吴」四条，
   * 若按朝代分，整个汉末三国只会压成两条泳道，看不出同代人各为其主。
   * 未记阵营者退回朝代泳道，并注明「未记阵营」，不假装他属于某派。
   */
  interface Lane {
    label: string;
    rank: number;
    firstYear: number;
    members: HistoricalPersonNode[];
  }
  const lanes = new Map<string, Lane>();
  for (const node of nodes) {
    const faction = factionGroupOf(node);
    const key = faction || `${node.dynasty}::__none__`;
    const label = faction || `${dynastyLabel(node.dynasty)}（未记阵营）`;
    const rank = (dynastyRank.get(node.dynasty) ?? 99) * 100 + (faction ? 0 : 1);
    const startYear = ranges.get(node.id)![0];
    const lane = lanes.get(key);
    if (lane) {
      lane.members.push(node);
      lane.firstYear = Math.min(lane.firstYear, startYear);
    } else {
      lanes.set(key, { label, rank, firstYear: startYear, members: [node] });
    }
  }

  // 先按登场年份，再按朝代次序：读起来就是从秦到唐的一条时间纵轴
  const ordered = [...lanes.values()].sort(
    (a, b) => a.firstYear - b.firstYear || a.rank - b.rank || a.label.localeCompare(b.label),
  );

  const positions: PositionedMap = new Map();
  const rowCursor = new Map<string, number>();

  ordered.forEach((lane, laneIndex) => {
    // 泳道内按登场年排序，同行冲突则错开成三行小簇
    const members = [...lane.members].sort((a, b) => {
      const ra = ranges.get(a.id)!;
      const rb = ranges.get(b.id)!;
      return ra[0] - rb[0] || b.importanceWeight - a.importanceWeight;
    });
    const baseY = laneIndex * LANE_HEIGHT + LANE_HEIGHT / 2;
    for (const node of members) {
      const [start] = ranges.get(node.id)!;
      const x = ((start - minYear) / span) * 3000;
      const key = `${lane.label}#${Math.floor(x / 132)}`;
      const slot = rowCursor.get(key) ?? 0;
      rowCursor.set(key, slot + 1);
      // 每格最多叠到第三行；再多就往外散开，免得压成一条墨线
      const offset = (slot % 3) * 46 - 46 + Math.floor(slot / 3) * 14;
      positions.set(node.id, { x, y: baseY + offset });
    }
  });

  const result = normalize(positions, 1900);

  // 泳道线要跟着同一次归一化走：先算原始包围盒，再用与 normalize 相同的线性变换
  let rawMinY = Infinity;
  let rawMaxY = -Infinity;
  for (const p of positions.values()) {
    if (p.y < rawMinY) rawMinY = p.y;
    if (p.y > rawMaxY) rawMaxY = p.y;
  }
  const rawCy = (rawMinY + rawMaxY) / 2;
  const scaleY = result.bounds.maxY > 0 ? result.bounds.maxY / Math.max(1e-6, (rawMaxY - rawMinY) / 2) : 1;

  result.lanes = ordered.map((lane, i) => ({
    label: lane.label,
    y: (i * LANE_HEIGHT + LANE_HEIGHT / 2 - rawCy) * scaleY,
    height: LANE_HEIGHT * scaleY,
  }));
  return result;
}

/* --------------------------------- 统一入口 ------------------------------ */

export function computeLayout(
  mode: GraphLayoutMode,
  nodes: HistoricalPersonNode[],
  edges: HistoricalRelationEdge[],
  graph: GraphIndex,
  options: { dynastyOrder: DynastyId[]; dynastyLabel: (id: DynastyId) => string },
): LayoutResult {
  if (mode === 'lineage') return computeLineageLayout(graph);
  if (mode === 'swimlane') return computeSwimlaneLayout(nodes, options.dynastyOrder, options.dynastyLabel);
  return computeForceLayout(nodes, edges);
}
