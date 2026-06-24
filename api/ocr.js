// Vercel Serverless Function — AI Vision OCR 代理
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

    const resp = await fetch(AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + AI_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: image, detail: 'high' }
            },
            {
              type: 'text',
              text: `请识别这张基金App交易记录截图，提取每一条交易记录。
对每一条提取：
- date: 交易日期 (格式 YYYY-MM-DD)
- fund: 基金名称
- type: 申购/赎回
- action: buy/sell
- amount: 交易金额（纯数字）
- share: 份额（纯数字）
- nav: 确认净值（纯数字）
- ftype: 基金类型 mixed/index/stock
- status: 已确认

严格返回 JSON 数组，不要解释：
[{"date":"2026-06-15","fund":"华夏全球科技先锋","type":"申购","action":"buy","amount":2000,"share":1085.74,"nav":1.8421,"ftype":"mixed","status":"已确认"}]

找不到返回 []。`
            }
          ]
        }],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    const data = await resp.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message || 'AI API 错误' });
    }

    const content = (data.choices?.[0]?.message?.content || '[]').trim();
    const cleaned = content.replace(/```json\n?|```/g, '').trim();

    try {
      const trades = JSON.parse(cleaned);
      if (Array.isArray(trades) && trades.length > 0) {
        return res.status(200).json({ trades, count: trades.length });
      }
    } catch {
      // JSON 解析失败，返回原始文本
    }

    return res.status(200).json({ trades: [], rawText: content, count: 0 });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
