/**
 * 长超时复检器（第二轮）
 * ------------------------------------------------------------------
 * 第一轮 fetch-portraits.mjs 用 15 秒超时探测 480px 缩图。问题在于：
 * 部分馆藏像轴原图达 4000×6000 级，weserv 需回源、解码、缩放，15 秒常不够，
 * 于是「超时」被记成了「不存在」。张良的《明人画张良像轴》就是这样漏掉的。
 *
 * 本脚本只复检「像轴 / 〇〇像」这一族题名，把超时放宽到 60 秒并重试，
 * 命中即落盘到 .probe/ 供人眼审阅。判定依旧不自动化。
 *
 * 用法：
 *   node scripts/portraits/retry-axis.mjs               # 全部未过审人物
 *   node scripts/portraits/retry-axis.mjs --only 张良,赵云
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PEOPLE } from './people.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, '.probe');
const CATALOG = path.join(__dirname, 'catalog.json');

const argv = process.argv.slice(2);
const onlyIdx = argv.indexOf('--only');
const ONLY = onlyIdx >= 0 ? argv[onlyIdx + 1].split(',').map((s) => s.trim()) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proxied = (f, w) =>
  'https://images.weserv.nl/?url=' +
  encodeURIComponent(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f.replace(/ /g, '_'))}`) +
  `&w=${w}&output=jpg&q=88`;

async function grab(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'ChronoGraphChina/1.0' } });
    if (!r.ok) return { ok: false, status: r.status };
    const b = Buffer.from(await r.arrayBuffer());
    if (b[0] !== 0xff && b[0] !== 0x89) return { ok: false, status: r.status, reason: 'not-image' };
    return { ok: true, b };
  } catch (e) {
    return { ok: false, status: 0, reason: e.name };
  } finally {
    clearTimeout(t);
  }
}

/** 60 秒 + 两轮重试：把「慢」和「不存在」分开 */
async function slowProbe(f) {
  for (let n = 0; n < 3; n += 1) {
    const r = await grab(proxied(f, 320), 60000);
    if (r.ok) return r;
    if (r.status === 404) return { ok: false, status: 404 };
    await sleep(1500 * (n + 1));
  }
  return { ok: false, status: 0 };
}

function axisCandidates(p) {
  const out = [];
  const push = (f) => f && !out.includes(f) && out.push(f);
  push(`明人画${p.name}像轴.png`);
  push(`清人画${p.name}像轴.png`);
  push(`${p.zht}像.jpg`);
  push(`${p.name}像.jpg`);
  push(`${p.zht}像.png`);
  push(`明人画${p.zht}像轴.png`);
  push(`清人画${p.zht}像轴.png`);
  return out;
}

const haveIds = new Set();
if (existsSync(CATALOG)) {
  try {
    const cat = JSON.parse(await readFile(CATALOG, 'utf8'));
    for (const e of Object.values(cat.entries || {})) haveIds.add(e.id || e);
  } catch {
    /* noop */
  }
}

let people = ONLY ? PEOPLE.filter((p) => ONLY.includes(p.name) || ONLY.includes(p.id)) : PEOPLE.filter((p) => !haveIds.has(p.id));
await mkdir(OUT, { recursive: true });
console.log(`\n复检 ${people.length} 人 × ${people.reduce((n, p) => n + axisCandidates(p).length, 0)} 个题名（单次超时 60s）\n`);

const hits = [];
const tasks = [];
for (const p of people) for (const f of axisCandidates(p)) tasks.push({ p, f });

let cursor = 0;
async function worker() {
  for (;;) {
    const i = cursor++;
    if (i >= tasks.length) return;
    const { p, f } = tasks[i];
    const r = await slowProbe(f);
    if (!r.ok) continue;
    const big = await grab(proxied(f, 1000), 90000);
    const buf = big.ok ? big.b : r.b;
    await writeFile(path.join(OUT, `${p.id}__${f.replace(/[\\/:*?"<>|]/g, '_')}.jpg`), buf);
    hits.push({ id: p.id, name: p.name, file: f, bytes: buf.length });
    console.log(`  ✓ ${p.name.padEnd(5, '　')} ← ${f}`);
  }
}
await Promise.all([worker(), worker(), worker()]);
await writeFile(path.join(OUT, 'hits-axis.json'), `${JSON.stringify(hits, null, 2)}\n`, 'utf8');
console.log(`\n命中 ${hits.length} 个（${new Set(hits.map((h) => h.name)).size} 人）`);
