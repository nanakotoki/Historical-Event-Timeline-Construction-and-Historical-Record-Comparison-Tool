# 华夏史网 · 二十四史 ETL 扩充套件

> 从「三个高密度种子分片」走向「二十四史万人级图谱」的数据工程管线。

本目录是一套**可直接运行的 Python 工具链**，负责把维基文库的正史原文与哈佛 CBDB 的
人物关系数据，加工成前端可直接消费的静态 JSON 分片。

管线存在的唯一理由是：**在不牺牲史实准确性的前提下扩大规模**。
因此整条链路的重心不在「让模型多写点」，而在「让模型写的每一句都能被原文证伪」。

---

## 一、管线总览

```
                    ┌──────────────────────────┐
    哈佛 CBDB       │  cbdb_connector.py       │  人物主表 / 别名 / 亲属 / 社会关系
    SQLite dump ───►│  · 实体合并（c_personid） │──► build/intermediate/cbdb_<dynasty>.json
                    │  · 关系语义映射           │        （仅有"谁认识谁"，无原文）
                    └──────────────────────────┘
                                  │
                                  │  仅作「关系候选」，无原文依据者不得入图
                                  ▼
                    ┌──────────────────────────┐
    维基文库        │  wikisource_24histories  │  二十四史列传正文 → Markdown
    MediaWiki API ─►│  · 按前缀枚举全部卷帙     │──► build/raw/24histories/<book>/<卷>.md
                    │  · wikitext 清洗 + 分篇   │
                    └──────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │  llm_extractor.py        │  结构化抽取 + 反幻觉核验
                    │  ┌────────────────────┐  │
                    │  │ verify_quote_in_   │  │  引文不是原文子串 → 打回重抽
                    │  │ source()           │  │  → 仍不合格 → build/review/ 待人工复核
                    │  └────────────────────┘  │
                    └──────────────────────────┘
                                  │
                                  ▼  build/extracted/<卷>.json（引文已核验）
                    ┌──────────────────────────┐
                    │  build_shards.py         │  实体消歧 / PageRank / 契约校验 / 打包
                    └──────────────────────────┘
                                  │
                                  ▼  public/data/shards/*.json + manifest.json
                    ┌──────────────────────────┐
                    │  render-portraits.mjs    │  复用 TS 冠服像生成器补齐 L3/L4 肖像
                    └──────────────────────────┘
                                  │
                                  ▼
                         前端 Canvas 图谱直接渲染
```

---

## 二、目录与产物

```
scripts/etl/
├── schema_validator.py       # 数据契约（Pydantic）+ 原文子串核验器
├── cbdb_connector.py         # CBDB SQLite / REST 抽取
├── wikisource_24histories.py # 维基文库二十四史抓取与解析
├── llm_extractor.py          # LLM 结构化抽取（含反幻觉打回闭环）
├── build_shards.py           # 实体消歧 · 中心度 · 分片打包
├── requirements.txt
└── README.md                 # 本文件

build/                        # 中间产物（不入库）
├── raw/wikisource/           # MediaWiki 原始响应缓存（可离线重解析）
├── raw/24histories/          # 清洗后的 Markdown
├── intermediate/             # CBDB 中间态
├── extracted/                # 已通过引文核验的人物节点
├── review/                   # 引文未通过、待人工复核（绝不进入分片）
├── out/                      # --dry-run 的试跑产物
└── reports/build_report.json # 每次打包的完整审计记录

public/data/                  # 前端消费的最终产物
├── manifest.json
├── shards/*.json
└── portraits/*.svg
```

---

## 三、安装

```bash
cd scripts/etl

# 最小依赖：仅校验与打包（无 pydantic 时会降级为等价的结构校验）
pip install pydantic

# 完整依赖：图算法 + 繁简转换 + 更友好的 HTTP
pip install -r requirements.txt

# 可选：CBDB 数据库（约 300 MB 解压后）
#   https://projects.iq.harvard.edu/cbdb/cbdb-downloads
export CBDB_SQLITE_PATH=/path/to/cbdb_20240401.sqlite3
```

所有脚本均可从本目录直接运行，也可作为模块导入：

```python
from schema_validator import verify_quote_in_source, ShardDataset
from llm_extractor import extract_one
```

---

## 四、四个脚本

### 1. `schema_validator.py` —— 契约与核验的地基

```bash
# 校验已发布的分片是否满足 TS 侧契约（Pydantic extra="forbid"，能发现字段漂移）
python schema_validator.py --data ../../public/data

# 以维基文库语料为基准，逐条回核所有引文
python schema_validator.py --data ../../public/data --corpus ../build/raw --simplify

# 单条核验（调试用）
python schema_validator.py --quote "先帝创业未半而中道崩殂" --source-file ../build/raw/xxx.md
```

**`verify_quote_in_source(quote, source_text, threshold=0.90)` 的判定逻辑**

| 方式 | 含义 | 结果 |
| --- | --- | --- |
| `exact` | 原样子串命中 | 通过 |
| `normalized` | 剥除全部标点/空白/全半角差异后子串命中 | 通过 |
| `windows` | 引文含显式省略号「……」时，每一段都必须是原文子串，覆盖率 ≥ 阈值 | 通过 |
| `not_found` | 以上皆不成立 | **打回** |

这里刻意**没有**「相似度够高就放行」的后门。原因是：把真句抄一遍、再续上自己编的
半句（`「諸葛亮字孔明，琅邪陽都人也」` + `「，少有大志」`），最长公共片段照样能覆盖
七成以上；若按相似度放行，等于承认了半句伪造。判定标准只有一条——**必须是原文的连续子串**。

`--simplify` 用于处理繁简差异：本站正文为简体、维基文库为繁体，不转换会产生大量
假阴性（把真引文判成假的）。装了 `opencc` 才生效，不会静默放宽判定。

### 2. `cbdb_connector.py` —— 人物与关系的骨架

```bash
python cbdb_connector.py --check                       # 探查库结构与朝代分布
python cbdb_connector.py --dynasty tang --limit 500    # 抽取唐代 500 人
python cbdb_connector.py --dynasty three_kingdoms --min-index-year 180 --max-index-year 280
```

读取 `BIOG_MAIN` / `ALTNAME_DATA` / `KIN_DATA` / `ASSOC_DATA` / `BIOG_ADDR_DATA` /
`ADDRESSES` / `POSTED_TO_OFFICE_DATA` / `DYNASTIES`，产出中间态 JSON。

* **实体合并靠 `c_personid`**，不做姓名匹配；
* **关系语义映射**把 CBDB 的中文关系描述翻成 8 类 `RelationCategory`（师承 / 举荐 /
  政敌 / 沙场交锋 / 上下统属 / 君臣 / 诗酒之交 / 姻亲），规则表在 `ASSOC_RULES`、
  `KIN_RULES`，可直接改；
* **只产出「关系候选」**：CBDB 告诉你「甲认识乙」，但没有原文依据，所以这些边在
  `build_shards.py` 里会因为缺 `keyCitation` 被拒绝入图（会进报告，不会静默消失）。

### 3. `wikisource_24histories.py` —— 原文来源

```bash
python wikisource_24histories.py --list                 # 二十四史书目 + 站内卷数
python wikisource_24histories.py --books sanguozhi      # 抓《三国志》全部卷
python wikisource_24histories.py --books sanguozhi --volumes 35,36
python wikisource_24histories.py --books sanguozhi --person 諸葛亮
python wikisource_24histories.py --books sanguozhi --offline   # 只用缓存重解析
```

* 内置二十四史书目（繁体根页面 + 朝代映射），按 `list=allpages&apprefix=` 枚举卷帙，
  不必手工维护目录；
* `wikitext_to_markdown()` 递归剥除 `{{模板}}`（含 `{{YL|建安十三年}}` 这类纪年模板，
  替换为裸纪年）、`<ref>` 注疏、`[[File:]]`、表格与分类，保留标题层级；
* 响应缓存在 `build/raw/wikisource/`，改了解析规则可 `--offline` 重跑而不重新抓取；
* 默认 0.4 s 请求间隔，遵守 Wikimedia API 礼仪。

> 首次抓取《三国志》约 65 卷、数分钟。**请在有网环境执行**；沙箱/内网环境若
> SSL 握手被拦，脚本会明确报错而不是产出空文件。

### 4. `llm_extractor.py` —— 抽取与打回

```bash
python llm_extractor.py --self-test                     # 不联网，验证反幻觉防线
python llm_extractor.py --input ../build/raw/24histories/sanguozhi --dry-run
python llm_extractor.py --input ../build/raw/24histories/sanguozhi \
    --book 三國志 --provider openai --jobs 4
```

**打回闭环**：每轮抽取后逐条核验；未通过的引文，会把「模型自己写的句子」与「原文中
最接近的真实片段」并排塞回提示词，要求照抄或删除。最多 `--max-retries` 轮；仍不合格
则整篇落入 `build/review/`，**不会进入 `public/data`**。

* 支持 OpenAI（含 Azure / DeepSeek / vLLM 等兼容端点，走 `response_format: json_schema`）
  与 Anthropic（走强制 `tool_use`）；
* `--self-test` 用受控假输出验证五类判定：逐字引用、跨断句、注疏插入、改写史实、
  演义情节。它会真实地暴露防线漏洞——这是本项目当初收紧判定规则的直接原因；
* 环境变量：`OPENAI_API_KEY` / `OPENAI_BASE_URL` / `ANTHROPIC_API_KEY` / `CHRONO_LLM_MODEL`。

### 5. `build_shards.py` —— 消歧、定权重、打包

```bash
python build_shards.py --dry-run                        # 试跑到 build/out
python build_shards.py --merge-existing                 # 在种子库基础上增量扩充
python build_shards.py --recompute-all-weights           # 全部按图算法重算权重
python build_shards.py --render-portraits                # 打包后补肖像
```

**实体消歧只承认三种证据**，优先级严格递减：

1. 相同 `cbdbId`（权威主键）
2. 相同 `id`（跨源已对齐）
3. 姓名 + 朝代完全相同（仅前两者缺失时启用，且写入报告待复核）

**绝不做姓名模糊匹配**——「李密」「张衡」「王粲」在史书上各有多人，模糊匹配会把
不同的人静默合并，是史实污染的重灾区。

**权重**：PageRank（0.6）+ 度中心性（0.4），各自极差归一后映射到 1~100。
默认**保留人工考据权重**，只给新节点计算——种子库里「曹操 100、刘邦 98」这类判断
来自史学阅读，不是图算法能算出来的。加 `--recompute-all-weights` 才整体重算。

**落盘前校验**：调用 `schema_validator`，任一硬性错误即中止，绝不产出半成品分片。

---

## 五、两条数据链路的关系

| | 链路 A：种子库 | 链路 B：ETL 扩充 |
| --- | --- | --- |
| 源 | `src/data/**/*.ts` 强类型手写考据 | 维基文库 + CBDB + LLM |
| 命令 | `npm run seed:build` | 本目录四个脚本 |
| 校验 | 编译期校验 + `npm run seed:validate` | `schema_validator.py` |
| 适用 | 首发高密度分片（内容可逐字校订） | 万人级扩展（覆盖广度优先） |
| 画像 | 编译期生成 | `render-portraits.mjs` 复用同一套 TS 生成器 |

两条链路产出**同一份契约**，因此可以混用：用链路 B 扩充，用 `--merge-existing`
并入现有分片，前端无需任何改动。

---

## 六、质量门槛（建议在 CI 中执行）

```bash
# 1) 契约与字段漂移
python schema_validator.py --data ../../public/data

# 2) 引文逐条回核（需先抓取语料）
python schema_validator.py --data ../../public/data --corpus ../build/raw --simplify

# 3) 反幻觉防线自检
python llm_extractor.py --self-test

# 4) 前端侧独立审计（配额、内容丰满度、悬空引用、画像落盘）
cd ../.. && npm run seed:validate

# 5) 编译
npm run typecheck && npm run build
```

第四条与第一条**互不替代**：Pydantic 管结构，`validate-seed.mjs` 管内容丰满度与
配额红线（人数、边数、人均年表条数等）。

---

## 七、常见问题

**Q：没有 CBDB 数据库能跑吗？**
能。`cbdb_connector.py` 只负责关系骨架；人物与引文完全可以只走维基文库 +
`llm_extractor.py`，只是关系边需要另找依据。

**Q：没有 API Key 能跑吗？**
能跑 `--self-test` 与 `--dry-run`。正式抽取需要 Key；`--dry-run` 会生成完整提示词，
便于人工检查提示是否得当后再花钱。

**Q：为什么我的引文全被判为「未命中」？**
多半是繁简差异。加 `--simplify`（需 `opencc`），或先用 `--offline` 重解析确认语料本身完整。

**Q：`build_shards.py` 报契约校验失败怎么办？**
LLM 输出常有缺项（年表不足 3 条、缺籍贯坐标等）。脚本会列出具体位置；补齐后重跑。
急于出草稿可加 `--skip-validate`，但**不要**把草稿发布到 `public/data`。

**Q：新增朝代分片要改哪里？**
`build_shards.py` 的 `SHARD_GROUPS`（分片分组）与 `DYNASTIES`（朝代元数据）。
后者必须与 `src/data/dynasties.ts` 同步——两边都有注释互相提醒。

**Q：为什么 CBDB 的关系一条都进不来？**
因为 CBDB 只提供「关系事实」，不提供「原文证据」。这是设计使然：宁可少一条边，
也不让没有出处的连线出现在图谱上。补上该关系的正史原文后（写入 `keyCitation`），
`build_shards.py` 就会收下。

---

## 八、数据来源与合规

* 正文来源：**维基文库**（zh.wikisource.org），文本为公有领域；引用时保留页面链接
  以便追溯修订历史。
* 人物与关系：**CBDB（China Biographical Database）**，哈佛大学主持，学术使用免费，
  使用时请遵循其 citation 要求。
* 画像：本套件不下载任何第三方图片。L1/L2 需自行接入公版图源（Wikimedia Commons
  等）并填写 `sourceAttribution`；未接入时一律标注为 L3 复原像，**不得伪称真迹**。
* 地图：前端只绘制经纬度散点与经纬网，**不绘制任何国界、省界与海岸线**。
