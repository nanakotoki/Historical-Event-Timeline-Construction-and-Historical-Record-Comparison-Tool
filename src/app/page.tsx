'use client';

/**
 * 华夏史网 · 主工作台
 * ------------------------------------------------------------------
 * 数据流：
 *   manifest.json（轻量索引）
 *     → 按需 loadShardCached（IndexedDB + 内存双层缓存）
 *     → mergeShards 合并为单一图谱 + GraphIndex
 *     → 三态布局（力导向 / 宗法世系 / 纪年泳道）
 *     → 时间窗切片（区间 / 单年截面）
 *     → Canvas 渲染（三级语义 LOD + 视口裁剪）
 *
 * 交互闭环：
 *   顶栏分片开关 · ⌘K 检索 · 六度寻路 · 画布点击 → 档案抽屉 → 实体跳转
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter, Link2, Loader2, X } from 'lucide-react';
import type {
  GraphLayoutMode,
  GraphManifest,
  HistoricalRelationEdge,
  RelationCategory,
  ShardDataset,
  TimeWindow,
} from '@/types/history';
import { DYNASTY_ORDER, filterByTimeWindow, loadManifest, loadShardCached, mergeShards } from '@/lib/data-loader';
import { buildGraphIndex, getEgoNetwork } from '@/lib/graph-algorithms';
import { computeLayout, type LayoutResult } from '@/lib/graph-layout';
import { HistorySearchEngine, RELATION_META } from '@/lib/search-engine';
import { dynastyName } from '@/data/dynasties';
import { HistoryGraphCanvas } from '@/components/canvas/HistoryGraphCanvas';
import { GraphLegendAndControls } from '@/components/canvas/GraphLegendAndControls';
import { EdgeRelationModal } from '@/components/canvas/EdgeRelationModal';
import { PersonDetailDrawer } from '@/components/drawer/PersonDetailDrawer';
import { TopOmniBar } from '@/components/toolbar/TopOmniBar';
import { SearchCommandPalette } from '@/components/toolbar/SearchCommandPalette';
import { PathfindingModal } from '@/components/toolbar/PathfindingModal';
import { BottomTimelineBar, type DynastySpan } from '@/components/timeline/BottomTimelineBar';
import { prefetchPortraits } from '@/lib/portrait-resolver';

const EMPTY_LAYOUT: LayoutResult = {
  positions: new Map(),
  bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  lanes: [],
};

const ALL_CATEGORIES: RelationCategory[] = [
  'kinship_blood',
  'kinship_marriage',
  'monarch_subject',
  'political_ally',
  'political_rival',
  'military_adversary',
  'mentor_disciple',
  'literary_bosom',
];

export default function HomePage() {
  /* ------------------------------ 数据状态 ------------------------------ */
  const [manifest, setManifest] = useState<GraphManifest | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeShards, setActiveShards] = useState<Set<string>>(new Set());
  const [shardMap, setShardMap] = useState<Record<string, ShardDataset>>({});

  /* ------------------------------ 视图状态 ------------------------------ */
  const [timeWindow, setTimeWindow] = useState<TimeWindow>({ startYear: -300, endYear: 800, singleYearMode: false });
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>('force');
  const [relationFilter, setRelationFilter] = useState<Set<RelationCategory>>(new Set(ALL_CATEGORIES));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<HistoricalRelationEdge | null>(null);
  const [egoDegree, setEgoDegree] = useState<0 | 1 | 2>(1);
  /** Ego 聚焦的「只看某几类关系」，空集表示不限 */
  const [egoCategories, setEgoCategories] = useState<Set<RelationCategory>>(new Set());
  const [highlightPath, setHighlightPath] = useState<{ nodeIds: string[]; token: number } | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; token: number } | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [scaleInfo, setScaleInfo] = useState({ scale: 1, lod: 1 as 0 | 1 | 2, visibleNodes: 0 });

  const [searchOpen, setSearchOpen] = useState(false);
  const [pathOpen, setPathOpen] = useState(false);
  const [pathFrom, setPathFrom] = useState<string | null>(null);

  const activeKey = useMemo(() => [...activeShards].sort().join('|'), [activeShards]);

  /* ------------------------------ 清单加载 ------------------------------ */
  useEffect(() => {
    let cancelled = false;
    loadManifest()
      .then((data) => {
        if (cancelled) return;
        setManifest(data);
        setActiveShards(new Set(data.shards.map((shard) => shard.shardId)));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFatal(error instanceof Error ? error.message : '数据清单加载失败');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------ 分片加载 ------------------------------ */
  useEffect(() => {
    if (!manifest) return;
    const targets = manifest.shards.filter((shard) => activeShards.has(shard.shardId));
    if (!targets.length) {
      setLoading(false);
      return;
    }
    const missing = targets.filter((shard) => !shardMap[shard.file]);
    if (!missing.length) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(missing.map((shard) => loadShardCached(shard.file)))
      .then((datasets) => {
        if (cancelled) return;
        setShardMap((prev) => {
          const next = { ...prev };
          for (const dataset of datasets) next[dataset.shardId] = dataset;
          return next;
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFatal(error instanceof Error ? error.message : '分片加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // shardMap 仅作为「已加载」判据使用，避免其变化触发重复加载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, activeKey]);

  /* -------------------------------- 合并 -------------------------------- */
  const dataset = useMemo(() => {
    const active = Object.values(shardMap).filter((shard) => activeShards.has(shard.shardId));
    if (!active.length) return null;
    return mergeShards(active);
  }, [shardMap, activeKey, activeShards]);

  const range = useMemo<[number, number] | null>(() => {
    if (!manifest) return null;
    const shards = manifest.shards.filter((shard) => activeShards.has(shard.shardId));
    if (!shards.length) return null;
    return [
      Math.min(...shards.map((shard) => shard.yearRange[0])),
      Math.max(...shards.map((shard) => shard.yearRange[1])),
    ];
  }, [manifest, activeKey, activeShards]);

  /* 分片组合变化时把时间窗复位到全域 */
  useEffect(() => {
    if (!range) return;
    setTimeWindow({ startYear: range[0], endYear: range[1], singleYearMode: false });
    setHighlightPath(null);
  }, [activeKey, range?.[0], range?.[1]]);

  useEffect(() => {
    if (dataset) prefetchPortraits(dataset.nodes);
  }, [dataset]);

  /* ------------------------------ 派生视图 ------------------------------ */
  const filtered = useMemo(() => {
    if (!dataset) return { nodes: [], edges: [], fadedNodeIds: new Set<string>() };
    return filterByTimeWindow(dataset, timeWindow);
  }, [dataset, timeWindow]);

  const viewGraph = useMemo(
    () => buildGraphIndex(filtered.nodes, filtered.edges),
    [filtered],
  );

  /**
   * 布局基于「全量数据」而非时间切片结果：
   * 拖动年份滑块时节点坐标保持稳定，仅显隐变化，避免每年重算力导向。
   */
  const layout = useMemo<LayoutResult>(() => {
    if (!dataset) return EMPTY_LAYOUT;
    return computeLayout(layoutMode, dataset.nodes, dataset.edges, dataset.graph, {
      dynastyOrder: DYNASTY_ORDER,
      dynastyLabel: dynastyName,
    });
  }, [dataset, layoutMode]);

  const searchEngine = useMemo(() => (dataset ? new HistorySearchEngine(dataset.nodes) : null), [dataset]);

  /** 当前选中者身上实际存在的关系类型（用于悬浮条只列出有意义的筛选项） */
  const egoCategoryOptions = useMemo<RelationCategory[]>(() => {
    if (!dataset || !selectedId) return [];
    const present = new Set<RelationCategory>();
    for (const edge of dataset.edges) {
      if (edge.source === selectedId || edge.target === selectedId) present.add(edge.primaryCategory);
    }
    return ALL_CATEGORIES.filter((category) => present.has(category));
  }, [dataset, selectedId]);

  const ego = useMemo(() => {
    if (highlightPath) {
      const nodeIds = new Set(highlightPath.nodeIds);
      const edgeIds = new Set<string>();
      for (const edge of filtered.edges) {
        if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) edgeIds.add(edge.id);
      }
      return { nodeIds, edgeIds };
    }
    if (egoDegree > 0 && selectedId && dataset) {
      /**
       * 「只看此人的血亲 / 政敌」：先在边层面按类别裁剪成子图，再在其上取 Ego。
       * 若在结果上事后删边，二度节点会由别的路径混进来，语义就不干净了。
       */
      let graphForEgo = dataset.graph;
      if (egoCategories.size) {
        const allowed = dataset.edges.filter((edge) => egoCategories.has(edge.primaryCategory));
        graphForEgo = buildGraphIndex(dataset.nodes, allowed);
      }
      const network = getEgoNetwork(graphForEgo, selectedId, egoDegree as 1 | 2);
      return { nodeIds: network.nodeIds, edgeIds: network.edgeIds };
    }
    return null;
  }, [highlightPath, egoDegree, egoCategories, selectedId, dataset, filtered.edges]);

  const dynastySpans = useMemo<DynastySpan[]>(() => {
    if (!manifest || !range) return [];
    const files = new Set(
      manifest.shards.filter((shard) => activeShards.has(shard.shardId)).map((shard) => shard.file),
    );
    return manifest.dynasties
      .filter((dynasty) => files.has(dynasty.shardFile))
      .map((dynasty) => ({
        id: dynasty.id,
        name: dynasty.name,
        start: Math.max(range[0], dynasty.startYear),
        end: Math.min(range[1], dynasty.endYear),
        color: dynasty.primaryColor,
      }))
      .filter((span) => span.end > span.start);
  }, [manifest, activeKey, activeShards, range]);

  const selectedPerson = selectedId && dataset ? dataset.nodeMap.get(selectedId) ?? null : null;

  /* -------------------------------- 行为 -------------------------------- */
  const handleToggleShard = useCallback((shardId: string) => {
    setActiveShards((prev) => {
      const next = new Set(prev);
      if (next.has(shardId)) {
        if (next.size > 1) next.delete(shardId);
      } else {
        next.add(shardId);
      }
      return next;
    });
  }, []);

  const jumpToPerson = useCallback((id: string) => {
    setSelectedEdge(null);
    setSelectedId(id);
    setHighlightPath(null);
    setEgoCategories(new Set());
    setFocusRequest({ id, token: Date.now() });
  }, []);

  const handleSelectPerson = useCallback((id: string) => {
    setSelectedEdge(null);
    setEgoCategories(new Set());
    setSelectedId(id);
    // 规范要求单击即以该人为中心平滑聚焦；重复点同一人不重复推镜头，
    // 否则每点一次画面就跳一下，读图时很难受。
    setFocusRequest((prev) => (prev?.id === id ? prev : { id, token: Date.now() }));
  }, []);

  const handleSelectEdge = useCallback((edge: HistoricalRelationEdge) => {
    setSelectedEdge(edge);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedId(null);
    setSelectedEdge(null);
    setHighlightPath(null);
  }, []);

  const handleToggleCategory = useCallback((category: RelationCategory) => {
    setRelationFilter((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback((on: boolean) => {
    setRelationFilter(on ? new Set(ALL_CATEGORIES) : new Set());
  }, []);

  const handleZoom = useCallback((factor: number) => {
    // 通过合成滚轮事件驱动画布内相机，保持单一真源
    window.dispatchEvent(new CustomEvent('chronograph:zoom', { detail: factor }));
  }, []);

  const handleApplyPath = useCallback((nodeIds: string[]) => {
    setHighlightPath({ nodeIds, token: Date.now() });
    setPathOpen(false);
    setFocusRequest({ id: nodeIds[0], token: Date.now() });
  }, []);

  /* 快捷键 */
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ------------------------------ 骨架 / 错误 --------------------------- */
  if (fatal) {
    return (
      <main className="flex h-screen items-center justify-center bg-canvas px-6">
        <div className="panel max-w-md px-6 py-8 text-center">
          <span className="seal mx-auto mb-3 flex h-10 w-10 text-[22px]">史</span>
          <h1 className="font-serif text-[17px] font-semibold text-ink">数据加载失败</h1>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-2">{fatal}</p>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
            请先执行 <code className="rounded bg-surface-2 px-1 py-[1px] font-mono text-[10.5px]">npm run seed:build</code>{' '}
            生成 <code className="rounded bg-surface-2 px-1 py-[1px] font-mono text-[10.5px]">public/data/</code> 后再启动。
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <TopOmniBar
        manifest={manifest}
        activeShards={activeShards}
        onToggleShard={handleToggleShard}
        loading={loading}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenPath={() => setPathOpen(true)}
        onFit={() => setFitToken((v) => v + 1)}
        visibleCount={scaleInfo.visibleNodes}
      />

      <main className="relative min-h-0 flex-1">
        {dataset && layout.positions.size ? (
          <HistoryGraphCanvas
            nodes={filtered.nodes}
            edges={filtered.edges}
            graph={viewGraph}
            layout={layout}
            layoutMode={layoutMode}
            year={timeWindow.singleYearMode ? timeWindow.startYear : null}
            selectedId={selectedId}
            egoNodeIds={ego?.nodeIds ?? null}
            egoEdgeIds={ego?.edgeIds ?? null}
            pathNodeIds={highlightPath?.nodeIds ?? null}
            relationFilter={relationFilter}
            onSelectPerson={handleSelectPerson}
            onSelectEdge={handleSelectEdge}
            onClearSelection={handleClearSelection}
            focusRequest={focusRequest}
            fitToken={fitToken}
            rightInset={selectedId ? 500 : 0}
            onScaleChange={setScaleInfo}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Loader2 size={22} className="mx-auto animate-spin text-cinnabar/70" />
              <p className="mt-3 font-serif text-[13px] text-ink-2">
                {loading ? '正在编译图谱…' : '请至少选择一个时代分片'}
              </p>
              <p className="mt-1 text-[10.5px] text-ink-3">
                数据来源：public/data/manifest.json → shards/*.json
              </p>
            </div>
          </div>
        )}

        <GraphLegendAndControls
          layoutMode={layoutMode}
          onLayoutChange={setLayoutMode}
          relationFilter={relationFilter}
          onToggleCategory={handleToggleCategory}
          onToggleAll={handleToggleAll}
          onZoomIn={() => handleZoom(1.25)}
          onZoomOut={() => handleZoom(0.8)}
          onFit={() => setFitToken((v) => v + 1)}
          scale={scaleInfo.scale}
          lod={scaleInfo.lod}
          visibleNodes={scaleInfo.visibleNodes}
          totalNodes={filtered.nodes.length}
        />

        {/* 左上：Ego 聚焦与关系链提示 */}
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-2">
          {selectedId ? (
            <div className="panel pointer-events-auto flex items-center gap-1.5 px-2 py-1.5">
              <Filter size={11} className="text-ink-3" />
              <span className="text-[10px] text-ink-3">Ego 聚焦</span>
              {([0, 1, 2] as const).map((degree) => (
                <button
                  key={degree}
                  type="button"
                  onClick={() => setEgoDegree(degree)}
                  data-active={egoDegree === degree && !highlightPath}
                  className="tool-btn px-1.5 py-[1px] text-[10px] data-[active=true]:border-cinnabar/55 data-[active=true]:bg-cinnabar/10 data-[active=true]:text-cinnabar"
                >
                  {degree === 0 ? '关' : `${degree} 度`}
                </button>
              ))}
            </div>
          ) : null}

          {selectedId && egoDegree > 0 && egoCategoryOptions.length > 1 ? (
            <div className="panel pointer-events-auto flex max-w-[260px] flex-wrap items-center gap-1 px-2 py-1.5">
              <span className="text-[10px] text-ink-3">只看</span>
              {egoCategoryOptions.map((category) => {
                const meta = RELATION_META[category];
                const active = egoCategories.has(category);
                return (
                  <button
                    key={category}
                    type="button"
                    title={meta.description}
                    onClick={() =>
                      setEgoCategories((prev) => {
                        const next = new Set(prev);
                        if (next.has(category)) next.delete(category);
                        else next.add(category);
                        return next;
                      })
                    }
                    className="rounded-[3px] px-1.5 py-[1px] text-[10px] transition-colors"
                    style={{
                      color: active ? meta.color : undefined,
                      background: active ? `${meta.color}16` : undefined,
                      border: `1px solid ${active ? `${meta.color}66` : 'rgb(var(--c-line))'}`,
                    }}
                  >
                    {meta.short}
                  </button>
                );
              })}
              {egoCategories.size ? (
                <button
                  type="button"
                  onClick={() => setEgoCategories(new Set())}
                  className="ml-auto text-[10px] text-ink-3 transition-colors hover:text-cinnabar"
                >
                  重置
                </button>
              ) : null}
            </div>
          ) : null}

          {highlightPath ? (
            <div className="panel pointer-events-auto flex items-center gap-2 px-2.5 py-1.5">
              <Link2 size={11} className="text-cinnabar" />
              <span className="text-[10.5px] text-ink-2">
                已聚焦关系链 · {highlightPath.nodeIds.length} 人
              </span>
              <button
                type="button"
                onClick={() => setHighlightPath(null)}
                className="text-ink-3 transition-colors hover:text-cinnabar"
                aria-label="清除关系链聚焦"
              >
                <X size={11} />
              </button>
            </div>
          ) : null}
        </div>

        {/* 抽屉 */}
        <PersonDetailDrawer
          person={selectedPerson}
          persons={dataset?.nodes ?? []}
          graph={viewGraph}
          onClose={() => setSelectedId(null)}
          onJumpPerson={jumpToPerson}
          onFocusPerson={(id) => setFocusRequest({ id, token: Date.now() })}
          onStartPath={(id) => {
            setPathFrom(id);
            setPathOpen(true);
          }}
        />

        {/* 连线详考 */}
        <EdgeRelationModal
          edge={selectedEdge}
          nodeMap={dataset?.nodeMap ?? new Map()}
          onClose={() => setSelectedEdge(null)}
          onJumpPerson={jumpToPerson}
        />
      </main>

      {range ? (
        <BottomTimelineBar
          range={range}
          window={timeWindow}
          onChange={setTimeWindow}
          dynastySpans={dynastySpans}
          visibleCount={filtered.nodes.length}
        />
      ) : null}

      {/* 全局弹层 */}
      <SearchCommandPalette
        open={searchOpen}
        engine={searchEngine}
        onClose={() => setSearchOpen(false)}
        onSelect={jumpToPerson}
      />

      <PathfindingModal
        open={pathOpen}
        persons={dataset?.nodes ?? []}
        graph={dataset?.graph ?? viewGraph}
        initialFrom={pathFrom}
        onClose={() => setPathOpen(false)}
        onJumpPerson={jumpToPerson}
        onApplyPath={handleApplyPath}
      />
    </div>
  );
}
