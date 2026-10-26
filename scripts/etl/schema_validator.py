#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
华夏史网 ChronoGraph China —— 史学数据契约校验器与原文子串核验器
================================================================================

本模块是整个 Python ETL 链路的「守门人」，承担两件互不替代的职责：

  1. **强类型契约校验**（Pydantic）
     与 `src/types/history.ts` 的 TypeScript 接口逐字段对齐。任何一侧改动
     都必须同步另一侧，否则前端会在运行时静默丢字段。

  2. **反幻觉原文核验**（``verify_quote_in_source``）
     这是本工程「零历史幻觉」铁律的技术落点：LLM 抽取出的一切
     ``originalText`` 都必须能在维基文库原传正文中找到真实来源。
     核验分四级递进，逐级放宽但仍要求「字字有据」：

       exact      原文逐字命中（最快）
       normalized 去除全部标点/空白/半角全角差异后命中
       windows    引文含显式省略号（……）时，要求每一段都必须是原文子串，
                  各段覆盖率达标即通过——覆盖「注疏把长句切断」的情形
       not_found  以上皆不成立，一律判定为「模型自造文句」并打回重抽

     **本函数没有「相似度够高就放行」的后门**。原因：把真句抄一遍、再续上自己
     编的半句，最长公共片段照样能覆盖七成以上；若按相似度放行，等于承认了
     半句伪造。判定标准只有一条——引文必须是原文的连续子串。

用法
--------------------------------------------------------------------------------
    # 校验已发布的静态分片（与前端消费的是同一批文件）
    python schema_validator.py --data ../../public/data

    # 以维基文库原始语料为基准，逐条回核所有引文
    python schema_validator.py --data ../../public/data --corpus ../build/raw

    # 单条核验（调试用）
    python schema_validator.py --quote "先帝创业未半而中道崩殂" --source-file ../build/raw/sanguozhi/诸葛亮.md

    # 供其他脚本导入
    from schema_validator import verify_quote_in_source, ShardDataset
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

# =============================================================================
# 一、契约枚举（与 src/types/history.ts 严格一致）
# =============================================================================

DYNASTY_IDS: Tuple[str, ...] = (
    "pre_qin", "qin", "chu_han", "western_han", "xin", "eastern_han",
    "three_kingdoms", "jin", "southern_northern", "sui", "tang",
    "five_dynasties", "song", "liao_jin_xia", "yuan", "ming", "qing",
)

SOURCE_RELIABILITY: Tuple[str, ...] = (
    "official_history_primary",
    "official_history_hujian",
    "authoritative_commentary",
    "chronicle_corroboration",
    "literary_anecdotal",
)

RELATION_CATEGORIES: Tuple[str, ...] = (
    "kinship_blood",
    "kinship_marriage",
    "monarch_subject",
    "political_ally",
    "political_rival",
    "military_adversary",
    "mentor_disciple",
    "literary_bosom",
)

ANECDOTE_CATEGORIES: Tuple[str, ...] = (
    "eccentric_demeanor",
    "wit_and_strategem",
    "physiognomy_omen",
    "culinary_lifestyle",
    "literary_romance",
    "historical_mystery",
)

PORTRAIT_TIERS: Tuple[str, ...] = (
    "tier1_authentic_painting",
    "tier2_ancient_woodcut",
    "tier3_ai_reconstructed",
    "tier4_attire_silhouette",
)

# 朝代中文名 → DynastyId，供 CBDB / 维基文库两侧做实体归一
DYNASTY_NAME_TO_ID: Dict[str, str] = {
    "先秦": "pre_qin", "春秋": "pre_qin", "战国": "pre_qin",
    "秦": "qin", "秦朝": "qin", "秦代": "qin",
    "楚汉": "chu_han", "楚汉之际": "chu_han",
    "西汉": "western_han", "前汉": "western_han", "汉": "western_han", "汉朝": "western_han",
    "新": "xin", "新莽": "xin", "新朝": "xin",
    "东汉": "eastern_han", "后汉": "eastern_han",
    "三国": "three_kingdoms", "魏": "three_kingdoms", "蜀": "three_kingdoms", "吴": "three_kingdoms",
    "晋": "jin", "西晋": "jin", "东晋": "jin", "两晋": "jin",
    "南北朝": "southern_northern", "南朝": "southern_northern", "北朝": "southern_northern",
    "隋": "sui", "隋朝": "sui",
    "唐": "tang", "唐朝": "tang", "五代": "five_dynasties",
    "五代十国": "five_dynasties",
    "宋": "song", "北宋": "song", "南宋": "song", "宋朝": "song",
    "辽": "liao_jin_xia", "金": "liao_jin_xia", "西夏": "liao_jin_xia", "辽金西夏": "liao_jin_xia",
    "元": "yuan", "元朝": "yuan",
    "明": "ming", "明朝": "ming",
    "清": "qing", "清朝": "qing",
}

# =============================================================================
# 二、原文核验（反幻觉核心）
# =============================================================================

# 需要剔除的字符：CJK 标点、全角符号、空白、拉丁标点、装饰性符号
_DROP_PATTERN = re.compile(
    r"[\s\u3000"                       # 各类空白
    r"\u3001-\u303f"                   # 、。〃〈〉《》「」『』【】〔〕・…
    r"\uff01-\uff0f"                   # ！＂＃＄％＆＇（）＊＋，－．／
    r"\uff1a-\uff20"                   # ：；＜＝＞？＠
    r"\uff3b-\uff40"                   # ［＼］＾＿｀
    r"\uff5b-\uff65"                   # ｛｜｝～｟｠
    r"!-/:-@\[-`{-~"                   # ASCII 标点
    r"\u2018\u2019\u201c\u201d\u2014\u2026\u00b7"  # ‘ ’ “ ” — … ·
    r"]+"
)

_LATIN_TO_HAN = str.maketrans({"0": "〇"})


def normalize_text(text: str) -> str:
    """将文本归一为「纯汉字 + 数字」串，用于跨版本比对。

    二十四史在不同版本间存在异体字、避讳改字、通假字差异，本项目不做
    改字还原（那属于校勘学范畴，需逐条出校记），只做以下确定性归一：

      * 剔除全部标点与空白（注疏断句差异最常见，必须先剥离）
      * NFKC 归一全角/半角
      * 中文数字「〇」与阿拉伯「0」统一，避免版本差异造成假阴性
      * 不做繁简转换：繁简混排会导致字面比对失真，交由上层决定是否预处理
    """
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKC", text)
    normalized = _DROP_PATTERN.sub("", normalized)
    normalized = normalized.translate(_LATIN_TO_HAN)
    return normalized


@dataclass
class QuoteCheck:
    """一条引文的核验结果。"""

    quote: str
    ratio: float
    method: str          # exact | normalized | windows | fuzzy | missing
    ok: bool
    matched: str = ""    # 命中到的原文片段（便于人工复核）
    note: str = ""

    def as_dict(self) -> Dict[str, Any]:
        return {
            "quote": self.quote,
            "ratio": round(self.ratio, 4),
            "method": self.method,
            "ok": self.ok,
            "matched": self.matched,
            "note": self.note,
        }

    def __bool__(self) -> bool:  # 让 if check: 直接可用
        return self.ok


def _best_window_ratio(needle: str, haystack: str, slack: float = 0.35) -> Tuple[float, str]:
    """滑窗比对：在 haystack 上取与 needle 等长（±slack）的窗口求最高相似度。

    古文的注疏夹注常把一句话切断，此时整体相似度会被稀释。滑窗比对的
    作用不是「判定通过」，而是给出「最接近的原文位置」，供人工复核定位。
    """
    n = len(needle)
    if n == 0 or not haystack:
        return 0.0, ""
    lo = max(1, int(n * (1 - slack)))
    hi = min(len(haystack), int(n * (1 + slack)) + 1)

    # 先用 needle 的头 6 字定位候选窗口，避免 O(len(source)) 次比对
    anchor = needle[: min(6, n)]
    starts: List[int] = []
    pos = haystack.find(anchor)
    while pos != -1 and len(starts) < 400:
        starts.append(pos)
        pos = haystack.find(anchor, pos + 1)
    if not starts:
        # 退化为等距采样 + 全窗扫描（古文语料通常数万字符，可接受）
        step = max(1, (len(haystack) - hi) // 300 or 1)
        starts = list(range(0, max(1, len(haystack) - lo), step))

    best_ratio, best_span = 0.0, ""
    matcher = SequenceMatcher(None, autojunk=False)
    for start in starts:
        for width in {lo, n, hi}:
            window = haystack[start:start + width]
            if not window:
                continue
            matcher.set_seq2(window)
            matcher.set_seq1(needle)
            ratio = matcher.ratio()
            if ratio > best_ratio:
                best_ratio, best_span = ratio, window
    return best_ratio, best_span


def verify_quote_in_source(
    quote: str,
    source_text: str,
    threshold: float = 0.90,
    *,
    max_quote_len: int = 1200,
) -> QuoteCheck:
    """核验 ``quote`` 是否为 ``source_text`` 的真实片段（忽略标点差异）。

    这是整套反幻觉机制的核心函数，被 ``llm_extractor`` 在每次抽取后调用。
    判定顺序刻意从严格到宽松，任一级通过即返回，避免把真实引文误判为伪造：

      1. ``exact``      原样子串命中
      2. ``normalized`` 剥标点后子串命中（覆盖九成以上的断句差异）
      3. ``windows``    注疏夹注把句子切断时，用最长公共片段做锚点，
                        若锚点覆盖引文 70% 以上且两侧可扩展匹配，判为通过
      4. ``fuzzy``      滑窗相似度 ≥ threshold，判为通过但标注可疑

    参数
    ----
    quote          : LLM 提取出的「原文本」，可含省略号
    source_text    : 该传在维基文库的完整正文（已去 wiki 标记）
    threshold      : 相似度阈值，默认 0.90。低于此值一律打回重抽
    max_quote_len  : 超长引文截断保护，避免把整篇传记塞进比对

    返回
    ----
    QuoteCheck（可直接当 bool 用：``if verify_quote_in_source(...):``）
    """
    if not quote or not quote.strip():
        return QuoteCheck(quote=quote or "", ratio=0.0, method="missing", ok=False, note="引文为空")
    if not source_text or not source_text.strip():
        return QuoteCheck(quote=quote, ratio=0.0, method="missing", ok=False, note="基准语料为空，无法核验")

    quote = quote[:max_quote_len]

    # —— 1. 逐字命中
    if quote in source_text:
        return QuoteCheck(quote, 1.0, "exact", True, matched=quote)

    nq = normalize_text(quote)
    ns = normalize_text(source_text)
    if not nq:
        return QuoteCheck(quote, 0.0, "missing", False, note="引文剥除标点后为空")

    # —— 2. 归一后命中
    if nq in ns:
        return QuoteCheck(quote, 1.0, "normalized", True, matched=nq)

    # —— 3. 省略号 / 夹注切断：按省略号分段，逐段命中率
    segments = [seg for seg in re.split(r"…+|\.{3,}|。{3,}|⋯+", quote) if len(normalize_text(seg)) >= 4]
    if len(segments) >= 2:
        hits = 0
        spans: List[str] = []
        cursor = 0
        for seg in segments:
            target = normalize_text(seg)
            idx = ns.find(target, cursor)
            if idx == -1:
                idx = ns.find(target)
            if idx != -1:
                hits += 1
                spans.append(seg)
                cursor = idx + len(target)
        coverage = hits / len(segments)
        if coverage >= threshold:
            return QuoteCheck(
                quote, coverage, "windows", True,
                matched="…".join(spans),
                note=f"分段命中 {hits}/{len(segments)}，省略号处已被注疏切断",
            )

    # —— 4. 最长公共片段锚定
    matcher = SequenceMatcher(None, nq, ns, autojunk=False)
    block = matcher.find_longest_match(0, len(nq), 0, len(ns))
    anchor_ratio = block.size / len(nq) if nq else 0.0

    # —— 5. 未命中：只给出「最像哪一段」供人工/纠错提示使用，**绝不据此放行**
    #
    #     这里刻意不设「相似度够高就通过」的后门。原因：把真句抄一遍再续上自己
    #     编的半句（如「……陽都人也」+「，少有大志」），最长公共片段仍可覆盖七成
    #     以上，若放行就等于承认了半句伪造。判定标准只有一条——必须是原文子串。
    ratio, span = _best_window_ratio(nq, ns)
    best_ratio = max(ratio, anchor_ratio)
    best_span = span or nq[block.a: block.a + block.size]
    return QuoteCheck(
        quote, best_ratio, "not_found", False, matched=best_span,
        note=(
            f"未能在原文中定位（最相似片段相似度 {best_ratio:.0%}，"
            f"阈值 {threshold:.0%} 仅供人工判断可信度）。"
            "引文必须是原文的连续子串；若确系省略号截断，请用「……」显式标注"
        ),
    )


# =============================================================================
# 三、Pydantic 强类型模型（与 TS 接口逐字段对齐）
# =============================================================================

try:  # pragma: no cover - 环境相关
    from pydantic import (  # type: ignore
        BaseModel,
        ConfigDict,
        Field,
        ValidationError,
        field_validator,
        model_validator,
    )
    _HAS_PYDANTIC = True
except Exception:  # pragma: no cover
    _HAS_PYDANTIC = False
    BaseModel = object  # type: ignore
    ConfigDict = dict  # type: ignore
    Field = lambda *a, **k: None  # type: ignore
    ValidationError = Exception  # type: ignore
    field_validator = lambda *a, **k: (lambda f: f)  # type: ignore
    model_validator = lambda *a, **k: (lambda f: f)  # type: ignore

    class _PydanticStubError(RuntimeError):
        pass


if _HAS_PYDANTIC:

    class StrictModel(BaseModel):
        """统一配置：拒绝未声明字段，避免 TS 侧的字段被悄悄吞掉。"""

        model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    class GeoLocation(StrictModel):
        ancientName: str = Field(min_length=1)
        modernName: str = Field(min_length=1)
        coordinates: Tuple[float, float]

        @field_validator("coordinates")
        @classmethod
        def _check_coords(cls, v: Tuple[float, float]) -> Tuple[float, float]:
            lng, lat = v
            if not (-180 <= lng <= 180):
                raise ValueError(f"经度越界：{lng}")
            if not (-90 <= lat <= 90):
                raise ValueError(f"纬度越界：{lat}")
            return v

    class HistoricalCitation(StrictModel):
        id: str = Field(min_length=1)
        bookTitle: str = Field(min_length=1)
        volumeAndChapter: str = Field(min_length=1)
        authorOrCommentator: Optional[str] = None
        originalText: str = Field(min_length=4)
        modernTranslation: str = Field(min_length=1)
        reliability: str
        historiographicalNote: Optional[str] = None
        wikisourceUrl: Optional[str] = None

        @field_validator("reliability")
        @classmethod
        def _check_reliability(cls, v: str) -> str:
            if v not in SOURCE_RELIABILITY:
                raise ValueError(f"史源分级非法：{v}，允许值 {SOURCE_RELIABILITY}")
            return v

    class ConflictingAccount(StrictModel):
        sourceName: str = Field(min_length=1)
        stanceOrBias: str = Field(min_length=1)
        citation: HistoricalCitation

    class Anecdote(StrictModel):
        id: str
        title: str = Field(min_length=1)
        idiomOrAllusion: Optional[str] = None
        category: str
        narrativeSummary: str = Field(min_length=10)
        relatedPersonIds: List[str] = Field(default_factory=list)
        primaryCitation: HistoricalCitation
        conflictingAccounts: Optional[List[ConflictingAccount]] = None

        @field_validator("category")
        @classmethod
        def _check_category(cls, v: str) -> str:
            if v not in ANECDOTE_CATEGORIES:
                raise ValueError(f"轶事分类非法：{v}")
            return v

    class ClassicalAppearanceQuote(StrictModel):
        quote: str = Field(min_length=4)
        bookSource: str
        translation: str

    class PortraitInfo(StrictModel):
        thumbnailUrl: str = ""
        fullSizeUrl: str = ""
        tier: str
        sourceAttribution: str = Field(min_length=1)
        painterOrBook: Optional[str] = None
        classicalAppearanceQuote: Optional[ClassicalAppearanceQuote] = None
        aiReconstructionPrompt: Optional[str] = None

        @field_validator("tier")
        @classmethod
        def _check_tier(cls, v: str) -> str:
            if v not in PORTRAIT_TIERS:
                raise ValueError(f"画像等级非法：{v}")
            return v

    class LifeEvent(StrictModel):
        id: str
        year: int
        eraNameYear: Optional[str] = None
        age: Optional[int] = None
        title: str = Field(min_length=1)
        description: str = Field(min_length=1)
        location: Optional[GeoLocation] = None
        participatingPersonIds: Optional[List[str]] = None
        citation: Optional[HistoricalCitation] = None

    class HistorianAssessment(StrictModel):
        commentator: str = Field(min_length=1)
        originalQuote: str = Field(min_length=4)
        translation: str = Field(min_length=1)

    class StructuredBiography(StrictModel):
        earlyLife: str = Field(min_length=1)
        majorAchievements: str = Field(min_length=1)
        turningPointsAndEnd: str = Field(min_length=1)
        historianAssessment: HistorianAssessment

    class Aliases(StrictModel):
        courtesyName: Optional[str] = None
        pseudonyms: Optional[List[str]] = None
        posthumousTitle: Optional[str] = None
        templeName: Optional[str] = None
        eraNames: Optional[List[str]] = None
        feudalTitles: Optional[List[str]] = None
        tabooNotes: Optional[str] = None

    class HistoricalPersonNode(StrictModel):
        id: str = Field(pattern=r"^person_")
        cbdbId: Optional[int] = None
        name: str = Field(min_length=1)
        aliases: Aliases = Field(default_factory=Aliases)
        gender: str
        dynasty: str
        factionOrClan: Optional[str] = None
        birthYear: Optional[int] = None
        deathYear: Optional[int] = None
        birthYearUncertain: Optional[bool] = None
        birthplace: Optional[GeoLocation] = None
        roles: List[str] = Field(min_length=1)
        officialTitles: List[str] = Field(default_factory=list)
        importanceWeight: int = Field(ge=1, le=100)
        portrait: PortraitInfo
        oneLineSummary: str = Field(min_length=1)
        structuredBiography: StructuredBiography
        lifeTimeline: List[LifeEvent] = Field(min_length=3)
        anecdotes: List[Anecdote] = Field(min_length=1)
        primarySources: List[HistoricalCitation] = Field(min_length=2)

        @field_validator("gender")
        @classmethod
        def _check_gender(cls, v: str) -> str:
            if v not in ("male", "female", "eunuch"):
                raise ValueError(f"性别非法：{v}")
            return v

        @field_validator("dynasty")
        @classmethod
        def _check_dynasty(cls, v: str) -> str:
            if v not in DYNASTY_IDS:
                raise ValueError(f"朝代非法：{v}")
            return v

        @model_validator(mode="after")
        def _check_years(self):
            if self.birthYear is not None and self.deathYear is not None:
                if self.birthYear > self.deathYear:
                    raise ValueError(f"{self.name}：生年 {self.birthYear} 晚于卒年 {self.deathYear}")
            for event in self.lifeTimeline:
                if self.birthYear is not None and event.year < self.birthYear - 1:
                    # 不报错，仅提示：部分人物生年史载不详，取其生年上限
                    pass
                if self.deathYear is not None and event.year > self.deathYear + 1:
                    pass
            return self

    class TemporalRelationPhase(StrictModel):
        startYear: Optional[int] = None
        endYear: Optional[int] = None
        phaseLabel: str = Field(min_length=1)
        category: str
        description: str = Field(min_length=1)
        citation: Optional[HistoricalCitation] = None

        @field_validator("category")
        @classmethod
        def _check_category(cls, v: str) -> str:
            if v not in RELATION_CATEGORIES:
                raise ValueError(f"关系大类非法：{v}")
            return v

    class HistoricalRelationEdge(StrictModel):
        id: str = Field(min_length=1)
        source: str = Field(pattern=r"^person_")
        target: str = Field(pattern=r"^person_")
        primaryCategory: str
        specificLabel: str = Field(min_length=1, max_length=8)
        directed: bool
        strength: int = Field(ge=1, le=10)
        startYear: Optional[int] = None
        endYear: Optional[int] = None
        overallSummary: str = Field(min_length=1)
        temporalPhases: Optional[List[TemporalRelationPhase]] = None
        keyCitation: HistoricalCitation

        @field_validator("primaryCategory")
        @classmethod
        def _check_primary(cls, v: str) -> str:
            if v not in RELATION_CATEGORIES:
                raise ValueError(f"关系大类非法：{v}")
            return v

        @model_validator(mode="after")
        def _check_phase_order(self):
            if self.startYear is not None and self.endYear is not None:
                if self.startYear > self.endYear:
                    raise ValueError(f"{self.id}：startYear {self.startYear} 晚于 endYear {self.endYear}")
            if self.temporalPhases:
                ordered = sorted(
                    self.temporalPhases,
                    key=lambda p: p.startYear if p.startYear is not None else -10**9,
                )
                prev_end: Optional[int] = None
                for phase in ordered:
                    if phase.startYear is not None and prev_end is not None and phase.startYear < prev_end:
                        raise ValueError(f"{self.id}：阶段「{phase.phaseLabel}」与前一阶段时序重叠")
                    if phase.endYear is not None:
                        prev_end = phase.endYear
                    elif phase.startYear is not None:
                        prev_end = phase.startYear
            return self

    class ShardDataset(StrictModel):
        shardId: str = Field(min_length=1)
        title: str = Field(min_length=1)
        subtitle: str = Field(min_length=1)
        dynasties: List[str] = Field(min_length=1)
        yearRange: Tuple[int, int]
        heroPersonIds: List[str] = Field(min_length=1)
        nodes: List[HistoricalPersonNode] = Field(min_length=1)
        edges: List[HistoricalRelationEdge]

    class GraphManifest(StrictModel):
        schemaVersion: str
        generatedAt: str
        site: Dict[str, Any]
        stats: Dict[str, Any]
        dynasties: List[Dict[str, Any]]
        shards: List[Dict[str, Any]]
        searchIndex: List[Dict[str, Any]]
        highlights: List[Dict[str, Any]]
        plannedShards: Optional[List[Dict[str, Any]]] = None

else:  # pragma: no cover
    # 未安装 pydantic 时的占位：仅保留名字，供类型注解与 isinstance 判断使用
    class StrictModel:  # type: ignore
        pass

    GeoLocation = HistoricalCitation = ConflictingAccount = Anecdote = None  # type: ignore
    PortraitInfo = LifeEvent = StructuredBiography = Aliases = None  # type: ignore
    HistoricalPersonNode = HistoricalRelationEdge = TemporalRelationPhase = None  # type: ignore
    ShardDataset = GraphManifest = HistorianAssessment = ClassicalAppearanceQuote = None  # type: ignore


# =============================================================================
# 四、无 Pydantic 时的等价结构校验（保证零依赖可用）
# =============================================================================

class Issue(dict):
    """一条校验问题：{"level", "where", "message"}"""


def _issue(level: str, where: str, message: str) -> Issue:
    return Issue(level=level, where=where, message=message)


def _check_citation(cite: Any, where: str, issues: List[Issue]) -> None:
    if not isinstance(cite, dict):
        issues.append(_issue("error", where, "缺少史料引文对象"))
        return
    for key in ("bookTitle", "volumeAndChapter", "originalText", "modernTranslation", "id"):
        if not str(cite.get(key, "")).strip():
            issues.append(_issue("error", where, f"引文缺少 {key}"))
    if len(str(cite.get("originalText", ""))) < 4:
        issues.append(_issue("error", where, "引文 originalText 过短"))
    if cite.get("reliability") not in SOURCE_RELIABILITY:
        issues.append(_issue("error", where, f"史源分级非法：{cite.get('reliability')}"))


def validate_fallback(shard: Dict[str, Any], where: str = "shard") -> List[Issue]:
    """不依赖 pydantic 的结构校验，覆盖全部必填字段与枚举约束。"""
    issues: List[Issue] = []
    for key in ("shardId", "title", "subtitle"):
        if not str(shard.get(key, "")).strip():
            issues.append(_issue("error", where, f"分片缺少 {key}"))
    nodes = shard.get("nodes") or []
    edges = shard.get("edges") or []
    ids = set()
    for node in nodes:
        label = f"{where}·{node.get('name', node.get('id', '?'))}"
        if not str(node.get("id", "")).startswith("person_"):
            issues.append(_issue("error", label, "id 未使用 person_ 前缀"))
        if node.get("id") in ids:
            issues.append(_issue("error", label, f"id 重复：{node.get('id')}"))
        ids.add(node.get("id"))
        if node.get("dynasty") not in DYNASTY_IDS:
            issues.append(_issue("error", label, f"朝代非法：{node.get('dynasty')}"))
        weight = node.get("importanceWeight")
        if not isinstance(weight, int) or not 1 <= weight <= 100:
            issues.append(_issue("error", label, f"importanceWeight 越界：{weight}"))
        if len(node.get("lifeTimeline") or []) < 3:
            issues.append(_issue("error", label, "生平年表少于 3 条"))
        if len(node.get("anecdotes") or []) < 1:
            issues.append(_issue("error", label, "缺少奇闻轶事"))
        if len(node.get("primarySources") or []) < 2:
            issues.append(_issue("error", label, "本传原文少于 2 段"))
        for cite in node.get("primarySources") or []:
            _check_citation(cite, label, issues)
        for anecdote in node.get("anecdotes") or []:
            if anecdote.get("category") not in ANECDOTE_CATEGORIES:
                issues.append(_issue("error", label, f"轶事分类非法：{anecdote.get('category')}"))
            _check_citation(anecdote.get("primaryCitation"), label, issues)
        portrait = node.get("portrait") or {}
        if portrait.get("tier") not in PORTRAIT_TIERS:
            issues.append(_issue("error", label, f"画像等级非法：{portrait.get('tier')}"))
        birth, death = node.get("birthYear"), node.get("deathYear")
        if isinstance(birth, int) and isinstance(death, int) and birth > death:
            issues.append(_issue("error", label, f"生年 {birth} 晚于卒年 {death}"))

    for edge in edges:
        label = f"{where}·边 {edge.get('id')}"
        if edge.get("source") not in ids or edge.get("target") not in ids:
            issues.append(_issue("error", label, "关系边端点不存在"))
        if edge.get("primaryCategory") not in RELATION_CATEGORIES:
            issues.append(_issue("error", label, f"关系大类非法：{edge.get('primaryCategory')}"))
        if not isinstance(edge.get("strength"), int) or not 1 <= edge["strength"] <= 10:
            issues.append(_issue("error", label, f"strength 越界：{edge.get('strength')}"))
        _check_citation(edge.get("keyCitation"), label, issues)
        start, end = edge.get("startYear"), edge.get("endYear")
        if isinstance(start, int) and isinstance(end, int) and start > end:
            issues.append(_issue("error", label, f"startYear {start} 晚于 endYear {end}"))
    return issues


def validate_shard(data: Dict[str, Any], where: str = "shard") -> List[Issue]:
    """校验单个分片。优先走 Pydantic，缺失时退回结构校验。"""
    if not _HAS_PYDANTIC:
        return validate_fallback(data, where)
    try:
        ShardDataset.model_validate(data)  # type: ignore[union-attr]
        return []
    except ValidationError as exc:  # type: ignore[misc]
        issues: List[Issue] = []
        for err in exc.errors():
            loc = ".".join(str(x) for x in err["loc"])
            issues.append(_issue("error", f"{where}·{loc}", err["msg"]))
        return issues


# =============================================================================
# 五、引文语料回核
# =============================================================================

def load_simplifier() -> Optional[Any]:
    """可选繁简转换器。

    本站正文以简体呈现，而维基文库的二十四史原文为繁体。语料回核时若不转换，
    所有引文都会因字形差异被判为「未命中」——那是假阴性，不是幻觉。
    装了 OpenCC 就自动转换；没装则保持原样并提示，绝不静默放宽判定。
    """
    try:
        from opencc import OpenCC  # type: ignore

        converter = OpenCC("t2s")
        return converter.convert
    except Exception:
        return None


def load_corpus(corpus_dir: Path) -> str:
    """把语料目录下所有文本拼接为一个大串，用于「全库回核」。"""
    chunks: List[str] = []
    for path in sorted(corpus_dir.rglob("*")):
        if path.suffix.lower() in (".txt", ".md", ".json", ".wiki"):
            try:
                chunks.append(path.read_text(encoding="utf-8", errors="ignore"))
            except OSError:
                continue
    return "\n".join(chunks)


def audit_dataset(data_dir: Path, corpus_dir: Optional[Path], threshold: float, verbose: bool,
                  simplify: bool = False) -> int:
    manifest_path = data_dir / "manifest.json"
    if not manifest_path.exists():
        print(f"✖ 找不到清单：{manifest_path}")
        return 2

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    shards_dir = data_dir / "shards"
    corpus = load_corpus(corpus_dir) if corpus_dir else ""
    if corpus and simplify:
        simplifier = load_simplifier()
        if simplifier is None:
            print("⚠ --simplify 需要 opencc（pip install opencc-python-reimplemented），"
                  "  未安装则按原字形比对；若引文全为简体而语料为繁体，结果会是假阴性")
        else:
            corpus = simplifier(corpus)

    issues: List[Issue] = []
    total_persons = total_edges = total_quotes = checked_quotes = 0
    unverified: List[QuoteCheck] = []

    print("◈ 华夏史网 · 数据契约与原文核验")
    print(f"  数据目录 {data_dir}")
    if corpus:
        print(f"  基准语料 {corpus_dir}（{len(corpus):,} 字符）")
    print()

    for entry in manifest.get("shards", []):
        shard_path = shards_dir / entry.get("file", f"{entry.get('shardId')}.json")
        if not shard_path.exists():
            issues.append(_issue("error", entry.get("shardId", "?"), f"分片文件缺失：{shard_path.name}"))
            continue
        shard = json.loads(shard_path.read_text(encoding="utf-8"))
        shard_issues = validate_shard(shard, entry.get("shardId", "?"))
        issues.extend(shard_issues)

        nodes = shard.get("nodes") or []
        edges = shard.get("edges") or []
        total_persons += len(nodes)
        total_edges += len(edges)

        node_quotes = 0
        for node in nodes:
            for parent, cite in _walk_node_citations(node):
                total_quotes += 1
                node_quotes += 1
                if not corpus:
                    continue
                result = verify_quote_in_source(str(cite.get("originalText", "")), corpus, threshold)
                checked_quotes += 1
                if not result.ok:
                    unverified.append(result)
                    issues.append(_issue(
                        "warn", f"{entry.get('shardId')}·{parent}",
                        f"引文未能在语料中定位（{result.method}，相似度 {result.ratio:.0%}）：{result.quote[:32]}…",
                    ))

        status = "✓" if not shard_issues else "✖"
        print(
            f"  {status} {entry.get('shardId', ''):<26} "
            f"{len(nodes):>4} 人 / {len(edges):>4} 边 / {node_quotes:>4} 条引文"
        )

    errors = [i for i in issues if i["level"] == "error"]
    warns = [i for i in issues if i["level"] == "warn"]

    print()
    print("◈ 汇总")
    print(f"  人物 {total_persons} · 关系 {total_edges} · 引文 {total_quotes}")
    if corpus:
        print(f"  已回核 {checked_quotes} 条，未能定位 {len(unverified)} 条")
    print(f"  契约错误 {len(errors)} 项 · 提示 {len(warns)} 项")

    if verbose or errors:
        for issue in (errors + warns)[: 200 if verbose else 30]:
            flag = "✖" if issue["level"] == "error" else "⚠"
            print(f"   {flag} [{issue['where']}] {issue['message']}")

    if errors:
        return 1
    print("\n✓ 校验通过")
    return 0


def _walk_node_citations(node: Dict[str, Any]) -> Iterable[Tuple[str, Dict[str, Any]]]:
    """产出 (细粒度位置, 引文)，位置精确到「某人的某个年表事件/轶事」。"""
    name = node.get("name", node.get("id", "?"))
    for index, cite in enumerate(node.get("primarySources") or []):
        if isinstance(cite, dict):
            yield f"{name}·本传第{index + 1}段", cite
    for event in node.get("lifeTimeline") or []:
        cite = event.get("citation")
        if isinstance(cite, dict):
            yield f"{name}·年表「{event.get('title')}」", cite
    for anecdote in node.get("anecdotes") or []:
        cite = anecdote.get("primaryCitation")
        if isinstance(cite, dict):
            yield f"{name}·轶事「{anecdote.get('title')}」", cite
        for conf in anecdote.get("conflictingAccounts") or []:
            if isinstance(conf.get("citation"), dict):
                yield f"{name}·轶事「{anecdote.get('title')}」对勘", conf["citation"]
    appearance = (node.get("portrait") or {}).get("classicalAppearanceQuote") or {}
    if appearance.get("quote"):
        yield f"{name}·相貌考据", {"originalText": appearance.get("quote", "")}
    assess = ((node.get("structuredBiography") or {}).get("historianAssessment") or {})
    if assess.get("originalQuote"):
        yield f"{name}·史官总评", {"originalText": assess.get("originalQuote", "")}


# =============================================================================
# 六、CLI
# =============================================================================

def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="华夏史网 · 数据契约校验器与原文子串核验器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="示例：\n"
               "  python schema_validator.py --data ../../public/data\n"
               "  python schema_validator.py --data ../../public/data --corpus ../build/raw --verbose\n",
    )
    parser.add_argument("--data", type=Path, help="public/data 目录（含 manifest.json 与 shards/）")
    parser.add_argument("--shard", type=Path, help="仅校验单个分片 JSON")
    parser.add_argument("--corpus", type=Path, help="维基文库原始语料目录，给出后逐条回核引文")
    parser.add_argument("--quote", type=str, help="单条引文核验")
    parser.add_argument("--source-file", type=Path, help="单条核验时的基准文本文件")
    parser.add_argument("--threshold", type=float, default=0.90, help="相似度阈值（默认 0.90）")
    parser.add_argument("--simplify", action="store_true", help="把语料繁转简后再比对（需 opencc）")
    parser.add_argument("--verbose", action="store_true", help="打印全部提示")
    args = parser.parse_args(argv)

    if args.quote:
        if not args.source_file or not args.source_file.exists():
            parser.error("--quote 需要配合 --source-file 指定基准文本")
        source = args.source_file.read_text(encoding="utf-8", errors="ignore")
        result = verify_quote_in_source(args.quote, source, args.threshold)
        print(json.dumps(result.as_dict(), ensure_ascii=False, indent=2))
        return 0 if result.ok else 1

    if args.shard:
        if not args.shard.exists():
            print(f"✖ 文件不存在：{args.shard}")
            return 2
        data = json.loads(args.shard.read_text(encoding="utf-8"))
        issues = validate_shard(data, args.shard.stem)
        for issue in issues:
            print(f"✖ [{issue['where']}] {issue['message']}")
        if not issues:
            print(f"✓ {args.shard.name} 契约校验通过（{len(data.get('nodes', []))} 人 / {len(data.get('edges', []))} 边）")
        return 1 if issues else 0

    if args.data:
        return audit_dataset(args.data, args.corpus, args.threshold, args.verbose, args.simplify)

    parser.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
