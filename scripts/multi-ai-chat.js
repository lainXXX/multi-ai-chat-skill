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
                const file = path.join(outDir, `${cfg.key}.md`);
                // 从 stderr 回执解析 status/flags（P0：ok:true 只表示"获得可信回答"）
                const m = stderr.match(/\[receipt\] AGENTCHAT_RUN .*/);
                const receipt = m ? m[m.length - 1].trim() : null;
                let fields = {};
                if (receipt) { try { fields = JSON.parse(receipt.replace(/^\[receipt\] AGENTCHAT_RUN /, '')); } catch (_) {} }
                const status = code === 0 ? 'ok' : code === 3 ? 'blocked' : code === 5 ? 'suspicious' : 'failed';
                const flags = fields.flags || [];

                // preview = 每路回答前 240 字符，供主 agent 先读 manifest 决定是否读全文
                const preview = stdout.slice(0, 240);

                // 拒答/服务提示（exit 3 = refused/blocked）：永久性失败，同 prompt 重试无意义，
                // 避免对额度/拒答提示重复烧时间（如 Doubao 额度用尽时不再多次重试）。
                if (code === 3) {
                    try { fs.writeFileSync(file, stdout.trim()); } catch (_) {}
                    log('multi-ai-chat', `✗ ${cfg.name}: 拒答/服务提示（不重试）`);
                    return resolve({ key: cfg.key, name: cfg.name, ok: false, status, flags, chars: 0, preview, file: path.basename(file), receipt, exit: 3 });
                }

                // 可疑（exit 5）：低可信，仅重试一次；第二次仍可疑则保留文本按 suspicious 落盘
                if (code === 5) {
                    if (n === 1) {
                        log('multi-ai-chat', `⚠ ${cfg.name}: 回答可疑（${flags.join(',')}），重试一次...`);
                        return attempt(2);
                    }
                    try { fs.writeFileSync(file, stdout.trim()); } catch (_) {}
                    log('multi-ai-chat', `⚠ ${cfg.name}: 仍可疑（${flags.join(',')}），记低可信`);
                    return resolve({ key: cfg.key, name: cfg.name, ok: false, status, flags, chars: stdout.length, preview, file: path.basename(file), receipt, exit: 5 });
                }

                const ok = code === 0 && stdout.trim().length > 0;
                if (!ok && n < MAX_ATTEMPTS) {
                    log('multi-ai-chat', `✗ ${cfg.name}: 尝试${n}失败（exit ${code}），重试...`);
                    return attempt(n + 1);
                }
                try { fs.writeFileSync(file, stdout.trim()); } catch (_) {}
                log('multi-ai-chat', `${ok ? '✓' : '✗'} ${cfg.name}: ${ok ? stdout.length + ' 字符' : 'exit ' + code} (${Math.round((Date.now() - start) / 1000)}s)`);
                resolve({ key: cfg.key, name: cfg.name, ok, status: ok ? 'ok' : status, flags, chars: stdout.length, preview, file: path.basename(file), receipt, exit: code });
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
    const argvPrompt = process.argv.slice(2).join(' ');
    let prompt = argvPrompt;
    if (!prompt && !process.stdin.isTTY) prompt = fs.readFileSync(0, 'utf8').trim();
    if (!prompt) {
        process.stderr.write('Usage: node scripts/multi-ai-chat.js "问题"   或  echo "问题" | node scripts/multi-ai-chat.js\n');
        process.exit(64);
    }
    // P1：命令行传参遇特殊字符易被 shell 转义损坏，提示改用 stdin（不强制，避免破坏旧用法）
    if (argvPrompt && /["'`\\$()&|;]/.test(argvPrompt)) {
        process.stderr.write('[multi-ai-chat] ⚠ 问题含特殊字符，建议改用 stdin 传参避免 shell 转义损坏：node scripts/multi-ai-chat.js < 问题.txt\n');
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
    // P0-3 降级判定：ok 数 ≥ min_providers_ok → full（完整文档）；≥1 → partial（初步分析）；
    // 0 → insufficient（证据不足，不建议行动）。阈值可配 config.yml。
    const minOk = CONFIG.min_providers_ok != null ? CONFIG.min_providers_ok : 3;
    const decision = okCount >= minOk ? 'full' : okCount >= 1 ? 'partial' : 'insufficient';
    const receipt = emitReceipt({
        skill: 'web-ai-chat/multi-ai-chat', runId: makeRunId(),
        fields: { mode: 'multi-ai-chat', ok_count: okCount, total: PROVIDERS.length, decision, elapsed_ms: Date.now() - start },
        stream: 'stderr',
    });

    // P0-2 上下文控制：manifest.json 含每路 status/chars/preview，主 agent 先读 manifest
    // 决定读取哪些 raw 全文，避免 7 份原文一次性灌入上下文。
    const manifest = {
        timestamp: ts,
        total: PROVIDERS.length,
        ok_count: okCount,
        min_providers_ok: minOk,
        decision,
        providers: results.map((r) => ({
            key: r.key, name: r.name,
            status: r.status || (r.ok ? 'ok' : 'failed'),
            flags: r.flags || [],
            chars: r.chars || 0,
            file: r.file || '',
            preview: r.preview || '',
        })),
        usage: '主 agent 先读本文件决定读取哪些 raw；preview 为每路回答前 240 字符；status: ok | suspicious | blocked | failed',
    };
    const manifestPath = path.join(runDir, 'manifest.json');
    try { fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2)); } catch (_) {}

    console.log(JSON.stringify({
        ok_count: okCount,
        total: PROVIDERS.length,
        decision,
        min_providers_ok: minOk,
        elapsed_ms: Date.now() - start,
        answers_dir: runDir,
        manifest: manifestPath,
        results,
        receipt,
    }, null, 2));

    setTimeout(() => process.exit(okCount > 0 ? 0 : 9), 100);
}

main().catch((e) => { process.stderr.write(`CRITICAL: ${e.message}\n`); process.exit(4); });
