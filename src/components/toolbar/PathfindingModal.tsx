'use client';

/**
 * 六度分隔寻路 + 共同关系圈
 * ------------------------------------------------------------------
 * 以 BFS 在人物关系图上求两条以内的等长最短路（最多 3 条），
 * 逐跳标注该跳的关系性质；同时给出两人的共同关系圈交集。
 */
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftRight, ArrowRight, Route, Sparkles, X } from 'lucide-react';
import type { GraphIndex } from '@/lib/graph-algorithms';
import { findShortestPaths, getCommonNeighbors, getEgoNetwork } from '@/lib/graph-algorithms';
import type { HistoricalPersonNode } from '@/types/history';
import { PersonChip, RelationBadge, SectionLabel } from '@/components/ui/atoms';
import { useTheme } from '@/components/providers/ThemeProvider';

export function PathfindingModal({
  open,
  persons,
  graph,
  initialFrom,
  onClose,
  onJumpPerson,
  onApplyPath,
}: {
  open: boolean;
  persons: HistoricalPersonNode[];
  graph: GraphIndex;
  initialFrom: string | null;
  onClose: () => void;
  onJumpPerson: (id: string) => void;
  onApplyPath: (nodeIds: string[]) => void;
}) {
  const { isDark } = useTheme();
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  const sorted = useMemo(
    () => [...persons].sort((a, b) => b.importanceWeight - a.importanceWeight),
    [persons],
  );

  useEffect(() => {
    if (!open) return;
    const start = initialFrom ?? sorted[0]?.id ?? '';
    setFrom(start);
    setTo((prev) => {
      if (prev && prev !== start) return prev;
      // 默认终点优先取「此人二度以内、中心度最高」的一位：
      // 空着默认跨朝配对，往往直接得到「无连通路径」，白白让人以为数据断了。
      if (start) {
        const near = getEgoNetwork(graph, start, 2).nodeIds;
        const candidate = sorted.find((person) => person.id !== start && near.has(person.id));
        if (candidate) return candidate.id;
      }
      return sorted.find((person) => person.id !== start)?.id ?? '';
    });
  }, [open, initialFrom, sorted, graph]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const paths = useMemo(() => {
    if (!from || !to || from === to) return [];
    return findShortestPaths(graph, from, to, 3);
  }, [graph, from, to]);

  const commons = useMemo(() => {
    if (!from || !to || from === to) return [];
    return getCommonNeighbors(graph, from, to).slice(0, 12);
  }, [graph, from, to]);

  const nameOf = (id: string) => persons.find((p) => p.id === id)?.name ?? id;
  const personOf = (id: string) => persons.find((p) => p.id === id);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[75] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} role="presentation" />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="六度分隔寻路"
            className="panel relative z-10 flex max-h-[86vh] w-full max-w-[720px] flex-col overflow-hidden"
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22 }}
          >
            <header className="flex items-start gap-3 border-b border-line px-5 py-3.5">
              <div>
                <div className="flex items-center gap-1.5">
                  <Route size={14} className="text-cinnabar" />
                  <h2 className="font-serif text-[16px] font-semibold text-ink">六度分隔寻路</h2>
                  <span className="seal px-1.5 py-[1px] text-[9.5px]">关系链</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
                  在两个历史人物之间寻找最短关系链。历史上任意两人，往往只需两三跳便相通。
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-auto rounded p-1 text-ink-3 transition-colors hover:bg-cinnabar/10 hover:text-cinnabar"
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </header>

            <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* 选择器 */}
              <div className="flex items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-[10px] text-ink-3">起点</span>
                  <select
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    className="w-full rounded-md border border-line bg-surface-2/70 px-2 py-1.5 font-serif text-[12.5px] text-ink outline-none focus:border-cinnabar/55"
                  >
                    {sorted.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                        {person.aliases.courtesyName ? `（${person.aliases.courtesyName}）` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setFrom(to);
                    setTo(from);
                  }}
                  className="tool-btn mb-[3px] px-2 py-1.5"
                  title="交换起止"
                >
                  <ArrowLeftRight size={12} />
                </button>

                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-[10px] text-ink-3">终点</span>
                  <select
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    className="w-full rounded-md border border-line bg-surface-2/70 px-2 py-1.5 font-serif text-[12.5px] text-ink outline-none focus:border-cinnabar/55"
                  >
                    {sorted.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                        {person.aliases.courtesyName ? `（${person.aliases.courtesyName}）` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* 路径结果 */}
              <section>
                <SectionLabel
                  extra={
                    from && to && from !== to
                      ? `${paths.length} 条等长最短路 · 最少 ${paths[0]?.hops ?? '—'} 跳`
                      : '请选择两个不同的人物'
                  }
                >
                  关系链
                </SectionLabel>

                {from === to ? (
                  <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-3">
                    起点与终点为同一人。
                  </p>
                ) : paths.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12px] leading-relaxed text-ink-3">
                    两人在现存图谱中不属同一连通分量——没有任何一条关系链把他们连起来。
                    <br />
                    这多半是史实使然：跨时代人物若史书未载直接交集（后裔、隔代师承、转相举荐），
                    本平台不会为了连通性臆造一条边。若二人确属同代，可先在顶部补齐相应朝代分片再试。
                  </p>
                ) : (
                  <ol className="space-y-2.5">
                    {paths.map((path, pathIndex) => (
                      <li key={pathIndex} className="rounded-lg border border-line bg-surface-2/35 px-3 py-2.5">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="rounded-[2px] bg-ink/80 px-1.5 py-[1px] font-serif text-[9.5px] text-canvas">
                            第 {pathIndex + 1} 条
                          </span>
                          <span className="text-[10.5px] text-ink-3">{path.hops} 跳</span>
                          <button
                            type="button"
                            onClick={() => onApplyPath(path.nodeIds)}
                            className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-violet transition-colors hover:text-cinnabar"
                          >
                            <Sparkles size={10} />
                            在画布中聚焦此链
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-y-2">
                          {path.nodeIds.map((nodeId, nodeIndex) => {
                            const person = personOf(nodeId);
                            const edge = path.edges[nodeIndex];
                            return (
                              <span key={`${nodeId}-${nodeIndex}`} className="flex items-center">
                                {person ? (
                                  <PersonChip person={person} onClick={onJumpPerson} compact />
                                ) : (
                                  <span className="text-[11px] text-ink-3">{nameOf(nodeId)}</span>
                                )}
                                {edge ? (
                                  <span className="mx-1 flex flex-col items-center">
                                    <RelationBadge category={edge.primaryCategory} isDark={isDark} size="xs" />
                                    <span className="mt-0.5 inline-flex items-center text-[9px] text-ink-3">
                                      <span className="h-px w-3 bg-line" />
                                      <ArrowRight size={8} />
                                    </span>
                                  </span>
                                ) : null}
                              </span>
                            );
                          })}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {/* 共同关系圈 */}
              <section className="pb-2">
                <SectionLabel extra={commons.length ? `${commons.length} 人` : '无交集'}>共同关系圈</SectionLabel>
                {commons.length ? (
                  <div className="space-y-1.5">
                    {commons.map((item) => (
                      <div
                        key={item.person.id}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-line/70 bg-surface-2/30 px-2.5 py-1.5"
                      >
                        <PersonChip person={item.person} onClick={onJumpPerson} compact />
                        <span className="text-[10px] text-ink-3">
                          与{nameOf(from)}：
                          <span className="text-ink-2">{item.toA.specificLabel}</span>
                        </span>
                        <span className="text-[10px] text-ink-3">
                          与{nameOf(to)}：
                          <span className="text-ink-2">{item.toB.specificLabel}</span>
                        </span>
                        {item.sharedCategory ? (
                          <RelationBadge category={item.sharedCategory} isDark={isDark} size="xs" />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-line px-3 py-3 text-[11.5px] text-ink-3">
                    两人没有共同的一度关系人。
                  </p>
                )}
              </section>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
