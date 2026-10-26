'use client';

/**
 * 底部时空双轴控制器
 * ------------------------------------------------------------------
 * 上排：朝代分段条（点击即把时间窗收缩到该朝）
 * 下排：公元纪年双滑块 + 单年截面开关 + 自动巡年
 * 单年截面模式下，画布按 temporalPhases 状态机重算每条关系当年的性质并变色。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarRange, ChevronDown, ChevronUp, Pause, Play, Timer } from 'lucide-react';
import type { DynastyId, TimeWindow } from '@/types/history';
import { formatYear, formatYearFull } from '@/lib/data-loader';

export interface DynastySpan {
  id: DynastyId;
  name: string;
  start: number;
  end: number;
  color: string;
}

export function BottomTimelineBar({
  range,
  window: timeWindow,
  onChange,
  dynastySpans,
  visibleCount,
}: {
  range: [number, number];
  window: TimeWindow;
  onChange: (next: TimeWindow) => void;
  dynastySpans: DynastySpan[];
  visibleCount: number;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'band' | null>(null);
  const [playing, setPlaying] = useState(false);
  /** 控制舱折叠：收起后只留朝代切片条，为画布腾出高度 */
  const [collapsed, setCollapsed] = useState(false);

  const [minYear, maxYear] = range;
  const span = Math.max(1, maxYear - minYear);

  const toPercent = useCallback(
    (year: number) => ((year - minYear) / span) * 100,
    [minYear, span],
  );

  const fromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return minYear;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(minYear + ratio * span);
    },
    [minYear, span],
  );

  /* ------------------------------ 拖拽逻辑 ------------------------------ */
  useEffect(() => {
    if (!dragging) return;
    const handleMove = (event: PointerEvent) => {
      const year = fromClientX(event.clientX);
      if (dragging === 'start') {
        onChange({ ...timeWindow, startYear: Math.min(year, timeWindow.endYear - 1) });
      } else if (dragging === 'end') {
        onChange({ ...timeWindow, endYear: Math.max(year, timeWindow.startYear + 1) });
      } else {
        const width = timeWindow.endYear - timeWindow.startYear;
        const nextStart = Math.min(Math.max(minYear, year - Math.round(width / 2)), maxYear - width);
        onChange({ ...timeWindow, startYear: nextStart, endYear: nextStart + width });
      }
    };
    const handleUp = () => setDragging(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging, fromClientX, onChange, timeWindow, minYear, maxYear]);

  /* ------------------------------ 自动巡年 ------------------------------ */
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const step = timeWindow.singleYearMode ? 1 : 5;
      const next = timeWindow.startYear + step;
      const limit = timeWindow.singleYearMode ? maxYear : maxYear;
      if (next > limit) {
        setPlaying(false);
        return;
      }
      onChange({
        ...timeWindow,
        startYear: next,
        endYear: timeWindow.singleYearMode ? next : Math.min(maxYear, timeWindow.endYear + step),
      });
    }, timeWindow.singleYearMode ? 110 : 90);
    return () => window.clearInterval(timer);
  }, [playing, timeWindow, onChange, maxYear]);

  const single = timeWindow.singleYearMode;

  return (
    <footer className="relative z-30 shrink-0 border-t border-line bg-surface/85 px-4 pb-2 pt-2 backdrop-blur-md">
      {/* 朝代分段条 */}
      <div className="mb-1.5 flex items-center gap-2">
        <span className="inline-flex shrink-0 items-center gap-1 text-[9.5px] text-ink-3">
          <CalendarRange size={10} />
          朝代切片
        </span>
        <div className="relative h-[18px] flex-1">
          <div className="absolute inset-0 overflow-hidden rounded-[3px] bg-surface-2/70">
            {dynastySpans.map((dynasty) => {
              const left = Math.max(0, toPercent(dynasty.start));
              const right = Math.min(100, toPercent(dynasty.end));
              const width = Math.max(1.2, right - left);
              return (
                <button
                  key={dynasty.id}
                  type="button"
                  onClick={() => onChange({ startYear: dynasty.start, endYear: dynasty.end, singleYearMode: false })}
                  className="absolute top-0 h-full border-r border-canvas/45 text-[9px] text-canvas/95 transition-opacity hover:opacity-80"
                  style={{ left: `${left}%`, width: `${width}%`, background: dynasty.color, opacity: 0.78 }}
                  title={`${dynasty.name} · ${formatYearFull(dynasty.start)}–${formatYearFull(dynasty.end)}`}
                >
                  <span className="pointer-events-none block truncate px-1 font-serif leading-[18px]">
                    {dynasty.name}
                  </span>
                </button>
              );
            })}
          </div>
          {/* 当前窗口高亮 */}
          <div
            className="pointer-events-none absolute top-0 h-full rounded-[2px] border border-cinnabar bg-cinnabar/10"
            style={{
              left: `${toPercent(timeWindow.startYear)}%`,
              width: `${Math.max(0.8, toPercent(timeWindow.endYear) - toPercent(timeWindow.startYear))}%`,
            }}
          />
        </div>
        <span className="shrink-0 font-serif text-[10.5px] text-ink-2">
          {formatYearFull(timeWindow.startYear)}
          {timeWindow.singleYearMode ? '' : `—${formatYearFull(timeWindow.endYear)}`}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="tool-btn shrink-0 px-1.5 py-[1px]"
          title={collapsed ? '展开时空控制舱' : '收起时空控制舱'}
          aria-label={collapsed ? '展开时空控制舱' : '收起时空控制舱'}
        >
          {collapsed ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* 双滑块 */}
      <div className={`flex items-center gap-3 overflow-hidden transition-all duration-200 ${
        collapsed ? 'max-h-0 opacity-0' : 'max-h-24 opacity-100'
      }`}>
        <button
          type="button"
          onClick={() => setPlaying((v) => !v)}
          className="tool-btn shrink-0 px-2"
          title={playing ? '暂停巡年' : '自动巡年'}
        >
          {playing ? <Pause size={11} /> : <Play size={11} />}
        </button>

        <div className="min-w-0 flex-1">
          <div
            ref={trackRef}
            className="relative h-7 select-none"
            onPointerDown={(event) => {
              if (event.target === trackRef.current) {
                const year = fromClientX(event.clientX);
                onChange({ ...timeWindow, startYear: Math.min(year, timeWindow.endYear - 1) });
              }
            }}
          >
            {/* 轨道 */}
            <div className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-line" />
            {/* 选中区间 */}
            <div
              className="absolute top-1/2 h-[3px] -translate-y-1/2 cursor-move rounded-full bg-gradient-to-r from-gold/80 to-cinnabar/85"
              style={{
                left: `${toPercent(timeWindow.startYear)}%`,
                width: `${Math.max(0.6, toPercent(timeWindow.endYear) - toPercent(timeWindow.startYear))}%`,
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                setDragging('band');
              }}
            />
            {/* 起点把手 */}
            <button
              type="button"
              aria-label="调整起始年份"
              onPointerDown={(event) => {
                event.stopPropagation();
                setDragging('start');
              }}
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-cinnabar bg-surface shadow-sm transition-transform hover:scale-110"
              style={{ left: `${toPercent(timeWindow.startYear)}%` }}
            />
            {/* 终点把手 */}
            {!single ? (
              <button
                type="button"
                aria-label="调整终止年份"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setDragging('end');
                }}
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-cinnabar bg-surface shadow-sm transition-transform hover:scale-110"
                style={{ left: `${toPercent(timeWindow.endYear)}%` }}
              />
            ) : null}

            {/* 刻度 */}
            <div className="pointer-events-none absolute inset-x-0 -bottom-0.5 flex justify-between text-[8.5px] text-ink-3">
              <span>{formatYear(minYear)}</span>
              <span>{formatYear(Math.round((minYear + maxYear) / 2))}</span>
              <span>{formatYear(maxYear)}</span>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="font-serif text-[12px] text-ink">
            {single
              ? formatYearFull(timeWindow.startYear)
              : `${formatYearFull(timeWindow.startYear)} — ${formatYearFull(timeWindow.endYear)}`}
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-2 text-[9.5px] text-ink-3">
            <span>视口 {visibleCount} 人</span>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...timeWindow,
                  endYear: timeWindow.startYear,
                  singleYearMode: !single,
                })
              }
              data-active={single}
              className="tool-btn px-1.5 py-[1px] text-[9.5px] data-[active=true]:border-cinnabar/55 data-[active=true]:bg-cinnabar/10 data-[active=true]:text-cinnabar"
              title="以单一年份为截面：仅显示当年在世之人，并按当年关系性质给边上色"
            >
              <Timer size={9} />
              单年截面
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
