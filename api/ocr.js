// Vercel Serverless Function — AI OCR 代理
// 两步策略：1) deepseek-ocr 提取文字  2) 文本解析 → 交易记录

const AI_URL = 'https://api.gemai.cc/v1/chat/completions';
const AI_KEY = 'sk-M9D1zZuS4wbUqQhM7Xfa5PB9mszhBsCM0lYenY6mJM7xa9X0';

async function callAI(model, messages, maxTokens) {
  const resp = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + AI_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0, max_tokens: maxTokens || 2000 })
  });
  return resp.json();
}

function parseTradesFromText(text) {
  var trades = [];
  var lines = text.split(/[\n\r]+/).filter(function(l) { return l.trim().length > 5; });

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var dateMatch = line.match(/(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/);
    var fundMatch = line.match(/(华夏|广发|南方|易方达|嘉实|富国|博时|招商|汇添富|中欧|国富|建信|永赢|银华|天弘|华安|鹏华|景顺|工银|交银|万家|兴全|东方|长信|前海|诺安|中银|国泰|申万)[\u4e00-\u9fa5A-Za-z()（）\d\-]+/);
    var amountMatch = line.match(/(\d{1,3}(?:,\d{3})*\.\d{2})/);
    var shareMatch = line.match(/(\d{1,3}(?:,\d{3})*\.\d{2,4})\s*份/);

    if (dateMatch && fundMatch && amountMatch) {
      var isSell = line.indexOf('赎回') >= 0 || line.indexOf('卖出') >= 0;
      trades.push({
        date: dateMatch[0].replace(/[\/.]/g, '-'),
        fund: fundMatch[0],
        type: isSell ? '赎回' : '申购',
        action: isSell ? 'sell' : 'buy',
        amount: parseFloat(amountMatch[0]) || 0,
        share: shareMatch ? parseFloat(shareMatch[0]) : 0,
        nav: 0,
        ftype: 'mixed',
        status: '已确认'
      });
    }
  }
  return trades;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  try {
    var image = req.body.image;
    if (!image) return res.status(400).json({ error: '缺少 image 参数' });

    // 步骤1：deepseek-ocr 提取图片中所有文字
    var ocrData = await callAI('deepseek-ocr', [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: image } },
        { type: 'text', text: 'Extract all text from this image. Return only the extracted text, line by line, do not add any explanation.' }
      ]
    }], 1500);

    if (ocrData.error) {
      return res.status(400).json({ error: (ocrData.error.message || 'OCR API 错误') });
    }

    var ocrText = (ocrData.choices && ocrData.choices[0] && ocrData.choices[0].message && ocrData.choices[0].message.content) || '';
    if (!ocrText || ocrText.length < 5) {
      return res.status(200).json({ trades: [], count: 0, ocrText: ocrText.substring(0, 200) });
    }

    // 步骤2：正则解析
    var trades = parseTradesFromText(ocrText);

    // 步骤3：如果正则不够，用 deepseek-chat 理解文本
    if (trades.length === 0 && ocrText.length > 10) {
      var parseData = await callAI('deepseek-chat', [{
        role: 'user',
        content: '从以下OCR文本提取基金交易记录，返回JSON数组：\n文本：\n' + ocrText.substring(0, 2000)
      }], 800);

      if (!parseData.error && parseData.choices && parseData.choices[0]) {
        var raw = (parseData.choices[0].message.content || '[]').replace(/```json\n?|```/g, '').trim();
        try {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) trades = parsed;
        } catch (e) {}
      }
    }

    return res.status(200).json({
      trades: trades,
      count: trades.length,
      ocrText: ocrText.substring(0, 500)
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
