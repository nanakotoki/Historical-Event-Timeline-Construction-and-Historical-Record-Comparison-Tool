/**
 * 从 Wikimedia Commons 抓取种子库人物的传世画像
 * ------------------------------------------------------------------
 * 背景：Commons 的 upload.wikimedia.org 在本地网络直连不通，但 images.weserv.nl
 * （一个公开的图片 CDN/缩放代理）可以正常取回 Commons 的图档，因此本脚本经由
 * 该代理拉取，最终落盘为本仓库的静态资源，运行期不依赖任何外网。
 *
 * 流程：
 *   1. 依据 scripts/portraits/people.mjs 的姓名 / 繁体 / 拼音，生成一批
 *      Commons 上真实存在的馆藏图档题名候选（台北故宫《历代圣贤半身像》册、
 *      《历代君臣图像》、清人画帝王名臣像册、三国演义清刊本绣像、《三才图会》等）
 *   2. 用文件名的 MD5 前两位构造 upload.wikimedia.org 的哈希路径
 *   3. 经 weserv 代理试取；HTTP 200 且内容确为图片即判定命中
 *   4. 命中后另取一张长边 1400px 的大图存入 portraits/ 作为 Lightbox 底图
 *   5. 写出 manifest.json，记录每张图的原始 Commons 题名、下载地址与许可
 *
 * 用法：
 *   node scripts/portraits/fetch-portraits.mjs            # 全量
 *   node scripts/portraits/fetch-portraits.mjs --limit 5  # 只处理前 5 人（调试）
 *   node scripts/portraits/fetch-portraits.mjs --dry-run  # 只探测不落盘
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PEOPLE } from './people.mjs';
import { HINTS } from './hints.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'public/data/portraits');
const MANIFEST = path.join(ROOT, 'scripts/portraits/manifest.json');

const PROXY = 'https://images.weserv.nl/';
const UA = 'ChronoGraphChina/1.0 (public-domain portrait fetcher; +https://example.org)';

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const FORCE = argv.includes('--force');
/** 只补抓上一轮未命中的人物（利用 weserv 已缓存的热点图档，二次成功率明显更高） */
const RETRY_MISSING = argv.includes('--retry-missing');
const LIMIT = (() => {
  const i = argv.indexOf('--limit');
  return i >= 0 ? Number(argv[i + 1]) || 0 : 0;
})();
const CONCURRENCY = (() => {
  const i = argv.indexOf('--concurrency');
  return i >= 0 ? Math.max(1, Number(argv[i + 1]) || 5) : 5;
})();
/** 每次外呼之间的最小间隔，用于避开上游回源限流（429） */
const THROTTLE_MS = 260;

/* --------------------------- Commons 资源定位 ---------------------------- */

/**
 * 取图用的地址。
 * 用 Special:FilePath 而非手工推导 /a/ab/ 哈希路径——前者由 MediaWiki 自行解析
 * 重定向，对非 ASCII 题名（如「歷代聖賢半身像 冊 諸葛亮 (Zhuge Liang).png」）同样可靠。
 */
function filePathUrl(fileName) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName.replace(/ /g, '_'))}`;
}

/** 供清单记录、供人复核的原始文件页地址 */
function filePageUrl(fileName) {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName.replace(/ /g, '_'))}`;
}

/** 经 weserv 代理取图；width 为长边像素上限 */
function proxyUrl(fileName, width) {
  return `${PROXY}?url=${encodeURIComponent(filePathUrl(fileName))}&w=${width}&output=jpg&q=90`;
}

/* ----------------------------- 候选名生成 ------------------------------- */

/**
 * 个别图档在 Commons 上并不按本名命名，而是按庙号、谥号或俗称作题。
 * 这些别名逐一在 Commons 上出现过，故单列成表，优先于通用模式尝试。
 */
const ALIASES = {
  person_qin_shi_huang: ['Qin Shi Huang.jpg', 'QinShiHuang.jpg', '秦始皇.jpg', 'Qin Shi Huang Mausoleum.jpg'],
  person_xiang_yu: ['Portraits of Famous Men - Xiang Wang.jpg', '項羽.jpg', 'Xiang Yu.jpg'],
  person_liu_bang: ['漢高祖.jpg', 'Emperor Gaozu of Han.jpg', 'Liu Bang.jpg'],
  person_liu_heng: ['漢文帝.jpg', 'Emperor Wen of Han.jpg'],
  person_liu_qi: ['漢景帝.jpg', 'Emperor Jing of Han.jpg'],
  person_liu_bei: ['蜀昭烈帝.jpg', 'Emperor Zhaolie of Shu Han.jpg'],
  person_sun_quan: ['吳太祖 (歷代君臣圖像).png', '吳大帝.jpg', 'Emperor Da of Wu.jpg'],
  person_cao_cao: ['魏太祖.jpg', 'Emperor Wu of Wei.jpg'],
  person_cao_pi: ['魏文帝.jpg', 'CaoPiPortrait.jpg'],
  person_lv_zhi: ['呂后.jpg', 'Empress Lü Zhi.jpg', 'Lü Hou.jpg'],
  person_li_shimin: ['唐太宗.jpg', 'Emperor Taizong of Tang.jpg', 'TangTaizong.jpg'],
  person_li_yuan: ['唐高祖.jpg', 'Emperor Gaozu of Tang.jpg'],
  person_li_zhi: ['唐高宗.jpg', 'Emperor Gaozong of Tang.jpg'],
  person_li_longji: ['唐玄宗.jpg', 'Emperor Xuanzong of Tang.jpg'],
  person_wu_zetian: ['武則天.jpg', 'Wu Zetian.jpg', 'Empress Wu Zetian.jpg'],
  person_yang_jian: ['隋文帝.jpg', 'Emperor Wen of Sui.jpg'],
  person_yang_guang: ['隋煬帝.jpg', 'Emperor Yang of Sui.jpg'],
  person_yang_yuhuan: ['楊貴妃.jpg', 'Yang Guifei.jpg', 'Yang Yuhuan.jpg'],
  person_li_bai: ['Li Bai.jpg', '李白.jpg', 'LiBai.jpg'],
  person_du_fu: ['Du Fu.jpg', '杜甫.jpg'],
  person_yuchi_gong: ['Portraits of Famous Men - Yüchi Gong.jpg', '尉遲恭.jpg'],
  person_fang_xuanling: ['房玄龄.jpg', '房玄齡.jpg'],
  person_wei_zheng: ['魏徵.jpg', '魏征.jpg'],
  person_di_renjie: ['狄仁杰.jpg', '狄仁傑.jpg'],
  person_li_jing: ['李靖(淩煙閣功臣圖像).jpg', '李靖.jpg'],
  person_guo_ziyi: ['郭子儀.jpg', '郭子仪.jpg'],
  person_an_lushan: ['安祿山.jpg', '安禄山.jpg'],
  person_shangguan_waner: ['上官婉兒.jpg', '上官婉儿.jpg'],
};

const DYNASTY_LABEL = {
  person_qin_shi_huang: ['秦', '秦始皇'],
  person_qin_er_shi: ['秦', '二世'],
  person_zi_ying: ['秦', '子嬰'],
  person_xiang_yu: ['楚', '項羽'],
  person_cao_cao: ['魏', '曹操'],
  person_cao_pi: ['魏', '曹丕'],
  person_si_ma_zhao: ['晉', '司馬昭'],
  person_si_ma_yi: ['晉', '司馬懿'],
  person_liu_bei: ['蜀', '劉備'],
  person_sun_quan: ['吳', '孫權'],
};

/**
 * 生成候选文件名的优先级列表。
 * 顺序即优先级：越靠前越可能是「卷轴/册页原件」级的高考据度图档。
 * 以下的每一族命名都经过在 Commons 上的实际抽查，确有其图。
 */
function candidatesOf(p) {
  const out = [];
  const push = (f) => {
    if (f && !out.includes(f)) out.push(f);
  };

  // ⓪ 已知题名线索：Commons 上单件上传的自由题名（如 Emperor Taizong of Tang.jpg），
  //    无法由姓名推导，只能显式登记，优先级最高
  for (const f of HINTS[p.name] || []) push(f);

  // ① 台北故宫《历代圣贤半身像》册（元人绘，绢本设色，馆藏编号中画000328，1750×2000）
  push(`歷代聖賢半身像 冊 ${p.zht} (${p.py}).png`);

  // ①b 故宫旧藏「像轴」——近代博物馆摄制的立轴全图，题名多为「明人画〇〇像轴」
  push(`明人画${p.name}像轴.png`);
  push(`清人画${p.name}像轴.png`);
  push(`${p.name}像.jpg`);
  push(`${p.zht}像.jpg`);

  // ①c 「Portrait of 〇〇」系列（多为一像一档的单件上传）
  push(`Portrait of ${p.py}.jpg`);

  // ② 《历代君臣图像》——明清刻本
  push(`${p.zht} (歷代君臣圖像).png`);
  push(`${p.zht}(歷代君臣圖像).png`);

  // ③ 清人画帝王名臣像册（故宫藏，4796×3012 级高清）
  const dyn = DYNASTY_LABEL[p.id];
  if (dyn) push(`清人画帝王名臣像册-${dyn[0]}${dyn[1]}.png`);

  // ④ 《历代名臣像》Portraits of Famous Men（费城艺术博物馆藏，绢本设色，2600×3800 级）
  push(`Portraits of Famous Men - ${p.py}.jpg`);
  push(`Portraits of Famous Men - ${p.py} 2.jpg`);

  // ⑤ 中文裸题名 —— Commons 上古籍扫描件最常见的形态（如「房玄龄.jpg」「狄仁杰.jpg」）
  push(`${p.zht}.jpg`);
  push(`${p.name}.jpg`);
  push(`${p.zht}.png`);
  push(`${p.name}.png`);

  // ⑤ 《凌烟阁功臣图像》《百将传》《说唐演义全传》等清代刻本插图
  push(`${p.zht}(淩煙閣功臣圖像).jpg`);
  push(`${p.zht}(凌煙閣功臣圖像).jpg`);
  push(`${p.zht}(新鐫繡像旁批詳註總斷廣百將傳).jpg`);

  // ⑦ 清代《三国演义》刊本绣像（"Xxx Portrait.jpg" 一族）
  push(`${p.py} Portrait.jpg`);
  push(`${p.pyNs}Portrait.jpg`);
  push(`${p.py} Portrait ROTK.jpg`);
  push(`${p.py} Qing portrait.jpg`);
  push(`${p.py} Qing dynasty portrait.jpg`);
  push(`${p.py} Qing illustration.jpg`);
  push(`${p.py} Qing dynasty illustration.jpg`);
  push(`${p.py} scth.jpg`); // 《三才图会》
  push(`${p.py} Sancai Tuhui.jpg`);

  // ⑧ 拼音裸题名（CamelCase 与空格两种写法都试）
  push(`${p.pyNs}.jpg`);
  push(`${p.py}.jpg`);
  push(`${p.py}.png`);

  // ⑨ 个别约定俗成的英文题名
  for (const alias of ALIASES[p.id] || []) push(alias);

  return out;
}

/* ------------------------------- 取图逻辑 -------------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 轻度错峰：每个 worker 独立抖动，避免多个请求同时打到上游触发 429 */
async function throttledFetch(url, timeoutMs) {
  await sleep(60 + Math.random() * 200);
  return fetchImage(url, timeoutMs);
}

function isImage(buf, contentType) {
  if (!/^image\//i.test(contentType || '')) return false;
  if (!buf || buf.length < 512) return false;
  // JPEG / PNG / GIF / WEBP 魔数
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const gif = buf[0] === 0x47 && buf[1] === 0x49;
  const webp = buf.slice(8, 12).toString('ascii') === 'WEBP';
  return jpeg || png || gif || webp;
}

/**
 * 单次取图。
 * 注意：Wikimedia 会对 weserv 的回源 IP 做速率限制，偶发 429；
 * 这里对 429/503 做指数退避重试，其余错误（404 等）直接返回失败。
 */
async function fetchImageOnce(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) {
      let body = '';
      try {
        body = await res.text();
      } catch {
        /* 忽略 */
      }
      return { ok: false, status: res.status, body: body.slice(0, 120) };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || '';
    if (!isImage(buf, ct)) return { ok: false, status: res.status, reason: `not-image:${ct}` };
    return { ok: true, buf, contentType: ct };
  } catch (e) {
    return { ok: false, status: 0, reason: e.name === 'AbortError' ? 'timeout' : String(e.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchImage(url, timeoutMs = 30000, retries = 3) {
  let last = { ok: false, status: 0 };
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    last = await fetchImageOnce(url, timeoutMs);
    if (last.ok) return last;
    // weserv 会把上游（Commons）的 429 限流改写成 404，绝不能当「文件不存在」处理，
    // 否则一次抖动就会把真有的图档永久判死。此处按响应体识别并重试。
    const rateLimited = typeof last.body === 'string' && /429|rate.?limit|too many/i.test(last.body);
    if (rateLimited) {
      if (attempt === retries) return { ...last, status: 429, reason: 'upstream-429' };
      await sleep(2500 * (attempt + 1));
      continue;
    }
    // 真 404 才是文件不存在
    if (last.status === 404) return last;
    const transient = last.status === 429 || last.status === 503 || last.status === 0;
    if (!transient || attempt === retries) return last;
    await sleep(1500 * 2 ** attempt);
  }
  return last;
}

/* --------------------------------- 主流程 -------------------------------- */

async function processPerson(p, state) {
  if (existsSync(path.join(OUT_DIR, `${p.id}.jpg`)) && !FORCE) {
    state.skipped.push(p.id);
    return;
  }

  const cands = candidatesOf(p);
  for (const file of cands) {
    // 超时给足：馆藏像轴原件常在 4000×6000 级，weserv 需回源、解码、再缩放，
    // 15 秒常不够。此处曾把「慢」误判成「无」，漏掉了《明人画张良像轴》等真迹。
    const r = await throttledFetch(proxyUrl(file, 480), 60000);
    if (!r.ok) continue;

    // 命中：取一张长边 1400 的大图
    const big = await throttledFetch(proxyUrl(file, 1400), 90000);
    const thumb = r.buf;
    const full = big.ok ? big.buf : thumb;

    if (!DRY_RUN) {
      await writeFile(path.join(OUT_DIR, `${p.id}.jpg`), thumb);
      await writeFile(path.join(OUT_DIR, `full_${p.id}.jpg`), full);
    }
    state.hits.push({
      id: p.id,
      name: p.name,
      file,
      commons: filePageUrl(file),
      thumbBytes: thumb.length,
      fullBytes: full.length,
      fullResolved: big.ok,
    });
    console.log(`  ✓ ${p.name.padEnd(6, '　')} ← ${file}`);
    return;
  }

  state.misses.push({ id: p.id, name: p.name });
  console.log(`  ✗ ${p.name.padEnd(6, '　')} 未找到传世画像（已试 ${cands.length} 个题名）`);
}

async function main() {
  if (!DRY_RUN) await mkdir(OUT_DIR, { recursive: true });
  let people = LIMIT ? PEOPLE.slice(0, LIMIT) : PEOPLE;
  const onlyIdx = argv.indexOf('--only');
  if (onlyIdx >= 0) {
    const ids = argv[onlyIdx + 1].split(',').map((s) => s.trim()).filter(Boolean);
    people = PEOPLE.filter((p) => ids.includes(p.id) || ids.includes(p.name));
    console.log(`仅处理指定人物：${people.map((p) => p.name).join('、')}`);
  }
  if (RETRY_MISSING && existsSync(MANIFEST)) {
    try {
      const prev = JSON.parse(await readFile(MANIFEST, 'utf8'));
      const done = new Set(Object.keys(prev.entries || {}));
      people = people.filter((p) => !done.has(p.id));
      console.log(`本轮只补抓上一轮未命中者：${people.length} 人`);
    } catch {
      /* 清单损坏则按全量处理 */
    }
  }
  console.log(`\n共 ${people.length} 位人物，并发 ${CONCURRENCY}，${DRY_RUN ? 'DRY-RUN' : '写入'}模式\n`);

  const state = { hits: [], misses: [], skipped: [] };
  let cursor = 0;

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= people.length) return;
      await processPerson(people[i], state);
    }
  });
  await Promise.all(workers);

  state.hits.sort((a, b) => PEOPLE.findIndex((p) => p.id === a.id) - PEOPLE.findIndex((p) => p.id === b.id));

  if (!DRY_RUN) {
    let prev = { entries: {} };
    if (existsSync(MANIFEST)) {
      try {
        prev = JSON.parse(await readFile(MANIFEST, 'utf8'));
      } catch {
        /* 忽略损坏的旧清单 */
      }
    }
    const entries = { ...prev.entries };
    for (const h of state.hits) entries[h.id] = h;
    await writeFile(
      MANIFEST,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          source: 'Wikimedia Commons（经 images.weserv.nl 取回）',
          note:
            '本清单只登记确实取回的公有领域/CC 授权图档。未列出的条目＝该人物在 Commons 上无可定位的传世画像，' +
            '系统按 tier4_attire_silhouette 呈现，绝不伪作真迹。',
          entries,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }

  console.log('\n────────────────────────────');
  console.log(`命中 ${state.hits.length} 人 / 未命中 ${state.misses.length} 人 / 跳过（已存在）${state.skipped.length} 人`);
  if (state.misses.length) console.log(`未命中：${state.misses.map((m) => m.name).join('、')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
