#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
大模型结构化抽取器（生平年表 / 相貌考据 / 奇闻轶事 / 互见史料）
================================================================================

本脚本把维基文库的列传原文，转成本项目强类型的 ``HistoricalPersonNode``。
与一般「让模型写点人物介绍」的做法根本不同之处在于：**模型只是候选生成器，
真正的裁判是原文比对器**。任何引文若不能在原传正文中定位，一律打回。

反幻觉闭环（本文件的核心）
--------------------------------------------------------------------------------
    原文 ──► LLM 结构化抽取 ──► 逐条 verify_quote_in_source ──┐
              ▲                                              │
              │        未通过：附「最相似片段」+ 纠错指令       │
              └──────────────────────────────────────────────┘
                                    最多 max_retries 轮
                                             │
                                    仍未通过 ──► 落入 build/review/ 待人工复核
                                                （绝不写入分片）

打回时给出的不是空泛的「请重新生成」，而是把**模型自己编的句子**与**原文中
最接近的真实片段**并排放回去，让其照抄真实片段。这一条能把大部分引文幻觉
在第一轮就纠正掉。

用法
--------------------------------------------------------------------------------
    # 自检：不联网、不调模型，验证「伪造引文必被拒」这条防线确实生效
    python llm_extractor.py --self-test

    # 只看会发给模型的提示词（不调用 API，不产生任何数据）
    python llm_extractor.py --input ../build/raw/24histories/sanguozhi --dry-run

    # 正式抽取（需 pydantic + OPENAI_API_KEY 或 ANTHROPIC_API_KEY）
    python llm_extractor.py --input ../build/raw/24histories/sanguozhi \\
        --book 三國志 --out ../build/extracted --jobs 4
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))

from schema_validator import (  # noqa: E402
    ANECDOTE_CATEGORIES,
    SOURCE_RELIABILITY,
    verify_quote_in_source,
)

try:
    from pydantic import BaseModel, ConfigDict, Field
    _HAS_PYDANTIC = True
except Exception:  # pragma: no cover
    _HAS_PYDANTIC = False
    BaseModel = object  # type: ignore
    ConfigDict = dict  # type: ignore
    Field = lambda *a, **k: None  # type: ignore


DEFAULT_SOURCE_CHAR_LIMIT = 24000
DEFAULT_THRESHOLD = 0.90


# =============================================================================
# 一、LLM 输出契约（Pydantic → JSON Schema，交给 Structured Outputs）
# =============================================================================

if _HAS_PYDANTIC:

    class _M(BaseModel):
        model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    class CitationDraft(_M):
        bookTitle: str = Field(description="史书名，如「《三國志》」")
        volumeAndChapter: str = Field(description="卷次篇名，如「卷三十五·蜀書·諸葛亮傳」")
        authorOrCommentator: Optional[str] = Field(default=None, description="撰者或注者，如「陳壽 撰 / 裴松之 注」")
        originalText: str = Field(
            description="文言原文。**必须逐字摘自输入正文的连续片段**，不得改写、拼接、省略或臆造。"
        )
        modernTranslation: str = Field(description="准确的白话译文")
        reliability: str = Field(description=f"史源分级，取值之一：{', '.join(SOURCE_RELIABILITY)}")
        historiographicalNote: Optional[str] = Field(default=None, description="史学按语、考异或真伪辨析")

    class LifeEventDraft(_M):
        year: int = Field(description="公元纪年，公元前用负数，如 -206")
        eraNameYear: Optional[str] = Field(default=None, description="年号纪年，如「建安十三年」")
        age: Optional[int] = Field(default=None, description="当时年龄，据生年推算")
        title: str = Field(description="事件名，2~8 字")
        description: str = Field(description="事件经过，须紧扣原文，不得添加原文没有的情节")
        locationAncient: Optional[str] = Field(default=None, description="古地名")
        locationModern: Optional[str] = Field(default=None, description="今地名")
        locationLng: Optional[float] = Field(default=None, description="经度")
        locationLat: Optional[float] = Field(default=None, description="纬度")
        citation: Optional[CitationDraft] = Field(default=None, description="该事件的原文依据")
        participatingNames: Optional[List[str]] = Field(default=None, description="共同参与者的姓名")

    class AnecdoteDraft(_M):
        title: str = Field(description="轶事标题，4~8 字")
        idiomOrAllusion: Optional[str] = Field(default=None, description="由此事衍生的成语典故")
        category: str = Field(description=f"轶事分类，取值之一：{', '.join(ANECDOTE_CATEGORIES)}")
        narrativeSummary: str = Field(description="白话叙述，只讲原文有的事")
        relatedNames: Optional[List[str]] = Field(default=None, description="涉及的其他人姓名")
        primaryCitation: CitationDraft = Field(description="核心史料出处")
        conflictingAccounts: Optional[List[Dict[str, str]]] = Field(
            default=None,
            description="史书记载矛盾时的对勘条目；每条含 sourceName、stanceOrBias、citationId 三个字符串",
        )

    class AppearanceDraft(_M):
        quote: str = Field(description="史书关于外貌身高的原文，必须是正文连续片段")
        bookSource: str = Field(description="出处，如「《三國志·蜀書·諸葛亮傳》」")
        translation: str = Field(description="白话解释")

    class AssessmentDraft(_M):
        commentator: str = Field(description="史官署名，如「陳壽《三國志》評曰」")
        originalQuote: str = Field(description="史官总评原话，必须是正文连续片段")
        translation: str = Field(description="白话译文")

    class BiographyDraft(_M):
        earlyLife: str = Field(description="早年经历与家世")
        majorAchievements: str = Field(description="核心功业与重大决策")
        turningPointsAndEnd: str = Field(description="人生转折与结局")
        historianAssessment: AssessmentDraft

    class PersonExtraction(_M):
        name: str = Field(description="人物主名，与原文一致（繁体）")
        courtesyName: Optional[str] = Field(default=None, description="字")
        pseudonyms: Optional[List[str]] = Field(default=None, description="号、小字、别称")
        posthumousTitle: Optional[str] = Field(default=None, description="谥号")
        templeName: Optional[str] = Field(default=None, description="庙号")
        feudalTitles: Optional[List[str]] = Field(default=None, description="封爵与史书常见称谓")
        gender: str = Field(description="male / female / eunuch")
        factionOrClan: Optional[str] = Field(default=None, description="所属政治集团或门阀世家")
        birthYear: Optional[int] = Field(default=None, description="生年。史载不详则留空，**严禁估算后冒充确数**")
        deathYear: Optional[int] = Field(default=None, description="卒年。史载不详则留空")
        birthYearUncertain: Optional[bool] = Field(default=None, description="生年是否史载不详")
        birthplaceAncient: Optional[str] = Field(default=None, description="籍贯古名")
        birthplaceModern: Optional[str] = Field(default=None, description="籍贯今地")
        birthplaceLng: Optional[float] = Field(default=None, description="籍贯经度")
        birthplaceLat: Optional[float] = Field(default=None, description="籍贯纬度")
        roles: List[str] = Field(description="身份标签，2~4 个")
        officialTitles: List[str] = Field(description="历任核心官职")
        oneLineSummary: str = Field(description="50 字以内史学定评")
        structuredBiography: BiographyDraft
        lifeTimeline: List[LifeEventDraft] = Field(description="生平大事年表，至少 3 条")
        anecdotes: List[AnecdoteDraft] = Field(description="奇闻轶事，至少 1 则")
        primarySources: List[CitationDraft] = Field(description="本传核心文白对照段落，至少 2 段")
        classicalAppearanceQuote: Optional[AppearanceDraft] = Field(default=None, description="相貌考据")
        importanceWeightHint: Optional[int] = Field(default=None, description="历史影响主观估计 1~100")

    EXTRACTION_SCHEMA: Optional[Dict[str, Any]] = PersonExtraction.model_json_schema()

else:  # pragma: no cover
    PersonExtraction = None  # type: ignore
    EXTRACTION_SCHEMA = None


# =============================================================================
# 二、提示词
# =============================================================================

SYSTEM_PROMPT = """你是「华夏史网」的史学数据工程师，专精二十四史文本的考据级结构化整理。

你的输出将被直接写入一个面向公众的历史知识图谱。任何一处编造都会造成史实污染，
因此你必须无条件遵守以下铁律：

【一】引文铁律
所有 `originalText`、`historianAssessment.originalQuote`、`classicalAppearanceQuote.quote`
必须是输入正文中**逐字连续存在**的片段。具体要求：
  · 不得改写、节译、拼接、补字、改字，不得把白话译文塞进原文栏；
  · 允许从长句中截取一段，但截取的这段必须以原样出现在正文中；
  · 若正文中没有可直接引用的句子，宁可不给这一条，也不要自己造一句；
  · 文言原文保留繁体与原有异体字，不要转成简体。

【二】事实铁律
  · 生卒年、年龄、地名只写正文明确记载的；推断值一律留空（null），不要「约」「大概」地填一个数；
  · 时间线事件必须有正文支撑；推算年份时以年号纪年为准，并保持内部一致；
  · 人物关系、事件因果不得超出正文所述范围，不得引入《三国演义》等演义小说情节；
  · 若正文记载与其他史书冲突，放入 `conflictingAccounts` 做对勘，而不是二选一。

【三】分级铁律
`reliability` 必须如实标注：
  · official_history_primary   —— 本传／本纪／世家正文
  · official_history_hujian    —— 他传中「互见」记载（如《项羽本纪》中记刘邦事）
  · authoritative_commentary   —— 裴松之注、颜师古注、司马贞索隐等注疏
  · chronicle_corroboration    —— 《资治通鉴》《通典》等编年体与政书佐证
  · literary_anecdotal         —— 《世说新语》等笔记小说与野史
注疏与笔记内容不得标为本传正文。

【四】文体要求
  · `modernTranslation` 用规范现代汉语，准确通顺，不加评论；
  · `oneLineSummary` 是史学定评，不是小说简介，控制在 50 字内；
  · `narrativeSummary` 只叙述原文所述之事；原文没写的心理活动、对白、场景一概不写。

输出必须是符合给定 JSON Schema 的单个 JSON 对象，不要输出任何解释性文字。"""


def build_user_prompt(
    source_text: str,
    person: str,
    book: str,
    volume: str,
    dynasty_hint: str = "",
) -> str:
    """构造首轮用户提示词。"""
    truncated = source_text[:DEFAULT_SOURCE_CHAR_LIMIT]
    clipped_note = (
        f"\n（正文较长，已截取前 {DEFAULT_SOURCE_CHAR_LIMIT} 字；若某条引文不在截取范围内，请勿引用。）"
        if len(source_text) > DEFAULT_SOURCE_CHAR_LIMIT
        else ""
    )
    return f"""请从下列正史正文中抽取「{person}」的考据级结构化资料。

史书：{book}
卷次：{volume}
{f'朝代提示：{dynasty_hint}' if dynasty_hint else ''}
{clipped_note}

再次强调：所有引文必须是下面正文里逐字连续的片段。正文之外的知识一律不得写入。

===== 正文开始 =====
{truncated}
===== 正文结束 =====
"""


def build_correction_prompt(failures: Sequence[Dict[str, Any]]) -> str:
    """构造打回重抽的纠错提示：并排给出「你编的句子」与「原文最接近的片段」。"""
    lines = [
        "上一次输出中有以下引文无法在正文中定位，已判定为**非原文**：",
        "",
    ]
    for index, item in enumerate(failures, 1):
        lines.append(f"{index}. 位置：{item['where']}")
        lines.append(f"   你写的：{item['quote']}")
        if item.get("closest"):
            lines.append(f"   原文最近：{item['closest']}")
        lines.append(f"   相似度：{item['ratio']:.0%}")
        lines.append("")
    lines += [
        "请逐条修正：",
        "  · 若原文确有相近表述，请**照抄**原文该句（保持繁体与原字）；",
        "  · 若原文根本没有这句话，请删除该条引文及其依赖的内容；",
        "  · 不得为了凑满条目而保留任何自造文句；",
        "  · 其余字段若因此失效，请一并修正以保持内部一致。",
        "",
        "请重新输出完整的 JSON 对象（结构不变）。",
    ]
    return "\n".join(lines)


# =============================================================================
# 三、模型提供方
# =============================================================================

class ProviderError(RuntimeError):
    """模型调用失败。"""


@dataclass
class ProviderConfig:
    name: str = "openai"          # openai | anthropic
    model: str = ""
    api_key: str = ""
    base_url: str = ""
    temperature: float = 0.2
    timeout: int = 180

    def resolved_model(self) -> str:
        if self.model:
            return self.model
        if self.name == "anthropic":
            return os.environ.get("CHRONO_LLM_MODEL", "claude-sonnet-4-20250514")
        return os.environ.get("CHRONO_LLM_MODEL", "gpt-4o-2024-08-06")

    def resolved_key(self) -> str:
        if self.api_key:
            return self.api_key
        env = "ANTHROPIC_API_KEY" if self.name == "anthropic" else "OPENAI_API_KEY"
        return os.environ.get(env, "")

    def resolved_base(self) -> str:
        if self.base_url:
            return self.base_url.rstrip("/")
        if self.name == "anthropic":
            return os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com").rstrip("/")
        return os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")


def _post_json(url: str, payload: Dict[str, Any], headers: Dict[str, str], timeout: int, retries: int = 4) -> Dict[str, Any]:
    """带指数退避的 JSON POST。429/5xx 重试，4xx 立即失败。"""
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    last: Optional[Exception] = None
    for attempt in range(retries):
        request = urllib.request.Request(url, data=body, headers={**headers, "Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")[:400]
            last = ProviderError(f"HTTP {exc.code}：{detail}")
            if exc.code < 500 and exc.code != 429:
                raise last from exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last = ProviderError(str(exc))
        time.sleep(min(30.0, (2 ** attempt) + random.random()))
    raise ProviderError(f"模型调用重试 {retries} 次仍失败：{last}")


class OpenAIProvider:
    """OpenAI Chat Completions（兼容 Azure / DeepSeek / vLLM 等 OpenAI 协议端点）。"""

    def __init__(self, config: ProviderConfig):
        if EXTRACTION_SCHEMA is None:
            raise ProviderError("缺少 pydantic，无法生成 JSON Schema；请先 pip install pydantic")
        self.config = config

    def complete(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        key = self.config.resolved_key()
        if not key:
            raise ProviderError("未设置 OPENAI_API_KEY")
        payload = {
            "model": self.config.resolved_model(),
            "messages": messages,
            "temperature": self.config.temperature,
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "person_extraction", "strict": True, "schema": EXTRACTION_SCHEMA},
            },
        }
        data = _post_json(
            f"{self.config.resolved_base()}/chat/completions",
            payload,
            {"Authorization": f"Bearer {key}"},
            self.config.timeout,
        )
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            raise ProviderError(f"响应格式异常：{str(data)[:300]}") from exc
        return json.loads(content)


class AnthropicProvider:
    """Anthropic Messages API：用强制 tool_use 达到等价的结构化输出。"""

    def __init__(self, config: ProviderConfig):
        if EXTRACTION_SCHEMA is None:
            raise ProviderError("缺少 pydantic，无法生成 JSON Schema；请先 pip install pydantic")
        self.config = config

    def complete(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        key = self.config.resolved_key()
        if not key:
            raise ProviderError("未设置 ANTHROPIC_API_KEY")
        system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
        turns = [m for m in messages if m["role"] != "system"]
        payload = {
            "model": self.config.resolved_model(),
            "max_tokens": 8192,
            "temperature": self.config.temperature,
            "system": system,
            "messages": turns,
            "tools": [{
                "name": "emit_person_extraction",
                "description": "输出这个人物的考据级结构化资料",
                "input_schema": EXTRACTION_SCHEMA,
            }],
            "tool_choice": {"type": "tool", "name": "emit_person_extraction"},
        }
        data = _post_json(
            f"{self.config.resolved_base()}/v1/messages",
            payload,
            {"x-api-key": key, "anthropic-version": "2023-06-01"},
            self.config.timeout,
        )
        for block in data.get("content", []):
            if block.get("type") == "tool_use":
                return block.get("input", {})
        raise ProviderError(f"响应中没有 tool_use 块：{str(data)[:300]}")


def make_provider(config: ProviderConfig) -> Any:
    if config.name == "anthropic":
        return AnthropicProvider(config)
    return OpenAIProvider(config)


# =============================================================================
# 四、引文收集与核验
# =============================================================================

def collect_quotes(payload: Dict[str, Any]) -> List[Tuple[str, str]]:
    """从抽取结果中收集全部待核验引文，返回 [(位置, 引文)]。"""
    quotes: List[Tuple[str, str]] = []

    for index, citation in enumerate(payload.get("primarySources") or [], 1):
        if isinstance(citation, dict) and citation.get("originalText"):
            quotes.append((f"本传第 {index} 段", citation["originalText"]))

    for event in payload.get("lifeTimeline") or []:
        citation = event.get("citation") if isinstance(event, dict) else None
        if isinstance(citation, dict) and citation.get("originalText"):
            quotes.append((f"年表「{event.get('title', '?')}」", citation["originalText"]))

    for anecdote in payload.get("anecdotes") or []:
        if not isinstance(anecdote, dict):
            continue
        citation = anecdote.get("primaryCitation")
        if isinstance(citation, dict) and citation.get("originalText"):
            quotes.append((f"轶事「{anecdote.get('title', '?')}」", citation["originalText"]))
        for conf in anecdote.get("conflictingAccounts") or []:
            if isinstance(conf, dict) and conf.get("originalText"):
                quotes.append((f"轶事「{anecdote.get('title', '?')}」对勘", conf["originalText"]))

    assessment = (payload.get("structuredBiography") or {}).get("historianAssessment") or {}
    if assessment.get("originalQuote"):
        quotes.append(("史官总评", assessment["originalQuote"]))

    appearance = payload.get("classicalAppearanceQuote") or {}
    if appearance.get("quote"):
        quotes.append(("相貌考据", appearance["quote"]))

    return quotes


@dataclass
class VerificationReport:
    total: int = 0
    passed: int = 0
    failures: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def pass_rate(self) -> float:
        return self.passed / self.total if self.total else 1.0

    @property
    def ok(self) -> bool:
        return not self.failures

    def as_dict(self) -> Dict[str, Any]:
        return {
            "total": self.total,
            "passed": self.passed,
            "failed": len(self.failures),
            "passRate": round(self.pass_rate, 4),
            "failures": self.failures,
        }


def verify_payload(payload: Dict[str, Any], source_text: str, threshold: float) -> VerificationReport:
    """逐条核验抽取结果中的引文。"""
    report = VerificationReport()
    for where, quote in collect_quotes(payload):
        report.total += 1
        result = verify_quote_in_source(quote, source_text, threshold)
        if result.ok:
            report.passed += 1
        else:
            report.failures.append({
                "where": where,
                "quote": quote[:160],
                "closest": (result.matched or "")[:160],
                "ratio": round(result.ratio, 4),
                "method": result.method,
            })
    return report


def sanitize_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """把不可靠的枚举值纠正到合法范围，避免下游 Pydantic 直接拒绝整份输出。

    注意：这里只纠正「枚举拼写」与「数值越界」这类机械问题，
    绝不改写任何史实内容。史实问题只能靠 verify_payload 打回。
    """
    def fix_category(value: Any) -> str:
        text = str(value or "")
        return text if text in ANECDOTE_CATEGORIES else "historical_mystery"

    def fix_reliability(value: Any) -> str:
        text = str(value or "")
        return text if text in SOURCE_RELIABILITY else "official_history_primary"

    for citation in payload.get("primarySources") or []:
        if isinstance(citation, dict):
            citation["reliability"] = fix_reliability(citation.get("reliability"))

    for event in payload.get("lifeTimeline") or []:
        citation = event.get("citation") if isinstance(event, dict) else None
        if isinstance(citation, dict):
            citation["reliability"] = fix_reliability(citation.get("reliability"))

    for anecdote in payload.get("anecdotes") or []:
        if not isinstance(anecdote, dict):
            continue
        anecdote["category"] = fix_category(anecdote.get("category"))
        citation = anecdote.get("primaryCitation")
        if isinstance(citation, dict):
            citation["reliability"] = fix_reliability(citation.get("reliability"))

    return payload


# =============================================================================
# 五、抽取主循环
# =============================================================================

@dataclass
class ExtractionResult:
    person_name: str
    book: str
    volume: str
    payload: Optional[Dict[str, Any]]
    verification: VerificationReport
    attempts: int
    needs_review: bool
    error: Optional[str] = None

    def as_dict(self) -> Dict[str, Any]:
        return {
            "person": self.payload,
            "verification": self.verification.as_dict(),
            "attempts": self.attempts,
            "needsReview": self.needs_review,
            "error": self.error,
        }


def extract_one(
    complete: Callable[[List[Dict[str, str]]], Dict[str, Any]],
    person: str,
    volume: str,
    book: str,
    source_text: str,
    threshold: float = DEFAULT_THRESHOLD,
    max_retries: int = 2,
    dynasty_hint: str = "",
    verbose: bool = True,
) -> ExtractionResult:
    """抽取单个人物，并在引文核验失败时打回重抽。"""
    messages: List[Dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_user_prompt(source_text, person, book, volume, dynasty_hint)},
    ]

    last_report = VerificationReport()
    last_payload: Optional[Dict[str, Any]] = None
    attempts = 0

    for attempt in range(max_retries + 1):
        attempts = attempt + 1
        try:
            payload = complete(messages)
        except ProviderError as exc:
            return ExtractionResult(person, book, volume, None, last_report, attempts, True, str(exc))

        payload = sanitize_payload(payload)
        report = verify_payload(payload, source_text, threshold)
        last_payload, last_report = payload, report

        if verbose:
            print(f"    · 第 {attempts} 轮：引文 {report.passed}/{report.total} 通过")

        if report.ok:
            return ExtractionResult(person, book, volume, payload, report, attempts, False)

        if attempt < max_retries:
            messages.append({"role": "assistant", "content": json.dumps(payload, ensure_ascii=False)[:20000]})
            messages.append({"role": "user", "content": build_correction_prompt(report.failures)})

    return ExtractionResult(person, book, volume, last_payload, last_report, attempts, True)


# =============================================================================
# 六、草稿 → 前端节点
# =============================================================================

def to_person_node(
    payload: Dict[str, Any],
    person_id: str,
    dynasty: str,
    book_title: str,
    portrait_tier: str = "tier3_ai_reconstructed",
) -> Dict[str, Any]:
    """把 LLM 草稿转成符合 `HistoricalPersonNode` 契约的节点。

    这里只做**结构搬运**与必要兜底（缺省字段、id 生成、坐标校验），
    不改写任何史实文字。importanceWeight 先给占位值，由 build_shards 依
    PageRank 重算并覆盖。
    """
    def cite(citation: Optional[Dict[str, Any]], default_chapter: str) -> Optional[Dict[str, Any]]:
        if not isinstance(citation, dict) or not citation.get("originalText"):
            return None
        return {
            "id": f"cite_{_hash_id(person_id + citation.get('originalText', ''))}",
            "bookTitle": citation.get("bookTitle") or f"《{book_title}》",
            "volumeAndChapter": citation.get("volumeAndChapter") or default_chapter,
            "authorOrCommentator": citation.get("authorOrCommentator"),
            "originalText": citation["originalText"],
            "modernTranslation": citation.get("modernTranslation") or "",
            "reliability": citation.get("reliability") or "official_history_primary",
            "historiographicalNote": citation.get("historiographicalNote"),
        }

    aliases: Dict[str, Any] = {}
    if payload.get("courtesyName"):
        aliases["courtesyName"] = payload["courtesyName"]
    if payload.get("pseudonyms"):
        aliases["pseudonyms"] = payload["pseudonyms"]
    if payload.get("posthumousTitle"):
        aliases["posthumousTitle"] = payload["posthumousTitle"]
    if payload.get("templeName"):
        aliases["templeName"] = payload["templeName"]
    if payload.get("feudalTitles"):
        aliases["feudalTitles"] = payload["feudalTitles"]

    timeline: List[Dict[str, Any]] = []
    for index, event in enumerate(payload.get("lifeTimeline") or [], 1):
        if not isinstance(event, dict) or not isinstance(event.get("year"), int):
            continue
        item: Dict[str, Any] = {
            "id": f"{person_id}_evt_{index}",
            "year": event["year"],
            "title": event.get("title") or "",
            "description": event.get("description") or "",
        }
        if event.get("eraNameYear"):
            item["eraNameYear"] = event["eraNameYear"]
        if isinstance(event.get("age"), int):
            item["age"] = event["age"]
        lng, lat = event.get("locationLng"), event.get("locationLat")
        if isinstance(lng, float) and isinstance(lat, float) and -180 <= lng <= 180 and -90 <= lat <= 90:
            item["location"] = {
                "ancientName": event.get("locationAncient") or "",
                "modernName": event.get("locationModern") or "",
                "coordinates": [lng, lat],
            }
        citation = cite(event.get("citation"), "")
        if citation:
            item["citation"] = citation
        timeline.append(item)

    anecdotes: List[Dict[str, Any]] = []
    for index, anecdote in enumerate(payload.get("anecdotes") or [], 1):
        if not isinstance(anecdote, dict):
            continue
        primary = cite(anecdote.get("primaryCitation"), "")
        if not primary:
            continue  # 无原文依据的轶事一律丢弃，这是零幻觉的硬线
        anecdotes.append({
            "id": f"{person_id}_anec_{index}",
            "title": anecdote.get("title") or "",
            "idiomOrAllusion": anecdote.get("idiomOrAllusion"),
            "category": anecdote.get("category") or "historical_mystery",
            "narrativeSummary": anecdote.get("narrativeSummary") or "",
            "relatedPersonIds": [],
            "primaryCitation": primary,
        })

    sources = [c for c in (cite(s, "") for s in payload.get("primarySources") or []) if c]
    assessment = (payload.get("structuredBiography") or {}).get("historianAssessment") or {}
    appearance = payload.get("classicalAppearanceQuote") or {}

    birthplace = None
    lng, lat = payload.get("birthplaceLng"), payload.get("birthplaceLat")
    if isinstance(lng, float) and isinstance(lat, float) and -180 <= lng <= 180 and -90 <= lat <= 90:
        birthplace = {
            "ancientName": payload.get("birthplaceAncient") or "",
            "modernName": payload.get("birthplaceModern") or "",
            "coordinates": [lng, lat],
        }

    node: Dict[str, Any] = {
        "id": person_id,
        "name": payload.get("name") or "",
        "aliases": aliases,
        "gender": payload.get("gender") if payload.get("gender") in ("male", "female", "eunuch") else "male",
        "dynasty": dynasty,
        "roles": payload.get("roles") or ["历史人物"],
        "officialTitles": payload.get("officialTitles") or [],
        "importanceWeight": max(1, min(100, int(payload.get("importanceWeightHint") or 40))),
        "portrait": {
            "thumbnailUrl": "",
            "fullSizeUrl": "",
            "tier": portrait_tier,
            "sourceAttribution": f"华夏史网依《{book_title}》本传所载形貌与冠服制度复原（非传世真迹）",
            **({"classicalAppearanceQuote": {
                "quote": appearance["quote"],
                "bookSource": appearance.get("bookSource") or f"《{book_title}》",
                "translation": appearance.get("translation") or "",
            }} if appearance.get("quote") else {}),
            "aiReconstructionPrompt": "",
        },
        "oneLineSummary": payload.get("oneLineSummary") or "",
        "structuredBiography": {
            "earlyLife": (payload.get("structuredBiography") or {}).get("earlyLife") or "",
            "majorAchievements": (payload.get("structuredBiography") or {}).get("majorAchievements") or "",
            "turningPointsAndEnd": (payload.get("structuredBiography") or {}).get("turningPointsAndEnd") or "",
            "historianAssessment": {
                "commentator": assessment.get("commentator") or "",
                "originalQuote": assessment.get("originalQuote") or "",
                "translation": assessment.get("translation") or "",
            },
        },
        "lifeTimeline": timeline,
        "anecdotes": anecdotes,
        "primarySources": sources,
    }

    for key, value in (
        ("birthYear", payload.get("birthYear")),
        ("deathYear", payload.get("deathYear")),
    ):
        if isinstance(value, int) and -1100 <= value <= 1950:
            node[key] = value
    if payload.get("birthYearUncertain"):
        node["birthYearUncertain"] = True
    if payload.get("factionOrClan"):
        node["factionOrClan"] = payload["factionOrClan"]
    if birthplace and birthplace["ancientName"]:
        node["birthplace"] = birthplace
    return node


def _hash_id(text: str) -> str:
    import hashlib
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]


# =============================================================================
# 七、文件扫描与批处理
# =============================================================================

def iter_source_files(input_dir: Path, limit: int = 0) -> List[Path]:
    files = sorted(p for p in input_dir.rglob("*.md") if not p.name.startswith("_"))
    return files[:limit] if limit else files


def guess_person_name(path: Path, markdown: str) -> str:
    """优先用篇名（`## 諸葛亮傳`）推断人物名；退而用文件名。"""
    match = re.search(r"^##\s+(.+?)\s*$", markdown, re.M)
    if match:
        heading = match.group(1)
        heading = re.sub(r"(列傳|列传|本紀|本纪|世家|傳|传)$", "", heading).strip()
        if heading:
            return heading
    return path.stem


def resolve_dynasty(book_title: str, explicit: Optional[str]) -> str:
    if explicit:
        return explicit
    try:
        from wikisource_24histories import BOOK_BY_TITLE
        book = BOOK_BY_TITLE.get(book_title.strip("《》"))
        if book:
            return book.dynasty
    except ImportError:
        pass
    return "three_kingdoms"


# =============================================================================
# 八、自检：证明「伪造引文必被拒」这条防线真的生效
# =============================================================================

def self_test(threshold: float = DEFAULT_THRESHOLD) -> int:
    """用受控的假模型输出验证核验闭环（不联网、不产生任何史实数据）。"""
    print("◈ 反幻觉闭环自检（不调用任何模型 API）\n")

    source = (
        "諸葛亮字孔明，琅邪陽都人也。漢司隸校尉諸葛豐後也。父珪，字君貢，漢末為太山郡丞。"
        "亮早孤，從父玄為袁術所署豫章太守，玄將亮及亮弟均之官。玄卒，亮躬耕隴畝，好為梁父吟。"
        "身長八尺，每自比於管仲、樂毅，時人莫之許也。"
    )

    cases = [
        ("逐字引用（应通过）", "諸葛亮字孔明，琅邪陽都人也", True),
        ("跨断句引用（应通过）", "亮躬耕隴畝，好為梁父吟", True),
        ("插入注疏后引用（应通过）", "身長八尺，每自比於管仲、樂毅", True),
        ("改写史实（应拒绝）", "諸葛亮字孔明，琅邪陽都人也，少有大志", False),
        ("演义情节（应拒绝）", "亮設空城計，焚香操琴，司馬懿疑而退兵", False),
    ]

    failures = 0
    for label, quote, expect_ok in cases:
        result = verify_quote_in_source(quote, source, threshold)
        verdict = "通过" if result.ok else "拒绝"
        mark = "✓" if result.ok == expect_ok else "✖"
        if result.ok != expect_ok:
            failures += 1
        print(f"  {mark} {label:<18} 判定 {verdict:<4} 方式 {result.method:<10} 相似度 {result.ratio:.0%}")

    # 再模拟一次「打回重抽」：首轮含伪造句，纠错后应转正
    bad_payload = {
        "primarySources": [{
            "bookTitle": "《三國志》",
            "volumeAndChapter": "卷三十五·蜀書·諸葛亮傳",
            "originalText": "諸葛亮字孔明，琅邪陽都人也，少有逸群之才",
            "modernTranslation": "诸葛亮字孔明，琅琊阳都人，少年时就有超群的才能。",
            "reliability": "official_history_primary",
        }],
        "lifeTimeline": [],
        "anecdotes": [],
        "structuredBiography": {"historianAssessment": {}},
    }
    good_payload = json.loads(json.dumps(bad_payload))
    good_payload["primarySources"][0]["originalText"] = "諸葛亮字孔明，琅邪陽都人也"

    bad_report = verify_payload(bad_payload, source, threshold)
    good_report = verify_payload(good_payload, source, threshold)

    print()
    print(f"  伪造引文核验：{bad_report.passed}/{bad_report.total} 通过 → "
          f"{'应打回' if not bad_report.ok else '未拦住（异常）'}")
    print(f"  纠错后核验：  {good_report.passed}/{good_report.total} 通过 → "
          f"{'放行' if good_report.ok else '仍打回（异常）'}")

    if bad_report.ok or not good_report.ok:
        failures += 1

    # 纠错提示词必须真的把「模型原句」与「原文最近片段」都摆出来
    prompt = build_correction_prompt(bad_report.failures)
    has_quote = "少有逸群之才" in prompt
    has_closest = "諸葛亮字孔明" in prompt
    print(f"  纠错提示含模型原句：{'✓' if has_quote else '✖'}")
    print(f"  纠错提示含原文片段：{'✓' if has_closest else '✖'}")
    if not (has_quote and has_closest):
        failures += 1

    print()
    if failures:
        print(f"✖ 自检失败 {failures} 项，反幻觉闭环存在缺陷")
        return 1
    print("✓ 自检通过：核验闭环按预期拒绝伪引文、放行真引文")
    return 0


# =============================================================================
# 九、CLI
# =============================================================================

def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="大模型结构化抽取器（带引文反幻觉核验）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--input", type=Path, help="维基文库 Markdown 目录")
    parser.add_argument("--book", default="三國志", help="史书名（用于引文出处与朝代推断）")
    parser.add_argument("--dynasty", help="强制指定 DynastyId（默认由 --book 推断）")
    parser.add_argument("--out", type=Path, default=Path("../build/extracted"), help="输出目录")
    parser.add_argument("--review", type=Path, default=Path("../build/review"), help="待人工复核目录")
    parser.add_argument("--provider", default="openai", choices=["openai", "anthropic"], help="模型提供方")
    parser.add_argument("--model", default="", help="模型名（默认取 CHRONO_LLM_MODEL 或提供方默认）")
    parser.add_argument("--base-url", default="", help="API 基址（兼容自建/代理端点）")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD, help="引文相似度阈值")
    parser.add_argument("--max-retries", type=int, default=2, help="引文不合格时的打回重抽轮数")
    parser.add_argument("--jobs", type=int, default=1, help="并发线程数")
    parser.add_argument("--limit", type=int, default=0, help="最多处理多少篇")
    parser.add_argument("--dry-run", action="store_true", help="只生成提示词，不调用模型")
    parser.add_argument("--self-test", action="store_true", help="运行反幻觉闭环自检")
    parser.add_argument("--accept-unverified", action="store_true",
                        help="即使引文有未通过项也写入 out（默认只写入 review）")
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test(args.threshold)

    if not args.input:
        parser.error("需要 --input 指定维基文库 Markdown 目录（或用 --self-test）")
    if not args.input.exists():
        print(f"✖ 输入目录不存在：{args.input}")
        return 2

    files = iter_source_files(args.input, args.limit)
    if not files:
        print(f"✖ {args.input} 下没有 .md 文件")
        return 2

    dynasty = resolve_dynasty(args.book, args.dynasty)

    if args.dry_run:
        prompt_dir = args.out / "_prompts"
        prompt_dir.mkdir(parents=True, exist_ok=True)
        print(f"◈ 生成提示词（{len(files)} 篇，不调用模型）")
        for path in files:
            markdown = path.read_text(encoding="utf-8")
            person = guess_person_name(path, markdown)
            text = build_user_prompt(markdown, person, f"《{args.book}》", path.stem, dynasty)
            target = prompt_dir / f"{path.stem}.txt"
            target.write_text(SYSTEM_PROMPT + "\n\n" + "=" * 60 + "\n\n" + text, encoding="utf-8")
            print(f"  · {target.name}  {len(text):>7,} 字符")
        print(f"\n  提示词已写入 {prompt_dir.resolve()}")
        print("  提示：确认提示词无误后，去掉 --dry-run 并提供 API Key 即可正式抽取")
        return 0

    if not _HAS_PYDANTIC:
        print("✖ 正式抽取需要 pydantic（用于生成 JSON Schema 与校验模型输出）")
        print("   pip install pydantic")
        print("   若只想看提示词，可加 --dry-run；若想验证反幻觉防线，可加 --self-test")
        return 2

    config = ProviderConfig(name=args.provider, model=args.model, base_url=args.base_url)
    if not config.resolved_key():
        env = "ANTHROPIC_API_KEY" if args.provider == "anthropic" else "OPENAI_API_KEY"
        print(f"✖ 未设置 {env}，无法调用模型")
        return 2
    provider = make_provider(config)

    print("◈ 结构化抽取")
    print(f"  模型 {config.resolved_model()} · 阈值 {args.threshold:.0%} · 打回 {args.max_retries} 轮 · 并发 {args.jobs}")
    print(f"  输入 {args.input.resolve()}")
    print(f"  输出 {args.out.resolve()}\n")

    args.out.mkdir(parents=True, exist_ok=True)
    args.review.mkdir(parents=True, exist_ok=True)

    def work(path: Path) -> Tuple[str, str, ExtractionResult, Dict[str, Any]]:
        markdown = path.read_text(encoding="utf-8")
        person = guess_person_name(path, markdown)
        result = extract_one(
            provider.complete, person, path.stem, f"《{args.book}》", markdown,
            threshold=args.threshold,
            max_retries=args.max_retries,
            dynasty_hint=dynasty,
        )
        node = {"__pending__": True}
        if result.payload:
            person_id = f"person_{_slug(person)}"
            node = to_person_node(result.payload, person_id, dynasty, args.book)
        return person, path.stem, result, node

    stats = {"done": 0, "clean": 0, "review": 0, "quotes": 0, "passed": 0}

    with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
        futures = {pool.submit(work, path): path for path in files}
        for future in as_completed(futures):
            path = futures[future]
            try:
                person, stem, result, node = future.result()
            except Exception as exc:  # 单篇失败不应中断整批
                print(f"  ✖ {path.name}：{exc}")
                continue

            stats["done"] += 1
            stats["quotes"] += result.verification.total
            stats["passed"] += result.verification.passed
            tag = "✓" if not result.needs_review else "⚠"
            print(f"  {tag} {person:<10} 引文 {result.verification.passed}/{result.verification.total} "
                  f"· {result.attempts} 轮 · {path.name}")

            payload = {
                "meta": {
                    "book": args.book,
                    "volume": stem,
                    "dynasty": dynasty,
                    "model": config.resolved_model(),
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "threshold": args.threshold,
                },
                **result.as_dict(),
            }

            if result.needs_review and not args.accept_unverified:
                stats["review"] += 1
                target = args.review / f"{stem}.json"
                target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
                continue

            stats["clean"] += 1
            payload["node"] = node
            target = args.out / f"{stem}.json"
            target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    total = stats["quotes"]
    rate = (stats["passed"] / total * 100) if total else 100.0
    print(f"\n◈ 完成：{stats['done']} 篇 · 入库 {stats['clean']} · 待复核 {stats['review']}")
    print(f"  引文核验 {stats['passed']}/{total}（{rate:.1f}%）")
    if stats["review"]:
        print(f"  待复核文件在 {args.review.resolve()}，人工确认后可移入 {args.out.resolve()}")
    return 0 if stats["clean"] else 1


def _slug(text: str) -> str:
    """把中文姓名转成 ASCII 拼音式 slug 不易做，这里退化为稳定短哈希 + 原名的可读前缀。"""
    import hashlib
    readable = re.sub(r"[^\w\u4e00-\u9fa5]+", "", text)[:8]
    return f"{readable}_{hashlib.sha1(text.encode('utf-8')).hexdigest()[:6]}"


if __name__ == "__main__":
    sys.exit(main())
