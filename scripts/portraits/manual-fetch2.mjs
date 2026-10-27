/**
 * 一次性补抓（第二轮）：对 manual-fetch.mjs 首轮后仍缺的人，全部改用
 * thumb.wikimedia.org 的 500px 缩略直链（实测 upload.wikimedia 直链经 weserv
 * 会被 CDN 间歇 404，而 thumb 路径稳定）。同时补登记「图已在盘但 manifest
 * 未写入」的条目（首轮脚本被超时截断在 manifest 写出之前）。
 *
 * 用法：node scripts/portraits/manual-fetch2.mjs
 */
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'public', 'data', 'portraits');
const MANIFEST = path.join(ROOT, 'scripts', 'portraits', 'manifest.json');
const UA = 'HistoricalGraphSeed/1.0 (static education project; contact: local)';

/** [id, 姓名, Commons 原始题名, thumb 直链, full 直链]（hash 路径均经 imageinfo 核实） */
const TARGETS = [
  ['person_zhao_kuangyin', '赵匡胤', 'Song Taizu.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Song_Taizu.jpg/500px-Song_Taizu.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Song_Taizu.jpg/960px-Song_Taizu.jpg'],
  ['person_su_shi', '苏轼', 'Su shi.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Su_shi.jpg/500px-Su_shi.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Su_shi.jpg/960px-Su_shi.jpg'],
  ['person_fan_zhongyan', '范仲淹', 'Fan Zhongyan.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Fan_Zhongyan.jpg/500px-Fan_Zhongyan.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Fan_Zhongyan.jpg/960px-Fan_Zhongyan.jpg'],
  ['person_zhu_di', '朱棣', 'Yongle.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Yongle.jpg/500px-Yongle.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Yongle.jpg/960px-Yongle.jpg'],
  ['person_zhang_juzheng', '张居正', 'Zhang Juzheng.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Zhang_Juzheng.jpg/500px-Zhang_Juzheng.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Zhang_Juzheng.jpg/960px-Zhang_Juzheng.jpg'],
  ['person_hong_li', '弘历', 'Portrait of Emperor Qianlong.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Portrait_of_Emperor_Qianlong.jpg/500px-Portrait_of_Emperor_Qianlong.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Portrait_of_Emperor_Qianlong.jpg/960px-Portrait_of_Emperor_Qianlong.jpg'],
];

/** 首轮已落盘但 manifest 未登记的（脚本被截断在写出之前） */
const ONSITE_PENDING = [
  ['person_ouyang_xiu', '欧阳修', 'Ouyang Xiu.jpg'],
  ['person_yue_fei', '岳飞', 'Yue Fei.jpg'],
  ['person_zhu_xi', '朱熹', 'Portraits of Famous Men - Zhu Xi.jpg'],
  ['person_zhu_yuanzhang', '朱元璋', '明太祖畫像.jpg'],
  ['person_wang_shouren', '王守仁', '王守仁.jpg'],
];

const filePageUrl = (f) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f.replace(/ /g, '_'))}`;
const proxied = (url) => `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=92`;

async function fetchImage(url, timeoutMs = 45000, retries = 4) {
  let last = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
      clearTimeout(timer);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length >= 512) return { ok: true, buf };
        last = -1;
      } else {
        last = res.status;
        if (res.status === 404 && attempt >= 1) return { ok: false, status: 404 }; // thumb 路径 404 是真没有
      }
    } catch {
      clearTimeout(timer);
      last = 0;
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt + Math.random() * 800));
  }
  return { ok: false, status: last };
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
manifest.entries = manifest.entries || {};

let hit = 0;
const failed = [];

// ① 补登记已在盘的
for (const [id, name, file] of ONSITE_PENDING) {
  if (manifest.entries[id]) continue;
  const thumbPath = path.join(OUT_DIR, `${id}.jpg`);
  const fullPath = path.join(OUT_DIR, `full_${id}.jpg`);
  if (!existsSync(thumbPath)) continue;
  manifest.entries[id] = {
    id,
    name,
    file,
    commons: filePageUrl(file),
    thumbBytes: statSync(thumbPath).size,
    fullBytes: existsSync(fullPath) ? statSync(fullPath).size : statSync(thumbPath).size,
    fullResolved: existsSync(fullPath),
  };
  console.log(`⊕ ${name} 已在盘，补登记`);
}

// ② 下载剩余的
for (const [id, name, file, thumbUrl, fullUrl] of TARGETS) {
  if (manifest.entries[id] && existsSync(path.join(OUT_DIR, `${id}.jpg`))) {
    console.log(`↷ ${name} 已登记，跳过`);
    continue;
  }
  const t = await fetchImage(proxied(thumbUrl));
  if (!t.ok) {
    console.log(`✗ ${name} thumb 失败 status=${t.status}`);
    failed.push(name);
    continue;
  }
  const f = fullUrl === thumbUrl ? t : await fetchImage(proxied(fullUrl), 60000);
  const full = f.ok ? f.buf : t.buf;
  await writeFile(path.join(OUT_DIR, `${id}.jpg`), t.buf);
  await writeFile(path.join(OUT_DIR, `full_${id}.jpg`), full);
  manifest.entries[id] = {
    id,
    name,
    file,
    commons: filePageUrl(file),
    thumbBytes: t.buf.length,
    fullBytes: full.length,
    fullResolved: f.ok,
  };
  console.log(`✓ ${name} ← ${file} (${t.buf.length}B)`);
  hit++;
}

manifest.generatedAt = new Date().toISOString();
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`\n新下载 ${hit} 人，失败 ${failed.length} 人${failed.length ? '：' + failed.join('、') : ''}`);
console.log(`manifest 条目总数 ${Object.keys(manifest.entries).length}`);
