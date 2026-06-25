import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const dashboard = readFileSync('portfolio-rebalance-dashboard.html', 'utf8');
const envExample = readFileSync('.env.example', 'utf8');
const report = readFileSync('launch-readiness-audit-2026-06-24-current.md', 'utf8');

assert.equal(
  dashboard.includes("fetch('/api/ocr'"),
  false,
  'Vercel frontend must not call /api/ocr because no OCR AI key is deployed on Vercel'
);

assert.equal(
  existsSync('api/ocr.js'),
  false,
  'Vercel deployment must not include an OCR AI-key serverless endpoint'
);

assert.equal(
  envExample.includes('AI_' + 'KEY='),
  false,
  '.env.example must not ask for OCR AI key in the Vercel deployment path'
);

assert.equal(
  report.includes('Vercel 环境变量中配置新 Key'),
  false,
  'readiness report must not instruct deploying OCR AI key to Vercel'
);

console.log('no-vercel-ocr-key tests passed');
