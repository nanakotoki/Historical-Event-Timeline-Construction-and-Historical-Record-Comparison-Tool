/**
 * 分片 · 五代十国（shard_07）
 * ------------------------------------------------------------------
 * 自开平元年（907）朱温篡唐，至太平兴国四年（979）北汉纳土，凡七十二年。
 *
 * **这一片是全站最晚补上的一个空洞。** 此前库中「五代十国」这个朝代有定义、
 * 却没有一个人物，`shardFile` 为空，连朝代胶囊都渲染不出来——时间轴上
 * 唐（907 止）与宋（960 起）之间横着七十二年的空白，谁点都点不出东西。
 *
 * yearRange 取 [830, 990]：上界不是五代之亡（979），而是下界留给罗隐（833 生）
 * 与陈抟（989 卒）这两头。校验脚本按 birthYear 卡区间，若按 907 起算，
 * 罗隐、韦庄这批唐末人物会被判越界——这是两晋、宋元明清两片都踩过的坑：
 * **不要为了迁就一个年份而删掉真实的生年，该扩的是区间。**
 *
 * **两个人不在此片：** 朱温与李克用。二人一为梁太祖、一为后唐追尊太祖，
 * 却都已隶《隋唐》分片（唐末之梁王、晋王），若在本片重立，同一人便有两个节点。
 * 按「先建者保留」的惯例，本片不重复立目，只在李存勖、朱友贞等人的本传里带出。
 */
import type { ShardDataset } from '@/types/history';
import { fiveDynBriefA } from './persons-brief-a';
import { fiveDynBriefB } from './persons-brief-b';
import { fiveDynBriefC } from './persons-brief-c';
import { fiveDynBriefD } from './persons-brief-d';
import { fiveDynBriefEdges } from './edges-brief';

export const fiveDynastiesShard: ShardDataset = {
  shardId: 'shard_07_five_dynasties',
  title: '五代十国：梁唐晋汉周',
  subtitle: '《旧五代史》《新五代史》 · 自朱温篡唐至北汉纳土',
  dynasties: ['five_dynasties'],
  yearRange: [830, 990],
  heroPersonIds: ['person_li_cunxu', 'person_chai_rong', 'person_li_yu', 'person_qian_liu', 'person_feng_dao'],
  nodes: [...fiveDynBriefA, ...fiveDynBriefB, ...fiveDynBriefC, ...fiveDynBriefD],
  edges: [...fiveDynBriefEdges],
};
