// Vercel Serverless Function — 百度OCR代理
// POST { image: "base64..." }
// 返回识别文本

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const API_KEY = process.env.BAIDU_OCR_API_KEY;
  const SECRET_KEY = process.env.BAIDU_OCR_SECRET_KEY;

  if (!API_KEY || !SECRET_KEY) {
    throw new Error('未配置百度OCR API Key/Secret。请在 Vercel 环境变量中设置 BAIDU_OCR_API_KEY 和 BAIDU_OCR_SECRET_KEY');
  }

  const resp = await fetch(
    `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`,
    { method: 'POST' }
  );
  const data = await resp.json();
  if (data.error) throw new Error('获取百度Token失败: ' + data.error_description);

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 300) * 1000; // 提前5分钟过期
  return cachedToken;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST' });
  }

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: '缺少 image 参数' });

    // 去掉 data:image/...;base64, 前缀
    const base64 = image.replace(/^data:image\/\w+;base64,/, '');

    const token = await getAccessToken();
    const ocrResp = await fetch(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'image=' + encodeURIComponent(base64) + '&language_type=CHN_ENG&detect_direction=true'
      }
    );
    const ocrData = await ocrResp.json();

    if (ocrData.error_code) {
      return res.status(400).json({ error: 'OCR识别失败', code: ocrData.error_code, msg: ocrData.error_msg });
    }

    const texts = (ocrData.words_result || []).map(w => w.words);
    return res.status(200).json({ texts, count: texts.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
