/**
 * Kimi — www.kimi.com
 * React SPA：contenteditable 输入，Enter 发送，chat-content 回复。
 */
'use strict';

module.exports = {
    key: 'kimi',
    name: 'Kimi',
    url: 'https://www.kimi.com/',
    hosts: ['kimi.com', 'kimi.moonshot.cn'],
    authDomains: ['kimi.moonshot.cn/login', 'kimi.com/login'],
    navPostDelay: 4000,
    editorSelectors: [
        '.chat-input-editor',
        '[contenteditable="true"][role="textbox"]',
        '[contenteditable="true"]',
        '[role="textbox"]',
    ],
    sendFallback: 'Enter',
    responseSelectors: [
        '[class*="chat-content-item-assistant"]',
        '[class*="segment-content"]',
        '[class*="assistant"]',
        '[class*="markdown"]',
    ],
    stabilityWindow: 8000,
    minResponseLength: 10,
    postResponseHook: async (_p, t) => t
        // 剥离思考横幅与页脚噪音
        .replace(/^思考已完成\n?/i, '')
        .replace(/高峰时段算力不足.*$/s, '')
        .replace(/\n?!\[[^\]]*\]\(https:\/\/avatar\.moonshot\.cn\/[^\s)]+\)\s*$/g, '')
        .trim(),
};
