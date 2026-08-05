/**
 * 最小回执生成器 — 每次真实执行产生机器可验证的 run_id。
 *
 * 格式与 AgentChat 的 receipt 兼容：`[receipt] AGENTCHAT_RUN {json}`，
 * 可被 `grep run_id` 核对，证明"确实执行了"而非叙述。
 */
'use strict';

function makeRunId() {
    // 随机 12 位十六进制，前缀 ac-（agentchat 风格）
    return 'ac-' + Math.random().toString(16).slice(2, 14);
}

function emitReceipt({ skill = 'web-ai-chat', runId = makeRunId(), fields = {}, stream = 'stderr' } = {}) {
    const payload = { run_id: runId, skill, timestamp: new Date().toISOString(), ...fields };
    const line = `[receipt] AGENTCHAT_RUN ${JSON.stringify(payload)}`;
    process[stream].write(line + '\n');
    return payload;
}

module.exports = { makeRunId, emitReceipt };
