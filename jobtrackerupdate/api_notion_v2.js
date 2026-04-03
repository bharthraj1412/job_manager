// api/notion.js — Notion Sync Proxy for Vercel (Free/Hobby Plan compatible)
// ✅ Works on Vercel Free Plan — serverless functions are always included
// ✅ Rate limited · CORS safe · Smart schema detection
// ✅ Batched writes to stay inside Notion rate limits

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX    = 15;
const ipTimestamps      = {};

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

  if (!token)       return res.status(400).json({ error: 'Missing Notion integration token. Get it from notion.so/my-integrations' });
  if (!database_id) return res.status(400).json({ error: 'Missing Notion database_id. Copy the 32-char ID from your DB URL.' });
  if (!action)      return res.status(400).json({ error: 'Missing action' });

  // Validate token format
  const cleanToken = token.trim();
  const cleanDbId  = database_id.replace(/-/g, '').trim();

  if (!cleanToken.startsWith('secret_') && !cleanToken.startsWith('ntn_')) {
    return res.status(400).json({
      error: 'Invalid Notion token format. It should start with "secret_" or "ntn_". Get it from notion.so/my-integrations'
    });
  }
  if (cleanDbId.length !== 32) {
    return res.status(400).json({
      error: `Invalid Database ID length (got ${cleanDbId.length} chars, need 32). Copy the ID from your Notion database URL: notion.so/YOUR_DATABASE_ID?v=...`
    });
  }

  const notionHeaders = {
    'Authorization':  'Bearer ' + cleanToken,
    'Notion-Version': '2022-06-28',
    'Content-Type':   'application/json',
  };

  // ── Action: get_databases — list accessible databases ───────────────────
  if (action === 'get_databases') {
    try {
      const r = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({ filter: { value: 'database', property: 'object' } }),
      });
      if (!r.ok) {
        const e = await r.json();
        const hint = r.status === 401
          ? ' — Token is invalid or expired. Get a new one from notion.so/my-integrations'
          : r.status === 403
          ? ' — Token does not have access to any databases. Share your database with the integration.'
          : '';
        return res.status(r.status).json({ error: (e.message || 'Notion API error') + hint });
      }
      const data = await r.json();
      return res.status(200).json({
        databases: (data.results || []).map(db => ({
          id:    db.id.replace(/-/g, ''),
          title: db.title?.[0]?.plain_text || 'Untitled',
        }))
      });
    } catch (err) {
      return res.status(500).json({ error: 'Notion fetch error: ' + err.message });
    }
  }

  // ── Action: validate — test token + db access ─────────────────────────
  if (action === 'validate') {
    try {
      const dbRes = await fetch('https://api.notion.com/v1/databases/' + cleanDbId, {
        headers: notionHeaders,
      });
      if (!dbRes.ok) {
        const e = await dbRes.json();
        let hint = '';
        if (dbRes.status === 401) hint = ' — Token is invalid. Check notion.so/my-integrations';
        if (dbRes.status === 403) hint = ' — Integration not connected to this database. Open the DB → ··· → Add connections → select your integration';
        if (dbRes.status === 404) hint = ' — Database not found. Check the Database ID from the URL.';
        return res.status(dbRes.status).json({ error: (e.message || 'Access error') + hint });
      }
      const db = await dbRes.json();
      const props = Object.keys(db.properties || {});
      return res.status(200).json({
        ok: true,
        dbTitle: db.title?.[0]?.plain_text || 'Untitled',
        columns: props,
        missingColumns: ['Name','Company','Status','Location','Salary','Priority','Skills','Apply Link','Applied Date','Deadline','Source','Notes'].filter(c => !props.includes(c)),
      });
    } catch (err) {
      return res.status(500).json({ error: 'Validation error: ' + err.message });
    }
  }

  // ── Action: sync_jobs — create Notion pages for jobs ────────────────────
  if (action === 'sync_jobs') {
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ error: 'No jobs to sync' });
    }
    if (jobs.length > 500) {
      return res.status(400).json({ error: 'Too many jobs (max 500 per call). Filter before syncing.' });
    }

    // 1. Fetch DB schema so we only write columns that exist
    let existingProps = {};
    try {
      const dbRes = await fetch('https://api.notion.com/v1/databases/' + cleanDbId, {
        headers: notionHeaders,
      });
      if (!dbRes.ok) {
        const e = await dbRes.json();
        let msg = e.message || 'Cannot access this Notion database.';
        if (dbRes.status === 401) msg += ' — Token invalid or expired.';
        if (dbRes.status === 403) msg += ' — Share the database with your integration: open DB → ··· → Add connections.';
        if (dbRes.status === 404) msg += ' — Database not found. Check the 32-char ID from the URL.';
        return res.status(dbRes.status).json({ error: msg });
      }
      const db = await dbRes.json();
      existingProps = db.properties || {};
    } catch (err) {
      return res.status(500).json({ error: 'Could not fetch Notion DB schema: ' + err.message });
    }

    const colNames = Object.keys(existingProps);

    // 2. Find the title/Name column (required by Notion)
    const titleCol = colNames.find(c => existingProps[c]?.type === 'title') || 'Name';

    // 3. Batch-create pages
    let synced = 0;
    const errors = [];
    const BATCH = 8;   // Notion allows ~3 req/s; 8 parallel × 350ms ≈ safe
    const DELAY = 400; // ms between batches

    for (let i = 0; i < jobs.length; i += BATCH) {
      const batch = jobs.slice(i, i + BATCH);

      await Promise.allSettled(
        batch.map(async job => {
          try {
            const properties = {
              [titleCol]: {
                title: [{ text: { content: (job.title || 'Untitled').slice(0, 2000) } }]
              },
            };

            // Helper: add a property only if the column exists in the DB
            const addProp = (col, type, val) => {
              if (!colNames.includes(col) || !val) return;
              if (type === 'rich_text') {
                properties[col] = { rich_text: [{ text: { content: String(val).slice(0, 2000) } }] };
              } else if (type === 'select') {
                properties[col] = { select: { name: String(val) } };
              } else if (type === 'url') {
                const u = String(val);
                if (u.startsWith('http')) properties[col] = { url: u };
              } else if (type === 'date') {
                const d = String(val).slice(0, 10);
                if (/^\d{4}-\d{2}-\d{2}$/.test(d)) properties[col] = { date: { start: d } };
              } else if (type === 'number') {
                const n = parseFloat(val);
                if (!isNaN(n)) properties[col] = { number: n };
              }
            };

            // Map all job fields to likely Notion column names
            addProp('Company',      'rich_text', job.company);
            addProp('Location',     'rich_text', job.location);
            addProp('Salary',       'rich_text', job.salary);
            addProp('Skills',       'rich_text', job.skills);
            addProp('Source',       'rich_text', job.source);
            addProp('Notes',        'rich_text', job.notes);
            addProp('Status',       'select',    job.status);
            addProp('Priority',     'select',    job.priority);
            addProp('Type',         'select',    job.type);
            addProp('Apply Link',   'url',       job.applylink);
            addProp('Applied Date', 'date',      job.applieddate);
            addProp('Deadline',     'date',      job.deadline);
            // Alternative column name spellings
            addProp('Apply URL',    'url',       job.applylink);
            addProp('Applied',      'date',      job.applieddate);
            addProp('Due Date',     'date',      job.deadline);
            addProp('Job Type',     'select',    job.type);
            addProp('URL',          'url',       job.applylink);

            const createRes = await fetch('https://api.notion.com/v1/pages', {
              method: 'POST',
              headers: notionHeaders,
              body: JSON.stringify({ parent: { database_id: cleanDbId }, properties }),
            });

            if (createRes.ok) {
              synced++;
            } else {
              const e = await createRes.json();
              errors.push((job.title || 'Unknown') + ': ' + (e.message || 'unknown error'));
            }
          } catch (jobErr) {
            errors.push((job.title || 'Unknown') + ': ' + jobErr.message);
          }
        })
      );

      if (i + BATCH < jobs.length) {
        await new Promise(r => setTimeout(r, DELAY));
      }
    }

    return res.status(200).json({
      synced,
      total:   jobs.length,
      failed:  errors.length,
      errors:  errors.slice(0, 10),
      message: `Synced ${synced} / ${jobs.length} jobs to Notion`,
    });
  }

  return res.status(400).json({ error: 'Unknown action: ' + action });
}
