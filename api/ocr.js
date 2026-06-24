// Vercel Serverless Function — DeepSeek Vision OCR 代理
// 需在 Vercel 环境变量中设置 DEEPSEEK_API_KEY
// POST { image: "base64 data URL..." }

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) throw new Error('请在 Vercel 环境变量中设置 DEEPSEEK_API_KEY');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: '请在 Vercel 环境变量中设置 DEEPSEEK_API_KEY' });
  }

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: '缺少 image 参数' });

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: image }
            },
            {
              type: 'text',
              text: `请识别这张基金App交易记录截图，提取每一条交易记录。
对每一条交易记录，提取以下信息：
- date: 交易日期 (格式 YYYY-MM-DD)
- fund: 基金名称
- type: 交易类型（申购/赎回/买入/卖出）
- amount: 交易金额（纯数字，不含货币符号）
- share: 份额（纯数字）
- nav: 确认净值（纯数字）

请严格返回 JSON 数组格式，不要任何解释文字：
[{"date":"2026-06-15","fund":"华夏全球科技先锋","type":"申购","amount":2000,"share":1085.74,"nav":1.8421}, ...]

如果找不到，返回空数组 []。`
            }
          ]
        }],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    const data = await resp.json();
    if (data.error) return res.status(400).json({ error: data.error.message || 'DeepSeek API 错误' });

    // 解析 DeepSeek 返回的 JSON
    const content = data.choices?.[0]?.message?.content || '[]';
    const cleaned = content.replace(/```json\n?|```/g, '').trim();

    try {
      const trades = JSON.parse(cleaned);
      return res.status(200).json({ trades, count: trades.length });
    } catch {
      // 如果解析失败，返回原始文本
      return res.status(200).json({ trades: [], rawText: content, count: 0 });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
