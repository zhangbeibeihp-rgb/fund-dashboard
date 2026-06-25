import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('portfolio-rebalance-dashboard.html', 'utf8');

assert.match(html, /pc-workspace-shell/, 'PC page should use workspace shell');
assert.match(html, /pc-side-nav/, 'PC page should expose side navigation');
assert.match(html, /pc-topbar/, 'PC page should expose top status bar');
assert.match(html, /pc-assist-panel/, 'PC page should expose right assist panel');
assert.match(html, /mobile-dashboard\.html/, 'PC page should link to mobile H5 entry');

const containerStart = html.indexOf('<div class="container">');
const pcTopbarStart = html.indexOf('<div class="pc-topbar">', containerStart);
assert.ok(containerStart >= 0, 'PC page should have a container');
assert.ok(pcTopbarStart > containerStart, 'pc-topbar should be inside the container');

for (const legacySelector of ['header-new', 'ai-goal-section', 'style-bar']) {
  const legacyStart = html.indexOf(legacySelector, containerStart);
  assert.ok(
    legacyStart === -1 || legacyStart > pcTopbarStart,
    `${legacySelector} should not appear before pc-topbar`
  );
}

const topbarEnd = html.indexOf('<div class="pc-workspace-shell">', pcTopbarStart);
const topbarToShell = html.slice(pcTopbarStart, topbarEnd);
assert.match(topbarToShell, /基金组合管理仪表盘/, 'pc-topbar should be the first major PC surface');

for (const nav of ['总览', '持仓', '交易', '目标', '复核', '设置']) {
  assert.match(html, new RegExp(`data-pc-nav=["'][^"']+["'][^>]*>[\\s\\S]*${nav}`), `PC nav group should exist: ${nav}`);
}

const navMatches = html.match(/data-pc-nav=/g) || [];
assert.equal(navMatches.length, 6, 'PC should have exactly 6 top-level nav groups');
assert.equal(html.includes('智能目标测算 — 记录你的资产目标'), false, 'large goal input should not stay in top header');
assert.match(html, /目标测算/, 'goal measurement access should remain available');
const goalMeasureIndex = html.indexOf('目标测算');
assert.ok(goalMeasureIndex > pcTopbarStart, 'goal measurement access should appear after the PC shell begins');
assert.match(html, /data-pc-section=["']review["']/, 'review section should group rebalance, estimate, styles, fund pool, and AI prediction');
assert.match(html, /data-pc-section=["']settings["']/, 'settings section should group account, sync, privacy, import/export, deletion');

const settingsSectionMatch = html.match(/<section[^>]+id=["']sec-settings["'][^>]+data-pc-section=["']settings["'][^>]*>[\s\S]*?<\/section>/);
assert.ok(settingsSectionMatch, 'settings section should render real content');
const settingsSection = settingsSectionMatch[0];
assert.doesNotMatch(settingsSection, /<div[^>]+data-pc-section=["']settings["'][^>]*hidden[^>]*>\s*<\/div>/, 'settings section should not be an empty hidden marker');
for (const requiredText of ['导出', '导入', '隐私说明', '删除数据', 'mobile-dashboard.html']) {
  assert.match(settingsSection, new RegExp(requiredText), `settings section should include ${requiredText}`);
}

console.log('PC UI structure checks passed');
