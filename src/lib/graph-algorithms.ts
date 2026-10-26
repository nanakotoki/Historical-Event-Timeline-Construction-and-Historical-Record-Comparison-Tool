/**
 * 图算法引擎（纯函数，零依赖）
 * ------------------------------------------------------------------
 * 在前端内存中以邻接表维护人物关系图，提供：
 *  - BFS 六度分隔寻路（多条等长最短路）
 *  - K 度 Ego-Network 邻域提取
 *  - 共同关系圈交集（按关系性质分组）
 *  - 宗法世系 / 师承树构建（供 d3-hierarchy 布局）
 *  - 度中心性 / 介数中心性（Brandes）/ PageRank（社会网络分析面板）
 *  - 单一历史截面下的关系状态推演（temporalPhases 状态机）
 */
import type {
  HistoricalPersonNode,
  HistoricalRelationEdge,
  RelationCategory,
  TemporalRelationPhase,
} from '@/types/history';

export interface AdjacencyEntry {
  neighborId: string;
  edge: HistoricalRelationEdge;
  /** 从当前节点看，该边是出边还是入边 */
  direction: 'out' | 'in';
}

export interface GraphIndex {
  nodes: Map<string, HistoricalPersonNode>;
  nodeList: HistoricalPersonNode[];
  edges: HistoricalRelationEdge[];
  edgesByNode: Map<string, HistoricalRelationEdge[]>;
  adjacency: Map<string, AdjacencyEntry[]>;
  degree: Map<string, number>;
}

export interface GraphPath {
  nodeIds: string[];
  edges: HistoricalRelationEdge[];
  /** 关系跳数 */
  hops: number;
}

export interface CommonNeighbor {
  person: HistoricalPersonNode;
  toA: HistoricalRelationEdge;
  toB: HistoricalRelationEdge;
  sharedCategory: RelationCategory | null;
}

export interface LineageTreeNode {
  id: string;
  name: string;
  children: LineageTreeNode[];
  depth: number;
  /** 由哪条边接入父节点 */
  viaEdgeId?: string;
}

/* -------------------------------------------------------------------------- */
/*                                 构图                                       */
/* -------------------------------------------------------------------------- */

export function buildGraphIndex(
  nodes: HistoricalPersonNode[],
  edges: HistoricalRelationEdge[],
): GraphIndex {
  const nodeMap = new Map<string, HistoricalPersonNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const validEdges: HistoricalRelationEdge[] = [];
  const adjacency = new Map<string, AdjacencyEntry[]>();
  const edgesByNode = new Map<string, HistoricalRelationEdge[]>();
  const degree = new Map<string, number>();

  for (const n of nodes) {
    adjacency.set(n.id, []);
    edgesByNode.set(n.id, []);
    degree.set(n.id, 0);
  }

  for (const e of edges) {
    // 容错：悬空边直接剔除，避免渲染期崩溃
    if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) continue;
    if (e.source === e.target) continue;
    validEdges.push(e);
    adjacency.get(e.source)!.push({ neighborId: e.target, edge: e, direction: 'out' });
    adjacency.get(e.target)!.push({ neighborId: e.source, edge: e, direction: 'in' });
    edgesByNode.get(e.source)!.push(e);
    edgesByNode.get(e.target)!.push(e);
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }

  return { nodes: nodeMap, nodeList: nodes, edges: validEdges, adjacency, edgesByNode, degree };
}

/* -------------------------------------------------------------------------- */
/*                           BFS 最短关系链（六度分隔）                        */
/* -------------------------------------------------------------------------- */

/**
 * 计算连接 startId 与 endId 的最短关系链，最多返回 maxPaths 条等长路径。
 * 复杂度 O(V + E) + O(P·L)，P 为等长路径数上限。
 */
export function findShortestPaths(
  graph: GraphIndex,
  startId: string,
  endId: string,
  maxPaths = 3,
): GraphPath[] {
  if (!graph.nodes.has(startId) || !graph.nodes.has(endId)) return [];
  if (startId === endId) return [{ nodeIds: [startId], edges: [], hops: 0 }];

  const dist = new Map<string, number>([[startId, 0]]);
  const preds = new Map<string, { prev: string; edge: HistoricalRelationEdge }[]>();
  const queue: string[] = [startId];

  while (queue.length) {
    const cur = queue.shift()!;
    const d = dist.get(cur)!;
    if (dist.has(endId) && d >= dist.get(endId)!) continue;
    for (const { neighborId, edge } of graph.adjacency.get(cur) ?? []) {
      const nd = d + 1;
      const known = dist.get(neighborId);
      if (known === undefined) {
        dist.set(neighborId, nd);
        preds.set(neighborId, [{ prev: cur, edge }]);
        queue.push(neighborId);
      } else if (known === nd) {
        preds.set(neighborId, [...(preds.get(neighborId) ?? []), { prev: cur, edge }]);
      }
    }
  }

  if (!dist.has(endId)) return [];

  const results: GraphPath[] = [];
  const walk = (nodeId: string, accNodes: string[], accEdges: HistoricalRelationEdge[]) => {
    if (results.length >= maxPaths) return;
    if (nodeId === startId) {
      results.push({
        nodeIds: [...accNodes].reverse(),
        edges: [...accEdges].reverse(),
        hops: accEdges.length,
      });
      return;
    }
    for (const { prev, edge } of preds.get(nodeId) ?? []) {
      walk(prev, [...accNodes, prev], [...accEdges, edge]);
      if (results.length >= maxPaths) return;
    }
  };
  walk(endId, [endId], []);
  return results;
}

/* -------------------------------------------------------------------------- */
/*                           1~2 度 Ego-Network                               */
/* -------------------------------------------------------------------------- */

export interface EgoNetwork {
  centerId: string;
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  /** 各节点距离中心的跳数 */
  distance: Map<string, number>;
}

export function getEgoNetwork(graph: GraphIndex, centerId: string, degree: 1 | 2 = 1): EgoNetwork {
  const nodeIds = new Set<string>([centerId]);
  const edgeIds = new Set<string>();
  const distance = new Map<string, number>([[centerId, 0]]);
  if (!graph.nodes.has(centerId)) return { centerId, nodeIds, edgeIds, distance };

  const queue: string[] = [centerId];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = distance.get(cur)!;
    if (d >= degree) continue;
    for (const { neighborId, edge } of graph.adjacency.get(cur) ?? []) {
      edgeIds.add(edge.id);
      if (!nodeIds.has(neighborId)) {
        nodeIds.add(neighborId);
        distance.set(neighborId, d + 1);
        queue.push(neighborId);
      }
    }
  }
  return { centerId, nodeIds, edgeIds, distance };
}

/** 按关系类型进一步收窄 Ego 圈（如「只看此人的血亲」） */
export function filterEgoByCategory(
  ego: EgoNetwork,
  edges: HistoricalRelationEdge[],
  category: RelationCategory | 'all',
): EgoNetwork {
  if (category === 'all') return ego;
  const keep = new Set<string>([ego.centerId]);
  const edgeIds = new Set<string>();
  for (const e of edges) {
    if (!ego.edgeIds.has(e.id)) continue;
    if (e.primaryCategory !== category) continue;
    edgeIds.add(e.id);
    if (ego.nodeIds.has(e.source) && ego.nodeIds.has(e.target)) {
      keep.add(e.source);
      keep.add(e.target);
    }
  }
  const distance = new Map<string, number>();
  for (const id of keep) distance.set(id, ego.distance.get(id) ?? 1);
  return { centerId: ego.centerId, nodeIds: keep, edgeIds, distance };
}

/* -------------------------------------------------------------------------- */
/*                            共同关系圈交集                                   */
/* -------------------------------------------------------------------------- */

export function getCommonNeighbors(graph: GraphIndex, idA: string, idB: string): CommonNeighbor[] {
  if (!graph.nodes.has(idA) || !graph.nodes.has(idB)) return [];

  const firstHopA = new Map<string, HistoricalRelationEdge>();
  for (const { neighborId, edge } of graph.adjacency.get(idA) ?? []) {
    if (!firstHopA.has(neighborId)) firstHopA.set(neighborId, edge);
  }

  const out: CommonNeighbor[] = [];
  for (const { neighborId, edge } of graph.adjacency.get(idB) ?? []) {
    const edgeA = firstHopA.get(neighborId);
    if (!edgeA || neighborId === idB || neighborId === idA) continue;
    const person = graph.nodes.get(neighborId);
    if (!person) continue;
    out.push({
      person,
      toA: edgeA,
      toB: edge,
      sharedCategory: edgeA.primaryCategory === edge.primaryCategory ? edgeA.primaryCategory : null,
    });
  }
  // 关系越紧密越靠前
  return out.sort((x, y) => y.person.importanceWeight - x.person.importanceWeight);
}

/* -------------------------------------------------------------------------- */
/*                          宗法世系 / 师承树                                   */
/* -------------------------------------------------------------------------- */

const LINEAGE_CATEGORIES: RelationCategory[] = ['kinship_blood', 'kinship_marriage', 'mentor_disciple'];

/**
 * 以 rootId 为根，沿血亲 / 姻亲 / 师承边构建自上而下的树。
 * 帝系传承常由「父→子」「兄→弟」混合构成，此处把兄弟边也视作父子层级的
 * 平行插入，保证皇室世系不断链。
 */
export function buildLineageTree(graph: GraphIndex, rootId: string, maxDepth = 8): LineageTreeNode | null {
  const root = graph.nodes.get(rootId);
  if (!root) return null;

  const visited = new Set<string>([rootId]);

  const walk = (id: string, depth: number): LineageTreeNode => {
    const node = graph.nodes.get(id)!;
    const children: LineageTreeNode[] = [];
    if (depth >= maxDepth) return { id, name: node.name, children, depth };

    // 父子 / 母子 / 师徒：出边优先
    const candidates = (graph.adjacency.get(id) ?? []).filter((entry) =>
      LINEAGE_CATEGORIES.includes(entry.edge.primaryCategory),
    );

    const ordered = candidates.sort((a, b) => {
      const aOut = a.edge.source === id ? 0 : 1;
      const bOut = b.edge.source === id ? 0 : 1;
      if (aOut !== bOut) return aOut - bOut;
      const aTier = a.edge.primaryCategory === 'mentor_disciple' ? 1 : 0;
      const bTier = b.edge.primaryCategory === 'mentor_disciple' ? 1 : 0;
      return aTier - bTier;
    });

    for (const { neighborId, edge } of ordered) {
      if (visited.has(neighborId)) continue;
      // 姻亲边仅作为叶节点（皇后、驸马不入帝系主干）
      if (edge.primaryCategory === 'kinship_marriage') {
        visited.add(neighborId);
        const spouse = graph.nodes.get(neighborId)!;
        children.push({ id: neighborId, name: spouse.name, children: [], depth: depth + 1, viaEdgeId: edge.id });
        continue;
      }
      visited.add(neighborId);
      const child = walk(neighborId, depth + 1);
      child.viaEdgeId = edge.id;
      children.push(child);
    }
    return { id, name: node.name, children, depth };
  };

  return walk(rootId, 0);
}

/** 找出图中「根节点」候选：血亲关系的入度最低者（即辈分最高者） */
export function findLineageRoots(graph: GraphIndex, nodeIds?: Set<string>): string[] {
  const pool = nodeIds ? graph.nodeList.filter((n) => nodeIds.has(n.id)) : graph.nodeList;
  const scored = pool
    .map((n) => {
      let parentLike = 0;
      let childLike = 0;
      for (const { edge, direction } of graph.adjacency.get(n.id) ?? []) {
        if (edge.primaryCategory !== 'kinship_blood') continue;
        if (direction === 'out' && edge.source === n.id) parentLike += 1;
        if (direction === 'in' && edge.target === n.id) childLike += 1;
      }
      return { id: n.id, score: parentLike - childLike, weight: n.importanceWeight };
    })
    .filter((x) => x.score !== 0)
    .sort((a, b) => b.score - a.score || b.weight - a.weight);
  return scored.slice(0, 8).map((x) => x.id);
}

/* -------------------------------------------------------------------------- */
/*                          中心性分析（SNA Studio）                           */
/* -------------------------------------------------------------------------- */

export function computeDegreeCentrality(graph: GraphIndex): { id: string; value: number }[] {
  const max = Math.max(1, graph.nodeList.length - 1);
  return [...graph.degree.entries()]
    .map(([id, deg]) => ({ id, value: deg / max }))
    .sort((a, b) => b.value - a.value);
}

/** Brandes 介数中心性，O(V·E)，图规模在万级以内可接受 */
export function computeBetweennessCentrality(graph: GraphIndex): Map<string, number> {
  const cb = new Map<string, number>();
  for (const n of graph.nodeList) cb.set(n.id, 0);

  for (const s of graph.nodeList) {
    const S: string[] = [];
    const P = new Map<string, string[]>();
    const sigma = new Map<string, number>([[s.id, 1]]);
    const d = new Map<string, number>([[s.id, 0]]);
    const queue: string[] = [s.id];

    while (queue.length) {
      const v = queue.shift()!;
      S.push(v);
      for (const { neighborId: w } of graph.adjacency.get(v) ?? []) {
        if (!d.has(w)) {
          d.set(w, (d.get(v) ?? 0) + 1);
          queue.push(w);
        }
        if (d.get(w) === (d.get(v) ?? 0) + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
          P.set(w, [...(P.get(w) ?? []), v]);
        }
      }
    }

    const delta = new Map<string, number>();
    for (let i = S.length - 1; i >= 0; i -= 1) {
      const w = S[i];
      for (const v of P.get(w) ?? []) {
        const coeff = ((sigma.get(v) ?? 0) / (sigma.get(w) || 1)) * (1 + (delta.get(w) ?? 0));
        delta.set(v, (delta.get(v) ?? 0) + coeff);
      }
      if (w !== s.id) cb.set(w, (cb.get(w) ?? 0) + (delta.get(w) ?? 0));
    }
  }
  // 无向图每条最短路被双向计一次
  for (const [k, v] of cb) cb.set(k, v / 2);
  return cb;
}

export function computePageRank(graph: GraphIndex, iterations = 24, damping = 0.85): Map<string, number> {
  const n = graph.nodeList.length;
  const rank = new Map<string, number>();
  if (n === 0) return rank;
  for (const node of graph.nodeList) rank.set(node.id, 1 / n);

  for (let i = 0; i < iterations; i += 1) {
    const next = new Map<string, number>();
    let dangling = 0;
    for (const node of graph.nodeList) {
      const out = graph.adjacency.get(node.id) ?? [];
      if (out.length === 0) dangling += rank.get(node.id) ?? 0;
    }
    for (const node of graph.nodeList) {
      let sum = 0;
      for (const { neighborId, direction } of graph.adjacency.get(node.id) ?? []) {
        const outs = graph.adjacency.get(neighborId)?.length || 1;
        // 有向图尊重方向；无向边双向计入
        const contributes = direction === 'in' ? rank.get(neighborId)! / outs : rank.get(neighborId)! / outs;
        sum += contributes;
      }
      next.set(node.id, (1 - damping) / n + damping * (sum + dangling / n));
    }
    for (const [k, v] of next) rank.set(k, v);
  }
  return rank;
}

/* -------------------------------------------------------------------------- */
/*                        时序关系状态机（截面推演）                            */
/* -------------------------------------------------------------------------- */

/**
 * 给定某一公元年份，返回该关系当时所处的阶段。
 * 若该年不落在任何阶段区间内，返回 null（表示当年尚无交集或交集已终结）。
 */
export function edgePhaseAt(edge: HistoricalRelationEdge, year: number): TemporalRelationPhase | null {
  const phases = edge.temporalPhases;
  if (!phases?.length) return null;
  for (const phase of phases) {
    const start = phase.startYear ?? -Infinity;
    const end = phase.endYear ?? Infinity;
    if (year >= start && year <= end) return phase;
  }
  return null;
}

/** 该年在截面视图中应显示的关系类别（阶段优先，退回主类别） */
export function edgeCategoryAt(edge: HistoricalRelationEdge, year: number): RelationCategory {
  return edgePhaseAt(edge, year)?.category ?? edge.primaryCategory;
}

/** 两人是否在该年份「历史性地同在」——用于单年截面的节点隐退判定 */
export function isPersonAliveAt(
  person: HistoricalPersonNode,
  year: number,
  options: { softWindow?: number } = {},
): boolean {
  const soft = options.softWindow ?? 0;
  const birth = person.birthYear;
  const death = person.deathYear;
  if (typeof birth === 'number' && year < birth - soft) return false;
  if (typeof death === 'number' && year > death + soft) return false;
  return true;
}

/** 人物活跃期（生年 ~ 卒年），缺项时退回首末事件年份 */
export function personActiveRange(person: HistoricalPersonNode): [number, number] {
  if (typeof person.birthYear === 'number' && typeof person.deathYear === 'number') {
    return [person.birthYear, person.deathYear];
  }
  const years = person.lifeTimeline.map((e) => e.year);
  if (years.length) {
    const min = Math.min(...years);
    const max = Math.max(...years);
    return [person.birthYear ?? min, person.deathYear ?? max];
  }
  return [person.birthYear ?? 0, person.deathYear ?? 0];
}

/* -------------------------------------------------------------------------- */
/*                                 统计                                       */
/* -------------------------------------------------------------------------- */

export interface GraphStats {
  personCount: number;
  edgeCount: number;
  avgDegree: number;
  maxDegree: { id: string; value: number } | null;
  density: number;
  componentCount: number;
  largestComponent: number;
}

export function computeGraphStats(graph: GraphIndex): GraphStats {
  const n = graph.nodeList.length;
  const e = graph.edges.length;
  let maxId: string | null = null;
  let maxDeg = 0;
  let sum = 0;
  for (const [id, deg] of graph.degree) {
    sum += deg;
    if (deg > maxDeg) {
      maxDeg = deg;
      maxId = id;
    }
  }

  const seen = new Set<string>();
  let components = 0;
  let largest = 0;
  for (const node of graph.nodeList) {
    if (seen.has(node.id)) continue;
    components += 1;
    let size = 0;
    const queue = [node.id];
    seen.add(node.id);
    while (queue.length) {
      const cur = queue.shift()!;
      size += 1;
      for (const { neighborId } of graph.adjacency.get(cur) ?? []) {
        if (!seen.has(neighborId)) {
          seen.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
    largest = Math.max(largest, size);
  }

  return {
    personCount: n,
    edgeCount: e,
    avgDegree: n ? sum / n : 0,
    maxDegree: maxId ? { id: maxId, value: maxDeg } : null,
    density: n > 1 ? (2 * e) / (n * (n - 1)) : 0,
    componentCount: components,
    largestComponent: largest,
  };
}
