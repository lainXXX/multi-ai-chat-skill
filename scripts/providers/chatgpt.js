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
        // 整轮回复容器（含思考/搜索过程），比 .markdown 稳：大回复若渲染成多个
        // .markdown 片段，.last() 只拿到最后一段会截断。
        '[data-message-author-role="assistant"]',
        '.markdown',
        '.agent-turn',
        '[class*="response"]',
    ],
    // 每次新回复都会新增一个 assistant 节点（2026-08 实测），可作"消息数增量"校验：
    // 选择器漂移匹配到静态区域时，发送前后 count 不变 → 判 NO_NEW 可疑。
    responseCountSelectors: ['[data-message-author-role="assistant"]'],
    stabilityWindow: 10000,
    minResponseLength: 5,
    // 仍在生成时 ChatGPT 显示 stop 按钮（[data-testid="stop-button"]），生成结束即消失。
    // 并行 6 进程共享一个 Chrome 时流式会暂停 10s+，仅靠文本稳定窗口会把半成品当完成
    // （实测曾截断到 4 条/119 字符）。stop 按钮在 → 重置稳定性时钟，等真正结束。
    stillGeneratingCheck: async (page) =>
        page.locator('[data-testid="stop-button"]').count().then((n) => n > 0).catch(() => false),
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
