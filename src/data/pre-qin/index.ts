/**
 * 分片 · 先秦（西周至战国）
 * ------------------------------------------------------------------
 * 实际收录范围：西周建国（约前 1046 年）至战国之末（前 221 年秦统一）。
 * 秦并天下之后的秦廷人物（李斯、赵高、蒙恬、章邯、子婴等）隶楚汉分片，
 * 此处不重复立传——同一人在两片各建一个 id，画布上会裂成两个互不相连的节点。
 *
 * 全部为简目档：不录本传原文，只著录「此人的传在《史记》哪一卷」。
 * 三代人物生卒多不可考，凡史无明文者一律不填生年。
 */
import type { ShardDataset } from '../../types/history';
import { preQinBriefEdges } from './edges-brief';
import { preQinBriefEdgesC } from './edges-brief-c';
import { preQinBriefA } from './persons-brief-a';
import { preQinBriefB } from './persons-brief-b';
import { preQinBriefC } from './persons-brief-c';

export const preQinShard: ShardDataset = {
  shardId: 'shard_01_pre_qin_qin',
  title: '先秦：西周至战国',
  subtitle: '《史记》三代世系、春秋五霸与战国七雄 · 自武王克商至秦并天下',
  dynasties: ['pre_qin'],
  yearRange: [-1100, -221],
  heroPersonIds: ['person_kong_zi', 'person_lao_zi', 'person_qi_huan_gong', 'person_jin_wen_gong', 'person_shang_yang'],
  nodes: [...preQinBriefA, ...preQinBriefB, ...preQinBriefC],
  edges: [...preQinBriefEdges, ...preQinBriefEdgesC],
};
