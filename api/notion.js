// api/notion.js — Notion Sync Proxy for Vercel
// Forwards requests from the browser to Notion's API to avoid CORS errors.
// Deploy this alongside api/ai.js in your Vercel project.

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX    = 10;        // 10 sync calls per minute
const ipTimestamps = {};

export default async function handler(req, res) {
  // ── CORS ────────────────────────────────────────────────────────────────
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // ── Rate limiting ────────────────────────────────────────────────────────
  const ip  = req.headers['x-forwarded-for']?.split(',')[0].trim() || 'unknown';
  const now = Date.now();
  if (!ipTimestamps[ip]) ipTimestamps[ip] = [];
  ipTimestamps[ip] = ipTimestamps[ip].filter(t => now - t < RATE_LIMIT_WINDOW);
  if (ipTimestamps[ip].length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests — try again in a minute.' });
  }
  ipTimestamps[ip].push(now);

  // ── Parse body ───────────────────────────────────────────────────────────
  const { action, token, database_id, jobs } = req.body || {};

  if (!token)       return res.status(400).json({ error: 'Missing Notion integration token' });
  if (!database_id) return res.status(400).json({ error: 'Missing Notion database_id' });
  if (!action)      return res.status(400).json({ error: 'Missing action' });

  const notionHeaders = {
    'Authorization':    'Bearer ' + token,
    'Notion-Version':   '2022-06-28',
    'Content-Type':     'application/json',
  };

  // ── Action: fetch available databases (for auto-discovery UI) ────────────
  if (action === 'get_databases') {
    try {
      const r = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({ filter: { value: 'database', property: 'object' } }),
      });
      if (!r.ok) {
        const e = await r.json();
        return res.status(r.status).json({ error: e.message || 'Notion API error' });
      }
      const data = await r.json();
      return res.status(200).json({
        databases: (data.results || []).map(db => ({
          id:    db.id,
          title: db.title?.[0]?.plain_text || 'Untitled',
        }))
      });
    } catch (err) {
      return res.status(500).json({ error: 'Notion fetch error: ' + err.message });
    }
  }

  // ── Action: sync_jobs — create one Notion page per job ──────────────────
  if (action === 'sync_jobs') {
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ error: 'No jobs to sync' });
    }
    if (jobs.length > 500) {
      return res.status(400).json({ error: 'Too many jobs (max 500 per call)' });
    }

    // Fetch the DB schema so we only set properties that actually exist
    let existingProps = [];
    try {
      const dbRes = await fetch('https://api.notion.com/v1/databases/' + database_id, {
        headers: notionHeaders,
      });
      if (!dbRes.ok) {
        const e = await dbRes.json();
        return res.status(dbRes.status).json({
          error: (e.message || 'Cannot access this Notion database.') +
                 ' — Make sure you shared the database with your integration.',
        });
      }
      const db = await dbRes.json();
      existingProps = Object.keys(db.properties || {});
    } catch (err) {
      return res.status(500).json({ error: 'Could not fetch Notion DB schema: ' + err.message });
    }

    // Helper: build a Notion property value only if the column exists in the DB
    function prop(name, value) {
      if (!existingProps.includes(name)) return null;
      return { name, value };
    }

    // Create Notion pages in batches of 10 (Notion rate limit is ~3 req/s)
    let synced = 0;
    const errors = [];
    const BATCH = 10;
    const DELAY = 350; // ms between batches

    for (let i = 0; i < jobs.length; i += BATCH) {
      const batch = jobs.slice(i, i + BATCH);

      await Promise.allSettled(
        batch.map(async job => {
          try {
            const properties = {
              // "Name" / "title" column is always required
              'Name': {
                title: [{ text: { content: (job.title || 'Untitled').slice(0, 2000) } }]
              },
            };

            // Optional properties — only added when the column exists in the DB
            const optionals = [
              { col: 'Company',      type: 'rich_text', val: job.company   },
              { col: 'Location',     type: 'rich_text', val: job.location  },
              { col: 'Salary',       type: 'rich_text', val: job.salary    },
              { col: 'Skills',       type: 'rich_text', val: job.skills    },
              { col: 'Source',       type: 'rich_text', val: job.source    },
              { col: 'Notes',        type: 'rich_text', val: job.notes     },
              { col: 'Status',       type: 'select',    val: job.status    },
              { col: 'Priority',     type: 'select',    val: job.priority  },
              { col: 'Apply Link',   type: 'url',       val: job.applylink },
              { col: 'Applied Date', type: 'date',      val: job.applieddate },
              { col: 'Deadline',     type: 'date',      val: job.deadline  },
            ];

            for (const { col, type, val } of optionals) {
              if (!existingProps.includes(col) || !val) continue;
              if (type === 'rich_text') {
                properties[col] = { rich_text: [{ text: { content: String(val).slice(0, 2000) } }] };
              } else if (type === 'select') {
                properties[col] = { select: { name: String(val) } };
              } else if (type === 'url') {
                properties[col] = { url: String(val) };
              } else if (type === 'date') {
                // Notion date format: YYYY-MM-DD
                const d = String(val).slice(0, 10);
                if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                  properties[col] = { date: { start: d } };
                }
              }
            }

            const createRes = await fetch('https://api.notion.com/v1/pages', {
              method: 'POST',
              headers: notionHeaders,
              body: JSON.stringify({
                parent: { database_id },
                properties,
              }),
            });

            if (createRes.ok) {
              synced++;
            } else {
              const e = await createRes.json();
              errors.push(job.title + ': ' + (e.message || 'unknown error'));
            }
          } catch (jobErr) {
            errors.push(job.title + ': ' + jobErr.message);
          }
        })
      );

      // Small pause between batches to stay inside Notion rate limits
      if (i + BATCH < jobs.length) {
        await new Promise(r => setTimeout(r, DELAY));
      }
    }

    return res.status(200).json({
      synced,
      total:   jobs.length,
      failed:  errors.length,
      errors:  errors.slice(0, 10),
      message: 'Synced ' + synced + ' / ' + jobs.length + ' jobs to Notion',
    });
  }

  return res.status(400).json({ error: 'Unknown action: ' + action });
}
