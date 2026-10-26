/**
 * 古籍整页扫描抓取器
 * ------------------------------------------------------------------
 * 背景：若干明清人物像册（《歴代君臣圖像》《三才圖會》等）在 Commons 上是
 * 整本 PDF，单个人物并未单独切图上传。这些书由日本国立国会图书馆、早稻田
 * 大学图书馆等机构扫描，属公有领域。要拿到书里某人的像，只能自己把整页
 * 渲染图取回来，再定位、裁切。
 *
 * 通路：upload.wikimedia.org 在本机不可达，但 images.weserv.nl 能取到
 * thumb.wikimedia.org 的 PDF 单页渲染图。
 * 路径形如：
 *   https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/<file>/page<N>-1280px-<file>.jpg
 * 其中 7/71 = 文件名（空格替下划线）的 MD5 前两位。
 *
 * 坑：weserv 会把早期的失败（404）缓存住，且会忽略 Special:FilePath 的
 * page 参数。故此处直接用 thumb 主机 + MD5 路径，并在 URL 上加一次性
 * 查询串绕开缓存。
 *
 * 用法：
 *   node scripts/portraits/book-pages.mjs --book wul1 --from 10 --to 49
 *   node scripts/portraits/book-pages.mjs --list          # 列出已登记书目
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, '.probe/book');

/** 已登记的书目：name 为 Commons 上的确切题名，hash 为其文件名 MD5 前 8 位 */
export const BOOKS = {
  wul1: { name: 'WUL-nu08 01250 歷代君臣圖像 1.pdf', hash: '71f1946e', pages: 49 },
  wul2: { name: 'WUL-nu08 01250 歷代君臣圖像 2.pdf', hash: '', pages: 0 },
  ndl1: { name: 'NDL2544532 歴代君臣圖像 2卷.(1).pdf', hash: '782c0529', pages: 0 },
  ndl2: { name: 'NDL2544533 歴代君臣圖像 2卷.(2).pdf', hash: '', pages: 0 },
};

const argv = process.argv.slice(2);
const getArg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : d;
};

if (argv.includes('--list')) {
  for (const [k, v] of Object.entries(BOOKS)) console.log(k, v.pages ? `${v.pages} 页` : '页数待查', v.name);
  process.exit(0);
}

const tag = getArg('--book', 'wul1');
const book = BOOKS[tag];
if (!book) {
  console.error(`未知书目：${tag}`);
  process.exit(1);
}
const from = Number(getArg('--from', 1));
const to = Number(getArg('--to', book.pages || 40));

const enc = encodeURIComponent(book.name.replace(/ /g, '_'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proxied = (u) => 'https://images.weserv.nl/?url=' + encodeURIComponent(u) + '&output=jpg&q=82';
const pageUrl = (p, n) =>
  `https://thumb.wikimedia.org/wikipedia/commons/thumb/${book.hash[0]}/${book.hash}/${enc}/page${p}-1280px-${enc}.jpg?r=${tag}${p}_${n}`;

async function get(p) {
  for (let n = 0; n < 5; n += 1) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 50000);
    try {
      const r = await fetch(proxied(pageUrl(p, n)), { signal: ctrl.signal, headers: { 'User-Agent': 'ChronoGraphChina/1.0' } });
      clearTimeout(t);
      if (r.ok) {
        const b = Buffer.from(await r.arrayBuffer());
        if (b[0] === 0xff) return b;
      }
    } catch {
      clearTimeout(t);
    }
    await sleep(1200 * (n + 1));
  }
  return null;
}

await mkdir(OUT, { recursive: true });
const pages = [];
for (let p = from; p <= to; p += 1) pages.push(p);

let cursor = 0;
const ok = [];
const fail = [];
async function worker() {
  for (;;) {
    const idx = cursor++;
    if (idx >= pages.length) return;
    const p = pages[idx];
    const buf = await get(p);
    if (buf) {
      await writeFile(path.join(OUT, `${tag}-${String(p).padStart(3, '0')}.jpg`), buf);
      ok.push(p);
      console.log(`  ✓ ${tag} p${p} (${Math.round(buf.length / 1024)} KB)`);
    } else {
      fail.push(p);
      console.log(`  ✗ ${tag} p${p}`);
    }
  }
}
await Promise.all([worker(), worker()]);
console.log(`\n完成 ${ok.length} 页，失败 ${fail.length} 页${fail.length ? '：' + fail.join(',') : ''}`);
