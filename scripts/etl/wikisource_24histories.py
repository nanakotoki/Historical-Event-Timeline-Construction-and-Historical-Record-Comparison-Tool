#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
维基文库 · 二十四史列传原文抓取与分卷解析器
================================================================================

职责
--------------------------------------------------------------------------------
从 zh.wikisource.org 的 MediaWiki API 拉取二十四部正史正文，转换为便于 LLM
抽取的 Markdown，并按「卷 → 篇 → 段落」三级结构切分落盘。

之所以选维基文库而非其他电子文本源：
  * 有稳定的 MediaWiki API，可按前缀枚举全部卷帙，不必手工维护目录；
  * 页面历史可追溯，出现异文时能定位到具体修订版本；
  * 与前端 ``HistoricalCitation.wikisourceUrl`` 使用同一站点，引文可一键回溯。

二十四史书目与站内根页面
--------------------------------------------------------------------------------
下表 ``roots`` 为该史在维基文库的根页面候选（繁体），脚本会按顺序尝试，
以 ``list=allpages&apprefix=<root>/`` 枚举全部卷帙。若某史尚未录入或更名，
脚本会明确报错而不是静默产出空文件。

缓存与限速
--------------------------------------------------------------------------------
* 所有响应缓存在 ``build/raw/wikisource/<book>/``，重复运行不会重复抓取；
* ``--offline`` 只用缓存，适合断网环境与可复现构建；
* 默认 0.4s 间隔，遵守 Wikimedia API 的使用礼仪；UA 中带项目标识。

用法
--------------------------------------------------------------------------------
    # 列出二十四史与站内卷数（仅枚举，不下载正文）
    python wikisource_24histories.py --list

    # 抓取《三国志》全部卷（首次约 65 卷）
    python wikisource_24histories.py --books sanguozhi

    # 只抓某几卷
    python wikisource_24histories.py --books sanguozhi --volumes 35,36

    # 抓取并切分出「诸葛亮」相关篇目，输出为单人 Markdown
    python wikisource_24histories.py --books sanguozhi --person 諸葛亮

    # 断网时用缓存重新解析（改了解析规则后很有用）
    python wikisource_24histories.py --books sanguozhi --offline
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

try:
    from schema_validator import DYNASTY_NAME_TO_ID
except ImportError:  # pragma: no cover
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from schema_validator import DYNASTY_NAME_TO_ID


API_ENDPOINT = "https://zh.wikisource.org/w/api.php"
USER_AGENT = (
    "ChronoGraphChina-ETL/1.0 (https://github.com/chronograph-china; "
    "historical research corpus builder) python-urllib"
)
DEFAULT_CACHE = Path("../build/raw/wikisource")
DEFAULT_OUTPUT = Path("../build/raw/24histories")


# =============================================================================
# 一、二十四史书目
# =============================================================================

@dataclass(frozen=True)
class HistoryBook:
    key: str                 # 内部键名（拼音）
    title: str               # 史名（繁体，与站内一致）
    dynasty: str             # 对应 DynastyId
    roots: Tuple[str, ...]   # 站内根页面候选
    note: str = ""           # 内容特征提示，供抽取时选择卷次

    @property
    def display(self) -> str:
        return f"《{self.title}》"


CANONICAL_24: Tuple[HistoryBook, ...] = (
    HistoryBook("shiji", "史記", "pre_qin", ("史記",), "纪传体通史，本纪十二、世家三十、列传七十"),
    HistoryBook("hanshu", "漢書", "western_han", ("漢書",), "班固撰，断代史之祖"),
    HistoryBook("houhanshu", "後漢書", "eastern_han", ("後漢書", "后汉书"), "范晔撰，纪十、列传八十"),
    HistoryBook("sanguozhi", "三國志", "three_kingdoms", ("三國志", "三国志"), "陈寿撰，魏蜀吴三书，裴松之注"),
    HistoryBook("jinshu", "晉書", "jin", ("晉書", "晋书"), "房玄龄等撰，载两晋"),
    HistoryBook("songshu", "宋書", "southern_northern", ("宋書", "宋书"), "沈约撰，刘宋一代"),
    HistoryBook("nanqishu", "南齊書", "southern_northern", ("南齊書", "南齐书"), "萧子显撰，南齐"),
    HistoryBook("liangshu", "梁書", "southern_northern", ("梁書", "梁书"), "姚思廉撰，萧梁"),
    HistoryBook("chenshu", "陳書", "southern_northern", ("陳書", "陈书"), "姚思廉撰，陈朝"),
    HistoryBook("weishu", "魏書", "southern_northern", ("魏書", "魏书"), "魏收撰，北魏东魏"),
    HistoryBook("beiqishu", "北齊書", "southern_northern", ("北齊書", "北齐书"), "李百药撰，北齐"),
    HistoryBook("zhoushu", "周書", "southern_northern", ("周書", "周书"), "令狐德棻等撰，北周"),
    HistoryBook("suishu", "隋書", "sui", ("隋書", "隋书"), "魏征等撰，隋代"),
    HistoryBook("nanshi", "南史", "southern_northern", ("南史",), "李延寿撰，南朝通史"),
    HistoryBook("beishi", "北史", "southern_northern", ("北史",), "李延寿撰，北朝通史"),
    HistoryBook("jiutangshu", "舊唐書", "tang", ("舊唐書", "旧唐书"), "刘昫等撰，唐前期第一手"),
    HistoryBook("xintangshu", "新唐書", "tang", ("新唐書", "新唐书"), "欧阳修宋祁撰，事增文省"),
    HistoryBook("jiuwudaishi", "舊五代史", "five_dynasties", ("舊五代史", "旧五代史"), "薛居正等撰"),
    HistoryBook("xinwudaishi", "新五代史", "five_dynasties", ("新五代史",), "欧阳修撰，义法严谨"),
    HistoryBook("songshi", "宋史", "song", ("宋史",), "脱脱等撰，卷帙最巨"),
    HistoryBook("liaoshi", "遼史", "liao_jin_xia", ("遼史", "辽史"), "脱脱等撰"),
    HistoryBook("jinshi", "金史", "liao_jin_xia", ("金史",), "脱脱等撰"),
    HistoryBook("yuanshi", "元史", "yuan", ("元史",), "宋濂等撰"),
    HistoryBook("mingshi", "明史", "ming", ("明史",), "张廷玉等撰"),
)

BOOK_BY_KEY: Dict[str, HistoryBook] = {b.key: b for b in CANONICAL_24}
BOOK_BY_TITLE: Dict[str, HistoryBook] = {b.title: b for b in CANONICAL_24}


# =============================================================================
# 二、MediaWiki API 客户端
# =============================================================================

class MediaWikiError(RuntimeError):
    """API 返回错误或网络不可用。"""


@dataclass
class MediaWikiClient:
    endpoint: str = API_ENDPOINT
    cache_dir: Path = DEFAULT_CACHE
    delay: float = 0.4
    max_retries: int = 4
    offline: bool = False
    timeout: int = 30

    _last_call: float = field(default=0.0, init=False, repr=False)

    # ---------------------------- 底层请求 ----------------------------

    def _cache_path(self, params: Dict[str, Any]) -> Path:
        token = hashlib.sha1(
            json.dumps(params, sort_keys=True, ensure_ascii=False).encode("utf-8")
        ).hexdigest()[:20]
        key = params.get("titles") or params.get("apprefix") or "query"
        safe = re.sub(r"[^\w\u4e00-\u9fa5.-]+", "_", str(key))[:60] or "query"
        return self.cache_dir / f"{safe}.{token}.json"

    def _request(self, params: Dict[str, Any]) -> Dict[str, Any]:
        cache_path = self._cache_path(params)
        if cache_path.exists():
            return json.loads(cache_path.read_text(encoding="utf-8"))
        if self.offline:
            raise MediaWikiError(f"离线模式下缺少缓存：{cache_path.name}（请先在线抓取一次）")

        query = {"format": "json", "formatversion": "2", **params}
        url = f"{self.endpoint}?{urllib.parse.urlencode(query)}"

        last_error: Optional[Exception] = None
        for attempt in range(self.max_retries):
            # 限速：与前一次请求至少间隔 delay 秒（含抖动，避免同步打点）
            wait = self.delay * (1 + 0.3 * attempt) - (time.time() - self._last_call)
            if wait > 0:
                time.sleep(wait)
            request = urllib.request.Request(url, headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
                "Accept-Encoding": "gzip",
            })
            try:
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    raw = response.read()
                    if response.headers.get("Content-Encoding") == "gzip":
                        raw = gzip.decompress(raw)
                    payload = json.loads(raw.decode("utf-8"))
                self._last_call = time.time()
                if "error" in payload:
                    raise MediaWikiError(f"API 错误：{payload['error'].get('info')}")
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
                return payload
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
                last_error = exc
                # 429/5xx 退避重试；4xx 直接放弃
                if isinstance(exc, urllib.error.HTTPError) and exc.code < 500 and exc.code != 429:
                    raise MediaWikiError(f"HTTP {exc.code}：{url}") from exc
                time.sleep(min(8.0, 1.5 ** attempt))
        raise MediaWikiError(f"重试 {self.max_retries} 次仍失败：{url}（{last_error}）")

    # ---------------------------- 高层接口 ----------------------------

    def list_pages(self, prefix: str, limit: int = 500) -> List[str]:
        """按前缀枚举主命名空间下的全部页面标题。"""
        titles: List[str] = []
        cont: Optional[str] = None
        while True:
            params: Dict[str, Any] = {
                "action": "query",
                "list": "allpages",
                "apprefix": prefix,
                "apnamespace": "0",
                "aplimit": str(min(500, max(1, limit - len(titles)))),
            }
            if cont:
                params["apcontinue"] = cont
            payload = self._request(params)
            pages = payload.get("query", {}).get("allpages", [])
            titles.extend(page["title"] for page in pages)
            cont = payload.get("continue", {}).get("apcontinue")
            if not cont or len(titles) >= limit:
                break
        return titles[:limit]

    def page_wikitext(self, title: str) -> str:
        """取单页 wikitext（主 slot 最新修订）。"""
        payload = self._request({
            "action": "query",
            "prop": "revisions",
            "rvprop": "content|timestamp|ids",
            "rvslots": "main",
            "titles": title,
            "redirects": "1",
        })
        pages = payload.get("query", {}).get("pages", [])
        if not pages or pages[0].get("missing"):
            raise MediaWikiError(f"页面不存在：{title}")
        revisions = pages[0].get("revisions") or []
        if not revisions:
            raise MediaWikiError(f"页面无修订内容：{title}")
        return revisions[0]["slots"]["main"]["content"]

    def search(self, keyword: str, limit: int = 10) -> List[str]:
        """全文检索，用于按人名定位所在卷次。"""
        payload = self._request({
            "action": "query",
            "list": "search",
            "srsearch": keyword,
            "srlimit": str(limit),
            "srnamespace": "0",
        })
        return [hit["title"] for hit in payload.get("query", {}).get("search", [])]


# =============================================================================
# 三、wikitext → Markdown
# =============================================================================

_RE_REF = re.compile(r"<ref[^>/]*/>|<ref[^>]*>.*?</ref>", re.S | re.I)
_RE_COMMENT = re.compile(r"<!--.*?-->", re.S)
_RE_TABLE = re.compile(r"\{\|.*?\|\}", re.S)
_RE_FILE_LINK = re.compile(r"\[\[(?:File|Image|檔案|文件|图片|圖像):[^\]]*\]\]", re.I)
_RE_CATEGORY = re.compile(r"\[\[(?:Category|分類|分类):[^\]]*\]\]", re.I)
_RE_MAGIC = re.compile(r"__\w+__")
_RE_HEADING = re.compile(r"^(={2,6})\s*(.+?)\s*\1\s*$", re.M)
_RE_LINK_PIPED = re.compile(r"\[\[([^\]|]+)\|([^\]]+)\]\]")
_RE_LINK_PLAIN = re.compile(r"\[\[([^\]]+)\]\]")
_RE_BOLD = re.compile(r"'''(.+?)'''")
_RE_ITALIC = re.compile(r"''(.+?)''")
_RE_EXT_LINK = re.compile(r"\[https?://[^\s\]]+\s*([^\]]*)\]")
_RE_HTML_TAG = re.compile(r"</?[a-zA-Z][^>]*>")
_RE_MULTI_NEWLINE = re.compile(r"\n{3,}")
_RE_TEMPLATE = re.compile(r"\{\{[^{}]*\}\}")


def strip_templates(text: str, max_rounds: int = 12) -> str:
    """递归剥除 {{...}} 模板（含嵌套）。

    维基文库的列传正文里夹杂大量版式模板（{{Header}}、{{YL|建安十三年}}、
    {{*}} 等）。若不一并清除，会污染 LLM 输入并制造假引文，所以必须剥到
    不再变化为止。{{YL|year}} 这类纪年模板另行替换为裸年份。
    """
    # 先把纪年模板换成可读文本：{{YL|建安十三年}} → 建安十三年
    text = re.sub(r"\{\{\s*(?:YL|yl|年)\s*\|\s*([^{}|]+)\}\}", r"\1", text)
    previous = None
    rounds = 0
    while previous != text and rounds < max_rounds:
        previous = text
        text = _RE_TEMPLATE.sub("", text)
        rounds += 1
    return text


def wikitext_to_markdown(wikitext: str, title: str = "") -> str:
    """把一页 wikitext 转成结构清晰的 Markdown 正文。"""
    text = wikitext

    text = _RE_COMMENT.sub("", text)
    text = _RE_REF.sub("", text)
    text = _RE_TABLE.sub("", text)
    text = _RE_FILE_LINK.sub("", text)
    text = _RE_CATEGORY.sub("", text)
    text = _RE_MAGIC.sub("", text)
    text = strip_templates(text)

    # 内链：[[目标|显示]] → 显示；[[目标]] → 目标（去掉「卷六」之类命名空间残留）
    text = _RE_LINK_PIPED.sub(lambda m: m.group(2).strip(), text)
    text = _RE_LINK_PLAIN.sub(lambda m: m.group(1).split("#")[0].strip(), text)

    text = _RE_BOLD.sub(lambda m: f"**{m.group(1).strip()}**", text)
    text = _RE_ITALIC.sub(lambda m: f"*{m.group(1).strip()}*", text)
    text = _RE_EXT_LINK.sub(lambda m: m.group(1).strip(), text)
    text = _RE_HTML_TAG.sub("", text)

    # 标题：== 篇名 == → ## 篇名（MediaWiki 与 Markdown 的层级号恰好一致，直接照搬）
    def heading(match: "re.Match[str]") -> str:
        level = min(6, len(match.group(1)))
        return f"{'#' * level} {match.group(2).strip()}"

    text = _RE_HEADING.sub(heading, text)

    # 列表符号与定义缩进
    text = re.sub(r"^[;:]\s*", "", text, flags=re.M)

    # 收尾：压缩空行、去掉行尾空格
    lines = [line.rstrip() for line in text.splitlines()]
    text = "\n".join(lines)
    text = _RE_MULTI_NEWLINE.sub("\n\n", text).strip()

    header = f"# {title}\n\n" if title and not text.startswith("#") else ""
    return header + text


# =============================================================================
# 四、按篇切分
# =============================================================================

@dataclass
class BiographySection:
    """一篇（如《諸葛亮傳》）的切分结果。"""

    volume_title: str       # 卷页标题，如「三國志/卷35」
    heading: str            # 篇名，如「諸葛亮傳」
    markdown: str           # 该篇正文
    char_count: int

    def as_dict(self) -> Dict[str, Any]:
        return {
            "volume": self.volume_title,
            "heading": self.heading,
            "chars": self.char_count,
            "markdown": self.markdown,
        }


def split_biographies(volume_title: str, markdown: str, min_chars: int = 200) -> List[BiographySection]:
    """按二级标题切分篇目；若无标题，则整卷视为一篇。"""
    lines = markdown.splitlines()
    sections: List[Tuple[str, List[str]]] = []
    current_heading = volume_title
    buffer: List[str] = []

    for line in lines:
        match = re.match(r"^##\s+(.+?)\s*$", line)
        if match:
            if buffer:
                sections.append((current_heading, buffer))
            current_heading = match.group(1)
            buffer = []
            continue
        buffer.append(line)
    if buffer:
        sections.append((current_heading, buffer))

    result: List[BiographySection] = []
    for heading, body_lines in sections:
        body = "\n".join(body_lines).strip()
        # 去掉「卷首目录」「返回目录」这类导航残片
        body = re.sub(r"^\s*(?:目錄|目录|返回|上一卷|下一卷).*$", "", body, flags=re.M).strip()
        chars = len(re.sub(r"\s", "", body))
        if chars < min_chars:
            continue
        result.append(BiographySection(
            volume_title=volume_title,
            heading=heading,
            markdown=body,
            char_count=chars,
        ))
    return result


# =============================================================================
# 五、抓取主流程
# =============================================================================

@dataclass
class FetchReport:
    book: HistoryBook
    volumes: List[str] = field(default_factory=list)
    written: int = 0
    sections: int = 0
    chars: int = 0
    errors: List[str] = field(default_factory=list)


def locate_volumes(client: MediaWikiClient, book: HistoryBook, limit: int = 0) -> List[str]:
    """枚举某史的全部卷页；依次尝试根页面候选，取第一个有结果的。"""
    errors: List[str] = []
    for root in book.roots:
        try:
            pages = client.list_pages(f"{root}/", limit=limit or 500)
        except MediaWikiError as exc:
            errors.append(f"{root}: {exc}")
            continue
        if pages:
            return pages
    raise MediaWikiError(
        f"{book.display} 未能枚举到任何卷页，尝试过的根页面：{book.roots}"
        + (f"；错误：{'; '.join(errors)}" if errors else "")
    )


def parse_volume_number(title: str) -> Optional[int]:
    """从「三國志/卷35」这类标题里取卷号，用于 --volumes 过滤。"""
    match = re.search(r"卷\s*0*(\d+)", title)
    return int(match.group(1)) if match else None


def fetch_book(
    client: MediaWikiClient,
    book: HistoryBook,
    output_dir: Path,
    volumes_filter: Optional[Sequence[int]] = None,
    person: Optional[str] = None,
    max_volumes: int = 0,
    min_section_chars: int = 200,
) -> FetchReport:
    report = FetchReport(book=book)

    try:
        volumes = locate_volumes(client, book, limit=max_volumes)
    except MediaWikiError as exc:
        report.errors.append(str(exc))
        return report

    if volumes_filter:
        wanted = set(volumes_filter)
        volumes = [v for v in volumes if parse_volume_number(v) in wanted]
    if max_volumes:
        volumes = volumes[:max_volumes]
    report.volumes = volumes

    book_dir = output_dir / book.key
    book_dir.mkdir(parents=True, exist_ok=True)

    for title in volumes:
        try:
            wikitext = client.page_wikitext(title)
        except MediaWikiError as exc:
            report.errors.append(f"{title}: {exc}")
            continue

        markdown = wikitext_to_markdown(wikitext, title)
        sections = split_biographies(title, markdown, min_chars=min_section_chars)
        if not sections:
            # 整卷不足一篇的分量（目录页、序例等），仍保留整卷以免丢失
            sections = [BiographySection(title, title, markdown, len(re.sub(r"\s", "", markdown)))]

        if person:
            sections = [s for s in sections if person in s.markdown or person in s.heading]
            if not sections:
                continue

        safe = re.sub(r"[^\w\u4e00-\u9fa5.-]+", "_", title.split("/", 1)[-1] or title)
        target = book_dir / f"{safe}.md"
        body_parts = [f"<!-- source: zh.wikisource.org/wiki/{urllib.parse.quote(title)} -->", ""]
        for section in sections:
            body_parts.append(f"## {section.heading}")
            body_parts.append("")
            body_parts.append(section.markdown)
            body_parts.append("")
        target.write_text("\n".join(body_parts), encoding="utf-8")

        report.written += 1
        report.sections += len(sections)
        report.chars += sum(s.char_count for s in sections)

    # 落一份书目清单，便于人工核对抓了哪些卷
    manifest = {
        "book": book.title,
        "key": book.key,
        "dynasty": book.dynasty,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "volumes": volumes,
        "written": report.written,
        "sections": report.sections,
        "chars": report.chars,
        "errors": report.errors,
    }
    (book_dir / "_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return report


# =============================================================================
# 六、CLI
# =============================================================================

def cmd_list(client: MediaWikiClient, do_network: bool) -> int:
    print("◈ 二十四史书目与站内卷数")
    print(f"  {'键名':<14}{'史名':<10}{'朝代':<20}{'卷数':>6}  备注")
    for book in CANONICAL_24:
        count = "—"
        if do_network:
            try:
                count = str(len(locate_volumes(client, book)))
            except MediaWikiError:
                count = "×"
        print(f"  {book.key:<14}{book.display:<12}{book.dynasty:<20}{count:>6}  {book.note}")
    print(f"\n  共 {len(CANONICAL_24)} 部（二十四史）")
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="维基文库二十四史列传原文抓取与分卷解析器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--books", default="", help="书目键名，逗号分隔（如 sanguozhi,shiji）；留空表示全部")
    parser.add_argument("--list", action="store_true", help="列出书目与站内卷数")
    parser.add_argument("--no-network", action="store_true", help="--list 时不联网查询卷数")
    parser.add_argument("--volumes", default="", help="仅抓指定卷号，逗号分隔（如 35,36）")
    parser.add_argument("--person", help="仅保留包含该人名（繁体）的篇目")
    parser.add_argument("--max-volumes", type=int, default=0, help="每部史最多抓多少卷（0 为不限）")
    parser.add_argument("--min-section-chars", type=int, default=200, help="篇目最小字数，低于此值视为目录页")
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE, help="API 响应缓存目录")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT, help="Markdown 输出目录")
    parser.add_argument("--offline", action="store_true", help="仅使用本地缓存，不发起网络请求")
    parser.add_argument("--delay", type=float, default=0.4, help="请求间隔秒数（默认 0.4）")
    args = parser.parse_args(argv)

    client = MediaWikiClient(cache_dir=args.cache_dir, delay=args.delay, offline=args.offline)

    if args.list:
        return cmd_list(client, do_network=not args.no_network and not args.offline)

    keys = [k.strip() for k in args.books.split(",") if k.strip()]
    books = [BOOK_BY_KEY[k] for k in keys] if keys else list(CANONICAL_24)
    unknown = [k for k in keys if k not in BOOK_BY_KEY]
    if unknown:
        print(f"✖ 未知书目键名：{', '.join(unknown)}")
        print(f"  可用键名：{', '.join(BOOK_BY_KEY)}")
        return 2

    volumes_filter = [int(v) for v in args.volumes.split(",") if v.strip().isdigit()] or None

    print(f"◈ 抓取 {len(books)} 部正史")
    print(f"  缓存 {args.cache_dir.resolve()}")
    print(f"  输出 {args.out.resolve()}\n")

    total_written = total_sections = total_chars = 0
    failures = 0

    for book in books:
        report = fetch_book(
            client, book, args.out,
            volumes_filter=volumes_filter,
            person=args.person,
            max_volumes=args.max_volumes,
            min_section_chars=args.min_section_chars,
        )
        total_written += report.written
        total_sections += report.sections
        total_chars += report.chars

        status = "✓" if report.written else "✖"
        print(f"  {status} {book.display:<10} 卷 {len(report.volumes):>3} · 写入 {report.written:>3} · 篇 {report.sections:>4} · {report.chars:>9,} 字")
        for err in report.errors[:3]:
            print(f"      ⚠ {err}")
        if report.errors:
            failures += 1

    print(f"\n◈ 汇总：{total_written} 卷 · {total_sections} 篇 · {total_chars:,} 字")
    if failures:
        print(f"  有 {failures} 部史存在错误（详见各目录 _manifest.json）")
    return 0 if total_written else 1


if __name__ == "__main__":
    sys.exit(main())
