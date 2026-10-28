/**
 * 题名探测工具（第二轮补图用）
 * ------------------------------------------------------------------
 * fetch-portraits.mjs 用的是「体系化题名」，本轮补充的是另外几族在 Commons
 * 上确实存在的成系列图档题名：
 *
 *   ${名} 三才圖會.jpg            —— 万历《三才图会》人物卷单幅裁切
 *   ${名} 繡像東周列國全志.jpg      —— 清刊《绣像东周列国全志》人物绣像
 *   ${名} (歷代君臣圖像).png / ${名}(歷代君臣圖像).png
 *   ${名} 像.jpg / 明人画${名}像轴
 *   ${py} scth.jpg / ${py} Sancai Tuhui.jpg
 *   ${py} (Wan hsiao tang).jpg    —— 乾隆《晚笑堂竹莊画传》
 *
 * 本工具只做「存在性探测 + 落盘缩略图」，不做任何真伪判断。
 * 判定一律由人（或视觉审阅）在 .probe/ 目录下逐张看图后登记进 audit.json。
 *
 * 用法：
 *   node scripts/portraits/probe.mjs                  # 全部未命中人物 × 全部新题名
 *   node scripts/portraits/probe.mjs --only 李斯,蒙恬   # 指定人物
 *   node scripts/portraits/probe.mjs --all            # 含已有真图者，用于复核换图
 */
import crypto from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PEOPLE } from './people.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, '.probe');
const CATALOG = path.join(__dirname, 'catalog.json');

const PROXY = 'https://images.weserv.nl/';
const UA = 'ChronoGraphChina/1.0 (public-domain portrait fetcher)';

const argv = process.argv.slice(2);
const ALL = argv.includes('--all');
const onlyIdx = argv.indexOf('--only');
const ONLY = onlyIdx >= 0 ? argv[onlyIdx + 1].split(',').map((s) => s.trim()).filter(Boolean) : null;
/** 只探测，不落盘（快速筛题名） */
const DRY = argv.includes('--dry-run');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * 取图通道（2026-10-28 改）：**不再走 Special:FilePath。**
 * 该链路经 weserv 回源已劣化到 10s 以上甚至恒 404，`upload.wikimedia.org` 原图亦然。
 * 现改为本地算文件名 MD5、拼 `thumb.wikimedia.org` 的 500px 直链，再经 weserv 包装
 * （实测 200 / 数秒）。thumb 直链本机直连不通，故 weserv 仍是必需的一层。
 * 文件本身小于 500px 时 thumb 会 404，这种情况本就该由原图路径兜底，
 * 但那条路已死——故此处只认 thumb，探不到就记探不到，不猜。
 */
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const fileUrl = (f) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f.replace(/ /g, '_'))}`;
const proxy = (f, w) => {
  const n = f.replace(/ /g, '_');
  const h = md5(n);
  const thumb = `thumb.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0, 2)}/${n}/${w}px-${n}`;
  return `${PROXY}?url=${encodeURIComponent(thumb)}&output=jpg&q=88`;
};

function isImage(buf, ct) {
  if (!/^image\//i.test(ct || '') || !buf || buf.length < 512) return false;
  return (
    (buf[0] === 0xff && buf[1] === 0xd8) ||
    (buf[0] === 0x89 && buf[1] === 0x50) ||
    buf[0] === 0x47 ||
    buf.slice(8, 12).toString('ascii') === 'WEBP'
  );
}

async function grab(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) {
      let body = '';
      try {
        body = await res.text();
      } catch {
        /* noop */
      }
      return { ok: false, status: res.status, body: body.slice(0, 120) };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!isImage(buf, res.headers.get('content-type'))) return { ok: false, status: res.status, reason: 'not-image' };
    return { ok: true, buf };
  } catch (e) {
    return { ok: false, status: 0, reason: e.name === 'AbortError' ? 'timeout' : String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

/** 404 立判；429/503/超时退避重试（weserv 会把上游 429 缓存成 404，须按响应体识别） */
async function fetchWithRetry(url, timeoutMs = 20000, retries = 2) {
  let last = { ok: false, status: 0 };
  for (let i = 0; i <= retries; i += 1) {
    last = await grab(url, timeoutMs);
    if (last.ok) return last;
    const rl = typeof last.body === 'string' && /429|rate.?limit|too many/i.test(last.body);
    if (rl) {
      if (i === retries) return { ...last, status: 429 };
      await sleep(2200 * (i + 1));
      continue;
    }
    if (last.status === 404) return last;
    if (!(last.status === 429 || last.status === 503 || last.status === 0) || i === retries) return last;
    await sleep(1200 * 2 ** i);
  }
  return last;
}

/** 本轮的候选题名族 */
function newCandidates(p) {
  const c = [];
  const push = (f) => f && !c.includes(f) && c.push(f);

  // ① 万历《三才图会》人物卷单幅
  push(`${p.name} 三才圖會.jpg`);
  push(`${p.zht} 三才圖會.jpg`);
  push(`${p.name} 三才图会.jpg`);

  // ② 清刊《绣像东周列国全志》人物绣像（秦、战国人物多出于此）
  push(`${p.name} 繡像東周列國全志.jpg`);
  push(`${p.zht} 繡像東周列國全志.jpg`);
  push(`${p.name} 繡像東周列國志.jpg`);

  // ③ 《历代君臣图像》
  push(`${p.zht} (歷代君臣圖像).png`);
  push(`${p.zht}(歷代君臣圖像).png`);
  push(`${p.name} (歷代君臣圖像).png`);

  // ④ 故宫像轴／裸题名像
  push(`明人画${p.name}像轴.png`);
  push(`清人画${p.name}像轴.png`);
  push(`${p.zht} 像.jpg`);

  // ⑤ 英文系列
  push(`${p.py} scth.jpg`);
  push(`${p.py} Sancai Tuhui.jpg`);
  push(`${p.py} (Wan hsiao tang).jpg`);
  push(`${p.py} (Wan hsiao tang) 2.jpg`);
  push(`${p.py} Wan hsiao tang.jpg`);

  // ⑥ 《晚笑堂竹莊画传》常见裸拼音题名
  push(`${p.py}.jpg`);
  push(`${p.py}.png`);

  return c;
}

async function main() {
  const haveIds = new Set();
  if (existsSync(CATALOG)) {
    try {
      const cat = JSON.parse(await readFile(CATALOG, 'utf8'));
      for (const e of Object.values(cat.entries || {})) haveIds.add(e.id || e);
    } catch {
      /* noop */
    }
  }

  let people = PEOPLE;
  if (ONLY) people = people.filter((p) => ONLY.includes(p.name) || ONLY.includes(p.id));
  else if (!ALL) people = people.filter((p) => !haveIds.has(p.id));

  if (!DRY) await mkdir(OUT, { recursive: true });

  console.log(`\n探测 ${people.length} 位人物 · ${people.reduce((n, p) => n + newCandidates(p).length, 0)} 个题名\n`);

  const hits = [];
  const seen = new Set(); // 同一题名只取一次
  const tasks = [];
  for (const p of people) for (const f of newCandidates(p)) tasks.push({ p, f });

  let cursor = 0;
  const workers = Array.from({ length: 6 }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= tasks.length) return;
      const { p, f } = tasks[i];
      if (seen.has(f)) continue;
      await sleep(50 + Math.random() * 160);
      const r = await fetchWithRetry(proxy(f, 220), 15000, 2);
      seen.add(f);
      if (!r.ok) continue;
      const big = await fetchWithRetry(proxy(f, 900), 30000, 1);
      const buf = big.ok ? big.buf : r.buf;
      if (!DRY) {
        const safe = f.replace(/[\\/:*?"<>|]/g, '_');
        await writeFile(path.join(OUT, `${p.id}__${safe}.jpg`), buf);
      }
      hits.push({
        id: p.id,
        name: p.name,
        file: f,
        bytes: buf.length,
        url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f.replace(/ /g, '_'))}`,
      });
      console.log(`  ✓ ${p.name.padEnd(5, '　')} ← ${f}`);
    }
  });
  await Promise.all(workers);

  if (!DRY) await writeFile(path.join(OUT, 'hits.json'), `${JSON.stringify(hits, null, 2)}\n`, 'utf8');
  console.log(`\n命中 ${hits.length} 个题名，涉及 ${new Set(hits.map((h) => h.name)).size} 人`);
  console.log(`缩略图与清单见 ${path.relative(ROOT, OUT)}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
