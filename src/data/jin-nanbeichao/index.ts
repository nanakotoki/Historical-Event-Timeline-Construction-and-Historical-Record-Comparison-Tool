/**
 * 分片 · 两晋南北朝
 * ------------------------------------------------------------------
 * 实际收录范围：司马炎代魏（265 年）至隋灭陈（589 年）。
 *
 * 与三国分片的边界：司马懿、司马师、司马昭、邓艾、钟会、羊祜之前者已在三国分片，
 * 此处从晋武帝司马炎起算，不重复立传。与隋唐分片的边界：隋文帝以下人物俱在隋唐分片，
 * 此处以陈叔宝为终点——陈亡之年即南北朝之终。
 *
 * 全部为简目档：不录本传原文，只著录「此人的传在何史何卷」。南朝士庶、北朝胡汉之别
 * 在史传目次上留下很深的痕迹（《宋书》有《索虏传》，《魏书》有《岛夷传》），
 * 引用时各仍其旧名，不改一字。
 */
import type { ShardDataset } from '../../types/history';
import { jinBriefEdges } from './edges-brief';
import { jinBriefEdgesC } from './edges-brief-c';
import { jinBriefEdgesE } from './edges-brief-e';
import { jinBriefA } from './persons-brief-a';
import { jinBriefB } from './persons-brief-b';
import { jinBriefC } from './persons-brief-c';
import { jinBriefD } from './persons-brief-d';
import { jinBriefE } from './persons-brief-e';

export const jinNanbeichaoShard: ShardDataset = {
  shardId: 'shard_04_jin_nanbeichao',
  title: '两晋南北朝：门阀、十六国与南北对峙',
  subtitle: '《晋书》《宋书》《南齐书》《梁书》《魏书》《北齐书》《周书》 · 自司马炎代魏至隋灭陈',
  dynasties: ['jin', 'southern_northern'],
  yearRange: [265, 589],
  heroPersonIds: [
    'person_wang_xizhi',
    'person_xie_an',
    'person_tao_yuanming',
    'person_fu_jian',
    'person_yuan_hong',
  ],
  nodes: [...jinBriefA, ...jinBriefB, ...jinBriefC, ...jinBriefD, ...jinBriefE],
  edges: [...jinBriefEdges, ...jinBriefEdgesC, ...jinBriefEdgesE],
};
