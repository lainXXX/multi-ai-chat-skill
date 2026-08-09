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

/** 读当前最后一条匹配文本（用于发送前基线；无匹配返回 null）。 */
async function currentLastText(page, responseSelectors) {
    for (const sel of responseSelectors) {
        try {
            const loc = page.locator(sel).last();
            const ok = await loc.waitFor({ state: 'attached', timeout: 3000 }).then(() => true).catch(() => false);
            if (!ok) continue;
            const t = String(await loc.innerText().catch(() => '') || '').trim();
            if (t) return t;
        } catch (_) { /* next */ }
    }
    return null;
}

/** 等回复：找响应容器，轮询其文本直至稳定（stabilityWindow 内无变化且有内容）。
 *  若给定 baselineText，则文本未偏离基线前（旧会话残留）不计入稳定性窗口。 */
async function waitAndExtract(page, responseSelectors, opts = {}) {
    const timeout = opts.timeout || 120000;
    const stability = opts.stabilityWindow || 10000;
    const minLen = opts.minResponseLength || 5;
    const start = Date.now();
    const baseline = opts.baselineText ?? null;

    let el = null;
    // 挂载等待上限：默认 25s；个别 provider（如 Gemini 扩展思考）回答容器出现得慢，
    // 用 cfg.responseAttachTimeout 调大。
    const attachTimeout = opts.responseAttachTimeout || 25000;
    for (const sel of responseSelectors) {
        const loc = page.locator(sel).last();
        const found = await loc.waitFor({ state: 'attached', timeout: Math.min(attachTimeout, timeout - (Date.now() - start)) })
            .then(() => true).catch(() => false);
        if (found) { el = loc; break; }
    }
    if (!el) return null;

    let lastText = '', lastChange = Date.now();
    let leftBaseline = baseline === null; // 无基线 = 无需偏离，行为同旧版
    while (Date.now() - start < timeout) {
        await page.waitForTimeout(2000);
        const t = String(await el.innerText().catch(() => lastText) || '').trim();
        if (t !== lastText) {
            lastText = t;
            if (!leftBaseline) {
                if (t !== baseline) { leftBaseline = true; lastChange = Date.now(); }
                // 仍停留在旧会话的旧消息 → 不重置时钟，等新回复出现
            } else {
                lastChange = Date.now();
            }
        }
        // 仍在思考/生成中（如 Gemini 的"正在思考"）→ 重置稳定性时钟，继续等真实回答
        if (opts.stillGeneratingPattern && opts.stillGeneratingPattern.test(lastText)) {
            lastChange = Date.now();
        }
        if (leftBaseline && lastText.length >= minLen && Date.now() - lastChange >= stability) break;
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

        // 模式/模型设置（各 provider 的 setupMode：如 DeepSeek 深度思考、ChatGPT 网页搜索）
        // setupMode 返回 false = 未生效 → 重试（cfg.setupModeRetries，默认 2 次）。
        // 并行 6 子进程共享同一 Chrome 时页面加载慢，固定等待常不足，所以必须按
        // provider 自校验 + 失败重试。重试后仍失败不阻塞问答，只记录。
        if (typeof cfg.setupMode === 'function') {
            const retries = cfg.setupModeRetries ?? 2;
            for (let i = 0; i <= retries; i++) {
                try {
                    const ok = await cfg.setupMode(page);
                    if (ok !== false) break;
                    process.stderr.write(`[engine] ${cfg.name} setupMode 未生效，重试 ${i + 1}/${retries}\n`);
                } catch (e) {
                    process.stderr.write(`[engine] ${cfg.name} setupMode 第${i + 1}次失败(继续重试): ${e.message}\n`);
                }
                await page.waitForTimeout(1500);
            }
        }

        const editor = await findEditor(page, cfg.editorSelectors);
        if (!editor) return { success: false, reason: 'no_editor' };

        // 发送前记录最后一条匹配文本：旧会话残留会让 .last() 在新回复生成前稳定返回旧消息，
        // 必须等文本偏离基线才算拿到新回复。
        const baselineText = await currentLastText(page, cfg.responseSelectors);

        // 输入
        if (!cfg.fillInput) await editor.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(200);
        // 部分站点的编辑器不认 insertText，需用 fill 整段写入；
        // fill 自带聚焦，额外 click 反而会让下一条消息 internal error
        if (cfg.fillInput) await editor.fill(prompt).catch(() => page.keyboard.insertText(prompt));
        else await page.keyboard.insertText(prompt);
        await page.waitForTimeout(300);

        // 发送
        await sendMessage(page, editor, cfg);

        // 等待 + 提取
        const text = await waitAndExtract(page, cfg.responseSelectors, { ...cfg, timeout: opts.timeout, baselineText });
        if (!text) return { success: false, reason: 'no_response' };

        // 提取兜底：若拿到的"回复"其实是用户问题本身（选择器误匹配到用户气泡），
        // 视为未拿到回复，交给上层重试，避免把问题当回答落盘。
        // 用去除所有空白后的规范化文本比较：站点对用户气泡的加空格/换行规范化（如豆包回显）
        // 会让 trim 精确相等失效，规范化后仍相等即判回显。
        const norm = (s) => String(s).replace(/\s+/g, '');
        if (norm(text) === norm(prompt)) {
            return { success: false, reason: 'no_response', detail: '提取到的是用户问题本身（选择器误匹配用户气泡）' };
        }

        // 拒答兜底：AI 明确表示知识截止/无法提供（第一人称拒绝）时不视为有效研究结果，
        // 判 no_response 交给上层重试，避免把拒答当研究内容落盘（如 DeepSeek 偶尔拒搜）。
        const refusalPattern = /我的知识(截止|只到|停留|库|范围)|我[^。；;]{0,8}无法(提供|回答|获取|访问)/;
        if (refusalPattern.test(norm(text))) {
            return { success: false, reason: 'no_response', detail: 'AI 拒答/知识截止: ' + norm(text).slice(0, 50) };
        }

        const out = cfg.postResponseHook ? await cfg.postResponseHook(page, text) : text;
        return { success: true, response: out };
    } catch (e) {
        return { success: false, reason: 'error', detail: e.message };
    }
    // 不关浏览器/不断开 —— 进程退出时 socket 自然断开，Chrome 保持运行
}

module.exports = { drive, findEditor, waitAndExtract };
