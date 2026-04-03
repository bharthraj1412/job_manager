// api/ai.js — Vercel Serverless Function
// ✅ SECURITY: Keys never leave server. Rate limiting. Works with ANY NVIDIA NIM model.

const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX    = 20;
const ipTimestamps      = {};

// Default fallback model if client sends none
const DEFAULT_MODEL = process.env.DEFAULT_AI_MODEL || 'meta/llama-3.1-70b-instruct';

function isOriginAllowed(origin) {
  if (!origin) return true;
  const allowed = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.includes(origin)) return true;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
  if (origin.endsWith('.vercel.app')) return true;
  if (!process.env.ALLOWED_ORIGIN) return true;
  return false;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';

  // ── CORS ─────────────────────────────────────────────────────────────
  if (!isOriginAllowed(origin)) {
    return res.status(403).json({ error: 'Forbidden origin: ' + origin });
  }
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // ── Rate Limiting ─────────────────────────────────────────────────────
  const ip  = req.headers['x-forwarded-for']?.split(',')[0].trim() || 'unknown';
  const now = Date.now();
  if (!ipTimestamps[ip]) ipTimestamps[ip] = [];
  ipTimestamps[ip] = ipTimestamps[ip].filter(t => now - t < RATE_LIMIT_WINDOW);
  if (ipTimestamps[ip].length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests — try again in a minute.' });
  }
  ipTimestamps[ip].push(now);

  // ── Input Validation ──────────────────────────────────────────────────
  const { model, messages, temperature, max_tokens } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request: messages array required' });
  }
  if (max_tokens && max_tokens > 8192) {
    return res.status(400).json({ error: 'max_tokens too large (max 8192)' });
  }

  // Use client-supplied model or fall back to server default
  const selectedModel = (typeof model === 'string' && model.trim()) ? model.trim() : DEFAULT_MODEL;

  // ── API Key ───────────────────────────────────────────────────────────
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server misconfigured: NVIDIA_API_KEY not set. Add it in Vercel → Settings → Environment Variables.',
    });
  }

  // ── Proxy to NVIDIA NIM ───────────────────────────────────────────────
  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       selectedModel,
        messages,
        temperature: Math.min(typeof temperature === 'number' ? temperature : 0.6, 1.0),
        max_tokens:  Math.min(max_tokens || 2048, 8192),
        top_p:       0.7,
      }),
    });

    const data = await response.json();

    // Surface friendly error for EOL / not-found models
    if (!response.ok) {
      const detail = data?.detail || data?.error?.message || data?.title || JSON.stringify(data);
      const hint = response.status === 410
        ? ` — Model "${selectedModel}" has reached end-of-life. Change it in ⚙️ Settings.`
        : response.status === 404
        ? ` — Model "${selectedModel}" not found on NVIDIA NIM. Change it in ⚙️ Settings.`
        : '';
      return res.status(response.status).json({ error: detail + hint });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Upstream API error: ' + err.message });
  }
}
