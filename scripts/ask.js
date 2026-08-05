#!/usr/bin/env node
/**
 * ask.js — 问任意一个已登录的 web AI（自包含，无外部依赖）。
 *
 * 使用 lib/engine.js 直接驱动浏览器，不再依赖 AgentChat。
 *
 * 用法:
 *   node scripts/ask.js "问题"                    # 默认降级链顺序
 *   node scripts/ask.js --only=kimi "问题"         # 指定问 Kimi
 *   echo "长内容" | node scripts/ask.js --from=ChatGPT   # 大段走 stdin
 *
 * stdout = AI 回答原文（机器契约）；诊断与回执走 stderr。
 */
'use strict';

const fs = require('fs');
const CONFIG = require('./lib/config');
const { drive } = require('./lib/engine');
const { ALL, CHAIN } = require('./providers');
const { makeRunId, emitReceipt } = require('./lib/receipt');
const { log } = require('./lib/terminal');

async function main() {
    const args = process.argv.slice(2);
    let only = null;
    let timeout = (CONFIG.timeout && CONFIG.timeout.perProvider) || 120000;
    const positional = [];
    for (const a of args) {
        if (a.startsWith('--only=') || a.startsWith('--from=')) only = a.split('=')[1].toLowerCase();
        else if (a.startsWith('--timeout=')) { const v = parseInt(a.split('=')[1], 10); if (v > 0) timeout = v; }
        else if (!a.startsWith('--')) positional.push(a);
    }

    let prompt = positional.join(' ');
    if (!prompt && !process.stdin.isTTY) prompt = fs.readFileSync(0, 'utf8').trim();
    if (!prompt) {
        process.stderr.write('Usage: node scripts/ask.js [--only=X] [--timeout=MS] "问题"   或  echo "问题" | node scripts/ask.js\n');
        process.exit(64);
    }

    const providers = only ? (ALL[only] ? [ALL[only]] : []) : CHAIN;
    if (!providers.length) {
        process.stderr.write(`未知 provider: ${only}。可选: ${Object.keys(ALL).join(', ')}\n`);
        process.exit(64);
    }

    const start = Date.now();
    let last = null;
    for (const cfg of providers) {
        log('ask', `尝试 ${cfg.name}...`);
        const r = await drive(cfg, prompt, { timeout });
        last = r;
        if (r.success) {
            emitReceipt({ skill: 'web-ai-chat/ask', runId: makeRunId(), fields: { provider_used: cfg.key, exit: 0, elapsed_ms: Date.now() - start }, stream: 'stderr' });
            process.stdout.write(r.response);
            // CDP socket 挂着事件循环，必须显式退出；稍等让 stdout 排空
            setTimeout(() => process.exit(0), 100);
            return;
        }
        log('ask', `✗ ${cfg.name}: ${r.reason}${r.detail ? ' — ' + String(r.detail).slice(0, 100) : ''}`);
    }

    emitReceipt({ skill: 'web-ai-chat/ask', runId: makeRunId(), fields: { provider_used: null, exit: 9, reason: last && last.reason, elapsed_ms: Date.now() - start }, stream: 'stderr' });
    process.stderr.write(`✗ 全部 provider 失败: ${last && last.detail || (last && last.reason)}\n`);
    setTimeout(() => process.exit(9), 100);
}

main().catch((e) => { process.stderr.write(`CRITICAL: ${e.message}\n`); process.exit(4); });
