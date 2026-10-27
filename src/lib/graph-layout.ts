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

export interface LayoutResult {
  positions: PositionedMap;
  /** 世界坐标包围盒，供相机自适应 */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** 泳道模式下的分层标签 */
  lanes: { label: string; y: number; height: number }[];
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

function normalize(positions: PositionedMap, targetWidth = 1720): LayoutResult {
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
    return { positions, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, lanes: [] };
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = targetWidth / spanX;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const out: PositionedMap = new Map();
  for (const [id, p] of positions) {
    out.set(id, { x: (p.x - cx) * scale, y: (p.y - cy) * scale });
  }
  return {
    positions: out,
    bounds: {
      minX: -spanX * scale * 0.5,
      maxX: spanX * scale * 0.5,
      minY: -spanY * scale * 0.5,
      maxY: spanY * scale * 0.5,
    },
    lanes: [],
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

function eraOf(dynasty: DynastyId): string {
  return ERA_TABLE[dynasty] ?? dynasty;
}

/**
 * 阵营归并：把五花八门的 factionOrClan（「蜀汉集团（荆州派）」「颍川荀氏」
 * 「范阳·平卢·河东三镇」……）收敛成十几个可读的阵营名。
 * 泳道与力导向簇都需要「粗粒度阵营」——细到氏族一级，每条泳道只剩一两个人，
 * 反而看不出「谁与谁在同一边」。
 */
const FACTION_RULES: [RegExp, string][] = [
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
  [/^辽室|^西夏/, '辽与西夏'],
  [/^金室/, '金室'],
  [/^蒙古诸部|^元室|^元臣|^红巾军/, '蒙古与元'],
  [/^元曲|^元画/, '元曲与元画'],
  [/^明室/, '明皇室'],
  [/^明臣/, '明代士大夫'],
  [/^宦官|^流寇|^辽东边将|^南明/, '明代宦乱与边事'],
  [/^清室/, '清皇室'],
  [/^清臣|^洋务派/, '清代士大夫'],
  [/^维新派/, '晚清维新'],
  /* 先秦诸国放在最前：其阵营名（秦国、楚国、齐国……）与他代不重叠，
     且「宋」「郑」「鲁」等小国若落到后面的宽泛规则里会被误并，故先行精确匹配。 */
  [/^周室/, '周王室'],
  [/^晋国/, '晋国'],
  [/^秦国/, '秦国'],
  [/^楚国/, '楚国'],
  [/^齐国|^鲁国|^宋国|^郑国/, '中原诸国'],
  [/^吴国|^越国/, '吴越'],
  [/^魏国|^赵国|^韩国/, '三晋'],
  [/^燕国/, '燕国'],
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
  [/^北魏皇室|^清河崔氏/, '北魏与汉人士族'],
  [/^北齐皇室/, '北齐高氏'],
  [/^北周皇室/, '北周宇文氏'],
  [/^氐秦|^羌秦|^鲜卑慕容|^羯胡|^侯景集团/, '十六国胡族'],
  [/^方外|^文苑/, '方外与文苑'],
  [/蜀汉/, '蜀汉集团'],
  [/曹魏|夏侯|司马|颍川荀/, '曹魏集团'],
  [/孙吴|江东|吴郡/, '孙吴集团'],
  [/西楚/, '西楚集团'],
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
    clusterPull?: number;
    gravity?: number;
    spread?: number;
    laneGap?: number;
    cellSize?: number;
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

  /* ------------------------ 簇内整形 + 时代分列 ------------------------ */
  // 力导向跑完后各簇松紧不一：有的朝代抱成一团，有的被关系拉成长条。
  // 这里对每簇按其自身包围盒等比缩放，再等距排到「时代列」上——形状不变，
  // 只统一尺度与站位，整幅图才会像一卷按年编排的星图，而不是一团散墨。
  const members = new Map<string, number[]>();
  order.forEach((_, i) => {
    const era = eraOf(dynastyOfIndex[i]);
    const bucket = members.get(era) ?? [];
    bucket.push(i);
    members.set(era, bucket);
  });
  const lanes = [...members.keys()];
  const CELL = options.cellSize ?? 560;
  lanes.forEach((dynastyId, laneIndex) => {
    const idxs = members.get(dynastyId)!;
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
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    // 横纵分别归一，让每簇都填满一个方格：力导向常把某朝代压成扁条，
    // 只按长边等比缩放会留下大片空白。节点圆本身是屏幕空间绘制，不受拉伸影响。
    const sx = CELL / Math.max(1, maxX - minX);
    const sy = CELL / Math.max(1, maxY - minY);
    const laneX = lanes.length <= 1 ? 0 : (laneIndex - (lanes.length - 1) / 2) * CELL * 1.35;
    for (const i of idxs) {
      xs[i] = laneX + (xs[i] - cx) * sx;
      ys[i] = (ys[i] - cy) * sy;
    }
  });

  const positions: PositionedMap = new Map();
  order.forEach((id, i) => positions.set(id, { x: xs[i], y: ys[i] }));
  // 世界宽度取 1600 而非 1720：画布在 1440 宽屏上自适应后正好落在 0.77 倍，
  // 恰在「中观」档内；若再宽一点就会掉进宏观档，首屏只剩帝王权臣。
  return normalize(positions, options.targetWidth ?? 1600);
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
