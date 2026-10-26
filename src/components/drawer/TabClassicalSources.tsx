'use client';

/**
 * 档案抽屉 · 第四页：史源文白对照 + 人名实体高亮跳转
 * ------------------------------------------------------------------
 * 每段原文均来自二十四史本传，附卷次、撰者、可靠性分级与维基文库核验链接；
 * 正文中出现的其他人物姓名自动加朱砂下划线，一处点击即跳转其档案。
 */
import { useMemo, useState } from 'react';
import { ExternalLink, Quote } from 'lucide-react';
import type { HistoricalPersonNode } from '@/types/history';
import {
  ClassicalModernToggle,
  HighlightedText,
  ReliabilityBadge,
  SectionLabel,
  type ReadingMode,
} from '@/components/ui/atoms';

export function TabClassicalSources({
  person,
  persons,
  onJumpPerson,
}: {
  person: HistoricalPersonNode;
  persons: HistoricalPersonNode[];
  onJumpPerson: (id: string) => void;
}) {
  const [mode, setMode] = useState<ReadingMode>('both');
  const sources = person.primarySources;

  /** 人名识别词典：排除本人，避免自指 */
  const dictionary = useMemo(() => persons.filter((p) => p.id !== person.id), [persons, person.id]);

  const totalChars = useMemo(
    () => sources.reduce((sum, citation) => sum + citation.originalText.length, 0),
    [sources],
  );

  if (!sources.length) {
    return (
      <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[12px] text-ink-3">
        本传暂无可引原文。此为数据缺口，而非史书无载——可在 ETL 阶段从维基文库《二十四史》补齐。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ClassicalModernToggle mode={mode} onChange={setMode} />
        <span className="text-[10px] text-ink-3">
          共 {sources.length} 段 · 原文 {totalChars} 字
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-ink-3">
          <span className="border-b border-cinnabar/75 font-serif">朱砂下划线</span>
          可点击跳转
        </span>
      </div>

      {sources.map((citation, index) => (
        <article key={`${citation.bookTitle}-${index}`} className="rounded-lg border border-line bg-surface/45 px-3 py-3">
          <header className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-serif text-[12.5px] font-semibold text-ink">{citation.bookTitle}</span>
            <span className="text-[11px] text-ink-3">{citation.volumeAndChapter}</span>
            <ReliabilityBadge reliability={citation.reliability} />
            {citation.wikisourceUrl ? (
              <a
                href={citation.wikisourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="ml-auto inline-flex items-center gap-0.5 text-[10.5px] text-ink-3 transition-colors hover:text-cinnabar"
              >
                维基文库核验
                <ExternalLink size={9} />
              </a>
            ) : null}
          </header>

          {mode === 'both' ? (
            /* 双栏对照：左文右白，同段落并置，便于逐句比对 */
            <div className="grid grid-cols-2 gap-2.5">
              <div className="min-w-0">
                <span className="mb-1 block text-[9.5px] tracking-[0.18em] text-ink-3">原文</span>
                <blockquote className="classical-text border-l-2 border-cinnabar/45 pl-2 text-[12.5px]">
                  <HighlightedText text={citation.originalText} persons={dictionary} onJump={onJumpPerson} />
                </blockquote>
              </div>
              <div className="min-w-0">
                <span className="mb-1 block text-[9.5px] tracking-[0.18em] text-ink-3">白话</span>
                <p className="modern-text text-[12px]">
                  <HighlightedText text={citation.modernTranslation} persons={dictionary} onJump={onJumpPerson} />
                </p>
              </div>
            </div>
          ) : null}

          {mode === 'vertical' ? (
            /* 古籍竖排：仿刻本版式，自右向左竖行；超长段落横向滚动 */
            <div className="mt-1 overflow-x-auto border-y border-line/60 py-2">
              <blockquote className="vertical-rl classical-text mx-auto h-[250px] text-[13px] leading-[2.15] tracking-[0.06em]">
                <HighlightedText text={citation.originalText} persons={dictionary} onJump={onJumpPerson} />
              </blockquote>
            </div>
          ) : null}

          {mode === 'classical' ? (
            <blockquote className="classical-text border-l-2 border-cinnabar/45 pl-3">
              <Quote size={11} className="mr-1 inline-block -translate-y-px text-cinnabar/60" />
              <HighlightedText text={citation.originalText} persons={dictionary} onJump={onJumpPerson} />
            </blockquote>
          ) : null}

          {mode === 'modern' ? (
            <p className="modern-text pl-3 text-[12.5px]">
              <HighlightedText text={citation.modernTranslation} persons={dictionary} onJump={onJumpPerson} />
            </p>
          ) : null}

          <footer className="mt-2 space-y-1.5 pl-3">
            {citation.authorOrCommentator ? (
              <p className="text-[10.5px] text-ink-3">{citation.authorOrCommentator}</p>
            ) : null}
            {citation.historiographicalNote ? (
              <p className="rounded border border-violet/25 bg-violet/[0.06] px-2.5 py-1.5 text-[11px] leading-relaxed text-ink-2">
                <span className="mr-1 font-serif font-semibold text-violet">史学按语 ·</span>
                {citation.historiographicalNote}
              </p>
            ) : null}
          </footer>
        </article>
      ))}

      <section className="pb-2">
        <SectionLabel extra="本页史源构成">史源分级说明</SectionLabel>
        <ul className="space-y-1 text-[11px] leading-relaxed text-ink-2">
          <li className="flex items-start gap-1.5">
            <ReliabilityBadge reliability="official_history_primary" />
            <span>二十四史本纪／列传正文，可直接作为史实引用。</span>
          </li>
          <li className="flex items-start gap-1.5">
            <ReliabilityBadge reliability="authoritative_commentary" />
            <span>裴松之、颜师古等注疏及《襄阳记》《江表传》等他书引文，需与正史并观。</span>
          </li>
          <li className="flex items-start gap-1.5">
            <ReliabilityBadge reliability="chronicle_corroboration" />
            <span>《资治通鉴》等编年体政书，可校正纪年、补充细节。</span>
          </li>
          <li className="flex items-start gap-1.5">
            <ReliabilityBadge reliability="literary_anecdotal" />
            <span>笔记小说与演义情节，仅作文化接受史参考，不作为史实。</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
