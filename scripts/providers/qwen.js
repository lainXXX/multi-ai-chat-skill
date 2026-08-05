/**
 * Qwen — chat.qwen.ai
 * React/Tailwind SPA：contenteditable 输入，Enter 发送，message/answer 回复。
 * （注：AgentChat 的 qwen 配置针对 qianwen.com，本配置针对用户站点 chat.qwen.ai。）
 */
'use strict';

module.exports = {
    key: 'qwen',
    name: 'Qwen',
    url: 'https://chat.qwen.ai/',
    hosts: ['chat.qwen.ai', 'qianwen.com'],
    authDomains: ['chat.qwen.ai/login', 'qianwen.com/login', 'login.aliyun.com', 'signin.aliyun.com'],
    navPostDelay: 3000,
    editorSelectors: [
        '[contenteditable="true"][role="textbox"]',
        '[contenteditable="true"]',
        'textarea',
        '[role="textbox"]',
    ],
    sendFallback: 'Enter',
    responseSelectors: [
        '[class*="markdown"]',
        '[class*="answer"]',
        '[class*="message"]',
    ],
    stabilityWindow: 8000,
    minResponseLength: 5,
    postResponseHook: async (_p, t) =>
        t.replace(/^Qwen[\d.]+-(?:Max|Plus|Turbo|Flash)\s*\n?\s*/i, '').trim(),
    // 开启"网页搜索"模式（2026-08 实测：选项在 "+" 菜单 →"更多"子菜单里，需 hover 展开、点击不生效；
    // 选中态显示在"+"按钮旁的文字"网页搜索"，下拉项本身无高亮；该模式不跨页面持久化，每次运行都要重新开启。
    // 自校验：已开启则跳过，开启后验证，失败重试一次。思考模式默认已开启，无需处理。
    setupMode: async (page) => {
        const isSearchOn = () =>
            page.evaluate(() => document.body.innerText.includes('网页搜索')).catch(() => false);
        if (await isSearchOn()) return;

        for (let attempt = 0; attempt < 2; attempt++) {
            await page.evaluate(() => {
                const btn = document.querySelector('div.mode-select-open[role="button"][aria-label="选择模式"]');
                if (btn) btn.click();
            });
            await page.waitForTimeout(600);
            await page.locator('[class*="mode-select-dropdown-item"]').filter({ hasText: /^更多/ }).first()
                .hover({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(600);
            await page.evaluate(() => {
                const opts = [...document.querySelectorAll('[class*="mode-select-dropdown-item"]')];
                const target = opts.find((o) => (o.textContent || '').trim() === '网页搜索');
                if (target) target.click();
            });
            await page.waitForTimeout(800);
            await page.keyboard.press('Escape').catch(() => {});
            if (await isSearchOn()) break;
        }
    },
};
