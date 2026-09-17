/**
 * provider 注册表 — 6 个 web AI 的驱动配置。
 * CHAIN = 单问时的降级顺序（ask.js 默认顺序）。
 */
'use strict';

const qwen = require('./qwen');
const deepseek = require('./deepseek');
const kimi = require('./kimi');
const chatgpt = require('./chatgpt');
const gemini = require('./gemini');
const aistudio = require('./aistudio');

const ALL = { qwen, deepseek, kimi, chatgpt, gemini, aistudio };

// 降级链顺序（单问未指定 --only 时按此尝试）
const CHAIN = [chatgpt, qwen, kimi, deepseek, gemini, aistudio];

module.exports = { ALL, CHAIN };
