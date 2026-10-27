/**
 * 一次性补抓：第三轮后仍有 12 人未命中，但 Commons imageinfo API 已核实其文件
 * 确实存在且拿到了 upload.wikimedia 直链（500px 缩略图，小文件，不走
 * Special:FilePath 的原图回源，绕开 weserv 对大原件的超时）。
 *
 * 用法：node scripts/portraits/manual-fetch.mjs
 *  1. 经 weserv 代理下载 thumb(500px) / full(960px 或原图)
 *  2. 写 public/data/portraits/{id}.jpg 与 full_{id}.jpg
 *  3. 以与 fetch-portraits.mjs 相同的字段合并写 manifest.json
 *
 * 题名与直链均于 2026-10-27 经 imageinfo API 核实（见当次会话记录）。
 */
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'public', 'data', 'portraits');
const MANIFEST = path.join(ROOT, 'scripts', 'portraits', 'manifest.json');
const UA = 'HistoricalGraphSeed/1.0 (static education project; contact: local)';

/** [id, 姓名, Commons 原始题名, thumb 直链, full 直链] */
const TARGETS = [
  ['person_zhao_kuangyin', '赵匡胤', 'Song Taizu.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Song_Taizu.jpg/500px-Song_Taizu.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Song_Taizu.jpg/960px-Song_Taizu.jpg'],
  ['person_su_shi', '苏轼', 'Su shi.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/9/98/Su_shi.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/9/98/Su_shi.jpg'],
  ['person_ouyang_xiu', '欧阳修', 'Ouyang Xiu.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Ouyang_Xiu.jpg/500px-Ouyang_Xiu.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Ouyang_Xiu.jpg/960px-Ouyang_Xiu.jpg'],
  ['person_fan_zhongyan', '范仲淹', 'Fan Zhongyan.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/0/0f/Fan_Zhongyan.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/0/0f/Fan_Zhongyan.jpg'],
  ['person_yue_fei', '岳飞', 'Yue Fei.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/f/f9/Yue_Fei.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/f/f9/Yue_Fei.jpg'],
  ['person_zhu_xi', '朱熹', 'Portraits of Famous Men - Zhu Xi.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Portraits_of_Famous_Men_-_Zhu_Xi.jpg/500px-Portraits_of_Famous_Men_-_Zhu_Xi.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Portraits_of_Famous_Men_-_Zhu_Xi.jpg/960px-Portraits_of_Famous_Men_-_Zhu_Xi.jpg'],
  ['person_zhu_yuanzhang', '朱元璋', '明太祖畫像.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/%E6%98%8E%E5%A4%AA%E7%A5%96%E7%94%BB%E5%83%8F.jpg/500px-%E6%98%8E%E5%A4%AA%E7%A5%96%E7%94%BB%E5%83%8F.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/%E6%98%8E%E5%A4%AA%E7%A5%96%E7%94%BB%E5%83%8F.jpg/960px-%E6%98%8E%E5%A4%AA%E7%A5%96%E7%94%BB%E5%83%8F.jpg'],
  ['person_zhu_di', '朱棣', 'Yongle.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/e/ef/Yongle.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/e/ef/Yongle.jpg'],
  ['person_zhang_juzheng', '张居正', 'Zhang Juzheng.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/6/65/Zhang_Juzheng.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/6/65/Zhang_Juzheng.jpg'],
  ['person_hong_li', '弘历', 'Portrait of Emperor Qianlong.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/0/02/Portrait_of_Emperor_Qianlong.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/0/02/Portrait_of_Emperor_Qianlong.jpg'],
  ['person_wang_shouren', '王守仁', '王守仁.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7a/%E7%8E%8B%E5%AE%88%E4%BB%81.jpg/500px-%E7%8E%8B%E5%AE%88%E4%BB%81.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/7/7a/%E7%8E%8B%E5%AE%88%E4%BB%81.jpg'],
  ['person_zhu_wen', '朱温', 'Zhu Wen (Liang Taizu).jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/Zhu_Wen_%28Liang_Taizu%29.jpg/500px-Zhu_Wen_%28Liang_Taizu%29.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/Zhu_Wen_%28Liang_Taizu%29.jpg/960px-Zhu_Wen_%28Liang_Taizu%29.jpg'],
];

const filePageUrl = (f) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f.replace(/ /g, '_'))}`;
const proxied = (url) => `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=92`;

async function fetchImage(url, timeoutMs = 60000, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
      if (!res.ok) {
        clearTimeout(timer);
        if (res.status === 404) return { ok: false, status: 404 };
        await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      clearTimeout(timer);
      if (buf.length < 512) return { ok: false, status: res.status, reason: 'too-small' };
      return { ok: true, buf };
    } catch {
      clearTimeout(timer);
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    }
  }
  return { ok: false, status: 0 };
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
manifest.entries = manifest.entries || {};
let hit = 0;
const failed = [];

for (const [id, name, file, thumbUrl, fullUrl] of TARGETS) {
  if (existsSync(path.join(OUT_DIR, `${id}.jpg`))) {
    console.log(`↷ ${name} 已有图，跳过`);
    continue;
  }
  const t = await fetchImage(proxied(thumbUrl));
  if (!t.ok) {
    console.log(`✗ ${name} thumb 失败 status=${t.status}`);
    failed.push(name);
    continue;
  }
  const f = fullUrl === thumbUrl ? t : await fetchImage(proxied(fullUrl), 90000);
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
  console.log(`✓ ${name} ← ${file}`);
  hit++;
}

manifest.generatedAt = new Date().toISOString();
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`\n补抓成功 ${hit} 人，失败 ${failed.length} 人${failed.length ? '：' + failed.join('、') : ''}`);
console.log(`manifest 条目总数 ${Object.keys(manifest.entries).length}`);
