'use client';

/**
 * 档案抽屉 · 第三页：奇闻轶事 + 罗生门史料对勘
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, BookOpenCheck, GitCompareArrows } from 'lucide-react';
import type { AnecdoteCategory, HistoricalPersonNode } from '@/types/history';
import { AnecdoteBadge, CitationBlock, PersonChip, SectionLabel } from '@/components/ui/atoms';
import { ANECDOTE_META } from '@/lib/search-engine';

export function TabAnecdotes({
  person,
  persons,
  onJumpPerson,
}: {
  person: HistoricalPersonNode;
  persons: HistoricalPersonNode[];
  onJumpPerson: (id: string) => void;
}) {
  /** null 表示「全部」；否则只看所选类别 */
  const [filter, setFilter] = useState<AnecdoteCategory | null>(null);

  const distribution = useMemo(() => {
    const acc = new Map<AnecdoteCategory, number>();
    for (const item of person.anecdotes) acc.set(item.category, (acc.get(item.category) ?? 0) + 1);
    return acc;
  }, [person.anecdotes]);

  const shown = useMemo(
    () => (filter ? person.anecdotes.filter((item) => item.category === filter) : person.anecdotes),
    [person.anecdotes, filter],
  );

  if (!person.anecdotes.length) {
    return (
      <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[12px] leading-relaxed text-ink-3">
        本传及他传中未见关于此人性格、生活的独立轶事记载。
        <br />
        本平台不以演义情节填补空白。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-line/70 bg-surface-2/40 px-3 py-2 text-[11px] leading-relaxed text-ink-3">
        以下每则轶事均标注其史源等级。凡出自笔记小说者（如《世说新语》《隋唐嘉话》）一律注明「笔记轶闻」，
        与正史本传严格区分；凡涉及多源矛盾者，另附「罗生门对勘」并列诸说。
      </p>

      {/* 类别筛选 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setFilter(null)}
          data-active={filter === null}
          className="rounded-[3px] border border-line px-2 py-[2px] text-[10.5px] text-ink-3 transition-colors hover:text-ink data-[active=true]:border-cinnabar/55 data-[active=true]:bg-cinnabar/10 data-[active=true]:text-cinnabar"
        >
          全部 · {person.anecdotes.length}
        </button>
        {[...distribution.entries()].map(([category, count]) => {
          const meta = ANECDOTE_META[category];
          const active = filter === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setFilter(active ? null : category)}
              title={meta.hint}
              className="rounded-[3px] px-2 py-[2px] text-[10.5px] transition-colors"
              style={{
                color: active ? meta.tone : undefined,
                background: active ? `${meta.tone}14` : undefined,
                border: `1px solid ${active ? `${meta.tone}55` : 'rgb(var(--c-line))'}`,
              }}
            >
              {meta.label} · {count}
            </button>
          );
        })}
      </div>

      {!shown.length ? (
        <div className="rounded-lg border border-dashed border-line px-4 py-5 text-center text-[11.5px] text-ink-3">
          此类别下暂无轶事。
        </div>
      ) : null}

      {shown.map((anecdote) => (
        <article key={anecdote.id} className="rounded-lg border border-line bg-surface/45 px-3 py-3">
          <header className="mb-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h4 className="font-serif text-[14px] font-semibold text-ink">{anecdote.title}</h4>
              <AnecdoteBadge category={anecdote.category} />
              {anecdote.idiomOrAllusion ? (
                <span className="rounded-[3px] border border-gold/40 bg-gold/10 px-1.5 py-[1px] text-[10px] text-gold">
                  成语 · {anecdote.idiomOrAllusion}
                </span>
              ) : null}
            </div>
          </header>

          <p className="text-[12.5px] leading-[1.95] text-ink-2" style={{ textAlign: 'justify' }}>
            {anecdote.narrativeSummary}
          </p>

          <div className="mt-2.5">
            <CitationBlock citation={anecdote.primaryCitation} dense />
          </div>

          {anecdote.relatedPersonIds.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-ink-3">涉及：</span>
              {anecdote.relatedPersonIds
                .map((id) => persons.find((p) => p.id === id))
                .filter(Boolean)
                .map((p) => (
                  <PersonChip key={p!.id} person={p!} onClick={onJumpPerson} compact />
                ))}
            </div>
          ) : null}

          {anecdote.conflictingAccounts?.length ? (
            <div className="mt-3 rounded-lg border border-plum/30 bg-plum/[0.05] p-2.5">
              <div className="mb-2 flex items-center gap-1.5">
                <GitCompareArrows size={12} className="text-plum" />
                <span className="font-serif text-[12px] font-semibold text-plum">罗生门对勘</span>
                <span className="text-[10px] text-ink-3">
                  {anecdote.conflictingAccounts.length} 种记载 · 并列呈现，不作定论
                </span>
              </div>
              <div className="space-y-2">
                {anecdote.conflictingAccounts.map((account, index) => (
                  <div
                    key={`${account.sourceName}-${index}`}
                    className="rounded-md border border-line/70 bg-surface/60 px-2.5 py-2"
                  >
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="inline-flex items-center gap-1 font-serif text-[11.5px] font-semibold text-ink">
                        <BookOpenCheck size={10} className="text-plum" />
                        {account.sourceName}
                      </span>
                    </div>
                    <p className="mt-0.5 flex items-start gap-1 text-[10.5px] leading-relaxed text-ink-3">
                      <AlertTriangle size={9} className="mt-[3px] shrink-0 text-gold" />
                      <span>{account.stanceOrBias}</span>
                    </p>
                    <div className="mt-1.5">
                      <CitationBlock citation={account.citation} dense />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      ))}

      <section className="pb-2">
        <SectionLabel extra="按类别统计">轶事分布</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(
            person.anecdotes.reduce<Record<string, number>>((acc, item) => {
              acc[item.category] = (acc[item.category] ?? 0) + 1;
              return acc;
            }, {}),
          ).map(([category, count]) => (
            <span key={category} className="inline-flex items-center gap-1">
              <AnecdoteBadge category={category as AnecdoteCategory} />
              <span className="text-[10px] text-ink-3">×{count}</span>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
