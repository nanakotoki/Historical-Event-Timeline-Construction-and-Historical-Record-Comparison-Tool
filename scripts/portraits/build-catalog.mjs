#!/usr/bin/env node
/**
 * 传世画像目录（Portrait Catalog）生成器
 * ------------------------------------------------------------------
 * 读取 scripts/portraits/manifest.json（由 fetch-portraits.mjs 产出），
 * 依据每张图档在 Commons 上的**原始题名**判定其考据等级与出处，
 * 输出 scripts/portraits/catalog.json 供 seed 编译期注入。
 *
 * 分级口径：
 *   tier1_authentic_painting —— 传世卷轴/册页原件（清宫旧藏、台北故宫、海外博物馆藏）
 *   tier2_ancient_woodcut    —— 明清刻本版画、刊本绣像
 * 题名无法归类的，一律按 tier2 并注明「待考」，不提高等级。
 *
 * 用法：node scripts/portraits/build-catalog.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(__dirname, 'manifest.json');
const CATALOG = path.join(__dirname, 'catalog.json');

/**
 * 题名模式 → 考据结论。
 * 顺序敏感：命中即停，越具体的规则越靠前。
 */
const RULES = [
  {
    /*
     * 南薰殿舊藏歷代帝后像一系（臺北故宮）＋清宮帝像（北京故宮）。
     * 这批题名是英文，散在若干套册页里，此前一律落到「（明清）佚名舊像」规则、
     * 被标成 tier2 刻本版画——**宋太祖那张就此被误判成版画**，其实它是绢本设色坐像。
     * 层级按媒材判不按题名判，故此处逐件点名，不放开前缀匹配：
     * 放开会把 Emperor Huizong of Song.png（赵佶，确为版画）一并吞进来。
     *
     * `雍正朝服像轴.jpg` 走中文题名，附带北京故宫馆藏编号故00006431。
     */
    test: (f) =>
      /^(Song (Taizu|Taizong|Zhenzong|Renzong|Gaozong)|Ming (Jianwen|Yingzong)|Kangxi Emperor|Shunzhi|雍正朝服像轴)\.(jpg|png)$/.test(
        f,
      ),
    tier: 'tier1_authentic_painting',
    painterOrBook: '（明—清）南薰殿舊藏歷代帝后像',
    sourceAttribution:
      '南薰殿舊藏歷代帝后像一系：宋帝像冊今藏國立故宮博物院（臺北），絹本設色；' +
      '清帝像分藏兩岸故宮。《雍正朝服像軸》藏故宮博物院（北京），絹本設色，館藏編號故00006431。' +
      '圖檔經 Wikimedia Commons 轉錄，屬公有領域（PD-Art）。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    test: (f) => f.includes('歷代聖賢半身像'),
    tier: 'tier1_authentic_painting',
    painterOrBook: '（元）佚名《歷代聖賢半身像》冊',
    sourceAttribution:
      '國立故宮博物院（臺北）藏《歷代聖賢半身像》冊，絹本設色，館藏編號中畫000328；' +
      '原件半身立像，每幅右上題名、左上題贊。圖檔依故宮 Open Data 釋出（CC BY 4.0 / 低階圖 CC0）。',
    license: 'CC BY 4.0（國立故宮博物院開放資料）',
  },
  {
    test: (f) => f.includes('清人画帝王名臣像册'),
    tier: 'tier1_authentic_painting',
    painterOrBook: '（清）宮廷畫師《帝王名臣像》冊',
    sourceAttribution:
      '故宮博物院（北京）藏《清人畫帝王名臣像》冊，紙本設色。圖檔經 Wikimedia Commons 轉錄，屬公有領域（PD-Art）。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    test: (f) => f.startsWith('Portraits of Famous Men'),
    tier: 'tier1_authentic_painting',
    painterOrBook: '（清）佚名《歷代名臣像》冊',
    sourceAttribution:
      '費城藝術博物館藏《Portraits of Famous Men》冊頁（1929-40-213，Simkhovitch 舊藏），' +
      '絹本設色，十九世紀末至二十世紀初摹繪；每開一像，原件尺寸約 33 × 22.2 公分。公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    // 臺北故宮《元代帝后半身像册》（YuanEmperorAlbum* 一族）：元世祖忽必烈等
    test: (f) => f.startsWith('YuanEmperorAlbum'),
    tier: 'tier1_authentic_painting',
    painterOrBook: '（元）佚名《元代帝后半身像》册',
    sourceAttribution:
      '國立故宮博物院（臺北）藏《元代帝后半身像》册，絹本設色半身像，' +
      '屬南薰殿舊藏系統；圖檔經 Wikimedia Commons 轉錄，屬公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    test: (f) => /^TangTaizong/.test(f),
    tier: 'tier1_authentic_painting',
    painterOrBook: '（明）佚名《唐太宗立像》軸',
    sourceAttribution:
      '國立故宮博物院（臺北）藏《唐太宗立像》軸，絹本設色，館藏編號中畫000263，' +
      '屬南薰殿舊藏歷代帝王像之一，原件高 271 公分。圖檔依故宮 Open Data 釋出後經 Commons 轉錄，屬公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    // 2026-10-28 增补：同一卷中的陈文帝、陈宣帝、陈后主、北周武帝四幅。
    // 四张俱经榜书核对——「陳文帝在位八年　深崇道教」「陳後主叔寶在位七年」
    // 「後周武帝宇文邕在位十八年……毀滅佛法」皆可在图上读出，非按题名猜人。
    test: (f) =>
      /(Sui Wendi Tang|Cao Pi Tang|Chen Wendi Tang|Chen Xuandi Tang|Chen Shubao|Yen Li-pen 001)\.jpg/.test(f),
    tier: 'tier1_authentic_painting',
    painterOrBook: '（唐）閻立本《歷代帝王圖》（傳）',
    sourceAttribution:
      '波士頓美術館藏《歷代帝王圖》卷（傳唐閻立本繪，宋摹本），絹本設色，繪漢至隋十三帝；' +
      '本圖為其中一帝之裁切。公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    // 南薰殿舊藏《明世宗坐像》軸（嘉靖帝）：臺北故宮 Open Data 以法文題名上傳，
    // 館藏編號中畫000318；另有早期上傳的 Jiajing.jpg 為同一軸之裁切版。
    test: (f) => /Portrait officiel de l'empereur Jiajing\.jpg|^Jiajing\.jpg$/.test(f),
    tier: 'tier1_authentic_painting',
    painterOrBook: '（明）佚名《明世宗坐像》軸',
    sourceAttribution:
      '國立故宮博物院（臺北）藏《明世宗坐像》軸，絹本設色，縱 209.7 公分，館藏編號中畫000318，' +
      '屬南薰殿舊藏明代帝王坐像之一。圖檔依故宮 Open Data 釋出後經 Wikimedia Commons 轉錄，屬公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    // 《清代學者象傳》第一集（葉衍蘭輯、黃小泉摹繪，光緒間紙本設色）：
    // Commons「清代學者象傳」分類已核實的拼音題名在此白名單內；
    // 同書的中文裸題名檔（如「黃宗羲.jpg」）無法按檔名判別，由 audit 賬本
    // 的 bookTitle 欄位逐件覆寫，不走本規則。
    test: (f) => /^(Gu yanwu|Dai Zhen|Nalan Xingde|Wei Yuan)\.(png|jpg)$/i.test(f),
    tier: 'tier1_authentic_painting',
    painterOrBook: '（清末）葉衍蘭輯、黃小泉摹繪《清代學者象傳》第一集',
    sourceAttribution:
      '《清代學者象傳》第一集，葉衍蘭（1823-1897）輯、黃小泉摹繪，紙本設色冊頁，光緒間成書；' +
      '摹繪去其人未遠，形貌有所本。圖檔經 Wikimedia Commons 轉錄，屬公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    test: (f) => /^Hulagu Khan\.jpg$/i.test(f),
    tier: 'tier1_authentic_painting',
    painterOrBook: '（伊利汗國）拉施特《史集》抄本插圖',
    sourceAttribution:
      '拉施特主編《史集》（Jāmiʿ al-tawārīkh）十四世紀抄本插圖，紙本設色細密畫，' +
      '繪伊利汗國開國之君旭烈兀。波斯抄本畫非中土卷軸，然確為與其人同代的紙本繪畫，故收為 L1 並如實著錄。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    // 南薰殿舊藏歷代帝王像一系：《唐高祖立像》軸、《唐太宗立像》軸等，
    // 题名多为「〇〇立像 軸.png」（立像与軸之间有一空格，且用繁体「軸」）。
    test: (f) => /立像\s*軸\.png$/.test(f),
    tier: 'tier1_authentic_painting',
    painterOrBook: '（明）佚名《歷代帝王立像》軸（南薰殿舊藏）',
    sourceAttribution:
      '南薰殿舊藏歷代帝王像軸，絹本設色立軸。清乾隆時彙貯於南薰殿，' +
      '民國間部分入藏國立故宮博物院，原件高逾二公尺。圖檔依故宮 Open Data 釋出後經 Commons 轉錄，屬公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    // 简繁两体并存：Commons 上「像轴」（简）与「像軸」（繁）都有，缺一即漏判。
    test: (f) => /^[明清算][人代].*像[軸轴]?\.png$/.test(f),
    tier: 'tier1_authentic_painting',
    painterOrBook: '（明）佚名繪像軸',
    sourceAttribution:
      '明清人繪人物像軸（故宮舊藏歷代名臣像一系），絹本設色立軸。圖檔經 Wikimedia Commons 轉錄，屬公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    // 金上京博物馆藏完颜阿骨打像：Commons 著录称「与阿骨打同时」，但女真早期
    // 无画像传世，此断代学界存疑。仍按真图入库，但出处必须写「传」并注明存疑。
    test: (f) => /^Wanggiyan Aguda\.jpg$/i.test(f),
    tier: 'tier2_ancient_woodcut',
    painterOrBook: '（传）金上京博物馆藏本',
    sourceAttribution:
      '哈尔滨金上京博物馆藏女真帝王画像，Commons 著录称「与阿骨打同时」；女真早期无画像传世，此断代存疑，故标「传」。图档经 Wikimedia Commons 转录。',
    license: '见 Commons 原页著录',
  },
  {
    test: (f) => /說唐演義全傳/.test(f),
    tier: 'tier2_ancient_woodcut',
    painterOrBook: '（清）《說唐演義全傳》',
    sourceAttribution: '《說唐演義全傳》，清代刻本，人物繡像。圖檔經 Wikimedia Commons 轉錄，屬公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    test: (f) => /歷代君臣圖像/.test(f),
    tier: 'tier2_ancient_woodcut',
    painterOrBook: '（明）佚名《歷代君臣圖像》',
    sourceAttribution: '《歷代君臣圖像》，明刻清印本，收歷代帝王名臣木刻繡像。圖檔屬公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    test: (f) => /淩煙閣功臣圖像|凌煙閣功臣圖像/.test(f),
    tier: 'tier2_ancient_woodcut',
    painterOrBook: '（清）劉源繪《凌煙閣功臣圖像》',
    sourceAttribution:
      '《凌煙閣功臣圖像》，清康熙年間刻本，劉源繪、朱圭刻，收唐太宗凌煙閣二十四功臣像。圖檔屬公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    test: (f) => /新鐫繡像旁批詳註總斷廣百將傳/.test(f),
    tier: 'tier2_ancient_woodcut',
    painterOrBook: '（明）《新鐫繡像旁批詳註總斷廣百將傳》',
    sourceAttribution: '《新鐫繡像旁批詳註總斷廣百將傳》，明末刻本，歷代名將木刻繡像。圖檔屬公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    test: (f) => / scth\.|Sancai Tuhui/i.test(f),
    tier: 'tier2_ancient_woodcut',
    painterOrBook: '（明）王圻《三才圖會》',
    sourceAttribution: '《三才圖會·人物卷》，明萬曆三十七年（1609）原刻本。圖檔屬公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    // 《三國演義》绣像中「拼音裸题名」与「Portrait of 〇〇」混用的一批：
    // 若不加此规则，Portrait of Xun Yu.jpg 会误落进下面的十九世纪像册规则而被抬到 L1。
    // 这批图档的共同点是刀痕可辨、题名在幅内，属木刻版画，故一律 L2。
    test: (f) =>
      /^(CaoZhiPortrait|MaChao|JiangWei|ZhouYu|LuSu|LuXun|FaZheng|Portrait of Xun Yu)\.(jpg|png)$/i.test(f),
    tier: 'tier2_ancient_woodcut',
    painterOrBook: '（清）《三國演義》刊本繡像',
    sourceAttribution:
      '清代《三國演義》刊本人物繡像，木刻版畫。荀彧一幀出東京大學東洋文化研究所藏雍正十二年（1734）刊本；' +
      '餘各幀同屬清刊系統，圖檔經後人描清、紙墨特徵已失，原刻版本待考。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    // 「Portrait of X.jpg」一族：Commons 著錄為十九世紀彩繪人物像冊（設色，非版畫），
    // 其中秦始皇一開明言「摹一六〇九年底本」。底本究屬何書尚待比定，故不徑題書名。
    test: (f) => /^Portrait of /i.test(f),
    tier: 'tier1_authentic_painting',
    painterOrBook: '（清）佚名《歷代人物像冊》',
    sourceAttribution:
      '十九世紀彩繪歷代人物像冊（絹本設色，每開一人，右上題名）。' +
      'Commons 著錄云其中國帝王一開摹自一六〇九年底本；底本究屬何書，尚待比定，故不徑題書名。公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    // 「X Portrait.jpg / X Qing dynasty portrait.jpg」一族：本庫中皆三國人物，
    // 屬清代《三國演義》刊本繡像系統。
    // **必須先用白名單鎖定三國人物**：這條規則若只看「Portrait」字樣，
    // 「Qi Jiguang Portrait.jpg」這類非三國人物的英文題名也會被安上
    // 「清代《三國演義》刊本繡像」的出處——那是無中生有。白名單外者
    // 落到末尾的 FALLBACK（版本待考），寧可低記，不可錯記。
    test: (f) =>
      /(Portrait|Qing (dynasty )?(portrait|illustration))/i.test(f) &&
      [
        'Cao Cao', 'CaoCao', 'Cao Zhi', 'CaoZhi', 'Cao Pi', 'CaoPi',
        'Liu Bei', 'LiuBei', 'Guan Yu', 'GuanYu', 'Zhang Fei', 'ZhangFei',
        'Zhao Yun', 'ZhaoYun', 'Ma Chao', 'MaChao', 'Huang Zhong', 'HuangZhong',
        'Jiang Wei', 'JiangWei', 'Zhou Yu', 'ZhouYu', 'Lu Su', 'LuSu',
        'Lu Xun', 'LuXun', 'Fa Zheng', 'FaZheng', 'Xun Yu', 'XunYu',
        'Jia Xu', 'JiaXu', 'Zhang Liao', 'ZhangLiao', 'Xu Huang', 'XuHuang',
        'Xiahou Dun', 'XiahouDun', 'Xiahou Yuan', 'XiahouYuan',
        'Dong Zhuo', 'DongZhuo', 'Lü Bu', 'Lu Bu', 'LüBu', 'LuBu',
        'Sun Quan', 'SunQuan', 'Sun Jian', 'SunJian', 'Sun Ce', 'SunCe',
        'Sima Yi', 'SimaYi', 'Yuan Shao', 'YuanShao', 'Chen Sheng', 'ChenSheng',
      ].some((n) => f.includes(n)),
    tier: 'tier2_ancient_woodcut',
    painterOrBook: '（清）《三國演義》刊本繡像',
    sourceAttribution:
      '清代《三國演義》刊本人物繡像（多出自毛宗崗評本系統），木刻版畫。圖檔經 Wikimedia Commons 轉錄，屬公有領域。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
  {
    test: (f) => /^[\u4e00-\u9fff（）()·]+\.(jpg|png)$/.test(f),
    tier: 'tier2_ancient_woodcut',
    // 「（明清）佚名」單獨出現會被界面原樣讀成「這是明清的佚名作品」——
    // 那是斷代，不是著錄。本庫對這批圖只到「是舊像」這一步，故一併寫明待考。
    painterOrBook: '（明清）佚名舊像（版本待考）',
    sourceAttribution:
      '明清人物像（或為繪本，或為刻本插圖，本庫未逐件比定其版本與媒材），' +
      '圖檔經 Wikimedia Commons 轉錄，屬公有領域。出處存疑處一律記為「版本待考」，不臆題書名。',
    license: 'PD-Art（公有領域二維藝術品忠實複製）',
  },
];

const FALLBACK = {
  tier: 'tier2_ancient_woodcut',
  painterOrBook: '（明清）佚名舊像（版本待考）',
  sourceAttribution:
    'Wikimedia Commons 收錄之公有領域人物圖像。原書版本待比定，故記為「版本待考」。',
  license: 'PD-Art（公有領域二維藝術品忠實複製）',
};

async function main() {
  if (!existsSync(MANIFEST)) {
    console.error('未找到 manifest.json，请先运行 fetch-portraits.mjs');
    process.exit(1);
  }
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const entries = manifest.entries || {};

  /**
   * 逐图审计账本（audit.json）。
   * 这是「宁可少，不可假」的执行点：账本里没有 verdict=keep 的图档，一律不进目录。
   * 只凭题名相似就收录，曾把现代画家照片、庙里塑像、书法页当成传世画像——
   * 故此处改为**白名单制**，新增图档必须先过目审计、写入账本，才能上线。
   */
  const AUDIT_PATH = path.join(__dirname, 'audit.json');
  const audit = existsSync(AUDIT_PATH)
    ? JSON.parse(await readFile(AUDIT_PATH, 'utf8')).entries || {}
    : null;
  if (!audit) console.warn('  ⚠ 未找到 audit.json，本次构建将不注入任何传世画像。');

  // 三国人物花名册：用于校验「三國演義刊本繡像」这条规则不会误落到别人头上。
  // 花名册来自上一次 seed 产物；缺失时仅跳过校验，不影响出图。
  const threeKingdoms = await (async () => {
    const p = path.join(__dirname, '..', '..', 'public', 'data', 'shards', 'shard_03_three_kingdoms.json');
    if (!existsSync(p)) return null;
    try {
      const d = JSON.parse(await readFile(p, 'utf8'));
      return new Set((d.nodes || []).map((n) => n.id));
    } catch {
      return null;
    }
  })();

  const catalog = {};
  const byTier = { tier1_authentic_painting: 0, tier2_ancient_woodcut: 0 };
  const suspicious = [];
  const blocked = [];

  for (const [id, rec] of Object.entries(entries)) {
    // 白名单闸门：未过审计的一律不注入
    const verdict = audit ? audit[rec.file] : null;
    if (!verdict || verdict.verdict !== 'keep') {
      blocked.push(`${rec.name}（${rec.file}）${verdict ? `— ${verdict.reason}` : '— 未审计'}`);
      continue;
    }

    let rule = RULES.find((r) => r.test(rec.file)) || FALLBACK;

    // 硬校验：凡落到《三國演義》绣像规则的，必须确属三国人物。
    if (
      threeKingdoms &&
      rule.painterOrBook === '（清）《三國演義》刊本繡像' &&
      !threeKingdoms.has(id)
    ) {
      suspicious.push(`${rec.name}（${rec.file}）`);
      rule = FALLBACK;
    }

    // 账本可覆盖题名规则推断出的书名（用于规则无法判断、但审计时已查明者）
    const overridden = verdict.bookTitle
      ? { painterOrBook: verdict.bookTitle, sourceAttribution: verdict.reason }
      : {};

    // 账本亦可覆盖层级。
    // 起因：中文题名一律走「（明清）佚名舊像」规则，而该规则只有 tier2，
    // 于是「孝莊文皇后朝服像」这类清宫旧藏绢本立轴、纸本容像全被标成刻本版画。
    // 层级是给读者看的判断（L1 传世古画 / L2 古籍版画），不是内部标签，
    // 故允许审计时逐件改判；不改则沿用规则推断。
    const tier = verdict.tier === 'tier1_authentic_painting' || verdict.tier === 'tier2_ancient_woodcut'
      ? verdict.tier
      : rule.tier;

    byTier[tier] = (byTier[tier] || 0) + 1;
    catalog[id] = {
      id,
      name: rec.name,
      file: rec.file,
      tier,
      painterOrBook: overridden.painterOrBook || rule.painterOrBook,
      sourceAttribution: overridden.sourceAttribution || rule.sourceAttribution,
      license: rule.license,
      commonsPage: rec.commons,
      thumb: `/data/portraits/${id}.jpg`,
      full: `/data/portraits/full_${id}.jpg`,
    };
  }

  if (suspicious.length) {
    console.log(`  ⚠ ${suspicious.length} 人的图档题名像绣像但并非三国人物，已退回「版本待考」：`);
    for (const s of suspicious) console.log(`      · ${s}`);
  }
  if (blocked.length) {
    console.log(`  ⚠ ${blocked.length} 张图档未通过审计，已退回 L3/L4 呈现：`);
    for (const s of blocked) console.log(`      · ${s}`);
  }

  await writeFile(
    CATALOG,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note:
          '本目录只登记已实际取回落盘的传世画像。未列入者＝未在公有领域图库中找到可定位的传世图档，' +
          '前端按 tier3/tier4 呈现「本站复原」，绝不冒充实物。',
        counts: { total: Object.keys(catalog).length, ...byTier },
        entries: catalog,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(`已写入 ${CATALOG}`);
  console.log(`合计 ${Object.keys(catalog).length} 人：L1 传世古画 ${byTier.tier1_authentic_painting} 人，L2 古籍版画 ${byTier.tier2_ancient_woodcut} 人`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
