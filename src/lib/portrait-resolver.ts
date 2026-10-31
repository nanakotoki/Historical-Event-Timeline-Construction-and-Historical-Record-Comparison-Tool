/**
 * 四级画像降级解析器 + AI 古画复原提示词生成器
 * ------------------------------------------------------------------
 * 解析顺序（优雅降级）：
 *   L1 传世真迹  →  L2 古籍版画  →  L3 史料外貌复原  →  L4 朝代冠服剪影
 * 种子库中 L3/L4 一律由本地 SVG 生成器产出（离线可用、无外链失效风险），
 * 并在 UI 上明确标注「复原/剪影，非传世真迹」，绝不冒充实物。
 */
import type { DynastyId, HistoricalPersonNode, PortraitTier } from '@/types/history';
import { PORTRAIT_TIER_META, portraitDataUri, specOfPerson } from './portrait-svg';

export interface ResolvedPortrait {
  /** 画布与卡片使用的图像地址（可能是 data-URI 或远端 URL） */
  src: string;
  /** 高清立轴地址（Lightbox） */
  fullSrc: string;
  tier: PortraitTier;
  tierLabel: string;
  tierShort: string;
  tierTone: string;
  tierNote: string;
  attribution: string;
  painterOrBook?: string;
  isGenerated: boolean;
  prompt: string;
  appearance?: { quote: string; bookSource: string; translation: string };
}

/* ------------------------- 历代冠服规制（供提示词） ------------------------- */

const DYNASTY_COSTUME: Record<DynastyId, { name: string; headwear: string; robe: string; palette: string }> = {
  pre_qin: {
    name: '先秦',
    headwear: '玄冠束发，玉衡固簪，或戴爵弁',
    robe: '玄端深衣，上衣下裳十二幅，佩玉组缨',
    palette: '玄（黑赤）为主色，间以朱、苍、黄',
  },
  qin: {
    name: '秦',
    headwear: '黑色长冠（刘氏冠前身），束发戴帻',
    robe: '水德尚黑，衮服玄衣纁裳，革带钩觿',
    palette: '尚黑，配赤、金',
  },
  chu_han: {
    name: '楚汉之际',
    headwear: '楚式高冠或汉初长冠，甲胄则为玄甲兜鍪',
    robe: '战阵则玄甲绛袍，朝会则玄端深衣',
    palette: '玄黑与赤红，甲片泛青铜冷光',
  },
  western_han: {
    name: '西汉',
    headwear: '进贤冠（文吏）、武冠（武将），帝王冕冠垂旒',
    robe: '袀玄深衣，交领右衽，腰束革带，佩绶',
    palette: '黑红为主，金玉为饰',
  },
  xin: {
    name: '新莽',
    headwear: '依《周礼》复古之冕弁',
    robe: '仿古深衣，宽衣博带',
    palette: '土黄配玄黑，取「土德」之义',
  },
  eastern_han: {
    name: '东汉',
    headwear: '进贤冠三梁，武冠加鹖尾，帝王冕冠十二旒',
    robe: '朱色朝服，佩绶系玉，蔽膝垂裳',
    palette: '朱红与玄黑，金线织纹',
  },
  three_kingdoms: {
    name: '三国',
    headwear: '文士纶巾、武冠、进贤冠；帝王冕旒',
    robe: '交领宽袖袍服，外罩裲裆，腰束大带',
    palette: '魏尚赤、蜀尚赤、吴尚黄，衣色沉稳',
  },
  jin: {
    name: '两晋',
    headwear: '小冠、巾子、笼冠；名士则幅巾散发',
    robe: '宽衣博带，褒衣博帶，衫裙飘逸',
    palette: '素雅青白，间以朱紫',
  },
  southern_northern: {
    name: '南北朝',
    headwear: '笼冠、纱帽、鲜卑风帽',
    robe: '袴褶与褒衣博带并存，胡汉杂糅',
    palette: '石青、赭石、土黄',
  },
  sui: {
    name: '隋',
    headwear: '幞头初兴，软脚垂带；帝王冕冠',
    robe: '圆领窄袖袍，革带十三銙',
    palette: '赤黄为主，青绿相辅',
  },
  tang: {
    name: '唐',
    headwear: '幞头（软脚/硬脚），帝王冕冠，女则高髻花钿步摇',
    robe: '圆领缺胯袍、襕衫，女着齐胸襦裙披帛',
    palette: '盛唐浓丽：朱红、石青、泥金、鹅黄',
  },
  five_dynasties: {
    name: '五代',
    headwear: '展脚幞头雏形，武人多戴兜鍪',
    robe: '圆领袍，甲胄繁复',
    palette: '沉褐、黛青、暗金',
  },
  song: {
    name: '宋',
    headwear: '展脚幞头（直翅），女戴冠梳',
    robe: '圆领大袖公服，按品级分紫、绯、朱、绿',
    palette: '清雅淡素：藕荷、青白、墨绿',
  },
  liao_jin_xia: {
    name: '辽金西夏',
    headwear: '皮帽、毡笠、金冠',
    robe: '左衽窄袖袍，髡发垂辫',
    palette: '赭褐、青铜、暗红',
  },
  yuan: {
    name: '元',
    headwear: '笠帽（钹笠冠）、罟罟冠（女）',
    robe: '质孙服，窄袖束腰，辫线袄',
    palette: '白、青、赭',
  },
  ming: {
    name: '明',
    headwear: '乌纱帽（展翅）、翼善冠（帝）、凤冠（后）',
    robe: '盘领右衽袍，胸背补子，革带玉佩',
    palette: '正红、石青、明黄，织金妆花',
  },
  qing: {
    name: '清',
    headwear: '暖帽/凉帽加顶珠花翎，女戴钿子',
    robe: '马蹄袖箭衣、补褂，披领朝珠',
    palette: '石青、绛紫、明黄',
  },
};

const STYLE_SUFFIX =
  '画面风格：绢本设色工笔人物画，铁线描勾勒，矿物颜料（朱砂、石青、石绿、蛤粉）层层渲染，' +
  '宋代院体画质感，宣纸底纹，人物半身立轴构图，留白处题写小楷款识与朱文印章；' +
  '光影柔和均匀，无现代摄影感，无 3D 渲染感，无 AI 瑕疵；高清细节，8K 扫描级。';

/**
 * 生成严格考据的 AI 古画复原提示词。
 * 依据：① 正史外貌原文 ② 朝代冠服规制 ③ 身份/性别/官职 ④ 画像考据等级
 */
export function buildAiPrompt(person: HistoricalPersonNode): string {
  const costume = DYNASTY_COSTUME[person.dynasty] ?? DYNASTY_COSTUME.three_kingdoms;
  const appearance = person.portrait.classicalAppearanceQuote;
  const sovereign = person.roles.some((r) => /皇帝|皇后|可汗|单于|霸王|君主|女王/.test(r));
  const martial = person.roles.some((r) => /将军|军事|武将|统帅|名将|猛将/.test(r));

  const identityLine = `主体：${costume.name}代${person.gender === 'female' ? '女性' : '男性'}历史人物「${person.name}」${
    person.aliases.courtesyName ? `（字${person.aliases.courtesyName}）` : ''
  }，身份为${person.roles.slice(0, 3).join('、')}${sovereign ? '，按帝后仪制绘制' : martial ? '，按武职仪制绘制' : ''}。`;

  const appearanceLine = appearance
    ? `史载容貌依据：「${appearance.quote}」（${appearance.bookSource}）——须严格据此呈现：${appearance.translation}`
    : '史书未载其容貌，请依其身份、年龄段与性情作合乎时代的合理复原，避免任何脸谱化。';

  const costumeLine = `冠服依据：头戴${costume.headwear}；身着${costume.robe}；设色以${costume.palette}为主。`;

  return [identityLine, appearanceLine, costumeLine, STYLE_SUFFIX].join('\n');
}

/* ------------------------------ 解析与降级 ------------------------------- */

const LOCAL_CACHE = new Map<string, ResolvedPortrait>();

/** 静态导出可能部署在子路径下，本地图档需补上 basePath 前缀 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function assetUrl(url: string): string {
  if (!url) return '';
  if (/^(data:|blob:|https?:)/i.test(url)) return url;
  return `${BASE_PATH}${url.startsWith('/') ? url : `/${url}`}`;
}

function tierOf(person: HistoricalPersonNode): PortraitTier {
  const hasRemote = Boolean(person.portrait.fullSizeUrl || person.portrait.thumbnailUrl);
  if (hasRemote) return person.portrait.tier;
  // 无远端图源：有相貌原文 → L3 复原；无 → L4 剪影
  return person.portrait.classicalAppearanceQuote ? 'tier3_ai_reconstructed' : 'tier4_attire_silhouette';
}

export function resolvePortrait(person: HistoricalPersonNode): ResolvedPortrait {
  const cached = LOCAL_CACHE.get(person.id);
  if (cached) return cached;

  const tier = tierOf(person);
  const meta = PORTRAIT_TIER_META[tier];
  const generated = tier === 'tier3_ai_reconstructed' || tier === 'tier4_attire_silhouette';
  const localSvg = generated ? portraitDataUri(specOfPerson(person)) : '';

  const resolved: ResolvedPortrait = {
    src: assetUrl(person.portrait.thumbnailUrl || person.portrait.fullSizeUrl || localSvg),
    fullSrc: assetUrl(person.portrait.fullSizeUrl || person.portrait.thumbnailUrl || localSvg),
    tier,
    tierLabel: meta.label,
    tierShort: meta.short,
    tierTone: meta.tone,
    tierNote: meta.note,
    attribution:
      person.portrait.sourceAttribution ||
      (generated
        ? '华夏史网依历代《舆服志》冠服规制本地生成（非传世真迹）'
        : '出处待考'),
    ...(person.portrait.painterOrBook ? { painterOrBook: person.portrait.painterOrBook } : {}),
    isGenerated: generated,
    prompt: person.portrait.aiReconstructionPrompt || buildAiPrompt(person),
    ...(person.portrait.classicalAppearanceQuote
      ? { appearance: person.portrait.classicalAppearanceQuote }
      : {}),
  };

  LOCAL_CACHE.set(person.id, resolved);
  return resolved;
}

/* --------------------------- Canvas 图像缓存 ----------------------------- */

interface ImageEntry {
  status: 'loading' | 'ready' | 'error';
  img: HTMLImageElement | null;
}

const IMAGE_CACHE = new Map<string, ImageEntry>();
const listeners = new Set<() => void>();

export function onPortraitLoaded(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const l of listeners) l();
}

/**
 * 供 Canvas 使用的图片句柄：同步返回（可能尚未加载完成），
 * 加载完成后通过全局订阅回调触发重绘。
 */
export function getPortraitImage(person: HistoricalPersonNode): HTMLImageElement | null {
  const url = resolvePortrait(person).src;
  if (!url) return null;
  const hit = IMAGE_CACHE.get(url);
  if (hit) return hit.status === 'ready' ? hit.img : null;

  const img = new Image();
  const entry: ImageEntry = { status: 'loading', img: null };
  IMAGE_CACHE.set(url, entry);
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    entry.status = 'ready';
    entry.img = img;
    notify();
  };
  img.onerror = () => {
    entry.status = 'error';
    entry.img = null;
    notify();
  };
  img.src = url;
  return null;
}

/**
 * 全站预取：空闲时段批量解码，避免画布首次绘制时头像空白。
 * ------------------------------------------------------------------
 * **顺序必须按权重降序**。这是一次性把一百七十多张图塞进浏览器队列，
 * 而浏览器对同一域名只开六条连接、按入队先后取——乱序入队等于让第一个
 * 屏幕上的曹操排在第一百五十位。实测弱网（约 60KB/s）下二十秒只完成六张，
 * 眼睛看到的恰是最该有脸的那几位还在排队。
 * 按权重排，等于把「先给明显的人装脸」写进加载顺序，与画布的 LOD 同序。
 */
export function prefetchPortraits(persons: HistoricalPersonNode[]) {
  if (typeof window === 'undefined') return;
  const ordered = [...persons].sort((a, b) => b.importanceWeight - a.importanceWeight);
  const run = () => ordered.forEach((p) => getPortraitImage(p));
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(run);
  else window.setTimeout(run, 400);
}
