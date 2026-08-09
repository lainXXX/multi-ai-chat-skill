/**
 * provider 注册表 — 6 个 web AI 的驱动配置。
 * CHAIN = 单问时的降级顺序（ask.js 默认顺序）。
 */
'use strict';

const qwen = require('./qwen');
const deepseek = require('./deepseek');
const kimi = require('./kimi');
const doubao = require('./doubao');
const chatgpt = require('./chatgpt');
const gemini = require('./gemini');
const grok = require('./grok');

const ALL = { qwen, deepseek, kimi, doubao, chatgpt, gemini, grok };

// 降级链顺序（单问未指定 --only 时按此尝试）
const CHAIN = [chatgpt, grok, qwen, kimi, deepseek, doubao, gemini];

module.exports = { ALL, CHAIN };
