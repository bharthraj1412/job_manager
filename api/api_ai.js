// api/ai.js — Vercel Serverless Function
// ✅ SECURITY: Keys never leave server. Rate limiting. Restricted CORS.

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX    = 20;         // max 20 requests per IP per minute
const ipTimestamps      = {};         // In production use Redis or Upstash

export default async function handler(req, res) {
  // ── CORS ────────────────────────────────────────────────────────────
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
  const origin = req.headers.origin || '';
  
  if (origin && origin !== allowedOrigin && !origin.includes('localhost')) {
    return res.status(403).json({ error: 'Forbidden origin' });
  }

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // ── Rate Limiting ────────────────────────────────────────────────────
  const ip  = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const now = Date.now();
  if (!ipTimestamps[ip]) ipTimestamps[ip] = [];
  ipTimestamps[ip] = ipTimestamps[ip].filter(t => now - t < RATE_LIMIT_WINDOW);
  if (ipTimestamps[ip].length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
  }
  ipTimestamps[ip].push(now);

  // ── Input Validation ─────────────────────────────────────────────────
  const { model, messages, temperature, max_tokens } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  if (max_tokens > 8192) {
    return res.status(400).json({ error: 'max_tokens too large' });
  }

  // ── API Key (server-side only, never exposed to client) ──────────────
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server API key not configured' });
  }

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       model || 'deepseek-ai/deepseek-r1',
        messages,
        temperature: Math.min(temperature || 0.6, 1.0),
        max_tokens:  Math.min(max_tokens || 2048, 8192),
        top_p:       0.7,
      }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Upstream API error: ' + err.message });
  }
}
