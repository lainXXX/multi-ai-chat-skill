---
name: multi-ai-chat-skill
description: Multi AI Research → Decision → Solution Generator。用户要的是一份可执行的决策/方案文档时用本技能：把问题并行分发给多个网页 AI 作答，再由主 agent 提炼成 AI Decision & Solution Document（不是 AI 回答汇总）。触发场景：技术选型/架构/产品/商业决策、写方案/出方案、头脑风暴/新产品设计、新框架/新概念学习、对比几个选项选哪个。
---

# multi-ai-chat-skill — 多 AI 研究 → 决策 → 方案文档

## 核心定位

不是"AI 汇总报告"，而是 **AI Decision & Solution Document**——看完文档后不需要再看任何 AI 原文，可以直接基于它行动。

## 流程（严格遵守，按序执行）

### 1. 主 agent 提问

拿到用户问题，判断它**连同附件能否自洽说明要做什么**——核心永远是问题本身（含附带的图片/文件），补背景只是为了让 web AI 看懂，不要不分场景套模板。

- **能自洽 → 直接发**：问题 + 附件本身就是完整上下文（如"这张图片是什么？"、"看看这张图的排版怎么样"），直接传给 web AI，不要额外包装。
- **不能自洽 → 只补缺的部分**：问题依赖当前项目目标、具体代码、之前排查的线索（web AI 完全看不到）时，补缺的那一部分即可。

**自检标准**：一个完全没参与过这次任务、但能看到这条消息全部内容（含附件）的人，能否明白要做什么、为什么问、期待什么答案？能 → 直接发；不能 → 只补缺的部分，不照抄整套模板。

**需要补充时，按需选用**（不必每项都写）：

```markdown
【背景】问题依赖项目/任务背景时才写
【现状】涉及"已经试过什么、卡在哪"时才写
【目标】期望的输出深度/格式不明显时才写
【问题】永远是这条消息的主体
```

原因：Claude Code 拥有项目上下文，但网页端 AI 是白纸——用户的实际提问默认带了上下文，这个上下文 web AI 看不到，所以主 agent 要自行判断补什么。

### 2. 调用对话脚本

```bash
node scripts/multi-ai-chat.js "<问题>"
```

- 行为由 `config.yml` 配置：`providers`（并行几个）/ `timeout.perProvider`（超时）/ `retry`（重试）。
- stdout 是机器契约 JSON（诊断与回执走 stderr）：`{ ok_count, elapsed_ms, answers_dir, results[], receipt }`，每路含 `key/name/ok/chars/file/receipt`。
- 某路 `ok:false`：如实记录，禁止伪造；最终文档的回执表必须体现失败。

### 3. 主 agent 回收
读 `answers/<时间戳>/raw/<provider>.md`。**只提炼关键洞察，不要复制全文**——AI 原始回答留在 `raw/`，不污染最终文档。

### 4. 主 agent 提炼
从多份回答中提炼：
- 被采用的方案与理由（Final Recommendation 的依据）
- 每个 AI 独特且有价值的洞察
- 被拒绝的方案与理由（Alternatives）
- 风险与取舍

### 5. 生成决策文档
按下面的强制格式写成 **AI Decision & Solution Document**，保存到**当前工作目录**（你启动 Claude 的目录，即 CWD/`process.cwd()`）下的 `<简洁需求>.md`——不要写进 skill 目录。`answers/<时间戳>/` 只放 AI 原始回答，不是最终交付物。

## 合成格式（强制）

```markdown
# <主题>

> AI 辅助生成方案文档
> 日期：<日期>
> 参与分析模型：<N 个 AI 名称>
> 状态：Draft / Final

# 1. Executive Summary（结论摘要）
一句话说明最终结论。例：采用 Zustand 作状态管理，保留 React Query 处理服务端状态。

# 2. Background（背景）

## 当前情况
- 为什么提出这个问题 / 现状 / 约束

## 目标
- 希望达到什么

## 非目标
- 明确不解决什么

# 3. Final Recommendation（最终方案）

## 3.1 总体方案
写最终选择。不要写"AI1 认为…AI2 认为…"，而是"推荐采用 XXX，因为…"。

## 3.2 详细设计
### 架构 / ### 流程 / ### 技术细节（代码、配置）

# 4. Implementation Plan（实施计划）

## Phase 1
时间：/ 任务：
## Phase 2
时间：/ 任务：

# 5. Alternatives Considered（备选方案）

| 方案 | 结论 | 原因 |
|------|------|------|
| A | 放弃 | 原因 |

# 6. Risks & Trade-offs（风险与取舍）

风险：
-
解决：
-

# 7. AI Research Notes（AI 分析依据）

> 保留关键洞察，不是完整回答。

## <AI 名称>
关键观点：
-

## <AI 名称>
关键观点：
-

# 8. Confidence Level（可信度）

最终方案可信度：⭐⭐⭐⭐☆
原因：多模型一致 / 有实践验证 / 存在 XX 风险

# 9. Execution Receipt

| AI | 状态 |
|----|------|
| DeepSeek | ✓ |
| Qwen | ✓ |
```

## 可选：Decision Log（重大决策时追加）

```markdown
# Decision Log

## Decision
选择了 X 而不是 Y

## Why
1. 原因

## Revisit Condition
满足以下条件时重新评估：
- 数据规模超过 …
- 指标超过 …
```

## 关键约定

- **永不关闭用户 Chrome**：脚本退出只断开 CDP 连接。
