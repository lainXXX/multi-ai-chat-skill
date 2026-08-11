#!/usr/bin/env node
/**
 * validate.test.js — P0 假成功分类器回归测试（无外部依赖，node 直接跑）。
 *
 * 覆盖：页面级风控拦截 / 长句错误页 / 合法讨论放行 / STALE 精确与格式微调 /
 * TOO_SHORT / NO_NEW / provider 自定义 errorPatterns。
 *
 * 运行：node evals/validate.test.js   （npm test）
 * 用途：改 validate.js / engine.js 后回归，防止假成功治理退化。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { classify, classifyPage, isEcho } = require(path.resolve(__dirname, '..', 'scripts', 'lib', 'validate'));

const fix = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const QUOTA_LONG = fix('quota_long.md');
const CAPTCHA_LONG = fix('captcha_long.md');
const REAL_ANSWER = fix('real_answer.md');
const STALE = fix('stale_answer.md');

// 问题（与错误页无关，验证"错误文案与问题无关 → blocked"）
const P_REDIS = 'Redis 集群架构方案';
// 问题（与限流讨论相关，验证"复述问题关键词的合法回答 → 放行"）
const P_LIMIT = '如何应对 API 限流？';

let pass = 0, fail = 0;
function check(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    ok ? pass++ : fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) console.log(`        got      ${JSON.stringify(actual)}\n        expected ${JSON.stringify(expected)}`);
}

// ── 页面级（classifyPage）──
check('page: URL 含 /captcha → blocked', classifyPage({ url: 'https://x.com/captcha', title: 'Chat' }).blocked, true);
check('page: 标题风控 → blocked', classifyPage({ url: 'https://x.com/', title: 'Just a moment...' }).blocked, true);
check('page: 挑战 DOM → blocked', classifyPage({ url: 'https://x.com/', title: 'Chat', domHits: 1 }).blocked, true);
check('page: 正常聊天页 → 放行', classifyPage({ url: 'https://chatgpt.com/', title: 'ChatGPT' }).blocked, false);

// ── 文本级（classify）──
check('短限流文案且与问题无关 → blocked', classify({ text: '免费额度用尽，请稍后再试', prompt: P_REDIS }).status, 'blocked');
check('>200 字长句额度页且与问题无关 → blocked', classify({ text: QUOTA_LONG, prompt: P_REDIS }).status, 'blocked');
check('>200 字长句验证码页且与问题无关 → blocked', classify({ text: CAPTCHA_LONG, prompt: P_REDIS }).status, 'blocked');
check('讨论限流的合法回答（复述问题关键词）→ ok', classify({ text: REAL_ANSWER, prompt: P_LIMIT }).status, 'ok');
check('旧会话残留（与基线一致）→ suspicious', classify({ text: STALE, baseline: STALE, prompt: P_REDIS }).status, 'suspicious');
check('STALE 格式微调（加空格/换行）仍识别', classify({ text: STALE.replace(/\s/g, ' ').replace(/(。)/g, '$1\n'), baseline: STALE, prompt: P_REDIS }).flags.includes('STALE'), true);
check('全新长回答 vs 旧基线 → ok', classify({ text: '这是全新的回答，讨论 Redis 集群架构方案的完整设计，包含分片、主从、哨兵与故障转移等要点。', baseline: STALE, prompt: P_REDIS }).status, 'ok');
check('过短回答 → TOO_SHORT', classify({ text: '嗯', prompt: P_REDIS }).flags.includes('TOO_SHORT'), true);
check('消息数未增且文本非基线 → NO_NEW', classify({ text: '静态区域文本内容', baseline: STALE, prompt: P_REDIS, noNewMessage: true }).flags.includes('NO_NEW'), true);
check('provider 自定义 errorPatterns 生效', classify({ text: '专业版免费额度用尽', prompt: P_REDIS, cfg: { errorPatterns: [/专业版/] } }).status, 'blocked');

// ── isEcho（提取到用户气泡）──
check('echo: 与问题精确一致 → true', isEcho('请对比向量数据库', '请对比向量数据库'), true);
check('echo: 剥序号/加换行的气泡回显 → true', isEcho('请对比向量数据库。\n必须覆盖 5 个以上。\n请直接开始作答。', '请对比向量数据库。\n1. 必须覆盖 5 个以上。\n2. 请直接开始作答。'), true);
check('echo: 完整长回答（含引用问题）→ false', isEcho('请对比向量数据库，这是一个技术选型问题。以下从架构、精度、性能逐一分析……（长回答正文）', '请对比向量数据库'), false);
check('echo: 短文本 → false', isEcho('嗯', '请对比向量数据库'), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
