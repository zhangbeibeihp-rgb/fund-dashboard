export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    service: 'fund-dashboard',
    timestamp: new Date().toISOString(),
    ocrMode: 'browser-local-tesseract'
  });
}
