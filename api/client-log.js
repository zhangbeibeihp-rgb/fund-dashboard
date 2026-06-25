export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

  try {
    const body = req.body || {};
    const entry = {
      level: String(body.level || 'error').slice(0, 16),
      event: String(body.event || 'client_error').slice(0, 64),
      message: String(body.message || '').slice(0, 500),
      path: String(body.path || '').slice(0, 160),
      userAgent: String(body.userAgent || '').slice(0, 180),
      timestamp: body.timestamp || new Date().toISOString()
    };
    console.error('[client-log]', JSON.stringify(entry));
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
