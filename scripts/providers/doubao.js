/**
 * Doubao（豆包）— www.doubao.com/chat
 * textarea 输入，Enter 发送，md-box 回复（2026-08 实测）。
 */
'use strict';

module.exports = {
    key: 'doubao',
    name: 'Doubao',
    url: 'https://www.doubao.com/chat/',
    hosts: ['doubao.com'],
    authDomains: ['doubao.com/login', 'sso.doubao.com'],
    navPostDelay: 3000,
    editorSelectors: [
        'textarea[placeholder*="发消息"]',
        'textarea',
    ],
    sendFallback: 'Enter',
    responseSelectors: [
        '[class*="md-box-root"]',
        '[class*="md-box"]',
        '[class*="markdown-body"]',
        '[class*="markdown"]',
    ],
    stabilityWindow: 10000,
    minResponseLength: 10,
    // 选择"专家模式"（专家研究级专业问答 - 2.1 Turbo）
    // 2026-08 实测：必须用 Playwright 原生 click（真实指针事件）才会弹下拉，程序化 el.click() 无效。
    setupMode: async (page) => {
        let opened = false;
        try {
            await page.locator('button[class*="justify-center"]:has-text("快速")').first().click({ force: true, timeout: 5000 });
            opened = true;
        } catch (_) {
            try {
                await page.locator('button:has-text("快速")').nth(1).click({ force: true, timeout: 5000 });
                opened = true;
            } catch (_) { /* 已打开或无法打开 */ }
        }
        await page.waitForTimeout(1200);
        if (opened) {
            try {
                await page.locator('text=专家研究级专业问答').first().click({ timeout: 6000 });
            } catch (_) {
                await page.evaluate(() => {
                    const el = [...document.querySelectorAll('*')].find((e) => (e.textContent || '').includes('专家研究级专业问答') && e.offsetParent !== null);
                    if (el) el.click();
                });
            }
            await page.waitForTimeout(1000);
        }
    },
};
