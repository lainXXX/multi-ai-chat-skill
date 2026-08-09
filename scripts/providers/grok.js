/**
 * Grok — grok.com
 * ProseMirror contenteditable 输入（aria-label "Ask Grok anything"），Enter 发送
 * （提交按钮在空态 disabled，点它有时会被 disabled 点击吞掉 → 直接用 Enter）。
 * 回复容器 .response-content-markdown 同时渲染用户与助手消息，取最后一个。
 * 未登录时只回显问题并弹登录墙（不回答）→ 由 no_response 兜底。
 */
'use strict';

module.exports = {
    key: 'grok',
    name: 'Grok',
    url: 'https://grok.com/',
    hosts: ['grok.com'],
    authDomains: ['auth.x.ai', 'x.com', 'accounts.google.com'],
    navPostDelay: 4000,
    editorSelectors: [
        '[contenteditable="true"][aria-label="Ask Grok anything"]',
        'div[contenteditable="true"]',
        '[contenteditable="true"]',
    ],
    sendSelectors: [],
    sendFallback: 'Enter',
    // 助手消息行是 items-start（用户是 items-end）→ 用它限定，避免误匹配用户气泡；
    // 用户回复容器 .response-content-markdown 也会渲染用户问题，仅作兜底。
    responseSelectors: [
        '[class*="items-start"] [class*="response-content-markdown"]',
        '[class*="items-start"] [class*="message-bubble"]',
        '[class*="response-content-markdown"]',
    ],
    stabilityWindow: 10000,
    minResponseLength: 2,
};
