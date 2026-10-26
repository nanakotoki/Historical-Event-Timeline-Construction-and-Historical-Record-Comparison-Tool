'use client';

/**
 * 全息关系图谱画布（Canvas 2D）
 * ------------------------------------------------------------------
 * 设计要点：
 *  ① 单画布 + 手动投影：所有几何在屏幕空间计算，标签字号恒定可读，
 *     避免 ctx.scale 造成的字体模糊；
 *  ② 语义级 LOD（三档），按 importanceWeight 阈值 + 缩放级别双重裁剪；
 *  ③ 视口裁剪：只绘制落在画布外扩 120px 内的节点与边；
 *  ④ 关系色 / 虚线 / 双线 / 箭头全部由 RELATION_META 驱动，
 *     单年截面下改用 temporalPhases 推演出的当年关系性质着色；
 *  ⑤ 交互：滚轮以光标为锚缩放、拖拽平移、双击聚焦、点击节点/边、
 *     Ego 聚焦时非相关节点隐退至 12% 不透明度。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GraphLayoutMode,
  HistoricalPersonNode,
  HistoricalRelationEdge,
  RelationCategory,
} from '@/types/history';
import type { GraphIndex } from '@/lib/graph-algorithms';
import { edgeCategoryAt, isPersonAliveAt } from '@/lib/graph-algorithms';
import type { LayoutResult } from '@/lib/graph-layout';
import { RELATION_META } from '@/lib/search-engine';
import { dynastyColor } from '@/data/dynasties';
import { getPortraitImage, onPortraitLoaded } from '@/lib/portrait-resolver';
import { formatYear } from '@/lib/data-loader';
import { useTheme } from '@/components/providers/ThemeProvider';

/** 屏幕空间矩形 */
interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** 一个已定好位置的姓名标签 */
interface Placement {
  box: Rect;
  align: CanvasTextAlign;
  nameX: number;
  nameY: number;
  titleX: number;
  titleY: number;
  second: string;
}

export interface HistoryGraphCanvasProps {
  nodes: HistoricalPersonNode[];
  edges: HistoricalRelationEdge[];
  graph: GraphIndex;
  layout: LayoutResult;
  layoutMode: GraphLayoutMode;
  /** 单年截面（null 表示区间模式，不按年份变色） */
  year: number | null;
  selectedId: string | null;
  egoNodeIds: Set<string> | null;
  egoEdgeIds: Set<string> | null;
  /** 寻路结果链路上的人物（触发流光动画，null 表示无寻路高亮） */
  pathNodeIds?: string[] | null;
  relationFilter: Set<RelationCategory>;
  onSelectPerson: (id: string) => void;
  onSelectEdge: (edge: HistoricalRelationEdge) => void;
  onClearSelection: () => void;
  /** 请求把镜头对准某人（token 变化触发） */
  focusRequest: { id: string; token: number } | null;
  /** 请求复位视图（token 变化触发） */
  fitToken: number;
  /**
   * 右侧被档案抽屉遮住的宽度（px）。
   * 抽屉一开就压掉近三分之一画布，若不把这块让出来，
   * 「点击节点→居中」会把节点正好送到抽屉背后。
   */
  rightInset?: number;
  onScaleChange?: (info: { scale: number; lod: 0 | 1 | 2; visibleNodes: number }) => void;
}

/**
 * 三档 LOD 的最低可视权重：
 *   宏观（scale < 0.7）只看 75 分以上的帝王权臣，隐藏次要关系边；
 *   中观（0.7 ~ 1.6）放开到 40 分；
 *   微观（>= 1.6）不再设门槛——长尾人物此时必须出现，否则「微观交游」名不副实。
 */
const LOD_WEIGHT: [number, number, number] = [75, 40, 0];

/**
 * 画布上那一行「核心头衔」取什么：
 * 谥号/庙号 > 封爵 > 首个官职 > 首个身份标签。
 * 帝王取「魏武帝」这类谥号最合史书习惯，谋臣武将则多半没有谥号，
 * 退到「丞相」「骠骑将军」反而更认得出来。
 */
function primaryTitleOf(node: HistoricalPersonNode): string {
  const a = node.aliases;
  // 数据里偶有把夹注写进异名字段的情形（如「（秦以水德，未行谥法）」）。
  // 那不是头衔，是说明；画布只认短称谓，括注与超长串一律让位给下一顺位。
  const usable = (value: string | undefined): value is string =>
    Boolean(value) && !/^[（(]/.test(value!) && value!.length <= 12;
  const candidates = [
    a.posthumousTitle,
    a.templeName,
    a.feudalTitles?.[0],
    node.officialTitles[0],
    node.roles[0],
  ];
  return candidates.find(usable) ?? '';
}

/**
 * 头像离屏缓存。
 * 直接每帧 drawImage 一张 SVG，浏览器要重新栅格化一遍；中观层几百人同屏时
 * 单这一项就能吃掉两百多毫秒。这里按「人物 + 半径档位」把裁好圆的头像
 * 预先画到一张小画布上，之后每帧只是位图搬运。
 * 半径按 0.5px 分档：缩放时档位变化会重新生成，画质不受损。
 */
/**
 * 文本宽度缓存。
 * 排布阶段每个人要量两次（姓名 + 次行），六百人就是一千多次 measureText，
 * 而这串文字在整场会话里几乎不变。按「字体 + 文本」缓存即可。
 */
const TEXT_WIDTH_CACHE = new Map<string, number>();

function measureCached(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  const key = `${font}\u0000${text}`;
  const hit = TEXT_WIDTH_CACHE.get(key);
  if (hit !== undefined) return hit;
  const prev = ctx.font;
  ctx.font = font;
  const width = ctx.measureText(text).width;
  ctx.font = prev;
  if (TEXT_WIDTH_CACHE.size > 6000) TEXT_WIDTH_CACHE.clear();
  TEXT_WIDTH_CACHE.set(key, width);
  return width;
}

const SPRITE_CACHE = new Map<string, HTMLCanvasElement>();

function portraitSprite(
  id: string,
  img: HTMLImageElement,
  r: number,
  dpr: number,
): HTMLCanvasElement | null {
  const radius = Math.max(4, Math.round(r * 0.9 * 2) / 2);
  const key = `${id}|${radius}|${dpr}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const size = Math.ceil(radius * 2 * dpr);
  if (size <= 0 || size > 2048) return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return null;

  const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
  g.save();
  g.beginPath();
  g.arc(size / 2, size / 2, radius * dpr, 0, Math.PI * 2);
  g.clip();
  // 取「头肩」入圆：传世画像多为全身立轴，整幅塞进小圆后人物只剩拇指大。
  // 以图宽的方形截取上半部（头顶留 4% 余量），近似历代名臣像的册页取景。
  if (ratio >= 0.82 && ratio <= 1.24) {
    // 本就是半身/方形构图，直接满幅
    g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, size, size);
  } else {
    const side = Math.min(img.naturalWidth, img.naturalHeight * 0.5);
    const sx = Math.max(0, (img.naturalWidth - side) / 2);
    const sy = img.naturalHeight * 0.045;
    g.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  }
  g.restore();

  // 缩放过程中档位会不断变化，缓存控制在可控范围内
  if (SPRITE_CACHE.size > 900) SPRITE_CACHE.clear();
  SPRITE_CACHE.set(key, canvas);
  return canvas;
}

function lodOf(scale: number): 0 | 1 | 2 {
  if (scale < 0.7) return 0;
  if (scale < 1.6) return 1;
  return 2;
}

export function HistoryGraphCanvas({
  nodes,
  edges,
  graph,
  layout,
  layoutMode,
  year,
  selectedId,
  egoNodeIds,
  egoEdgeIds,
  pathNodeIds = null,
  relationFilter,
  onSelectPerson,
  onSelectEdge,
  onClearSelection,
  focusRequest,
  fitToken,
  rightInset = 0,
  onScaleChange,
}: HistoryGraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const { isDark } = useTheme();
  const [hoverId, setHoverId] = useState<string | null>(null);

  const camera = useRef({ scale: 1, tx: 0, ty: 0 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const dirtyRef = useRef(true);
  /** 标签排布缓存：见 draw() 内的说明 */
  const placementCacheRef = useRef<
    { key: string; layout: LayoutResult; placements: Map<string, Placement> } | null
  >(null);
  const introRef = useRef(performance.now());
  /**
   * 入场动画是否已经「画到位」。
   *
   * 不能用墙钟判断（`now - introRef < 1000`）：浏览器会把 requestAnimationFrame
   * 节流到 0 Hz——切到后台标签、窗口被遮挡、无头截图都会。一旦这一秒里没有帧，
   * 等下一帧到来时墙钟条件早已不成立，而 dirty 又是 false，于是**再也不会重绘**，
   * 画布就永久停在入场动画的第一帧上（节点因 appear<=0 全被跳过，看着是空的）。
   * 改为由绘制自己置位：只要还没画到 intro>=1，循环就一直要求重绘。
   */
  const introDoneRef = useRef(false);
  const draggingRef = useRef<{ active: boolean; moved: boolean; x: number; y: number } | null>(null);
  /** 相机补间：聚焦/复位时用缓动代替瞬移，避免一帧之内天地翻覆 */
  const tweenRef = useRef<{
    from: { scale: number; tx: number; ty: number };
    to: { scale: number; tx: number; ty: number };
    t0: number;
    dur: number;
  } | null>(null);

  /* 最新 props 快照：供 rAF 循环读取，避免闭包过期 */
  const latest = useRef({
    nodes,
    edges,
    graph,
    layout,
    layoutMode,
    year,
    selectedId,
    egoNodeIds,
    egoEdgeIds,
    pathNodeIds,
    relationFilter,
    isDark,
    hoverId,
    rightInset,
  });
  latest.current = {
    nodes,
    edges,
    graph,
    layout,
    layoutMode,
    year,
    selectedId,
    egoNodeIds,
    egoEdgeIds,
    pathNodeIds,
    relationFilter,
    isDark,
    hoverId,
    rightInset,
  };

  const nodeIndex = useMemo(() => {
    const map = new Map<string, HistoricalPersonNode>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const fitView = useCallback(() => {
    const { w, h } = sizeRef.current;
    // 首帧尺寸尚未测得时不要适配：否则会以 0 宽高算出 0.3 的兜底缩放，
    // 把整张图挤到左上角，且此后再无人纠正。
    if (w < 40 || h < 40) return;
    const { bounds } = latest.current.layout;
    const spanX = Math.max(200, bounds.maxX - bounds.minX);
    const spanY = Math.max(200, bounds.maxY - bounds.minY);
    // 左下角的布局/图例栏是常驻的，把这块宽度从可用视口里扣掉，
    // 否则秦汉一簇会整块躲在面板背后。
    const insetLeft = w > 980 ? 196 : 0;
    const insetRight = latest.current.rightInset ?? 0;
    const availW = Math.max(240, w - insetLeft - insetRight - 88);
    const scale = Math.min(Math.max(0.24, availW / spanX), Math.max(0.24, (h - 150) / spanY), 1.25);
    camera.current = {
      scale,
      tx: insetLeft + (w - insetLeft - insetRight) / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
      ty: h / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
    };
    dirtyRef.current = true;
  }, []);

  /* ---------------------------- 尺寸与自适应 ---------------------------- */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      const prev = sizeRef.current;
      sizeRef.current = { w: rect.width, h: rect.height };
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
      // 首次拿到真实尺寸，或尺寸变化超过 15%（如抽屉展开挤占画布）时重新适配
      const firstSized = prev.w === 0 || prev.h === 0;
      const changedALot =
        Math.abs(rect.width - prev.w) / Math.max(1, prev.w) > 0.15 ||
        Math.abs(rect.height - prev.h) / Math.max(1, prev.h) > 0.15;
      if (firstSized || changedALot) fitView();
      dirtyRef.current = true;
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [fitView]);

  /* 布局变化 / 数据变化时重新适配 */
  useEffect(() => {
    fitView();
    introRef.current = performance.now();
    introDoneRef.current = false;
    // 动画重跑，就绪标记随之作废（截图脚本要靠它判断下一轮何时画完）
    canvasRef.current?.removeAttribute('data-intro');
  }, [layout, layoutMode, fitView]);

  useEffect(() => {
    if (fitToken > 0) fitView();
  }, [fitToken, fitView]);

  useEffect(() => {
    dirtyRef.current = true;
  }, [nodes, edges, year, selectedId, egoNodeIds, egoEdgeIds, pathNodeIds, relationFilter, isDark, hoverId]);

  /**
   * 画像陆续解码完成时重绘。
   *
   * 少了这一条，先画出去的那一帧里没赶上加载的节点就永远是空圆环：
   * 主循环在入场动画结束后靠 dirty 驱动，而图片 onload 不碰 dirty，
   * 于是要等用户随便动一下鼠标（悬浮/拖拽/滚轮）才补上图——「首屏几个白圆圈」
   * 就是这么来的。首屏 785 人里同时有几十张图在解码，撞上很正常。
   */
  useEffect(() => onPortraitLoaded(() => {
    dirtyRef.current = true;
  }), []);

  const animateCamera = useCallback((to: { scale: number; tx: number; ty: number }, dur = 520) => {
    tweenRef.current = { from: { ...camera.current }, to, t0: performance.now(), dur };
    dirtyRef.current = true;
  }, []);

  /* 聚焦某人：平滑缩放并以该人为剩余可视区域的中心 */
  useEffect(() => {
    if (!focusRequest) return;
    const pos = latest.current.layout.positions.get(focusRequest.id);
    if (!pos) return;
    const { w, h } = sizeRef.current;
    if (w < 40 || h < 40) return;
    // 只放大到「够看清此人近邻」的程度；已经放得更大就不再拉远
    const scale = Math.max(1.35, Math.min(2.4, camera.current.scale));
    const usableW = Math.max(240, w - latest.current.rightInset);
    animateCamera({ scale, tx: usableW / 2 - pos.x * scale, ty: h / 2 - pos.y * scale });
  }, [focusRequest, animateCamera]);

  /* ------------------------------- 绘制 -------------------------------- */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const s = latest.current;
    const { scale, tx, ty } = camera.current;
    const lod = lodOf(scale);
    const minWeight = LOD_WEIGHT[lod];
    const intro = Math.min(1, (performance.now() - introRef.current) / 720);

    const project = (x: number, y: number): [number, number] => [x * scale + tx, y * scale + ty];

    /* 泳道底纹 */
    if (s.layoutMode === 'swimlane' && s.layout.lanes.length) {
      for (const lane of s.layout.lanes) {
        const [, y1] = project(0, lane.y - lane.height / 2);
        const [, y2] = project(0, lane.y + lane.height / 2);
        ctx.fillStyle = s.isDark ? 'rgba(255,255,255,0.018)' : 'rgba(90,70,40,0.035)';
        ctx.fillRect(0, y1, w, y2 - y1);
        ctx.strokeStyle = s.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(90,70,40,0.09)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y1);
        ctx.lineTo(w, y1);
        ctx.stroke();
        ctx.font = '600 11px "Noto Serif SC", serif';
        ctx.fillStyle = s.isDark ? 'rgba(230,225,210,0.34)' : 'rgba(80,64,40,0.42)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(lane.label, 14, (y1 + y2) / 2);
      }
    }

    /* 可见节点集合 */
    const visible = new Map<string, { x: number; y: number; r: number; weight: number }>();
    for (const node of s.nodes) {
      if (node.importanceWeight < minWeight) continue;
      if (s.year !== null && !isPersonAliveAt(node, s.year, { softWindow: 0 })) continue;
      const pos = s.layout.positions.get(node.id);
      if (!pos) continue;
      const [sx, sy] = project(pos.x, pos.y);
      if (sx < -140 || sx > w + 140 || sy < -140 || sy > h + 140) continue;
      const r = (7 + (node.importanceWeight / 100) * 15) * Math.max(0.42, Math.min(scale, 1.35));
      visible.set(node.id, { x: sx, y: sy, r, weight: node.importanceWeight });
    }

    /**
     * 过绘保护：一屏塞进四五百人时，给每个人画头像纯属浪费算力——
     * 那个密度下五官比米粒还小，画了也认不出。此时只给权重 60 以上者保留头像，
     * 其余用朝色平涂；并省掉帝王光晕（每帧几十个径向渐变，代价不低）。
     */
    const denseView = visible.size > 380;

    /**
     * 标签排布：按历史中心度从高到低逐个占位，每个标签依次试
     * 下方 → 上方 → 右侧 → 左侧，取第一个既不压已占矩形、也不压他人头像的位置。
     * 若只试「正下方」并在冲突时一律放弃，密集处会把曹操、荀彧这类主角的名字
     * 整片抹掉——那比文字重叠更糟。四向试位之后，绝大多数人都能保住名字。
     */
    const nameSize = lod === 0 ? 10.5 : lod === 1 ? 12 : 13.5;
    const nameFont = `600 ${nameSize}px "Noto Serif SC", "Songti SC", serif`;
    const secondFont = '400 9.5px "Noto Sans SC", sans-serif';
    const secondSize = 9.5;
    const LABEL_PAD = 2;
    const LABEL_GAP = 5;

    const secondLineOf = (node: HistoricalPersonNode): string => {
      if (lod === 0) return '';
      if (lod === 1) return primaryTitleOf(node);
      return [
        primaryTitleOf(node),
        node.aliases.courtesyName ? `字${node.aliases.courtesyName}` : '',
        `${formatYear(node.birthYear)}–${formatYear(node.deathYear)}`,
      ]
        .filter(Boolean)
        .join(' · ');
    };

    /**
     * 碰撞检测走均匀网格。
     * 直接两两比对是 O(可见节点数² × 候选位)——六百人时每帧上千万次距离计算，
     * 帧率会从 60 掉到个位数。网格之后每次只看邻近几格里的十几个对象。
     */
    const computePlacements = (): Map<string, Placement> => {
    const CELL = 56;
    const cellOf = (x: number, y: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
    const boxGrid = new Map<string, Rect[]>();
    const circleGrid = new Map<string, { x: number; y: number; r: number }[]>();

    for (const [, geo] of visible) {
      const c0 = cellOf(geo.x - geo.r, geo.y - geo.r);
      const c1 = cellOf(geo.x + geo.r, geo.y + geo.r);
      const [cx0, cy0] = c0.split(',').map(Number);
      const [cx1, cy1] = c1.split(',').map(Number);
      for (let cx = cx0; cx <= cx1; cx += 1) {
        for (let cy = cy0; cy <= cy1; cy += 1) {
          const key = `${cx},${cy}`;
          const bucket = circleGrid.get(key) ?? [];
          bucket.push(geo);
          circleGrid.set(key, bucket);
        }
      }
    }

    const cellsOf = (box: Rect): string[] => {
      const keys: string[] = [];
      const [cx0, cy0] = cellOf(box.x1, box.y1).split(',').map(Number);
      const [cx1, cy1] = cellOf(box.x2, box.y2).split(',').map(Number);
      for (let cx = cx0; cx <= cx1; cx += 1) {
        for (let cy = cy0; cy <= cy1; cy += 1) keys.push(`${cx},${cy}`);
      }
      return keys;
    };

    const placements = new Map<string, Placement>();
    const ordered = [...visible.entries()].sort((a, b) => b[1].weight - a[1].weight);
    const nodeById = new Map(s.nodes.map((node) => [node.id, node]));

    for (const [id, geo] of ordered) {
      const node = nodeById.get(id);
      if (!node) continue;
      /** 悬停与选中者必须有标签，哪怕压住旁人 */
      const force = id === s.hoverId || id === s.selectedId;
      // 过绘时把标名门槛抬到 55：这个密度下每个人的名字都标出来只会挤成墨迹，
      // 不如保证权重高的人物清晰可读，其余靠悬停查看。
      if (!force && denseView && node.importanceWeight < 55) continue;

      const nameW = measureCached(ctx, node.name, nameFont);
      const second = secondLineOf(node);
      let secondW = 0;
      if (second) {
        secondW = measureCached(ctx, second, secondFont);
      }
      const blockW = Math.max(nameW, secondW) + LABEL_PAD * 2;
      const blockH = nameSize + (second ? secondSize + 3 : 0) + LABEL_PAD * 2;

      /**
       * 候选位：上下左右各两个距离（贴边 + 外扩），共 8 个。
       * 中心人物往往被七八个近邻围死，只给四个贴边位的话，
       * 越是核心人物越容易被挤掉名字——这恰恰是最不能丢的那几个。
       */
      const buildVariants = (gap: number): { box: Rect; align: CanvasTextAlign }[] => {
        const list: { box: Rect; align: CanvasTextAlign }[] = [
          { box: { x1: geo.x - blockW / 2, y1: geo.y + geo.r + gap, x2: geo.x + blockW / 2, y2: 0 }, align: 'center' },
          { box: { x1: geo.x - blockW / 2, y1: 0, x2: geo.x + blockW / 2, y2: 0 }, align: 'center' },
          { box: { x1: geo.x + geo.r + gap, y1: geo.y - blockH / 2, x2: 0, y2: 0 }, align: 'left' },
          { box: { x1: 0, y1: geo.y - blockH / 2, x2: geo.x - geo.r - gap, y2: 0 }, align: 'right' },
        ];
        list[0].box.y2 = list[0].box.y1 + blockH;
        list[1].box.y2 = geo.y - geo.r - gap;
        list[1].box.y1 = list[1].box.y2 - blockH;
        list[2].box.x2 = list[2].box.x1 + blockW;
        list[2].box.y2 = list[2].box.y1 + blockH;
        list[3].box.x1 = list[3].box.x2 - blockW;
        list[3].box.y2 = list[3].box.y1 + blockH;
        return list;
      };

      const variants = [...buildVariants(LABEL_GAP), ...buildVariants(LABEL_GAP + geo.r * 2 + blockH * 0.5)];

      const fits = (box: Rect): boolean => {
        const keys = cellsOf(box);
        for (const key of keys) {
          const occupied = boxGrid.get(key);
          if (occupied) {
            for (const b of occupied) {
              if (!(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2)) return false;
            }
          }
        }
        // 不许压住任何人的头像：文字横穿邻人面孔，两个人都认不出来
        const seen = new Set<{ x: number; y: number; r: number }>();
        for (const key of keys) {
          const bucket = circleGrid.get(key);
          if (!bucket) continue;
          for (const other of bucket) {
            if (other === geo || seen.has(other)) continue;
            seen.add(other);
            const nx = Math.max(box.x1, Math.min(other.x, box.x2));
            const ny = Math.max(box.y1, Math.min(other.y, box.y2));
            if (Math.hypot(other.x - nx, other.y - ny) < other.r + 1.5) return false;
          }
        }
        return true;
      };

      let chosen: { box: Rect; align: CanvasTextAlign } | undefined = force
        ? variants[0]
        : variants.find((v) => fits(v.box));
      // 最后的兜底：权重 ≥ 82 的帝王级人物宁可轻微压边，也不能在图上无名
      if (!chosen && node.importanceWeight >= 82) chosen = variants[0];
      if (!chosen) continue;

      const { box, align } = chosen;
      const nameX =
        align === 'left' ? box.x1 + LABEL_PAD : align === 'right' ? box.x2 - LABEL_PAD : (box.x1 + box.x2) / 2;
      const nameY = box.y1 + LABEL_PAD;
      placements.set(id, {
        box,
        align,
        nameX,
        nameY,
        titleX: nameX,
        titleY: nameY + nameSize + 2,
        second,
      });
      for (const key of cellsOf(box)) {
        const bucket = boxGrid.get(key) ?? [];
        bucket.push(box);
        boxGrid.set(key, bucket);
      }
    }

    return placements;
  };

  /**
   * 排布结果按「相机 + LOD + 悬停/选中 + 布局」缓存。
   * 定格之后（如寻路流光动画、呼吸环动画）每帧重绘时，这张表完全不变，
   * 却在每帧重算一遍——那是纯浪费。镜头一动立刻失效重算。
   */
  const placementKey = `${scale.toFixed(3)}|${tx.toFixed(1)}|${ty.toFixed(1)}|${w}x${h}|${lod}|${s.hoverId ?? ''}|${s.selectedId ?? ''}|${s.year ?? ''}`;
  const memo = placementCacheRef.current;
  const placements =
    memo && memo.key === placementKey && memo.layout === s.layout
      ? memo.placements
      : computePlacements();
  if (placements !== memo?.placements) {
    placementCacheRef.current = { key: placementKey, layout: s.layout, placements };
  }


    /* ------------------------------ 关系边 ------------------------------ */
    ctx.lineCap = 'round';
    // 虚线与实线状态交替时反复 setLineDash，每次都是一次状态切换；
    // 记下当前值，只在真的变化时才下发——上千条边时这一项是白捡的。
    const DASH: number[] = [5, 4];
    let dashOn = false;

    for (const edge of s.edges) {
      if (!s.relationFilter.has(edge.primaryCategory)) continue;
      const a = visible.get(edge.source);
      const b = visible.get(edge.target);
      if (!a || !b) continue;

      // 宏观层只留主干：弱关系（strength < 5）在缩到 0.7 以下时本就是一团虚影，
      // 画出来既看不清又拖慢帧率，不如留给中观层展开。
      if (lod === 0 && edge.strength < 5) continue;

      const category = s.year !== null ? edgeCategoryAt(edge, s.year) : edge.primaryCategory;
      const meta = RELATION_META[category];
      const color = s.isDark ? meta.darkColor : meta.color;

      let alpha = 0.5;
      if (s.egoEdgeIds && !s.egoEdgeIds.has(edge.id)) alpha = 0.05;
      const touching = s.hoverId === edge.source || s.hoverId === edge.target;
      if (touching) alpha = 0.95;
      if (s.selectedId && (s.selectedId === edge.source || s.selectedId === edge.target)) {
        alpha = Math.max(alpha, 0.82);
      }

      const width = Math.max(0.75, (0.7 + edge.strength * 0.16) * Math.min(1.5, Math.max(0.6, scale)));
      ctx.globalAlpha = alpha * intro;

      const [x1, y1] = [a.x, a.y];
      const [x2, y2] = [b.x, b.y];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;

      // 端点回收，避免箭头被节点圆覆盖
      const sx1 = x1 + ux * (a.r * 0.92 + 1);
      const sy1 = y1 + uy * (a.r * 0.92 + 1);
      const sx2 = x2 - ux * (b.r * 0.92 + 3);
      const sy2 = y2 - uy * (b.r * 0.92 + 3);

      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (meta.dashed !== dashOn) {
        ctx.setLineDash(meta.dashed ? DASH : []);
        dashOn = meta.dashed;
      }

      if (meta.double) {
        const nx = -uy * 2.1;
        const ny = ux * 2.1;
        ctx.beginPath();
        ctx.moveTo(sx1 + nx, sy1 + ny);
        ctx.lineTo(sx2 + nx, sy2 + ny);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx1 - nx, sy1 - ny);
        ctx.lineTo(sx2 - nx, sy2 - ny);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
      }
      if (dashOn) {
        ctx.setLineDash([]);
        dashOn = false;
      }

      if (edge.directed) {
        const head = 5.5 + Math.min(4, scale);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(sx2, sy2);
        ctx.lineTo(sx2 - ux * head - uy * head * 0.48, sy2 - uy * head + ux * head * 0.48);
        ctx.lineTo(sx2 - ux * head + uy * head * 0.48, sy2 - uy * head - ux * head * 0.48);
        ctx.closePath();
        ctx.fill();
      }

      /* 高倍率下的关系胶囊：微观层每条边都要标出「三顾茅庐」这样的定语 */
      const screenLen = Math.abs(sx2 - sx1) + Math.abs(sy2 - sy1);
      if (lod === 2 && (screenLen > 46 || touching)) {
        const mx = (sx1 + sx2) / 2;
        const my = (sy1 + sy2) / 2;
        const label = edge.specificLabel;
        ctx.font = '500 10px "Noto Sans SC", sans-serif';
        const tw = ctx.measureText(label).width;
        const pw = tw + 12;
        const ph = 16;
        ctx.globalAlpha = Math.min(1, alpha + 0.2) * intro;
        ctx.fillStyle = s.isDark ? 'rgba(26,29,36,0.94)' : 'rgba(252,251,247,0.95)';
        ctx.strokeStyle = `${color}77`;
        ctx.lineWidth = 1;
        const rx = mx - pw / 2;
        const ry = my - ph / 2;
        const radius = 7;
        ctx.beginPath();
        ctx.moveTo(rx + radius, ry);
        ctx.arcTo(rx + pw, ry, rx + pw, ry + ph, radius);
        ctx.arcTo(rx + pw, ry + ph, rx, ry + ph, radius);
        ctx.arcTo(rx, ry + ph, rx, ry, radius);
        ctx.arcTo(rx, ry, rx + pw, ry, radius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, mx, my + 0.5);
      }
    }

    /* --------------------------- 寻路流光高亮 --------------------------- */
    if (s.pathNodeIds && s.pathNodeIds.length > 1) {
      const pathSet = new Set(s.pathNodeIds);
      const phase = (performance.now() / 22) % 26;
      for (const edge of s.edges) {
        if (!pathSet.has(edge.source) || !pathSet.has(edge.target)) continue;
        const a = visible.get(edge.source);
        const b = visible.get(edge.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        ctx.setLineDash([9, 17]);
        ctx.lineDashOffset = -phase;
        ctx.globalAlpha = 0.92;
        ctx.strokeStyle = s.isDark ? 'rgb(214,175,74)' : 'rgb(197,155,39)';
        ctx.lineWidth = Math.max(2.4, 2.6 * Math.min(1.4, scale));
        ctx.beginPath();
        ctx.moveTo(a.x + ux * (a.r * 0.92 + 1), a.y + uy * (a.r * 0.92 + 1));
        ctx.lineTo(b.x - ux * (b.r * 0.92 + 1), b.y - uy * (b.r * 0.92 + 1));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }
    }

    /* ------------------------------- 节点 ------------------------------- */
    for (const node of s.nodes) {
      const geo = visible.get(node.id);
      if (!geo) continue;

      const dimmed = s.egoNodeIds ? !s.egoNodeIds.has(node.id) : false;
      const alpha = dimmed ? 0.12 : 1;
      const isSelected = s.selectedId === node.id;
      const isHover = s.hoverId === node.id;
      const isEgoCenter = s.egoNodeIds ? s.egoNodeIds.has(node.id) && !dimmed : false;
      const ringColor = dynastyColor(node.dynasty);
      const r = geo.r;

      const appearDelay = (node.importanceWeight / 100) * 260;
      const appear = Math.min(1, Math.max(0, ((performance.now() - introRef.current) - appearDelay) / 380));
      if (appear <= 0) continue;

      ctx.globalAlpha = alpha * appear;

      /* 朝代光环（过绘时省去） */
      if (!denseView && node.roles.some((role) => role.includes('皇帝'))) {
        const glow = ctx.createRadialGradient(geo.x, geo.y, r * 0.6, geo.x, geo.y, r * 2.5);
        glow.addColorStop(0, `${ringColor}44`);
        glow.addColorStop(1, `${ringColor}00`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(geo.x, geo.y, r * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      /* 底色圆 */
      ctx.beginPath();
      ctx.arc(geo.x, geo.y, r, 0, Math.PI * 2);
      ctx.fillStyle = s.isDark ? 'rgba(20,23,29,0.96)' : 'rgba(252,251,247,0.98)';
      ctx.fill();

      /* 头像（中倍率以上）：走离屏位图缓存，不做逐帧裁圆 */
      if (lod >= 1 && (!denseView || node.importanceWeight >= 70)) {
        const img = getPortraitImage(node);
        if (img && img.complete && img.naturalWidth > 0) {
          const sprite = portraitSprite(node.id, img, r, dpr);
          if (sprite) {
            ctx.drawImage(sprite, geo.x - r * 0.9, geo.y - r * 0.9, r * 1.8, r * 1.8);
          }
        }
      }

      /* 边框：双层 / 单层 */
      ctx.beginPath();
      ctx.arc(geo.x, geo.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = lod === 2 ? 2 : 1.4;
      ctx.stroke();

      if (lod === 2) {
        ctx.beginPath();
        ctx.arc(geo.x, geo.y, r + 3.2, 0, Math.PI * 2);
        ctx.strokeStyle = `${ringColor}55`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      /* 寻路链路：朱砂呼吸环 */
      if (s.pathNodeIds && s.pathNodeIds.includes(node.id)) {
        const pulse = 1 + Math.sin(performance.now() / 320 + geo.x * 0.01) * 0.18;
        ctx.beginPath();
        ctx.arc(geo.x, geo.y, (r + 6) * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgb(197,155,39)';
        ctx.globalAlpha = alpha * 0.55;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.globalAlpha = alpha * appear;
      }

      /* 选中 / 悬停 / Ego 中心 */
      if (isSelected || isHover || isEgoCenter) {
        ctx.beginPath();
        ctx.arc(geo.x, geo.y, r + (isSelected ? 6.5 : 5), 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? 'rgb(200,62,49)' : 'rgb(197,155,39)';
        ctx.globalAlpha = alpha * (isSelected ? 0.95 : 0.7);
        ctx.lineWidth = isSelected ? 2.2 : 1.6;
        ctx.stroke();
        ctx.globalAlpha = alpha * appear;
      }

      /* 姓名与次行（位置已在排布阶段定好） */
      const place = placements.get(node.id);
      if (!place) continue;
      ctx.textAlign = place.align;
      ctx.textBaseline = 'top';

      if (lod >= 1) {
        ctx.fillStyle = s.isDark ? 'rgba(17,19,24,0.62)' : 'rgba(252,251,247,0.72)';
        ctx.fillRect(
          place.box.x1,
          place.box.y1,
          place.box.x2 - place.box.x1,
          place.box.y2 - place.box.y1,
        );
      }

      ctx.font = nameFont;
      ctx.fillStyle = s.isDark ? 'rgba(238,232,218,0.95)' : 'rgba(28,26,22,0.94)';
      ctx.fillText(node.name, place.nameX, place.nameY);

      if (place.second) {
        ctx.font = secondFont;
        ctx.fillStyle = s.isDark ? 'rgba(200,193,178,0.62)' : 'rgba(90,80,64,0.64)';
        ctx.fillText(place.second, place.titleX, place.titleY);
      }
    }

    ctx.globalAlpha = 1;
    onScaleChange?.({ scale, lod, visibleNodes: visible.size });
    // 入场走完才允许主循环「闲下来」。data-intro 供截图脚本等待，
    // 免得靠 sleep 猜——猜早了就会拍到 appear 尚未到位的空画布。
    if (intro >= 1 && !introDoneRef.current) {
      introDoneRef.current = true;
      canvas.dataset.intro = 'done';
    }
  }, [onScaleChange]);

  /* 外部缩放指令（工具栏按钮通过自定义事件下发，保持相机单一真源） */
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      const factor = typeof detail === 'number' ? detail : 1.2;
      const { w, h } = sizeRef.current;
      const cam = camera.current;
      const next = Math.max(0.24, Math.min(3.6, cam.scale * factor));
      const worldX = (w / 2 - cam.tx) / cam.scale;
      const worldY = (h / 2 - cam.ty) / cam.scale;
      camera.current = { scale: next, tx: w / 2 - worldX * next, ty: h / 2 - worldY * next };
      dirtyRef.current = true;
    };
    window.addEventListener('chronograph:zoom', handler as EventListener);
    return () => window.removeEventListener('chronograph:zoom', handler as EventListener);
  }, []);

  /* ------------------------------- 主循环 ------------------------------ */
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      const tween = tweenRef.current;
      if (tween) {
        const t = Math.min(1, (now - tween.t0) / tween.dur);
        // easeOutCubic：起手快、收尾稳，像镜头被手扶住慢慢停下
        const e = 1 - Math.pow(1 - t, 3);
        camera.current = {
          scale: tween.from.scale + (tween.to.scale - tween.from.scale) * e,
          tx: tween.from.tx + (tween.to.tx - tween.from.tx) * e,
          ty: tween.from.ty + (tween.to.ty - tween.from.ty) * e,
        };
        if (t >= 1) tweenRef.current = null;
        dirtyRef.current = true;
      }
      const animating = (latest.current.pathNodeIds?.length ?? 0) > 1;
      // 入场没画完就一直重绘：帧被节流多久都不怕，下一帧一来就直接跳到终态
      if (dirtyRef.current || animating || !introDoneRef.current) {
        dirtyRef.current = false;
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  /* ------------------------------- 交互 -------------------------------- */
  const hitTest = useCallback(
    (sx: number, sy: number): string | null => {
      const { scale, tx, ty } = camera.current;
      const s = latest.current;
      const lod = lodOf(scale);
      const minWeight = LOD_WEIGHT[lod];
      let best: { id: string; dist: number } | null = null;
      for (const node of s.nodes) {
        if (node.importanceWeight < minWeight) continue;
        if (s.year !== null && !isPersonAliveAt(node, s.year, { softWindow: 0 })) continue;
        const pos = s.layout.positions.get(node.id);
        if (!pos) continue;
        const x = pos.x * scale + tx;
        const y = pos.y * scale + ty;
        const r = (7 + (node.importanceWeight / 100) * 15) * Math.max(0.42, Math.min(scale, 1.35)) + 5;
        const dist = Math.hypot(x - sx, y - sy);
        if (dist <= r && (!best || dist < best.dist)) best = { id: node.id, dist };
      }
      return best?.id ?? null;
    },
    [],
  );

  const hitEdge = useCallback((sx: number, sy: number): HistoricalRelationEdge | null => {
    const { scale, tx, ty } = camera.current;
    const s = latest.current;
    const lod = lodOf(scale);
    const minWeight = LOD_WEIGHT[lod];
    let best: { edge: HistoricalRelationEdge; dist: number } | null = null;

    for (const edge of s.edges) {
      if (!s.relationFilter.has(edge.primaryCategory)) continue;
      const pa = s.layout.positions.get(edge.source);
      const pb = s.layout.positions.get(edge.target);
      if (!pa || !pb) continue;
      const na = s.nodes.find((n) => n.id === edge.source);
      const nb = s.nodes.find((n) => n.id === edge.target);
      if (!na || !nb) continue;
      if (na.importanceWeight < minWeight || nb.importanceWeight < minWeight) continue;

      const x1 = pa.x * scale + tx;
      const y1 = pa.y * scale + ty;
      const x2 = pb.x * scale + tx;
      const y2 = pb.y * scale + ty;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((sx - x1) * dx + (sy - y1) * dy) / len2));
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const dist = Math.hypot(sx - px, sy - py);
      if (dist <= 6 && (!best || dist < best.dist)) best = { edge, dist };
    }
    return best?.edge ?? null;
  }, []);

  const onWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    tweenRef.current = null;
    const rect = event.currentTarget.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const cam = camera.current;
    const factor = Math.exp(-event.deltaY * 0.0016);
    const next = Math.max(0.24, Math.min(3.6, cam.scale * factor));
    const worldX = (mx - cam.tx) / cam.scale;
    const worldY = (my - cam.ty) / cam.scale;
    camera.current = { scale: next, tx: mx - worldX * next, ty: my - worldY * next };
    dirtyRef.current = true;
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    draggingRef.current = { active: true, moved: false, x: mx, y: my };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;

      if (tooltipRef.current) {
        tooltipRef.current.style.transform = `translate(${Math.round(mx + 16)}px, ${Math.round(my + 14)}px)`;
      }

      const drag = draggingRef.current;
      if (drag?.active) {
        const dx = mx - drag.x;
        const dy = my - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (drag.moved) {
          camera.current = {
            ...camera.current,
            tx: camera.current.tx + dx,
            ty: camera.current.ty + dy,
          };
          drag.x = mx;
          drag.y = my;
          dirtyRef.current = true;
          if (hoverId) setHoverId(null);
          return;
        }
      }

      const id = hitTest(mx, my);
      if (id !== hoverId) {
        setHoverId(id);
        dirtyRef.current = true;
      }
    },
    [hitTest, hoverId],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const drag = draggingRef.current;
      draggingRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);

      if (drag?.moved) return;

      const id = hitTest(mx, my);
      if (id) {
        onSelectPerson(id);
        return;
      }
      const edge = hitEdge(mx, my);
      if (edge) {
        onSelectEdge(edge);
        return;
      }
      onClearSelection();
    },
    [hitTest, hitEdge, onSelectPerson, onSelectEdge, onClearSelection],
  );

  const hoverPerson = hoverId ? nodeIndex.get(hoverId) ?? null : null;

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          draggingRef.current = null;
          if (hoverId) setHoverId(null);
        }}
      />

      {/* 悬停浮卡 */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute left-0 top-0 z-20 max-w-[280px] will-change-transform"
        aria-hidden={!hoverPerson}
      >
        {hoverPerson ? (
          <div className="panel animate-ink-in px-3 py-2">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-[14px] font-semibold text-ink">{hoverPerson.name}</span>
              {hoverPerson.aliases.courtesyName ? (
                <span className="text-[10.5px] text-ink-3">字 {hoverPerson.aliases.courtesyName}</span>
              ) : null}
              <span className="ml-auto text-[10px] text-ink-3">
                {formatYear(hoverPerson.birthYear)}–{formatYear(hoverPerson.deathYear)}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">{hoverPerson.oneLineSummary}</p>
            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-3">
              <span>中心度 {hoverPerson.importanceWeight}</span>
              <span>·</span>
              <span>{hoverPerson.roles.slice(0, 2).join('／')}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
