import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('portfolio-rebalance-dashboard.html', 'utf8');

assert.match(html, /id=["']top3List["']/, 'overview Top3 list should have a dynamic render target');
assert.match(html, /function renderTop3\(/, 'Top3 should be rendered from current fund data');
assert.match(html, /function getFundDisplayYesterday\(/, 'KPI and holdings should read live refreshed daily profit');
assert.match(html, /function applyMarketEstimatesToOverview\(/, 'market estimates should be applied back to overview data');
assert.match(
  html,
  /calcNightEstimate[\s\S]*applyMarketEstimatesToOverview\(nightEstimates\)/,
  'night auto refresh should update overview data, not only the QDII estimate card'
);
assert.match(
  html,
  /renderQDIIResults[\s\S]*applyMarketEstimatesToOverview\(pmQdiiEstimate\)/,
  'manual/API premarket refresh should update overview data'
);
assert.match(
  html,
  /\.pc-main-content\s+\.kpi-row\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,
  'PC workspace overview KPI cards should not be squeezed into six columns'
);
assert.match(
  html,
  /@media\(max-width:1280px\)[\s\S]*\.pc-workspace-shell\{grid-template-columns:200px minmax\(0,1fr\)\}/,
  'right assist panel should collapse before the main KPI grid becomes cramped'
);

console.log('live market refresh checks passed');
