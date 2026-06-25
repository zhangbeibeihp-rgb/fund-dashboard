import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('portfolio-rebalance-dashboard.html', 'utf8');
const serviceWorker = readFileSync('sw.js', 'utf8');

assert.equal(
  dashboard.includes('function showOcrReviewDialog'),
  true,
  'OCR import must show a review dialog before mutating holdings or trades'
);

assert.equal(
  dashboard.includes('function confirmOcrImport'),
  true,
  'OCR review dialog must have an explicit confirm import action'
);

assert.equal(
  dashboard.includes("callOCRApi(base64).then(function(result){"),
  true,
  'OCR upload flow should still process recognition results'
);

assert.equal(
  dashboard.includes('showOcrReviewDialog(result, card);'),
  true,
  'OCR upload flow must hand results to the review dialog instead of direct import'
);

assert.equal(
  serviceWorker.includes('./icons/icon-192.svg'),
  true,
  'service worker must cache the real SVG 192 icon'
);

assert.equal(
  serviceWorker.includes('./icons/icon-512.svg'),
  true,
  'service worker must cache the real SVG 512 icon'
);

assert.equal(
  serviceWorker.includes('./icons/icon-192.png') || serviceWorker.includes('./icons/icon-512.png'),
  false,
  'service worker must not cache nonexistent PNG icons'
);

assert.equal(
  /fund-dashboard-v1\.4/.test(serviceWorker),
  true,
  'service worker cache version must be bumped after asset changes'
);

console.log('dashboard quality tests passed');
