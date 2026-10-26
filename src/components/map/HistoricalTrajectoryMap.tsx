'use client';

/**
 * 行迹地图（Historical Trajectory Map）
 * ------------------------------------------------------------------
 * 以人物年表中带经纬度的生平事件为数据源，绘制其一生空间迁徙轨迹。
 *
 * ⚠ 合规说明：本组件刻意只绘制「经纬度坐标投影 + 经纬网」的示意散点图，
 *   **不绘制任何国界、省界、海岸线或领土轮廓**，因此不构成《地图管理条例》
 *   意义上的地图，亦不涉及行政区划表示问题。古人籍贯/事件地点的今地名
 *   一律以文字标注（如「长安 → 陕西省西安市」），供读者自行核对。
 */
import { useMemo, useState } from 'react';
import type { GeoLocation, HistoricalPersonNode, LifeEvent } from '@/types/history';
import { formatYear } from '@/lib/data-loader';

const LON_MIN = 68;
const LON_MAX = 142;
const LAT_MIN = 15;
const LAT_MAX = 56;

const W = 660;
const H = 340;
const PAD = 26;

const project = (coords: [number, number]): [number, number] => {
  const [lng, lat] = coords;
  const x = PAD + ((lng - LON_MIN) / (LON_MAX - LON_MIN)) * (W - PAD * 2);
  const y = PAD + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (H - PAD * 2);
  return [x, y];
};

interface Stop {
  event: LifeEvent;
  location: GeoLocation;
  x: number;
  y: number;
}

export function HistoricalTrajectoryMap({
  person,
  persons,
  onJumpPerson,
}: {
  person: HistoricalPersonNode;
  persons: HistoricalPersonNode[];
  onJumpPerson?: (id: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const stops = useMemo<Stop[]>(() => {
    return person.lifeTimeline
      .filter((event) => Boolean(event.location?.coordinates))
      .sort((a, b) => a.year - b.year)
      .map((event) => {
        const [x, y] = project(event.location!.coordinates);
        return { event, location: event.location!, x, y };
      });
  }, [person]);

  const path = useMemo(
    () => stops.map((stop, i) => `${i === 0 ? 'M' : 'L'}${stop.x.toFixed(1)},${stop.y.toFixed(1)}`).join(' '),
    [stops],
  );

  const nameOf = (id: string) => persons.find((p) => p.id === id)?.name ?? id;

  if (!stops.length) {
    return (
      <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[12px] text-ink-3">
        此人的年表暂无可定位的经纬度记录，无法绘制行迹。若需补全，可在 ETL 阶段通过 CBDB 籍贯索引回填。
      </div>
    );
  }

  const active = activeIndex !== null ? stops[activeIndex] : null;

  return (
    <div className="rounded-lg border border-line bg-surface-2/40 p-2.5">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <span className="font-serif text-[12px] font-semibold text-ink">行迹示意投影</span>
        <span className="text-[9.5px] text-ink-3">经纬度散点 · 不含行政边界 · 共 {stops.length} 站</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${person.name} 一生行迹示意投影`}>
        <defs>
          <linearGradient id="trail" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(197,155,39)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="rgb(200,62,49)" stopOpacity="0.85" />
          </linearGradient>
          <marker id="trail-arrow" markerWidth="7" markerHeight="7" refX="5.4" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="rgb(200,62,49)" opacity="0.7" />
          </marker>
        </defs>

        {/* 经纬网（纯坐标刻度，非行政边界） */}
        <g opacity="0.5">
          {[70, 80, 90, 100, 110, 120, 130, 140].map((lng) => {
            const [x] = project([lng, 0]);
            return (
              <g key={`lon-${lng}`}>
                <line x1={x} y1={PAD} x2={x} y2={H - PAD} stroke="rgb(var(--c-border))" strokeWidth="0.6" strokeDasharray="2 4" />
                <text x={x} y={H - PAD + 12} textAnchor="middle" fontSize="8" fill="rgb(var(--c-ink-3))">
                  {lng}°E
                </text>
              </g>
            );
          })}
          {[20, 30, 40, 50].map((lat) => {
            const [, y] = project([0, lat]);
            return (
              <g key={`lat-${lat}`}>
                <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="rgb(var(--c-border))" strokeWidth="0.6" strokeDasharray="2 4" />
                <text x={PAD - 6} y={y + 3} textAnchor="end" fontSize="8" fill="rgb(var(--c-ink-3))">
                  {lat}°N
                </text>
              </g>
            );
          })}
        </g>

        {/* 轨迹线 */}
        {stops.length > 1 ? (
          <path d={path} fill="none" stroke="url(#trail)" strokeWidth="1.4" strokeDasharray="5 4" markerEnd="url(#trail-arrow)" />
        ) : null}

        {/* 站点 */}
        {stops.map((stop, i) => {
          const isActive = activeIndex === i;
          const r = isActive ? 6.5 : 4.4;
          const t = stops.length > 1 ? i / (stops.length - 1) : 0;
          const color = t < 0.5 ? 'rgb(197,155,39)' : 'rgb(200,62,49)';
          return (
            <g
              key={stop.event.id}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={stop.x} cy={stop.y} r={r + 5} fill="transparent" />
              {isActive ? <circle cx={stop.x} cy={stop.y} r={r + 4} fill={color} opacity="0.16" /> : null}
              <circle cx={stop.x} cy={stop.y} r={r} fill={color} stroke="rgb(var(--c-surface))" strokeWidth="1.4" />
              <text
                x={stop.x + r + 4}
                y={stop.y + 3}
                fontSize="9"
                fill="rgb(var(--c-ink-2))"
                style={{ fontFamily: 'var(--font-serif, serif)' }}
              >
                {stop.location.ancientName}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 悬停详情 */}
      <div className="mt-1 min-h-[46px] rounded-md border border-line/70 bg-surface/70 px-2.5 py-1.5">
        {active ? (
          <div className="animate-ink-in">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-serif text-[12px] font-semibold text-ink">{active.event.title}</span>
              <span className="text-[10px] text-ink-3">
                {formatYear(active.event.year)} 年
                {active.event.eraNameYear ? ` · ${active.event.eraNameYear}` : ''}
                {typeof active.event.age === 'number' ? ` · 时年 ${active.event.age}` : ''}
              </span>
            </div>
            <div className="mt-0.5 text-[10.5px] text-ink-3">
              {active.location.ancientName}（今 {active.location.modernName}） · {active.location.coordinates[0]}°E /{' '}
              {active.location.coordinates[1]}°N
            </div>
            {active.event.participatingPersonIds?.length ? (
              <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-ink-3">
                同行：
                {active.event.participatingPersonIds.slice(0, 5).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="entity-link"
                    onClick={() => onJumpPerson?.(id)}
                  >
                    {nameOf(id)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] leading-[46px] text-ink-3">将光标移到站点上，查看该次迁徙的年份、古地名与同行人物。</p>
        )}
      </div>
    </div>
  );
}
