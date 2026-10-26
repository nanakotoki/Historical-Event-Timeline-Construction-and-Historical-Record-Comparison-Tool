/**
 * 分片三 · 隋唐帝国与关陇集团簇
 * 自隋文受禅至安史之乱后，聚焦「开皇之治」「玄武门」「贞观纳谏」「武周革命」「开元天宝」五组枢纽。
 */
import type { ShardDataset } from '../../types/history';
import { suiTangEdges } from './edges';
import { suiTangBriefEdges } from './edges-brief';
import { suiTangBriefA } from './persons-brief-a';
import { suiTangBriefB } from './persons-brief-b';
import { suiTangBriefC } from './persons-brief-c';
import { suiTangPersonsA } from './persons-a';
import { suiTangPersonsB } from './persons-b';
import { suiTangPersonsC } from './persons-c';
import { suiTangPersonsD } from './persons-d';
import { suiTangPersonsE } from './persons-e';
import { suiTangPersonsF } from './persons-f';

export const suiTangShard: ShardDataset = {
  shardId: 'shard_05_sui_tang',
  title: '隋唐帝国与关陇集团',
  subtitle: '《隋书》两《唐书》《资治通鉴》高密度核心簇 · 自开皇受禅至唐亡（含开皇、贞观、武周、开元天宝、元和、会昌诸段）',
  dynasties: ['sui', 'tang'],
  yearRange: [541, 912],
  heroPersonIds: [
    'person_li_shimin',
    'person_wu_zetian',
    'person_wei_zheng',
    'person_yang_jian',
    'person_li_longji',
    'person_an_lushan',
  ],
  nodes: [
    ...suiTangPersonsA,
    ...suiTangPersonsB,
    ...suiTangPersonsC,
    ...suiTangPersonsD,
    ...suiTangPersonsE,
    ...suiTangPersonsF,
    ...suiTangBriefA,
    ...suiTangBriefB,
    ...suiTangBriefC,
  ],
  edges: [...suiTangEdges, ...suiTangBriefEdges],
};
