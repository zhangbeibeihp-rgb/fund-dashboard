// Vercel Serverless Function — OCR 识别代理
// 使用 OCR.space 免费 API 识别图片中的文字
// 免费额度：500次/天，无需注册也可以使用（但建议注册获取更高额度）
// 注册地址：https://ocr.space/ocrapi

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: '缺少 image 参数' });

    // 去掉 data:image/...;base64, 前缀
    const base64 = image.replace(/^data:image\/\w+;base64,/, '');

    // OCR.space 免费 API
    const formData = new URLSearchParams();
    formData.append('base64Image', 'data:image/png;base64,' + base64);
    formData.append('language', 'chs'); // 中文简体
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2'); // 使用引擎2（更准确）

    const resp = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'apikey': 'K81918549688957', // OCR.space 免费 key，无需注册即可使用
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    const data = await resp.json();

    if (data.IsErroredOnProcessing || !data.ParsedResults) {
      return res.status(400).json({ error: data.ErrorMessage || 'OCR 识别失败' });
    }

    // 提取所有识别到的文字行
    const texts = [];
    data.ParsedResults.forEach(result => {
      const lines = (result.ParsedText || '').split('\r\n').filter(l => l.trim());
      lines.forEach(line => texts.push(line.trim()));
    });

    return res.status(200).json({ texts, count: texts.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
