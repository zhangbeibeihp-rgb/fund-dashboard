const FUND_COMPANY_RE = '(华夏|广发|南方|易方达|嘉实|富国|博时|招商|汇添富|中欧|国富|建信|永赢|银华|天弘|华安|鹏华|景顺|工银|交银|万家|兴全|东方|长信|前海|诺安|中银|国泰|申万)';

export function parseTradesFromText(text) {
  var trades = [];
  var lines = splitOcrLines(text);

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var dateMatch = line.match(/(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/);
    var fundMatch = line.match(new RegExp(FUND_COMPANY_RE + '[\\u4e00-\\u9fa5A-Za-z()（）\\d\\-]+'));
    var amountMatch = line.match(/[¥￥]?\s*[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?\s*(?:元|CNY|RMB)/i);
    var shareMatch = line.match(/[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,4})?\s*份/);

    if (dateMatch && fundMatch && amountMatch) {
      var isSell = line.indexOf('赎回') >= 0 || line.indexOf('卖出') >= 0;
      trades.push({
        date: dateMatch[0].replace(/[\/.]/g, '-'),
        fund: cleanFundName(fundMatch[0]),
        type: isSell ? '赎回' : '申购',
        action: isSell ? 'sell' : 'buy',
        amount: parseMoney(amountMatch[0]),
        share: shareMatch ? parseNumber(shareMatch[0]) : 0,
        nav: 0,
        ftype: inferFundType(fundMatch[0]),
        status: '已确认'
      });
    }
  }
  return trades.filter(function(t) { return t.amount > 0; });
}

export function parseFundsFromText(text) {
  var funds = [];
  var lines = splitOcrLines(text);
  var blocks = buildFundBlocks(lines);

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    var joined = block.lines.join(' ');
    var amount = findLabeledMoney(joined, ['持有金额', '持仓金额', '金额', '资产', '市值']);
    if (!amount) amount = findLargestMoney(joined);

    var share = findLabeledNumber(joined, ['持有份额', '份额']);
    var nav = findLabeledNumber(joined, ['净值', '单位净值']);
    var hold = findLabeledMoney(joined, ['持有收益', '持仓收益', '收益']);
    var rate = findRate(joined);

    if (block.name && amount > 0) {
      funds.push({
        name: cleanFundName(block.name),
        code: block.code || '',
        type: inferFundType(block.name),
        market: inferMarket(block.name),
        ref: inferReference(block.name),
        amount: amount,
        share: share || 0,
        nav: nav || 0,
        cost: 0,
        yesterday: 0,
        hold: hold || 0,
        rate: rate || 0,
        navDate: '',
        navLag: inferMarket(block.name) === 'us' ? 'T+1' : 'T+0',
        navStatus: 'OCR导入',
        estChange: 0
      });
    }
  }

  return dedupeFunds(funds);
}

export function parsePortfolioOcrText(text) {
  var funds = parseFundsFromText(text);
  var trades = parseTradesFromText(text);
  return {
    funds: funds,
    trades: trades,
    count: funds.length + trades.length
  };
}

function splitOcrLines(text) {
  return String(text || '')
    .split(/[\n\r]+/)
    .map(function(l) { return l.trim().replace(/\s+/g, ' '); })
    .filter(function(l) { return l.length > 1; });
}

function buildFundBlocks(lines) {
  var blocks = [];
  var current = null;
  var fundRe = new RegExp(FUND_COMPANY_RE + '[\\u4e00-\\u9fa5A-Za-z()（）\\d\\-]+');

  lines.forEach(function(line) {
    var fundMatch = line.match(fundRe);
    if (fundMatch) {
      if (current) blocks.push(current);
      current = {
        name: fundMatch[0],
        code: extractCode(line),
        lines: [line]
      };
      return;
    }
    if (current) {
      current.lines.push(line);
      if (!current.code) current.code = extractCode(line);
    }
  });
  if (current) blocks.push(current);
  return blocks;
}

function extractCode(text) {
  var match = String(text || '').match(/\b(\d{6})\b/);
  return match ? match[1] : '';
}

function parseNumber(value) {
  var cleaned = String(value || '').replace(/[¥￥,元份%+]/g, '').trim();
  var n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseMoney(value) {
  var raw = String(value || '');
  var isWan = raw.indexOf('万') >= 0;
  var n = parseNumber(raw.replace(/万/g, ''));
  return isWan ? n * 10000 : n;
}

function findLabeledMoney(text, labels) {
  for (var i = 0; i < labels.length; i++) {
    var label = labels[i];
    var re = new RegExp(label + '[：:\\s]*[¥￥]?\\s*([+-]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?)\\s*(万|元)?');
    var match = text.match(re);
    if (match) return parseMoney((match[1] || '') + (match[2] || ''));
  }
  return 0;
}

function findLabeledNumber(text, labels) {
  for (var i = 0; i < labels.length; i++) {
    var label = labels[i];
    var re = new RegExp(label + '[：:\\s]*([+-]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,4})?)');
    var match = text.match(re);
    if (match) return parseNumber(match[0].replace(label, ''));
  }
  return 0;
}

function findLargestMoney(text) {
  var matches = String(text || '').match(/[¥￥]\s*[+-]?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|[+-]?\d+\.\d{2}\s*元/g) || [];
  var values = matches.map(parseMoney).filter(function(v) { return v > 0; });
  return values.length ? Math.max.apply(Math, values) : 0;
}

function findRate(text) {
  var match = String(text || '').match(/(?:持有收益率|收益率|持仓收益率)[：:\s]*([+-]?\d+(?:\.\d+)?)%/);
  return match ? parseFloat(match[1]) : 0;
}

function cleanFundName(name) {
  return String(name || '')
    .replace(/\b\d{6}\b/g, '')
    .replace(/(持有金额|持仓金额|持有份额|单位净值|净值|持有收益|收益率).*$/g, '')
    .trim();
}

function inferFundType(name) {
  if (/指数|ETF|联接|纳斯达克|标普|沪深|中证|国证/.test(name)) return 'index';
  if (/股票/.test(name)) return 'stock';
  return 'mixed';
}

function inferMarket(name) {
  return /QDII|全球|美国|纳斯达克|标普|新兴市场/.test(name) ? 'us' : 'cn';
}

function inferReference(name) {
  if (/纳斯达克|纳指/.test(name)) return '纳斯达克100';
  if (/标普|美国成长/.test(name)) return '标普500';
  if (/半导体|芯片|集成电路/.test(name)) return '中华半导体芯片';
  if (/新兴市场/.test(name)) return 'MSCI新兴市场';
  return '';
}

function dedupeFunds(funds) {
  var seen = new Set();
  return funds.filter(function(f) {
    var key = f.code || f.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
