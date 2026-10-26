'use client';

/**
 * 档案抽屉 · 第一页：本传年表 + 行迹地图
 */
import { useState } from 'react';
import { ChevronDown, MapPin, Users } from 'lucide-react';
import type { HistoricalPersonNode } from '@/types/history';
import { CitationBlock, PersonChip, SectionLabel } from '@/components/ui/atoms';
import { HistoricalTrajectoryMap } from '@/components/map/HistoricalTrajectoryMap';
import { formatYear } from '@/lib/data-loader';

export function TabBiography({
  person,
  persons,
  onJumpPerson,
}: {
  person: HistoricalPersonNode;
  persons: HistoricalPersonNode[];
  onJumpPerson: (id: string) => void;
}) {
  const [openCitation, setOpenCitation] = useState<string | null>(null);
  const bio = person.structuredBiography;
  const isBrief = person.annotationLevel === 'brief';

  const blocks: { label: string; hint: string; text: string }[] = [
    { label: '早年与崛起', hint: '家世 · 师承 · 初仕', text: bio.earlyLife },
    { label: '核心功业', hint: '决策 · 战役 · 制度建设', text: bio.majorAchievements },
    { label: '转折与结局', hint: '盛衰之由 · 最终归宿', text: bio.turningPointsAndEnd },
  ].filter((b) => b.text?.trim());

  return (
    <div className="space-y-5">
      {/* 定评 */}
      <p className="rounded-lg border border-cinnabar/25 bg-cinnabar/[0.05] px-3 py-2.5 font-serif text-[13px] leading-[1.9] text-ink">
        {person.oneLineSummary}
      </p>

      {/* 档位声明：简目人物没有原文引证，必须让读者一眼看出来 */}
      {isBrief && (
        <div className="rounded-lg border border-line/80 bg-surface-2/40 px-3 py-2.5 text-[11.5px] leading-[1.85] text-ink-2">
          <span className="mr-1.5 rounded-[2px] bg-ink/80 px-1.5 py-0.5 font-serif text-[10px] text-canvas">
            简目
          </span>
          此条为人物简目：姓名、朝代、职官、生平骨架与关系均已考订，但
          <strong className="font-semibold text-ink">不附本传原文引证</strong>。
          {person.sourceChapters?.length ? (
            <>
              {' '}本传见
              {person.sourceChapters.map((c, i) => (
                <span key={`${c.bookTitle}${c.volumeAndChapter}`}>
                  {i > 0 ? '、' : ''}
                  {c.bookTitle}
                  {c.volumeAndChapter}
                </span>
              ))}
              ，可自行复核。
            </>
          ) : null}
        </div>
      )}

      {/* 结构化生平 */}
      <section>
        <SectionLabel extra="《二十四史》本传脉络">生平三阶</SectionLabel>
        <div className="space-y-2.5">
          {blocks.map((block, index) => (
            <div key={block.label} className="relative rounded-lg border border-line/70 bg-surface-2/35 px-3 py-2.5">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-[2px] bg-ink/80 font-serif text-[9.5px] text-canvas">
                  {index + 1}
                </span>
                <span className="font-serif text-[12.5px] font-semibold text-ink">{block.label}</span>
                <span className="text-[10px] text-ink-3">{block.hint}</span>
              </div>
              <p className="text-[12.5px] leading-[1.95] text-ink-2" style={{ textAlign: 'justify' }}>
                {block.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 史官总评 —— 简目人物多无专评，没有就整块不渲染，不代史官立言 */}
      {bio.historianAssessment ? (
        <section>
          <SectionLabel>史官总评</SectionLabel>
          <div className="rounded-lg border border-gold/30 bg-gold/[0.06] px-3 py-2.5">
            <div className="mb-1 text-[10.5px] font-medium tracking-wide text-gold">
              {bio.historianAssessment.commentator}
            </div>
            <blockquote className="classical-text text-[13.5px]">{bio.historianAssessment.originalQuote}</blockquote>
            <p className="modern-text mt-1.5 text-[12px]">{bio.historianAssessment.translation}</p>
          </div>
        </section>
      ) : null}

      {/* 年表 */}
      <section>
        <SectionLabel extra={`${person.lifeTimeline.length} 条 · 依公元纪年排序`}>本传年表</SectionLabel>
        <ol className="relative space-y-2.5 pl-4">
          <span aria-hidden className="absolute left-[5.5px] top-1.5 h-[calc(100%-10px)] w-px bg-line" />
          {person.lifeTimeline.map((event) => {
            const expanded = openCitation === event.id;
            const participants = (event.participatingPersonIds ?? [])
              .map((id) => persons.find((p) => p.id === id))
              .filter(Boolean) as HistoricalPersonNode[];
            return (
              <li key={event.id} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-4 top-[7px] h-[7px] w-[7px] rounded-full border border-cinnabar/70 bg-canvas"
                />
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-serif text-[12px] font-semibold text-cinnabar">
                    {formatYear(event.year)}
                  </span>
                  {event.eraNameYear ? (
                    <span className="text-[10.5px] text-ink-3">{event.eraNameYear}</span>
                  ) : null}
                  {typeof event.age === 'number' ? (
                    <span className="text-[10.5px] text-ink-3">时年 {event.age}</span>
                  ) : null}
                  <span className="font-serif text-[12.5px] font-semibold text-ink">{event.title}</span>
                </div>
                <p className="mt-0.5 text-[12px] leading-[1.9] text-ink-2" style={{ textAlign: 'justify' }}>
                  {event.description}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-ink-3">
                  {event.location ? (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin size={9} />
                      {event.location.ancientName}
                      <span className="text-ink-3/70">（今 {event.location.modernName}）</span>
                    </span>
                  ) : null}
                  {participants.length ? (
                    <span className="inline-flex items-center gap-1">
                      <Users size={9} />
                      {participants.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onJumpPerson(p.id)}
                          className="entity-link"
                        >
                          {p.name}
                        </button>
                      ))}
                    </span>
                  ) : null}
                  {event.citation ? (
                    <button
                      type="button"
                      onClick={() => setOpenCitation(expanded ? null : event.id)}
                      className="ml-auto inline-flex items-center gap-0.5 text-violet transition-colors hover:text-cinnabar"
                    >
                      史料依据
                      <ChevronDown
                        size={9}
                        className="transition-transform"
                        style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
                      />
                    </button>
                  ) : null}
                </div>
                {expanded && event.citation ? (
                  <div className="mt-1.5">
                    <CitationBlock citation={event.citation} dense />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      {/* 行迹地图 */}
      <section className="pb-2">
        <SectionLabel extra="据年表经纬度绘制">行迹地图</SectionLabel>
        <HistoricalTrajectoryMap person={person} persons={persons} onJumpPerson={onJumpPerson} />
      </section>

      {/* 生平交游 */}
      <section className="pb-2">
        <SectionLabel>本传所见之人</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {[
            ...new Set(person.lifeTimeline.flatMap((event) => event.participatingPersonIds ?? [])),
          ]
            .map((id) => persons.find((p) => p.id === id))
            .filter(Boolean)
            .slice(0, 14)
            .map((p) => (
              <PersonChip key={p!.id} person={p!} onClick={onJumpPerson} compact />
            ))}
        </div>
      </section>
    </div>
  );
}
