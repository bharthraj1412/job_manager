# JobBoard Pro — v4.0 Fix Bundle

## Files in this folder

| File | What it does |
|------|-------------|
| `patch_v4.cjs` | Node script — patches `src/Dashboard.jsx` in-place (10 fixes) |
| `api_notion_v2.js` | Improved Notion proxy — copy to `api/notion.js` in your project |

---

## What was broken & what's fixed

### 🔴 CRITICAL — Gmail scan crashed immediately
**Root cause:** `handleGmailMultiScan()` used `${HIR}`, `${ATS}`, `${EXCL}` inside template literals, but these variables were **never defined anywhere** → `ReferenceError` every time.

**Fix:** Replaced with inline query strings covering 6 categories:
- Interview Scheduled (+ telephonic, video, HR round, round 1/2)
- Offer Received (+ appointment letter, CTC, joining formalities)
- Rejected (+ not shortlisted, better suited, not in a position)
- Applied (+ candidature received, resume received)
- Screening (+ HackerEarth, aptitude test, profile shortlisted)
- Follow-up (+ document verification, background check)

Also extended search window from 60 days → **90 days**.

### 🔴 CRITICAL — Notion sync sent `database_id: true` (boolean)
**Root cause:** The state variable `sheetsEnabled` was a **boolean toggle** (true/false) but was being passed as `database_id` to the Notion API. Notion expects a 32-char hex string → rejected every request.

The variable `sheetsSpreadsheetId` held the Notion token, but was also misnamed.

**Fix:**
- `sheetsSpreadsheetId` → `notionToken` (proper integration token string)
- `sheetsEnabled` (boolean!) → `notionDbId` (proper 32-char database ID string)
- `syncToGoogleSheets()` → `syncToNotion()` with correct parameter mapping
- Settings modal now has two proper text inputs for token + DB ID
- Token validation: must start with `secret_` or `ntn_`
- DB ID validation: must be 32 hex chars
- Setup instructions shown inline

### ✅ Also improved
- Gmail AI parsing prompt — better status detection rules for Indian HR patterns
- `scanSingleAccount` queries — added Indian job site patterns (HackerEarth, aptitude tests, profile shortlisted)
- `api/notion.js` — better error messages, column name aliases, title column auto-detection, validate action

---

## How to apply

### Step 1 — Run the patch script
```bash
# From your project root (where src/ folder is)
node patch_v4.cjs
```

Expected output:
```
  ✓  Fix Gmail QUERIES undefined HIR/ATS/EXCL constants (CRITICAL)
  ✓  Improve scanSingleAccount queries for Indian job sites
  ✓  Fix Notion state variables (...)
  ✓  Fix syncToNotion function (correct params + proper validation)
  ✓  Fix Settings localStorage save for Notion
  ✓  Fix header Notion button refs
  ✓  Replace Google Sheets settings section with proper Notion settings UI
  ✓  Improve AI email categorization prompt
  ✓  Add syncToGoogleSheets alias pointing to syncToNotion

Applied 9 patches  (1 skipped)
```

### Step 2 — Replace api/notion.js
```bash
cp api_notion_v2.js api/notion.js
```

### Step 3 — Deploy
```bash
npm run dev        # test locally first
git add .
git commit -m "fix: gmail scan crash + notion database_id bug"
git push origin main
```

---

## Setting up Notion (Free Plan)

### 1. Create an Integration
1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **+ New integration**
3. Give it a name (e.g. "JobBoard Pro")
4. Click **Save** → copy the **Internal Integration Secret** (starts with `secret_` or `ntn_`)

### 2. Create a Database
Create a Notion database with these columns:

| Column Name | Type |
|-------------|------|
| Name | Title (required) |
| Company | Text |
| Status | Select |
| Location | Text |
| Salary | Text |
| Priority | Select |
| Skills | Text |
| Apply Link | URL |
| Applied Date | Date |
| Deadline | Date |
| Source | Text |
| Notes | Text |

### 3. Connect Integration to Database
1. Open your Notion database
2. Click **···** (top right) → **Add connections**
3. Select your integration → **Confirm**

### 4. Get Database ID
From the URL: `https://www.notion.so/`**`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`**`?v=...`
Copy the 32 hex characters.

### 5. Configure in JobBoard Pro
1. Open ⚙️ Settings
2. Scroll to **Notion Sync** section
3. Paste your Integration Token
4. Paste your Database ID (hyphens are auto-removed)
5. Click **Save All Settings**
6. Click **Sync All X Jobs to Notion Now**

---

## Vercel Free Plan Notes
- Serverless functions (`api/notion.js`) are **fully included** on Vercel's Hobby (free) plan
- Rate limit: 15 syncs/minute per IP (safe for normal use)
- Batch size: 8 jobs at a time with 400ms delay (respects Notion's ~3 req/s limit)
- Max 500 jobs per sync call
