/**
 * 分片 · 新莽更始（shard_08）
 * ------------------------------------------------------------------
 * 自始建国元年（9）王莽代汉，至建武十二年（36）公孙述死、蜀平，
 * 凡二十七年。**这是全站最后一处朝代空缺**：此前「新莽」这个朝代有定义、
 * 有 9–25 的年份区间，`shardFile` 却是空字符串，一个人物也没有——
 * 时间轴上西汉（8 止）与东汉（25 起）之间横着十六年，
 * 而且整条东汉开国的主干（光武帝与云台诸将）也一并缺席：
 * 刘秀、邓禹、冯异、耿弇、马援在库中全部查无此人。
 * 《后汉书》卷一至卷十九、卷二十二至卷二十四，此前一段未收。
 *
 * 本片补三样东西：
 *  ① 新室自身的权力结构（王莽、元后、四辅、昆阳主帅）；
 *  ② 推翻新室的两条线（绿林的新市/下江、赤眉）与更始政权；
 *  ③ 光武君臣与建武年间的七处割据，直到天下一统。
 *
 * **朝代归属的划线**（这是本片唯一需要判断的地方）：
 *  - 王莽及其四辅、绿林赤眉更始诸人 → `xin`
 *  - 刘秀与云台诸将、阴氏、马援，以及隗嚣公孙述等建武对手 → `eastern_han`
 *  - 翟义（卒于 7）、扬雄（卒于 18）→ `western_han` / `xin`，各依本传
 * 判据是「此人以哪一朝的身份入正史」，不是「活到哪一年」。
 * 所以刘秀虽起兵于新末，仍记东汉；翟义虽死于王莽居摄，仍记西汉。
 *
 * yearRange 取 [-75, 70]：上下界都不是分片本身的年份，而是留给
 * 王政君（前 71 生）与阴丽华（64 卒）、窦融（62 卒）这几头。
 * 校验按 birthYear 卡区间，若按 9 起算，元后与扬雄会被判越界——
 * 这与五代、两晋两片踩过的是同一个坑：**该扩的是区间，不是生年。**
 *
 * 与既有分片无一人重名。王匡、王凤这两个极易混淆的名字，
 * 本片所收皆为绿林首领，与王莽之侄太师王匡、王莽叔父王凤并非一人，
 * 已在各自 summary 内点明，不再另立同名节点。
 */
import type { ShardDataset } from '@/types/history';
import { xinMangBriefA } from './persons-brief-a';
import { xinMangBriefB } from './persons-brief-b';
import { xinMangBriefC } from './persons-brief-c';
import { xinMangBriefD } from './persons-brief-d';
import { xinMangBriefEdges } from './edges-brief';

export const xinMangShard: ShardDataset = {
  shardId: 'shard_08_xin_mang',
  title: '新莽更始：王莽改制到光武中兴',
  subtitle: '《汉书》《后汉书》 · 自王莽代汉至公孙述死',
  dynasties: ['xin', 'western_han', 'eastern_han'],
  yearRange: [-75, 70],
  heroPersonIds: [
    'person_wang_mang',
    'person_liu_xiu',
    'person_liu_xuan',
    'person_wei_xiao',
    'person_ma_yuan',
  ],
  nodes: [...xinMangBriefA, ...xinMangBriefB, ...xinMangBriefC, ...xinMangBriefD],
  edges: [...xinMangBriefEdges],
};
