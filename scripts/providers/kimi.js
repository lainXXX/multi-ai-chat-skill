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
    // 答案可能很短（如"北京"），minLength 太高会把短答案当没回复等满超时
    minResponseLength: 2,
    // 生成中会执行 Python 代码并展示"运行 Python 代码"按钮，稳定时不会被当完成。
    // 但仍可能等满超时后把半成品当答案返回 → incompletePattern 兜底判 no_response 重试。
    // 用代码执行类任务时回答耗时可能超过默认 600s，单独放大超时。
    timeout: 900000,
    incompletePattern: /运行 Python 代码|执行 Python/,
    // 联网搜索过渡态：搜索时顶部会出现"搜索网页 + 查询词 + N 个结果"，会稳定不变，
    // 若不加此模式会被当成最终答案（假成功）。匹配时重置稳定性时钟，等真实回答出现。
    // 注意：搜索头会一直留在回答元素里，所以必须锚定"以 个结果 结尾"（过渡态整条=搜索头），
    // 若只写"个结果"会连最终回答也一直匹配，导致每次都等满超时。
    stillGeneratingPattern: /正在搜索|个结果$|运行 Python 代码|执行 Python/,
    postResponseHook: async (_p, t) => t
        // 剥离思考横幅与页脚噪音
        .replace(/^思考已完成\n?/i, '')
        .replace(/高峰时段算力不足.*$/s, '')
        .replace(/\n?!\[[^\]]*\]\(https:\/\/avatar\.moonshot\.cn\/[^\s)]+\)\s*$/g, '')
        .trim(),
};
