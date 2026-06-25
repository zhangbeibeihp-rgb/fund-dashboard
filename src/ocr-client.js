// Browser-local OCR. No OCR AI key is required or shipped to Vercel.
async function callOCRApi(base64){
  var text = await runLocalTesseractOCR(base64);
  var texts = text.split(/[\n\r]+/).map(function(line){ return line.trim(); }).filter(Boolean);
  var fundsResult = parseFundText(texts);
  var tradesResult = typeof parseTradeText === 'function' ? parseTradeText(texts) : [];
  return {
    funds: fundsResult,
    trades: tradesResult,
    texts: texts,
    count: fundsResult.length + tradesResult.length
  };
}

function loadTesseractSDK(){
  return new Promise(function(resolve, reject){
    if(window.Tesseract){ resolve(window.Tesseract); return; }
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = function(){
      if(window.Tesseract) resolve(window.Tesseract);
      else reject(new Error('Tesseract.js 加载失败'));
    };
    script.onerror = function(){ reject(new Error('Tesseract.js CDN 加载失败，请检查网络后重试')); };
    document.head.appendChild(script);
  });
}

async function runLocalTesseractOCR(base64){
  var Tesseract = await loadTesseractSDK();
  var result = await Tesseract.recognize(base64, 'chi_sim+eng', {
    logger: function(m){
      if(m.status === 'recognizing text') console.log('[OCR]', Math.round((m.progress || 0) * 100) + '%');
    }
  });
  return (result && result.data && result.data.text) || '';
}

function parseFundText(texts){
  var results = [];
  var current = null;
  var fundRe = /(华夏|广发|南方|易方达|嘉实|富国|博时|招商|汇添富|中欧|国富|建信|永赢|银华|天弘|华安|鹏华|景顺|工银|交银|万家|兴全|东方|长信|前海|诺安|中银|国泰|申万)[\u4e00-\u9fa5A-Za-z()（）\d\-]+/;

  texts.forEach(function(line){
    var fund = line.match(fundRe);
    if(fund){
      if(current && current.amount > 0) results.push(current);
      current = {
        name: cleanOcrFundName(fund[0]),
        code: extractOcrFundCode(line),
        type: inferFundTypeFromName(fund[0]),
        market: inferMarketFromName(fund[0]),
        ref: inferRefFromName(fund[0]),
        amount: 0, share: 0, nav: 0, cost: 0, yesterday: 0, hold: 0, rate: 0,
        navDate: '', navLag: inferMarketFromName(fund[0]) === 'us' ? 'T+1' : 'T+0',
        navStatus: '本地OCR导入', estChange: 0
      };
      return;
    }
    if(!current) return;
    if(!current.code) current.code = extractOcrFundCode(line);
    var amount = readLabeledOcrNumber(line, ['持有金额','持仓金额','金额','市值','资产']);
    var share = readLabeledOcrNumber(line, ['持有份额','份额']);
    var nav = readLabeledOcrNumber(line, ['单位净值','净值']);
    var hold = readLabeledOcrNumber(line, ['持有收益','持仓收益','收益']);
    var rate = readOcrRate(line);
    if(amount > 0) current.amount = amount;
    if(share > 0) current.share = share;
    if(nav > 0) current.nav = nav;
    if(hold !== null) current.hold = hold;
    if(rate !== null) current.rate = rate;
  });
  if(current && current.amount > 0) results.push(current);
  return results;
}

function cleanOcrFundName(name){
  return String(name || '').replace(/\b\d{6}\b/g, '').replace(/(持有金额|持仓金额|持有份额|单位净值|净值|持有收益|收益率).*$/g, '').trim();
}

function extractOcrFundCode(text){
  var match = String(text || '').match(/\b(\d{6})\b/);
  return match ? match[1] : '';
}

function readLabeledOcrNumber(line, labels){
  for(var i=0; i<labels.length; i++){
    var label = labels[i];
    var re = new RegExp(label + '[：:\\s]*[¥￥]?\\s*([+-]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,4})?)\\s*(万|元|份)?');
    var match = String(line || '').match(re);
    if(match){
      var value = toNumber(match[1]);
      return match[2] === '万' ? value * 10000 : value;
    }
  }
  return 0;
}

function readOcrRate(line){
  var match = String(line || '').match(/(?:持有收益率|收益率|持仓收益率)[：:\s]*([+-]?\d+(?:\.\d+)?)%/);
  return match ? parseFloat(match[1]) : null;
}
