/**
 * 第七批扩容画像抓取（元 11 / 明 22 / 清 17）
 * ------------------------------------------------------------------
 * 背景：2026-10-27 晚 weserv 对 Special:FilePath 的回源链路劣化到每次 10 秒以上，
 * 全量候选（50 人 × 28 题 ≈ 1400 探）按 fetch-portraits.mjs 的节奏要跑数小时。
 *
 * 本脚本改走 refetch-lite.mjs 验证过的通道：
 *   本地算文件名 MD5 哈希 → 拼 thumb.wikimedia.org 500px 直链
 *   → 经 images.weserv.nl 包装取回（实测 200 / 5s）。
 * thumb 直链本机直连不通，故必须经 weserv； Special:FilePath 也不再依赖。
 *
 * 纪律与 fetch-portraits 一致：
 *   - 只探 HINTS 里核实的题名 + 少量高价值通用题名，宁缺勿滥；
 *   - 命中只写 manifest.entries，**不写 audit.json**——审计闸门（人工过目）
 *     在下一步，未过目者一律不进 catalog；
 *   - 文件小于 500px 时 thumb 会 404，回落探 upload.wikimedia.org 原图直链。
 *
 * 用法：node scripts/portraits/fetch-ymq.mjs
 */
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PEOPLE } from './people.mjs';
import { HINTS } from './hints.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'public', 'data', 'portraits');
const MANIFEST = path.join(__dirname, 'manifest.json');

const IDS = [
  'person_meng_ge', 'person_xu_lie_wu', 'person_liu_bing_zhong', 'person_xu_heng',
  'person_zhang_hong_fan', 'person_a_he_ma', 'person_wang_bao_bao', 'person_han_lin_er',
  'person_chen_you_liang', 'person_zhang_shi_cheng', 'person_ming_yu_zhen',
  'person_zhu_hou_cong', 'person_yang_shi_qi', 'person_yang_rong', 'person_yang_pu',
  'person_yu_da_you', 'person_hu_zong_xian', 'person_yang_shen', 'person_tang_yin',
  'person_wen_zheng_ming', 'person_xu_wei', 'person_yan_song', 'person_xia_yan',
  'person_gao_gong', 'person_sun_cheng_zong', 'person_xiong_ting_bi',
  'person_lu_xiang_sheng', 'person_qin_liang_yu', 'person_li_ding_guo',
  'person_shi_ke_fa', 'person_huang_zong_xi', 'person_wang_fu_zhi', 'person_gu_yan_wu',
  'person_xiao_zhuang', 'person_zhang_ting_yu', 'person_fu_heng', 'person_fu_kang_an',
  'person_zhao_hui', 'person_yue_zhong_qi', 'person_yi_xin', 'person_dai_zhen',
  'person_gong_zi_zhen', 'person_wei_yuan', 'person_na_lan_xing_de',
  'person_hong_xiu_quan', 'person_yang_xiu_qing', 'person_shi_da_kai',
  'person_li_xiu_cheng', 'person_deng_shi_chang', 'person_ding_ru_chang',
];

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

function thumbUrl(name, width = 500) {
  const n = name.replace(/ /g, '_');
  const h = md5(n);
  return `https://thumb.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(n)}/${width}px-${encodeURIComponent(n)}`;
}

function originalUrl(name) {
  const n = name.replace(/ /g, '_');
  const h = md5(n);
  return `https://upload.wikimedia.org/wikipedia/commons/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(n)}`;
}

const proxied = (url) => `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=92`;
const filePageUrl = (f) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f.replace(/ /g, '_'))}`;

/** 候选题名：HINTS 优先，其后只挂少量高价值通用题名。 */
function candidatesOf(p) {
  const out = [];
  const push = (f) => { if (f && !out.includes(f)) out.push(f); };
  for (const f of HINTS[p.name] || []) push(f);
  push(`${p.zht} (歷代君臣圖像).png`);
  push(`${p.py} scth.jpg`);
  push(`Portraits of Famous Men - ${p.py}.jpg`);
  push(`${p.zht}像.jpg`);
  push(`Portrait of ${p.py}.jpg`);
  push(`${p.zht}.jpg`);
  return out;
}

async function fetchImage(url, timeoutMs = 25000, retries = 3) {
  let last = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'ChronoGraphChina/1.0 (portrait fetch)' } });
      clearTimeout(timer);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length >= 512) return { ok: true, buf };
        last = -1;
      } else last = res.status;
    } catch {
      clearTimeout(timer);
      last = 0;
    }
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
  }
  return { ok: false, status: last };
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
manifest.entries = manifest.entries || {};

let cursor = 0;
const hits = [];
const missed = [];
const TARGETS = IDS
  .map((id) => PEOPLE.find((p) => p.id === id))
  .filter(Boolean)
  .filter((p) => !(existsSync(path.join(OUT_DIR, `${p.id}.jpg`)) && manifest.entries[p.id]));

console.log(`待抓 ${TARGETS.length} 人`);

async function worker() {
  for (;;) {
    const i = cursor++;
    if (i >= TARGETS.length) return;
    const p = TARGETS[i];
    let done = false;
    for (const file of candidatesOf(p)) {
      // 先探 500px 缩略，再探原图（小于 500px 的图 thumb 会 404）
      const r = (await fetchImage(proxied(thumbUrl(file)))) || { ok: false };
      const ok1 = r.ok;
      const r2 = ok1 ? r : await fetchImage(proxied(originalUrl(file)));
      if (!ok1 && !r2.ok) continue;
      const buf = (ok1 ? r : r2).buf;
      await writeFile(path.join(OUT_DIR, `${p.id}.jpg`), buf);
      await writeFile(path.join(OUT_DIR, `full_${p.id}.jpg`), buf);
      manifest.entries[p.id] = {
        id: p.id,
        name: p.name,
        file,
        commons: filePageUrl(file),
        thumbBytes: buf.length,
        fullBytes: buf.length,
        fullResolved: false,
      };
      await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      console.log(`✓ ${p.name} ← ${file} (${buf.length}B)`);
      hits.push(p.name);
      done = true;
      break;
    }
    if (!done) {
      missed.push(p.name);
      console.log(`✗ ${p.name} 无命中`);
    }
  }
}

await Promise.all(Array.from({ length: 5 }, worker));
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`\n命中 ${hits.length} / 未命中 ${missed.length}`);
if (missed.length) console.log('未命中：' + missed.join('、'));
