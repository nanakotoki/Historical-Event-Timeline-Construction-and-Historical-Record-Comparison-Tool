/**
 * 分片异步加载器 · 内存合并 · 时间轴切片过滤
 * ------------------------------------------------------------------
 * 数据架构：`manifest.json`（轻量索引） + `shards/*.json`（按时代切分）
 *  - 首屏只依赖 manifest（<40KB），用于渲染朝代胶囊、统计与全局姓名索引
 *  - 分片按需 fetch 并缓存于内存（可选写入 IndexedDB 长期缓存）
 *  - 合并后构建一次 GraphIndex，供全部视图复用
 */
import type {
  DynastyId,
  GraphManifest,
  HistoricalPersonNode,
  HistoricalRelationEdge,
  ShardDataset,
  TimeWindow,
} from '@/types/history';
import { buildGraphIndex, type GraphIndex, isPersonAliveAt } from './graph-algorithms';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function asset(path: string): string {
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}

const shardCache = new Map<string, Promise<ShardDataset>>();

export async function loadManifest(): Promise<GraphManifest> {
  const res = await fetch(asset('/data/manifest.json'), { cache: 'force-cache' });
  if (!res.ok) throw new Error(`清单加载失败：HTTP ${res.status}`);
  return (await res.json()) as GraphManifest;
}

export function loadShard(file: string): Promise<ShardDataset> {
  const cached = shardCache.get(file);
  if (cached) return cached;
  const task = (async () => {
    const res = await fetch(asset(`/data/shards/${file}`), { cache: 'force-cache' });
    if (!res.ok) throw new Error(`分片 ${file} 加载失败：HTTP ${res.status}`);
    return (await res.json()) as ShardDataset;
  })();
  shardCache.set(file, task);
  // 失败后允许重试，避免缓存住 rejected promise
  task.catch(() => shardCache.delete(file));
  return task;
}

export interface MergedDataset {
  nodes: HistoricalPersonNode[];
  edges: HistoricalRelationEdge[];
  nodeMap: Map<string, HistoricalPersonNode>;
  edgeMap: Map<string, HistoricalRelationEdge>;
  graph: GraphIndex;
  shards: ShardDataset[];
}

/** 合并多个分片，按 id 去重（后加载者不覆盖先加载者，但补齐缺失字段） */
export function mergeShards(shards: ShardDataset[]): MergedDataset {
  const nodeMap = new Map<string, HistoricalPersonNode>();
  const edgeMap = new Map<string, HistoricalRelationEdge>();

  for (const shard of shards) {
    for (const node of shard.nodes) {
      const existing = nodeMap.get(node.id);
      nodeMap.set(node.id, existing ? { ...existing, ...node } : node);
    }
    for (const edge of shard.edges) {
      edgeMap.set(edge.id, edge);
    }
  }

  const nodes = [...nodeMap.values()];
  const edges = [...edgeMap.values()];
  return { nodes, edges, nodeMap, edgeMap, graph: buildGraphIndex(nodes, edges), shards };
}

/**
 * 时间窗口过滤。
 * - 普通区间：保留与窗口有交集的人物/关系
 * - 单年截面：剔除未出生与已逝世者，并按 temporalPhases 保留当年「正在发生」的关系
 */
export function filterByTimeWindow(
  dataset: MergedDataset,
  window: TimeWindow,
): { nodes: HistoricalPersonNode[]; edges: HistoricalRelationEdge[]; fadedNodeIds: Set<string> } {
  const { startYear, endYear, singleYearMode } = window;

  if (singleYearMode) {
    const faded = new Set<string>();
    const alive: HistoricalPersonNode[] = [];
    for (const node of dataset.nodes) {
      if (isPersonAliveAt(node, startYear, { softWindow: 0 })) alive.push(node);
      else faded.add(node.id);
    }
    const aliveIds = new Set(alive.map((n) => n.id));
    const edges = dataset.edges.filter((edge) => {
      if (!aliveIds.has(edge.source) || !aliveIds.has(edge.target)) return false;
      const start = edge.startYear ?? -Infinity;
      const end = edge.endYear ?? Infinity;
      return startYear >= start && startYear <= end;
    });
    return { nodes: alive, edges, fadedNodeIds: faded };
  }

  const nodes = dataset.nodes.filter((node) => {
    const birth = node.birthYear ?? -Infinity;
    const death = node.deathYear ?? Infinity;
    return birth <= endYear && death >= startYear;
  });
  const visible = new Set(nodes.map((n) => n.id));
  const edges = dataset.edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target));
  const faded = new Set(dataset.nodes.filter((n) => !visible.has(n.id)).map((n) => n.id));
  return { nodes, edges, fadedNodeIds: faded };
}

/* -------------------------------------------------------------------------- */
/*                           IndexedDB 长期缓存（可选）                        */
/* -------------------------------------------------------------------------- */

const DB_NAME = 'chronograph-china';
const STORE = 'shards';

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function readCachedShard(file: string): Promise<ShardDataset | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(file);
      req.onsuccess = () => resolve((req.result as ShardDataset) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function writeCachedShard(file: string, data: ShardDataset): Promise<void> {
  const db = await openDB();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(data, file);
  } catch {
    /* 存储配额不足时静默降级为纯内存缓存 */
  }
}

/** 带缓存的加载：先读 IndexedDB，再回退网络 */
export async function loadShardCached(file: string): Promise<ShardDataset> {
  const cached = await readCachedShard(file);
  if (cached) return cached;
  const data = await loadShard(file);
  void writeCachedShard(file, data);
  return data;
}

/* -------------------------------------------------------------------------- */
/*                                  工具                                       */
/* -------------------------------------------------------------------------- */

export const DYNASTY_ORDER: DynastyId[] = [
  'pre_qin',
  'qin',
  'chu_han',
  'western_han',
  'xin',
  'eastern_han',
  'three_kingdoms',
  'jin',
  'southern_northern',
  'sui',
  'tang',
  'five_dynasties',
  'song',
  'liao_jin_xia',
  'yuan',
  'ming',
  'qing',
];

export function formatYear(year: number | undefined): string {
  if (typeof year !== 'number') return '不详';
  return year < 0 ? `前${Math.abs(year)}` : `${year}`;
}

export function formatYearFull(year: number | undefined): string {
  if (typeof year !== 'number') return '史载不详';
  return year < 0 ? `公元前 ${Math.abs(year)} 年` : `公元 ${year} 年`;
}

export function formatLifespan(person: HistoricalPersonNode): string {
  const { birthYear, deathYear, birthYearUncertain } = person;
  const prefix = birthYearUncertain ? '约 ' : '';
  if (typeof birthYear === 'number' && typeof deathYear === 'number') {
    return `${prefix}${formatYear(birthYear)} — ${formatYear(deathYear)}`;
  }
  if (typeof deathYear === 'number') return `? — ${formatYear(deathYear)}`;
  if (typeof birthYear === 'number') return `${prefix}${formatYear(birthYear)} — ?`;
  return '生卒年史载不详';
}
