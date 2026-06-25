import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

assert.equal(existsSync('mobile-dashboard.html'), true, 'mobile-dashboard.html should exist');
assert.equal(existsSync('src/mobile-dashboard.css'), true, 'mobile CSS should exist');
assert.equal(existsSync('src/mobile-dashboard.js'), true, 'mobile JS should exist');

const html = readFileSync('mobile-dashboard.html', 'utf8');
const js = readFileSync('src/mobile-dashboard.js', 'utf8');
const sync = readFileSync('src/sync.js', 'utf8');
const testSource = readFileSync('tests/mobile-ui.test.mjs', 'utf8');
const mobileSources = [
  ['mobile-dashboard.html', html],
  ['src/mobile-dashboard.js', js],
  ['src/sync.js', sync],
  ['tests/mobile-ui.test.mjs', testSource]
];
const mojibakeFragments = [
  [0xfffd],
  [0x951f],
  [0x68e3, 0x682d],
  [0x93b8, 0x4f77, 0x7ca8],
  [0x95c5, 0x612e],
  [0x9352, 0x72bb],
  [0x9365, 0x5267],
  [0x5a34, 0x5fda]
].map((codes) => String.fromCharCode(...codes));

for (const [fileName, source] of mobileSources) {
  for (const fragment of mojibakeFragments) {
    assert.equal(source.includes(fragment), false, `${fileName} should not contain mojibake fragment ${fragment}`);
  }
}

for (const tab of ['首页', '持仓', '记录', '目标', '我的']) {
  assert.match(html, new RegExp(`data-mobile-tab=["'][^"']+["'][^>]*>[\\s\\S]*?${tab}`), `mobile tab should exist: ${tab}`);
}

for (const id of ['mobileHomePanel', 'mobileHoldingsPanel', 'mobileRecordPanel', 'mobileGoalPanel', 'mobileProfilePanel']) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `mobile panel should exist: ${id}`);
}

assert.match(html, /mobileSyncStatus/, 'mobile UI should expose sync status');
assert.match(html, /图片仅在浏览器本地识别/, 'mobile OCR copy should explain local processing');
assert.match(html, /隐私说明/, 'mobile UI should expose privacy notice');
assert.match(html, /删除数据/, 'mobile UI should expose data deletion');
assert.match(html, /src\/mobile-dashboard\.css/, 'mobile page should load mobile CSS');
assert.match(html, /src\/mobile-dashboard\.js/, 'mobile page should load mobile JS');
assert.doesNotMatch(html, /src\/app-init\.js/, 'mobile page should not load the PC app initializer');

for (const method of ['exportData', 'importData', 'openPrivacyDialog', 'clearAllUserData', 'logout']) {
  assert.match(js, new RegExp(`${method}:\\s*${method}`), `MobileDashboard should export ${method}`);
}

for (const handler of [
  'MobileDashboard.exportData()',
  'MobileDashboard.importData(event)',
  'MobileDashboard.openPrivacyDialog()',
  'MobileDashboard.clearAllUserData()',
  'MobileDashboard.logout()'
]) {
  assert.match(html, new RegExp(handler.replace(/[().]/g, '\\$&')), `profile action should call ${handler}`);
}

for (const legacyHandler of ['onclick="exportData()"', 'onchange="importData(event)"', 'onclick="openPrivacyDialog()"', 'onclick="clearAllUserData()"', 'onclick="appLogout()"']) {
  assert.equal(html.includes(legacyHandler), false, `mobile page should not call legacy handler ${legacyHandler}`);
}

assert.match(js, /handleOcrFiles/, 'mobile JS should expose OCR file handler');
assert.match(js, /callOCRApi/, 'mobile OCR should use shared browser-local OCR client');
assert.match(js, /mobileOcrResult/, 'mobile OCR result container should be rendered');
assert.match(js, /confirmOcrImport/, 'mobile OCR should provide a confirm import action');
assert.match(js, /mobile-ocr-card/, 'mobile OCR result should render card rows instead of a wide table');
assert.equal(/<table|createElement\(["']table["']\)/i.test(js), false, 'mobile OCR flow should not rely on wide tables');
assert.match(sync, /document\.getElementById\('syncStatusBadge'\) \|\| document\.getElementById\('mobileSyncStatus'\)/, 'sync helper should support mobile sync badge');

console.log('mobile UI structure checks passed');
