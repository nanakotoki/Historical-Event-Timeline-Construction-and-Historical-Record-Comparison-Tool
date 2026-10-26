#!/usr/bin/env node
/**
 * 按「册页页题」枚举探测传世图档（Book-page title prober）
 * ------------------------------------------------------------------
 * 背景：本机 `commons.wikimedia.org/w/api.php` 等检索接口全部不可达（详见 README
 * 「第三轮：这批人为什么没配上图」），唯一可用的是 `images.weserv.nl` 图片回源代理。
 * 该代理只能取**已知文件名**的图，不能检索，所以只能「猜页题」。
 *
 * 猜得有依据的地方在于：本站已收的图档里有两种**成套册页**，同册页题是规律的——
 *   ① 費城藝術博物館《Portraits of Famous Men》冊
 *      页题 `Portraits of Famous Men - <西名>.jpg`
 *   ② 臺北故宮《歷代聖賢半身像》冊（中畫000328）
 *      页题 `歷代聖賢半身像 冊 <中文名> (<拼音>).png`
 * 同册之内，页题的构造方式一致，故可按规律枚举；这不是猜「某人有没有画像」，
 * 而是猜「这本书里有没有他的那一页」。
 *
 * 判定纪律：命中（HTTP 200 且图片体积合理）只说明**该文件存在**，
 * 不说明画的就是此人。必须落盘缩略图后逐张人眼比对，比定通过才可写入
 * `scripts/portraits/catalog.json`——否则就是「按题名相似就当作传世画像」，
 * 正是本站 zero-hallucination 条款要防的错误（`Fan Zeng.jpg` 是现画家范曾，即前车之鉴）。
 *
 * 用法：
 *   node scripts/portraits/probe-page-titles.mjs               # 跑内置候选集
 *   node scripts/portraits/probe-page-titles.mjs --out dir     # 指定缩略图落盘目录
 *
 * 本轮（第二批扩容后）实测：102 个候选页题，命中 0——两册均未收录这批人物。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PROXY = 'https://images.weserv.nl/';
const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? d : argv[i + 1] ?? d;
};
const OUT_DIR = path.resolve(flag('out', 'scripts/portraits/probed'));
const CONCURRENCY = 10;
const TIMEOUT_MS = 12000;

/** 费城册：`Portraits of Famous Men - <西名>.jpg` —— 同册可能混用威妥玛拼音 */
const PHILADELPHIA = [
  ['李斯', ['Li Si', 'Li Ssu']],
  ['霍去病', ['Huo Qubing', "Huo Ch'ü-ping", 'Huo Chu-ping']],
  ['卫青', ['Wei Qing', "Wei Ch'ing"]],
  ['武则天', ['Wu Zetian', "Wu Tse-t'ien", 'Wu Tse-tien']],
  ['陈胜', ['Chen Sheng', "Ch'en Sheng"]],
  ['安禄山', ['An Lushan', 'An Lu-shan']],
  ['吕雉', ['Lü Zhi', 'Lu Zhi', 'Lü Chih']],
  ['长孙氏', ['Zhangsun', 'Zhang Sun', 'Chang-sun']],
  ['独孤伽罗', ['Dugu Qieluo']],
  ['吕不韦', ['Lü Buwei', 'Lu Buwei']],
  ['张骞', ['Zhang Qian', 'Chang Chien']],
  ['苏武', ['Su Wu']],
  ['董仲舒', ['Dong Zhongshu', 'Tung Chung-shu']],
  ['贾谊', ['Jia Yi', 'Chia Yi']],
  ['周亚夫', ['Zhou Yafu', 'Chou Ya-fu']],
  ['霍光', ['Huo Guang', 'Huo Kuang']],
  ['司马相如', ['Sima Xiangru', 'Ssu-ma Hsiang-ju']],
  ['杨素', ['Yang Su']],
  ['玄奘', ['Xuanzang', 'Hsuan-tsang']],
  ['韩愈', ['Han Yu']],
];

/** 臺北故宮冊：`歷代聖賢半身像 冊 <中文名> (<拼音>).png` */
const TAIPEI = PHILADELPHIA.map(([cn, alts]) => [cn, alts[0]]);

const fileUrl = (f) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f.replace(/ /g, '_'))}`;
const proxied = (f) => `${PROXY}?url=${encodeURIComponent(fileUrl(f))}&w=420&output=jpg&q=85`;

const jobs = [];
for (const [name, alts] of PHILADELPHIA) {
  for (const a of alts) jobs.push({ name, file: `Portraits of Famous Men - ${a}.jpg` });
  for (const a of alts) jobs.push({ name, file: `Portraits of Famous Men - ${a}.png` });
}
for (const [cn, py] of TAIPEI) jobs.push({ name: cn, file: `歷代聖賢半身像 冊 ${cn} (${py}).png` });

await mkdir(OUT_DIR, { recursive: true });
const hits = [];
let cursor = 0;

async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    try {
      const res = await fetch(proxied(job.file), { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status !== 200) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 4000) continue; // 代理的错误占位图
      const local = path.join(OUT_DIR, `${job.name}-${job.file.replace(/[^\w.\u4e00-\u9fa5]/g, '_')}`);
      await writeFile(local, buf);
      hits.push({ ...job, bytes: buf.length, local });
      console.log(`  HIT ${job.name}\t${job.file}\t${buf.length}B`);
    } catch {
      /* 超时与 404 同视作「取不到」，不区分：两者都不可用 */
    }
  }
}

console.log(`◈ 按册页页题枚举：${jobs.length} 个候选`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`\n◈ 命中 ${hits.length} 个（仅代表文件存在，须人眼比定后方可入 catalog）`);
console.log(`  缩略图目录 ${OUT_DIR}`);
if (hits.length === 0) {
  console.log('  零命中 → 两册未收录这批人物。此处不降级为「猜个像的人顶上」。');
}
await writeFile(path.join(OUT_DIR, 'hits.json'), JSON.stringify(hits, null, 2));
