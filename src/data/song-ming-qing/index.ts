/**
 * 分片 · 宋元明清（shard_06）
 * ------------------------------------------------------------------
 * 自建隆元年（960）赵宋立国，至宣统三年（1912）清帝退位，凡九百五十余年。
 * 含辽、金、西夏、元、明、清，是五个分片中跨度最长、人物密度最疏的一片。
 *
 * yearRange 取 [860, 1912]：上界不是宋之立国，而是辽太祖耶律阿保机的生年（872）——
 * 校验脚本会检查 birthYear 是否落在 yearRange 内，若按 960 起算，辽室诸人会被判越界。
 * 这是两晋分片踩过的坑：**不要为了迁就一个年份而删掉真实的生年**，该扩的是区间。
 */
import type { ShardDataset } from '@/types/history';
import { songBriefA } from './persons-brief-a';
import { songBriefB } from './persons-brief-b';
import { songBriefC } from './persons-brief-c';
import { songBriefD } from './persons-brief-d';
import { liaoJinXiaPersons } from './persons-liao-jin-xia';
import { songWarPersons } from './persons-song-war';
import { songBriefEdges } from './edges-brief';
import { songWarEdges } from './edges-liao-jin-xia';

export const songMingQingShard: ShardDataset = {
  shardId: 'shard_06_song_ming_qing',
  title: '宋元明清：赵宋至清季',
  subtitle: '《宋史》《元史》《明史》《清史稿》 · 自陈桥兵变至辛亥革命',
  dynasties: ['song', 'liao_jin_xia', 'yuan', 'ming', 'qing'],
  yearRange: [860, 1912],
  heroPersonIds: ['person_su_shi', 'person_wen_tianxiang', 'person_hu_bi_lie', 'person_zhu_yuanzhang', 'person_xuan_ye'],
  nodes: [...songBriefA, ...songBriefB, ...songBriefC, ...songBriefD, ...liaoJinXiaPersons, ...songWarPersons],
  edges: [...songBriefEdges, ...songWarEdges],
};
