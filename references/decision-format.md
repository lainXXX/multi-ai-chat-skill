# 合成格式（强制，9 章节）

> 生成最终决策文档时按此模板。完成后自检 3 条完成判定（见文末）。

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

## 完成判定（输出前自检，全部满足才交付）

- ① 结论一句话可复述，不再依赖任何 AI 原文
- ② Executive Summary / Final Recommendation / Alternatives / Risks / 回执表 五项齐全
- ③ 无"AI1 认为…AI2 认为…"式转述，观点已提炼为最终立场

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
