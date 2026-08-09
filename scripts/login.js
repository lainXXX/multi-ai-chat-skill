#!/usr/bin/env node
/**
 * login.js — 打开 6 个 web AI 站点供手动登录。
 *
 * 幂等：已存在的同域名 tab 跳过。只开不关。登录态统一写进 CHROME_PROFILE。
 *
 * 用法: npm run login   （或 node scripts/login.js）
 */
'use strict';

const { chromium } = require('playwright-core');
const { CDP_URL, ensureChromeCdp } = require('./lib/cdp');

// ── 7 个需要登录的站点 ──
const SITES = [
    { name: 'Qwen',     url: 'https://chat.qwen.ai/' },
    { name: 'DeepSeek', url: 'https://chat.deepseek.com/' },
    { name: 'Kimi',     url: 'https://www.kimi.com/' },
    { name: 'Doubao',   url: 'https://www.doubao.com/chat/' },
    { name: 'ChatGPT',  url: 'https://chatgpt.com/' },
    { name: 'Gemini',   url: 'https://gemini.google.com/app' },
    { name: 'Grok',     url: 'https://grok.com/' },
];

async function main() {
    const { up, reason } = await ensureChromeCdp();
    if (!up) {
        console.error(`FATAL: Chrome CDP 不可达 (${reason || CDP_URL})`);
        process.exit(1);
    }

    const browser = await chromium.connectOverCDP(CDP_URL);
    const ctx = browser.contexts()[0];
    const openHosts = ctx.pages().map((p) => { try { return new URL(p.url()).hostname; } catch { return ''; } });

    const isOpen = (s) => {
        const h = new URL(s.url).hostname;
        return openHosts.some((u) => u === h || u.endsWith('.' + h));
    };

    console.log('===== 打开需要登录的 AI 站点 =====');
    let opened = 0, skipped = 0;
    for (const s of SITES) {
        if (isOpen(s)) { console.log(`  ⏭ ${s.name}: tab 已存在 — 跳过`); skipped++; continue; }
        const page = await ctx.newPage();
        await page.goto(s.url, { waitUntil: 'domcontentloaded', timeout: 45000 })
            .then(() => console.log(`  ✓ ${s.name}: ${s.url}`))
            .catch((e) => console.error(`  ⚠ ${s.name}: 加载失败（tab 已留，可手动重试）— ${e.message.slice(0, 70)}`));
        opened++;
        await new Promise((r) => setTimeout(r, 800));
    }
    console.log(`\n完成：新开 ${opened} 个，已存在跳过 ${skipped} 个。`);
    console.log('在 Chrome 窗口里逐个登录后，用 npm run doctor 确认。');
    process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
