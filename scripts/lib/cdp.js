/**
 * 最小 CDP 连接助手 — 连接共享 Chrome（已登录各 AI 站点的浏览器）。
 *
 * 只负责两件事：安全加载 .env、连上 CDP 端口。端口没开时用系统 Chrome
 * 简单拉起一个调试实例（同 profile，登录态复用）。可靠的 Chrome 生命周期
 * 管理仍建议用 AgentChat 的 scripts/start-chrome.ps1。
 */
'use strict';

const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// ── 安全 .env 加载（严格 KEY=VALUE，绝不用 source）──
function loadDotEnv() {
    try {
        const text = require('fs').readFileSync(path.resolve(__dirname, '..', '..', '.env'), 'utf8');
        for (const raw of text.split(/\r?\n/)) {
            const line = raw.trim();
            if (!line || line.startsWith('#')) continue;
            const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
            if (!m) continue;
            if (!(m[1] in process.env)) process.env[m[1]] = m[2].trim();
        }
    } catch (_) { /* 无 .env 时用默认值 */ }
}
loadDotEnv();

const CDP_PORT = process.env.CDP_PORT || '9222';
const CDP_HOST = process.env.CDP_HOST || '127.0.0.1';
const CDP_URL = `http://${CDP_HOST}:${CDP_PORT}`;

function probe(url = CDP_URL, ms = 2000) {
    return new Promise((resolve) => {
        const req = http.get(url + '/json/version', (r) => { r.resume(); resolve(r.statusCode === 200); });
        req.on('error', () => resolve(false));
        req.setTimeout(ms, () => { req.destroy(); resolve(false); });
    });
}

/** 确保 CDP 可达，必要时简单拉起一次 Chrome。 */
async function ensureChromeCdp() {
    if (await probe()) return { up: true, autostarted: false };

    const exe = process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const profile = process.env.CHROME_PROFILE || path.join(os.homedir(), '.chrome-debug-profile');
    const args = [
        `--remote-debugging-port=${CDP_PORT}`,
        '--remote-debugging-address=127.0.0.1',
        `--user-data-dir=${profile}`,
        '--disable-background-networking', '--no-first-run', '--no-default-browser-check',
        'about:blank',
    ];
    try {
        const child = spawn(exe, args, { detached: true, stdio: 'ignore' });
        child.unref();
        for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            if (await probe()) return { up: true, autostarted: true };
        }
        return { up: false, autostarted: true, reason: 'Chrome 启动后端口未就绪（可能被已有实例吸收）' };
    } catch (e) {
        return { up: false, autostarted: false, reason: e.message };
    }
}

module.exports = { CDP_URL, ensureChromeCdp, probe };
