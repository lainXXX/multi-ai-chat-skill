/**
 * 最小终端日志 — 一律走 stderr（stdout 是机器契约，只放 AI 回答/JSON）。
 */
'use strict';

function log(prefix, msg) {
    process.stderr.write(`[${prefix}] ${msg}\n`);
}

module.exports = { log };
