#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
哈佛 CBDB（China Biographical Database）人物与关系提取器
================================================================================

接入方式
--------------------------------------------------------------------------------
A. **离线 SQLite**（推荐，官方每半年发布一次 dumps）
   下载：https://projects.iq.harvard.edu/cbdb/cbdb-downloads
   解压后得到 ``cbdb_YYYYMMDD.sqlite3``，用 ``--sqlite`` 指定，或设置环境变量
   ``CBDB_SQLITE_PATH``。脚本会自动探查几个常见放置位置。

B. **在线 REST API**（数据可能落后于 dump，但免下载）
   ``--api-base https://cbdb.fas.harvard.edu/cbdbapi``，按人物 ID 逐条取。

被读取的 CBDB 表（只读，绝不写入用户数据库）
--------------------------------------------------------------------------------
    BIOG_MAIN           人物主表：姓名、生卒、朝代码、索引年、性别
    ALTNAME_DATA        别名表：字、号、谥号、小字（按 ALTNAME_CODES 归类）
    KIN_DATA            亲属关系表：父子兄弟夫妻
    KINSHIP_CODES       亲属称谓字典（用于把代码翻译成「父/子/妻/兄」）
    ASSOC_DATA          社会关系表：师承、举荐、交友、政敌、门生故吏
    ASSOC_CODES         社会关系字典
    BIOG_ADDR_DATA      人物地址表（addr_type=1 为籍贯/本贯）
    ADDRESSES           地理坐标表（x_coord 经度 / y_coord 纬度）
    POSTED_TO_OFFICE_DATA + OFFICE_CODES   历任官职
    DYNASTIES           朝代字典（用于把 c_dy 映射到本站 DynastyId）
    STATUS_DATA         社会身份（可选）

设计要点
--------------------------------------------------------------------------------
* **实体合并**：CBDB 的 ``c_personid`` 是权威主键，所有别名/亲属/地址行都以它
  归并到同一人物；同名不同人不会被误合。跨库合并（如与本项目已有节点对齐）
  必须显式给出映射表，不做模糊匹配——历史的「张三」「李四」重名率极高。
* **不做虚构填充**：CBDB 缺失的字段一律留空，由下游 LLM 抽取补足，
  绝不用「大致年代」冒充精确生卒年。
* **只输出中间态**：本脚本产出 ``cbdb_<dynasty>.json``，不是最终分片。
  分片打包由 ``build_shards.py`` 完成，中间可插入人工校订。

用法
--------------------------------------------------------------------------------
    # 探查数据库里有哪些朝代、多少人
    python cbdb_connector.py --check

    # 抽取三国人物及其社会关系（限 300 人）
    python cbdb_connector.py --dynasty three_kingdoms --limit 300 \\
        --out ../build/intermediate/cbdb_three_kingdoms.json

    # 指定 SQLite 文件
    python cbdb_connector.py --sqlite /data/cbdb_20240401.sqlite3 --dynasty tang
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

try:  # 与 schema_validator 同目录，允许直接运行
    from schema_validator import DYNASTY_NAME_TO_ID, RELATION_CATEGORIES
except ImportError:  # pragma: no cover
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from schema_validator import DYNASTY_NAME_TO_ID, RELATION_CATEGORIES


# =============================================================================
# 一、数据库定位与建连
# =============================================================================

ENV_SQLITE = "CBDB_SQLITE_PATH"
ENV_API = "CBDB_API_BASE"

# 常见的 CBDB dump 落盘位置（按优先级）
CANDIDATE_PATHS: Tuple[str, ...] = (
    "./data/cbdb.sqlite3",
    "./data/cbdb_20240401.sqlite3",
    "../data/cbdb.sqlite3",
    "../../data/cbdb.sqlite3",
    "~/cbdb/cbdb.sqlite3",
    "~/Downloads/cbdb_20240401.sqlite3",
)


def resolve_sqlite_path(explicit: Optional[str]) -> Optional[Path]:
    """按「显式参数 → 环境变量 → 常见路径」顺序定位 CBDB 数据库。"""
    if explicit:
        path = Path(explicit).expanduser()
        return path if path.exists() else None

    env_path = os.environ.get(ENV_SQLITE)
    if env_path:
        path = Path(env_path).expanduser()
        if path.exists():
            return path

    for candidate in CANDIDATE_PATHS:
        path = Path(candidate).expanduser()
        if path.exists():
            return path

    # 兜底：在 data/ 与当前目录下按 glob 找最新的 cbdb*.sqlite3
    for base in (Path("./data"), Path("."), Path("..")):
        if not base.exists():
            continue
        matches = sorted(base.glob("cbdb*.sqlite3"), key=lambda p: p.stat().st_mtime, reverse=True)
        if matches:
            return matches[0]
    return None


def connect(path: Path) -> sqlite3.Connection:
    """只读方式打开 CBDB，避免任何误写。"""
    uri = f"file:{path.as_posix()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type IN ('table','view') AND name = ? LIMIT 1", (table,)
    ).fetchone()
    return row is not None


def columns_of(conn: sqlite3.Connection, table: str) -> set:
    if not table_exists(conn, table):
        return set()
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}


def safe_columns(conn: sqlite3.Connection, table: str, wanted: Sequence[str]) -> List[str]:
    """取 wanted 与真实表结构的交集，兼容不同年份的 dump 结构变化。"""
    cols = columns_of(conn, table)
    return [c for c in wanted if c in cols]


# =============================================================================
# 二、朝代映射（c_dy → DynastyId）
# =============================================================================

# CBDB 的 c_dy 编码在不同版本间基本稳定，但仍以 DYNASTIES 表为准；
# 下面这份兜底表只在 DYNASTIES 表缺失时使用，且随时可被 --dynasty-map 覆盖。
FALLBACK_DY_CODE: Dict[int, str] = {
    1: "pre_qin", 2: "qin", 3: "western_han", 4: "eastern_han",
    5: "three_kingdoms", 6: "jin", 7: "southern_northern",
    8: "sui", 9: "tang", 10: "five_dynasties", 11: "song",
    12: "liao_jin_xia", 13: "yuan", 14: "ming", 15: "qing",
}


def build_dynasty_map(conn: sqlite3.Connection) -> Dict[int, str]:
    """从 DYNASTIES 表构建 c_dy → DynastyId 映射；缺失时退回静态表。"""
    mapping: Dict[int, str] = {}
    if table_exists(conn, "DYNASTIES"):
        cols = safe_columns(conn, "DYNASTIES", ["c_dy", "c_dynasty_chn", "c_dynasty"])
        if "c_dy" in cols:
            name_col = "c_dynasty_chn" if "c_dynasty_chn" in cols else ("c_dynasty" if "c_dynasty" in cols else None)
            if name_col:
                for row in conn.execute(f"SELECT c_dy, {name_col} AS name FROM DYNASTIES"):
                    name = str(row["name"] or "").strip()
                    mapped = _match_dynasty_name(name)
                    if mapped:
                        mapping[int(row["c_dy"])] = mapped
    for code, dyn in FALLBACK_DY_CODE.items():
        mapping.setdefault(code, dyn)
    return mapping


def _match_dynasty_name(name: str) -> Optional[str]:
    """从「北宋」「劉宋」「三國·魏」之类的中文朝代名里解析出本站枚举。"""
    if not name:
        return None
    if name in DYNASTY_NAME_TO_ID:
        return DYNASTY_NAME_TO_ID[name]
    # 「劉宋」属南朝，须先排除，避免被「宋」误配为赵宋
    if name.startswith("劉宋") or name.startswith("刘宋"):
        return "southern_northern"
    for key in sorted(DYNASTY_NAME_TO_ID, key=len, reverse=True):
        if key in name:
            return DYNASTY_NAME_TO_ID[key]
    return None


# =============================================================================
# 三、关系语义映射（CBDB 代码表 → 本站 RelationCategory）
# =============================================================================

# (关键词, 关系大类, 显示标签)。匹配顺序即优先级，长词在前避免「子」抢先命中「弟子」。
ASSOC_RULES: Tuple[Tuple[Tuple[str, ...], str, str], ...] = (
    (("師", "师", "弟子", "門人", "门人", "學生", "学生", "受業", "受业"), "mentor_disciple", "师承"),
    (("推薦", "推荐", "舉薦", "举荐", "薦舉", "荐举", "知遇", "拔擢"), "political_ally", "举荐"),
    (("彈劾", "弹劾", "劾奏", "政敵", "政敌", "構陷", "构陷", "傾軋", "倾轧", "攻訐", "攻讦"), "political_rival", "政敌"),
    (("對立", "对立", "反對", "反对", "排斥", "貶謫", "贬谪"), "political_rival", "政见相左"),
    (("交戰", "交战", "攻伐", "討伐", "讨伐", "擊敗", "击败", "拒守", "圍攻", "围攻"), "military_adversary", "沙场交锋"),
    (("僚屬", "僚属", "部屬", "部属", "部下", "屬吏", "属吏", "長官", "长官", "上司"), "monarch_subject", "上下统属"),
    (("君臣", "君主", "臣屬", "臣属", "事之", "奉事"), "monarch_subject", "君臣"),
    (("唱和", "同遊", "同游", "詩友", "诗友", "文友", "雅集", "宴遊", "宴游"), "literary_bosom", "诗酒之交"),
    (("朋", "友", "交游", "交遊", "結交", "结交", "相善", "往來", "往来"), "literary_bosom", "交游"),
    (("姻", "婚", "聯姻", "联姻"), "kinship_marriage", "姻亲"),
)

KIN_RULES: Tuple[Tuple[Tuple[str, ...], str, str], ...] = (
    (("夫", "妻", "妾", "繼室", "继室", "側室", "侧室"), "kinship_marriage", "夫妻"),
    (("岳", "婿", "舅", "姨", "姑", "甥", "侄", "姪"), "kinship_marriage", "姻亲"),
    (("父", "母", "子", "女", "祖", "孫", "孙", "曾祖", "玄孫", "玄孙"), "kinship_blood", "直系血亲"),
    (("兄", "弟", "姊", "妹", "從父", "从父", "族", "堂"), "kinship_blood", "同辈血亲"),
    (("叔", "伯", "季", "季父", "從子", "从子"), "kinship_blood", "旁系血亲"),
)


def classify_assoc(desc: str) -> Tuple[str, str]:
    """把 CBDB 社会关系描述翻译成 (关系大类, 中文标签)。"""
    text = desc or ""
    for keywords, category, label in ASSOC_RULES:
        if any(k in text for k in keywords):
            return category, label
    return "political_ally", "同朝之人"


def classify_kin(desc: str) -> Tuple[str, str]:
    """把 CBDB 亲属称谓翻译成 (关系大类, 中文标签)。"""
    text = desc or ""
    for keywords, category, label in KIN_RULES:
        if any(k in text for k in keywords):
            # 亲属标签优先用 CBDB 原始称谓（如「從弟」），更精确
            return category, (text[:4] if text else label)
    return "kinship_blood", "同族"


# =============================================================================
# 四、抽取
# =============================================================================

@dataclass
class ExtractOptions:
    dynasty: str
    limit: int = 500
    min_index_year: Optional[int] = None
    max_index_year: Optional[int] = None
    include_kinship: bool = True
    include_assoc: bool = True
    include_offices: bool = True
    include_addresses: bool = True


def fetch_person_rows(conn: sqlite3.Connection, dyn_codes: Sequence[int], opts: ExtractOptions) -> List[sqlite3.Row]:
    """按朝代码取人物主表记录。按 c_index_year 排序，重要人物（索引年靠前）优先。"""
    cols = safe_columns(
        conn, "BIOG_MAIN",
        ["c_personid", "c_name", "c_name_chn", "c_birthyear", "c_deathyear",
         "c_dy", "c_index_year", "c_female", "c_surname_chn", "c_givenname_chn", "c_notes"],
    )
    if "c_personid" not in cols:
        raise RuntimeError("BIOG_MAIN 缺少 c_personid，数据库结构异常")

    where = ["c_dy IN (%s)" % ",".join("?" * len(dyn_codes))]
    params: List[Any] = list(dyn_codes)
    if "c_index_year" in cols:
        if opts.min_index_year is not None:
            where.append("c_index_year >= ?")
            params.append(opts.min_index_year)
        if opts.max_index_year is not None:
            where.append("c_index_year <= ?")
            params.append(opts.max_index_year)
    sql = f"SELECT {', '.join(cols)} FROM BIOG_MAIN WHERE {' AND '.join(where)}"
    if "c_index_year" in cols:
        sql += " ORDER BY c_index_year ASC, c_personid ASC"
    else:
        sql += " ORDER BY c_personid ASC"
    sql += " LIMIT ?"
    params.append(opts.limit)
    return list(conn.execute(sql, params))


def fetch_altnames(conn: sqlite3.Connection, person_ids: Sequence[int]) -> Dict[int, Dict[str, Any]]:
    """按 ALTNAME_DATA 取字号谥号，并按 ALTNAME_CODES 的中文类型名归类。"""
    result: Dict[int, Dict[str, Any]] = {pid: {} for pid in person_ids}
    if not table_exists(conn, "ALTNAME_DATA") or not person_ids:
        return result

    type_names: Dict[int, str] = {}
    if table_exists(conn, "ALTNAME_CODES"):
        cols = safe_columns(conn, "ALTNAME_CODES", ["c_name_type_code", "c_name_type_desc_chn"])
        if len(cols) == 2:
            for row in conn.execute("SELECT c_name_type_code, c_name_type_desc_chn FROM ALTNAME_CODES"):
                type_names[int(row["c_name_type_code"])] = str(row["c_name_type_desc_chn"] or "")

    cols = safe_columns(conn, "ALTNAME_DATA", ["c_personid", "c_alt_name_chn", "c_alt_name_type_code"])
    if len(cols) < 3:
        return result

    placeholders = ",".join("?" * len(person_ids))
    sql = (
        "SELECT c_personid, c_alt_name_chn, c_alt_name_type_code FROM ALTNAME_DATA "
        f"WHERE c_personid IN ({placeholders})"
    )
    for row in conn.execute(sql, list(person_ids)):
        pid = int(row["c_personid"])
        name = str(row["c_alt_name_chn"] or "").strip()
        if not name:
            continue
        type_name = type_names.get(int(row["c_alt_name_type_code"] or 0), "")
        bucket = result.setdefault(pid, {})
        if "字" in type_name:
            bucket.setdefault("courtesyName", name)
        elif "諡" in type_name or "谥" in type_name:
            bucket.setdefault("posthumousTitle", name)
        elif "號" in type_name or "号" in type_name or "別名" in type_name:
            bucket.setdefault("pseudonyms", []).append(name)
        elif "小字" in type_name or "乳名" in type_name:
            bucket.setdefault("pseudonyms", []).append(name)
        else:
            bucket.setdefault("pseudonyms", []).append(name)
    return result


def fetch_kinship(conn: sqlite3.Connection, person_ids: Sequence[int]) -> List[Dict[str, Any]]:
    """KIN_DATA → 血缘/姻亲边。只保留两端都在本次抽取集合内的关系。"""
    if not table_exists(conn, "KIN_DATA") or not person_ids:
        return []

    kin_names: Dict[int, str] = {}
    if table_exists(conn, "KINSHIP_CODES"):
        cols = safe_columns(conn, "KINSHIP_CODES", ["c_kin_code", "c_kinrel_chn"])
        if len(cols) == 2:
            for row in conn.execute("SELECT c_kin_code, c_kinrel_chn FROM KINSHIP_CODES"):
                kin_names[int(row["c_kin_code"])] = str(row["c_kinrel_chn"] or "")

    id_set = set(person_ids)
    placeholders = ",".join("?" * len(person_ids))
    sql = (
        "SELECT c_personid, c_kin_id, c_kin_code FROM KIN_DATA "
        f"WHERE c_personid IN ({placeholders})"
    )
    edges: List[Dict[str, Any]] = []
    seen: set = set()
    for row in conn.execute(sql, list(person_ids)):
        a, b = int(row["c_personid"]), int(row["c_kin_id"] or 0)
        if b not in id_set or a == b:
            continue
        key = (min(a, b), max(a, b), "kin")
        if key in seen:
            continue
        seen.add(key)
        desc = kin_names.get(int(row["c_kin_code"] or 0), "")
        category, label = classify_kin(desc)
        edges.append({
            "source": f"cbdb:{a}",
            "target": f"cbdb:{b}",
            "category": category,
            "label": label,
            "specific": desc,
            "table": "KIN_DATA",
        })
    return edges


def fetch_assoc(conn: sqlite3.Connection, person_ids: Sequence[int]) -> List[Dict[str, Any]]:
    """ASSOC_DATA → 社会关系边（师承、举荐、政敌、交游）。"""
    if not table_exists(conn, "ASSOC_DATA") or not person_ids:
        return []

    assoc_names: Dict[int, str] = {}
    if table_exists(conn, "ASSOC_CODES"):
        cols = safe_columns(conn, "ASSOC_CODES", ["c_assoc_code", "c_assoc_desc_chn"])
        if len(cols) == 2:
            for row in conn.execute("SELECT c_assoc_code, c_assoc_desc_chn FROM ASSOC_CODES"):
                assoc_names[int(row["c_assoc_code"])] = str(row["c_assoc_desc_chn"] or "")

    wanted = safe_columns(
        conn, "ASSOC_DATA",
        ["c_personid", "c_assoc_id", "c_assoc_code", "c_assoc_first_year", "c_assoc_last_year"],
    )
    if len(wanted) < 3:
        return []

    id_set = set(person_ids)
    placeholders = ",".join("?" * len(person_ids))
    sql = f"SELECT {', '.join(wanted)} FROM ASSOC_DATA WHERE c_personid IN ({placeholders})"
    edges: List[Dict[str, Any]] = []
    seen: set = set()
    for row in conn.execute(sql, list(person_ids)):
        a, b = int(row["c_personid"]), int(row["c_assoc_id"] or 0)
        if b not in id_set or a == b:
            continue
        desc = assoc_names.get(int(row["c_assoc_code"] or 0), "")
        category, label = classify_assoc(desc)
        key = (min(a, b), max(a, b), category, desc)
        if key in seen:
            continue
        seen.add(key)
        edge = {
            "source": f"cbdb:{a}",
            "target": f"cbdb:{b}",
            "category": category,
            "label": label,
            "specific": desc,
            "table": "ASSOC_DATA",
        }
        first = row["c_assoc_first_year"] if "c_assoc_first_year" in wanted else None
        last = row["c_assoc_last_year"] if "c_assoc_last_year" in wanted else None
        if isinstance(first, int) and -1100 < first < 1950:
            edge["startYear"] = first
        if isinstance(last, int) and -1100 < last < 1950:
            edge["endYear"] = last
        edges.append(edge)
    return edges


def fetch_birthplaces(conn: sqlite3.Connection, person_ids: Sequence[int]) -> Dict[int, Dict[str, Any]]:
    """籍贯：BIOG_ADDR_DATA（addr_type=1 为本贯）→ ADDRESSES 的经纬度。"""
    result: Dict[int, Dict[str, Any]] = {}
    if not person_ids or not table_exists(conn, "BIOG_ADDR_DATA") or not table_exists(conn, "ADDRESSES"):
        return result
    addr_cols = columns_of(conn, "ADDRESSES")
    if "x_coord" not in addr_cols or "y_coord" not in addr_cols:
        return result

    placeholders = ",".join("?" * len(person_ids))
    sql = (
        "SELECT d.c_personid, a.c_name_chn, a.x_coord, a.y_coord "
        "FROM BIOG_ADDR_DATA d JOIN ADDRESSES a ON d.c_addr_id = a.c_addr_id "
        f"WHERE d.c_personid IN ({placeholders}) AND d.c_addr_type = 1 "
        "ORDER BY d.c_personid, d.c_firstyear"
    )
    for row in conn.execute(sql, list(person_ids)):
        pid = int(row["c_personid"])
        if pid in result:
            continue
        lng, lat = row["x_coord"], row["y_coord"]
        if lng is None or lat is None:
            continue
        # CBDB 的 x_coord/y_coord 已是 WGS84 经纬度；越界值说明数据缺失（记为 0）
        if not (-180 <= lng <= 180 and -90 <= lat <= 90) or (lng == 0 and lat == 0):
            continue
        result[pid] = {
            "ancientName": str(row["c_name_chn"] or "").strip(),
            "modernName": str(row["c_name_chn"] or "").strip(),
            "coordinates": [round(float(lng), 4), round(float(lat), 4)],
        }
    return result


def fetch_offices(conn: sqlite3.Connection, person_ids: Sequence[int], limit_per_person: int = 8) -> Dict[int, List[str]]:
    """历任官职：POSTED_TO_OFFICE_DATA ⋈ OFFICE_CODES，按首次任命年排序。"""
    result: Dict[int, List[str]] = {}
    if not person_ids or not table_exists(conn, "POSTED_TO_OFFICE_DATA") or not table_exists(conn, "OFFICE_CODES"):
        return result
    office_cols = safe_columns(conn, "OFFICE_CODES", ["c_office_id", "c_office_chn"])
    if len(office_cols) < 2:
        return result

    placeholders = ",".join("?" * len(person_ids))
    sql = (
        "SELECT p.c_personid, o.c_office_chn, p.c_firstyear "
        "FROM POSTED_TO_OFFICE_DATA p JOIN OFFICE_CODES o ON p.c_office_id = o.c_office_id "
        f"WHERE p.c_personid IN ({placeholders}) "
        "ORDER BY p.c_personid, p.c_firstyear"
    )
    for row in conn.execute(sql, list(person_ids)):
        pid = int(row["c_personid"])
        name = str(row["c_office_chn"] or "").strip()
        if not name:
            continue
        bucket = result.setdefault(pid, [])
        if name not in bucket and len(bucket) < limit_per_person:
            bucket.append(name)
    return result


def to_person_record(
    row: sqlite3.Row,
    dyn_map: Dict[int, str],
    altnames: Dict[int, Dict[str, Any]],
    birthplaces: Dict[int, Dict[str, Any]],
    offices: Dict[int, List[str]],
) -> Dict[str, Any]:
    """BIOG_MAIN 行 → 本站中间态人物记录（缺失字段一律留空，不虚构）。"""
    pid = int(row["c_personid"])
    keys = row.keys()
    name_chn = str((row["c_name_chn"] if "c_name_chn" in keys else "") or "").strip()
    name = name_chn or str((row["c_name"] if "c_name" in keys else "") or "").strip()

    female = row["c_female"] if "c_female" in keys else None
    gender = "female" if female in (1, "1", True) else "male"

    dynasty = dyn_map.get(int(row["c_dy"])) if "c_dy" in keys and row["c_dy"] is not None else None

    record: Dict[str, Any] = {
        "cbdbId": pid,
        "name": name,
        "nameChn": name_chn,
        "gender": gender,
        "dynastyId": dynasty,
        "aliases": altnames.get(pid, {}),
        "offices": offices.get(pid, []),
    }
    for source, target in (("c_birthyear", "birthYear"), ("c_deathyear", "deathYear"), ("c_index_year", "indexYear")):
        if source in keys and isinstance(row[source], int):
            record[target] = row[source]
    if pid in birthplaces:
        record["birthplace"] = birthplaces[pid]
    if "c_notes" in keys and row["c_notes"]:
        record["notes"] = str(row["c_notes"])[:500]
    return record


def extract(opts: ExtractOptions, sqlite_path: Path) -> Dict[str, Any]:
    conn = connect(sqlite_path)
    try:
        dyn_map = build_dynasty_map(conn)
        codes = [code for code, dyn in dyn_map.items() if dyn == opts.dynasty]
        if not codes:
            raise RuntimeError(f"CBDB 中没有映射到 {opts.dynasty} 的朝代码，请检查 DYNASTIES 表")

        rows = fetch_person_rows(conn, codes, opts)
        person_ids = [int(r["c_personid"]) for r in rows]

        altnames = fetch_altnames(conn, person_ids)
        birthplaces = fetch_birthplaces(conn, person_ids) if opts.include_addresses else {}
        offices = fetch_offices(conn, person_ids) if opts.include_offices else {}

        persons = [to_person_record(r, dyn_map, altnames, birthplaces, offices) for r in rows]

        relations: List[Dict[str, Any]] = []
        if opts.include_kinship:
            relations.extend(fetch_kinship(conn, person_ids))
        if opts.include_assoc:
            relations.extend(fetch_assoc(conn, person_ids))

        # 去重：同一对人物可能同时有 KIN 与 ASSOC 记录，按 (source,target,category) 保留首条
        deduped, seen = [], set()
        for rel in relations:
            key = (rel["source"], rel["target"], rel["category"])
            if key in seen:
                continue
            seen.add(key)
            deduped.append(rel)

        return {
            "meta": {
                "source": "cbdb",
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "sqlitePath": str(sqlite_path),
                "dynasty": opts.dynasty,
                "dynastyCodes": codes,
                "limit": opts.limit,
                "counts": {
                    "persons": len(persons),
                    "relations": len(deduped),
                    "withAliases": sum(1 for p in persons if p.get("aliases")),
                    "withBirthplace": sum(1 for p in persons if p.get("birthplace")),
                    "withOffices": sum(1 for p in persons if p.get("offices")),
                },
                "notes": [
                    "本文件为 CBDB 抽取的中间态，不含文言引文、轶事与画像。",
                    "引文与轶事须由 wikisource_24histories.py + llm_extractor.py 补足。",
                    "importanceWeight 由 build_shards.py 依 PageRank 计算后写入。",
                ],
            },
            "persons": persons,
            "relations": deduped,
        }
    finally:
        conn.close()


# =============================================================================
# 五、REST API 模式
# =============================================================================

def fetch_from_api(api_base: str, person_id: int, timeout: int = 20) -> Dict[str, Any]:
    """从 CBDB 在线 API 取单个人物（尽力而为：接口字段随版本变动）。

    CBDB 官方 API 基于 Elasticsearch 封装，路径形如
    ``{base}/person/{personid}``。若服务不可达，直接抛出异常而不是返回空数据，
    避免把「网络失败」误当成「此人无记载」。
    """
    import urllib.error
    import urllib.request

    url = f"{api_base.rstrip('/')}/person/{person_id}"
    request = urllib.request.Request(url, headers={
        "User-Agent": "ChronoGraphChina-ETL/1.0 (historical research; contact: project maintainer)",
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"CBDB API 返回 {exc.code}：{url}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"无法连接 CBDB API（{exc.reason}）：{url}") from exc


# =============================================================================
# 六、CLI
# =============================================================================

def print_db_overview(sqlite_path: Path) -> None:
    conn = connect(sqlite_path)
    try:
        print(f"◈ CBDB 数据库 {sqlite_path}")
        size_mb = sqlite_path.stat().st_size / (1024 * 1024)
        print(f"  文件大小 {size_mb:.1f} MB")

        if table_exists(conn, "BIOG_MAIN"):
            total = conn.execute("SELECT COUNT(*) AS n FROM BIOG_MAIN").fetchone()["n"]
            print(f"  BIOG_MAIN 共 {total:,} 人")
        else:
            print("  ✖ 缺少 BIOG_MAIN，这不是有效的 CBDB dump")
            return

        dyn_map = build_dynasty_map(conn)
        if table_exists(conn, "DYNASTIES"):
            print("\n  朝代分布（前 20）：")
            rows = conn.execute(
                "SELECT c_dy, COUNT(*) AS n FROM BIOG_MAIN GROUP BY c_dy ORDER BY n DESC LIMIT 20"
            ).fetchall()
            for row in rows:
                code = int(row["c_dy"]) if row["c_dy"] is not None else -1
                print(f"    c_dy={code:<4} {dyn_map.get(code, '未映射'):<20} {row['n']:>8,} 人")
        print("\n  关系表：", ", ".join(
            t for t in ("KIN_DATA", "ASSOC_DATA", "ALTNAME_DATA", "BIOG_ADDR_DATA", "POSTED_TO_OFFICE_DATA")
            if table_exists(conn, t)
        ))
    finally:
        conn.close()


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="哈佛 CBDB 人物与关系提取器（输出本项目中间态 JSON）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--sqlite", help="CBDB SQLite 文件路径")
    parser.add_argument("--check", action="store_true", help="仅探查数据库概况")
    parser.add_argument("--dynasty", default="three_kingdoms",
                        help="目标朝代 DynastyId（默认 three_kingdoms）")
    parser.add_argument("--limit", type=int, default=500, help="最多抽取人数（默认 500）")
    parser.add_argument("--min-index-year", type=int, help="索引年下限（用于按活跃年代切片）")
    parser.add_argument("--max-index-year", type=int, help="索引年上限")
    parser.add_argument("--no-kinship", action="store_true", help="跳过亲属关系")
    parser.add_argument("--no-assoc", action="store_true", help="跳过社会关系")
    parser.add_argument("--no-offices", action="store_true", help="跳过官职")
    parser.add_argument("--no-addresses", action="store_true", help="跳过籍贯坐标")
    parser.add_argument("--api-base", default=os.environ.get(ENV_API),
                        help="改用在线 API 模式（给出 CBDB API 基址）")
    parser.add_argument("--person-id", type=int, help="API 模式下要抓取的人物 ID")
    parser.add_argument("--out", help="输出 JSON 路径（默认 ../build/intermediate/）")
    args = parser.parse_args(argv)

    if args.api_base:
        if not args.person_id:
            print("✖ API 模式须配合 --person-id 使用（CBDB 无公开的按朝代枚举接口）")
            return 2
        try:
            data = fetch_from_api(args.api_base, args.person_id)
        except RuntimeError as exc:
            print(f"✖ {exc}")
            return 2
        out = Path(args.out or f"../build/intermediate/cbdb_api_{args.person_id}.json")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"✓ 已写入 {out}")
        return 0

    sqlite_path = resolve_sqlite_path(args.sqlite)
    if not sqlite_path:
        print("✖ 未找到 CBDB 数据库。请任选其一：")
        print("   1) 下载 dump：https://projects.iq.harvard.edu/cbdb/cbdb-downloads")
        print("   2) 用 --sqlite 指定文件路径")
        print(f"   3) 设置环境变量 {ENV_SQLITE}")
        print("\n  目录探查范围：" + "、".join(CANDIDATE_PATHS))
        return 2

    if args.check:
        print_db_overview(sqlite_path)
        return 0

    opts = ExtractOptions(
        dynasty=args.dynasty,
        limit=args.limit,
        min_index_year=args.min_index_year,
        max_index_year=args.max_index_year,
        include_kinship=not args.no_kinship,
        include_assoc=not args.no_assoc,
        include_offices=not args.no_offices,
        include_addresses=not args.no_addresses,
    )

    try:
        payload = extract(opts, sqlite_path)
    except (RuntimeError, sqlite3.Error) as exc:
        print(f"✖ 抽取失败：{exc}")
        return 1

    out = Path(args.out or f"../build/intermediate/cbdb_{args.dynasty}.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    counts = payload["meta"]["counts"]
    print(f"◈ 已抽取 {opts.dynasty}")
    print(f"  人物 {counts['persons']}（含字号 {counts['withAliases']} / 含籍贯 {counts['withBirthplace']} / 含官职 {counts['withOffices']}）")
    print(f"  关系 {counts['relations']}")
    print(f"  → {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
