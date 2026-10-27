/**
 * 轻量重下：weserv 链路差，960px 大图基本下不动；只抓 500px 缩略图
 * （thumb 与 full 同图，质量换可用性），3 路并发，每成功一人立即写 manifest。
 * 已有 {id}.jpg 且 manifest 已登记者跳过。
 */
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'public', 'data', 'portraits');
const MANIFEST = path.join(ROOT, 'scripts', 'portraits', 'manifest.json');

/** [id, 姓名, Commons 原始题名, 500px 直链]（hash 路径经 imageinfo 核实 2026-10-27） */
const TARGETS = [
  ['person_si_ma_guang', '司马光', 'Sima Guang.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Sima_Guang.jpg/500px-Sima_Guang.jpg'],
  ['person_wang_an_shi', '王安石', 'Wang Anshi.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Wang_Anshi.jpg/500px-Wang_Anshi.jpg'],
  ['person_hu_bi_lie', '忽必烈', 'YuanEmperorAlbumKhubilaiPortrait.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1b/YuanEmperorAlbumKhubilaiPortrait.jpg/500px-YuanEmperorAlbumKhubilaiPortrait.jpg'],
  ['person_wen_tianxiang', '文天祥', 'WenTianxiang.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/WenTianxiang.jpg/500px-WenTianxiang.jpg'],
  ['person_zhao_ji', '赵佶', 'Emperor Huizong of Song.png',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Emperor_Huizong_of_Song.png/500px-Emperor_Huizong_of_Song.png'],
  ['person_li_cunxu', '李存勖', '後唐莊宗李存勗.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/8/85/%E5%BE%8C%E5%94%90%E8%8E%8A%E5%AE%97%E6%9D%8E%E5%AD%98%E5%8B%97.jpg'],
  ['person_chai_rong', '柴荣', 'Chai Rong (Zhou Shizong).jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Chai_Rong_%28Zhou_Shizong%29.jpg/500px-Chai_Rong_%28Zhou_Shizong%29.jpg'],
  ['person_zhao_kuangyin', '赵匡胤', 'Song Taizu.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Song_Taizu.jpg/500px-Song_Taizu.jpg'],
  ['person_su_shi', '苏轼', 'Su shi.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Su_shi.jpg/500px-Su_shi.jpg'],
  ['person_ouyang_xiu', '欧阳修', 'Ouyang Xiu.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Ouyang_Xiu.jpg/500px-Ouyang_Xiu.jpg'],
  ['person_fan_zhongyan', '范仲淹', 'Fan Zhongyan.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Fan_Zhongyan.jpg/500px-Fan_Zhongyan.jpg'],
  ['person_yue_fei', '岳飞', 'Yue Fei.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/f/f9/Yue_Fei.jpg'],
  ['person_zhu_xi', '朱熹', 'Portraits of Famous Men - Zhu Xi.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Portraits_of_Famous_Men_-_Zhu_Xi.jpg/500px-Portraits_of_Famous_Men_-_Zhu_Xi.jpg'],
  ['person_zhu_yuanzhang', '朱元璋', '明太祖畫像.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/%E6%98%8E%E5%A4%AA%E7%A5%96%E7%94%BB%E5%83%8F.jpg/500px-%E6%98%8E%E5%A4%AA%E7%A5%96%E7%94%BB%E5%83%8F.jpg'],
  ['person_zhu_di', '朱棣', 'Yongle.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Yongle.jpg/500px-Yongle.jpg'],
  ['person_zhang_juzheng', '张居正', 'Zhang Juzheng.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Zhang_Juzheng.jpg/500px-Zhang_Juzheng.jpg'],
  ['person_hong_li', '弘历', 'Portrait of Emperor Qianlong.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Portrait_of_Emperor_Qianlong.jpg/500px-Portrait_of_Emperor_Qianlong.jpg'],
  ['person_li_qingzhao', '李清照', '李清照畫像.jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/%E6%9D%8E%E6%B8%85%E7%85%A7%E7%95%AB%E5%83%8F.jpg/500px-%E6%9D%8E%E6%B8%85%E7%85%A7%E7%95%AB%E5%83%8F.jpg'],
  ['person_zhu_wen', '朱温', 'Zhu Wen (Liang Taizu).jpg',
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/Zhu_Wen_%28Liang_Taizu%29.jpg/500px-Zhu_Wen_%28Liang_Taizu%29.jpg'],
];

const filePageUrl = (f) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f.replace(/ /g, '_'))}`;
const proxied = (url) => `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&q=92`;

async function fetchImage(url, timeoutMs = 25000, retries = 6) {
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
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 2000));
  }
  return { ok: false, status: last };
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
manifest.entries = manifest.entries || {};

const saveManifest = async () => {
  manifest.generatedAt = new Date().toISOString();
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
};

let cursor = 0;
let hit = 0;
const failed = [];
const remaining = TARGETS.filter(([id]) => !(existsSync(path.join(OUT_DIR, `${id}.jpg`)) && manifest.entries[id]));
console.log(`待抓 ${remaining.length} 人（其余已完成）`);

const workers = Array.from({ length: 3 }, async () => {
  for (;;) {
    const i = cursor++;
    if (i >= remaining.length) return;
    const [id, name, file, thumbUrl] = remaining[i];
    const r = await fetchImage(proxied(thumbUrl));
    if (!r.ok) {
      console.log(`✗ ${name} status=${r.status}`);
      failed.push(name);
      continue;
    }
    await writeFile(path.join(OUT_DIR, `${id}.jpg`), r.buf);
    await writeFile(path.join(OUT_DIR, `full_${id}.jpg`), r.buf);
    manifest.entries[id] = {
      id,
      name,
      file,
      commons: filePageUrl(file),
      thumbBytes: r.buf.length,
      fullBytes: r.buf.length,
      fullResolved: false,
    };
    await saveManifest();
    console.log(`✓ ${name} ← ${file} (${r.buf.length}B)`);
    hit++;
  }
});
await Promise.all(workers);
await saveManifest();
console.log(`\n完成 ${hit} / 失败 ${failed.length}${failed.length ? '：' + failed.join('、') : ''}`);
