'use client';

/**
 * 通用考据展示原子组件
 * ------------------------------------------------------------------
 * 全部围绕「史源分级」这一核心命题设计：
 *  - ReliabilityBadge 常驻显示每段史料的可靠性等级，不可隐藏
 *  - CitationBlock 强制原文 / 白话双轨呈现，并附史学按语入口
 *  - PersonChip 承担任意文本中的实体跳转
 */
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Quote } from 'lucide-react';
import type {
  AnecdoteCategory,
  HistoricalCitation,
  HistoricalPersonNode,
  PortraitTier,
  RelationCategory,
  SourceReliability,
} from '@/types/history';
import { ANECDOTE_META, RELATION_META, RELIABILITY_META } from '@/lib/search-engine';
import { formatLifespan } from '@/lib/data-loader';

/* ------------------------------- 史源徽章 -------------------------------- */

const RELIABILITY_CLASS: Record<SourceReliability, string> = {
  official_history_primary: 'rel-primary',
  official_history_hujian: 'rel-hujian',
  authoritative_commentary: 'rel-commentary',
  chronicle_corroboration: 'rel-chronicle',
  literary_anecdotal: 'rel-anecdotal',
};

export function ReliabilityBadge({
  reliability,
  showNote = false,
}: {
  reliability: SourceReliability;
  showNote?: boolean;
}) {
  const meta = RELIABILITY_META[reliability];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`reliability-badge ${RELIABILITY_CLASS[reliability]}`} title={meta.note}>
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: meta.tone }}
        />
        {meta.label}
      </span>
      {showNote ? <span className="text-[10.5px] text-ink-3">{meta.note}</span> : null}
    </span>
  );
}

/* ------------------------------- 引文区块 -------------------------------- */

export function CitationBlock({
  citation,
  dense = false,
  defaultMode = 'both',
}: {
  citation: HistoricalCitation;
  dense?: boolean;
  defaultMode?: 'both' | 'classical';
}) {
  const [openNote, setOpenNote] = useState(false);
  const hasNote = Boolean(citation.historiographicalNote);

  return (
    <figure
      className={`group relative rounded-lg border border-line/80 bg-surface-2/45 ${
        dense ? 'px-3 py-2.5' : 'px-4 py-3.5'
      }`}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-serif text-[12.5px] font-semibold text-ink">
          {citation.bookTitle}
        </span>
        <span className="text-[11px] text-ink-3">{citation.volumeAndChapter}</span>
        <ReliabilityBadge reliability={citation.reliability} />
        {citation.wikisourceUrl ? (
          <a
            href={citation.wikisourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="ml-auto inline-flex items-center gap-0.5 text-[10.5px] text-ink-3 transition-colors hover:text-cinnabar"
            title="在维基文库核对原文"
          >
            核原文
            <ExternalLink size={10} />
          </a>
        ) : null}
      </div>

      <blockquote className="classical-text border-l-2 border-cinnabar/45 pl-3">
        <Quote size={11} className="mr-1 inline-block -translate-y-px text-cinnabar/60" />
        {citation.originalText}
      </blockquote>

      {defaultMode === 'both' ? (
        <p className="modern-text mt-2 pl-3 text-[12.5px]">{citation.modernTranslation}</p>
      ) : null}

      <figcaption className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-3 text-[10.5px] text-ink-3">
        {citation.authorOrCommentator ? <span>{citation.authorOrCommentator}</span> : null}
        {hasNote ? (
          <button
            type="button"
            onClick={() => setOpenNote((v) => !v)}
            className="inline-flex items-center gap-0.5 text-violet transition-colors hover:text-cinnabar"
          >
            史学按语
            <ChevronDown
              size={10}
              className="transition-transform"
              style={{ transform: openNote ? 'rotate(180deg)' : 'none' }}
            />
          </button>
        ) : null}
      </figcaption>

      {hasNote && openNote ? (
        <p className="mt-1.5 animate-ink-in rounded border border-violet/25 bg-violet/[0.06] px-2.5 py-2 text-[11.5px] leading-relaxed text-ink-2">
          {citation.historiographicalNote}
        </p>
      ) : null}
    </figure>
  );
}

/* ------------------------------- 人物胶囊 -------------------------------- */

export function PersonChip({
  person,
  onClick,
  showLifespan = false,
  compact = false,
}: {
  person: HistoricalPersonNode;
  onClick?: (id: string) => void;
  showLifespan?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(person.id)}
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/70 transition-all ${
        compact ? 'px-2 py-[2px] text-[11px]' : 'px-2.5 py-1 text-[11.5px]'
      } hover:border-cinnabar/50 hover:bg-cinnabar/[0.07]`}
      title={person.oneLineSummary}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: `rgb(var(--c-cinnabar))` }}
      />
      <span className="font-serif text-ink">{person.name}</span>
      {showLifespan ? (
        <span className="text-[10px] text-ink-3">{formatLifespan(person)}</span>
      ) : null}
    </button>
  );
}

/* ------------------------------- 关系徽章 -------------------------------- */

export function RelationBadge({
  category,
  label,
  isDark = false,
  size = 'sm',
}: {
  category: RelationCategory;
  label?: string;
  isDark?: boolean;
  size?: 'xs' | 'sm';
}) {
  const meta = RELATION_META[category];
  const color = isDark ? meta.darkColor : meta.color;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[3px] border font-medium tracking-wide ${
        size === 'xs' ? 'px-1.5 py-[1px] text-[10px]' : 'px-2 py-[2px] text-[11px]'
      }`}
      style={{ color, borderColor: `${color}66`, background: `${color}14` }}
    >
      {label ?? meta.label}
    </span>
  );
}

export function AnecdoteBadge({ category }: { category: AnecdoteCategory }) {
  const meta = ANECDOTE_META[category];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[3px] px-1.5 py-[1px] text-[10px] font-medium"
      style={{ color: meta.tone, background: `${meta.tone}14`, border: `1px solid ${meta.tone}40` }}
      title={meta.hint}
    >
      {meta.label}
    </span>
  );
}

const TIER_TONE: Record<PortraitTier, string> = {
  tier1_authentic_painting: '#8E354A',
  tier2_ancient_woodcut: '#C59B27',
  tier3_ai_reconstructed: '#2B7A78',
  tier4_attire_silhouette: '#6C5B7B',
};

const TIER_LABEL: Record<PortraitTier, string> = {
  tier1_authentic_painting: 'L1 传世古画',
  tier2_ancient_woodcut: 'L2 古籍版画',
  tier3_ai_reconstructed: 'L3 史料复原',
  tier4_attire_silhouette: 'L4 冠服剪影',
};

export function PortraitTierBadge({ tier, title }: { tier: PortraitTier; title?: string }) {
  const tone = TIER_TONE[tier];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[3px] px-1.5 py-[1px] text-[10px] font-medium"
      style={{ color: tone, background: `${tone}16`, border: `1px solid ${tone}45` }}
      title={title}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

/* -------------------------------- 小标题 -------------------------------- */

export function SectionLabel({
  children,
  extra,
}: {
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <span aria-hidden className="inline-block h-3 w-[2px] translate-y-[1px] bg-cinnabar/70" />
      <h3 className="font-serif text-[13px] font-semibold tracking-wide text-ink">{children}</h3>
      {extra ? <span className="ml-auto text-[10.5px] text-ink-3">{extra}</span> : null}
    </div>
  );
}

/* ------------------------------ 文白对照切换 ----------------------------- */

export type ReadingMode = 'both' | 'vertical' | 'classical' | 'modern';

export function ClassicalModernToggle({
  mode,
  onChange,
}: {
  mode: ReadingMode;
  onChange: (mode: ReadingMode) => void;
}) {
  const options: { key: ReadingMode; label: string; title: string }[] = useMemo(
    () => [
      { key: 'both', label: '文白对照', title: '左文右白，双栏并置' },
      { key: 'vertical', label: '古籍竖排', title: '仿刻本版式，自右向左竖行' },
      { key: 'classical', label: '横排原文', title: '仅看文言原文，横排阅读' },
      { key: 'modern', label: '仅白话', title: '仅看白话译文' },
    ],
    [],
  );
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-line">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          data-active={mode === option.key}
          className="px-2 py-1 text-[11px] text-ink-3 transition-colors data-[active=true]:bg-cinnabar/10 data-[active=true]:text-cinnabar hover:text-ink"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------- 文本内人名高亮跳转 -------------------------- */

export function HighlightedText({
  text,
  persons,
  onJump,
}: {
  text: string;
  persons: HistoricalPersonNode[];
  onJump?: (id: string) => void;
}) {
  // 长名优先，避免「曹操」被「曹」抢先匹配
  const dictionary = useMemo(() => {
    const map = new Map<string, HistoricalPersonNode>();
    for (const p of persons) {
      if (p.name.length >= 2) map.set(p.name, p);
      const zi = p.aliases.courtesyName;
      if (zi && zi.length >= 2 && !map.has(zi)) map.set(zi, p);
    }
    return [...map.entries()].sort((a, b) => b[0].length - a[0].length);
  }, [persons]);

  const segments = useMemo(() => {
    if (!dictionary.length) return [{ text, id: null as string | null }];
    const out: { text: string; id: string | null }[] = [];
    let cursor = 0;
    while (cursor < text.length) {
      let matched = false;
      for (const [term, person] of dictionary) {
        if (text.startsWith(term, cursor)) {
          out.push({ text: term, id: person.id });
          cursor += term.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        const last = out[out.length - 1];
        if (last && last.id === null) last.text += text[cursor];
        else out.push({ text: text[cursor], id: null });
        cursor += 1;
      }
    }
    return out;
  }, [text, dictionary]);

  return (
    <>
      {segments.map((seg, i) =>
        seg.id ? (
          <button
            key={`${seg.id}-${i}`}
            type="button"
            onClick={() => onJump?.(seg.id!)}
            className="entity-link font-serif"
            title="查看此人档案"
          >
            {seg.text}
          </button>
        ) : (
          <span key={`t-${i}`}>{seg.text}</span>
        ),
      )}
    </>
  );
}
