'use client';

/**
 * 全局检索面板（⌘K / Ctrl+K）
 * ------------------------------------------------------------------
 * 一次输入同时命中：姓名、字、号、谥号、庙号、封爵、官职、门阀、
 * 轶事典故（如「捉刀」「指囷」）与二十四史原文片段。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CornerDownLeft, Search, X } from 'lucide-react';
import type { HistorySearchEngine, SearchHit } from '@/lib/search-engine';
import { splitHighlight } from '@/lib/search-engine';
import { dynastyColor, dynastyName } from '@/data/dynasties';
import { formatLifespan } from '@/lib/data-loader';

const SUGGESTIONS = ['曹操', '孟德', '捉刀', '贞观', '卧龙', '安史之乱', '关陇集团', '白衣渡江', '榻上策'];

export function SearchCommandPalette({
  open,
  engine,
  onClose,
  onSelect,
}: {
  open: boolean;
  engine: HistorySearchEngine | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hits: SearchHit[] = useMemo(() => {
    if (!engine || !query.trim()) return [];
    return engine.search(query, 12);
  }, [engine, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((c) => Math.min(hits.length - 1, c + 1));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const hit = hits[cursor];
        if (hit) {
          onSelect(hit.id);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, hits, cursor, onClose, onSelect]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} role="presentation" />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="全站检索"
            className="panel relative z-10 w-full max-w-[620px] overflow-hidden"
            initial={{ opacity: 0, y: -12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* 输入 */}
            <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
              <Search size={15} className="shrink-0 text-ink-3" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜姓名、字、号、谥号、官职、门阀、典故或史书原文…"
                className="w-full bg-transparent font-serif text-[14px] text-ink outline-none placeholder:text-ink-3/80"
                spellCheck={false}
              />
              {query ? (
                <button type="button" onClick={() => setQuery('')} className="shrink-0 text-ink-3 hover:text-cinnabar">
                  <X size={13} />
                </button>
              ) : (
                <kbd className="shrink-0 rounded border border-line bg-surface-2 px-1 py-[1px] font-sans text-[9.5px] text-ink-3">
                  ESC
                </kbd>
              )}
            </div>

            {/* 结果 */}
            <div className="scroll-thin max-h-[52vh] overflow-y-auto">
              {query.trim() === '' ? (
                <div className="px-3.5 py-3">
                  <p className="mb-2 text-[10.5px] tracking-wide text-ink-3">可尝试以下入口</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((word) => (
                      <button
                        key={word}
                        type="button"
                        onClick={() => setQuery(word)}
                        className="rounded-full border border-line bg-surface-2/70 px-2 py-[2px] text-[11px] text-ink-2 transition-colors hover:border-cinnabar/45 hover:text-cinnabar"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[10.5px] leading-relaxed text-ink-3">
                    检索索引覆盖 97 位人物的姓名／字号／谥庙／封爵／官职／门阀／轶事典故／年表与全部史料原文。
                    支持中文单字与双字模糊匹配。
                  </p>
                </div>
              ) : hits.length === 0 ? (
                <div className="px-3.5 py-6 text-center text-[12px] text-ink-3">
                  未检索到「{query}」。
                  <br />
                  <span className="text-[11px]">本库仅收录已通过本传核验的人物，不用演义人物与虚构情节填充结果。</span>
                </div>
              ) : (
                <ul className="py-1">
                  {hits.map((hit, index) => {
                    const active = index === cursor;
                    return (
                      <li key={hit.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setCursor(index)}
                          onClick={() => {
                            onSelect(hit.id);
                            onClose();
                          }}
                          className={`flex w-full items-start gap-2.5 px-3.5 py-2 text-left transition-colors ${
                            active ? 'bg-cinnabar/[0.08]' : 'hover:bg-surface-2/60'
                          }`}
                        >
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                            style={{ background: dynastyColor(hit.dynasty) }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-serif text-[13.5px] font-semibold text-ink">
                                {splitHighlight(hit.name, query).map((piece, i) =>
                                  piece.hit ? (
                                    <mark key={i} className="bg-cinnabar/20 text-cinnabar">
                                      {piece.text}
                                    </mark>
                                  ) : (
                                    <span key={i}>{piece.text}</span>
                                  ),
                                )}
                              </span>
                              <span className="text-[10px] text-ink-3">
                                {dynastyName(hit.dynasty)} · {formatLifespan(hit.person)}
                              </span>
                              {hit.matchedIn.length ? (
                                <span className="rounded-[2px] border border-line bg-surface-2 px-1 text-[9px] text-ink-3">
                                  {hit.matchedIn.slice(0, 2).join('／')}
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block line-clamp-2 text-[11px] leading-relaxed text-ink-2">
                              {hit.snippet}
                            </span>
                          </span>
                          {active ? <CornerDownLeft size={11} className="mt-1.5 shrink-0 text-cinnabar/70" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-line px-3.5 py-1.5 text-[9.5px] text-ink-3">
              <span>↑↓ 选择</span>
              <span>↵ 打开档案</span>
              <span className="ml-auto">共 {hits.length} 条命中</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
