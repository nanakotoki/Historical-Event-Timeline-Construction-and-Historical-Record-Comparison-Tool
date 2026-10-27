/**
 * 朝代元数据注册表（二十四史对应关系 · 视觉主题色 · 分片映射）
 * 该表同时驱动：图例、节点朝代光环、底部朝代胶囊、manifest 生成。
 */
import type { DynastyId, DynastyMeta } from '@/types/history';

export const DYNASTIES: DynastyMeta[] = [
  {
    id: 'pre_qin',
    name: '先秦',
    startYear: -1046,
    endYear: -222,
    primaryColor: '#7A6A45',
    canonicalBooks: ['《史记》'],
    shardFile: 'shard_01_pre_qin_qin.json',
  },
  {
    id: 'qin',
    name: '秦',
    startYear: -221,
    endYear: -207,
    primaryColor: '#2F3540',
    canonicalBooks: ['《史记》'],
    shardFile: 'shard_02_chu_han.json',
  },
  {
    id: 'chu_han',
    name: '楚汉之际',
    startYear: -206,
    endYear: -202,
    primaryColor: '#8C4A3F',
    canonicalBooks: ['《史记》', '《汉书》'],
    shardFile: 'shard_02_chu_han.json',
  },
  {
    id: 'western_han',
    name: '西汉',
    startYear: -202,
    endYear: 8,
    primaryColor: '#B0763F',
    canonicalBooks: ['《史记》', '《汉书》'],
    shardFile: 'shard_02_chu_han.json',
  },
  {
    id: 'xin',
    name: '新莽',
    startYear: 9,
    endYear: 25,
    primaryColor: '#7D6337',
    canonicalBooks: ['《汉书》', '《后汉书》'],
    shardFile: 'shard_08_xin_mang.json',
  },
  {
    id: 'eastern_han',
    name: '东汉',
    startYear: 25,
    endYear: 220,
    primaryColor: '#A24A3B',
    canonicalBooks: ['《后汉书》', '《三国志》'],
    shardFile: 'shard_03_three_kingdoms.json',
  },
  {
    id: 'three_kingdoms',
    name: '三国',
    startYear: 220,
    endYear: 280,
    primaryColor: '#4C6A8A',
    canonicalBooks: ['《三国志》', '《后汉书》', '《晋书》'],
    shardFile: 'shard_03_three_kingdoms.json',
  },
  {
    id: 'jin',
    name: '两晋',
    startYear: 266,
    endYear: 420,
    primaryColor: '#5D7F6E',
    canonicalBooks: ['《晋书》'],
    shardFile: 'shard_04_jin_nanbeichao.json',
  },
  {
    id: 'southern_northern',
    name: '南北朝',
    startYear: 420,
    endYear: 589,
    primaryColor: '#6E6180',
    canonicalBooks: ['《宋书》', '《南齐书》', '《梁书》', '《陈书》', '《魏书》', '《北齐书》', '《周书》', '《南史》', '《北史》'],
    shardFile: 'shard_04_jin_nanbeichao.json',
  },
  {
    id: 'sui',
    name: '隋',
    startYear: 581,
    endYear: 618,
    primaryColor: '#7A4B5C',
    canonicalBooks: ['《隋书》'],
    shardFile: 'shard_05_sui_tang.json',
  },
  {
    id: 'tang',
    name: '唐',
    startYear: 618,
    endYear: 907,
    primaryColor: '#C0762F',
    canonicalBooks: ['《旧唐书》', '《新唐书》'],
    shardFile: 'shard_05_sui_tang.json',
  },
  {
    id: 'five_dynasties',
    name: '五代十国',
    startYear: 907,
    endYear: 979,
    primaryColor: '#7A6A5A',
    canonicalBooks: ['《旧五代史》', '《新五代史》'],
    shardFile: 'shard_07_five_dynasties.json',
  },
  {
    id: 'song',
    name: '宋',
    startYear: 960,
    endYear: 1279,
    primaryColor: '#4E7A7A',
    canonicalBooks: ['《宋史》'],
    shardFile: 'shard_06_song_ming_qing.json',
  },
  {
    id: 'liao_jin_xia',
    name: '辽金西夏',
    startYear: 907,
    endYear: 1234,
    primaryColor: '#8A7440',
    canonicalBooks: ['《辽史》', '《金史》', '《宋史》'],
    shardFile: 'shard_06_song_ming_qing.json',
  },
  {
    id: 'yuan',
    name: '元',
    startYear: 1271,
    endYear: 1368,
    primaryColor: '#566A86',
    canonicalBooks: ['《元史》'],
    shardFile: 'shard_06_song_ming_qing.json',
  },
  {
    id: 'ming',
    name: '明',
    startYear: 1368,
    endYear: 1644,
    primaryColor: '#B03A2E',
    canonicalBooks: ['《明史》'],
    shardFile: 'shard_06_song_ming_qing.json',
  },
  {
    id: 'qing',
    name: '清',
    startYear: 1636,
    endYear: 1912,
    primaryColor: '#3F5A6B',
    canonicalBooks: ['《清史稿》'],
    shardFile: 'shard_06_song_ming_qing.json',
  },
];

export const DYNASTY_MAP: Record<DynastyId, DynastyMeta> = DYNASTIES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<DynastyId, DynastyMeta>,
);

export function dynastyName(id: DynastyId): string {
  return DYNASTY_MAP[id]?.name ?? id;
}

export function dynastyColor(id: DynastyId): string {
  return DYNASTY_MAP[id]?.primaryColor ?? '#7A6A45';
}

/** 二十四史完整书目（用于页脚与关于面板） */
export const TWENTY_FOUR_HISTORIES = [
  '《史记》',
  '《汉书》',
  '《后汉书》',
  '《三国志》',
  '《晋书》',
  '《宋书》',
  '《南齐书》',
  '《梁书》',
  '《陈书》',
  '《魏书》',
  '《北齐书》',
  '《周书》',
  '《隋书》',
  '《南史》',
  '《北史》',
  '《旧唐书》',
  '《新唐书》',
  '《旧五代史》',
  '《新五代史》',
  '《宋史》',
  '《辽史》',
  '《金史》',
  '《元史》',
  '《明史》',
];
