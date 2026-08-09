#!/usr/bin/env node
/**
 * doctor.js — 环境检查：Chrome CDP 可达性 + 7 个站点 tab 状态。
 *
 * 用法: npm run doctor
 */
'use strict';

const { chromium } = require('playwright-core');
const { CDP_URL, ensureChromeCdp, probe } = require('./lib/cdp');

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
    if (!(await probe(CDP_URL))) {
        const { up, reason } = await ensureChromeCdp();
        if (!up) { console.error(`✗ Chrome CDP 不可达: ${reason || CDP_URL}`); process.exit(1); }
        console.log(`✓ Chrome CDP 已自动拉起: ${CDP_URL}`);
    } else {
        console.log(`✓ Chrome CDP 可达: ${CDP_URL}`);
    }

    const browser = await chromium.connectOverCDP(CDP_URL);
    const ctx = browser.contexts()[0];
    const openHosts = ctx.pages().map((p) => { try { return new URL(p.url()).hostname; } catch { return ''; } });

    console.log('\n站点 tab 状态：');
    for (const s of SITES) {
        const h = new URL(s.url).hostname;
        const hit = openHosts.some((u) => u === h || u.endsWith('.' + h));
        console.log(`  ${hit ? '✓' : '✗'} ${s.name}${hit ? '' : '（未开 tab，npm run login 打开）'}`);
    }
    process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
