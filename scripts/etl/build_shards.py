#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
实体消歧 · 图中心度计算 · 静态分片打包器
================================================================================

输入
--------------------------------------------------------------------------------
* ``build/extracted/**/*.json``   —— ``llm_extractor.py`` 产出的人物节点
                                    （引文已通过原文核验；待复核的不会在此目录）
* ``build/intermediate/*.json``   —— 可选，``cbdb_connector.py`` 的关系边
* 可选 ``--merge-existing``       —— 把 ``public/data/shards`` 已有节点并入，
                                    便于在种子库基础上增量扩充而不推倒重来

输出
--------------------------------------------------------------------------------
* ``public/data/shards/<shardId>.json``   —— 前端首屏按需加载的时代分片
* ``public/data/manifest.json``           —— 全局索引、统计、轻量检索清单
* ``build/reports/build_report.json``     —— 本次构建的完整审计报告

三件关键工作
--------------------------------------------------------------------------------
1. **实体消歧**（entity disambiguation）
   历史人物重名率极高（「李密」「张衡」「王粲」各有多人）。本脚本只承认三种
   同一性证据，且优先级严格递减：
     a. 相同 ``cbdbId``（权威主键）
     b. 相同 ``id``（跨源已对齐过的节点）
     c. 姓名 + 朝代完全相同（仅在前两者都缺失时启用，且记入报告待复核）
   **绝不做姓名模糊匹配**——那会把两个不同的人静默合并，是史实污染的重灾区。

2. **图中心度 → importanceWeight**
   PageRank 反映「被多少重要人物牵连」，度中心性反映「直接关系多寡」。
   二者各自极差归一后加权（0.6 / 0.4），线性映射到 1~100。该值驱动前端的
   语义级缩放（LOD）：权重高的人物在缩小时仍保留标签与画像。

3. **契约校验后才落盘**
   写文件前调用 ``schema_validator``；任一硬性错误即中止，不产出半成品分片。

用法
--------------------------------------------------------------------------------
    # 试跑（写到 build/out，不动 public/data）
    python build_shards.py --dry-run

    # 正式打包（会覆盖 public/data/shards 与 manifest.json）
    python build_shards.py --merge-existing

    # 指定输入
    python build_shards.py --extracted ../build/extracted --relations ../build/intermediate
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))

from schema_validator import (  # noqa: E402
    RELATION_CATEGORIES,
    validate_fallback,
    validate_shard,
)

try:
    import networkx as nx
    _HAS_NETWORKX = True
except Exception:  # pragma: no cover
    _HAS_NETWORKX = False


# =============================================================================
# 一、朝代元数据（与 src/data/dynasties.ts 严格一致，两处改动须同步）
# =============================================================================

DYNASTIES: List[Dict[str, Any]] = [
    {"id": "pre_qin", "name": "先秦", "startYear": -1046, "endYear": -222, "primaryColor": "#7A6A45", "canonicalBooks": ["《史记》"]},
    {"id": "qin", "name": "秦", "startYear": -221, "endYear": -207, "primaryColor": "#2F3540", "canonicalBooks": ["《史记》"]},
    {"id": "chu_han", "name": "楚汉之际", "startYear": -206, "endYear": -202, "primaryColor": "#8C4A3F", "canonicalBooks": ["《史记》", "《汉书》"]},
    {"id": "western_han", "name": "西汉", "startYear": -202, "endYear": 8, "primaryColor": "#B0763F", "canonicalBooks": ["《史记》", "《汉书》"]},
    {"id": "xin", "name": "新莽", "startYear": 9, "endYear": 25, "primaryColor": "#7D6337", "canonicalBooks": ["《汉书》", "《后汉书》"]},
    {"id": "eastern_han", "name": "东汉", "startYear": 25, "endYear": 220, "primaryColor": "#A24A3B", "canonicalBooks": ["《后汉书》", "《三国志》"]},
    {"id": "three_kingdoms", "name": "三国", "startYear": 220, "endYear": 280, "primaryColor": "#4C6A8A", "canonicalBooks": ["《三国志》", "《后汉书》", "《晋书》"]},
    {"id": "jin", "name": "两晋", "startYear": 266, "endYear": 420, "primaryColor": "#5D7F6E", "canonicalBooks": ["《晋书》"]},
    {"id": "southern_northern", "name": "南北朝", "startYear": 420, "endYear": 589, "primaryColor": "#6E6180", "canonicalBooks": ["《宋书》", "《南齐书》", "《梁书》", "《陈书》", "《魏书》", "《北齐书》", "《周书》", "《南史》", "《北史》"]},
    {"id": "sui", "name": "隋", "startYear": 581, "endYear": 618, "primaryColor": "#7A4B5C", "canonicalBooks": ["《隋书》"]},
    {"id": "tang", "name": "唐", "startYear": 618, "endYear": 907, "primaryColor": "#C0762F", "canonicalBooks": ["《旧唐书》", "《新唐书》"]},
    {"id": "five_dynasties", "name": "五代十国", "startYear": 907, "endYear": 979, "primaryColor": "#7A6A5A", "canonicalBooks": ["《旧五代史》", "《新五代史》"]},
    {"id": "song", "name": "宋", "startYear": 960, "endYear": 1279, "primaryColor": "#4E7A7A", "canonicalBooks": ["《宋史》"]},
    {"id": "liao_jin_xia", "name": "辽金西夏", "startYear": 907, "endYear": 1234, "primaryColor": "#8A7440", "canonicalBooks": ["《辽史》", "《金史》", "《宋史》"]},
    {"id": "yuan", "name": "元", "startYear": 1271, "endYear": 1368, "primaryColor": "#566A86", "canonicalBooks": ["《元史》"]},
    {"id": "ming", "name": "明", "startYear": 1368, "endYear": 1644, "primaryColor": "#B03A2E", "canonicalBooks": ["《明史》"]},
    {"id": "qing", "name": "清", "startYear": 1636, "endYear": 1912, "primaryColor": "#3F5A6B", "canonicalBooks": ["《清史稿》"]},
]

DYNASTY_NAME = {d["id"]: d["name"] for d in DYNASTIES}


@dataclass(frozen=True)
class ShardGroup:
    shard_id: str
    title: str
    subtitle: str
    dynasties: Tuple[str, ...]
    year_range: Tuple[int, int]

    @property
    def main_dynasty(self) -> str:
        """用于节点补全时的默认朝代（组内第一个）。"""
        return self.dynasties[0]


SHARD_GROUPS: Tuple[ShardGroup, ...] = (
    ShardGroup("shard_01_pre_qin", "先秦诸子与列国", "《史记》五帝至战国", ("pre_qin",), (-1046, -222)),
    # 秦代并入楚汉分片：秦始皇与陈胜项羽刘邦在同一叙事场中，且 dynasties.ts 亦如此映射
    ShardGroup("shard_02_chu_han", "楚汉争霸与大汉开国", "《史记》《汉书》", ("chu_han", "western_han", "xin", "qin"), (-221, 25)),
    ShardGroup("shard_03_three_kingdoms", "汉末三国与门阀雏形", "《三国志》《后汉书》《世说新语》", ("eastern_han", "three_kingdoms", "jin"), (139, 420)),
    ShardGroup("shard_04_jin_nanbeichao", "两晋南北朝", "《晋书》至南北朝诸史", ("southern_northern",), (420, 589)),
    ShardGroup("shard_05_sui_tang", "隋唐鼎革与贞观开元", "《隋书》《旧唐书》《新唐书》", ("sui", "tang"), (541, 907)),
    ShardGroup("shard_06_song_ming_qing", "宋元明清", "《宋史》至《明史》", ("five_dynasties", "song", "liao_jin_xia", "yuan", "ming", "qing"), (907, 1912)),
)

GROUP_BY_DYNASTY: Dict[str, ShardGroup] = {}
for group in SHARD_GROUPS:
    for dynasty in group.dynasties:
        GROUP_BY_DYNASTY[dynasty] = group


# =============================================================================
# 二、载入与实体消歧
# =============================================================================

@dataclass
class LoadStats:
    files: int = 0
    nodes_raw: int = 0
    nodes_kept: int = 0
    duplicates: List[str] = field(default_factory=list)
    edges_raw: int = 0
    edges_kept: int = 0
    edges_dropped: List[Dict[str, str]] = field(default_factory=list)


def load_extracted(extracted_dir: Path) -> List[Dict[str, Any]]:
    nodes: List[Dict[str, Any]] = []
    if not extracted_dir.exists():
        return nodes
    for path in sorted(extracted_dir.rglob("*.json")):
        if path.name.startswith("_"):
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"  ⚠ 跳过无法解析的文件 {path.name}：{exc}")
            continue
        node = data.get("node")
        if not isinstance(node, dict):
            # 也接受「直接就是节点」的写法，方便人工手写的补充节点
            node = data if str(data.get("id", "")).startswith("person_") else None
        if node and node.get("id"):
            node.setdefault("_source", path.name)
            nodes.append(node)
    return nodes


def load_existing(shards_dir: Path) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    if not shards_dir.exists():
        return nodes, edges
    for path in sorted(shards_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        nodes.extend(data.get("nodes") or [])
        edges.extend(data.get("edges") or [])
    return nodes, edges


def dedupe_nodes(nodes: Sequence[Dict[str, Any]], stats: LoadStats) -> List[Dict[str, Any]]:
    """三级同一性判定，杜绝姓名模糊匹配。"""
    stats.nodes_raw = len(nodes)

    by_cbdb: Dict[int, Dict[str, Any]] = {}
    by_id: Dict[str, Dict[str, Any]] = {}
    by_name_dynasty: Dict[Tuple[str, str], Dict[str, Any]] = {}
    kept: List[Dict[str, Any]] = []

    for node in nodes:
        person_id = node.get("id")
        if not person_id:
            continue

        if person_id in by_id:
            stats.duplicates.append(f"{person_id}（id 相同，保留首见）")
            continue

        cbdb_id = node.get("cbdbId")
        if isinstance(cbdb_id, int) and cbdb_id in by_cbdb:
            survivor = by_cbdb[cbdb_id]
            stats.duplicates.append(f"{person_id} → 并入 {survivor['id']}（cbdbId {cbdb_id} 相同）")
            _merge_into(survivor, node)
            continue

        key = (str(node.get("name", "")).strip(), str(node.get("dynasty", "")))
        if key[0] and key in by_name_dynasty:
            survivor = by_name_dynasty[key]
            # 姓名相同且朝代相同 → 判为同一人，但记入报告待人工确认
            stats.duplicates.append(
                f"{person_id} → 并入 {survivor['id']}（姓名「{key[0]}」+ 朝代「{key[1]}」相同，建议人工复核）"
            )
            _merge_into(survivor, node)
            continue

        kept.append(node)
        by_id[person_id] = node
        if isinstance(cbdb_id, int):
            by_cbdb[cbdb_id] = node
        if key[0]:
            by_name_dynasty[key] = node

    stats.nodes_kept = len(kept)
    return kept


def _merge_into(survivor: Dict[str, Any], duplicate: Dict[str, Any]) -> None:
    """把重复节点的有效信息并入存活节点：只补空缺，不覆盖已有考据。"""
    for key, value in duplicate.items():
        if key.startswith("_"):
            continue
        if key not in survivor or survivor[key] in (None, "", [], {}):
            survivor[key] = value
            continue
        if isinstance(value, list) and isinstance(survivor.get(key), list):
            merged = survivor[key] + [v for v in value if v not in survivor[key]]
            survivor[key] = merged


# =============================================================================
# 三、关系边
# =============================================================================

def build_person_map(nodes: Sequence[Dict[str, Any]]) -> Dict[str, str]:
    """cbdbId → person_id，用于把 CBDB 关系边挂到已入库的节点上。"""
    mapping: Dict[str, str] = {}
    for node in nodes:
        cbdb_id = node.get("cbdbId")
        if isinstance(cbdb_id, int):
            mapping[str(cbdb_id)] = node["id"]
    return mapping


def normalize_edges(
    edges: Sequence[Dict[str, Any]],
    nodes: Sequence[Dict[str, Any]],
    person_map: Dict[str, str],
    stats: LoadStats,
) -> List[Dict[str, Any]]:
    """把各来源的关系边规范成前端契约格式；不满足考据要求的直接剔除并记账。"""
    valid_ids = {n["id"] for n in nodes}
    by_id = {n["id"]: n for n in nodes}
    stats.edges_raw = len(edges)

    result: List[Dict[str, Any]] = []
    seen: set = set()

    for index, edge in enumerate(edges):
        source = str(edge.get("source", ""))
        target = str(edge.get("target", ""))
        if source.startswith("cbdb:"):
            source = person_map.get(source.split(":", 1)[1], "")
        if target.startswith("cbdb:"):
            target = person_map.get(target.split(":", 1)[1], "")

        if not source or not target or source not in valid_ids or target not in valid_ids:
            stats.edges_dropped.append({"reason": "端点不存在或无法对齐", "source": edge.get("source", ""), "target": edge.get("target", "")})
            continue
        if source == target:
            stats.edges_dropped.append({"reason": "自环边", "source": source, "target": target})
            continue

        citation = edge.get("keyCitation")
        if not isinstance(citation, dict) or not str(citation.get("originalText", "")).strip():
            # 零幻觉：没有原文依据的关系不能入图。CBDB 只给了"谁认识谁"，没给证据。
            stats.edges_dropped.append({"reason": "缺少原文依据（keyCitation）", "source": source, "target": target})
            continue

        category = edge.get("primaryCategory") or edge.get("category")
        if category not in RELATION_CATEGORIES:
            stats.edges_dropped.append({"reason": f"关系大类非法：{category}", "source": source, "target": target})
            continue

        label = str(edge.get("specificLabel") or edge.get("label") or "关联")[:8]
        edge_id = str(edge.get("id") or f"edge_{_short_hash(source + target + category)}")
        if edge_id in seen:
            continue
        seen.add(edge_id)

        item: Dict[str, Any] = {
            "id": edge_id,
            "source": source,
            "target": target,
            "primaryCategory": category,
            "specificLabel": label,
            "directed": bool(edge.get("directed", category in ("kinship_blood", "monarch_subject", "mentor_disciple"))),
            "strength": int(edge.get("strength") or 5),
            "overallSummary": edge.get("overallSummary") or "",
            "keyCitation": _normalize_citation(citation),
        }
        item["strength"] = max(1, min(10, item["strength"]))
        for key in ("startYear", "endYear"):
            if isinstance(edge.get(key), int):
                item[key] = edge[key]
        if edge.get("temporalPhases"):
            item["temporalPhases"] = edge["temporalPhases"]

        # 关系说明为空时，用「甲与乙」的朴素描述兜底，避免前端详情页空白
        if not item["overallSummary"]:
            a, b = by_id[source].get("name", source), by_id[target].get("name", target)
            item["overallSummary"] = f"{a}与{b}的「{label}」关系，详见所附史料。"
        result.append(item)

    stats.edges_kept = len(result)
    return result


def _normalize_citation(citation: Dict[str, Any]) -> Dict[str, Any]:
    item = {
        "id": citation.get("id") or f"cite_{_short_hash(str(citation.get('originalText', '')))}",
        "bookTitle": citation.get("bookTitle") or "",
        "volumeAndChapter": citation.get("volumeAndChapter") or "",
        "originalText": citation.get("originalText") or "",
        "modernTranslation": citation.get("modernTranslation") or "",
        "reliability": citation.get("reliability") or "official_history_primary",
    }
    for key in ("authorOrCommentator", "historiographicalNote", "wikisourceUrl"):
        if citation.get(key):
            item[key] = citation[key]
    return item


def load_relations(relations_dir: Path) -> List[Dict[str, Any]]:
    edges: List[Dict[str, Any]] = []
    if not relations_dir.exists():
        return edges
    for path in sorted(relations_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        edges.extend(data.get("relations") or data.get("edges") or [])
    return edges


def _short_hash(text: str) -> str:
    import hashlib
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]


# =============================================================================
# 四、图中心度 → importanceWeight
# =============================================================================

def compute_centrality(nodes: Sequence[Dict[str, Any]], edges: Sequence[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
    """返回 {person_id: {"pagerank": x, "degree": y}}。"""
    person_ids = [n["id"] for n in nodes]
    if _HAS_NETWORKX:
        graph = nx.Graph()
        graph.add_nodes_from(person_ids)
        for edge in edges:
            graph.add_edge(edge["source"], edge["target"], weight=max(1, edge.get("strength", 5)))
        pagerank = nx.pagerank(graph, alpha=0.85, weight="weight", max_iter=200)
        degree = {pid: float(graph.degree(pid)) for pid in person_ids}
        return {pid: {"pagerank": float(pagerank.get(pid, 0.0)), "degree": degree.get(pid, 0.0)} for pid in person_ids}

    # 无 networkx 时的等价实现：带权幂迭代，与 nx.pagerank(weight="weight") 同构
    neighbours: Dict[str, List[Tuple[str, float]]] = {pid: [] for pid in person_ids}
    for edge in edges:
        weight = float(max(1, edge.get("strength", 5)))
        neighbours[edge["source"]].append((edge["target"], weight))
        neighbours[edge["target"]].append((edge["source"], weight))

    total_weight: Dict[str, float] = {
        pid: sum(w for _, w in links) for pid, links in neighbours.items()
    }
    count = len(person_ids) or 1
    scores = {pid: 1.0 / count for pid in person_ids}
    for _ in range(100):
        dangling = sum(scores[pid] for pid in person_ids if not neighbours[pid])
        updated: Dict[str, float] = {}
        for pid in person_ids:
            incoming = 0.0
            for nbr, weight in neighbours[pid]:
                if total_weight[nbr] > 0:
                    incoming += scores[nbr] * weight / total_weight[nbr]
            updated[pid] = (1 - 0.85) / count + 0.85 * (incoming + dangling / count)
        scores = updated
    return {pid: {"pagerank": scores[pid], "degree": float(len(neighbours[pid]))} for pid in person_ids}


def assign_weights(
    nodes: List[Dict[str, Any]],
    edges: Sequence[Dict[str, Any]],
    preserve_existing: bool = True,
) -> Dict[str, int]:
    """把中心度归一化为 1~100 的 importanceWeight，并就地写回节点。

    ``preserve_existing`` 为真时，已有权重的人工考据节点保持原值——种子库里
    曹操 100、刘邦 98 这类判断来自史学阅读，不是图算法能算出来的；只有新入库
    的节点才用中心度赋值。要整体重算请加 --recompute-all-weights。
    """
    centrality = compute_centrality(nodes, edges)

    def normalize(values: Dict[str, float]) -> Dict[str, float]:
        if not values:
            return {}
        low, high = min(values.values()), max(values.values())
        if math.isclose(high, low):
            return {k: 1.0 for k in values}
        return {k: (v - low) / (high - low) for k, v in values.items()}

    pr_norm = normalize({pid: c["pagerank"] for pid, c in centrality.items()})
    deg_norm = normalize({pid: c["degree"] for pid, c in centrality.items()})

    weights: Dict[str, int] = {}
    preserved = 0
    for node in nodes:
        pid = node["id"]
        existing = node.get("importanceWeight")
        if preserve_existing and isinstance(existing, int) and 1 <= existing <= 100:
            weights[pid] = existing
            preserved += 1
            continue
        blended = 0.6 * pr_norm.get(pid, 0.0) + 0.4 * deg_norm.get(pid, 0.0)
        weight = int(round(1 + 99 * blended))
        # 孤立节点（无任何关系边）保留最低可视权重，避免在画布上彻底消失
        if not deg_norm.get(pid):
            weight = max(8, min(weight, 20))
        node["importanceWeight"] = max(1, min(100, weight))
        weights[pid] = node["importanceWeight"]
    if preserve_existing and preserved:
        print(f"  保留人工考据权重 {preserved} 人，新计算 {len(nodes) - preserved} 人")
    return weights


# =============================================================================
# 五、分片打包
# =============================================================================

def pack_shards(nodes: Sequence[Dict[str, Any]], edges: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """按朝代分组打包，未归组的一律并入最接近的时代组。"""
    buckets: Dict[str, List[Dict[str, Any]]] = {g.shard_id: [] for g in SHARD_GROUPS}
    ungrouped: List[Dict[str, Any]] = []

    for node in nodes:
        group = GROUP_BY_DYNASTY.get(str(node.get("dynasty")))
        if group is None:
            ungrouped.append(node)
            continue
        buckets[group.shard_id].append(node)

    if ungrouped:
        # 按生年落位；都落不进去就进先秦组，并在报告中列出
        for node in ungrouped:
            year = node.get("birthYear") or node.get("deathYear") or -1000
            target = next((g for g in SHARD_GROUPS if g.year_range[0] <= year <= g.year_range[1]), SHARD_GROUPS[0])
            buckets[target.shard_id].append(node)
            print(f"  ⚠ {node['id']}（{node.get('name')}）朝代 {node.get('dynasty')} 未登记，按生年归入 {target.shard_id}")

    node_to_shard = {n["id"]: sid for sid, group in buckets.items() for n in group}
    edges_by_shard: Dict[str, List[Dict[str, Any]]] = {g.shard_id: [] for g in SHARD_GROUPS}
    cross_shard: List[str] = []
    for edge in edges:
        shard_id = node_to_shard.get(edge["source"])
        if not shard_id:
            continue
        # 跨分片的边挂在源节点所属分片：前端 mergeShards 合并后即可解析对端；
        # 若只加载单个分片，画布对缺失端点有 `if (!a || !b) continue` 的容错。
        edges_by_shard[shard_id].append(edge)
        if node_to_shard.get(edge["target"]) != shard_id:
            cross_shard.append(edge["id"])

    shards: List[Dict[str, Any]] = []
    for group in SHARD_GROUPS:
        shard_nodes = buckets[group.shard_id]
        if not shard_nodes:
            continue
        heroes = sorted(shard_nodes, key=lambda n: -int(n.get("importanceWeight", 0)))[:6]
        shards.append({
            "shardId": group.shard_id,
            "title": group.title,
            "subtitle": group.subtitle,
            "dynasties": list(group.dynasties),
            "yearRange": list(group.year_range),
            "heroPersonIds": [h["id"] for h in heroes],
            "nodes": sorted(shard_nodes, key=lambda n: -int(n.get("importanceWeight", 0))),
            "edges": edges_by_shard[group.shard_id],
        })
    if cross_shard:
        print(f"  跨分片关系 {len(cross_shard)} 条（合并视图下正常呈现，单分片下自动跳过）")
    return shards


def build_manifest(shards: Sequence[Dict[str, Any]], byte_sizes: Dict[str, int]) -> Dict[str, Any]:
    """生成与前端 `GraphManifest` 契约一致的清单。"""
    total_persons = sum(len(s["nodes"]) for s in shards)
    total_edges = sum(len(s["edges"]) for s in shards)
    total_anecdotes = sum(len(n.get("anecdotes") or []) for s in shards for n in s["nodes"])
    total_citations = 0
    for shard in shards:
        for node in shard["nodes"]:
            total_citations += len(node.get("primarySources") or [])
            total_citations += sum(1 for e in node.get("lifeTimeline") or [] if e.get("citation"))
            total_citations += sum(1 for a in node.get("anecdotes") or [] if a.get("primaryCitation"))

    search_index: List[Dict[str, Any]] = []
    for shard in shards:
        for node in shard["nodes"]:
            aliases = node.get("aliases") or {}
            alias_parts = [
                aliases.get("courtesyName"),
                *(aliases.get("pseudonyms") or []),
                aliases.get("posthumousTitle"),
                aliases.get("templeName"),
                *(aliases.get("eraNames") or []),
                *(aliases.get("feudalTitles") or []),
                *(node.get("roles") or []),
            ]
            search_index.append({
                "id": node["id"],
                "name": node.get("name", ""),
                "aliasText": " ".join(str(p) for p in alias_parts if p),
                "dynasty": node.get("dynasty", ""),
                "shardId": shard["shardId"],
                "importanceWeight": node.get("importanceWeight", 1),
            })
    search_index.sort(key=lambda x: -x["importanceWeight"])

    present = {s["shardId"] for s in shards}
    dynasty_meta: List[Dict[str, Any]] = []
    for meta in DYNASTIES:
        group = GROUP_BY_DYNASTY.get(meta["id"])
        shard_file = f"{group.shard_id}.json" if group and group.shard_id in present else ""
        dynasty_meta.append({**meta, "shardFile": shard_file})

    return {
        "schemaVersion": "1.0.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "site": {
            "title": "华夏史网",
            "subtitle": "ChronoGraph China · 二十四史人物关系图谱与史料对勘引擎",
            "edition": f"ETL 扩充数据 · {len(shards)} 时代分片",
        },
        "stats": {
            "personCount": total_persons,
            "edgeCount": total_edges,
            "anecdoteCount": total_anecdotes,
            "citationCount": total_citations,
            "dynastyCount": len({d for s in shards for d in s["dynasties"]}),
            "shardCount": len(shards),
        },
        "dynasties": dynasty_meta,
        "shards": [
            {
                "shardId": s["shardId"],
                "file": f"{s['shardId']}.json",
                "title": s["title"],
                "subtitle": s["subtitle"],
                "dynasties": s["dynasties"],
                "yearRange": s["yearRange"],
                "personCount": len(s["nodes"]),
                "edgeCount": len(s["edges"]),
                "byteSize": byte_sizes.get(s["shardId"], 0),
            }
            for s in shards
        ],
        "searchIndex": search_index,
        "highlights": [
            {"label": "在册人物", "value": str(total_persons), "note": "全部经正史本传核验"},
            {"label": "关系边", "value": str(total_edges), "note": "每条均附文言原文为证"},
            {"label": "奇闻轶事", "value": str(total_anecdotes), "note": "含注疏与笔记分级"},
            {"label": "史源引文", "value": str(total_citations), "note": "文白对照，可溯源"},
        ],
        "plannedShards": [
            {"shardId": g.shard_id, "title": g.title, "status": "planned"}
            for g in SHARD_GROUPS if g.shard_id not in present
        ],
    }


# =============================================================================
# 六、主流程
# =============================================================================

def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="实体消歧 · 图中心度计算 · 静态分片打包器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--extracted", type=Path, default=Path("../build/extracted"), help="LLM 抽取结果目录")
    parser.add_argument("--relations", type=Path, default=Path("../build/intermediate"), help="关系边目录（CBDB 等）")
    parser.add_argument("--existing", type=Path, default=Path("../../public/data/shards"), help="既有分片目录（--merge-existing 时读入）")
    parser.add_argument("--merge-existing", action="store_true", help="并入 public/data 已有分片，做增量扩充")
    parser.add_argument("--out", type=Path, default=Path("../../public/data"), help="输出目录（含 shards/ 与 manifest.json）")
    parser.add_argument("--dry-run", action="store_true", help="写到 build/out，不改动 public/data")
    parser.add_argument("--render-portraits", action="store_true", help="打包后调用 Node 侧渲染冠服 SVG 肖像")
    parser.add_argument("--recompute-all-weights", action="store_true", help="无视已有权重，全部按中心度重算")
    parser.add_argument("--skip-validate", action="store_true", help="跳过落盘前的契约校验（不推荐）")
    args = parser.parse_args(argv)

    stats = LoadStats()
    print("◈ 分片打包")
    print(f"  抽取结果 {args.extracted.resolve()}")
    print(f"  关系输入 {args.relations.resolve()}")
    if args.merge_existing:
        print(f"  并入既有 {args.existing.resolve()}")

    # —— 1. 载入
    nodes = load_extracted(args.extracted)
    stats.files = len(list(args.extracted.rglob("*.json"))) if args.extracted.exists() else 0
    if args.merge_existing:
        existing_nodes, existing_edges = load_existing(args.existing)
        nodes = existing_nodes + nodes
        print(f"  已有节点 {len(existing_nodes)} · 新抽取 {stats.files} 个文件")
    else:
        existing_edges = []

    if not nodes:
        print("✖ 没有可打包的节点。请先运行 llm_extractor.py，或加 --merge-existing 沿用既有分片")
        return 2

    nodes = [{k: v for k, v in node.items() if not k.startswith("_")} for node in nodes]
    nodes = dedupe_nodes(nodes, stats)
    if stats.duplicates:
        print(f"  消歧合并 {len(stats.duplicates)} 处重复")

    # —— 2. 关系边
    relation_edges = load_relations(args.relations)
    person_map = build_person_map(nodes)
    edges = normalize_edges(existing_edges + relation_edges, nodes, person_map, stats)
    print(f"  关系边 输入 {stats.edges_raw} · 入库 {stats.edges_kept} · 剔除 {len(stats.edges_dropped)}")

    # —— 3. 权重
    assign_weights(nodes, edges, preserve_existing=not args.recompute_all_weights)
    top = sorted(nodes, key=lambda n: -n["importanceWeight"])[:5]
    print("  权重前五：" + "、".join(f"{n.get('name')}({n['importanceWeight']})" for n in top))

    # —— 4. 打包
    shards = pack_shards(nodes, edges)
    if not shards:
        print("✖ 分组后没有任何分片")
        return 2

    # —— 5. 落盘前校验
    problems: List[Dict[str, Any]] = []
    if not args.skip_validate:
        for shard in shards:
            problems.extend(dict(issue) for issue in validate_shard(shard, shard["shardId"]))
        # 供前端消费的节点必须能通过完整契约；这里汇总而非逐条打印
        if problems:
            print(f"\n✖ 契约校验失败 {len(problems)} 项（前 20 项）：")
            for issue in problems[:20]:
                print(f"   - [{issue['where']}] {issue['message']}")
            print("\n  说明：LLM 抽取结果常有缺项（如年表不足 3 条、缺籍贯）。")
            print("        请补齐后重跑，或加 --skip-validate 先出一版草稿分片。")
            return 1

    # —— 6. 写出
    out_dir = Path("../build/out") if args.dry_run else args.out
    shards_dir = out_dir / "shards"
    if shards_dir.exists():
        for old in shards_dir.glob("*.json"):
            old.unlink()
    shards_dir.mkdir(parents=True, exist_ok=True)

    byte_sizes: Dict[str, int] = {}
    for shard in shards:
        path = shards_dir / f"{shard['shardId']}.json"
        payload = json.dumps(shard, ensure_ascii=False, separators=(",", ":"))
        path.write_text(payload, encoding="utf-8")
        byte_sizes[shard["shardId"]] = len(payload.encode("utf-8"))
        print(f"  ✓ {path.name:<32} {len(shard['nodes']):>4} 人 / {len(shard['edges']):>4} 边 · {byte_sizes[shard['shardId']] / 1024:>7.1f} KB")

    manifest = build_manifest(shards, byte_sizes)
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    report_dir = Path("../build/reports")
    report_dir.mkdir(parents=True, exist_ok=True)
    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "inputs": {
            "extracted": str(args.extracted.resolve()),
            "relations": str(args.relations.resolve()),
            "mergeExisting": args.merge_existing,
        },
        "counts": {
            "nodesRaw": stats.nodes_raw,
            "nodesKept": stats.nodes_kept,
            "edgesRaw": stats.edges_raw,
            "edgesKept": stats.edges_kept,
            "shards": len(shards),
        },
        "duplicates": stats.duplicates,
        "edgesDropped": stats.edges_dropped,
        "shards": [
            {"shardId": s["shardId"], "persons": len(s["nodes"]), "edges": len(s["edges"]), "bytes": byte_sizes[s["shardId"]]}
            for s in shards
        ],
        "manifestStats": manifest["stats"],
    }
    (report_dir / "build_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n◈ 完成：{len(shards)} 分片 · {manifest['stats']['personCount']} 人 · {manifest['stats']['edgeCount']} 边")
    print(f"  输出 {out_dir.resolve()}")
    print(f"  报告 {report_dir.resolve()}/build_report.json")

    if stats.edges_dropped:
        reasons: Dict[str, int] = {}
        for item in stats.edges_dropped:
            reasons[item["reason"]] = reasons.get(item["reason"], 0) + 1
        print("  剔除原因：" + " · ".join(f"{k} {v}" for k, v in sorted(reasons.items(), key=lambda x: -x[1])))

    if args.render_portraits and not args.dry_run:
        script = Path("../../scripts/render-portraits.mjs").resolve()
        if script.exists():
            print("\n◈ 渲染冠服 SVG 肖像 …")
            try:
                subprocess.run(["node", str(script), "--data", str(out_dir.resolve())], check=True)
            except (subprocess.CalledProcessError, FileNotFoundError) as exc:
                print(f"  ⚠ 肖像渲染失败：{exc}（前端会退回纯文字节点）")
        else:
            print(f"\n  ⚠ 未找到 {script}，跳过肖像渲染")

    return 0


if __name__ == "__main__":
    sys.exit(main())
