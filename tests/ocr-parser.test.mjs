import assert from 'node:assert/strict';
import { parsePortfolioOcrText } from '../api/ocr-parser.mjs';

function testParsesHoldingScreenshotWithoutTradeDate() {
  const text = [
    '京东金融 基金持仓',
    '华夏全球科技先锋混合(QDII)A 005698',
    '持有金额 4,033.41 元',
    '持有份额 2189.74 份',
    '持有收益 +293.41',
    '持有收益率 +11.11%',
    '华夏移动互联混合(QDII) 002891',
    '持仓金额 3,209.67 元',
    '份额 1523.12 份',
    '持有收益 +254.67',
    '收益率 +9.24%'
  ].join('\n');

  const result = parsePortfolioOcrText(text);

  assert.equal(result.trades.length, 0);
  assert.equal(result.funds.length, 2);
  assert.deepEqual(
    result.funds.map((fund) => ({
      name: fund.name,
      code: fund.code,
      amount: fund.amount,
      share: fund.share,
      hold: fund.hold,
      rate: fund.rate,
      type: fund.type,
      market: fund.market
    })),
    [
      {
        name: '华夏全球科技先锋混合(QDII)A',
        code: '005698',
        amount: 4033.41,
        share: 2189.74,
        hold: 293.41,
        rate: 11.11,
        type: 'mixed',
        market: 'us'
      },
      {
        name: '华夏移动互联混合(QDII)',
        code: '002891',
        amount: 3209.67,
        share: 1523.12,
        hold: 254.67,
        rate: 9.24,
        type: 'mixed',
        market: 'us'
      }
    ]
  );
}

function testKeepsTradeParsingForTransactionScreenshots() {
  const text = '2026-06-15 华夏全球科技先锋混合(QDII)A 申购 2,000.00 元 1085.74份';
  const result = parsePortfolioOcrText(text);

  assert.equal(result.funds.length, 0);
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].fund, '华夏全球科技先锋混合(QDII)A');
  assert.equal(result.trades[0].amount, 2000);
  assert.equal(result.trades[0].share, 1085.74);
}

testParsesHoldingScreenshotWithoutTradeDate();
testKeepsTradeParsingForTransactionScreenshots();
console.log('ocr-parser tests passed');
