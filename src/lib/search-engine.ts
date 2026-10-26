/**
 * 多维全文检索引擎（名 / 字 / 号 / 谥号 / 庙号 / 封爵 / 官职 / 轶事典故 / 文言原文）
 * ------------------------------------------------------------------
 * 基于 MiniSearch 的客户端倒排索引，针对中文无空格文本做「单字 + 双字」
 * 复合分词，兼顾精确命中与模糊召回；并对姓名做子串优先加权，
 * 保证「曹操」「孟德」「魏武」「捉刀」等任意入口都能一步到位。
 */
import MiniSearch from 'minisearch';
import type {
  AnecdoteCategory,
  DynastyId,
  HistoricalPersonNode,
  HistoricalRelationEdge,
  RelationCategory,
} from '@/types/history';

export interface SearchHit {
  id: string;
  name: string;
  dynasty: DynastyId;
  score: number;
  /** 命中的字段，供结果卡片展示「为何命中」 */
  matchedIn: string[];
  snippet: string;
  person: HistoricalPersonNode;
}

interface SearchDoc {
  id: string;
  name: string;
  aliases: string;
  roles: string;
  titles: string;
  faction: string;
  summary: string;
  anecdotes: string;
  timeline: string;
  sources: string;
  all: string;
}

const CJK = /[\u3400-\u9fff]/;

/** 中文复合分词：CJK 串同时产出单字与双字 bigram，拉丁词按空格切分 */
export function cjkTokenize(text: string): string[] {
  if (!text) return [];
  const tokens: string[] = [];
  const normalized = text.toLowerCase();

  const latin = normalized.match(/[a-z0-9]+/g);
  if (latin) tokens.push(...latin);

  const runs = normalized.match(/[\u3400-\u9fff]+/g);
  if (runs) {
    for (const run of runs) {
      for (let i = 0; i < run.length; i += 1) {
        tokens.push(run[i]);
        if (i < run.length - 1) tokens.push(run.slice(i, i + 2));
      }
    }
  }
  return tokens;
}

function aliasesToText(person: HistoricalPersonNode): string {
  const a = person.aliases;
  return [
    a.courtesyName,
    ...(a.pseudonyms ?? []),
    a.posthumousTitle,
    a.templeName,
    ...(a.eraNames ?? []),
    ...(a.feudalTitles ?? []),
  ]
    .filter(Boolean)
    .join(' ');
}

function docOf(person: HistoricalPersonNode): SearchDoc {
  const aliasText = aliasesToText(person);
  const anecdoteText = person.anecdotes
    .map((a) => [a.title, a.idiomOrAllusion, a.narrativeSummary].filter(Boolean).join(' '))
    .join(' ');
  const timelineText = person.lifeTimeline.map((e) => `${e.title} ${e.description}`).join(' ');
  const sourceText = person.primarySources
    .map((s) => `${s.originalText} ${s.modernTranslation}`)
    .join(' ');
  const rolesText = [...person.roles, ...person.officialTitles].join(' ');

  return {
    id: person.id,
    name: person.name,
    aliases: aliasText,
    roles: rolesText,
    titles: person.officialTitles.join(' '),
    faction: person.factionOrClan ?? '',
    summary: person.oneLineSummary,
    anecdotes: anecdoteText,
    timeline: timelineText,
    sources: sourceText,
    all: [person.name, aliasText, rolesText, person.oneLineSummary, anecdoteText].join(' '),
  };
}

export interface SearchEngineOptions {
  /** 是否将文言原文纳入索引（数据量大时可关闭以提速） */
  includeSources?: boolean;
}

export class HistorySearchEngine {
  private mini: MiniSearch<SearchDoc>;
  private persons: Map<string, HistoricalPersonNode>;
  private docs: Map<string, SearchDoc>;

  constructor(persons: HistoricalPersonNode[], options: SearchEngineOptions = {}) {
    this.persons = new Map(persons.map((p) => [p.id, p]));
    this.docs = new Map();

    const docs = persons.map((p) => {
      const doc = docOf(p);
      if (!options.includeSources) doc.sources = '';
      this.docs.set(p.id, doc);
      return doc;
    });

    this.mini = new MiniSearch<SearchDoc>({
      fields: ['name', 'aliases', 'roles', 'titles', 'faction', 'summary', 'anecdotes', 'timeline', 'sources'],
      storeFields: ['id', 'name'],
      tokenize: cjkTokenize,
      processTerm: (term) => (term.length > 24 ? term.slice(0, 24) : term),
      searchOptions: {
        boost: { name: 8, aliases: 5, titles: 3, roles: 2.5, anecdotes: 2, summary: 1.6, timeline: 1.2, sources: 0.8 },
        fuzzy: 0.15,
        prefix: true,
        combineWith: 'AND',
      },
    });
    this.mini.addAll(docs);
  }

  search(query: string, limit = 12): SearchHit[] {
    const q = query.trim();
    if (!q) return [];

    const resultMap = new Map<string, { score: number; matched: Set<string> }>();

    // 1) 姓名/字号子串直命中（权重最高，保证「曹操」不被模糊结果挤掉）
    for (const person of this.persons.values()) {
      const aliasText = aliasesToText(person);
      let bonus = 0;
      const matched = new Set<string>();
      if (person.name === q) {
        bonus += 100;
        matched.add('姓名');
      } else if (person.name.startsWith(q)) {
        bonus += 60;
        matched.add('姓名');
      } else if (person.name.includes(q)) {
        bonus += 40;
        matched.add('姓名');
      }
      if (aliasText.includes(q)) {
        bonus += 26;
        matched.add('字号谥号');
      }
      if (bonus > 0) {
        resultMap.set(person.id, { score: bonus, matched });
      }
    }

    // 2) 倒排索引模糊召回
    let hits: { id: string; score: number; terms: string[]; match: Record<string, string[]> }[] = [];
    try {
      hits = this.mini.search(q, { combineWith: 'OR' }) as unknown as typeof hits;
    } catch {
      hits = [];
    }

    for (const hit of hits) {
      const prev = resultMap.get(hit.id);
      const fields = Object.keys(hit.match ?? {});
      const matchedIn = fields.map(fieldLabel).filter(Boolean);
      if (prev) {
        prev.score += hit.score * 0.5;
        matchedIn.forEach((m) => prev.matched.add(m));
      } else {
        resultMap.set(hit.id, { score: hit.score, matched: new Set(matchedIn) });
      }
    }

    const ranked = [...resultMap.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => {
        if (Math.abs(b.score - a.score) > 1) return b.score - a.score;
        const pa = this.persons.get(a.id)!.importanceWeight;
        const pb = this.persons.get(b.id)!.importanceWeight;
        return pb - pa;
      })
      .slice(0, limit);

    return ranked.map((r) => {
      const person = this.persons.get(r.id)!;
      return {
        id: r.id,
        name: person.name,
        dynasty: person.dynasty,
        score: r.score,
        matchedIn: [...r.matched],
        snippet: this.snippetOf(person, q),
        person,
      };
    });
  }

  /** 抽取命中上下文，配合 <mark> 高亮 */
  private snippetOf(person: HistoricalPersonNode, q: string): string {
    const pool = [
      person.oneLineSummary,
      ...person.anecdotes.map((a) => `${a.title}：${a.narrativeSummary}`),
      ...person.lifeTimeline.map((e) => `${e.title}：${e.description}`),
      ...person.primarySources.map((s) => s.originalText),
    ];
    const hit = pool.find((text) => text.includes(q));
    if (hit) return hit.length > 92 ? `${hit.slice(0, 92)}…` : hit;
    return person.oneLineSummary;
  }
}

function fieldLabel(field: string): string {
  const map: Record<string, string> = {
    name: '姓名',
    aliases: '字号谥号',
    roles: '身份',
    titles: '官职',
    faction: '阵营',
    summary: '定评',
    anecdotes: '轶事典故',
    timeline: '生平事件',
    sources: '史书原文',
  };
  return map[field] ?? '';
}

/* -------------------------------------------------------------------------- */
/*                          关系类型 / 轶事类别的元数据                        */
/* -------------------------------------------------------------------------- */

export const RELATION_META: Record<
  RelationCategory,
  { label: string; short: string; color: string; darkColor: string; dashed: boolean; double: boolean; description: string }
> = {
  kinship_blood: {
    label: '宗族血亲',
    short: '血亲',
    color: '#C83E31',
    darkColor: '#DE604E',
    dashed: false,
    double: false,
    description: '父子、母子、兄弟、叔侄、祖孙等直系与旁系血亲。',
  },
  kinship_marriage: {
    label: '姻亲后宫',
    short: '姻亲',
    color: '#C83E31',
    darkColor: '#DE604E',
    dashed: false,
    double: false,
    description: '夫妻、岳婿、连襟、外戚联姻与后宫关系。',
  },
  monarch_subject: {
    label: '君臣统属',
    short: '君臣',
    color: '#C59B27',
    darkColor: '#D6AF4A',
    dashed: false,
    double: false,
    description: '君主与臣僚、主公与谋士武将、上下级统属。',
  },
  political_ally: {
    label: '政治盟友',
    short: '盟友',
    color: '#2B7A78',
    darkColor: '#56A6A0',
    dashed: false,
    double: false,
    description: '同党、举荐、政治合作与利益共同体。',
  },
  political_rival: {
    label: '朝堂政敌',
    short: '政敌',
    color: '#8E354A',
    darkColor: '#BE607A',
    dashed: true,
    double: true,
    description: '党争、夺嫡、构陷与诛杀形成的对立关系。',
  },
  military_adversary: {
    label: '沙场宿敌',
    short: '宿敌',
    color: '#6C5B7B',
    darkColor: '#9A85B0',
    dashed: true,
    double: true,
    description: '战役交锋、攻伐对峙的军事对手。',
  },
  mentor_disciple: {
    label: '师承门生',
    short: '师承',
    color: '#5B8C5A',
    darkColor: '#7AAA76',
    dashed: true,
    double: false,
    description: '授业、举荐、学术与技艺传承。',
  },
  literary_bosom: {
    label: '诗酒至交',
    short: '至交',
    color: '#2B7A78',
    darkColor: '#56A6A0',
    dashed: false,
    double: false,
    description: '文学唱和、竹林之游、知音相惜。',
  },
};

export const ANECDOTE_META: Record<AnecdoteCategory, { label: string; tone: string; hint: string }> = {
  eccentric_demeanor: { label: '魏晋风度', tone: '#6C5B7B', hint: '怪癖性情 · 任诞放达' },
  wit_and_strategem: { label: '急智机锋', tone: '#C59B27', hint: '妙语诡道 · 权谋机变' },
  physiognomy_omen: { label: '异相奇征', tone: '#8E354A', hint: '骨相方术 · 谶纬预言' },
  culinary_lifestyle: { label: '饮食起居', tone: '#5B8C5A', hint: '器用服食 · 生活细节' },
  literary_romance: { label: '诗酒风流', tone: '#C83E31', hint: '情爱唱和 · 文人韵事' },
  historical_mystery: { label: '史海疑云', tone: '#3A608A', hint: '罗生门 · 真伪待考' },
};

export const RELIABILITY_META = {
  official_history_primary: { label: '正史本传', tone: '#5B8C5A', note: '二十四史本纪/列传正文，最高权威度' },
  official_history_hujian: { label: '他传互见', tone: '#3A608A', note: '二十四史「互见法」他篇记载' },
  authoritative_commentary: { label: '史家注疏', tone: '#6C5B7B', note: '裴松之、颜师古等注疏考辨' },
  chronicle_corroboration: { label: '编年佐证', tone: '#C59B27', note: '《资治通鉴》《通典》等编年政书' },
  literary_anecdotal: { label: '笔记轶闻·仅供参考', tone: '#C83E31', note: '《世说新语》《西京杂记》等笔记小说' },
} as const;

/** 分词辅助：判断是否包含 CJK 字符 */
export function hasCJK(text: string): boolean {
  return CJK.test(text);
}

/** 高亮 query 中的字符片段，返回 React 可渲染的分段 */
export function splitHighlight(text: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim();
  if (!q) return [{ text, hit: false }];
  const pieces: { text: string; hit: boolean }[] = [];
  let cursor = 0;
  let idx = text.indexOf(q, cursor);
  while (idx !== -1) {
    if (idx > cursor) pieces.push({ text: text.slice(cursor, idx), hit: false });
    pieces.push({ text: text.slice(idx, idx + q.length), hit: true });
    cursor = idx + q.length;
    idx = text.indexOf(q, cursor);
  }
  if (cursor < text.length) pieces.push({ text: text.slice(cursor), hit: false });
  return pieces;
}
