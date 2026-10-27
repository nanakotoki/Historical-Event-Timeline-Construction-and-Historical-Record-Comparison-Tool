'use client';

/**
 * 画布浮层控件：关系图例 / 关系筛选 / 布局切换 / 缩放与 LOD 指示
 */
import { useState } from 'react';
import { ChevronDown, GitBranch, Layers, Maximize2, Minus, Network, Plus, SlidersHorizontal } from 'lucide-react';
import type { GraphLayoutMode, RelationCategory } from '@/types/history';
import { RELATION_META } from '@/lib/search-engine';
import { useTheme } from '@/components/providers/ThemeProvider';
import { LOD_CULL_MIN_COUNT } from '@/components/canvas/HistoryGraphCanvas';

const LAYOUTS: { key: GraphLayoutMode; label: string; hint: string; icon: typeof Network }[] = [
  { key: 'force', label: '力导向', hint: '按关系亲疏自然聚集，观察整体结构', icon: Network },
  { key: 'lineage', label: '宗法世系', hint: '仅血亲／姻亲／师承，自长辈向下展开', icon: GitBranch },
  { key: 'swimlane', label: '纪年泳道', hint: '横轴为公元年份，按朝代分层', icon: Layers },
];

const CATEGORIES: RelationCategory[] = [
  'kinship_blood',
  'kinship_marriage',
  'monarch_subject',
  'political_ally',
  'political_rival',
  'military_adversary',
  'mentor_disciple',
  'literary_bosom',
];

export interface GraphLegendAndControlsProps {
  layoutMode: GraphLayoutMode;
  onLayoutChange: (mode: GraphLayoutMode) => void;
  relationFilter: Set<RelationCategory>;
  onToggleCategory: (category: RelationCategory) => void;
  onToggleAll: (on: boolean) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  scale: number;
  lod: 0 | 1 | 2;
  visibleNodes: number;
  totalNodes: number;
}

export function GraphLegendAndControls({
  layoutMode,
  onLayoutChange,
  relationFilter,
  onToggleCategory,
  onToggleAll,
  onZoomIn,
  onZoomOut,
  onFit,
  scale,
  lod,
  visibleNodes,
  totalNodes,
}: GraphLegendAndControlsProps) {
  const { isDark } = useTheme();
  const [legendOpen, setLegendOpen] = useState(true);

  // 阈值与 HistoryGraphCanvas 的 LOD_WEIGHT / LOD_CULL_MIN_COUNT 必须一字不差，
  // 否则界面会报出与实际渲染不符的分层：单片九十人时画布明明「可见 90/90」，
  // 标签却还写着「宏观 · 权重≥75」，自相矛盾。
  const lodLabel =
    totalNodes < LOD_CULL_MIN_COUNT
      ? `全量 · ${totalNodes} 人尽出`
      : ['宏观 · 权重≥75', '中观 · 权重≥40 + 头像', '微观 · 全部 + 关系胶囊'][lod];

  return (
    <>
      {/* 左下：布局 + 图例 + 筛选 */}
      {/* data-legend-panel 供画布量取遮挡区域：泳道标签画在 x=14，会被这块面板盖住 */}
      <div
        data-legend-panel
        className="pointer-events-none absolute bottom-3 left-3 z-20 flex w-[268px] flex-col gap-2"
      >
        <div className="panel pointer-events-auto p-2">
          <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
            <SlidersHorizontal size={11} className="text-ink-3" />
            <span className="text-[10.5px] font-medium tracking-wide text-ink-3">图谱布局</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {LAYOUTS.map((item) => {
              const Icon = item.icon;
              const active = layoutMode === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onLayoutChange(item.key)}
                  data-active={active}
                  title={item.hint}
                  className="tool-btn flex-col justify-center gap-0.5 px-1 py-1.5 text-[10.5px] data-[active=true]:border-cinnabar/55 data-[active=true]:bg-cinnabar/10 data-[active=true]:text-cinnabar"
                >
                  <Icon size={13} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="panel pointer-events-auto overflow-hidden">
          <button
            type="button"
            onClick={() => setLegendOpen((v) => !v)}
            className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left"
          >
            <span className="text-[11px] font-medium tracking-wide text-ink-2">关系性质图例 · 点击筛选</span>
            <ChevronDown
              size={12}
              className="ml-auto text-ink-3 transition-transform"
              style={{ transform: legendOpen ? 'rotate(180deg)' : 'none' }}
            />
          </button>
          {legendOpen ? (
            <div className="px-2 pb-2">
              <div className="mb-1.5 flex gap-1">
                <button type="button" className="tool-btn flex-1 justify-center py-[3px] text-[10px]" onClick={() => onToggleAll(true)}>
                  全显
                </button>
                <button type="button" className="tool-btn flex-1 justify-center py-[3px] text-[10px]" onClick={() => onToggleAll(false)}>
                  全隐
                </button>
              </div>
              <ul className="space-y-[3px]">
                {CATEGORIES.map((category) => {
                  const meta = RELATION_META[category];
                  const color = isDark ? meta.darkColor : meta.color;
                  const on = relationFilter.has(category);
                  return (
                    <li key={category}>
                      <button
                        type="button"
                        onClick={() => onToggleCategory(category)}
                        title={meta.description}
                        className="group flex w-full items-center gap-2 rounded-[3px] px-1 py-[3px] text-left transition-colors hover:bg-cinnabar/[0.06]"
                        style={{ opacity: on ? 1 : 0.36 }}
                      >
                        <svg width="26" height="10" aria-hidden>
                          {meta.double ? (
                            <>
                              <line x1="1" y1="4" x2="25" y2="4" stroke={color} strokeWidth="1.6" strokeDasharray={meta.dashed ? '4 3' : undefined} />
                              <line x1="1" y1="7.2" x2="25" y2="7.2" stroke={color} strokeWidth="1.6" strokeDasharray={meta.dashed ? '4 3' : undefined} />
                            </>
                          ) : (
                            <line x1="1" y1="5.5" x2="25" y2="5.5" stroke={color} strokeWidth="1.8" strokeDasharray={meta.dashed ? '4 3' : undefined} />
                          )}
                        </svg>
                        <span className="text-[11px] text-ink" style={{ color: on ? color : undefined }}>
                          {meta.label}
                        </span>
                        <span className="ml-auto text-[9.5px] text-ink-3">{on ? '显示' : '隐藏'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* 右侧：缩放与 LOD */}
      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-2">
        <div className="panel flex flex-col overflow-hidden">
          <button type="button" onClick={onZoomIn} className="px-2 py-1.5 text-ink-2 transition-colors hover:bg-cinnabar/10 hover:text-cinnabar" title="放大">
            <Plus size={14} />
          </button>
          <div className="h-px bg-line" />
          <button type="button" onClick={onZoomOut} className="px-2 py-1.5 text-ink-2 transition-colors hover:bg-cinnabar/10 hover:text-cinnabar" title="缩小">
            <Minus size={14} />
          </button>
          <div className="h-px bg-line" />
          <button type="button" onClick={onFit} className="px-2 py-1.5 text-ink-2 transition-colors hover:bg-cinnabar/10 hover:text-cinnabar" title="复位视图">
            <Maximize2 size={13} />
          </button>
        </div>
        <div className="panel px-2 py-1.5 text-right">
          <div className="font-serif text-[11px] text-ink">{lodLabel}</div>
          <div className="mt-0.5 text-[9.5px] text-ink-3">
            缩放 {scale.toFixed(2)}× · 可见 {visibleNodes}/{totalNodes}
          </div>
        </div>
      </div>
    </>
  );
}
