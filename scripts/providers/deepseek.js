/**
 * DeepSeek — chat.deepseek.com
 * 标准管线：textarea 输入，Enter 发送，ds-markdown 回复。
 */
'use strict';

module.exports = {
    key: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com/',
    hosts: ['chat.deepseek.com'],
    authDomains: ['chat.deepseek.com/login', 'chat.deepseek.com/sign_in'],
    navPostDelay: 3000,
    editorSelectors: [
        'textarea[placeholder*="给 DeepSeek 发送消息"]',
        'textarea[placeholder*="DeepSeek"]',
        'textarea[placeholder*="Message"]',
        '#chat-input',
        'textarea',
    ],
    sendFallback: 'Enter',
    responseSelectors: [
        '.ds-markdown',
        '.ds-assistant-message-main-content',
        '[class*="ds-markdown"]',
        '[class*="markdown"]',
    ],
    stabilityWindow: 10000,
    // .last() 取到的是答案元素，可能极短（如只回数字）；设 1 避免把合法短答误判为 no_response
    minResponseLength: 1,
    // 知识截止后转联网搜索的过渡态："我试试联网搜索/正在搜索…" 会稳定不变，若不加此模式
    // 会被当成最终答案（假成功）。匹配时重置稳定性时钟，等真实联网回答出现。
    // 注：终态拒答（"我的知识截止于…无法提供"）不在此列——由 engine 的拒答兜底判 no_response 并重试。
    stillGeneratingPattern: /正在搜索|正在联网搜索|试试联网搜索|尝试联网搜索/,
    // 专家模式：只能在空对话状态（session 开始前）看到/设置；session 一旦开始就固定。
    // 2026-08 实测：空对话页有 快速模式/专家模式/识图模式 三个模式选项。
    setupMode: async (page) => {
        // 确保在空对话态（模式选择器可见）
        const hasMode = await page.evaluate(() => {
            return [...document.querySelectorAll('div, span')].some((e) => (e.textContent || '').includes('专家模式') && e.offsetParent !== null);
        });
        if (!hasMode) {
            await page.goto('https://chat.deepseek.com/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
            await page.waitForTimeout(3000);
        }
        // 点"专家模式"（精确文本、可见、小元素）
        await page.evaluate(() => {
            const el = [...document.querySelectorAll('div, span, button, [role="button"]')]
                .find((e) => (e.textContent || '').trim() === '专家模式' && e.offsetParent !== null && (e.className || '').toString().length < 60);
            if (el) el.click();
        });
        await page.waitForTimeout(1000);
    },
};
