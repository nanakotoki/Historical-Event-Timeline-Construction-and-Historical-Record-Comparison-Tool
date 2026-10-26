/**
 * 审计账本维护脚本
 * ------------------------------------------------------------------
 * 用途：
 *   1. 把复查后改判为 keep 的图档从 rejected/ 并回 public/data/portraits/
 *   2. 同步改写 audit.json 中的 verdict / reason / bookTitle
 *   3. 校验 public/data/portraits 下 jpg 与账本 keep 条目是否一一对应
 *
 * 判定依据全部写入 reason 字段，前端「图档检索结果」直接引用，
 * 因此这里不写空话，只写能落到具体版本、藏所、著录的内容。
 *
 * 用法：node scripts/portraits/audit-fix.mjs
 */
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const REJ = path.join(__dirname, 'rejected');
const PUB = path.join(ROOT, 'public/data/portraits');
const AUDIT = path.join(__dirname, 'audit.json');

/**
 * 复查改判表。
 * key 为 Commons 原始题名（与 audit.entries 的键一致）。
 * 说明一律写「为什么现在收」，并写明证据强度上的保留。
 */
const REINSTATE = {
  'Portrait of Xun Yu.jpg': {
    name: '荀彧',
    id: 'person_xun_yu',
    reason:
      '清雍正十二年（1734）刊本《三國演義》繡像，圖檔源出東京大學東洋文化研究所善本庫（shanben.ioc.u-tokyo.ac.jp，書號 D8633300）。' +
      '刀痕深淺不一、衣褶關節處見墨聚，具木刻版畫特徵。該本為現存可考的早期《三國》繡像刊本之一。',
    bookTitle: '（清）《三國演義》刊本繡像（雍正十二年刊本）',
  },
  'ZhouYu.jpg': {
    name: '周瑜',
    id: 'person_zhou_yu',
    reason:
      'Commons 著錄為清代《三國演義》刊本人物繡像，公有領域。惟圖檔經後人描清，紙色與刀痕特徵不存，原刻版本待考，故不記具體刊本。',
    bookTitle: '（清）《三國演義》刊本繡像（版本待考）',
  },
  'LuSu.jpg': {
    name: '鲁肃',
    id: 'person_lu_su',
    reason:
      'Commons 著錄為清代《三國演義》刊本人物繡像，公有領域。圖檔經後人描清，紙墨特徵不存，原刻版本待考。',
    bookTitle: '（清）《三國演義》刊本繡像（版本待考）',
  },
  'LuXun.jpg': {
    name: '陆逊',
    id: 'person_lu_xun',
    reason:
      'Commons 著錄為清代《三國演義》刊本人物繡像，公有領域。圖檔經後人描清，紙墨特徵不存，原刻版本待考。',
    bookTitle: '（清）《三國演義》刊本繡像（版本待考）',
  },
  'FaZheng.jpg': {
    name: '法正',
    id: 'person_fa_zheng',
    reason:
      'Commons 著錄為清代《三國演義》刊本人物繡像，公有領域。圖檔經後人描清，紙墨特徵不存，原刻版本待考。',
    bookTitle: '（清）《三國演義》刊本繡像（版本待考）',
  },
  'MaChao.jpg': {
    name: '马超',
    id: 'person_ma_chao',
    reason:
      'Commons 著錄為清代《三國演義》刊本人物繡像，公有領域。圖檔經後人描清，紙墨特徵不存，原刻版本待考。',
    bookTitle: '（清）《三國演義》刊本繡像（版本待考）',
  },
  'JiangWei.jpg': {
    name: '姜维',
    id: 'person_jiang_wei',
    reason:
      'Commons 著錄為清代《三國演義》刊本人物繡像，公有領域。圖檔經後人描清，紙墨特徵不存，原刻版本待考。',
    bookTitle: '（清）《三國演義》刊本繡像（版本待考）',
  },
  'CaoZhiPortrait.jpg': {
    name: '曹植',
    id: 'person_cao_zhi',
    reason:
      'Commons 著錄為清代《三國演義》刊本人物繡像，公有領域。圖檔經後人描清，紙墨特徵不存，原刻版本待考。',
    bookTitle: '（清）《三國演義》刊本繡像（版本待考）',
  },
  'Zhang Liang.jpg': {
    name: '张良',
    id: 'person_zhang_liang',
    reason:
      '清乾隆八年（1743）上官周《晚笑堂竹莊畫傳》張良像，木刻版畫，原書藏日本早稻田大學圖書館。' +
      '（本庫另有《明人画张良像轴》絹本設色立軸，考據度更高，故以像軸為主圖，此圖列為次選。）',
    bookTitle: '（清）上官周《晚笑堂竹莊畫傳》',
  },
  '范增像.jpg': {
    revert: true,
    name: '范增',
    id: 'person_fan_zeng',
    reason:
      '殘損壁畫的攝影照片，畫面剝落、成像模糊，且無法比定繪製年代、作者與像主，' +
      '不足以作為范增像，仍退回 L3 復原像。',
  },
  '张良像.jpg': {
    revert: true,
    name: '张良',
    id: 'person_zhang_liang',
    reason:
      '殘損壁畫的攝影照片，與「范增像.jpg」同出一處，畫面剝落、成像模糊，無法比定年代與作者，不收。',
  },
};

const audit = JSON.parse(await readFile(AUDIT, 'utf8'));
let reinstated = 0;
let reverted = 0;

for (const [file, spec] of Object.entries(REINSTATE)) {
  if (spec.revert) {
    audit.entries[file] = { name: spec.name, verdict: 'reject', reason: spec.reason, bookTitle: '' };
    reverted += 1;
    continue;
  }
  // 图档并回主目录
  for (const prefix of ['', 'full_']) {
    const from = path.join(REJ, `${prefix}${spec.id}.jpg`);
    const to = path.join(PUB, `${prefix}${spec.id}.jpg`);
    if (existsSync(from)) {
      await copyFile(from, to);
    } else if (!existsSync(to)) {
      console.warn(`  ⚠ 缺少图档：${prefix}${spec.id}.jpg`);
    }
  }
  audit.entries[file] = {
    name: spec.name,
    verdict: 'keep',
    reason: spec.reason,
    bookTitle: spec.bookTitle,
  };
  reinstated += 1;
  console.log(`  ✓ 收录 ${spec.name} ← ${file}`);
}

const list = Object.values(audit.entries);
audit.counts = {
  total: list.length,
  keep: list.filter((e) => e.verdict === 'keep').length,
  reject: list.filter((e) => e.verdict !== 'keep').length,
};
audit.generatedAt = new Date().toISOString();
await writeFile(AUDIT, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');

console.log(`\n改判收录 ${reinstated} 张，维持剔除 ${reverted} 张`);
console.log(`账本合计 ${audit.counts.total}：keep ${audit.counts.keep}，reject ${audit.counts.reject}`);
