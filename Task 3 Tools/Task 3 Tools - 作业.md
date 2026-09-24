## Task3 学习目标对照

| 目标 | 对应实验 | 是否完成 |
| --- | --- | --- |
| 理解工具在 Agent 中的作用 | 实验 4-2 感知工具 MCP | ✅ 本人运行 |
| 掌握感知工具 / 执行工具 / 协作工具的分类 | 实验 4-2 | ✅ |
| 至少跑通 1 个相关实验 | 实验 4-2 | ✅ |


## 实验 4-2：感知工具 MCP（本人运行）

### 运行说明

项目：`chapter4/perception-tools`  
运行时间：2026-09-22  
证据目录：`Task 3 Tools/实验4-2执行结果/perception-tools`  
依赖：`uv sync --locked --extra ch4`

运行内容：

```bash
python cli.py list                         # 列出全部感知工具
python cli.py demo --offline               # 离线端到端演示
python cli.py run weather location=Beijing # 公开数据源
python cli.py run currency_converter ...   # 公开数据源
python cli.py run arxiv_search ...         # 公开数据源
```

### 实验目的

理解**感知工具**在 Agent 中的作用：Agent 如何通过工具「看到」外部世界。对应本章三类工具中的「感知工具」。

### 实验结果

#### 1. 感知工具全景（54 个工具）

| 类别 | 数量 | 代表工具 | 是否需要 API Key |
| --- | ---: | --- | --- |
| 搜索 | 4 | web_search、knowledge_base_search | 大多免费 |
| 多模态理解 | 19 | webpage_reader、document_reader、image_ocr | 部分需模型 |
| 文件系统 | 3 | file_reader、grep、text_summarizer | 否 |
| 公开数据源 | 26 | weather、currency、arxiv、wiki、stock | 大多免费 |
| 私有数据源 | 2 | calendar_events、notion_search | 需授权 |

#### 2. 离线端到端演示

串联了 5 步感知流程：

1. **文件系统**：`grep` 命中 5 处 → `read_file` 精读
2. **搜索**：本地知识库检索命中 `mcp_notes.md`
3. **公开数据**：汇率换算（离线跳过）
4. **多模态**：网页正文（离线跳过）
5. **私有数据**：日历 / Notion 未授权时返回结构化失败信息

#### 3. 真实工具调用结果

| 工具 | 结果 | 关键输出 |
| --- | --- | --- |
| `weather location=Beijing` | ✅ 成功 | 温度 26.0°C，晴，Open-Meteo |
| `currency_converter 100 USD→CNY` | ✅ 成功 | 汇率 6.71，换算 671.0 |
| `arxiv_search "large language model agents"` | ✅ 成功 | 返回 3 篇论文 |
| `wikipedia_search` | ❌ 失败 | Wikipedia API 返回空 JSON（网络/解析问题） |

天气查询结果示例：

```json
{
  "success": true,
  "message": {
    "location": "Beijing",
    "temperature": 26.0,
    "description": "Clear sky",
    "provider": "Open-Meteo"
  },
  "metadata": {
    "api_key_required": false
  }
}
```

汇率换算结果示例：

```json
{
  "success": true,
  "message": {
    "amount": 100.0,
    "from_currency": "USD",
    "to_currency": "CNY",
    "exchange_rate": 6.71,
    "converted_amount": 671.0
  }
}
```

ArXiv 检索返回了 3 篇 LLM Agent 相关论文，包含标题、作者、摘要、PDF 链接。

### 三类工具分类（对应笔记）

| 类型 | 作用 | 代表 |
| --- | --- | --- |
| **感知工具** | 让 Agent「看到」外部世界 | 搜索、天气、汇率、文档读取 |
| **执行工具** | 让 Agent「改变」外部世界 | 代码执行、文件写入、API 调用 |
| **协作工具** | 让 Agent「联系」其他 Agent / 人 | 浏览器自动化、HITL、通知 |

本次实验 4-2 聚焦**感知工具**：只读、可缓存、可并行。

### 结论

1. **感知工具是 Agent 的「感官」**：让模型能看到本地文件、网络信息、公开数据、私有系统。
2. **感知工具是只读的**：不改变外部世界，相对安全、可缓存、可并行。
3. **多数公开数据源无需 API Key**：天气、汇率、ArXiv、股票等都是免费接口，降低了 Agent 接入外部世界的门槛。
4. **设计关键在粒度与输出信息量**：工具返回什么、返回多少，直接决定上下文质量。
5. **失败也要结构化返回**：Wikipedia 调用失败时返回 `success: false` + 错误类型，Agent 能据此决策，而不是只看到一个崩溃。

### 一句话总结

> 感知工具让 Agent 从「只会聊天」变成「能看世界」；工具定义越清晰、输出信息量越可控，Agent 的上下文质量就越高。
