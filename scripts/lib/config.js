/**
 * config.js — YAML 配置加载器。
 *
 * 读取项目根目录的 config.yml（YAML），解析后导出。
 * 用法: const CONFIG = require('../lib/config');
 */
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const file = path.resolve(__dirname, '..', '..', 'config.yml');
let CONFIG = {};
try {
    CONFIG = yaml.load(fs.readFileSync(file, 'utf8')) || {};
} catch (e) {
    process.stderr.write(`[config] 读取 config.yml 失败: ${e.message}\n`);
}

module.exports = CONFIG;
