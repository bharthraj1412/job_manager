// api/ai.js — Vercel Serverless Function
// ✅ SECURITY: Keys never leave server. Rate limiting. Flexible CORS for Vercel.

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20;
const ipTimestamps = {};

export default async function handler(req, res) {
  const origin = req.headers.origin || '';

  // ── CORS ────────────────────────────────────────────────────────────
  // Reflect the caller origin; this endpoint does not set cookies.

  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Rate Limiting ────────────────────────────────────────────────────
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || 'unknown';
  const now = Date.now();
  if (!ipTimestamps[ip]) ipTimestamps[ip] = [];
  ipTimestamps[ip] = ipTimestamps[ip].filter(t => now - t < RATE_LIMIT_WINDOW);
  if (ipTimestamps[ip].length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests — try again in a minute.' });
  }
  ipTimestamps[ip].push(now);

  // ── Input Validation ─────────────────────────────────────────────────
  const { model, messages, temperature, max_tokens } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request: messages array required' });
  }
  if (max_tokens && max_tokens > 8192) {
    return res.status(400).json({ error: 'max_tokens too large (max 8192)' });
  }

  // ── API Key ──────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  const clientKey  = authHeader && authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : null;
  const apiKey     = clientKey || process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured: NVIDIA_API_KEY not set in environment and no key provided by client' });
  }

  // ── Proxy to NVIDIA NIM ──────────────────────────────────────────────
  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'deepseek-ai/deepseek-r1',
        messages,
        temperature: Math.min(typeof temperature === 'number' ? temperature : 0.6, 1.0),
        max_tokens: Math.min(max_tokens || 2048, 8192),
        top_p: 0.7,
      }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Upstream API error: ' + err.message });
  }
}