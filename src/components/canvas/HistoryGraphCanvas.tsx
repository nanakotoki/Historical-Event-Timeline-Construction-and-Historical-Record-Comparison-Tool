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
import { eraOf } from '@/lib/graph-layout';
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

/**
 * 时代分块的世界坐标矩形，按布局对象缓存。
 * ------------------------------------------------------------------
 * 命名标签要「留在自己这一代的地界里」，就得先知道每个人属于哪一块。
 * 块表是随布局一起算好的常量，但画布每帧都会重算一遍可见节点——把矩形
 * 换算放进逐帧循环，一千多人各扫十个块，白烧一百万次比较。
 * 布局对象换掉（切分片、换布局模式）时才重建，之后只做四次乘法。
 */
const BLOCK_RECT_CACHE = new WeakMap<LayoutResult, Rect[]>();

function blockWorldRects(layout: LayoutResult): Rect[] {
  const cached = BLOCK_RECT_CACHE.get(layout);
  if (cached) return cached;
  const rects = layout.blocks.map((b) => ({
    x1: b.x - b.w / 2,
    y1: b.y - b.h / 2,
    x2: b.x + b.w / 2,
    y2: b.y + b.h / 2,
  }));
  BLOCK_RECT_CACHE.set(layout, rects);
  return rects;
}

/**
 * 落字余量：允许标签压出块边两像素。
 * 一点不让会把贴边的名字整片抹掉，让太多又会出现「唐的名字写在宋的地上」。
 * 两像素在 1× 下就是一个描边的宽度，肉眼看不出来，却救回不少边缘人物。
 */
const LABEL_EDGE_SLACK = 2;

/** 把矩形沿最短位移夹回可用区（用于悬停、选中这类「必须有名字」的兜底） */
function clampInto(box: Rect, area: Rect): Rect {
  const w = box.x2 - box.x1;
  const h = box.y2 - box.y1;
  let x1 = box.x1;
  let y1 = box.y1;
  if (x1 + w > area.x2) x1 = area.x2 - w;
  if (x1 < area.x1) x1 = area.x1;
  if (y1 + h > area.y2) y1 = area.y2 - h;
  if (y1 < area.y1) y1 = area.y1;
  return { x1, y1, x2: x1 + w, y2: y1 + h };
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
 * 三档 LOD 的最低可视权重。
 * ------------------------------------------------------------------
 * 原为 [75, 40, 0]：远景只留帝王权臣。实测下来这条规则做了两件错事——
 * ① 全景少画了六百多人（界面写着「可见 466/1136」），用户看到的是半张图；
 * ② 被裁掉的人本该是「哪一片人多、哪一片人少」的唯一线索，裁完各代人看着一样多。
 *
 * 裁人的初衷是「别糊成一团」，但糊的根因是布局压成横条（见 graph-layout 的
 * 时代分块注释），不是人多。布局修好后全景人均约 620 平方像素，画成三五个
 * 像素的实心细点绰绰有余，没有理由再删人。故三档一律 0 门槛，
 * 密度交给 draw() 里的「概览细点 / 中观头像」分级去控。
 */
const LOD_WEIGHT: [number, number, number] = [0, 0, 0];

/**
 * 权重裁剪的兜底门槛。
 * 阈值已归零，保留这个开关是给将来的超大分片（万人级）留的：人数超过
 * LOD_CULL_MIN_COUNT 才按权重裁剪，低于此数一律全画。
 */
export const LOD_CULL_MIN_COUNT = 240;

function lodMinWeight(lod: 0 | 1 | 2, nodeCount: number): number {
  return nodeCount < LOD_CULL_MIN_COUNT ? 0 : LOD_WEIGHT[lod];
}

/**
 * 缩放区间。
 * ------------------------------------------------------------------
 * 上限原为 3.6×，是按「整库全景够用」估的，实测不够：九百人的力导向图铺开后，
 * 相邻两人在世界坐标里只隔二三十个单位，3.6× 时屏幕上也就百来像素——
 * 两个人像仍挤在一起、标签互相让位，滚轮滚到底也认不出想看的那一个人。
 *
 * 放到 12× 之后，单人可占屏数百像素，配合下面的半径与字号生长曲线，
 * 「凑近看清是谁」这件事才成立。下限 0.25 不动：再缩下去整库只是一团墨。
 */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 12;

/**
 * 节点半径随缩放的生长曲线。
 * ------------------------------------------------------------------
 * 半径由「底半径 × 生长曲线」两段乘起来。底半径按权重铺开（5.2 ~ 14.7px），
 * 生长曲线是一条平滑的幂函数，两端各自封顶：
 *
 *   0.69×（全库适配）r ≈ 3.7 ~ 10.5px —— 概览档尘点固定 1.9px，地标 ×1.45；
 *   1.0×             r ≈ 5.2 ~ 14.7px；
 *   2.0×             r ≈ 9.1 ~ 25.8px —— 头像开始分得出眉眼；
 *   12×              r ≈ 22 ~ 62px —— 幂函数封顶在 4.2 倍，再大就只剩一个圆。
 *
 * 指数从 0.62 提到 0.72、封顶从 3.4 提到 4.2，是因为「放大之后仍认不出人」：
 * 人物画像多是全身立轴，脸只占圆圈的三分之一，半径不到二十像素时五官就是糊的。
 * 底半径的极差同时收窄（原来 4.6~13 差 2.8 倍，权重低的几乎是个点），
 * 免得次要人物在中观层缩成尘点、与概览层分不出来。
 *
 * 判定半径的地方（绘制、命中测试）必须共用这一个函数：
 * 两处各写一份公式，早晚会有一处忘了改，表现为「看着点中了却选不中」。
 */
export function nodeRadius(weight: number, scale: number): number {
  const base = 5.2 + (weight / 100) * 9.5;
  const grow = Math.min(4.2, 0.85 * Math.pow(Math.max(0.01, scale), 0.72));
  return base * grow;
}

/**
 * 概览层「地标 / 尘点」二级制。
 * ------------------------------------------------------------------
 * 一千一百人同屏，人人一个带圆环的圆，得到的只会是一张噪点图：
 * 环是同心圆，相邻两个叠上半个就分不清边界，眼睛无处落脚。
 * 星图的解法不是把星星画小，而是分两层——少数亮星带名字，其余只做底噪。
 *
 * 地标的取法不能只看权重门槛：权重是按分片各自编排的，五代、新莽两片
 * 最高只到 67，纯按分数取会整片一个地标都没有。故先取全局前 96 名，
 * 再给每个朝代补到至少 2 人，保证每块版图上都有可命名的锚。
 */
export const DUST_RADIUS = 1.9;
export const BEACON_SCALE = 1.45;
/**
 * 地标数量。九十六个是「贪多」的结果：地标一多，标签彼此挤掉，
 * 最后整幅图上只剩一堆孤零零的字徽——那比没有字徽更让人无从下手。
 * 五十四个（全局前五十四 + 每朝代补足一名）才刚好每个都有名字可挂。
 */

function computeBeaconIds(nodes: HistoricalPersonNode[]): Set<string> {
  const out = new Set<string>();
  const sorted = [...nodes].sort((a, b) => b.importanceWeight - a.importanceWeight);

  /**
   * 地标按**时代配额**取，不按全局权重排名取。
   * ------------------------------------------------------------------
   * 权重是各分片自己编排的（两晋 95 人最高 67 分，三国 133 人有一串 90+），
   * 所以「全局前九十六名」实际上是「三个大分片的名人堂」，其余朝代整块版图
   * 一个地标都没有——实测魏晋南北朝 131 人里只有「刘」一枚圆牌，
   * 那片疆域看上去像无人区，而王导、谢安、陶渊明都在里头。
   *
   * 改为按块分名额：名额 ∝ √人数（人多的大块多给几个），下限 6、上限 16，
   * 于是每块版图都有自己的骨架，大小之别从「块的大小」而不是「有没有名字」上读。
   */
  const byEra = new Map<string, HistoricalPersonNode[]>();
  for (const node of sorted) {
    const era = eraOf(node.dynasty);
    const bucket = byEra.get(era) ?? [];
    bucket.push(node);
    byEra.set(era, bucket);
  }
  for (const bucket of byEra.values()) {
    const quota = Math.max(4, Math.min(10, Math.round(Math.sqrt(bucket.length))));
    for (let i = 0; i < Math.min(quota, bucket.length); i += 1) out.add(bucket[i].id);
  }

  // 全局最显赫的十来位无论如何都要有名字——他们是读图的参照
  for (let i = 0; i < Math.min(12, sorted.length); i += 1) out.add(sorted[i].id);
  return out;
}

/**
 * 画像只在「脸能看清」的尺寸上出现，小于此半径一律改用姓氏字徽。
 * ------------------------------------------------------------------
 * 阈值原是 15.5px：十六像素半径的圆里，一张占画面三分之一的古画脸只剩
 * 五像素，还比不上一个字号合适的「曹」字。
 *
 * 但实测下来 15.5 太高了——中观档放大到一点八倍，多数有权重的人半径刚到
 * 十二三像素，画面上仍是清一色字徽。读图的人于是以为「有画像的人也没画像」，
 * 又回到最初那个疑问。现在降到 13.5：这个尺寸上五官还认不全，但「这是一张
 * 传世的像」已经看得出来——绢底的暖色、墨线的轮廓、头肩的剪影都在。
 * 再往下（十像素以下）就只剩一块黄斑，那才是真正的倒退，故此为止。
 */
const MIN_FACE_RADIUS = 13.5;

/** 复姓表：三字名的头两字未必是名，单取首字会得到「司」「诸」这种不成词的徽记 */
const COMPOUND_SURNAMES = new Set([
  '司马', '欧阳', '诸葛', '上官', '夏侯', '皇甫', '尉迟', '长孙', '宇文', '慕容',
  '拓跋', '独孤', '贺兰', '完颜', '耶律', '赫连', '呼延', '令狐', '公孙', '闾丘',
  '端木', '东郭', '西门', '南宫', '第五', '万俟', '太史', '申屠', '仲孙', '钟离',
]);

/** 圆内字徽：复姓取两字，单姓取一字 */
function monogramOf(name: string): string {
  const two = name.slice(0, 2);
  return COMPOUND_SURNAMES.has(two) ? two : name.slice(0, 1);
}

/** 深色主题下朝代色要提亮，否则字徽与纸底糊成一块 */
function tintForInk(hex: string, isDark: boolean): string {
  if (!isDark) return hex;
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.45);
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

/** 有传世图档（L1 古画 / L2 版画）的人物：概览档给一圈金边，一眼看出谁有画像 */
function hasRealPortrait(node: HistoricalPersonNode): boolean {
  const tier = node.portrait?.tier;
  return tier === 'tier1_authentic_painting' || tier === 'tier2_ancient_woodcut';
}

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

/**
 * 色调归一：把每张图自己的 4%~96% 分位拉成黑白两端，再按画面明暗取 gamma。
 * ------------------------------------------------------------------
 * CSS 的 contrast() 只能绕 0.5 缩放，对「纸白、墨线灰」的旧白描是反效果：
 * 线在 0.7 这一侧，越加对比它越亮，整张图最后只剩一片纸色。真正需要的是
 * 逐像素重映射——纸底压到纯白、淡墨压到深灰，而且每张图的「纸」和「墨」
 * 本来就不是同一个值。crops.json 已经在取景窗口内量好了这两个分位（lo/hi）。
 *
 * **必须按亮度归一、再按比例还原三通道**：早先对 R/G/B 各查一次表，纸底的
 * 那点黄被拉成满饱和的橙，一册汉唐像全成了橘红色——同一张表逐通道套用，
 * 等价于给每张图单独做了一遍白平衡。按亮度缩放才保得住色相。
 * 缓存命中时不重算，只有换半径档位才会跑一次。
 */
function applyTone(
  g: CanvasRenderingContext2D,
  size: number,
  crop: { lum?: number; lo?: number; hi?: number },
): void {
  const lo = crop.lo;
  const hi = crop.hi;
  if (lo == null || hi == null || hi - lo < 0.05) return;
  const lum = crop.lum ?? 180;
  // 纸白而墨淡的白描要压深（gamma > 1），深地子上的人像要提亮（gamma < 1）
  const gamma = lum > 200 ? 1.42 : lum < 118 ? 0.8 : 1.1;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v += 1) {
    const t = Math.min(1, Math.max(0, (v / 255 - lo) / (hi - lo)));
    lut[v] = Math.round(255 * Math.pow(t, gamma));
  }
  const data = g.getImageData(0, 0, size, size);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const r = px[i];
    const gg = px[i + 1];
    const b = px[i + 2];
    const y = 0.299 * r + 0.587 * gg + 0.114 * b;
    const ny = lut[Math.min(255, Math.max(0, Math.round(y)))];
    if (y < 2) {
      px[i] = ny;
      px[i + 1] = ny;
      px[i + 2] = ny;
      continue;
    }
    const k = ny / y;
    px[i] = Math.min(255, Math.round(r * k));
    px[i + 1] = Math.min(255, Math.round(gg * k));
    px[i + 2] = Math.min(255, Math.round(b * k));
  }
  g.putImageData(data, 0, 0);
}

function portraitSprite(
  id: string,
  img: HTMLImageElement,
  r: number,
  dpr: number,
  crop?: { sx: number; sy: number; side: number; lum?: number; lo?: number; hi?: number },
): HTMLCanvasElement | null {
  const radius = Math.max(4, Math.round(r * 0.9 * 2) / 2);
  const key = `${id}|${radius}|${dpr}|${crop ? `${crop.sx},${crop.sy},${crop.side}` : 'auto'}`;
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
  /**
   * 提一点暖调就够了：明暗交给 applyTone 逐像素处理（见下）。
   * 旧白描的墨线若只靠 contrast()，会越加越亮——那是绕 0.5 缩放的必然结果。
   */
  g.filter = 'saturate(1.08)';
  /**
   * 取「头肩」入圆。
   * ------------------------------------------------------------------
   * 优先用数据里的取景窗口（crop）：那是按每张图的实际版式算出来的，
   * 册页、立轴、满题裱本各有各的落点。没有 crop 的老数据才退回按纵横比猜——
   * 而这条兜底正是问题所在：3:4 的半身像会被当成全身立轴，只截到帽子。
   * 兜底保留，是为了「目录未重建也能出图」，不是因为它够准。
   */
  if (crop) {
    const side = Math.max(8, Math.min(crop.side * img.naturalWidth, img.naturalWidth, img.naturalHeight));
    const sx = Math.max(0, Math.min(crop.sx * img.naturalWidth, img.naturalWidth - side));
    const sy = Math.max(0, Math.min(crop.sy * img.naturalHeight, img.naturalHeight - side));
    g.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  } else if (ratio >= 0.82 && ratio <= 1.24) {
    // 本就是半身/方形构图，直接满幅
    g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, size, size);
  } else {
    const side = Math.min(img.naturalWidth * 0.86, img.naturalHeight * 0.46);
    const sx = Math.max(0, (img.naturalWidth - side) / 2);
    const sy = img.naturalHeight * 0.035;
    g.drawImage(img, sx, sy, side, Math.min(side, img.naturalHeight - sy), 0, 0, size, size);
  }
  if (crop) applyTone(g, size, crop);
  g.restore();

  // 缩放过程中档位会不断变化，缓存控制在可控范围内
  if (SPRITE_CACHE.size > 900) SPRITE_CACHE.clear();
  SPRITE_CACHE.set(key, canvas);
  return canvas;
}

/**
 * 三档 LOD。
 * ------------------------------------------------------------------
 * 0 概览（< 0.95×）：实心细点 + 主干关系，只标最显赫的一小撮名字；
 * 1 中观（0.95 ~ 2.2×）：圆形头像 + 姓名 + 头衔；
 * 2 微观（>= 2.2×）：加上字号生长、双层描边与关系胶囊。
 *
 * 门槛原为 0.7 / 1.6——全库适配恰好落在 0.72，于是首屏一进来就是「中观」：
 * 每个人都被要求画头像和头衔，而那时人均间距只有十二像素，头像缩到十几像素
 * 就是一团色斑。现把概览档的门槛抬到 0.95，首屏老老实实当概览看。
 */
function lodOf(scale: number): 0 | 1 | 2 {
  if (scale < 0.95) return 0;
  if (scale < 2.2) return 1;
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
  /**
   * 左下常驻面板占掉的矩形（相对画布左上角）。
   * 泳道标签画在屏幕上固定的 x=14，面板一盖就是几道没名字，故按实测矩形避让。
   */
  const panelRectRef = useRef<{ right: number; top: number; bottom: number } | null>(null);
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
  /**
   * 概览层地标集合。命中测试要复用绘制时那一份——两处各算一次，
   * 早晚会因为遍历顺序或权重并列而差出一个人，表现为「点在地标上却选中了尘点」。
   */
  const beaconRef = useRef<Set<string> | null>(null);
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
    /**
     * 底部纪年轴是盖在画布上的一层常驻浮层（约九十像素），顶部还有工具栏。
     * 只按 w/h 居中，最下面一排时代块就被纪年轴压住——实测「元 / 明 / 清」
     * 三块的下缘正好埋在时间轴底下，名字都读不到。这里把上下两条浮层
     * 从可用高度里扣掉，整幅图才是真正「看得见的部分」居中。
     */
    const insetTop = 72;
    const insetBottom = 134;
    const availW = Math.max(240, w - insetLeft - insetRight - 88);
    const availH = Math.max(180, h - insetTop - insetBottom);
    const scale = Math.min(Math.max(0.24, availW / spanX), Math.max(0.24, availH / spanY), 1.25);
    camera.current = {
      scale,
      tx: insetLeft + (w - insetLeft - insetRight) / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
      ty: insetTop + availH / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
    };
    dirtyRef.current = true;
  }, []);

  /* ---------------------------- 尺寸与自适应 ---------------------------- */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measurePanel = () => {
      const panelEl = wrap.closest('main')?.querySelector<HTMLElement>('[data-legend-panel]');
      const base = wrap.getBoundingClientRect();
      if (!panelEl) {
        panelRectRef.current = null;
        return;
      }
      const r = panelEl.getBoundingClientRect();
      panelRectRef.current = { right: r.right - base.left, top: r.top - base.top, bottom: r.bottom - base.top };
      dirtyRef.current = true;
    };
    measurePanel();
    // 图例可折叠，折叠后面板高度会变，必须跟着重测，否则避让区还按旧高度算
    const panelEl = wrap.closest('main')?.querySelector<HTMLElement>('[data-legend-panel]');
    const panelObserver = panelEl ? new ResizeObserver(measurePanel) : null;
    if (panelEl) panelObserver?.observe(panelEl);
    const observer = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      const prev = sizeRef.current;
      sizeRef.current = { w: rect.width, h: rect.height };
      measurePanel();
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
    return () => {
      observer.disconnect();
      panelObserver?.disconnect();
    };
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
    // 只放大到「够看清此人近邻」的程度；已经放得更大就不再拉远。
    // 下限从 1.35 提到 2.0：搜人/点人之后镜头贴上去，是要看清这个人，
    // 1.35× 时他还是和七八个邻居挤在一起，等于没聚焦。
    const scale = Math.min(ZOOM_MAX, Math.max(2.0, camera.current.scale));
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
    const minWeight = lodMinWeight(lod, s.nodes.length);
    const intro = Math.min(1, (performance.now() - introRef.current) / 720);

    /**
     * 概览层分「地标」与「尘点」两级：地标带名字、带头像、带金边，
     * 尘点只是朝色的一个细点。地标表在绘制时算一次，命中测试复用（beaconRef）。
     */
    const beacons = lod === 0 ? computeBeaconIds(s.nodes) : null;
    beaconRef.current = beacons;

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
        /**
         * 左下常驻面板（图谱布局 / 图例 / 筛选）会盖住下半幅画布，而泳道标签一直画在 x=14：
         * 八道时正好有四道的名字躲在面板后面，读图的人只看到四条标签，
         * 剩下四道看着像没名字的散点带。命中面板的纵向区间就把标签挪到面板右侧，
         * 并用底色描一圈，免得压在人物名字上读不清。
         */
        const cy = (y1 + y2) / 2;
        const panel = panelRectRef.current;
        const occluded = panel !== null && cy > panel.top - 12 && cy < panel.bottom + 12 && panel.right >= 14;
        const labelX = occluded ? panel.right + 12 : 14;
        if (occluded) {
          ctx.strokeStyle = s.isDark ? 'rgba(17,19,24,0.92)' : 'rgba(246,243,235,0.92)';
          ctx.lineWidth = 3;
          ctx.strokeText(lane.label, labelX, cy);
        }
        ctx.fillText(lane.label, labelX, cy);
      }
    }

    const blockTitles: { text: string; x: number; y: number; width: number; bandH: number }[] = [];

    /**
     * 各时代块在屏幕上的「可落字区」：块矩形去掉顶部那条写时代名的横带。
     * ------------------------------------------------------------------
     * 底纹与时代名只在概览档画，但地界三档都成立。放大之后相邻两代的人
     * 仍可能只隔几十像素，一个名字飘进邻代版图，读者就会把它记到别人头上
     * （耶律楚材的「元」飘进「金」、赵孟頫的名字压在「宋」的下沿，都是这么来的）。
     *
     * 横带必须扣掉：那里写着「汉末·三国」。标签挤进横带虽然仍在块内，
     * 却会与块名叠字——标题是压在所有节点之后画的，最后只剩两层字糊在一起。
     */
    const blockWorld = s.layoutMode === 'force' && s.layout.blocks.length ? blockWorldRects(s.layout) : null;
    const blockAreas: Rect[] = blockWorld
      ? s.layout.blocks.map((block, i) => {
          const rect = blockWorld[i];
          const [x1, y1] = project(rect.x1, block.y - block.h / 2 + (block.band ?? 0));
          const [x2, y2] = project(rect.x2, rect.y2);
          return { x1, y1, x2, y2 };
        })
      : [];

    /**
     * 时代分块底纹（仅力导向 + 概览档）。
     * 一千一百个点按朝代排成十来块，颜色虽有区分，但十来种土色堆在一起，
     * 光靠色相认不出「这一片是唐还是宋」。这里在每块后面垫一层几乎看不见的
     * 暖色圆角矩形，并在左上角写时代名——名字是给人读的，色块只负责划分地界。
     */
    if (lod === 0 && s.layoutMode === 'force' && s.layout.blocks.length) {
      for (const block of s.layout.blocks) {
        const [bx1, by1] = project(block.x - block.w / 2, block.y - block.h / 2);
        const [bx2, by2] = project(block.x + block.w / 2, block.y + block.h / 2);
        const bw = bx2 - bx1;
        const bh = by2 - by1;
        if (bw < 24 || bh < 24) continue;
        const radius = Math.min(22, bw / 5, bh / 5);
        ctx.beginPath();
        ctx.moveTo(bx1 + radius, by1);
        ctx.arcTo(bx2, by1, bx2, by1 + radius, radius);
        ctx.arcTo(bx2, by2, bx2 - radius, by2, radius);
        ctx.arcTo(bx1, by2, bx1, by2 - radius, radius);
        ctx.arcTo(bx1, by1, bx1 + radius, by1, radius);
        ctx.closePath();
        ctx.fillStyle = s.isDark ? 'rgba(244,236,216,0.026)' : 'rgba(126,102,64,0.042)';
        ctx.fill();

        /**
         * 时代名不在这一趟画：它得压在所有圆牌之上。
         * 先画标题、后画节点，密密麻麻的圆牌正好盖住「汉末·三国」四个字，
         * 读图的人只看到一片没有地名的疆域。位置算好存起来，节点画完再落笔。
         */
        const band = block.band ?? 0;
        const bandBottom = band > 0 ? project(block.x, block.y - block.h / 2 + band)[1] : by1;
        blockTitles.push({
          text: block.label,
          x: bx1 + 10,
          y: by1,
          width: bw - 20,
          bandH: Math.max(0, bandBottom - by1),
        });
      }
    }

    /* 可见节点集合 */
    const visible = new Map<string, { x: number; y: number; r: number; weight: number; area?: Rect }>();
    for (const node of s.nodes) {
      if (node.importanceWeight < minWeight) continue;
      if (s.year !== null && !isPersonAliveAt(node, s.year, { softWindow: 0 })) continue;
      const pos = s.layout.positions.get(node.id);
      if (!pos) continue;
      const [sx, sy] = project(pos.x, pos.y);
      if (sx < -140 || sx > w + 140 || sy < -140 || sy > h + 140) continue;
      // 概览层：地标放大一号，尘点压成固定细点——半径若仍按权重走，
      // 尘点之间就会互相压住，整片变成噪点。
      const r = beacons
        ? beacons.has(node.id)
          ? nodeRadius(node.importanceWeight, scale) * BEACON_SCALE
          : DUST_RADIUS
        : nodeRadius(node.importanceWeight, scale);
      /**
       * 归属哪个时代块：点落在块的外接矩形里即可。
       * 块与块之间留了缝、块内松弛时四边又各收 gap*0.35，所以一个人只会
       * 落进一块，不必处理重叠；真落在缝里的（理论上不存在）宁可不约束，
       * 也比猜错一块、把名字赶到邻代去强。
       */
      let area: Rect | undefined;
      if (blockWorld) {
        for (let bi = 0; bi < blockWorld.length; bi += 1) {
          const rect = blockWorld[bi];
          if (pos.x >= rect.x1 && pos.x <= rect.x2 && pos.y >= rect.y1 && pos.y <= rect.y2) {
            area = blockAreas[bi];
            break;
          }
        }
      }
      visible.set(node.id, { x: sx, y: sy, r, weight: node.importanceWeight, area });
    }

    /**
     * 过绘保护：一屏塞进四五百人时，给每个人画头像纯属浪费算力——
     * 那个密度下五官比米粒还小，画了也认不出。此时只给权重 70 以上者保留头像，
     * 其余用朝色平涂；并省掉帝王光晕（每帧几十个径向渐变，代价不低）。
     *
     * 判据从「人数 > 380」改成「人均屏幕面积」：人数是绝对量，而能不能看清
     * 取决于每人分到多少像素。4K 屏上八百人也宽裕，13 寸笔记本上三百人就密了。
     */
    const pxPerNode = (w * h) / Math.max(1, visible.size);
    const denseView = pxPerNode < 1100;

    /**
     * 标签排布：按历史中心度从高到低逐个占位，每个标签依次试
     * 下方 → 上方 → 右侧 → 左侧，取第一个既不压已占矩形、也不压他人头像的位置。
     * 若只试「正下方」并在冲突时一律放弃，密集处会把曹操、荀彧这类主角的名字
     * 整片抹掉——那比文字重叠更糟。四向试位之后，绝大多数人都能保住名字。
     */
    /**
     * 字号也要随放大一起长。
     * 原本三档 LOD 各定死一个字号（13.5px 封顶），10× 时人像有 140px 大，
     * 底下的名字还是 13.5px——比例失衡，远看像标签浮在别人的肩上。
     * 用 √(scale/2) 缓慢加成、1.7 倍封顶：既跟上画面，又不会在高倍时占满视野。
     */
    const zoomBoost = Math.min(1.7, Math.max(1, Math.sqrt(scale / 2)));
    const nameSize = (lod === 0 ? 11 : lod === 1 ? 12 : 13.5) * zoomBoost;
    const nameFont = `600 ${nameSize.toFixed(1)}px "Noto Serif SC", "Songti SC", serif`;
    const secondSize = 9.5 * Math.min(1.45, zoomBoost);
    const secondFont = `400 ${secondSize.toFixed(1)}px "Noto Sans SC", sans-serif`;
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

    /**
     * 概览档的「锚点」就是地标。地标只有八十来个，全部给名字也不会糊；
     * 反过来说，名字也只落在地标上——尘点旁挂一行字，读者根本找不到
     * 那行字指向的是哪一个 1.9px 的点，只剩墨量。
     */
    /**
     * 标名配额按**当前视口人数的排名**算，不按绝对权重门槛。
     * ------------------------------------------------------------------
     * 权重是各分片自己编排的量，绝对值不可比：三国片有一串 90+，先秦片
     * 最高不过五十上下。用「权重 ≥ 55」当门槛，等于把整片先秦、两晋的
     * 名字全部抹掉——实测中观档放大到先秦一带，一百多枚圆牌只有字徽、
     * 没有一个人名，读图的人只能靠猜。
     *
     * 改成「视口内权重前 N% 标名」：中观档标一半，微观档标九成，
     * 概览档则完全交给地标集合。排名法对任何分片的量纲都成立。
     */
    const labelQuota =
      lod === 0 ? Number.POSITIVE_INFINITY : Math.round(ordered.length * (lod === 2 ? 0.9 : 0.5));

    let rank = 0;
    for (const [id, geo] of ordered) {
      const node = nodeById.get(id);
      if (!node) continue;
      rank += 1;
      if (beacons && !beacons.has(id)) continue;
      /** 悬停与选中者必须有标签，哪怕压住旁人 */
      const force = id === s.hoverId || id === s.selectedId;
      if (!force && rank > labelQuota) continue;

      const nameW = measureCached(ctx, node.name, nameFont);
      const second = secondLineOf(node);
      let secondW = 0;
      if (second) {
        secondW = measureCached(ctx, second, secondFont);
      }
      const blockW = Math.max(nameW, secondW) + LABEL_PAD * 2;
      const blockH = nameSize + (second ? secondSize + 3 : 0) + LABEL_PAD * 2;

      /**
       * 候选位：上下左右四个贴边位。
       * ------------------------------------------------------------------
       * 曾另有一档「外扩位」——离圆心再远一倍，专给被近邻围死的中心人物。
       * 它换来的是更难读的图：名字飘在空白处，与圆牌之间既无线也无框，
       * 读者根本认不出这行字说的是哪一个圆。实测「孔丘」二字落在自己的
       * 圆牌上方七十像素处，像一条无主的批注。宁可不标，也不标到看不出归属。
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

      const variants = buildVariants(LABEL_GAP);

      const fits = (box: Rect): boolean => {
        /**
         * 地界检查放在最前：越界的候选位连试都不必试。
         * 从前只判「压不压别人」，于是块边缘那一圈人的名字全被推到块外，
         * 落在隔壁朝代的地面上——没有线、没有框，读者看不出来那是隔壁的名字。
         */
        if (geo.area) {
          const a = geo.area;
          if (
            box.x1 < a.x1 - LABEL_EDGE_SLACK ||
            box.x2 > a.x2 + LABEL_EDGE_SLACK ||
            box.y1 < a.y1 - LABEL_EDGE_SLACK ||
            box.y2 > a.y2 + LABEL_EDGE_SLACK
          ) {
            return false;
          }
        }
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

      let chosen: { box: Rect; align: CanvasTextAlign } | undefined;
      if (force) {
        chosen = { box: geo.area ? clampInto(variants[0].box, geo.area) : variants[0].box, align: variants[0].align };
      } else if (beacons) {
        /**
         * 概览层的地标优先「正下方」，排不下再试上方、左右。
         * 只给正下方会在密集处把大半个地标的名字挤掉（实测五十四个地标只剩
         * 不到二十个有名），四向兜底虽然偶有歧义，但比「一片字徽没有名字」强。
         */
        chosen = [variants[0], variants[1], variants[2], variants[3]].find((v) => fits(v.box));
      } else {
        chosen = variants.find((v) => fits(v.box));
      }
      /**
       * 最后的兜底：中观/微观层里权重 ≥ 82 的帝王级人物宁可轻微压边，也不能无名。
       * 压边可以，越界不可以——夹回本代可用区之后，最差是盖住自己的圆牌边缘，
       * 至少仍站在原地，不会跑到邻代的版图上冒充别人的名字。
       */
      if (!chosen && !beacons && node.importanceWeight >= 82) {
        chosen = { box: geo.area ? clampInto(variants[0].box, geo.area) : variants[0].box, align: variants[0].align };
      }
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


    /**
     * 关系边
     * ------------------------------------------------------------------
     * 概览档（< 0.95×）只画「同朝代的主干关系」。
     * 一千一百人同屏时全库一千八百条边里有大量跨代连线——汉与匈奴、唐与吐蕃、
     * 前后相隔几百年的两条线在屏幕上一样长，一画就是一束横穿全图的线缆，
     * 把好不容易分出来的时代块又缠成一片。关系是「放大之后才看得清」的信息，
     * 概览层只留每块内部的骨架，跨代的线一律压到近乎不可见。
     */
    const nodeByIdForEdges = new Map(s.nodes.map((node) => [node.id, node]));
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

      /**
       * 概览层只画「地标 ↔ 地标」的骨架。
       * 一千八百条边里有大量线连向尘点——在这个密度下既不指向可命名的人，
       * 又足够长，正好把分好的时代块重新缠成一束线缆。留下地标之间的线，
       * 图上就有了「谁的网连向谁」这一层可读信息，而不是一层灰雾。
       */
      if (lod === 0) {
        if (!beacons || !beacons.has(edge.source) || !beacons.has(edge.target)) continue;
        if (edge.strength < 5) continue;
      }

      const category = s.year !== null ? edgeCategoryAt(edge, s.year) : edge.primaryCategory;
      const meta = RELATION_META[category];
      const color = s.isDark ? meta.darkColor : meta.color;

      /**
       * 边的浓度按档位分三档。
       * ------------------------------------------------------------------
       * 原来中观（0.95~1.6 倍）一律 0.5 的浓度，而中观正是「一屏四五百人」的档位：
       * 那个密度下每条边都够长，一千八百条七色实线与虚线叠在一起，
       * 整幅图变成一张彩虹蛛网，人反而被线埋了。关系是「凑近才读」的信息，
       * 越远越该退成底纹。
       *
       * 概览 0.26 / 0.05、中观 0.30 / 0.12（同代 / 跨代）、微观 0.46 且不再分。
       */
      let alpha = lod === 2 ? 0.46 : 0.3;
      if (s.egoEdgeIds && !s.egoEdgeIds.has(edge.id)) alpha = 0.05;
      const touching = s.hoverId === edge.source || s.hoverId === edge.target;
      if (touching) alpha = 0.95;
      else if (lod < 2) {
        const da = nodeByIdForEdges.get(edge.source)?.dynasty;
        const db = nodeByIdForEdges.get(edge.target)?.dynasty;
        const sameEra = da && db ? eraOf(da) === eraOf(db) : da === db;
        alpha = sameEra ? (lod === 0 ? 0.26 : 0.3) : lod === 0 ? 0.05 : 0.1;
      }
      if (s.selectedId && (s.selectedId === edge.source || s.selectedId === edge.target)) {
        alpha = Math.max(alpha, 0.82);
      }

      const width = Math.max(0.6, (lod === 2 ? 0.7 : 0.5) + edge.strength * (lod === 2 ? 0.16 : 0.11)) * Math.min(1.5, Math.max(0.6, scale));
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
      // 概览层一律实线：几百条 5-4 虚线在低倍下会被重采样成断续的灰点，
      // 既看不出走向又显得脏。虚实是放大之后才分得清的语义。
      const dashed = lod === 0 ? false : meta.dashed;
      if (dashed !== dashOn) {
        ctx.setLineDash(dashed ? DASH : []);
        dashOn = dashed;
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

      // 箭头只在放大后画：概览层几千个三角头就是一层毛刺
      if (edge.directed && (lod > 0 || touching)) {
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
      const hasReal = hasRealPortrait(node);

      const appearDelay = (node.importanceWeight / 100) * 260;
      const appear = Math.min(1, Math.max(0, ((performance.now() - introRef.current) - appearDelay) / 380));
      if (appear <= 0) continue;

      ctx.globalAlpha = alpha * appear;

      if (lod === 0) {
        /**
         * 概览档的尘点：固定 1.9px 实心，无环、无头像、无光晕。
         * 它的职责是「密度与分布」，不是「认出是谁」——朝色已经说明了时代，
         * 再叠圆环只会让相邻两个糊成一片。
         */
        if (!beacons || !beacons.has(node.id)) {
          ctx.beginPath();
          ctx.arc(geo.x, geo.y, DUST_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = ringColor;
          ctx.globalAlpha = alpha * appear * (dimmed ? 0.1 : 0.62);
          ctx.fill();
          ctx.globalAlpha = alpha * appear;
        } else {
          /**
           * 地标：纸色圆牌 + 姓氏字徽 + 朝代色细环（有图档者金环）。
           *
           * 原本这里画的是缩到头像大小的人像，实测行不通：半径十四五像素时，
           * 一张全身立轴里的脸只剩四五像素，得到的是一枚发黄的圆片，
           * 既认不出人，又容易被当成「卡通头像」。字徽在这个尺寸上可读，
           * 而且与右边的姓名标签互为印证；真正的脸等到放大到 MIN_FACE_RADIUS
           * 以上再出现——见下面中观/微观两档。
           */
          ctx.save();
          ctx.shadowColor = s.isDark ? 'rgba(0,0,0,0.55)' : 'rgba(72,56,32,0.24)';
          ctx.shadowBlur = 7;
          ctx.shadowOffsetY = 1.5;
          ctx.beginPath();
          ctx.arc(geo.x, geo.y, r, 0, Math.PI * 2);
          ctx.fillStyle = s.isDark ? 'rgba(34,38,46,0.97)' : 'rgba(251,248,241,0.98)';
          ctx.fill();
          ctx.restore();

          const mark = monogramOf(node.name);
          ctx.font = `600 ${(mark.length > 1 ? r * 0.9 : r * 1.15).toFixed(1)}px "Noto Serif SC", "Songti SC", serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = tintForInk(ringColor, s.isDark);
          ctx.fillText(mark, geo.x, geo.y + r * 0.04);

          ctx.beginPath();
          ctx.arc(geo.x, geo.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = hasReal
            ? s.isDark
              ? 'rgba(226,196,120,0.95)'
              : 'rgba(158,118,40,0.9)'
            : s.isDark
              ? `${ringColor}99`
              : `${ringColor}aa`;
          ctx.lineWidth = hasReal ? 1.8 : 1.2;
          ctx.stroke();
        }
        ctx.globalAlpha = alpha * appear;
      } else {
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

        /**
         * 圆里放什么：**只有 L1/L2 传世图档才放脸，其余一律用姓氏字徽**。
         * ------------------------------------------------------------------
         * 原先的逻辑是「有图就画图」，而九百多人身上都挂着一张 L4 冠服剪影
         * （程序生成的程式化小人）。它在小尺寸上和古画头像混在一起，
         * 于是整幅图看上去全是卡通头像——用户第一眼就指出「有画像的人
         * 显示的也是卡通画像」，说的正是这件事：真的脸被剪影稀释掉了。
         *
         * 现在把「有真画像」与「无画像」分成两种画法：
         *   金环 + 人像  —— 传世画像，看得见就是看得见；
         *   朝色环 + 字徽 —— 无画像者，用字，不臆造形象。
         * 冠服考据像仍然留在右侧人物详情里（那里有足够的尺寸与文字说明
         * 「这是复原示意，不是写生」），不进画布。
         */
        const img = hasReal && r >= MIN_FACE_RADIUS && (!denseView || node.importanceWeight >= 70)
          ? getPortraitImage(node)
          : null;
        if (img && img.complete && img.naturalWidth > 0) {
          const sprite = portraitSprite(node.id, img, r, dpr, node.portrait?.crop);
          if (sprite) {
            ctx.drawImage(sprite, geo.x - r * 0.94, geo.y - r * 0.94, r * 1.88, r * 1.88);
          }
        } else if (r >= 7) {
          const mark = monogramOf(node.name);
          ctx.font = `600 ${(mark.length > 1 ? r * 0.9 : r * 1.15).toFixed(1)}px "Noto Serif SC", "Songti SC", serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = tintForInk(ringColor, s.isDark);
          ctx.globalAlpha = alpha * appear * 0.85;
          ctx.fillText(mark, geo.x, geo.y + r * 0.04);
          ctx.globalAlpha = alpha * appear;
        }

        /* 边框：双层 / 单层。有传世图档者用金线，一眼看出这不是复原像 */
        ctx.beginPath();
        ctx.arc(geo.x, geo.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = hasReal
          ? s.isDark
            ? 'rgba(226,196,120,0.92)'
            : 'rgba(158,118,40,0.85)'
          : ringColor;
        ctx.lineWidth = lod === 2 ? 2 : 1.4;
        ctx.stroke();

        if (lod === 2) {
          ctx.beginPath();
          ctx.arc(geo.x, geo.y, r + 3.2, 0, Math.PI * 2);
          ctx.strokeStyle = `${ringColor}55`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
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

      /**
       * 标签不用色块底，改成文字描边。
       * 原先是给每个名字垫一块半透明矩形（1200 个就是 1200 个 fillRect），
       * 密集处这些方块互相叠压，看着像一墙便签，反而把人物图埋了。
       * 描边只沿着笔画走，既压得住背景，又不会切出一块硬边。
       */
      const halo = s.isDark ? 'rgba(14,16,20,0.88)' : 'rgba(250,247,238,0.92)';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;

      ctx.font = nameFont;
      ctx.lineWidth = 3;
      ctx.strokeStyle = halo;
      ctx.strokeText(node.name, place.nameX, place.nameY);
      ctx.fillStyle = s.isDark ? 'rgba(238,232,218,0.95)' : 'rgba(28,26,22,0.94)';
      ctx.fillText(node.name, place.nameX, place.nameY);

      if (place.second) {
        ctx.font = secondFont;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = halo;
        ctx.strokeText(place.second, place.titleX, place.titleY);
        ctx.fillStyle = s.isDark ? 'rgba(200,193,178,0.62)' : 'rgba(90,80,64,0.64)';
        ctx.fillText(place.second, place.titleX, place.titleY);
      }
    }

    /**
     * 时代名最后落笔：它必须压在所有圆牌与姓名之上，否则密集处等于没写。
     * ------------------------------------------------------------------
     * 字号与位置都由**横带在屏幕上的实际高度**决定，不写死 15px：
     * 布局在块顶留了一条 band 厚的空带（节点只铺在带下），把标题摆进带心，
     * 就再也不会出现「圆牌压住时代名」——实测先秦块的「孟」「孔」两枚圆牌
     * 正好落在「上古·先秦」四个字上，一块疆域就此没有地名。
     *
     * 带高随缩放变化：概览档约 20px，放大到微观档有上百像素，字也跟着长，
     * 否则凑近看是一块空地中央几个小字。带太矮（缩到底）时干脆不写，
     * 那时连朝代色块都糊成一片，标题只会变成噪点。
     */
    for (const title of blockTitles) {
      if (title.bandH < 11) continue;
      const size = Math.max(10, Math.min(22, title.bandH * 0.62));
      const track = size * 0.22;
      ctx.font = `700 ${size.toFixed(1)}px "Noto Serif SC", "Songti SC", serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2.4, size * 0.24);
      ctx.strokeStyle = s.isDark ? 'rgba(14,16,20,0.92)' : 'rgba(250,247,238,0.95)';
      const step = (ch: string) => ctx.measureText(ch).width + track;
      const ty = title.y + title.bandH / 2;
      let tx = title.x;
      for (const ch of title.text) {
        ctx.strokeText(ch, tx, ty);
        tx += step(ch);
      }
      const totalW = tx - title.x - track;
      ctx.fillStyle = s.isDark ? 'rgba(228,218,196,0.82)' : 'rgba(74,58,36,0.82)';
      tx = title.x;
      for (const ch of title.text) {
        ctx.fillText(ch, tx, ty);
        tx += step(ch);
      }
      // 横带下沿一条细线：与下方的人划清界限，像古籍的界行
      ctx.beginPath();
      ctx.moveTo(title.x, title.y + title.bandH - 1);
      ctx.lineTo(title.x + Math.min(totalW + 6, title.width), title.y + title.bandH - 1);
      ctx.strokeStyle = s.isDark ? 'rgba(220,206,178,0.18)' : 'rgba(110,88,56,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
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
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.scale * factor));
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
      const minWeight = lodMinWeight(lod, s.nodes.length);
      const beacons = beaconRef.current;
      // 概览层的地标被放大了 1.45 倍、尘点缩到 1.9px，命中半径必须跟着走：
      // 两处各写一份，就会出现「看得见却点不中」和「点空白选中了人」两种毛病。
      const radiusOf = (weight: number, id: string): number =>
        beacons
          ? beacons.has(id)
            ? nodeRadius(weight, scale) * BEACON_SCALE + 5
            : DUST_RADIUS + 4
          : nodeRadius(weight, scale) + 5;
      let best: { id: string; dist: number } | null = null;
      for (const node of s.nodes) {
        if (node.importanceWeight < minWeight) continue;
        if (s.year !== null && !isPersonAliveAt(node, s.year, { softWindow: 0 })) continue;
        const pos = s.layout.positions.get(node.id);
        if (!pos) continue;
        const x = pos.x * scale + tx;
        const y = pos.y * scale + ty;
        const r = radiusOf(node.importanceWeight, node.id);
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
    const minWeight = lodMinWeight(lod, s.nodes.length);
    const beacons = beaconRef.current;
    let best: { edge: HistoricalRelationEdge; dist: number } | null = null;

    for (const edge of s.edges) {
      if (!s.relationFilter.has(edge.primaryCategory)) continue;
      // 概览层只画了地标之间的线，没画的线当然也不该被点中
      if (beacons && (!beacons.has(edge.source) || !beacons.has(edge.target))) continue;
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

  /**
   * 滚轮 / 触控板缩放：挂原生监听，浏览器捏合也归这里。
   * ------------------------------------------------------------------
   * 两个必踩的坑：
   *  ① React 把 wheel 委托成**被动**监听，`preventDefault()` 只会换来一条
   *     「Unable to preventDefault inside passive event listener」警告，
   *     页面照样滚——所以这里必须 addEventListener + `{ passive: false }`。
   *  ② 触控板捏合在浏览器里是 `ctrlKey: true` 的 wheel 事件。若照常规步长处理，
   *     捏合一下就把整页放大（浏览器原生缩放），画布纹丝不动。
   *     故 ctrlKey 一路单独给更细的灵敏度（0.006），做成真正的「捏合看细节」。
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      tweenRef.current = null;
      const rect = canvas.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const cam = camera.current;
      // 捏合的手指位移远小于滚轮格数，灵敏度要放大；鼠标滚轮走常规步长
      const sensitivity = event.ctrlKey ? 0.006 : 0.0016;
      const factor = Math.exp(-event.deltaY * sensitivity);
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.scale * factor));
      if (next === cam.scale) return;
      // 以光标为锚：光标下的那一点在缩放前后钉在原地
      const worldX = (mx - cam.tx) / cam.scale;
      const worldY = (my - cam.ty) / cam.scale;
      camera.current = { scale: next, tx: mx - worldX * next, ty: my - worldY * next };
      dirtyRef.current = true;
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
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

  /**
   * 双击某人：镜头直接贴上去（3.2× 起）。
   * 滚轮要滚十几下才到得了一个人，双击是「我就要看这一个」的快捷路径。
   */
  const onDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const id = hitTest(mx, my);
      if (!id) return;
      const pos = latest.current.layout.positions.get(id);
      if (!pos) return;
      const { h } = sizeRef.current;
      const scale = Math.min(ZOOM_MAX, Math.max(3.2, camera.current.scale));
      const usableW = Math.max(240, sizeRef.current.w - (latest.current.rightInset ?? 0));
      animateCamera({ scale, tx: usableW / 2 - pos.x * scale, ty: h / 2 - pos.y * scale });
    },
    [hitTest, animateCamera],
  );

  const hoverPerson = hoverId ? nodeIndex.get(hoverId) ?? null : null;

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
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
