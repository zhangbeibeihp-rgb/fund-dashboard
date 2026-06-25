import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const dashboard = readFileSync('portfolio-rebalance-dashboard.html', 'utf8');

assert.equal(existsSync('src/ocr-client.js'), true, 'src/ocr-client.js should exist');
assert.equal(existsSync('src/sync.js'), true, 'src/sync.js should exist');
assert.match(dashboard, /src\/ocr-client\.js/, 'dashboard should load OCR module');
assert.match(dashboard, /src\/sync\.js/, 'dashboard should load sync module');

const ocrClient = readFileSync('src/ocr-client.js', 'utf8');
const sync = readFileSync('src/sync.js', 'utf8');

for (const signature of [
  'function loadTesseractSDK',
  'async function runLocalTesseractOCR',
  'function parseFundText'
]) {
  assert.equal(dashboard.includes(signature), false, `${signature} should be moved out of dashboard HTML`);
  assert.match(ocrClient, new RegExp(signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${signature} should live in OCR module`);
}

for (const signature of [
  'async function syncTradeToCloud',
  'async function syncAccountToCloud',
  'async function syncImportedDataToCloud'
]) {
  assert.equal(dashboard.includes(signature), false, `${signature} should be moved out of dashboard HTML`);
  assert.match(sync, new RegExp(signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${signature} should live in sync module`);
}

console.log('module split checks passed');
