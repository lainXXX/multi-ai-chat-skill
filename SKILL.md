---
name: multi-ai-chat-skill
description: Multi AI Research → Decision → Solution Generator。用户要的是一份可执行的决策/方案文档时用本技能：把问题并行分发给多个网页 AI 作答，再由主 agent 提炼成 AI Decision & Solution Document（不是 AI 回答汇总）。触发场景：技术选型/架构/产品/商业决策、需要多视角研究后形成方案决策、写方案/出方案、头脑风暴/新产品设计、新框架/新概念的系统性学习、对比几个选项选哪个。不适用：单 AI 快速一问、只要并行原始回答不要合成文档、纯总结归纳、常规问答、单次技术问答、代码 debug、简单事实/概念解释（已有明确答案只需解释时）、涉及本技能自身（评估/编写/优化 skill）——不涉及"多个网页 AI 并行 + 合成决策文档"时不需本技能。
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

**默认用 stdin 传参**（把问题写入临时文件后 `<` 重定向），避免 shell 对引号/反引号/$ 的转义破坏命令；仅无特殊字符的短问题才可直接用命令行参数：

```bash
node scripts/multi-ai-chat.js < 问题.txt
# 或：node scripts/multi-ai-chat.js "<短问题>"
```

- 运行前提：脚本通过共享 Chrome 的 CDP 连接各 AI 站点，端口没开时会自动拉起调试 Chrome（复用登录态）。若某路全部失败，按下方规则如实记录即可，不必中断——继续提炼可用的部分。
- 行为由 `config.yml` 配置：`providers`（并行几个）/ `timeout.perProvider`（超时）/ `retry`（重试）/ `min_providers_ok`（降级阈值）。
- stdout 是机器契约 JSON（诊断与回执走 stderr）：`{ ok_count, total, decision, answers_dir, manifest, results[], receipt }`，每路含 `key/name/ok/status/chars/preview/file/receipt`。
- 某路 `ok:false`：如实记录，禁止伪造；最终文档的回执表必须体现失败。

### 3. 主 agent 回收（先 manifest，后按需读 raw）

1. **先读 `answers/<时间戳>/manifest.json`**：它列出每路 `status / chars / preview（前 240 字符）`。**严禁一次性 cat 全部 raw 文件**——7 份原文可达 20k+ tokens，全读会挤爆上下文。
2. 只对 `status: ok` 且 preview 显示有实质内容的回答读 `raw/<provider>.md` 全文；`suspicious/blocked/failed` 只读 preview，不读全文。
3. 提炼时只摘关键洞察，不复制全文（契约见核心定位）——AI 原始回答留在 `raw/`，不污染最终文档。

### 4. 主 agent 提炼

从多份回答中提炼：
- 被采用的方案与理由（Final Recommendation 的依据）
- 每个 AI 独特且有价值的洞察
- 被拒绝的方案与理由（Alternatives）
- 风险与取舍

### 5. 生成决策文档

按 `references/decision-format.md` 的 9 章节模板写成 **AI Decision & Solution Document**，保存到**当前工作目录**（CWD/`process.cwd()`）下，**文件名加日期后缀**防止覆盖上轮产物：`<简洁需求>_<YYYYMMDD>.md`。不要写进 skill 目录。`answers/<时间戳>/` 只放 AI 原始回答与 manifest，不是最终交付物。

## 降级与可信度（按 ok 路数）

读 stdout 契约的 `ok_count` / `decision`，按 `min_providers_ok`（config.yml，默认 3）降级：

| ok 路数 | decision | 行为 |
|---------|----------|------|
| ≥ min_providers_ok | `full` | 生成完整 9 章决策文档 |
| 1 ~ min-1 | `partial` | 只出初步分析（背景 + 要点），Confidence ≤ 3 星，并注明"证据有限" |
| 0 | `insufficient` | 输出"证据不足，不建议行动"，不放 Final Recommendation |

- **Confidence Level 自动校准**：星级绑定 `ok_count / total` 比率，不凭感觉给。ok 比例 ≥ 80% → 4-5 星；50-80% → 3 星；< 50% → ≤ 2 星。
- 单源证据（只有 1 路 ok）必须在文档中标注"单源证据"。

## 关键约定

- **永不关闭用户 Chrome**：脚本退出只断开 CDP 连接。
