### 对于Agent的理解是什么？
Agent = LLM（大语言模型，Large Language Model）+ 上下文 + 工具
![](assert/Task%200%20基础与环境%20-%20笔记/file-20260914184542095.png)

比较好的一句话：在底层模型固定时，提升 Agent 任务表现最主要的系统工程手段，往往就是重新定义或扩展观察空间与动作空间。用本书的术语说，就是扩展上下文和工具。许多看似需要“更聪明模型”的问题，其实只是接口问题：**把任务所需的数据纳入上下文，或把完成任务所需的操作封装成工具，原本不可解的任务就可能变得可解。**

### Agent中工具是如何分类的？
![](assert/Task%200%20基础与环境%20-%20笔记/file-20260914185457796.png)
**感知工具**让 Agent 能访问信息：搜索引擎提供实时网络数据，文件系统读取本地文档，API 和数据库则对接外部服务和企业核心数据。
**执行工具**让 Agent 改变世界：代码执行、文件操作、系统命令、外部 API 调用——决策由此变成实际行动。
**协作工具**让 Agent 与其他 Agent 分工合作：委托子 Agent 完成专项任务，在关键决策点请求人类确认，或在多 Agent 系统中协调行动。
**事件触发工具**与前三类在调用方式上有本质的区别——它们不是 Agent 主动调用的，而是作为外部输入来驱动 Agent 开始执行任务。比如收到一封新邮件、到了某个预定时间点、或另一个系统发出了 Webhook 回调，这些事件会激活 Agent，让它开始后续的思考和行动。事件适配器同样是 Environment 向 Agent 提供观察的通道，因此本书把它归入广义的工具体系。
**用户沟通工具**是 Agent 主动与用户建立连接、传递信息的渠道。与执行工具改变外部世界不同，用户沟通工具专注于信息的传递和交互——通过文字消息、语音通话、邮件等方式，将 Agent 的执行进展或主动关怀传达给用户。

工具设计的质量直接决定了 Agent 能走多远——接口定义不清晰，模型就会乱用工具；错误处理不到位，工具一旦调用失败，Agent 就可能陷入死锁；权限控制太宽泛，Agent 一旦出错，后果就难以挽回。MCP（Model Context Protocol，模型上下文协议）标准的推广，正在让工具接入变得更容易。

工具设计的核心原则是：**通用基础能力用于组合与探索；专用工具用于约束高风险和强业务规则操作**。


### 什么是Function Calling
![](assert/Task%200%20基础与环境%20-%20笔记/file-20260914190132569.png)
工具调用（Tool Calling，也称 Function Calling）是现代 LLM Agent 的一项核心能力，它让模型能够通过结构化的方式调用外部工具。这种能力将 LLM 从一个纯粹的文本生成器转变为能够执行实际操作的智能系统。本书后续统一使用“工具调用”这一术语。

工具调用的流程分为四步：
首先，在上下文里告诉模型有哪些工具可用（包括名称、用途和参数）；
然后，模型自主判断要不要调用工具、调用哪个、传什么参数；
接着，工具执行完毕后，结果被追加到上下文中；
最后，模型据此决定下一步行动。

> [!note]- 思考：MCP和本地function call的区别
> ```
>                      ┌─────────────────────────────┐
> 本地 function 定义 ──>│                             │
>                      │   合并成统一 tools 清单       │──> 模型API ──> 模型输出调用意图
> MCP tools/list ─────>│  (模型只看到这一份)           │
>    (转成tools格式)    └─────────────────────────────┘
>                                       ▲
>                                       │ 模型输出 tool_calls
>                                       ▼
>                           ┌───────────────────────┐
>                           │  应用路由（按名字）     │
>                           └───────────────────────┘
>                              │                 │
>                     本地直接调用          走 MCP 协议
>                              ▼                 ▼
>                      read_local_file    get_gaode_weather
>                      (本进程执行)        (MCP Server 执行)
>                              │                 │
>                              └────结果回填──────┘
>                                       │
>                                       ▼
>                                  模型生成回答
> ```

### LLM使用的上下文由哪几部分组成?
![](assert/Task%200%20基础与环境%20-%20笔记/file-20260914215402830.png)
- **系统提示词**（System Prompt）：与用户每次输入的提示词不同，系统提示词由开发者编写，在整个对话过程中保持不变，相当于 Agent 的“岗位说明书”——定义它的身份、权限和行为准则。通过提示工程（Prompt Engineering）精心设计系统提示词，我们可以塑造 Agent 的工作方式。系统提示词中还会包含跨会话保存的**用户记忆**（用户偏好、历史行为、背景设定等个性化信息，详见第三章）和动态注入的环境状态。
- **工具定义**（Tool Definitions）：声明 Agent 可用工具的名称、功能描述和参数格式。没有工具定义，Agent 就无法识别和调用任何工具，但它并不会因此停下来——消融实验（实验 1-1）会说明这一点。工具定义与系统提示词一起构成对话中保持不变的**静态前缀**（这是基础模式；2026 年以来，生产框架中工具的完整 schema 也可以按需动态加载到上下文末尾而不破坏前缀，详见第二章工具定义一节和第四章）。
- **用户消息**（User Messages）：来自用户的输入。用户消息中还可能包含通过 RAG（检索增强生成，Retrieval-Augmented Generation，详见第三章）动态检索引入的**外部知识**——覆盖训练数据截止后的信息或私有领域知识。
- **模型回复**（Assistant Messages）：模型之前生成的回复，最多包含三个部分——思考过程（`reasoning`，即内部思考链，用于保持思维的连贯性和决策的可解释性）、文本内容（`content`，即对用户的回复）和工具调用请求（`tool_calls`，即 Agent 采取行动的方式）。在一次具体的回复中，三者不一定同时出现：例如 Agent 决定调用工具时通常只有 `reasoning` + `tool_calls`，给出最终回答时通常只有 `reasoning` + `content`。
- **工具执行结果**（Tool Results）：Agent 框架执行工具后返回的结果。这些结果是 Agent 下一步思考的直接依据，也让它能够从执行结果中学习、避免重复犯错。

**工具定义**（Tool Definitions，静态前缀的一部分）是 Agent 行动能力的基础，没有它就无法调用任何工具；但失去行动能力不等于沉默——模型照样会给出一份格式工整、语气笃定的答案，数据却来自参数记忆，与真正基于观测得出的答案排版一模一样。它是坦白拒绝还是就地编造，主要取决于模型自身的幻觉率与诚实度；提示词里“不得自行估计”这类约束只能降低编造的概率，并不能消除。
**工具执行结果**（Tool Results）是闭环控制的关键，缺失它会让 Agent “盲目”执行，反复重试直到耗尽迭代预算。
**思考过程**（模型回复中的 reasoning 部分）记录的是“为什么这么做”，工具执行结果记录的是“发生了什么”；当前者可以从后者重建时，把它从历史中丢掉几乎没有代价。
**历史消息**（之前轮次的用户消息、模型回复和工具执行结果）则防止了冗余操作，避免重复犯同样的错误。

### 什么是ReAct循环？
![](assert/Task%200%20基础与环境%20-%20笔记/file-20260914220601669.png)
Agent 执行任务的核心模式叫做 **ReAct**（Reasoning + Acting）。虽然名字只体现了思考（Reasoning）和行动（Acting）两个词，但实际循环包含三个环节：模型先**思考**当前应该做什么，然后调用工具**行动**，再**观察**工具返回的结果并继续思考下一步。这个“想→做→看→想→做→看”的循环不断重复，直到任务完成。

ReAct 伪代码：
```
# Agent 核心循环：模型决策 -> 执行工具 -> 结果回填 -> 再决策，直到模型直接给答案
trajectory = [user_request]  # 历史轨迹：初始只有用户请求

repeat:
    context = stable_prefix + trajectory  # 固定前缀（系统提示+工具定义）+ 历史轨迹
    decision = Model(context)  # 模型决策：可能调工具，也可能直接给答案
    trajectory.append(decision)  # 把本次决策记入轨迹

    if decision has no tool call:  # 模型不再调工具 = 可以回答了
        return decision.answer

    for call in decision.tool_calls:       # independent calls may run in parallel
        validated_call = Harness.validate(call)  # 校验参数/权限
        observation = Environment.execute(validated_call)  # 真正执行（本地函数或 MCP）
        trajectory.append(observation)  # 把执行结果写回轨迹
```

真实代码示例：
```python
import json

# ---------- 1. 工具定义（stable_prefix 的一部分） ----------
TOOLS = [  # 工具清单，最终会拼进上下文告诉模型有哪些工具
    {"name": "read_local_file", "description": "读本地文件",
     "parameters": {"type": "object", "properties": {"path": {"type": "string"}}}},
    {"name": "get_weather", "description": "查天气",
     "parameters": {"type": "object", "properties": {"city": {"type": "string"}}}},
]

# ---------- 2. 工具实现（Environment） ----------
def read_local_file(path):  # 本地工具：直接在本进程执行
    try:
        return open(path, encoding="utf-8").read()
    except Exception as e:
        return f"读取失败: {e}"

def get_weather(city):  # MCP 工具：这里用 mock 代替真实 MCP Server
    return f"{city}：多云，22°C"

TOOL_IMPL = {"read_local_file": read_local_file, "get_weather": get_weather}  # 名字 -> 执行方式

# ---------- 3. 模拟模型（Model） ----------
# 真实场景是调 LLM API；这里用规则模拟“模型决策”
def Model(context):
    last = context["messages"][-1]  # 看最近一条消息
    if last["role"] == "user":  # 第一轮：用户提问 -> 决定调工具
        return {"tool_calls": [
            {"name": "read_local_file", "arguments": {"path": "config.txt"}},
            {"name": "get_weather", "arguments": {"city": "上海"}},
        ]}
    else:  # 工具结果已回填 -> 直接给答案
        return {"answer": "config.txt 内容已读到；上海多云 22°C。"}

# ---------- 4. Harness 校验 ----------
def validate(call):  # 检查工具名是否存在、参数是否合法
    assert call["name"] in TOOL_IMPL, f"未知工具: {call['name']}"
    return call

# ---------- 5. Agent 主循环 ----------
def run(user_request):
    trajectory = [{"role": "user", "content": user_request}]  # 历史轨迹
    stable_prefix = {"tools": TOOLS}  # 固定前缀：工具定义

    while True:
        context = {**stable_prefix, "messages": trajectory}  # 拼上下文
        decision = Model(context)  # 模型决策
        trajectory.append({"role": "assistant", **decision})  # 决策记入轨迹

        if "tool_calls" not in decision:  # 没有工具调用 -> 结束
            return decision["answer"]

        for call in decision["tool_calls"]:  # 逐个执行工具
            call = validate(call)  # 校验
            result = TOOL_IMPL[call["name"]](**call["arguments"])  # 执行
            trajectory.append({"role": "tool", "content": result})  # 结果回填

# ---------- 6. 运行 ----------
print(run("帮我看看 config.txt，顺便查下上海天气。"))
```
·

