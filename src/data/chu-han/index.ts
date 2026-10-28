/**
 * 分片一 · 楚汉争霸与大汉开国簇
 * ------------------------------------------------------------------
 * 实际收录范围：秦并天下（前 259 年前后）至汉武帝之世（苏武卒于前 60 年）。
 * 标题沿用旧称，`yearRange` 与副题按实录修正，不使读者误判疆界。
 */
import type { ShardDataset } from '../../types/history';
import { chuHanEdges } from './edges';
import { chuHanBriefEdges } from './edges-brief';
import { chuHanBriefEdgesD } from './edges-brief-d';
import { chuHanPersonsA } from './persons-a';
import { chuHanPersonsB } from './persons-b';
import { chuHanPersonsC } from './persons-c';
import { chuHanPersonsD } from './persons-d';
import { chuHanPersonsE } from './persons-e';
import { chuHanPersonsF } from './persons-f';
import { chuHanPersonsG } from './persons-g';
import { chuHanBriefA } from './persons-brief-a';
import { chuHanBriefB } from './persons-brief-b';
import { chuHanBriefC } from './persons-brief-c';
import { chuHanBriefD } from './persons-brief-d';

export const chuHanShard: ShardDataset = {
  shardId: 'shard_02_chu_han',
  title: '楚汉争霸与大汉开国',
  subtitle: '《史记》《汉书》核心簇 · 自秦并天下至汉武之世',
  dynasties: ['qin', 'chu_han', 'western_han'],
  yearRange: [-259, -60],
  heroPersonIds: ['person_liu_bang', 'person_xiang_yu', 'person_han_xin', 'person_qin_shi_huang', 'person_zhang_liang'],
  nodes: [
    ...chuHanPersonsA,
    ...chuHanPersonsB,
    ...chuHanPersonsC,
    ...chuHanPersonsD,
    ...chuHanPersonsE,
    ...chuHanPersonsF,
    ...chuHanPersonsG,
    ...chuHanBriefA,
    ...chuHanBriefB,
    ...chuHanBriefC,
    ...chuHanBriefD,
  ],
  edges: [...chuHanEdges, ...chuHanBriefEdges, ...chuHanBriefEdgesD],
};
