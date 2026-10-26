/**
 * 分片二 · 汉末三国群雄与门阀雏形簇
 * 自黄巾之乱至三家归晋，聚焦「挟天子」「三顾茅庐」「赤壁」「夷陵」「高平陵」五组枢纽事件。
 */
import type { ShardDataset } from '../../types/history';
import { threeKingdomsEdges } from './edges';
import { threeKingdomsBriefEdges } from './edges-brief';
import { threeKingdomsBriefEdgesB } from './edges-brief-b';
import { threeKingdomsPersonsA } from './persons-a';
import { threeKingdomsBriefA } from './persons-brief-a';
import { threeKingdomsBriefB } from './persons-brief-b';
import { threeKingdomsPersonsB } from './persons-b';
import { threeKingdomsPersonsC } from './persons-c';
import { threeKingdomsPersonsD } from './persons-d';
import { threeKingdomsPersonsE } from './persons-e';
import { threeKingdomsPersonsF } from './persons-f';
import { threeKingdomsPersonsG } from './persons-g';

export const threeKingdomsShard: ShardDataset = {
  shardId: 'shard_03_three_kingdoms',
  title: '汉末三国与门阀雏形',
  subtitle: '《三国志》及裴注高密度核心簇 · 自董卓入洛至三家归晋',
  dynasties: ['eastern_han', 'three_kingdoms', 'jin'],
  yearRange: [139, 265],
  heroPersonIds: [
    'person_cao_cao',
    'person_liu_bei',
    'person_sun_quan',
    'person_zhuge_liang',
    'person_zhou_yu',
    'person_si_ma_yi',
  ],
  nodes: [
    ...threeKingdomsPersonsA,
    ...threeKingdomsPersonsB,
    ...threeKingdomsPersonsC,
    ...threeKingdomsPersonsD,
    ...threeKingdomsPersonsE,
    ...threeKingdomsPersonsF,
    ...threeKingdomsPersonsG,
    ...threeKingdomsBriefA,
    ...threeKingdomsBriefB,
  ],
  edges: [...threeKingdomsEdges, ...threeKingdomsBriefEdges, ...threeKingdomsBriefEdgesB],
};
