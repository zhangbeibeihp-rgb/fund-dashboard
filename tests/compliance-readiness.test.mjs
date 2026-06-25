import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const dashboard = readFileSync('portfolio-rebalance-dashboard.html', 'utf8');
const login = readFileSync('login.html', 'utf8');
const report = readFileSync('launch-readiness-audit-2026-06-24-current.md', 'utf8');

const forbiddenDashboardTerms = [
  'AI投资顾问',
  '投资建议引擎',
  '获取建议',
  '建议买入',
  '建议减仓',
  '择机建仓'
];

for (const term of forbiddenDashboardTerms) {
  assert.equal(
    dashboard.includes(term),
    false,
    `dashboard should not expose advisory wording: ${term}`
  );
}

assert.match(dashboard, /智能测算|目标分析/, 'dashboard should use tool-style wording');
assert.match(dashboard, /syncStatusBadge/, 'dashboard should expose a sync status badge');
assert.match(dashboard, /openPrivacyDialog/, 'dashboard should expose privacy terms');
assert.match(dashboard, /clearAllUserData/, 'dashboard should expose user data deletion');
assert.match(dashboard, /图片仅在浏览器本地识别/, 'OCR privacy copy should explain local-only image processing');

assert.match(login, /agreePrivacy/, 'login should require privacy agreement');
assert.match(login, /openPrivacyDialog/, 'login should expose privacy terms');
assert.match(login, /用户协议/, 'login should reference user terms');
assert.match(login, /隐私说明/, 'login should reference privacy notice');

assert.equal(report.includes('api/ocr.js 已删除'), false, 'current report should not describe deleted code as active evidence');
assert.match(report, /P1-1[\s\S]*已完成/, 'report should mark PWA icon cache item complete');
assert.match(report, /P1-4[\s\S]*已完成/, 'report should mark OCR confirmation item complete');

console.log('compliance readiness checks passed');
