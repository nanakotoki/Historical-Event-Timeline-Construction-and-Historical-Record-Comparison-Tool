/**
 * 重下脚本：build-seed 的差集清理删掉了未过审计的 jpg，此处按已核实的
 * thumb.wikimedia 直链重下 22 人（王守仁 2025 摹本已按红线剔除）。
 * 与 manual-fetch 同格式写 manifest。先落图 → 人工审计 → 重建 catalog → build-seed。
 */
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'public', 'data', 'portraits');
const MANIFEST = path.join(ROOT, 'scripts', 'portraits', 'manifest.json');

/** [id, 姓名, Commons 原始题名, thumb500 直链, full 直链]（hash 路径经 imageinfo 核实 2026-10-27） */
const TARGETS = [
  ['person_yin_zhen', '胤禛', '雍正帝.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/%E9%9B%8D%E6%AD%A3%E5%B8%9D.jpg/500px-%E9%9B%8D%E6%AD%A3%E5%B8%9D.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/%E9%9B%8D%E6%AD%A3%E5%B8%9D.jpg/960px-%E9%9B%8D%E6%AD%A3%E5%B8%9D.jpg'],
  ['person_xuan_ye', '玄烨', 'Kangxi Emperor.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Kangxi_Emperor.jpg/500px-Kangxi_Emperor.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Kangxi_Emperor.jpg/960px-Kangxi_Emperor.jpg'],
  ['person_qi_jiguang', '戚继光', 'Qi Jiguang Portrait.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/68/Qi_Jiguang_Portrait.jpg/500px-Qi_Jiguang_Portrait.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/6/68/Qi_Jiguang_Portrait.jpg'],
  ['person_si_ma_guang', '司马光', 'Sima Guang.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Sima_Guang.jpg/500px-Sima_Guang.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Sima_Guang.jpg/960px-Sima_Guang.jpg'],
  ['person_wang_an_shi', '王安石', 'Wang Anshi.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Wang_Anshi.jpg/500px-Wang_Anshi.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Wang_Anshi.jpg/960px-Wang_Anshi.jpg'],
  ['person_hu_bi_lie', '忽必烈', 'YuanEmperorAlbumKhubilaiPortrait.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1b/YuanEmperorAlbumKhubilaiPortrait.jpg/500px-YuanEmperorAlbumKhubilaiPortrait.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1b/YuanEmperorAlbumKhubilaiPortrait.jpg/960px-YuanEmperorAlbumKhubilaiPortrait.jpg'],
  ['person_wen_tianxiang', '文天祥', 'WenTianxiang.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/WenTianxiang.jpg/500px-WenTianxiang.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/WenTianxiang.jpg/960px-WenTianxiang.jpg'],
  ['person_zhao_ji', '赵佶', 'Emperor Huizong of Song.png',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Emperor_Huizong_of_Song.png/500px-Emperor_Huizong_of_Song.png',
    'https://upload.wikimedia.org/wikipedia/commons/9/90/Emperor_Huizong_of_Song.png'],
  ['person_li_cunxu', '李存勖', '後唐莊宗李存勗.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/8/85/%E5%BE%8C%E5%94%90%E8%8E%8A%E5%AE%97%E6%9D%8E%E5%AD%98%E5%8B%97.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/8/85/%E5%BE%8C%E5%94%90%E8%8E%8A%E5%AE%97%E6%9D%8E%E5%AD%98%E5%8B%97.jpg'],
  ['person_chai_rong', '柴荣', 'Chai Rong (Zhou Shizong).jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Chai_Rong_%28Zhou_Shizong%29.jpg/500px-Chai_Rong_%28Zhou_Shizong%29.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Chai_Rong_%28Zhou_Shizong%29.jpg/960px-Chai_Rong_%28Zhou_Shizong%29.jpg'],
  ['person_zhao_kuangyin', '赵匡胤', 'Song Taizu.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Song_Taizu.jpg/500px-Song_Taizu.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Song_Taizu.jpg/960px-Song_Taizu.jpg'],
  ['person_su_shi', '苏轼', 'Su shi.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Su_shi.jpg/500px-Su_shi.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Su_shi.jpg/960px-Su_shi.jpg'],
  ['person_ouyang_xiu', '欧阳修', 'Ouyang Xiu.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Ouyang_Xiu.jpg/500px-Ouyang_Xiu.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Ouyang_Xiu.jpg/960px-Ouyang_Xiu.jpg'],
  ['person_fan_zhongyan', '范仲淹', 'Fan Zhongyan.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Fan_Zhongyan.jpg/500px-Fan_Zhongyan.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Fan_Zhongyan.jpg/960px-Fan_Zhongyan.jpg'],
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
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Yongle.jpg/500px-Yongle.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Yongle.jpg/960px-Yongle.jpg'],
  ['person_zhang_juzheng', '张居正', 'Zhang Juzheng.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Zhang_Juzheng.jpg/500px-Zhang_Juzheng.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Zhang_Juzheng.jpg/960px-Zhang_Juzheng.jpg'],
  ['person_hong_li', '弘历', 'Portrait of Emperor Qianlong.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Portrait_of_Emperor_Qianlong.jpg/500px-Portrait_of_Emperor_Qianlong.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Portrait_of_Emperor_Qianlong.jpg/960px-Portrait_of_Emperor_Qianlong.jpg'],
  ['person_li_qingzhao', '李清照', '李清照畫像.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/%E6%9D%8E%E6%B8%85%E7%85%A7%E7%95%AB%E5%83%8F.jpg/500px-%E6%9D%8E%E6%B8%85%E7%85%A7%E7%95%AB%E5%83%8F.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/3/3e/%E6%9D%8E%E6%B8%85%E7%85%A7%E7%95%AB%E5%83%8F.jpg'],
  ['person_zhu_wen', '朱温', 'Zhu Wen (Liang Taizu).jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/Zhu_Wen_%28Liang_Taizu%29.jpg/500px-Zhu_Wen_%28Liang_Taizu%29.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/Zhu_Wen_%28Liang_Taizu%29.jpg/960px-Zhu_Wen_%28Liang_Taizu%29.jpg'],
];

const filePageUrl = (f) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f.replace(/ /g, '_'))}`;
const proxied = (url) => `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=92`;

async function fetchImage(url, timeoutMs = 40000, retries = 2) {
  let last = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'HistoricalGraphSeed/1.0' } });
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
    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1500));
  }
  return { ok: false, status: last };
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
manifest.entries = manifest.entries || {};

let hit = 0;
const failed = [];
for (const [id, name, file, thumbUrl, fullUrl] of TARGETS) {
  if (existsSync(path.join(OUT_DIR, `${id}.jpg`)) && manifest.entries[id]) {
    continue;
  }
  const t = await fetchImage(proxied(thumbUrl));
  if (!t.ok) {
    console.log(`✗ ${name} thumb status=${t.status}`);
    failed.push(name);
    continue;
  }
  const f = fullUrl === thumbUrl ? t : await fetchImage(proxied(fullUrl), 50000);
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
console.log(`\n重下 ${hit} / 失败 ${failed.length}${failed.length ? '：' + failed.join('、') : ''}`);
console.log(`manifest 条目总数 ${Object.keys(manifest.entries).length}`);
