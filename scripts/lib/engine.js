/**
 * engine.js — 浏览器驱动核心（自包含，精简版）。
 *
 * 职责：驱动任意 provider 配置完成一次"问→答"。
 *   导航 → 找输入框（多选择器兜底）→ 输入 → 发送（按钮/Enter）→ 等回复（稳定性轮询）→ 提取。
 *
 * 设计原则（半自包含）：只实现稳定通用的步骤；每个 provider 的差异全部放
 * providers/*.js 配置里（选择器 / 延迟 / 后处理）。AgentChat 仅作参考实现。
 *
 * 用法:
 *   const { drive } = require('./engine');
 *   const r = await drive(providerConfig, "问题");
 *   // → { success: true, response } | { success: false, reason, detail }
 */
'use strict';

const { chromium } = require('playwright-core');
const { CDP_URL, ensureChromeCdp } = require('./cdp');

function hostnameOf(u) {
    try { return new URL(u).hostname; } catch { return ''; }
}

function pageMatches(page, cfg) {
    const hosts = cfg.hosts || [hostnameOf(cfg.url)].filter(Boolean);
    const h = hostnameOf(page.url());
    return hosts.some((x) => h === x || h.endsWith('.' + x));
}

/** 找可编辑输入框：多选择器逐个试（可见 + 可编辑），最后通用兜底。 */
async function findEditor(page, selectors) {
    const trySel = async (sel) => {
        try {
            const loc = page.locator(sel).first();
            const vis = await loc.isVisible({ timeout: 2000 }).catch(() => false);
            if (!vis) return null;
            const ok = await loc.evaluate((el) =>
                (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')
                    ? !el.hasAttribute('readonly') && !el.hasAttribute('disabled')
                    : el.getAttribute('contenteditable') !== 'false' && !el.hasAttribute('readonly')
            ).catch(() => false);
            return ok ? loc : null;
        } catch (_) { return null; }
    };
    for (const sel of selectors) {
        const loc = await trySel(sel);
        if (loc) return loc;
    }
    for (const sel of ['[role="textbox"]', 'textarea', '[contenteditable="true"]']) {
        const loc = await trySel(sel);
        if (loc) return loc;
    }
    return null;
}

/** 发送：尝试点击发送按钮，否则按 Enter。 */
async function sendMessage(page, editor, cfg) {
    for (const sel of (cfg.sendSelectors || [])) {
        try {
            const btn = page.locator(sel).first();
            const vis = await btn.isVisible({ timeout: 1500 }).catch(() => false);
            if (vis) { await btn.click(); await page.waitForTimeout(1000); return; }
        } catch (_) { /* next */ }
    }
    if (!cfg.fillInput) await editor.click().catch(() => {});
    await page.keyboard.press(cfg.sendFallback || 'Enter');
    await page.waitForTimeout(1000);
}

/** 等回复：找响应容器，轮询其文本直至稳定（stabilityWindow 内无变化且有内容）。 */
async function waitAndExtract(page, responseSelectors, opts = {}) {
    const timeout = opts.timeout || 120000;
    const stability = opts.stabilityWindow || 10000;
    const minLen = opts.minResponseLength || 5;
    const start = Date.now();

    let el = null;
    for (const sel of responseSelectors) {
        const loc = page.locator(sel).last();
        const found = await loc.waitFor({ state: 'attached', timeout: Math.min(25000, timeout - (Date.now() - start)) })
            .then(() => true).catch(() => false);
        if (found) { el = loc; break; }
    }
    if (!el) return null;

    let lastText = '', lastChange = Date.now();
    while (Date.now() - start < timeout) {
        await page.waitForTimeout(2000);
        const t = String(await el.innerText().catch(() => lastText) || '').trim();
        if (t !== lastText) { lastText = t; lastChange = Date.now(); }
        // 仍在思考/生成中（如 AI Studio 的"正在思考"）→ 重置稳定性时钟，继续等真实回答
        if (opts.stillGeneratingPattern && opts.stillGeneratingPattern.test(lastText)) {
            lastChange = Date.now();
        }
        if (lastText.length >= minLen && Date.now() - lastChange >= stability) break;
    }
    return lastText.length >= minLen ? lastText : null;
}

/**
 * 驱动一个 provider 完成问答。
 * @param {object} cfg  provider 配置（providers/*.js）
 * @param {string} prompt
 * @returns {Promise<{success:boolean, response?:string, reason?:string, detail?:string}>}
 */
async function drive(cfg, prompt, opts = {}) {
    const { up, reason } = await ensureChromeCdp();
    if (!up) return { success: false, reason: 'no_cdp', detail: reason };

    const browser = await chromium.connectOverCDP(CDP_URL);
    try {
        const ctx = browser.contexts()[0];
        // 复用已登录 tab（按域名匹配），没有则新建
        let page = ctx.pages().find((p) => pageMatches(p, cfg));
        if (!page) page = await ctx.newPage();

        await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        if (cfg.navPostDelay) await page.waitForTimeout(cfg.navPostDelay);

        // 登录检查：落在登录域名 → auth
        const url = page.url();
        if ((cfg.authDomains || []).some((d) => url.includes(d)) || url.includes('/login')) {
            return { success: false, reason: 'auth', detail: `landed on ${url.slice(0, 90)}` };
        }

        // 模式/模型设置（各 provider 的 setupMode：如 DeepSeek 深度思考、AI Studio 选模型）
        // 失败不阻塞问答，只记录（模式是增强项，问答是主目标）
        if (typeof cfg.setupMode === 'function') {
            try {
                await cfg.setupMode(page);
            } catch (e) {
                process.stderr.write(`[engine] ${cfg.name} setupMode 失败(继续): ${e.message}\n`);
            }
        }

        const editor = await findEditor(page, cfg.editorSelectors);
        if (!editor) return { success: false, reason: 'no_editor' };

        // 输入
        if (!cfg.fillInput) await editor.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(200);
        // 部分站点（如 AI Studio）的编辑器不认 insertText，需用 fill 整段写入；
        // fill 自带聚焦，额外 click 反而会让下一条消息 internal error
        if (cfg.fillInput) await editor.fill(prompt).catch(() => page.keyboard.insertText(prompt));
        else await page.keyboard.insertText(prompt);
        await page.waitForTimeout(300);

        // 发送
        await sendMessage(page, editor, cfg);

        // 等待 + 提取
        const text = await waitAndExtract(page, cfg.responseSelectors, { ...cfg, timeout: opts.timeout });
        if (!text) return { success: false, reason: 'no_response' };

        const out = cfg.postResponseHook ? await cfg.postResponseHook(page, text) : text;
        return { success: true, response: out };
    } catch (e) {
        return { success: false, reason: 'error', detail: e.message };
    }
    // 不关浏览器/不断开 —— 进程退出时 socket 自然断开，Chrome 保持运行
}

module.exports = { drive, findEditor, waitAndExtract };
