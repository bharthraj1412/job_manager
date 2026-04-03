# JobBoard Pro — v3.0 Fix Bundle

## Files in this folder

| File | What it does |
|------|-------------|
| `patch_v3.cjs` | Node script — patches `src/Dashboard.jsx` in-place |
| `api/notion.js` | New Vercel serverless function — Notion sync proxy |
| `calendar_events.sql` | SQL for the missing `calendar_events` table |

---

## How to apply

### 1. Run the patch script
```bash
# From your project root (G:\job tracker project\job-tracker-react)
node patch_v3.cjs
```

It prints ✓ for each of 8 patches it applies. If any shows ⚠, the
section already exists or the file formatting changed — those are safe to skip.

### 2. Copy the Notion proxy
```bash
# Copy api/notion.js → your project's api/ folder
# It should sit next to api/ai.js
```

### 3. Run the Calendar SQL
Open Supabase Dashboard → SQL Editor → paste `calendar_events.sql` → Run.

### 4. Deploy
```bash
git add .
git commit -m "feat: Notion sync, parallel Gmail scan, targets bug fix"
git push origin main
# Vercel auto-deploys from main
```

---

## What was fixed / added

### 🐛 Bug fixes
| # | Bug | Impact |
|---|-----|--------|
| 1 | `targets` variable used but never defined in `handleSendJobDigest` | Job Digest emails were **crashing silently** — they never sent |
| 2 | `calendar_events` table missing from Supabase schema | Calendar tab threw Supabase errors for all users |

### ⚡ Gmail multi-account scan improvements
| Before | After |
|--------|-------|
| Sequential (one account at a time) | **Parallel** — all accounts scanned simultaneously via `Promise.allSettled` |
| All accounts showed "Ready" until their turn | All accounts show **spinning ◌ immediately** when scan starts |
| Error in one account blocked the rest | Errors are **isolated per account** — others finish normally |
| ~8 s per account | **~8 s total** regardless of how many accounts |

### 📝 Notion Sync (new feature)
- **What**: Export any/all of your tracked jobs into a Notion database with one click.
- **Where**: ⚙️ Settings → Notion Sync section.  After saving token + DB ID, a **📝 Notion** button appears in the top header.
- **How the proxy works**: Browser → `/api/notion` (Vercel) → Notion API (Notion blocks direct browser CORS).
- **Rate-limited**: 10 sync calls/minute per IP.
- **Smart schema detection**: Only writes columns that actually exist in your Notion DB — no crashes if you leave some out.
- **Batched**: Jobs are created in batches of 10 with 350 ms gaps to stay inside Notion's rate limits.

### Notion DB columns (create these in Notion)
```
Name          Title
Company       Text
Status        Select  (Bookmarked / Applied / Interview / Offer / Rejected / Withdrawn)
Location      Text
Salary        Text
Priority      Select  (High / Medium / Low)
Skills        Text
Apply Link    URL
Applied Date  Date
Deadline      Date
Source        Text
Notes         Text
```

---

## Notion setup (3 minutes)

1. Go to **notion.so/my-integrations** → **New integration** → give it a name → copy the **Internal Integration Token** (`secret_...`).
2. In Notion, open (or create) a database with the columns listed above.
3. Click **···** (top-right of database) → **Add connections** → select your integration.
4. Copy the **database ID** from the URL:  
   `https://www.notion.so/**xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx**?v=...`
5. Paste both into JobBoard Pro → ⚙️ Settings → Notion Sync → Save.
