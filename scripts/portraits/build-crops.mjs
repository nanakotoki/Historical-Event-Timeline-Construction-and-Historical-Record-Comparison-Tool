#!/usr/bin/env node
/**
 * 画布头像取景表（crops.json）生成器
 * ------------------------------------------------------------------
 * 为什么需要这张表：图档不是同一种版式。册页半身像（3:4，脸居中偏上）、
 * 全身立轴（1:2 以上，头只占顶端一小截）、元代《历代圣贤半身像》那种
 * 「人物在左下角、右上满题」的裱本，用同一条固定比例去裁，前两类还能
 * 勉强对上，第三类必然裁到一片暗背景或一顶帽子。画布上于是出现
 * 「明明有画像，圆里却是一块黑」——这不是画像缺失，是取景错了。
 *
 * 做法：按纵横比分档给默认窗口（bust / scroll / wide），再允许
 * crop-overrides.json 对个别图档逐件改判（归一化坐标 0~1）。
 * 输出 scripts/portraits/crops.json，由 build-catalog.mjs 并入目录、
 * build-seed.mjs 注入 person.portrait.crop，画布 portraitSprite 直接使用。
 *
 * 用法：node scripts/portraits/build-crops.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
/**
 * 输入取 manifest 而非 catalog：catalog 由 build-catalog.mjs 产出，而它又要
 * 读本表把 crop 写进目录。若本脚本反过来读 catalog，就成了「先生鸡还是先生蛋」。
 * manifest 只登记「图档已落盘」这件事，正是这里需要的全部信息。
 */
const MANIFEST = path.join(__dirname, 'manifest.json');
const OVERRIDES = path.join(__dirname, 'crop-overrides.json');
/**
 * 人脸框审计表（可选）。存在时优先按它取景，缺失则退回行剖面启发式。
 * 由 audit-faces.py 生成，见该脚本头部注释——它需要 opencv，属于离线审计
 * 工具链，不参与本项目的常规构建。
 */
const FACES = path.join(__dirname, 'faces.json');
const OUT = path.join(__dirname, 'crops.json');

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const overrides = existsSync(OVERRIDES) ? JSON.parse(await readFile(OVERRIDES, 'utf8')).entries : {};
const faces = existsSync(FACES) ? JSON.parse(await readFile(FACES, 'utf8')) : {};

/** 纸底估计：四角与四边采样取中位数 */
function paperColor(data, w, h, ch) {
  const pts = [];
  const push = (x, y) => {
    const i = (y * w + x) * ch;
    pts.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 24))) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 24))) {
    push(0, y);
    push(w - 1, y);
  }
  const med = (k) => {
    const arr = pts.map((p) => p[k]).sort((a, b) => a - b);
    return arr[Math.floor(arr.length / 2)];
  };
  return [med(0), med(1), med(2)];
}

/**
 * 内容包围盒已废弃：它对满幅纹理（霉斑、装裱边）会退化成整幅，
 * 而且把题字栏也算作「内容」，正是取景跑偏的源头。现用 analyze() 的行剖面。
 */

/**
 * 画心分析：一次扫描同时得到三件事。
 * ------------------------------------------------------------------
 * 1) headTop —— 冠帽上沿（归一化 y）。只看中间那条竖带，避开题字栏与边框。
 * 2) headCx   —— 头部所在的横向重心（归一化 x）。**不能再用整幅的内容重心**：
 *    《圣贤半身像》一类裱本左半是满题小字，内容重心会被拉向题字，
 *    窗口于是落在字上——圆里一片空白纸，谁都认不出这是谁。
 *    改用「画心上沿往下两成画幅」这一带的墨量重心，题字那几列每一行都均匀
 *    出墨、而冠帽与须眉是成团的重墨，按墨量的平方加权就能把它压过去。
 * 3) lum      —— 整幅平均亮度。纸本白描亮到发白、绢本设色又暗得发闷，
 *    同一个对比度套在两端都不合适，画布据此换滤镜。
 */
async function analyze(file) {
  const W = 200;
  const { data, info } = await sharp(file).resize({ width: W }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const [pr, pg, pb] = paperColor(data, w, h, ch);
  const ink = (x, y) => {
    const i = (y * w + x) * ch;
    return Math.abs(data[i] - pr) + Math.abs(data[i + 1] - pg) + Math.abs(data[i + 2] - pb) > 96 ? 1 : 0;
  };

  let sum = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * ch;
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
  }
  const lum = Math.round(sum / (w * h));

  const x0 = Math.floor(w * 0.15);
  const x1 = Math.ceil(w * 0.85);
  const need = (x1 - x0) * 0.08;
  let headTop = 0;
  let streak = 0;
  for (let y = Math.floor(h * 0.04); y < h; y += 1) {
    let n = 0;
    for (let x = x0; x < x1; x += 1) n += ink(x, y);
    if (n > need) {
      streak += 1;
      if (streak >= 3) {
        headTop = Math.max(0, (y - 3) / h);
        break;
      }
    } else {
      streak = 0;
    }
  }

  const by0 = Math.round(headTop * h);
  const by1 = Math.min(h, by0 + Math.round(h * 0.2));
  const cols = new Array(w).fill(0);
  for (let y = by0; y < by1; y += 1) for (let x = 0; x < w; x += 1) cols[x] += ink(x, y);
  const peak = Math.max(1, ...cols);
  let wx = 0;
  let ws = 0;
  for (let x = 0; x < w; x += 1) {
    if (cols[x] < peak * 0.16) continue;
    const weight = cols[x] ** 2; // 重墨处压倒均匀出墨的题字栏
    wx += x * weight;
    ws += weight;
  }
  const headCx = ws > 0 ? wx / ws / w : 0.5;

  /**
   * 头宽（归一化到画幅宽）：窗口边长直接由它定，见 windowFor。
   * ------------------------------------------------------------------
   * 只取「含墨峰的那一段连续列」，两侧允许跨过两列空隙——题字栏与人物之间
   * 总隔着一段空白，跨不过去，于是那几列竖排小字不会被算进头宽。若改用
   * 「最左到最右的墨列全距」，一条贴着右边缘的题款就能把「头」量成整幅宽。
   */
  const band0 = Math.round(headTop * h);
  const band1 = Math.min(h, band0 + Math.round(h * 0.22));
  const cols2 = new Array(w).fill(0);
  for (let y = band0; y < band1; y += 1) for (let x = 0; x < w; x += 1) cols2[x] += ink(x, y);
  let pk = 0;
  let pkX = Math.floor(w / 2);
  for (let x = 0; x < w; x += 1) {
    if (cols2[x] > pk) {
      pk = cols2[x];
      pkX = x;
    }
  }
  const thr = Math.max(1, pk * 0.14);
  const reach = (step) => {
    let at = pkX;
    for (;;) {
      let k = 1;
      while (k <= 2 && at + step * k >= 0 && at + step * k < w && cols2[at + step * k] <= thr) k += 1;
      const nxt = at + step * k;
      if (k > 2 || nxt < 0 || nxt >= w || cols2[nxt] <= thr) return at;
      at = nxt;
    }
  };
  const headW = pk > 0 ? (reach(1) - reach(-1) + 1) / w : 0.5;

  /**
   * 人物在画面里占多高（仅作兜底诊断用）。
   */
  let yTop = h;
  let yBot = 0;
  for (let y = 0; y < h; y += 1) {
    let n = 0;
    for (let x = x0; x < x1; x += 1) n += ink(x, y);
    if (n > need) {
      if (y < yTop) yTop = y;
      if (y > yBot) yBot = y;
    }
  }
  const fh = yBot > yTop ? (yBot - yTop + 1) / h : 0.9;

  /**
   * 暗地子上的像（绢本设色、深色托底）：整幅每一行都「有墨」，
   * 行剖面找不到冠帽上沿，窗口被顶到画幅最上面，圆里只剩一片暗地子——
   * 《历代圣贤半身像》几张全是这个病症。这类图反过来找：脸比地子和衣袍亮，
   * 取中央竖带里最亮的那一行，往上留四分之一画幅给冠帽。
   */
  let top = headTop;
  if (lum < 118) {
    let bestY = 0;
    let bestV = -1;
    for (let y = Math.floor(h * 0.1); y < Math.floor(h * 0.95); y += 1) {
      let sum2 = 0;
      for (let x = Math.floor(w * 0.2); x < Math.ceil(w * 0.8); x += 1) {
        const i = (y * w + x) * ch;
        sum2 += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      if (sum2 > bestV) {
        bestV = sum2;
        bestY = y;
      }
    }
    top = Math.max(0, bestY / h - 0.12);
  }

  return {
    headTop: top,
    headCx: Math.max(0.05, Math.min(0.95, headCx)),
    headW: Math.max(0.04, Math.min(1, headW)),
    lum,
    fh,
  };
}

/**
 * 归一化方形窗口：{ sx, sy, side }，side 为相对图宽的边长比例
 */
function windowFor(ratio, headTop, headCx, headW) {
  /**
   * 窗口边长 = **头宽的两倍**。
   * ------------------------------------------------------------------
   * 这是全篇最要紧的一条，前几版都栽在这里。按「人物高度 × 四成二」取窗口，
   * 对全身立轴成立（头约占身高的七分之一），对半身册页却是灾难：杜甫那张
   * 头从 0.18 一路占到 0.62，四成二的窗口只到眉眼——圆里就剩一顶黑幞头，
   * 画布上看着跟「没有画像」一模一样。
   *
   * 头宽才是那个跨版式不变的尺度：半身像头宽占画幅近一半，取两倍恰好是
   * 冠帽加肩线；全身像头宽只有一成二，两倍正好是一颗头，不会再把人缩成
   * 一枚小站人。窗口高度沿方形，所以纵向覆盖 = 两倍头宽 ÷ 画幅纵横比。
   */
  const side = Math.max(0.17, Math.min(0.98, headW * 2));
  const sh = side * ratio; // 相对图高
  const sx = clamp01(headCx - side / 2, 1 - side);
  const sy = clamp01(headTop - 0.02, 1 - sh);
  return { sx, sy, side };
}

function clamp01(v, max = 1) {
  return Math.max(0, Math.min(v, max));
}

/**
 * 由人脸框反推取景窗口（首选方案）。
 * ------------------------------------------------------------------
 * 前三版的窗口都是「猜」出来的：行剖面猜冠帽上沿、墨量重心猜横向位置、
 * 头宽猜尺度。每一项在多数图上成立，凑在一起就会在装裱边、满题裱本、
 * 暗地子上连环出错——而错的代价很具体：圆里一顶黑帽子或一片白纸。
 *
 * faces.json 是在这批图上跑过一次人脸检测的结果（YuNet，见
 * audit-faces.py），它的框就是脸本身，不再有猜测成分。窗口按「脸宽 2.9 倍」
 * 取：把冠帽、鬓角、肩线一并圈进来，脸约占圆的七成——再大就成证件照，
 * 再小又回到「小站人」。
 * 只认 score ≥ 0.75 的框；低于此的宁可退回启发式，也不拿错框去裁。
 */
function windowFromFace(face, ratio) {
  const side = Math.max(0.14, Math.min(0.99, Math.min(face.w * 2.9, 0.99 / ratio)));
  const sh = side * ratio;
  const fc = face.x + face.w / 2;
  const fcy = face.y + face.h / 2;
  const sx = clamp01(fc - side / 2, 1 - side);
  const sy = clamp01(fcy - 0.46 * sh, 1 - sh);
  return { sx, sy, side };
}

const entries = {};
let n = 0;
for (const [id, rec] of Object.entries(manifest.entries || {})) {
  const file = path.join(ROOT, 'public', 'data', 'portraits', `${id}.jpg`);
  if (!existsSync(file)) continue;
  const meta = await sharp(file).metadata();
  const ratio = meta.width / meta.height;
  const override = overrides[id];
  const { headTop, headCx, headW, lum } = await analyze(file);
  const face = faces[id];
  let win;
  if (override) {
    win = { sx: override.sx, sy: override.sy, side: override.side };
  } else if (face && face.score >= 0.75) {
    win = windowFromFace(face, ratio);
  } else {
    win = windowFor(ratio, headTop, headCx, headW);
  }
  const side = Math.max(0.05, Math.min(1, win.side));
  const sxs = Math.max(0, Math.min(win.sx, 1 - side));
  const sys = Math.max(0, Math.min(win.sy, 1 - side * ratio));
  /**
   * 圆内那块画面的明暗两端（4% / 96% 分位）。
   * ------------------------------------------------------------------
   * 同一个对比度不能套在所有图上：绢本设色的脸在深地子上（分位落在 0.15~0.4），
   * 纸本白描的墨线又细又浅（0.55~0.85）。画布据此把这段区间拉到 0.15~0.90，
   * 暗的不至于糊成黑块、淡的不至于白成一张纸——这是「看得出是个人」的最后一步。
   */
  const cropPx = Math.max(16, Math.round(side * meta.width));
  const grey = await sharp(file)
    .extract({
      left: Math.round(sxs * meta.width),
      top: Math.round(sys * meta.height),
      width: Math.min(cropPx, meta.width - Math.round(sxs * meta.width)),
      height: Math.min(cropPx, meta.height - Math.round(sys * meta.height)),
    })
    .resize(48, 48, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();
  const hist = new Array(256).fill(0);
  for (const v of grey) hist[v] += 1;
  const cut = (q) => {
    const target = grey.length * q;
    let acc = 0;
    for (let v = 0; v < 256; v += 1) {
      acc += hist[v];
      if (acc >= target) return +(v / 255).toFixed(3);
    }
    return 1;
  };
  entries[id] = {
    sx: +sxs.toFixed(4),
    sy: +sys.toFixed(4),
    side: +side.toFixed(4),
    lum,
    lo: cut(0.04),
    hi: cut(0.96),
  };
  n += 1;
}

await writeFile(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      note: '画布圆形头像的取景窗口，归一化到整幅宽高（side 为相对图宽的边长）。由 build-crops.mjs 生成，勿手改；个别图档在 crop-overrides.json 里逐件改判。',
      count: n,
      entries,
    },
    null,
    1,
  ),
  'utf8',
);
console.log(`已生成 ${OUT}（${n} 件，其中人工改判 ${Object.keys(overrides).length} 件）`);
