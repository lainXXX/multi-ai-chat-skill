#!/usr/bin/env node
/**
 * multi-ai-chat.js — 多 web AI 并行执行同一任务（自包含）。
 *
 * 并行数量由 config.yml 的 providers 列表控制（想并行几个就列几个）。
 * 每个 provider 一个 ask.js 子进程（--only=X）并发执行，答案落盘 answers/。
 * stdout = 汇总 JSON（机器契约）；诊断与总回执走 stderr。
 *
 * 用法:
 *   node scripts/multi-ai-chat.js "问题"
 *   node scripts/multi-ai-chat.js < question.txt
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { ALL } = require('./providers');
const CONFIG = require('./lib/config');
const { makeRunId, emitReceipt } = require('./lib/receipt');
const { log } = require('./lib/terminal');

const ASK = path.resolve(__dirname, 'ask.js');
// 并行数量 / 超时 / 重试由 config.yml 控制
const PROVIDERS = CONFIG.providers.map((k) => ALL[k]).filter(Boolean);
const PER_PROVIDER_MS = String(CONFIG.timeout && CONFIG.timeout.perProvider || 150000);
const MAX_ATTEMPTS = 1 + (CONFIG.retry || 0);

if (!PROVIDERS.length) {
    process.stderr.write('config.yml 的 providers 列表为空或全部无效。可选: qwen/deepseek/kimi/doubao/chatgpt/gemini/grok\n');
    process.exit(64);
}

function runOne(cfg, prompt, outDir, idx = 0) {
    return new Promise((resolve) => {
        const start = Date.now();
        // 错开启动：6 个子进程同时导航共享 Chrome 会拉高页面加载、导致模式设置/问答失败，
        // 按 index 错开 1.5s，让每个 provider 错峰占浏览器注意力。
        const delay = idx * 1500;
        const attempt = (n) => {
            log('multi-ai-chat', `▶ ${cfg.name}: 派发中...${n > 1 ? `（第${n}次尝试）` : ''}`);
            const child = spawn(process.execPath, [ASK, `--only=${cfg.key}`, `--timeout=${PER_PROVIDER_MS}`, prompt], {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '', stderr = '';
            child.stdout.on('data', (d) => { stdout += d; });
            child.stderr.on('data', (d) => { stderr += d; });
            child.on('close', (code) => {
                const ok = code === 0 && stdout.trim().length > 0;
                const file = path.join(outDir, `${cfg.key}.md`);
                // 拒答/服务提示（exit 3）：永久性失败，同 prompt 重试无意义，立即判失败，
                // 避免对额度/拒答提示重复烧时间（如 Doubao 额度用尽时不再 4 次重试）。
                if (code === 3) {
                    try { fs.writeFileSync(file, stdout.trim()); } catch (_) {}
                    log('multi-ai-chat', `✗ ${cfg.name}: 拒答/服务提示（不重试）`);
                    return resolve({ key: cfg.key, name: cfg.name, ok: false, chars: 0, file: path.basename(file), receipt: null, exit: 3 });
                }
                if (!ok && n < MAX_ATTEMPTS) {
                    log('multi-ai-chat', `✗ ${cfg.name}: 尝试${n}失败（exit ${code}），重试...`);
                    return attempt(n + 1);
                }
                try { fs.writeFileSync(file, stdout.trim()); } catch (_) {}
                const m = stderr.match(/\[receipt\] AGENTCHAT_RUN .*/);
                const receipt = m ? m[m.length - 1].trim() : null;
                log('multi-ai-chat', `${ok ? '✓' : '✗'} ${cfg.name}: ${ok ? stdout.length + ' 字符' : 'exit ' + code} (${Math.round((Date.now() - start) / 1000)}s)`);
                resolve({ key: cfg.key, name: cfg.name, ok, chars: stdout.length, file: path.basename(file), receipt, exit: code });
            });
            child.on('error', (e) => {
                if (n < MAX_ATTEMPTS) return attempt(n + 1);
                log('multi-ai-chat', `✗ ${cfg.name}: ${e.message}`);
                resolve({ key: cfg.key, name: cfg.name, ok: false, error: e.message });
            });
        };
        setTimeout(() => attempt(1), delay);
    });
}

async function main() {
    let prompt = process.argv.slice(2).join(' ');
    if (!prompt && !process.stdin.isTTY) prompt = fs.readFileSync(0, 'utf8').trim();
    if (!prompt) {
        process.stderr.write('Usage: node scripts/multi-ai-chat.js "问题"   或  echo "问题" | node scripts/multi-ai-chat.js\n');
        process.exit(64);
    }

    // 每次运行一个文件夹：answers/<时间戳>/raw/<provider>.md
    // 最终决策文档由主 agent 写到当前工作目录（见 SKILL.md）；answers/ 只存 AI 原始回答。
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const runDir = path.join(path.resolve(__dirname, '..', 'answers'), ts);
    const rawDir = path.join(runDir, 'raw');
    fs.mkdirSync(rawDir, { recursive: true });

    const start = Date.now();
    const results = await Promise.all(PROVIDERS.map((cfg, i) => runOne(cfg, prompt, rawDir, i)));

    const okCount = results.filter((r) => r.ok).length;
    const receipt = emitReceipt({
        skill: 'web-ai-chat/multi-ai-chat', runId: makeRunId(),
        fields: { mode: 'multi-ai-chat', ok_count: okCount, total: PROVIDERS.length, elapsed_ms: Date.now() - start },
        stream: 'stderr',
    });

    console.log(JSON.stringify({
        ok_count: okCount,
        total: PROVIDERS.length,
        elapsed_ms: Date.now() - start,
        answers_dir: runDir,
        results,
        receipt,
    }, null, 2));

    setTimeout(() => process.exit(okCount > 0 ? 0 : 9), 100);
}

main().catch((e) => { process.stderr.write(`CRITICAL: ${e.message}\n`); process.exit(4); });
