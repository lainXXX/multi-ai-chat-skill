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
    // AI 回复容器：用户气泡与 AI 回复都是 .md-box-root，但用户气泡祖先含
    // "send-msg-bubble"/"justify-end"，AI 回复在 "space-y-20" 消息流容器内。
    // 2026-08 实测 [class*="space-y-20"] .md-box-root 只匹配 AI 回复。
    responseSelectors: [
        '[class*="space-y-20"] .md-box-root',
        '[class*="md-box-root"]',
        '[class*="markdown-body"]',
        '[class*="markdown"]',
    ],
    stabilityWindow: 10000,
    // 单字/短答案（如"北京"）可能很短，minLength 太高会把短答案当没回复等满超时
    minResponseLength: 2,
    // 服务提示/额度用尽（如"免费额度用完…恢复为你服务"）不是答案：命中即判 refused 不重试，
    // 避免把额度提示当研究结果落盘（2026-08 实测曾把额度提示记成 ok:true 的假成功）。
    refusalPattern: /额度|免费|专业版|恢复为你服务|开通豆包|休息一阵/,
    // 选择"专家模式"（专家研究级专业问答 - 2.1 Turbo）
    // 2026-08 实测：必须用 Playwright 原生 click（真实指针事件）才会弹下拉，程序化 el.click() 无效。
    // 并行时页面加载慢：一律先等元素渲染再点；自校验模式按钮文本，未生效返回 false 让 engine 重试。
    setupMode: async (page) => {
        const isExpertOn = () =>
            page.evaluate(() => {
                const btns = [...document.querySelectorAll('button')].filter((x) => x.offsetParent !== null);
                const b = btns.find((x) => {
                    const t = (x.textContent || '').trim();
                    return t.length <= 20 && /快速|专家|深度思考|AI搜索|探究/.test(t);
                });
                return !!b && /专家/.test(b.textContent || '');
            }).catch(() => false);

        const openDropdown = async () => {
            try {
                const btn = page.locator('button[class*="justify-center"]:has-text("快速")').first();
                await btn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
                await btn.click({ force: true, timeout: 5000 });
                return true;
            } catch (_) {
                try {
                    await page.locator('button:has-text("快速")').nth(1).click({ force: true, timeout: 5000 });
                    return true;
                } catch (_) { return false; }
            }
        };
        const pickExpert = async () => {
            try {
                const item = page.locator('text=专家研究级专业问答').first();
                await item.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
                await item.click({ timeout: 6000 });
                return true;
            } catch (_) {
                try {
                    await page.evaluate(() => {
                        const el = [...document.querySelectorAll('*')].find((e) => (e.textContent || '').includes('专家研究级专业问答') && e.offsetParent !== null);
                        if (el) el.click();
                    });
                    return true;
                } catch (_) { return false; }
            }
        };

        if (await isExpertOn()) return true;

        for (let attempt = 0; attempt < 2; attempt++) {
            if (await openDropdown()) {
                await page.waitForTimeout(1200);
                await pickExpert();
                await page.waitForTimeout(1000);
                if (await isExpertOn()) return true;
            }
            await page.waitForTimeout(1500);
        }
        return false;
    },
};
