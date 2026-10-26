'use client';

/**
 * 人物档案抽屉（4 Tab）
 * ------------------------------------------------------------------
 * 一、本传年表     —— 生平三阶 + 史官总评 + 年表（可展开史料）+ 行迹地图
 * 二、丹青画像     —— 四级画像 + Lightbox + 相貌考据 + AI 复原提示词
 * 三、轶事稗闻     —— 分类轶事 + 罗生门史料对勘
 * 四、史源对读     —— 二十四史原文/白话对照 + 人名实体高亮跳转
 */
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Maximize2, Minimize2, Crosshair, Route, X } from 'lucide-react';
import type { GraphIndex } from '@/lib/graph-algorithms';
import type { HistoricalPersonNode } from '@/types/history';
import { formatLifespan } from '@/lib/data-loader';
import { dynastyColor, dynastyName } from '@/data/dynasties';
import { resolvePortrait } from '@/lib/portrait-resolver';
import { TabBiography } from './TabBiography';
import { TabPortraitGallery } from './TabPortraitGallery';
import { TabAnecdotes } from './TabAnecdotes';
import { TabClassicalSources } from './TabClassicalSources';

type TabKey = 'bio' | 'portrait' | 'anecdote' | 'source';

const TABS: { key: TabKey; label: string; hint: string }[] = [
  { key: 'bio', label: '本传年表', hint: '生平 · 行迹' },
  { key: 'portrait', label: '丹青画像', hint: '画像 · 相貌考' },
  { key: 'anecdote', label: '轶事稗闻', hint: '典故 · 对勘' },
  { key: 'source', label: '史源对读', hint: '原文 · 白话' },
];

export function PersonDetailDrawer({
  person,
  persons,
  graph,
  onClose,
  onJumpPerson,
  onFocusPerson,
  onStartPath,
}: {
  person: HistoricalPersonNode | null;
  persons: HistoricalPersonNode[];
  graph: GraphIndex;
  onClose: () => void;
  onJumpPerson: (id: string) => void;
  onFocusPerson: (id: string) => void;
  onStartPath: (id: string) => void;
}) {
  const [tab, setTab] = useState<TabKey>('bio');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setTab('bio');
    setExpanded(false);
  }, [person?.id]);

  useEffect(() => {
    if (!person) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [person, onClose]);

  const portrait = useMemo(() => (person ? resolvePortrait(person) : null), [person]);
  const degree = person ? graph.degree.get(person.id) ?? 0 : 0;
  const aliasRows = useMemo(() => {
    if (!person) return [];
    const rows: { label: string; value: string }[] = [];
    const a = person.aliases;
    if (person.birthplace) {
      rows.push({
        label: '籍贯',
        value: `${person.birthplace.ancientName}（今 ${person.birthplace.modernName}）`,
      });
    }
    if (a.courtesyName) rows.push({ label: '字', value: a.courtesyName });
    if (a.pseudonyms?.length) rows.push({ label: '号／小字', value: a.pseudonyms.join('、') });
    if (a.posthumousTitle) rows.push({ label: '谥号', value: a.posthumousTitle });
    if (a.templeName) rows.push({ label: '庙号', value: a.templeName });
    if (a.eraNames?.length) rows.push({ label: '年号', value: a.eraNames.join('、') });
    if (a.feudalTitles?.length) rows.push({ label: '封爵', value: a.feudalTitles.join('、') });
    if (a.tabooNotes) rows.push({ label: '避讳', value: a.tabooNotes });
    return rows;
  }, [person]);

  /** 除籍贯外是否还有字号、谥号一类称谓；无则明示「史传未载」而非留白 */
  const hasAliasDetail = aliasRows.some((row) => row.label !== '籍贯');

  return (
    <AnimatePresence>
      {person && portrait ? (
        <motion.aside
          key={person.id}
          className={`panel absolute bottom-3 right-3 top-3 z-40 flex flex-col overflow-hidden transition-[width] duration-200 ${
            expanded ? 'left-3 w-auto' : 'w-[480px] max-w-[calc(100vw-24px)]'
          }`}
          initial={{ opacity: 0, x: 26 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 26 }}
          transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
          aria-label={`${person.name} 人物档案`}
        >
          {/* 头部 */}
          <header className="shrink-0 border-b border-line px-4 pb-2.5 pt-3.5">
            <div className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={portrait.src}
                alt={person.name}
                className="h-[74px] w-[54px] shrink-0 rounded border border-line object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h2 className="font-serif text-[22px] font-semibold leading-tight text-ink">{person.name}</h2>
                  <span
                    className="mt-1 shrink-0 rounded-[3px] px-1.5 py-[1px] text-[10px] font-medium"
                    style={{
                      color: dynastyColor(person.dynasty),
                      background: `${dynastyColor(person.dynasty)}16`,
                      border: `1px solid ${dynastyColor(person.dynasty)}45`,
                    }}
                  >
                    {dynastyName(person.dynasty)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="ml-auto rounded p-0.5 text-ink-3 transition-colors hover:bg-gold/10 hover:text-gold"
                    aria-label={expanded ? '退出全屏档案' : '全屏查看档案'}
                    title={expanded ? '退出全屏' : '全屏查看'}
                  >
                    {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-0.5 text-ink-3 transition-colors hover:bg-cinnabar/10 hover:text-cinnabar"
                    aria-label="关闭档案"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-ink-3">
                  <span>{formatLifespan(person)}</span>
                  {person.factionOrClan ? <span>· {person.factionOrClan}</span> : null}
                  <span>· 关系 {degree}</span>
                </div>

                <div className="mt-1 flex flex-wrap gap-1">
                  {person.roles.slice(0, 4).map((role) => (
                    <span key={role} className="rounded-[2px] border border-line bg-surface-2 px-1 text-[9.5px] text-ink-2">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 中心度条 */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[9.5px] text-ink-3">历史中心度</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-line/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-cinnabar"
                  style={{ width: `${person.importanceWeight}%` }}
                />
              </div>
              <span className="font-serif text-[10px] text-ink-2">{person.importanceWeight}</span>
            </div>

            {/* 异名信息 */}
            {aliasRows.length ? (
              <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-[2px] text-[10.5px]">
                {aliasRows.map((row) => (
                  <div key={row.label} className="flex gap-1.5">
                    <dt className="shrink-0 text-ink-3">{row.label}</dt>
                    <dd className="min-w-0 flex-1 truncate text-ink-2" title={row.value}>
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {!hasAliasDetail ? (
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-3">
                史传未载其字号、谥号与封爵，本页不作臆补。
              </p>
            ) : null}

            {/* 快捷操作 */}
            <div className="mt-2 flex gap-1.5">
              <button type="button" onClick={() => onFocusPerson(person.id)} className="tool-btn flex-1 justify-center py-[3px]">
                <Crosshair size={11} />
                镜头聚焦
              </button>
              <button type="button" onClick={() => onStartPath(person.id)} className="tool-btn flex-1 justify-center py-[3px]">
                <Route size={11} />
                设为寻路起点
              </button>
            </div>
          </header>

          {/* Tab 栏 */}
          <nav className="flex shrink-0 border-b border-line px-2">
            {TABS.map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`relative flex-1 px-1 py-2 text-center transition-colors ${
                    active ? 'text-cinnabar' : 'text-ink-3 hover:text-ink-2'
                  }`}
                >
                  <span className="block font-serif text-[11.5px] font-medium">{item.label}</span>
                  <span className="block text-[8.5px] opacity-70">{item.hint}</span>
                  {active ? (
                    <motion.span
                      layoutId="drawer-tab-underline"
                      className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-cinnabar"
                    />
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* 内容 */}
          <div className="scroll-thin flex-1 overflow-y-auto px-4 py-3.5">
            {tab === 'bio' ? <TabBiography person={person} persons={persons} onJumpPerson={onJumpPerson} /> : null}
            {tab === 'portrait' ? <TabPortraitGallery person={person} /> : null}
            {tab === 'anecdote' ? (
              <TabAnecdotes person={person} persons={persons} onJumpPerson={onJumpPerson} />
            ) : null}
            {tab === 'source' ? (
              <TabClassicalSources person={person} persons={persons} onJumpPerson={onJumpPerson} />
            ) : null}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
