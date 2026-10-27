'use client';

/**
 * 顶栏工作条：品牌 / 时代分片开关 / 全局检索 / 寻路 / 主题
 */
import { Command, Loader2, Moon, Route, Search, Sun, ZoomIn } from 'lucide-react';
import type { GraphManifest } from '@/types/history';
import { useTheme } from '@/components/providers/ThemeProvider';

const SHARD_SHORT: Record<string, string> = {
  shard_01_pre_qin_qin: '先秦',
  shard_02_chu_han: '楚汉',
  shard_03_three_kingdoms: '三国',
  // 「两晋南北朝」五字标签在 58px 顶栏里会挤掉后面的分片，故简称「两晋」，
  // 全称仍留在 title 与 hover 提示里。
  shard_04_jin_nanbeichao: '两晋',
  shard_05_sui_tang: '隋唐',
  // 唯一一个四字简称：宋、元、明、清四朝去哪一个都不成话，只能全留。
  // 若不登记，会走 `title.slice(0, 4)`，而 title 是「宋元明清：赵宋至清季」，截出来正好也是这四字——
  // 靠巧合正确不算正确，故显式写明。
  shard_06_song_ming_qing: '宋元明清',
  shard_07_five_dynasties: '五代十国',
  // title 是「新莽更始：王莽改制到光武中兴」，slice(0,4) 会截成「新莽更始」——
  // 四字里「更始」是刘玄的年号，与「新莽」并称会让人以为是两个政权并列。
  // 顶栏只取二字「新莽」，全称留在 hover 提示里。
  shard_08_xin_mang: '新莽',
};

export function TopOmniBar({
  manifest,
  activeShards,
  onToggleShard,
  loading,
  onOpenSearch,
  onOpenPath,
  onFit,
  visibleCount,
}: {
  manifest: GraphManifest | null;
  activeShards: Set<string>;
  onToggleShard: (shardId: string) => void;
  loading: boolean;
  onOpenSearch: () => void;
  onOpenPath: () => void;
  onFit: () => void;
  visibleCount: number;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="relative z-50 flex h-[58px] shrink-0 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md">
      {/* 品牌 */}
      <div className="flex items-center gap-2.5">
        <span className="seal h-8 w-8 text-[19px]">史</span>
        <div className="leading-tight">
          <div className="font-serif text-[15px] font-semibold tracking-wide text-ink">华夏史网</div>
          <div className="text-[9px] tracking-[0.14em] text-ink-3">CHRONOGRAPH · CHINA</div>
        </div>
      </div>

      <div className="vert-divider mx-1 h-7" />

      {/* 时代分片 */}
      <div className="flex items-center gap-1.5">
        <span className="hidden text-[10px] text-ink-3 lg:inline">时代分片</span>
        {(manifest?.shards ?? []).map((shard) => {
          const active = activeShards.has(shard.shardId);
          const short = SHARD_SHORT[shard.shardId] ?? shard.title.slice(0, 4);
          return (
            <button
              key={shard.shardId}
              type="button"
              onClick={() => onToggleShard(shard.shardId)}
              title={`${shard.title}\n${shard.personCount} 人 · ${shard.edgeCount} 条关系边 · 点击加载/卸载`}
              data-active={active}
              className="tool-btn data-[active=true]:border-cinnabar/55 data-[active=true]:bg-cinnabar/10 data-[active=true]:text-cinnabar"
            >
              <span className="font-serif">{short}</span>
              <span className="text-[9.5px] opacity-70">{shard.personCount}</span>
            </button>
          );
        })}
        {(manifest?.plannedShards ?? []).slice(0, 2).map((planned) => (
          <span
            key={planned.shardId}
            className="tool-btn cursor-not-allowed opacity-45"
            title="该时代分片尚未入库，可参考 scripts/etl/README.md 自行扩充"
          >
            <span className="font-serif">{planned.title.slice(0, 4)}</span>
            <span className="text-[9px]">待建</span>
          </span>
        ))}
        {loading ? <Loader2 size={12} className="animate-spin text-cinnabar" /> : null}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* 统计 */}
        <div className="mr-1 hidden items-center gap-2.5 text-[10px] text-ink-3 xl:flex">
          <span>
            在册 <b className="font-serif text-[11.5px] text-ink">{manifest?.stats.personCount ?? 0}</b> 人
          </span>
          <span className="h-3 w-px bg-line" />
          <span>
            关系 <b className="font-serif text-[11.5px] text-ink">{manifest?.stats.edgeCount ?? 0}</b> 条
          </span>
          <span className="h-3 w-px bg-line" />
          <span>
            引文 <b className="font-serif text-[11.5px] text-ink">{manifest?.stats.citationCount ?? 0}</b> 处
          </span>
          <span className="h-3 w-px bg-line" />
          <span>当前视口 {visibleCount} 人</span>
        </div>

        <button type="button" onClick={onOpenSearch} className="tool-btn" title="全局检索（⌘K / Ctrl+K）">
          <Search size={12} />
          <span className="hidden sm:inline">检索</span>
          <kbd className="ml-0.5 hidden rounded border border-line bg-surface-2 px-1 text-[9px] sm:inline">⌘K</kbd>
        </button>

        <button type="button" onClick={onOpenPath} className="tool-btn" title="六度分隔寻路">
          <Route size={12} />
          <span className="hidden sm:inline">寻路</span>
        </button>

        <button type="button" onClick={onFit} className="tool-btn" title="复位视图">
          <ZoomIn size={12} />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="tool-btn"
          title={theme === 'dark' ? '切换为宣纸日间' : '切换为玄墨夜间'}
          aria-label="切换主题"
        >
          {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
          <span className="hidden md:inline">{theme === 'dark' ? '宣纸' : '玄墨'}</span>
        </button>
      </div>

      {/* 快捷键提示（桌面宽屏） */}
      <div className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 pt-1 2xl:hidden">
        <span className="inline-flex items-center gap-1 rounded-b-md border border-t-0 border-line bg-surface/80 px-2 py-0.5 text-[9px] text-ink-3">
          <Command size={8} />K 检索 · 滚轮缩放 · 拖拽平移 · 双击节点聚焦
        </span>
      </div>
    </header>
  );
}
