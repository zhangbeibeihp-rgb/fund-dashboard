// Vercel Serverless Function — AI OCR 代理
// 使用 gemai.cc 代理的 deepseek-ocr 模型进行图片识别
// POST { image: "base64 data URL..." }
// 返回识别后的交易记录

const AI_URL = 'https://api.gemai.cc/v1/chat/completions';
const AI_KEY = 'sk-M9D1zZuS4wbUqQhM7Xfa5PB9mszhBsCM0lYenY6mJM7xa9X0';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: '缺少 image 参数' });

    // 使用 deepseek-ocr 模型（专门优化 OCR）
    const resp = await fetch(AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + AI_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-ocr',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: image }
            },
            {
              type: 'text',
              text: `Extract all transaction records from this fund trading screenshot.
For each record, return:
- date: transaction date (YYYY-MM-DD)
- fund: fund name (Chinese)
- type: 申购 or 赎回
- action: buy or sell
- amount: transaction amount (number, no ¥ symbol)
- share: shares (number)
- nav: confirmed NAV (number)
- ftype: mixed, index, or stock
- status: 已确认

Return ONLY a JSON array, no explanation:
[{"date":"2026-06-15","fund":"华夏全球科技先锋","type":"申购","action":"buy","amount":2000,"share":1085.74,"nav":1.8421,"ftype":"mixed","status":"已确认"}]

Return [] if no records found.`
            }
          ]
        }],
        temperature: 0,
        max_tokens: 2000
      })
    });

    const data = await resp.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message || 'API 错误' });
    }

    const content = (data.choices?.[0]?.message?.content || '[]').trim();
    const cleaned = content.replace(/```json\n?|```/g, '').trim();

    try {
      const trades = JSON.parse(cleaned);
      if (Array.isArray(trades) && trades.length > 0) {
        return res.status(200).json({ trades, count: trades.length });
      }
    } catch {
      // JSON 解析失败
    }

    return res.status(200).json({ trades: [], rawText: content, count: 0 });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
