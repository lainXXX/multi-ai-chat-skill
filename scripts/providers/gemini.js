/**
 * Gemini — gemini.google.com/app
 * contenteditable 输入（div[contenteditable="true"][role="textbox"]），Enter 发送，
 * 回复容器 model-response（取最后一个）。选择器源自 gemini-web-automation-skill 实测。
 * 登录态由共享 Chrome profile 提供；未登录会跳到 accounts.google.com 由 auth 兜底。
 */
'use strict';

module.exports = {
    key: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    hosts: ['gemini.google.com'],
    authDomains: ['accounts.google.com', 'gemini.google.com/login'],
    navPostDelay: 5000,
    editorSelectors: [
        'textarea[class*="gds-body-l"]',
        'textarea',
        'div[contenteditable="true"][role="textbox"]',
        '[contenteditable="true"]',
    ],
    sendSelectors: [],
    sendFallback: 'Enter',
    // 每条新回复都是追加的 model-response；.last() 会重解析到最新一条。
    responseSelectors: [
        'model-response',
    ],
    stabilityWindow: 10000,
    minResponseLength: 2,
    // 扩展思考/研究模式下 model-response 容器出现得晚，挂载等待放宽到 90s
    responseAttachTimeout: 90000,
    // 2026-08 实测：账户默认进 research mode，回答前 model-response 先显示
    // "Defining ..." 规划头 + "立即回答" 按钮；匹配这些时重置稳定性时钟，等真实回答。
    stillGeneratingPattern: /Defining|立即回答|Answer now/i,
    // research 完成的完整回答带 "Gemini 说\n\n" 前缀，剥离后即为纯答案。
    postResponseHook: async (_p, t) => t.replace(/^Gemini\s*说\s*\n*\s*/i, '').trim(),
    // 开启"扩展思考"（账户默认模型已是 Pro；扩展思考不跨会话持久化，每次需重开）。
    // 2026-08 实测：模式选择器按钮 aria-label = "打开模式选择器，当前模式为'Pro'"，
    // 开启后变为 "当前模式为'Pro 扩展'"（用是否含"扩展"自检）；面板里"扩展思考"是叶子项。
    // 页面加载有时停在欢迎态导致 picker 未渲染 → 先轮询等 picker 出现，仍失败返回 false 由 engine 重试。
    setupMode: async (page) => {
        const isExtOn = () =>
            page.evaluate(() => {
                const btn = document.querySelector('[aria-label*="模式选择器"]');
                return !!(btn && /扩展/.test(btn.getAttribute('aria-label') || ''));
            }).catch(() => false);

        if (await isExtOn()) return true;

        // 等 picker 渲染（最多 20s；SPA 偶尔停在欢迎态不挂载 composer）
        for (let i = 0; i < 20; i++) {
            const has = await page.evaluate(() => !!document.querySelector('[aria-label*="模式选择器"]')).catch(() => false);
            if (has) break;
            await page.waitForTimeout(1000);
        }

        // 打开模式选择器
        await page.evaluate(() => {
            const btn = document.querySelector('[aria-label*="模式选择器"]');
            if (btn) btn.click();
        }).catch(() => {});
        await page.waitForTimeout(1500);

        // 点"扩展思考"选项（叶子文本，取最近可点击祖先）
        await page.evaluate(() => {
            const el = [...document.querySelectorAll('*')].find((e) => /^扩展思考/.test((e.textContent || '').trim()) && e.childElementCount === 0 && e.offsetParent !== null);
            if (el) (el.closest('button,[role="button"],mat-option') || el).click();
        }).catch(() => {});
        await page.waitForTimeout(1500);

        // 关闭面板，别挡住输入框
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(800);

        return isExtOn();
    },
};
