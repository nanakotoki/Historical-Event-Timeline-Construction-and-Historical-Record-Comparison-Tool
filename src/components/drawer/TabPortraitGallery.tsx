'use client';

/**
 * 档案抽屉 · 第二页：丹青画像 + Lightbox + 相貌考据 + AI 复原提示词
 * ------------------------------------------------------------------
 * 严格区分「传世真迹」「古籍版画」「依史料复原」「冠服剪影」四个等级，
 * 并在 UI 上明示当前等级与出处，绝不将生成图像冒充实物。
 */
import { useMemo, useRef, useState } from 'react';
import { Check, Copy, Expand, ImageOff, RotateCcw, Sparkles, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { HistoricalPersonNode, PortraitTier } from '@/types/history';
import { PortraitTierBadge, SectionLabel } from '@/components/ui/atoms';
import { resolvePortrait } from '@/lib/portrait-resolver';

const TIER_LADDER: { tier: PortraitTier; label: string; desc: string }[] = [
  {
    tier: 'tier1_authentic_painting',
    label: 'L1 · 传世古画原件',
    desc: '存世卷轴、册页原件（南薰殿旧藏帝王像、《历代圣贤半身像》册等）。若系后世摹本，出处栏另注摹绘年代。',
  },
  {
    tier: 'tier2_ancient_woodcut',
    label: 'L2 · 古籍版画',
    desc: '明清刻本插图与刊本绣像（《三才图会》《晚笑堂竹庄画传》《三国演义》《说唐演义全传》等），形象经刻工再创作，非写实。',
  },
  {
    tier: 'tier3_ai_reconstructed',
    label: 'L3 · 史料复原',
    desc: '以正史外貌描写原文为约束、依该朝代《舆服志》冠服规制生成，属研究性复原。',
  },
  {
    tier: 'tier4_attire_silhouette',
    label: 'L4 · 冠服剪影',
    desc: '史书未载容貌者，仅按朝代、官阶、性别给出符合礼制的白描冠服剪影，不臆造五官。',
  },
];

export function TabPortraitGallery({ person }: { person: HistoricalPersonNode }) {
  const resolved = useMemo(() => resolvePortrait(person), [person]);
  const [lightbox, setLightbox] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resolved.prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 画像主体 */}
      <section>
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setLightbox(true)}
            className="group relative shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2"
            style={{ width: 176 }}
            title="点击查看大图"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolved.fullSrc}
              alt={`${person.name} 画像（${resolved.tierLabel}）`}
              className="block w-full transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <span className="absolute bottom-1 right-1 rounded-[3px] bg-black/55 p-1 text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
              <Expand size={11} />
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <PortraitTierBadge tier={resolved.tier} title={resolved.tierNote} />
              {resolved.isGenerated ? (
                <span className="rounded-[3px] border border-azure/40 bg-azure/10 px-1.5 py-[1px] text-[9.5px] text-azure">
                  生成图像 · 非文物
                </span>
              ) : null}
            </div>
            <p className="text-[11.5px] leading-relaxed text-ink-2">{resolved.attribution}</p>
            {resolved.painterOrBook ? (
              <p className="mt-1 text-[10.5px] text-ink-3">绘者／底本：{resolved.painterOrBook}</p>
            ) : null}
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-3">{resolved.tierNote}</p>
          </div>
        </div>
      </section>

      {/* 检索声明：对「本站复原」的图，必须讲清为什么没有真图 */}
      {resolved.isGenerated ? (
        <section className="rounded-lg border border-dashed border-line bg-surface-2/40 px-3 py-2.5 text-[11px] leading-relaxed text-ink-3">
          <span className="text-ink-2">图档检索结果：</span>
          已就 Wikimedia Commons 逐一比定此人的传世图档，未获可定位、可确证为明清以前绘制的公有领域影像。
          <span className="mt-1 block">
            检索通路包括：Commons 分类页与题名检索、台北故宫《历代圣贤半身像》册、费城艺术博物馆《历代名臣像》册、
            《晚笑堂竹庄画传》《三才图会》《说唐演义全传》《三国演义》诸刊本绣像，以及日本国立国会图书馆、
            早稻田大学图书馆藏《历代君臣图像》全本扫描。
          </span>
          <span className="mt-1 block">
            已排除的对象：现代插画与白描重绘、影视剧照、AI 生成图、器物与雕塑照片、无人物之书法或碑刻页。
            故此处不作「借图充数」，改以本页所述方式生成，并在等级徽章中标明其非传世真迹。
          </span>
        </section>
      ) : null}

      {/* 相貌考据 */}
      <section>
        <SectionLabel extra={resolved.appearance ? resolved.appearance.bookSource : '史书未载'}>相貌考据</SectionLabel>
        {resolved.appearance ? (
          <div className="rounded-lg border border-line/70 bg-surface-2/40 px-3 py-2.5">
            <blockquote className="classical-text text-[13.5px]">
              「{resolved.appearance.quote}」
            </blockquote>
            <p className="modern-text mt-1.5 text-[12px]">{resolved.appearance.translation}</p>
            <p className="mt-1.5 text-[10.5px] text-ink-3">出处：{resolved.appearance.bookSource}</p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-dashed border-line px-3 py-3 text-[11.5px] leading-relaxed text-ink-3">
            <ImageOff size={13} className="mt-[2px] shrink-0" />
            <span>
              正史本传未载此人容貌、身高与体态，故本平台不使用任何虚构五官的复原图，仅提供符合朝代与官阶的冠服剪影（L4）。
              这是「零历史幻觉」原则在图像上的执行方式。
            </span>
          </div>
        )}
      </section>

      {/* AI 提示词 */}
      <section>
        <SectionLabel
          extra={
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[10.5px] text-violet transition-colors hover:text-cinnabar"
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? '已复制' : '复制提示词'}
            </button>
          }
        >
          古画复原提示词
        </SectionLabel>
        <div className="relative rounded-lg border border-violet/25 bg-violet/[0.05] px-3 py-2.5">
          <Sparkles size={11} className="absolute right-2.5 top-2.5 text-violet/50" />
          <p className="pr-5 text-[11.5px] leading-[1.9] text-ink-2">{resolved.prompt}</p>
          <p className="mt-1.5 text-[10px] text-ink-3">
            该提示词由「史载容貌 + 朝代冠服规制 + 工笔绢本风格」三段式模板生成，可直接用于图像模型复现。
          </p>
        </div>
      </section>

      {/* 四级梯度说明 */}
      <section className="pb-2">
        <SectionLabel extra={`当前：${resolved.tierLabel}`}>画像考据四级梯度</SectionLabel>
        <ol className="space-y-1.5">
          {TIER_LADDER.map((item) => {
            const active = item.tier === resolved.tier;
            return (
              <li
                key={item.tier}
                className={`rounded-lg border px-2.5 py-1.5 ${
                  active ? 'border-cinnabar/45 bg-cinnabar/[0.06]' : 'border-line/60 bg-surface-2/25'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`font-serif text-[11.5px] font-semibold ${active ? 'text-cinnabar' : 'text-ink-2'}`}>
                    {item.label}
                  </span>
                  {active ? (
                    <span className="rounded-[2px] bg-cinnabar/15 px-1 text-[9px] text-cinnabar">本页所用</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-3">{item.desc}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Lightbox */}
      {lightbox ? (
        <PortraitLightbox
          src={resolved.fullSrc}
          name={person.name}
          tier={resolved.tier}
          attribution={resolved.attribution}
          onClose={() => setLightbox(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * 全屏看图器：1x~5x 无级缩放 + 拖拽平移。
 * 画像本体是矢量 SVG，放大不糊；上限设 5 倍，再高只是徒增像素而不增信息。
 */
function PortraitLightbox({
  src,
  name,
  tier,
  attribution,
  onClose,
}: {
  src: string;
  name: string;
  tier: PortraitTier;
  attribution: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const applyZoom = (next: number) => {
    const clamped = Math.min(5, Math.max(1, next));
    setZoom(clamped);
    if (clamped === 1) setOffset({ x: 0, y: 0 });
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative max-h-full w-full max-w-[620px] overflow-hidden rounded-lg border border-white/15 bg-[#14161b] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="relative flex h-[64vh] items-center justify-center overflow-hidden bg-[#0f1116] select-none"
          style={{ cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in' }}
          onWheel={(event) => {
            event.preventDefault();
            applyZoom(zoom * Math.exp(-event.deltaY * 0.0018));
          }}
          onPointerDown={(event) => {
            if (zoom === 1) return;
            dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag) return;
            setOffset({ x: drag.ox + (event.clientX - drag.x), y: drag.oy + (event.clientY - drag.y) });
          }}
          onPointerUp={(event) => {
            dragRef.current = null;
            setDragging(false);
            event.currentTarget.releasePointerCapture?.(event.pointerId);
          }}
          onDoubleClick={() => applyZoom(zoom > 1 ? 1 : 2)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`${name} 画像大图`}
            draggable={false}
            className="max-h-full max-w-full object-contain"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transition: dragging ? 'none' : 'transform 0.16s ease-out',
            }}
          />
        </div>

        <div className="border-t border-white/10 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-serif text-[14px] font-semibold text-white/90">{name}</span>
            <PortraitTierBadge tier={tier} />
            <span className="ml-auto font-mono text-[10px] text-white/45">{zoom.toFixed(1)}×</span>
          </div>
          <p className="mt-1 text-[10.5px] leading-relaxed text-white/55">{attribution}</p>
          <p className="mt-1 text-[10px] text-white/35">滚轮缩放 · 放大后拖拽平移 · 双击复位</p>
        </div>

        <div className="absolute right-2 top-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => applyZoom(zoom / 1.5)}
            className="rounded-md bg-black/50 p-1.5 text-white/80 transition-colors hover:bg-black/70"
            aria-label="缩小"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={() => applyZoom(zoom * 1.5)}
            className="rounded-md bg-black/50 p-1.5 text-white/80 transition-colors hover:bg-black/70"
            aria-label="放大"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={() => applyZoom(1)}
            className="rounded-md bg-black/50 p-1.5 text-white/80 transition-colors hover:bg-black/70"
            aria-label="复位"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-black/50 p-1.5 text-white/80 transition-colors hover:bg-black/70"
            aria-label="关闭大图"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
