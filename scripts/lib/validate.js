/**
 * validate.js — 回答有效性分类器（P0：治理"假成功"）。
 *
 * 职责：把"提取到的文本"判定为 ok / suspicious / blocked，让 ok:true 的语义
 * 从"脚本提取到文本"升级为"获得可信回答"，避免限流/额度提示、旧会话残留、
 * 长验证码/风控页被当成有效研究结果落盘。
 *
 * 两层判定：
 *   classifyPage()  — 页面级硬拦截（URL / document.title / 风控 DOM 元素），
 *                     命中即 blocked，无长度豁免。覆盖 >200 字符的长错误页——
 *                     这类页面通常无法用文本长度区分，但 URL/标题特征明确。
 *   classify()      — 文本级分类：
 *                     blocked（错误/限流/额度/登录/验证码文案且与问题无关即拦截，
 *                              长度无关，覆盖 >200 字符的长句错误页；"与问题相关" =
 *                              回答复述了问题关键词，即讨论这些话题的合法回答 → 放行）
 *                   → suspicious（STALE：与基线相似度 >0.9，兼容格式微调；
 *                                 TOO_SHORT：低于阈值；NO_NEW：发送前后消息数未增）
 *                   → ok（其余）。
 */
'use strict';

// 通用"不是有效回答"文案，兜底在各 provider 自有 refusalPattern/errorPatterns 之后
const GENERAL_ERROR_PATTERNS = [
    /额度|免费.{0,6}(用尽|用完)|限流|配额|quota|rate limit/i,
    /请稍后再试|服务.{0,6}(不可用|异常)|暂时.{0,4}(不可用|无法)|server (error|unavailable)|network error/i,
    /验证码|人机验证|captcha|安全验证/i,
    /登录|登录已过期|session expired|请重新登录|sign in/i,
    /升级.{0,6}(会员|专业版|付费)|开通.{0,4}(会员|专业版)/i,
    /(发生了|出现)(错误|异常)|something went wrong|internal error/i,
];

// 页面级风控特征：URL / 标题 / DOM 选择器。
// URL 含登录/验证/挑战关键词，或标题是已知风控页，或出现挑战框架元素 → blocked。
const PAGE_URL_PATTERNS = [
    /\/(login|signin|sign-in|auth|captcha|verify|verification|challenge|rate[-_]?limit)\/?([?#].*)?$/i,
    /captcha|challenge|human.?verif/i,
];
const PAGE_TITLE_PATTERNS = [
    /just a moment/i,
    /attention required/i,
    /access (denied|restricted)/i,
    /verify|verification|验证|人机验证/i,
    /challenge/i,
    /please wait/i,
];
const PAGE_DOM_SELECTORS = [
    '#cf-challenge-form',
    '[class*="captcha"]',
    '[id*="challenge"]',
    '[id*="cf-error-details"]',
];

// 中文通用词（怎么/什么/如何/哪个 等）不是内容关键词，参与重叠度计算会稀释精度。
const STOPWORDS = new Set(['怎么', '什么', '如何', '哪个', '哪些', '一个', '一种', '进行', '比较', '一下', '可以', '请问', '帮我', '需要', '应该', '考虑', '选择', '使用', '为什么', '还是', '之间', '区别', '什么情况']);
// 文本与问题的内容重叠度：0~1。用于区分"错误提示页"与"复述问题关键词的回答"——
// 回答通常会带回问题里的术语，错误提示页不会。
function promptOverlap(t, prompt) {
    const words = new Set();
    for (const m of String(prompt).match(/[A-Za-z]{4,}|[\u4e00-\u9fa5]{2,}/g) || []) {
        if (!STOPWORDS.has(m)) words.add(m);
    }
    if (!words.size) return 1; // 无可用关键词（如纯符号/单字）→ 不拦截
    let hit = 0;
    for (const w of words) if (t.includes(w)) hit++;
    return hit / words.size;
}

/** bigram 集合包含度：a 的 bigram 有多大比例出现在 b 里（不对称）。0=无重叠，1=a⊆b。
 * 用于检测"提取文本是 prompt 的子集"（气泡回声）：prompt 中插入序号/标点时
 * Jaccard 会因 b 的额外 bigram 被过度惩罚，包含度不受影响。 */
function containmentRatio(a, b) {
    const bigrams = (s) => {
        const set = new Set();
        for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
        return set;
    };
    const x = bigrams(a), y = bigrams(b);
    if (!x.size || !y.size) return a === b ? 1 : 0;
    let inter = 0;
    for (const g of x) if (y.has(g)) inter++;
    return inter / x.size;
}

/** bigram 集合 Jaccard 相似度（O(n)，对大文本友好）。0=完全不同，1=完全相同。 */
function similarityRatio(a, b) {
    const bigrams = (s) => {
        const set = new Set();
        for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
        return set;
    };
    const x = bigrams(a), y = bigrams(b);
    if (!x.size || !y.size) return a === b ? 1 : 0;
    let inter = 0;
    for (const g of x) if (y.has(g)) inter++;
    const union = x.size + y.size - inter;
    return union ? inter / union : 0;
}

/** 是否"提取到用户问题本身"（选择器误匹配用户气泡）：
 * 文本与 prompt 精确相等，或长度 >=20 且文本 bigram 绝大多数（>=0.85）也出现在 prompt 里。
 * 站点对气泡做格式微调（剥序号/加空格换行，如豆包回显）会让严格相等失效——包含度
 * 把"提取文本是 prompt 的微调子集"识别出来；合法长回答绝大多数 bigram 在 prompt 之外，
 * 包含度天然低，不会误伤。 */
function isEcho(text, prompt) {
    const a = String(text || '').replace(/\s+/g, '').toLowerCase();
    const b = String(prompt || '').replace(/\s+/g, '').toLowerCase();
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length >= 20 && containmentRatio(a, b) >= 0.85) return true;
    return false;
}

/**
 * 页面级风控/验证判定（在问答开始前调用）。命中即硬失败，无长度豁免。
 * @param {object} p { url, title, domHits }
 * @returns {{ blocked:boolean, flag:string, reason:string }}
 */
function classifyPage({ url = '', title = '', domHits = 0 } = {}) {
    if (PAGE_URL_PATTERNS.some((re) => re.test(url))) return { blocked: true, flag: 'URL_RISK', reason: 'URL 命中风控/登录/验证特征' };
    if (PAGE_TITLE_PATTERNS.some((re) => re.test(title))) return { blocked: true, flag: 'TITLE_RISK', reason: '标题命中风控/验证特征' };
    if (domHits > 0) return { blocked: true, flag: 'DOM_CHALLENGE', reason: '检测到验证码/挑战框架元素' };
    return { blocked: false, flag: '', reason: '' };
}

/**
 * @param {object} args
 * @param {string} args.text        提取到的回答
 * @param {string} [args.baseline]  发送前最后一条匹配文本（用于 STALE 检测）
 * @param {string} [args.prompt]    原始问题（用于判断错误文案是否与问题相关，避免误杀
 *                                  "复述问题关键词的短回答"）
 * @param {boolean} [args.noNewMessage] 发送前后响应容器消息数未增（选择器可能匹配到静态区域）
 * @param {object} [args.cfg]       provider 配置（errorPatterns / suspiciousLengthThreshold）
 * @returns {{status:'ok'|'suspicious'|'blocked', flags:string[]}}
 */
function classify({ text, baseline = null, prompt = null, noNewMessage = false, cfg = {} } = {}) {
    const t = String(text || '').trim();
    const flags = [];
    const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

    const errPats = [...GENERAL_ERROR_PATTERNS, ...(cfg.errorPatterns || [])];
    const errHit = errPats.some((p) => p.test(t));
    // 错误/限流/额度/登录/验证码文案且与问题无关 → blocked，长度无关（解决 >200 字符
    // 长句错误页漏网）。"与问题相关" = 回答复述了问题关键词（讨论这些话题的合法回答）→
    // 放行交后续 STALE/TOO_SHORT 判断。错误提示页不会复述问题术语，必被拦截。
    if (errHit && !(prompt && promptOverlap(norm(t), norm(prompt)) >= 0.12)) {
        return { status: 'blocked', flags: ['ERROR_TEXT'] };
    }

    // 旧会话残留：发送前基线 vs 提取文本。用相似度而非精确相等——站点对消息做格式
    // 微调（加空格/换行）会让精确匹配失效，相似度 >0.9 仍判 STALE。
    if (baseline && similarityRatio(norm(t), norm(baseline)) > 0.9) {
        return { status: 'suspicious', flags: ['STALE'] };
    }

    // 发送前后消息数未增且文本非基线：选择器可能匹配到不随回答变化的静态区域。
    if (noNewMessage && baseline && similarityRatio(norm(t), norm(baseline)) <= 0.9) {
        flags.push('NO_NEW');
    }

    const threshold = cfg.suspiciousLengthThreshold != null ? cfg.suspiciousLengthThreshold : 40;
    if (t.length < threshold) flags.push('TOO_SHORT');

    return { status: flags.length ? 'suspicious' : 'ok', flags };
}

module.exports = { classify, classifyPage, isEcho, similarityRatio, containmentRatio, promptOverlap, GENERAL_ERROR_PATTERNS, PAGE_DOM_SELECTORS };
