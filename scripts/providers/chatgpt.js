/**
 * ChatGPT — chatgpt.com
 * React contenteditable（ProseMirror）输入，发送按钮/Enter，.markdown 回复。
 */
'use strict';

module.exports = {
    key: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    hosts: ['chatgpt.com'],
    authDomains: ['auth.openai.com', 'chat.openai.com/auth'],
    navPostDelay: 4000,
    editorSelectors: [
        '#prompt-textarea',
        '[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        'textarea',
    ],
    sendSelectors: [
        'button[data-testid="send-button"]',
        'button[aria-label="Send prompt"]',
        'button[aria-label="发送提示"]',
    ],
    sendFallback: 'Enter',
    responseSelectors: [
        '.markdown',
        '[data-message-author-role="assistant"]',
        '.agent-turn',
        '[class*="response"]',
    ],
    stabilityWindow: 10000,
    minResponseLength: 5,
    // 开启"网页搜索"（2026-08 实测：新对话页输入区上方有建议 chip "搜索网页"，点击后该 chip
    // 移入编辑器、变 accent 高亮的"网页搜索"，即已启用；启用后建议行消失。自校验 + 失败重载重试。
    // 返回 true=已开启 / false=未生效（engine 据此重试）。
    setupMode: async (page) => {
        const isOn = () =>
            page.evaluate(() => {
                const ed = document.querySelector('#prompt-textarea');
                return !!ed && ed.innerText.includes('网页搜索');
            }).catch(() => false);
        const clickChip = async () => {
            // 并行时页面加载慢：先等 chip 渲染出来再点；等不到再程序化兜底
            try {
                const chip = page.locator('button').filter({ hasText: /^\s*搜索网页\s*$/ }).last();
                await chip.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
                await chip.click({ timeout: 5000 });
            } catch (_) {
                await page.evaluate(() => {
                    const el = [...document.querySelectorAll('button')]
                        .find((b) => (b.textContent || '').trim() === '搜索网页' && b.offsetParent !== null);
                    if (el) el.click();
                });
            }
            await page.waitForTimeout(1500);
        };
        if (await isOn()) return true;

        await clickChip();
        if (await isOn()) return true;

        // 未生效（如落在旧会话页，无建议 chip）→ 重载一次重试
        await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
        await page.waitForTimeout(4000);
        await clickChip();
        return await isOn();
    },
};
