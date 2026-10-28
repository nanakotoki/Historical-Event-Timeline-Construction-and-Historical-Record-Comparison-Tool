/**
 * 点对点补图：直接按已确认的 Commons 题名取回一张图。
 * ------------------------------------------------------------------
 * fetch-portraits.mjs 是「按候选表逐个探测」的粗网，适合首轮扫荡；
 * 但当题名已由检索确证、只是原图较大易超时时，用本脚本单点取回更稳。
 *
 * 用法：
 *   node scripts/portraits/fetch-one.mjs 'person_li_yuan|李渊|唐高祖立像 軸.png'
 * 可一次传多组（每组用 | 分隔 id / 姓名 / Commons 题名）。
 */
import crypto from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PUB = path.join(ROOT, 'public/data/portraits');
const MANIFEST = path.join(__dirname, 'manifest.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const filePathUrl = (f) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f.replace(/ /g, '_'))}`;
/**
 * 2026-10-28 改道：Special:FilePath 经 weserv 回源已死（10s+ 后 404），
 * 改走「本地算文件名 MD5 → thumb.wikimedia.org 直链 → weserv 包装」。
 * 这条路 2026-10-27 在 fetch-ymq.mjs 上验过，实测 200 / 数秒。
 */
const proxy = (f, w) => {
  const n = f.replace(/ /g, '_');
  const h = crypto.createHash('md5').update(n).digest('hex');
  const thumb = `thumb.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0, 2)}/${n}/${w}px-${n}`;
  return `https://images.weserv.nl/?url=${encodeURIComponent(thumb)}&output=jpg&q=90`;
};

async function grab(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'ChronoGraphChina/1.0' } });
    if (!r.ok) return { ok: false, status: r.status };
    const b = Buffer.from(await r.arrayBuffer());
    if (!(b[0] === 0xff || b[0] === 0x89)) return { ok: false, status: r.status, reason: 'not-image' };
    return { ok: true, b };
  } catch (e) {
    return { ok: false, status: 0, reason: e.name };
  } finally {
    clearTimeout(t);
  }
}

async function withRetry(fn, times = 4) {
  let last;
  for (let i = 0; i < times; i += 1) {
    last = await fn();
    if (last.ok) return last;
    if (last.status === 404) return last;
    await sleep(1500 * (i + 1));
  }
  return last;
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const args = process.argv.slice(2);
if (!args.length) {
  console.error('用法：node fetch-one.mjs "id|姓名|Commons 题名" ...');
  process.exit(1);
}

for (const arg of args) {
  const [id, name, file] = arg.split('|');
  if (!id || !name || !file) {
    console.error(`参数不完整：${arg}`);
    continue;
  }
  console.log(`\n→ ${name} ← ${file}`);
  const thumb = await withRetry(() => grab(proxy(file, 500), 90000));
  if (!thumb.ok) {
    console.log(`  ✗ 失败 status=${thumb.status} ${thumb.reason || ''}`);
    continue;
  }
  /* 原图档一律取 500px：**thumb.wikimedia.org 只备了 500px 这一档**。
     实测同一文件 400/480/600/800/1000/1400 全部 404，只有 500 返回 200。
     所以 `full_*.jpg` 与 `*.jpg` 实际同源同尺寸，档案页的「原尺寸」看到的就是 500px。
     这不是偷懒，是通道的硬限制——如实记在这里，免得下次有人以为改成 1400 就能拿到大图。 */
  const full = await withRetry(() => grab(proxy(file, 500), 120000));
  const fullBuf = full.ok ? full.b : thumb.b;
  await writeFile(path.join(PUB, `${id}.jpg`), thumb.b);
  await writeFile(path.join(PUB, `full_${id}.jpg`), fullBuf);
  manifest.entries[id] = {
    id,
    name,
    file,
    commons: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`,
    thumbBytes: thumb.b.length,
    fullBytes: fullBuf.length,
    fullResolved: full.ok,
  };
  console.log(`  ✓ ${Math.round(thumb.b.length / 1024)} KB / ${Math.round(fullBuf.length / 1024)} KB`);
}
manifest.generatedAt = new Date().toISOString();
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log('\n清单已更新');
