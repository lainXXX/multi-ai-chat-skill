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
    // 2026-08 实测：账户默认进 research mode，回答前 model-response 依次显示
    // "Defining ..." 规划头 → "Evaluating Resource Usage" → "立即回答" 按钮；
    // 匹配这些状态词时重置稳定性时钟，等真实回答（缺词会让状态文本被当答案，见 incompletePattern）。
    stillGeneratingPattern: /Defining|Evaluating|Searching|Generating|Reviewing|立即回答|Answer now|Thinking/i,
    // 兜底：若最终拿到的"回答"仍命中生成中状态词（如 research 卡在 Evaluating），
    // 判 no_response 交给上层重试，避免把状态文本当研究结果落盘（2026-08 实测假成功）。
    incompletePattern: /Evaluating Resource Usage|Defining|立即回答|Answer now/i,
    // research 完成的完整回答带 "Gemini 说\n\n" 前缀，剥离后即为纯答案。
    // 另外 Gemini 网页版在回答末尾渲染 follow-up 建议按钮（如"要探讨…吗？\n是"），
    // innerText 会把按钮文本带进 raw —— 剥离结尾的"问题行 + 单字应答"块。
    postResponseHook: async (_p, t) => t
        .replace(/^Gemini\s*说\s*\n*\s*/i, '')
        .replace(/([\r\n]+[^\r\n]{1,80}吗[？?][\r\n]+\s*(?:是|好的|好|否|可以)\s*)$/, '')
        .trim(),
    // 模式设置（2026-08 实测）：
    //   1) 账户默认模型是 Flash-Lite（不是 Pro），必须先显式切到"3.1 Pro"。
    //   2) 再开启"扩展思考"（不跨会话持久化，每次需重开）。
    // 模式选择器按钮 aria-label = "打开模式选择器，当前模式为'X'"；面板里模型/模式
    // 都是 [class*="label-container"] 卡片（"3.1 Pro 高阶数学与代码" / "扩展思考 擅长解决复杂问题"）。
    // 页面加载有时停在欢迎态导致 picker 未渲染 → 先轮询等 picker 出现，仍失败返回 false 由 engine 重试。
    setupMode: async (page) => {
        const label = () =>
            page.evaluate(() => {
                const btn = document.querySelector('[aria-label*="模式选择器"]');
                return btn ? btn.getAttribute('aria-label') : null;
            }).catch(() => null);

        const isProOn = async () => {
            const l = await label();
            return !!l && /Pro/.test(l) && !/Flash/.test(l);
        };
        const isExtOn = async () => {
            const l = await label();
            return !!l && /扩展/.test(l);
        };

        // 等 picker 渲染（最多 20s；SPA 偶尔停在欢迎态不挂载 composer）
        for (let i = 0; i < 20; i++) {
            const has = await page.evaluate(() => !!document.querySelector('[aria-label*="模式选择器"]')).catch(() => false);
            if (has) break;
            await page.waitForTimeout(1000);
        }

        const openPicker = async () => {
            await page.evaluate(() => { const b = document.querySelector('[aria-label*="模式选择器"]'); if (b) b.click(); }).catch(() => {});
            await page.waitForTimeout(1500);
        };
        const pickCard = async (text) => {
            const el = page.locator(`[class*="label-container"]:has-text("${text}")`).first();
            await el.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
            await el.click({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(1500);
        };
        const closePicker = async () => {
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(800);
        };

        // 1) 切到 3.1 Pro（默认可能是 Flash-Lite）
        if (!(await isProOn())) {
            await openPicker();
            await pickCard('3.1 Pro');
            await closePicker();
        }
        // 2) 开启"扩展思考"
        if (!(await isExtOn())) {
            await openPicker();
            await pickCard('扩展思考');
            await closePicker();
        }
        return (await isProOn()) && (await isExtOn());
    },
};
