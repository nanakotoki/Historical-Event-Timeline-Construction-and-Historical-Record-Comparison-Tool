'use client';

/**
 * 渲染压力自检台（/bench）
 * ------------------------------------------------------------------
 * 规范里有一条硬指标：Canvas 在 **500 节点以上**仍须守住 60FPS。
 * 种子库三个分片各 143~155 人，光看首页永远验证不到这个上限，所以这里做一件事——
 * 把三个真实分片整体复制若干份（人物、关系、画像全是真数据，只是换个 id），
 * 按 1 / 3 / 5 / 7 倍拼到千级乃至万级节点，再用真实画布跑一段持续重绘，量出每帧耗时。
 *
 * 之所以复制真数据而不是随机生成：随机点的姓名长度、权重分布、画像数量
 * 都和实际不符，测出来的数字好看却没有参考价值。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Gauge, Loader2, Play } from 'lucide-react';
import { HistoryGraphCanvas } from '@/components/canvas/HistoryGraphCanvas';
import { buildGraphIndex } from '@/lib/graph-algorithms';
import { computeLayout } from '@/lib/graph-layout';
import { DYNASTY_ORDER, loadManifest, loadShardCached, mergeShards } from '@/lib/data-loader';
import { dynastyName } from '@/data/dynasties';
import type {
  HistoricalPersonNode,
  HistoricalRelationEdge,
  RelationCategory,
  ShardDataset,
} from '@/types/history';

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

const MULTIPLIERS = [1, 3, 5, 7] as const;

interface BenchStats {
  nodes: number;
  edges: number;
  layoutMs: number;
  avgFps: number;
  worstFrameMs: number;
  p95FrameMs: number;
  frames: number;
}

/**
 * 把真实分片复制 k 份。
 * 复本之间不连边——这一点是刻意的：跨复本的假关系会让力导向把整图拉成一团，
 * 测出来的布局耗时与真实单图不可比。每份复本内部保持原有拓扑。
 */
function replicate(shards: ShardDataset[], copies: number) {
  const nodes: HistoricalPersonNode[] = [];
  const edges: HistoricalRelationEdge[] = [];
  for (let c = 0; c < copies; c += 1) {
    const suffix = c === 0 ? '' : `·${c + 1}`;
    for (const shard of shards) {
      for (const node of shard.nodes) {
        nodes.push({
          ...node,
          id: c === 0 ? node.id : `${node.id}__r${c}`,
          name: `${node.name}${suffix}`,
        });
      }
      for (const edge of shard.edges) {
        edges.push({
          ...edge,
          id: c === 0 ? edge.id : `${edge.id}__r${c}`,
          source: c === 0 ? edge.source : `${edge.source}__r${c}`,
          target: c === 0 ? edge.target : `${edge.target}__r${c}`,
        });
      }
    }
  }
  return { nodes, edges };
}

export default function BenchPage() {
  const [shards, setShards] = useState<ShardDataset[] | null>(null);
  const [copies, setCopies] = useState<number>(7);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<BenchStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scaleInfo, setScaleInfo] = useState({ scale: 1, lod: 1 as 0 | 1 | 2, visibleNodes: 0 });
  const [fitToken, setFitToken] = useState(0);

  /* ------------------------------ 载入真数据 ------------------------------ */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const manifest = await loadManifest();
        const loaded = await Promise.all(
          manifest.shards.map((shard) => loadShardCached(shard.file ?? `${shard.shardId}.json`)),
        );
        if (alive) setShards(loaded);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ---------------------------- 放大后的图数据 ---------------------------- */
  const scaled = useMemo(() => {
    if (!shards) return null;
    const { nodes, edges } = replicate(shards, copies);
    const merged = mergeShards([
      {
        shardId: 'bench',
        title: '压力自检',
        subtitle: `${copies} 份复本`,
        dynasties: DYNASTY_ORDER,
        yearRange: [0, 1000],
        heroPersonIds: [],
        nodes,
        edges,
      },
    ]);
    const t0 = performance.now();
    const graph = buildGraphIndex(merged.nodes, merged.edges);
    const layout = computeLayout('force', merged.nodes, merged.edges, graph, {
      dynastyOrder: DYNASTY_ORDER,
      dynastyLabel: dynastyName,
    });
    return { ...merged, graph, layout, layoutMs: performance.now() - t0 };
  }, [shards, copies]);

  /* ------------------------------ FPS 采样 ------------------------------ */
  const rafRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    setStats(null);
    setRunning(true);
    const frameTimes: number[] = [];
    let last = performance.now();
    const deadline = last + 4000;

    const tick = () => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      // 首帧与切页回来的超长间隔不计入（那是浏览器在等绘制，不是画布慢）
      if (delta < 400) frameTimes.push(delta);
      if (now < deadline) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const sorted = [...frameTimes].sort((a, b) => a - b);
      const total = frameTimes.reduce((sum, v) => sum + v, 0);
      const avg = total / Math.max(1, frameTimes.length);
      setStats({
        nodes: scaled?.nodes.length ?? 0,
        edges: scaled?.edges.length ?? 0,
        layoutMs: scaled?.layoutMs ?? 0,
        avgFps: 1000 / avg,
        worstFrameMs: sorted[sorted.length - 1] ?? 0,
        p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        frames: frameTimes.length,
      });
      setRunning(false);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [scaled]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  /**
   * 让画布持续重绘：寻路流光一旦存在，渲染循环就不再等脏标记，
   * 每一帧都会重画全部可见节点与边。这正是要压的场景。
   */
  const pathNodeIds = useMemo(() => {
    if (!scaled) return null;
    return scaled.nodes.slice(0, 40).map((node) => node.id);
  }, [scaled]);

  const relationFilter = useMemo(() => new Set(ALL_CATEGORIES), []);

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2">
        <Link
          href="/"
          className="tool-btn inline-flex items-center gap-1 px-2 py-1 text-[11px]"
          title="返回图谱"
        >
          <ArrowLeft size={12} /> 返回
        </Link>
        <h1 className="inline-flex items-center gap-1.5 font-serif text-[14px] font-semibold text-ink">
          <Gauge size={14} className="text-cinnabar" /> 渲染压力自检
        </h1>
        <span className="text-[10.5px] text-ink-3">
          真实分片复制 {copies} 份，量持续重绘下的帧间隔
        </span>
        <span className="text-[10px] text-ink-3/80" title="同一页面内连测两次，第二次通常明显低于第一次">
          连测两次取后值：首测可能量到画布尚未进入流光重绘的空转帧
        </span>

        <div className="ml-auto flex items-center gap-1">
          {MULTIPLIERS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setCopies(m);
                setStats(null);
                setFitToken((v) => v + 1);
              }}
              data-active={copies === m}
              className="tool-btn px-2 py-1 text-[10.5px]"
            >
              ×{m}
            </button>
          ))}
          <button
            type="button"
            onClick={measure}
            disabled={!scaled || running}
            className="tool-btn ml-1 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] disabled:opacity-40"
          >
            {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
            {running ? '采样中…' : '开始采样'}
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {!scaled ? (
          <div className="flex h-full items-center justify-center gap-2 text-[12px] text-ink-3">
            <Loader2 size={13} className="animate-spin" />
            {error ? `加载失败：${error}` : '正在装配压力数据…'}
          </div>
        ) : (
          <HistoryGraphCanvas
            nodes={scaled.nodes}
            edges={scaled.edges}
            graph={scaled.graph}
            layout={scaled.layout}
            layoutMode="force"
            year={null}
            selectedId={null}
            egoNodeIds={null}
            egoEdgeIds={null}
            pathNodeIds={pathNodeIds}
            relationFilter={relationFilter}
            onSelectPerson={() => undefined}
            onSelectEdge={() => undefined}
            onClearSelection={() => undefined}
            focusRequest={null}
            fitToken={fitToken}
            onScaleChange={setScaleInfo}
          />
        )}

        {scaled ? (
          <div className="panel pointer-events-none absolute bottom-4 left-4 w-[268px] px-3 py-2.5">
            <p className="font-serif text-[11px] font-semibold text-ink">采样结果</p>
            <dl className="mt-1.5 space-y-1 text-[10.5px] text-ink-2">
              <Row label="节点 / 关系" value={`${scaled.nodes.length} / ${scaled.edges.length}`} />
              <Row label="力导向布局" value={`${scaled.layoutMs.toFixed(0)} ms（一次性）`} />
              <Row
                label="当前缩放 / LOD"
                value={`${scaleInfo.scale.toFixed(2)}× · ${['宏观', '中观', '微观'][scaleInfo.lod]}`}
              />
              <Row label="屏内节点" value={`${scaleInfo.visibleNodes}`} />
              {stats ? (
                <>
                  <div className="my-1 border-t border-line" />
                  <Row
                    label="平均帧率"
                    value={`${stats.avgFps.toFixed(1)} FPS`}
                    tone={stats.avgFps >= 55 ? 'good' : stats.avgFps >= 40 ? 'warn' : 'bad'}
                  />
                  <Row label="p95 帧间隔" value={`${stats.p95FrameMs.toFixed(1)} ms`} />
                  <Row label="最慢一帧" value={`${stats.worstFrameMs.toFixed(1)} ms`} />
                  <Row label="样本帧数" value={`${stats.frames}`} />
                </>
              ) : (
                <p className="pt-1 text-[10px] leading-relaxed text-ink-3">
                  点「开始采样」后持续重绘 4 秒；寻路流光存在时画布每帧全量重画，
                  这是最不利的情形。
                </p>
              )}
            </dl>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'warn' | 'bad';
}) {
  const color =
    tone === 'good' ? 'text-jade' : tone === 'warn' ? 'text-gold' : tone === 'bad' ? 'text-cinnabar' : '';
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className={`font-mono ${color || 'text-ink'}`}>{value}</dd>
    </div>
  );
}
