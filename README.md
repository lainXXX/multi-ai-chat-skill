# multi-ai-chat-skill

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![免费](https://img.shields.io/badge/免费-无需API%20Key-brightgreen.svg)
![6 家网页 AI](https://img.shields.io/badge/6家网页AI-同时咨询-orange.svg)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933.svg)

## 免费多 AI 研究助手：让你的 Agent 同时咨询多个顶级 AI，并生成经过交叉验证的决策方案

你有没有遇到过这样的问题：

- 一个 AI 给出的方案，真的可靠吗？
- 技术选型到底该相信谁？
- 产品创意是不是只是模型的幻觉？
- 一个重要决策，有没有遗漏的风险？

单个 AI 的回答链：

```
用户问题
    ↓
一个模型
    ↓
一个答案
```

即使模型能力很强，也存在**偏见、知识盲区、单一路径推理**。关键决策，值得让多个 AI 独立判断后交叉验证。

multi-ai-chat-skill 提供另一种方式：

```
你的问题
    ↓
Claude Code 补充上下文
    ↓
同时咨询多个 AI
    ↓
不同模型独立分析
    ↓
比较观点、交叉验证
    ↓
生成最终决策文档
```

---

## 🎯 它解决什么问题：不是"多开几个聊天窗口"，而是一个本地 Multi-Agent Research Pipeline

多个 AI 扮演不同专长的「专家」，Claude Code 扮演主持人——把同一问题的多视角分析，收敛成一份可执行的决策。

| 角色 | AI | 优势定位 |
|------|-----|---------|
| 主持人 / 整合 | Claude Code（主 Agent） | 上下文理解、方案整合、生成决策文档 |
| 专家 | ChatGPT | 强通用推理、复杂问题分析 |
| 专家 | Gemini | Google 生态、搜索增强能力 |
| 专家 | Qwen | 中文理解、工程实践 |
| 专家 | DeepSeek | 技术分析、代码能力 |
| 专家 | Kimi | 长文本理解、资料整理 |
| 专家 | Doubao | 中文场景、字节生态、产品迭代速度 |
| 专家 | Grok | xAI 生态、深度推理、风格直接 |

---

## 🔬 最大特点：上下文增强提问

网页 AI 看不到你在 Claude Code 里的对话上下文。直接问，得到的是泛泛而谈：

```
用户: 帮我设计一个支付系统

AI1: 不知道你的业务背景
AI2: 不知道你的技术栈
AI3: 不知道你的限制条件
```

multi-ai-chat-skill 的做法：主 agent 先把**用户问题 + 项目背景 + 已有约束**揉成一个增强问题，再发给多个 AI：

```
用户: React 状态管理怎么选？

↓ 主 agent 增强后

我正在开发一个中大型 React + TypeScript 项目，团队 5 人，
目标降低维护成本。请比较 Redux Toolkit、Zustand、Jotai：
考虑类型支持 / 长期维护 / 团队协作 / 生态风险，给出最终推荐。
```

这样多个 AI 回答的是**同一个真实问题**，而不是各自脑补——这正是多 AI 方案区别于「把问题复制粘贴给 7 个 AI」的核心。

---

## 🧠 多 AI 为什么更可靠？

不是因为「6 个 AI 一定比一个 AI 聪明」，而是**独立观点 + 交叉验证**——类似专家评审：

```
专家 A ──┐
专家 B ──┼──→ 主 Agent 综合分析 → 最终决策
专家 C ──┘
```

例：技术选型时，AI A 推荐 PostgreSQL、AI B 推荐 MongoDB、AI C 建议混合方案——分歧往往来自**不同的假设**。主 agent 分析分歧根源、结合当前上下文，最终输出：

```
推荐方案
+
理由
+
风险
+
实施计划
```

---

## 🧩 为什么是这几个 AI？

不是「最强七个」，而是一组**能力方向互补的平衡型 AI Panel**。选择综合权衡了：模型能力 / 免费可用性 / 网页端能力 / 搜索能力 / 中文表现 / 长文本能力 / 稳定性 / 用户覆盖。

| AI | 选它而不是别的 |
|----|---------------|
| ChatGPT | 综合推理强、生态成熟 |
| Gemini | Google 搜索生态、长上下文、多模态 |
| Kimi | 长文本、中文资料处理 |
| DeepSeek | 技术问题、编程分析、推理成本优势 |
| Qwen | 中文能力、阿里生态 |
| Doubao | 中文场景、字节生态、迭代快 |
| Grok | xAI 深度推理、实时信息、风格直接 |

> 这些不是唯一选择，而是经过综合权衡的一组组合。随时可在 `config.yml` 里自由增删。

---

## 📦 输出什么？

不是 ❌ 把各家回答罗列在一起，而是 ✅ 一份**可直接执行的决策文档**：

```
# 技术方案：支付系统架构设计

## 最终建议
采用 xxx

## 设计方案
...

## 实施步骤
...

## 风险
...

## 备选方案
...

## 决策依据
来自多个 AI 的独立分析
```

**输出位置**：最终决策文档 → **你的工作目录**；AI 原始回答 → `answers/<时间戳>/raw/`（中间产物）。

---

## 💰 真正免费

不调用任何商业 API。利用 6 家**网页版 AI**，通过**你自己的浏览器登录态**运行：

```
无需                 只需要
────────────────    ────────────────
❌ API Key          ✅ 已有的网页账号
❌ 后端服务器        ✅ 本地 Chrome
❌ Token 费用
```

---

## ⚙️ 技术实现（网页自动化只是实现方式）

> 以上是「为什么」，以下是「怎么做」。

所有站点共享**同一个已登录的 Chrome**，脚本通过 CDP（Chrome DevTools Protocol）+ Playwright-core 驱动它——这是「登录态复用」和「永不关闭你的 Chrome」的原因。

```
┌──────────────────────────────┐
│  Claude Code / 命令行入口      │  ask.js · multi-ai-chat.js
└──────────────┬───────────────┘
               │  Playwright-core over CDP
┌──────────────▼───────────────┐
│        共享 Chrome            │  http://127.0.0.1:9222
│    （已登录 7 个站点）          │
└──────┬────┬────┬────┬────┬───┘
       ▼    ▼    ▼    ▼    ▼
    Qwen DeepSeek Kimi Doubao ChatGPT Gemini · Grok
```

单个 AI 的问答管线（`lib/engine.js`）：

```
导航 → 登录检查 → 模式设置(自校验) → 找输入框 → 输入 → 发送 → 等回复(稳定轮询) → 提取 → 后处理
```

每个 AI 的差异（选择器、延迟、发送键、回复容器、模式开启、后处理）全部隔离在 `providers/*.js`，引擎只实现稳定通用的步骤——**新增一个 AI 只需加一个配置文件**。

每个 AI 自动开启的模式（运行时由 `setupMode` 自动设置并自校验；这些模式在网页端不跨会话持久化，所以每次运行都会重新开启）：

| AI | 自动开启的模式 | 说明 |
|----|--------------|------|
| ChatGPT | 网页搜索 | 输入区上方的「搜索网页」建议 chip，点击后进入高亮的「网页搜索」态 |
| Qwen | 网页搜索 | 「+」菜单 → 更多 → 网页搜索；思考模式默认已开启，无需处理 |
| DeepSeek | 专家模式 | 空对话态三选一（快速 / 专家 / 识图），需在会话开始前设置 |
| Doubao | 专家模式 | 专家研究级专业问答（2.1 Turbo） |
| Gemini | 扩展思考 | 模式选择器 →「扩展思考」（Pro + Extended Thinking），不跨会话持久化每次重开；回答前的"Gemini 说"前缀由 postResponseHook 剥离 |
| Kimi | 无需设置 | 开箱即用，默认即长文本模式 |
| Grok | 无需设置 | 默认 Fast 模型，开箱即用 |

**机器契约**（脚本与上层 agent 的约定）：

| 流 | 内容 |
|----|------|
| **stdout** | AI 回答原文 / 汇总 JSON（唯一合法内容） |
| **stderr** | 诊断日志 + 回执 |

每次执行产生可核对的回执，用 `run_id` 验证「真的执行过」：

```bash
node scripts/ask.js --only=Kimi "你好" 2>&1 | grep 'receipt'
# [receipt] AGENTCHAT_RUN {"run_id":"ac-1a2b3c...","provider_used":"kimi","exit":0,...}
```

---

## 🚀 安装与使用

**前置**：Node.js ≥ 18、本机 Chrome。

```bash
# 1. 安装依赖
npm install

# 2. 复制配置模板并按需修改
cp .env.example .env

# 3. 打开 7 个站点 → 在弹出的 Chrome 里手动登录一次（以后永久复用）
npm run login

# 4. 环境体检（CDP 可达性 + 各站点 tab 状态）
npm run doctor
```

```bash
# 单问：按降级链自动尝试（chatgpt → grok → qwen → kimi → deepseek → doubao → gemini）
npm run ask -- "React 19 和 Vue 3.5 怎么选？"

# 指定某个 AI
npm run ask -- --from=Kimi "如何用 CSS 实现毛玻璃效果？"

# 大段内容 / 文件内容走 stdin
node scripts/ask.js < question.txt

# 7 路并行：同一问题同时问 7 个 AI，答案落盘
npm run multi-ai-chat -- "对比 Rust 和 Go 做 CLI 工具的优缺点"
```

### 配置

`.env`：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CDP_PORT` | `9222` | Chrome 调试端口 |
| `CHROMIUM_PATH` | Chrome 默认路径 | CDP 端口未开时自动拉起用的 Chrome 路径 |
| `CHROME_PROFILE` | `~/.chrome-debug-profile` | 登录态存放目录（一次登录永久复用） |

`config.yml`：

```yaml
providers: [qwen, deepseek, kimi, doubao, chatgpt, gemini, grok]  # 并行列表
timeout:
  perProvider: 150000    # 单个 AI 最长等待（毫秒）
retry: 3                 # 单个 AI 失败后自动重试次数
```

---

## 📁 项目结构

```
multi-ai-chat-skill/
├── scripts/
│   ├── lib/
│   │   ├── cdp.js          # CDP 连接 + 自动拉起 Chrome + 安全 .env 加载
│   │   ├── engine.js       # 问答管线核心（导航/输入/发送/稳定等待/提取）
│   │   ├── config.js       # config.yml 加载
│   │   ├── receipt.js      # 机器可验证回执 [receipt] AGENTCHAT_RUN {...}
│   │   └── terminal.js     # stderr 日志
│   ├── providers/          # 7 个 AI 的驱动配置（选择器/延迟/模式/后处理）
│   ├── multi-ai-chat.js    # 7 路并行派发（流程入口）
│   ├── ask.js              # 单问（降级链）
│   ├── login.js            # 打开 7 站点供手动登录（幂等）
│   └── doctor.js           # 环境体检
├── answers/                # AI 原始回答落盘（<时间戳>/raw/）
├── config.yml              # 并行 AI 列表 / 超时 / 重试
├── evals/                  # 技能评估用例
└── .env                    # CDP / Chrome 配置（从 .env.example 复制）
```

---

## ❓ 常见问题

**Q：脚本为什么能直接用已登录的站点？**
A：脚本驱动的是你自己的 Chrome（`CHROME_PROFILE` 指定的 profile），登录态天然在。登录一次，永久复用。

**Q：`multi-ai-chat` 有某路失败怎么办？**
A：如实记录。失败那路（`ok:false`）不会伪造回答，最终决策文档的回执表会体现失败。

**Q：联网搜索 / 专家模式为什么每次都要重新开？**
A：这些模式在网页端不跨会话持久化，所以每次运行由 `setupMode` 自动开启并自校验，成功后才会继续问答。

**Q：`ask.js` 全部失败？**
A：先跑 `npm run doctor` 确认 CDP 可达；再确认目标站点已登录、未被风控要求验证码。

---

## 🗺️ 规划

- [x] 6 路并行派发 + 降级链
- [x] 每个 AI 的模式自动开启与自校验
- [ ] 回答质量对比 / 投票汇总
- [ ] 多轮追问（带上下文）
- [ ] 截图 / 附件支持

---

## 📄 License

本项目基于 **MIT License** 开源 — 详见 [LICENSE](LICENSE)。可自由使用、修改、商用与分发，仅需保留版权声明。

> 注意：登录凭据存于本地 `CHROME_PROFILE`，`.env` 与 `answers/` 已在 `.gitignore` 中，请勿提交任何账号信息到仓库。
