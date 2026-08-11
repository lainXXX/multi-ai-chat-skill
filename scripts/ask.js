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
    let fallbackSuspicious = null; // 全链无一 ok 时兜底输出的可疑回答
    for (const cfg of providers) {
        log('ask', `尝试 ${cfg.name}...`);
        // 调用方预算（multi-ai-chat 的 --timeout / config.yml）是硬上限；
        // cfg.timeout 只是该 provider 的宽松上限，两者取小，避免 cfg.timeout
        // 覆盖调用方预算导致单次等待失控（实测 kimi 900s 让失败重试烧 15 分钟）。
        const r = await drive(cfg, prompt, { timeout: cfg.timeout ? Math.min(cfg.timeout, timeout) : timeout });
        last = r;
        if (r.success) {
            const status = r.status || 'ok';
            if (status === 'suspicious') {
                // 低可信：不视为成功。fallback 链模式下记录为兜底并继续尝试下一个 provider；
                // --only 单 provider 模式下循环结束后走 exit 5。
                fallbackSuspicious = { cfg, r };
                log('ask', `⚠ ${cfg.name}: 回答可疑（${(r.flags || []).join(',')}），继续尝试下一个`);
                continue;
            }
            process.stdout.write(r.response);
            emitReceipt({ skill: 'web-ai-chat/ask', runId: makeRunId(), fields: { provider_used: cfg.key, exit: 0, status: 'ok', elapsed_ms: Date.now() - start }, stream: 'stderr' });
            // CDP socket 挂着事件循环，必须显式退出；稍等让 stdout 排空
            setTimeout(() => process.exit(0), 100);
            return;
        }
        log('ask', `✗ ${cfg.name}: ${r.reason}${r.detail ? ' — ' + String(r.detail).slice(0, 100) : ''}`);
        // 拒答/服务提示（refused/blocked）是永久性失败，同 prompt 重试无意义 → exit 3，让调用方不重试。
        // 仅 --only 单 provider 时生效；fallback 链模式下继续尝试下一个 provider。
        if ((r.reason === 'refused' || r.reason === 'blocked') && providers.length === 1) {
            emitReceipt({ skill: 'web-ai-chat/ask', runId: makeRunId(), fields: { provider_used: cfg.key, exit: 3, reason: r.reason, elapsed_ms: Date.now() - start }, stream: 'stderr' });
            setTimeout(() => process.exit(3), 100);
            return;
        }
    }

    // 全链无一 ok：若有可疑回答，兜底输出并标 exit 5（低可信）；否则视为全部失败 exit 9
    if (fallbackSuspicious) {
        const { cfg, r } = fallbackSuspicious;
        process.stdout.write(r.response);
        emitReceipt({ skill: 'web-ai-chat/ask', runId: makeRunId(), fields: { provider_used: cfg.key, exit: 5, status: 'suspicious', flags: r.flags || [], elapsed_ms: Date.now() - start }, stream: 'stderr' });
        setTimeout(() => process.exit(5), 100);
        return;
    }

    emitReceipt({ skill: 'web-ai-chat/ask', runId: makeRunId(), fields: { provider_used: null, exit: 9, reason: last && last.reason, elapsed_ms: Date.now() - start }, stream: 'stderr' });
    process.stderr.write(`✗ 全部 provider 失败: ${last && last.detail || (last && last.reason)}\n`);
    setTimeout(() => process.exit(9), 100);
}

main().catch((e) => { process.stderr.write(`CRITICAL: ${e.message}\n`); process.exit(4); });
