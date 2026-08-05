/**
 * Google AI Studio — aistudio.google.com/prompts/new_chat
 * textarea 输入，Enter 发送，.chat-turn-container.model .turn-content 回复
 * （2026-08 实测；postResponseHook 剥离 turn 头前缀）。
 */
'use strict';

module.exports = {
    key: 'aistudio',
    name: 'AI Studio',
    url: 'https://aistudio.google.com/prompts/new_chat?model=gemini-3.1-pro-preview',
    hosts: ['aistudio.google.com'],
    authDomains: ['accounts.google.com', 'aistudio.google.com/login'],
    navPostDelay: 4000,
    // 2026-08 实测：编辑器不认 insertText（会返回 internal error），用 fill 整段写入
    fillInput: true,
    editorSelectors: [
        'textarea[placeholder*="prompt"]',
        'textarea[placeholder*="Start typing"]',
        'textarea',
    ],
    // 2026-08 实测：AI Studio 提交键是 Ctrl+Enter（Enter 只是换行）→ 之前一直 no_response
    sendFallback: 'ControlOrMeta+Enter',
    responseSelectors: [
        '.chat-turn-container.model .turn-content',
        '[class*="chat-turn-container"][class*="model"] [class*="turn-content"]',
        '[class*="turn-content"]',
    ],
    stabilityWindow: 10000,
    minResponseLength: 5,
    // 3.1 Pro Preview 思考阶段可能 >10s，文本停在"正在思考"会被误判完成 → 匹配时继续等
    stillGeneratingPattern: /正在思考|thinking|working/i,
    postResponseHook: async (_p, t) =>
        t.replace(/^Model\s+\d{1,2}:\d{2}\s*(?:error)?\s*/i, '').trim(),
    // 选择模型 gemini-3.1-pro-preview（2026-08 实测：点 model-selector-card → 找文本祖先可点击元素）
    setupMode: async (page) => {
        // 开启 Grounding with Google Search（联网）。模型由 URL ?model= 直接指定，
        // 不做 UI 模型切换（实测 UI 切换会让下一条消息返回 internal error）。
        const grounding = page.locator('mat-slide-toggle[class*="search-as-a-tool"]');
        await grounding.waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
        const isOn = await grounding.evaluate((el) => (el.className || '').toString().includes('checked')).catch(() => false);
        if (!isOn) await grounding.click().catch(() => {});
        await page.waitForTimeout(1000);
    },
};
