'use client';

/**
 * 连线详考弹窗：「交集详考与动态演变」
 * ------------------------------------------------------------------
 * 点击画布任意连线后展示：
 *  - 两端人物的身份摘要与关系定名
 *  - 关系性质徽章、强度、方向
 *  - 该关系的关键史料原文（文白对照 + 史源分级）
 *  - temporalPhases 状态机：关系如何在数十年间从盟友变为死敌
 */
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftRight, ArrowRight, Clock3, X } from 'lucide-react';
import type { HistoricalPersonNode, HistoricalRelationEdge } from '@/types/history';
import { CitationBlock, PersonChip, RelationBadge, SectionLabel } from '@/components/ui/atoms';
import { RELATION_META } from '@/lib/search-engine';
import { resolvePortrait } from '@/lib/portrait-resolver';
import { formatYearFull } from '@/lib/data-loader';
import { useTheme } from '@/components/providers/ThemeProvider';

export function EdgeRelationModal({
  edge,
  nodeMap,
  onClose,
  onJumpPerson,
}: {
  edge: HistoricalRelationEdge | null;
  nodeMap: Map<string, HistoricalPersonNode>;
  onClose: () => void;
  onJumpPerson: (id: string) => void;
}) {
  const { isDark } = useTheme();
  const source = edge ? nodeMap.get(edge.source) : null;
  const target = edge ? nodeMap.get(edge.target) : null;

  return (
    <AnimatePresence>
      {edge && source && target ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={onClose}
            role="presentation"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${source.name} 与 ${target.name} 的关系详考`}
            className="panel relative z-10 flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {/* 头部 */}
            <header className="flex items-start gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="seal px-1.5 py-[1px] text-[10px]">交集详考</span>
                  <RelationBadge category={edge.primaryCategory} isDark={isDark} />
                  <span className="text-[10.5px] text-ink-3">
                    {edge.directed ? '定向关系' : '对等关系'} · 强度 {edge.strength}/10
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onJumpPerson(source.id)}
                    className="font-serif text-[20px] font-semibold text-ink transition-colors hover:text-cinnabar"
                  >
                    {source.name}
                  </button>
                  <ArrowLeftRight size={13} className="text-ink-3" />
                  <button
                    type="button"
                    onClick={() => onJumpPerson(target.id)}
                    className="font-serif text-[20px] font-semibold text-ink transition-colors hover:text-cinnabar"
                  >
                    {target.name}
                  </button>
                  <span className="rounded-[3px] border border-line bg-surface-2 px-1.5 py-[1px] font-serif text-[11.5px] text-ink-2">
                    {edge.specificLabel}
                  </span>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{edge.overallSummary}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-ink-3 transition-colors hover:bg-cinnabar/10 hover:text-cinnabar"
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </header>

            <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* 双方档案摘要 */}
              <div className="grid grid-cols-2 gap-2">
                {[source, target].map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => onJumpPerson(person.id)}
                    className="panel-flat flex gap-2.5 px-3 py-2 text-left transition-colors hover:border-cinnabar/45"
                  >
                    {/* 头像是「两人对比」的直观锚点：一眼看出谁在左谁在右 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolvePortrait(person).src}
                      alt={`${person.name} 画像`}
                      className="h-11 w-11 shrink-0 rounded-full border border-line object-cover"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-serif text-[13px] font-semibold text-ink">{person.name}</span>
                        {person.aliases.courtesyName ? (
                          <span className="text-[10px] text-ink-3">字{person.aliases.courtesyName}</span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[10px] text-ink-3">
                        {formatYearFull(person.birthYear).replace('公元 ', '')} –{' '}
                        {formatYearFull(person.deathYear).replace('公元 ', '')}
                        {person.factionOrClan ? ` · ${person.factionOrClan}` : ''}
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-2">
                        {person.oneLineSummary}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* 关键史料 */}
              <section>
                <SectionLabel extra={edge.keyCitation ? '此关系的直接书证' : '此关系见于何卷'}>关键史料</SectionLabel>
                {edge.keyCitation ? (
                  <CitationBlock citation={edge.keyCitation} />
                ) : (
                  <div className="rounded-lg border border-line/80 bg-surface-2/40 px-3 py-2.5 text-[11.5px] leading-[1.85] text-ink-2">
                    {edge.textualBasis?.bookTitle}
                    {edge.textualBasis?.volumeAndChapter}
                    <span className="mt-1 block text-[10.5px] text-ink-3">
                      本条为简目连线，只著录关系所见的卷次篇名，未附原文；可依此自行翻检。
                    </span>
                  </div>
                )}
              </section>

              {/* 动态演变 */}
              <section>
                <SectionLabel
                  extra={
                    edge.temporalPhases?.length
                      ? `${edge.temporalPhases.length} 个阶段 · 拖动底部时间轴可观察变色`
                      : '史载未分期'
                  }
                >
                  动态演变（关系状态机）
                </SectionLabel>

                {edge.temporalPhases?.length ? (
                  <ol className="relative space-y-2.5 pl-4">
                    <span aria-hidden className="absolute left-[5px] top-1 h-[calc(100%-8px)] w-px bg-line" />
                    {edge.temporalPhases.map((phase, index) => {
                      const meta = RELATION_META[phase.category];
                      const color = isDark ? meta.darkColor : meta.color;
                      return (
                        <li key={`${phase.phaseLabel}-${index}`} className="relative">
                          <span
                            aria-hidden
                            className="absolute -left-4 top-[6px] h-2 w-2 rounded-full ring-2"
                            style={{ background: color, boxShadow: `0 0 0 2px ${color}33` }}
                          />
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-serif text-[13px] font-semibold text-ink">
                              {phase.phaseLabel}
                            </span>
                            <RelationBadge category={phase.category} isDark={isDark} size="xs" />
                            <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-3">
                              <Clock3 size={9} />
                              {formatYearFull(phase.startYear).replace('公元 ', '')}
                              <ArrowRight size={8} />
                              {formatYearFull(phase.endYear).replace('公元 ', '')}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{phase.description}</p>
                          {phase.citation ? (
                            <div className="mt-1.5">
                              <CitationBlock citation={phase.citation} dense />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="rounded-lg border border-dashed border-line px-3 py-3 text-[12px] leading-relaxed text-ink-3">
                    此关系的性质在史料中未见阶段性转变记载，或转变过程已不可考。
                    {typeof edge.startYear === 'number' || typeof edge.endYear === 'number' ? (
                      <>
                        {' '}
                        可考交集时段：
                        {typeof edge.startYear === 'number' ? formatYearFull(edge.startYear) : '不详'} 至{' '}
                        {typeof edge.endYear === 'number' ? formatYearFull(edge.endYear) : '不详'}。
                      </>
                    ) : null}
                  </p>
                )}
              </section>

              {/* 相关人物 */}
              <section className="pb-1">
                <SectionLabel>可延伸查阅</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  <PersonChip person={source} onClick={onJumpPerson} compact />
                  <PersonChip person={target} onClick={onJumpPerson} compact />
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
