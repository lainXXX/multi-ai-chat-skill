# multi-ai-chat-skill

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Free](https://img.shields.io/badge/Free-No%20API%20Key-brightgreen.svg)
![6 Web AIs](https://img.shields.io/badge/6%20Web%20AIs-Consulted%20in%20Parallel-orange.svg)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933.svg)

## Free multi-AI research assistant: let your agent consult several top AIs at once, and produce a cross-validated decision

Have you ever wondered:

- Is the answer from a single AI actually reliable?
- Whose opinion should I trust for a technology choice?
- Is this product idea just model hallucination?
- Is there a risk an important decision is missing?

The single-AI answer chain:

```
your question
    ↓
one model
    ↓
one answer
```

No matter how capable the model, it still has **bias, knowledge blind spots, and single-path reasoning**. Important decisions deserve independent judgment from multiple AIs, then cross-validation.

multi-ai-chat-skill offers a different path:

```
your question
    ↓
Claude Code enriches context
    ↓
consult multiple AIs at once
    ↓
each model analyzes independently
    ↓
compare viewpoints, cross-validate
    ↓
produce the final decision document
```

---

## 🎯 What it solves: not "more chat windows", but a local Multi-Agent Research Pipeline

Multiple AIs play different "experts"; Claude Code plays the host — converging multi-perspective analysis of the same question into an executable decision.

| Role | AI | Strengths |
|------|-----|-----------|
| Host / integrator | Claude Code (main agent) | Context understanding, synthesis, decision document |
| Expert | ChatGPT | Strong general reasoning, complex problem analysis |
| Expert | Gemini AI Studio | Google ecosystem, search-enhanced capability |
| Expert | Qwen | Chinese understanding, engineering practice |
| Expert | DeepSeek | Technical analysis, coding ability |
| Expert | Kimi | Long-text understanding, material synthesis |
| Expert | Doubao | Chinese scenarios, ByteDance ecosystem, fast iteration |

---

## 🔬 The standout feature: context-enhanced prompting

Web AIs can't see the conversation context you have in Claude Code. Asking them directly gets you generic answers:

```
User: Design a payment system for me

AI1: I don't know your business context
AI2: I don't know your tech stack
AI3: I don't know your constraints
```

How multi-ai-chat-skill works: the main agent first folds **your question + project background + existing constraints** into one enriched prompt, then sends it to the AIs:

```
User: How should I choose React state management?

↓ enriched by the main agent

I'm building a medium-to-large React + TypeScript project with
a 5-person team, aiming to lower maintenance cost. Compare
Redux Toolkit, Zustand, and Jotai: consider type support,
long-term maintenance, team collaboration, and ecosystem risk.
Give a final recommendation.
```

This way, all AIs answer **the same real question** instead of each inventing its own context — the core difference from "copy-pasting a question to 6 chat windows."

---

## 🧠 Why is multi-AI more reliable?

Not because "6 AIs are always smarter than one," but because of **independent viewpoints + cross-validation** — like an expert review panel:

```
expert A ──┐
expert B ──┼──→ main agent synthesizes → final decision
expert C ──┘
```

Example: for a tech choice, AI A recommends PostgreSQL, AI B recommends MongoDB, AI C suggests a hybrid — the divergence usually comes from **different assumptions**. The main agent analyzes where the disagreement originates and combines it with the current context to output:

```
recommended solution
+
rationale
+
risks
+
implementation plan
```

---

## 🧩 Why these AIs?

Not "the strongest six," but a **balanced AI panel of complementary strengths**. The choice weighs: model capability / free availability / web capabilities / search capability / Chinese-language performance / long-text ability / stability / user reach.

| AI | Why this one |
|----|--------------|
| ChatGPT | Strong general reasoning, mature ecosystem |
| Gemini AI Studio | Google search ecosystem, long context, multimodal |
| Kimi | Long text, Chinese material processing |
| DeepSeek | Technical questions, programming analysis, cost-effective reasoning |
| Qwen | Chinese ability, Alibaba ecosystem |
| Doubao | Chinese scenarios, ByteDance ecosystem, fast iteration |

> These six are not the only option — they're a deliberately balanced combination. You can freely add or remove any of them in `config.yml`.

---

## 📦 What you get

Not ❌ a pile of answers from each AI, but ✅ an **actionable decision document**:

```
# Technical Proposal: Payment System Architecture

## Final Recommendation
Adopt xxx

## Design
...

## Implementation Steps
...

## Risks
...

## Alternatives
...

## Decision Basis
Independent analysis from multiple AIs
```

**Where output lands**: the final decision document → **your working directory**; the raw AI answers → `answers/<timestamp>/raw/` (intermediate).

---

## 💰 Truly free

No commercial APIs are called. It uses the **web versions** of 6 AIs, running through **your own browser login state**:

```
You DON'T need           You only need
──────────────────      ─────────────────────
❌ API keys             ✅ accounts you already have
❌ backend server       ✅ a local Chrome
❌ token fees
```

---

## ⚙️ How it's implemented (web automation is just the means)

> Above is the "why"; below is the "how."

All sites share **the same logged-in Chrome**, driven over CDP (Chrome DevTools Protocol) with Playwright-core — that's why login state is reused and your Chrome is never closed.

```
┌──────────────────────────────┐
│  Claude Code / CLI entry     │  ask.js · multi-ai-chat.js
└──────────────┬───────────────┘
               │  Playwright-core over CDP
┌──────────────▼───────────────┐
│        Shared Chrome         │  http://127.0.0.1:9222
│   (logged into 6 sites)      │
└──────┬────┬────┬────┬────┬───┘
       ▼    ▼    ▼    ▼    ▼
    Qwen DeepSeek Kimi Doubao ChatGPT · AI Studio
```

The per-AI Q&A pipeline (`lib/engine.js`):

```
navigate → auth check → setup mode (self-verifying) → find editor → type → send → wait for reply (stability polling) → extract → post-process
```

Every AI-specific difference (selectors, delays, send key, reply container, mode setup, post-processing) lives in `providers/*.js`; the engine implements only stable, generic steps — **adding a new AI means adding one config file**.

Mode auto-enabled per AI (set and self-verified at runtime by `setupMode`; these modes don't persist across sessions on the web side, so they're re-enabled on every run):

| AI | Auto-enabled mode | Notes |
|----|-------------------|-------|
| ChatGPT | Web search | Click the "search the web" suggestion chip above the composer to enter the highlighted web-search state |
| Qwen | Web search | "+" menu → More → web search; thinking mode is already on by default |
| DeepSeek | Expert mode | Pick from Quick / Expert / Vision in an empty chat; must be set before the session starts |
| Doubao | Expert mode | Expert research-grade Q&A (2.1 Turbo) |
| AI Studio | Grounding with Google Search | Gemini 3.1 Pro, model set directly via URL |
| Kimi | None needed | Works out of the box with its long-context default |

**Machine contract** (between scripts and the upper agent):

| Stream | Content |
|--------|---------|
| **stdout** | The AI's raw answer / summary JSON (the only legitimate content) |
| **stderr** | Diagnostic logs + receipts |

Every run emits a verifiable receipt; the `run_id` proves the run actually happened:

```bash
node scripts/ask.js --only=Kimi "hi" 2>&1 | grep 'receipt'
# [receipt] AGENTCHAT_RUN {"run_id":"ac-1a2b3c...","provider_used":"kimi","exit":0,...}
```

---

## 🚀 Install & Use

**Prerequisites**: Node.js ≥ 18 and a local Chrome.

```bash
# 1. Install dependencies
npm install

# 2. Copy the config template and edit if needed
cp .env.example .env

# 3. Open all 6 sites → log in once in the Chrome window that pops up (reused forever)
npm run login

# 4. Health check (CDP reachability + per-site tab state)
npm run doctor
```

```bash
# Single ask: walk the fallback chain automatically (chatgpt → qwen → kimi → deepseek → doubao → aistudio)
npm run ask -- "React 19 vs Vue 3.5: which to choose?"

# Ask a specific AI
npm run ask -- --from=Kimi "How do I make a frosted-glass effect with CSS?"

# Long content / file content via stdin
node scripts/ask.js < question.txt

# 6-way parallel: same question to all 6 AIs, answers written to disk
npm run multi-ai-chat -- "Compare Rust vs Go for building CLI tools"
```

### Configuration

`.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `CDP_PORT` | `9222` | Chrome debugging port |
| `CHROMIUM_PATH` | default Chrome path | Chrome binary used to auto-launch when the CDP port is closed |
| `CHROME_PROFILE` | `~/.chrome-debug-profile` | Where login state lives (sign in once, reuse forever) |

`config.yml`:

```yaml
providers: [qwen, deepseek, kimi, doubao, chatgpt, aistudio]  # parallel list
timeout:
  perProvider: 150000    # max wait per AI (ms)
retry: 3                 # auto-retries after a per-AI failure
```

---

## 📁 Project Structure

```
multi-ai-chat-skill/
├── scripts/
│   ├── lib/
│   │   ├── cdp.js          # CDP connect + auto-launch Chrome + safe .env loading
│   │   ├── engine.js       # Q&A pipeline core (navigate/type/send/stability-wait/extract)
│   │   ├── config.js       # config.yml loader
│   │   ├── receipt.js      # machine-verifiable receipts [receipt] AGENTCHAT_RUN {...}
│   │   └── terminal.js     # stderr logging
│   ├── providers/          # driver configs for the 6 AIs (selectors/delays/modes/post-processing)
│   ├── multi-ai-chat.js    # 6-way parallel dispatch (entry point)
│   ├── ask.js              # single ask (fallback chain)
│   ├── login.js            # open the 6 sites for manual login (idempotent)
│   └── doctor.js           # environment health check
├── answers/                # raw AI answers (<timestamp>/raw/)
├── config.yml              # parallel AI list / timeout / retry
├── evals/                  # skill evaluation cases
└── .env                    # CDP / Chrome config (copy from .env.example)
```

---

## ❓ FAQ

**Q: Why can the scripts use my logged-in sites directly?**
A: They drive your own Chrome (the profile in `CHROME_PROFILE`), so login state is inherently there. Sign in once, reuse forever.

**Q: What if one route fails in `multi-ai-chat`?**
A: It's recorded honestly. The failed route (`ok:false`) never gets a fabricated answer, and the final decision document's receipt table reflects the failure.

**Q: Why are modes (web search / expert mode) re-enabled every run?**
A: These modes don't persist across sessions on the web side, so `setupMode` re-enables and self-verifies them each run before the Q&A proceeds.

**Q: `ask.js` fails on every provider?**
A: First run `npm run doctor` to confirm CDP is reachable; then check the target site is logged in and isn't blocked by a CAPTCHA.

---

## 🗺️ Roadmap

- [x] 6-way parallel dispatch + fallback chain
- [x] Per-AI mode auto-enable with self-verification
- [ ] Answer quality comparison / voting summary
- [ ] Multi-turn follow-up (with context)
- [ ] Screenshot / attachment support

---

## 📄 License

Licensed under the **MIT License** — see [LICENSE](LICENSE). Free to use, modify, commercialize, and distribute, provided the copyright notice is retained.

> Note: login credentials live in your local `CHROME_PROFILE`; `.env` and `answers/` are gitignored. Never commit any account credentials to the repository.
