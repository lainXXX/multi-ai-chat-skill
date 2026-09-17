/**
 * AI Studio — aistudio.google.com/prompts/new_chat（新版 Playground UI，2026-09 实测）
 * Angular 应用：原生 textarea 输入，Ctrl+Enter 发送，
 * 回复 = ms-chat-turn > .virtual-scroll-container.model-prompt-container。
 * 注意：旧版聊天 DOM（ms-text-chunk / .chat-turn-container.model）已被此次改版移除，
 * 同机 aistudio-chat-skill 的选择器同样失效，勿再参考。
 */
'use strict';

module.exports = {
    key: 'aistudio',
    name: 'AI Studio',
    url: 'https://aistudio.google.com/prompts/new_chat',
    hosts: ['aistudio.google.com'],
    authDomains: ['accounts.google.com'],
    // Angular 水合慢：实测页面加载后 8s 仍无输入框，15s 才稳定出现
    navPostDelay: 12000,
    // 水合时机随负载浮动（并行 6 路实测 >12s，navPostDelay 固定等待不够 → no_editor），
    // 改为主动等输入框可见；复用引擎的 setupMode 重试（setupModeRetries → 最多 3 次）。
    setupMode: async (page) => {
        try {
            await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 40000 });
            return true;
        } catch (_) { return false; }
    },
    // 用 fill()（原生 setter + input 事件）而非 insertText：textarea 由 Angular
    // FormControl 接管，实测 fill() 能正确同步，Ctrl+Enter 提交的提示词完整。
    fillInput: true,
    editorSelectors: [
        'textarea[placeholder*="Start typing a prompt"]',
        'textarea[placeholder*="Enter a prompt"]',
        'textarea',
        '[role="textbox"]',
    ],
    // Run 按钮的实际文本是 "Run Ctrl keyboard_return"（含快捷键提示），
    // 精确匹配 "Run" 会落空，按前缀匹配又会撞上 "Run settings" 面板里的按钮，
    // 故不走按钮点击，直接用按钮上标明的官方快捷键 Ctrl+Enter。
    sendSelectors: [],
    sendFallback: 'Control+Enter',
    responseSelectors: [
        // 取模型回复容器。用户消息是 .user-prompt-container，天然不匹配；
        // 底部的 ms-hallucinations-disclaimer 也在容器外，不会被读进来。
        'div.virtual-scroll-container.model-prompt-container',
        'div[class*="model-prompt-container"]',
        'ms-chat-turn.text-chunk-host',
    ],
    // 每次新回复都会新增 ms-chat-turn 节点，可作选择器漂移的"消息数增量"校验
    responseCountSelectors: ['ms-chat-turn'],
    stabilityWindow: 10000,
    minResponseLength: 1,
    // 模型会先产生一个独立的"思考"turn，其文本（Thoughts / Expand to view model
    // thoughts）本身是稳定的，若不加此模式会被当最终答案提前收尾。命中则重置稳定性
    // 时钟，等真正的回答 turn 出现（回答 turn 出现后 .last() 自然指向它）。
    stillGeneratingPattern: /Thoughts|Expand to view model thoughts|View thoughts/,
    // 生成中 Run 按钮变 Stop，结束即消失
    stillGeneratingCheck: async (page) =>
        page.locator('button', { hasText: /^\s*Stop/ }).count().then((n) => n > 0).catch(() => false),
    // 回复容器的 innerText 会带上 turn 抬头（"Model 17:06"），剥掉它只留正文
    postResponseHook: async (page, text) => text.replace(/^\s*Model\s+\d{1,2}:\d{2}(:\d{2})?\s*/, '').trim(),
};
