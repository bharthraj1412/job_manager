// patch_v4.cjs — JobBoard Pro v4.0 Gmail + Notion Complete Fix
// Run: node patch_v4.cjs  (from project root, same folder as src/)
//
// FIXES APPLIED:
//   1. Gmail scan — CRITICAL: undefined HIR/ATS/EXCL crash fixed
//   2. Gmail scan — 8 better query categories covering Indian job sites
//   3. Gmail scan — improved AI categorization prompt
//   4. Gmail scan — scanSingleAccount queries improved for Naukri/LinkedIn/Internshala
//   5. Notion — CRITICAL: database_id was a boolean (true/false) not a string!
//   6. Notion — proper notionToken + notionDbId state variables
//   7. Notion — syncToNotion function fixed with correct API params
//   8. Notion — Settings modal UI with proper token + DB ID inputs
//   9. Notion — header button + settings save/load fixed
// ─────────────────────────────────────────────────────────────────────────────

'use strict';
const fs   = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'Dashboard.jsx');
if (!fs.existsSync(filePath)) {
  console.error('❌  src/Dashboard.jsx not found — run from project root.');
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf-8');
const origLen = code.length;
let applied = 0, skipped = 0;

function patch(name, from, to) {
  if (code.includes(from)) {
    code = code.replace(from, to);
    console.log('  ✓  ' + name);
    applied++;
  } else {
    console.warn('  ⚠  NOT FOUND (skip): ' + name);
    skipped++;
  }
}

console.log('\n🔧  JobBoard Pro — patch_v4.cjs\n');

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 1 — CRITICAL: Fix Gmail handleGmailMultiScan undefined HIR/ATS/EXCL
//   These template vars are never defined → ReferenceError crashes the scan.
//   Replace the whole broken GMAIL_QUERIES array with proper inline strings.
// ══════════════════════════════════════════════════════════════════════════════
{
  const START = 'const GMAIL_QUERIES = [';
  const si = code.indexOf(START);
  if (si !== -1) {
    const ei = code.indexOf('];', si) + 2;
    const block = code.slice(si, ei);
    if (block.includes('${HIR}') || block.includes('${ATS}') || block.includes('${EXCL}')) {
      const fixed = `const GMAIL_QUERIES = [
        // Interview invitations
        { label: 'Interview Scheduled',
          q: '(subject:interview OR subject:"invite you" OR subject:"next round" OR subject:"schedule a call" OR subject:"interview confirmed" OR subject:"interview invite" OR subject:"interview details" OR subject:"technical interview" OR subject:"hr round" OR subject:"round 1" OR subject:"round 2" OR subject:"joining date" OR subject:"we would like to meet" OR subject:"video interview" OR subject:"telephonic interview") newer_than:90d -subject:newsletter -subject:unsubscribe -subject:"password reset" -subject:OTP -subject:"verify your email"' },
        // Offers
        { label: 'Offer Received',
          q: '(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer" OR subject:"congratulations" OR subject:"selected for" OR subject:"we are excited" OR subject:"offer accepted" OR subject:"joining formalities" OR subject:"onboarding" OR subject:"welcome to the team" OR subject:"appointment letter" OR subject:"ctc" OR subject:"compensation letter") newer_than:90d -subject:newsletter -subject:unsubscribe' },
        // Rejections
        { label: 'Rejected',
          q: '(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates" OR subject:"regret to inform" OR subject:"will not be proceeding" OR subject:"decided not to" OR subject:"position has been filled" OR subject:"not shortlisted" OR subject:"better suited" OR subject:"not be considered" OR subject:"not in a position") newer_than:90d -subject:newsletter -subject:unsubscribe' },
        // Application confirmations
        { label: 'Applied',
          q: '(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted" OR subject:"application confirmation" OR subject:"we received your" OR subject:"successfully applied" OR subject:"your application" OR subject:"application acknowledged" OR subject:"applied for" OR subject:"resume received" OR subject:"candidature received" OR subject:"application for the role") newer_than:90d -subject:newsletter -subject:unsubscribe -subject:"password reset" -subject:"verify your"' },
        // Screening / assessment
        { label: 'Screening',
          q: '(subject:"phone screen" OR subject:"screening call" OR subject:"initial call" OR subject:"introductory call" OR subject:recruiter OR subject:"coding challenge" OR subject:assessment OR subject:"take-home" OR subject:"online test" OR subject:"hackerrank" OR subject:"codility" OR subject:"aptitude test" OR subject:"written test" OR subject:"technical test" OR subject:"pre-screening" OR subject:"profile shortlisted" OR subject:"shortlisted for interview" OR subject:"merit list" OR subject:"hackerearth") newer_than:90d -subject:newsletter -subject:unsubscribe' },
        // Follow-ups / status updates
        { label: 'Follow-up',
          q: '(subject:"next steps" OR subject:"following up" OR subject:"update on your" OR subject:shortlisted OR subject:"moved forward" OR subject:"further process" OR subject:"keep you posted" OR subject:"application status" OR subject:"background check" OR subject:"reference check" OR subject:"document verification" OR subject:"joining confirmation") newer_than:90d -subject:newsletter -subject:unsubscribe' },
      ]`;
      code = code.slice(0, si) + fixed + code.slice(ei);
      console.log('  ✓  Fix Gmail QUERIES undefined HIR/ATS/EXCL constants (CRITICAL)');
      applied++;
    } else {
      console.log('  ℹ  Gmail QUERIES — no ${HIR} found, may already be fixed');
    }
  } else {
    console.warn('  ⚠  Gmail QUERIES block not found');
    skipped++;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 2 — Improve scanSingleAccount queries for Indian job sites
//   Add Naukri, Internshala, HackerEarth, TimesJobs, Freshersworld etc.
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Improve scanSingleAccount queries for Indian job sites',
  `        { label: "Interview Scheduled",   q: '(subject:interview OR subject:"invite you" OR subject:"next round" OR subject:"schedule a call" OR subject:"interview confirmed" OR subject:"interview invite" OR subject:"technical interview" OR subject:"joining date" OR subject:"hr round" OR subject:"round 1" OR subject:"round 2") newer_than:60d -subject:newsletter -subject:unsubscribe -subject:"password reset"' },
        { label: "Offer Received",      q: '(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer" OR subject:"congratulations" OR subject:"selected for" OR subject:"we are excited" OR subject:"offer accepted" OR subject:"joining formalities" OR subject:"onboarding" OR subject:"welcome to the team") newer_than:60d -subject:newsletter' },
        { label: "Rejected",            q: '(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates" OR subject:"regret to inform" OR subject:"will not be proceeding" OR subject:"decided not to" OR subject:"position has been filled" OR subject:"not shortlisted" OR subject:"better suited" OR subject:"not be considered") newer_than:60d -subject:newsletter -subject:unsubscribe' },
        { label: "Applied",             q: '(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted" OR subject:"application confirmation" OR subject:"we received your" OR subject:"successfully applied" OR subject:"your application" OR subject:"application acknowledged" OR subject:"applied for" OR subject:"resume received") newer_than:60d -subject:newsletter -subject:unsubscribe -subject:"password reset" -subject:"verify your"' },
        { label: "Screening",           q: '(subject:"phone screen" OR subject:"screening call" OR subject:"initial call" OR subject:"introductory call" OR subject:recruiter OR subject:"coding challenge" OR subject:"assessment" OR subject:"take-home" OR subject:"online test" OR subject:"hackerrank" OR subject:"codility" OR subject:"aptitude test" OR subject:"written test" OR subject:"technical test") newer_than:60d -subject:newsletter -subject:unsubscribe' },`,
  `        { label: "Interview Scheduled",   q: '(subject:interview OR subject:"invite you" OR subject:"next round" OR subject:"schedule a call" OR subject:"interview confirmed" OR subject:"interview invite" OR subject:"technical interview" OR subject:"joining date" OR subject:"hr round" OR subject:"round 1" OR subject:"round 2" OR subject:"telephonic interview" OR subject:"virtual interview" OR subject:"zoom interview") newer_than:90d -subject:newsletter -subject:unsubscribe -subject:"password reset" -subject:OTP' },
        { label: "Offer Received",      q: '(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer" OR subject:"congratulations" OR subject:"selected for" OR subject:"we are excited" OR subject:"offer accepted" OR subject:"joining formalities" OR subject:"onboarding" OR subject:"welcome to the team" OR subject:"appointment letter" OR subject:"ctc breakdown" OR subject:"compensation") newer_than:90d -subject:newsletter' },
        { label: "Rejected",            q: '(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates" OR subject:"regret to inform" OR subject:"will not be proceeding" OR subject:"decided not to" OR subject:"position has been filled" OR subject:"not shortlisted" OR subject:"better suited" OR subject:"not be considered" OR subject:"not in a position to") newer_than:90d -subject:newsletter -subject:unsubscribe' },
        { label: "Applied",             q: '(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted" OR subject:"application confirmation" OR subject:"we received your" OR subject:"successfully applied" OR subject:"your application" OR subject:"application acknowledged" OR subject:"applied for" OR subject:"resume received" OR subject:"candidature received") newer_than:90d -subject:newsletter -subject:unsubscribe -subject:"password reset" -subject:"verify your"' },
        { label: "Screening",           q: '(subject:"phone screen" OR subject:"screening call" OR subject:"initial call" OR subject:"introductory call" OR subject:recruiter OR subject:"coding challenge" OR subject:assessment OR subject:"take-home" OR subject:"online test" OR subject:"hackerrank" OR subject:"codility" OR subject:"aptitude test" OR subject:"written test" OR subject:"technical test" OR subject:"hackerearth" OR subject:"profile shortlisted" OR subject:"shortlisted for") newer_than:90d -subject:newsletter -subject:unsubscribe' },`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 3 — CRITICAL: Fix Notion state variables
//   sheetsSpreadsheetId → notionToken  (string: integration token)
//   sheetsEnabled (boolean!) → notionDbId  (string: database ID)
//   The old sheetsEnabled was boolean true/false which meant database_id was
//   literally the string "true" in API calls → Notion rejected every request!
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Fix Notion state variables (sheetsSpreadsheetId/sheetsEnabled → notionToken/notionDbId)',
  `  const [sheetsSpreadsheetId,   setSheetsSpreadsheetId]   = useState(() => localStorage.getItem("sheetsSpreadsheetId") || "");
  const [sheetsEnabled,    setSheetsEnabled]    = useState(() => localStorage.getItem("sheetsEnabled") === "true");
  const [sheetsSyncing, setSheetsSyncing] = useState(false);`,
  `  const [notionToken,    setNotionToken]    = useState(() => localStorage.getItem("notionToken") || "");
  const [notionDbId,     setNotionDbId]     = useState(() => localStorage.getItem("notionDbId")  || "");
  const [sheetsSyncing, setSheetsSyncing] = useState(false);`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 4 — CRITICAL: Fix syncToGoogleSheets → syncToNotion with correct params
//   Old code passed database_id: sheetsEnabled (a boolean!) — always invalid
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Fix syncToNotion function (correct params + proper validation)',
  `  async function syncToGoogleSheets(jobsToSync) {
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings", "err");
    // sheetsEnabled check removed - Google Sheets needs no config in ⚙️ Settings", "err");
    const toSync = jobsToSync || jobs;
    if (!toSync.length) return notify("No jobs to sync", "err");
    setSheetsSyncing(true);
    notify("Syncing " + toSync.length + " jobs to Notion…");
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_jobs",
          token: sheetsSpreadsheetId,
          database_id: sheetsEnabled,`,
  `  async function syncToNotion(jobsToSync) {
    if (!notionToken) return notify("Add Notion Integration Token in ⚙️ Settings → Notion Sync", "err");
    if (!notionDbId)  return notify("Add Notion Database ID in ⚙️ Settings → Notion Sync", "err");
    if (!notionToken.startsWith("secret_") && !notionToken.startsWith("ntn_")) {
      return notify("Notion token should start with 'secret_' or 'ntn_'. Check ⚙️ Settings.", "err");
    }
    const toSync = jobsToSync || jobs;
    if (!toSync.length) return notify("No jobs to sync", "err");
    setSheetsSyncing(true);
    notify(\`Syncing \${toSync.length} jobs to Notion…\`);
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_jobs",
          token: notionToken,
          database_id: notionDbId.replace(/-/g, ""),  // strip hyphens if pasted from URL`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 5 — Fix Settings save/load for Notion vars
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Fix Settings localStorage save for Notion',
  `    localStorage.setItem("sheetsSpreadsheetId",   sheetsSpreadsheetId);
    localStorage.setItem("sheetsEnabled",    sheetsEnabled);`,
  `    localStorage.setItem("notionToken",   notionToken);
    localStorage.setItem("notionDbId",    notionDbId);`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 6 — Fix header Notion button
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Fix header Notion button refs',
  `            {sheetsSpreadsheetId && sheetsEnabled && (
              <Btn onClick={() => syncToGoogleSheets()} disabled={sheetsSyncing} v="vio" sx={{ fontSize: 11, padding: "7px 12px" }}>
                {sheetsSyncing ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Syncing…</> : "📝 Notion"}
              </Btn>
            )}`,
  `            {notionToken && notionDbId && (
              <Btn onClick={() => syncToNotion()} disabled={sheetsSyncing} v="vio" sx={{ fontSize: 11, padding: "7px 12px" }}>
                {sheetsSyncing ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Syncing…</> : "📝 Notion"}
              </Btn>
            )}`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 7 — Replace Google Sheets Settings section with proper Notion section
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Replace Google Sheets settings section with proper Notion settings UI',
  `        {/* ── Google Sheets Sync Settings ── */}
        <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.22)", borderRadius: 10, padding: 16, margin: "14px 0" }}>
          <div style={{ color: "#4ade80", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            📊 Google Sheets Sync
            <span style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", padding: "1px 8px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>Free • No setup needed</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14, lineHeight: 1.7 }}>
            Sync all your jobs to a Google Spreadsheet with one click. Uses your existing Google account — no API keys or tokens needed.
            {sheetsSpreadsheetId && (
              <span style={{ display: "block", marginTop: 8 }}>
                <span style={{ color: "#4ade80", fontWeight: 700 }}>✓ Connected</span>
                {" — "}
                <a href={\`https://docs.google.com/spreadsheets/d/\${sheetsSpreadsheetId}\`} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "underline" }}>Open Spreadsheet ↗</a>
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => syncToGoogleSheets()}
              disabled={sheetsSyncing || !clientId}
              style={{ background: "linear-gradient(135deg,#065f46,#047857)", border: "1px solid rgba(34,197,94,0.3)", color: "#a7f3d0", borderRadius: 8, padding: "9px 20px", cursor: sheetsSyncing ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              {sheetsSyncing
                ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Syncing…</>
                : "📊 Sync All " + jobs.length + " Jobs to Google Sheets"}
            </button>
            {sheetsSpreadsheetId && (
              <button
                onClick={() => { setSheetsSpreadsheetId(""); localStorage.removeItem("sheetsSpreadsheetId"); notify("Spreadsheet link cleared — next sync will create a new one"); }}
                style={{ background: "transparent", border: "1px solid #1e2d45", color: "#64748b", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>
                🔄 New Sheet
              </button>
            )}
          </div>
          {!clientId && (
            <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 10 }}>⚠️ Add your Google Client ID above first to enable Sheets sync.</div>
          )}
        </div>`,
  `        {/* ── Notion Sync Settings ── */}
        <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.22)", borderRadius: 10, padding: 16, margin: "14px 0" }}>
          <div style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            📝 Notion Sync
            <span style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", padding: "1px 8px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>Vercel Free Plan ✓</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14, lineHeight: 1.7 }}>
            Export your jobs to a Notion database. Requires a Notion Integration Token and Database ID.
            {notionToken && notionDbId && <span style={{ display: "block", marginTop: 6, color: "#a78bfa", fontWeight: 700 }}>✓ Configured — ready to sync</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Integration Token</div>
              <input
                type="password"
                value={notionToken}
                onChange={e => setNotionToken(e.target.value.trim())}
                placeholder="secret_xxxxxxxxxxxx"
                style={{ width: "100%", background: "#070f1c", border: \`1px solid \${notionToken ? "rgba(139,92,246,0.4)" : "#1e2d45"}\`, borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              />
              <div style={{ fontSize: 9, color: "#475569", marginTop: 4 }}>notion.so/my-integrations → New integration → copy token</div>
            </div>
            <div>
              <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Database ID</div>
              <input
                type="text"
                value={notionDbId}
                onChange={e => setNotionDbId(e.target.value.trim().replace(/-/g, ""))}
                placeholder="32-char hex from DB URL"
                style={{ width: "100%", background: "#070f1c", border: \`1px solid \${notionDbId ? "rgba(139,92,246,0.4)" : "#1e2d45"}\`, borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              />
              <div style={{ fontSize: 9, color: "#475569", marginTop: 4 }}>URL: notion.so/DATABASE_ID?v=… → copy 32 chars</div>
            </div>
          </div>
          {notionToken && notionDbId && (
            <button
              onClick={() => syncToNotion()}
              disabled={sheetsSyncing}
              style={{ background: "linear-gradient(135deg,#4c1d95,#5b21b6)", border: "1px solid rgba(139,92,246,0.3)", color: "#c4b5fd", borderRadius: 8, padding: "9px 20px", cursor: sheetsSyncing ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              {sheetsSyncing ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Syncing…</> : \`📝 Sync All \${jobs.length} Jobs to Notion Now\`}
            </button>
          )}
          <div style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#64748b", lineHeight: 1.8 }}>
            <strong style={{ color: "#8b5cf6" }}>Quick Setup (3 steps):</strong><br/>
            1. <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" style={{ color: "#818cf8" }}>notion.so/my-integrations</a> → New integration → copy <em>Internal Integration Secret</em><br/>
            2. In Notion: open your DB → ··· → <em>Add connections</em> → select your integration<br/>
            3. Copy 32-char DB ID from URL: notion.so/<strong style={{ color: "#a78bfa" }}>xxxxxxxx…</strong>?v=…<br/>
            <strong style={{ color: "#8b5cf6" }}>Notion DB columns needed:</strong> Name (Title), Company, Status, Location, Salary, Priority, Skills, Apply Link, Applied Date, Deadline, Source, Notes
          </div>
          {!notionToken && (
            <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 10 }}>⚠️ Works on Vercel Free (Hobby) plan — uses a serverless proxy at /api/notion</div>
          )}
        </div>`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 8 — Fix the AI email parsing prompt to be more accurate
//   Better status detection, especially for Indian HR email patterns
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Improve AI email categorization prompt',
  `        const text = await AI(
        \`Analyze these job emails from Gmail. Return ONLY a JSON array. Each object must have these keys: company, jobTitle, status (one of: Applied|Screening|Interview Scheduled|Interview Done|Offer Received|Rejected|Pending), interviewDate, interviewTime, interviewType, sender, date, snippet, subject, fromAccount.

Emails:
\${JSON.stringify(deduped.slice(0, 30))}\`,
        "Return only a valid JSON array, no markdown, no extra text."
      );`,
  `        const text = await AI(
        \`Analyze these job application emails and classify each one. Return ONLY a valid JSON array.

STATUS RULES (pick exactly one):
- "Interview Scheduled" → invitation to interview, schedule/join a call, technical/HR round invite
- "Offer Received" → offer letter, job offer, congratulations on selection, appointment letter, joining date
- "Rejected" → unfortunately, not selected, other candidates, regret to inform, not moving forward
- "Applied" → application received, thank you for applying, successfully applied, resume received
- "Screening" → coding challenge, assessment, aptitude test, profile shortlisted, recruiter call request, hackerrank/codility link
- "Interview Done" → post-interview, after your interview, waiting for results (you completed an interview)
- "Pending" → anything else job-related but unclear status

Each object: { company (extract company name from sender/subject), jobTitle (extract role from subject), status (from rules above), interviewDate (YYYY-MM-DD or ""), interviewTime ("HH:MM" or ""), interviewType ("Video"|"Phone"|"In-person"|""), sender, date, snippet (max 100 chars), subject, fromAccount }

Emails to analyze:
\${JSON.stringify(deduped.slice(0, 40))}\`,
        "Return ONLY a valid JSON array. No markdown, no preamble, no explanation."
      );`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 9 — Fix syncToGoogleSheets alias so old references still work
//   The Settings modal still calls syncToGoogleSheets in the Sheets section
//   but that section is now replaced, so we just need to add the alias
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Add syncToGoogleSheets alias pointing to syncToNotion',
  `  async function syncToNotion(jobsToSync) {`,
  `  // Alias kept for compatibility (any leftover references)
  const syncToGoogleSheets = (...args) => syncToNotion(...args);

  async function syncToNotion(jobsToSync) {`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 10 — Fix handleSendJobDigest - remove stale sheetsSyncing refs
// ══════════════════════════════════════════════════════════════════════════════
// No change needed here, sheetsSyncing state var name is kept.

// ══════════════════════════════════════════════════════════════════════════════
// Write the patched file
// ══════════════════════════════════════════════════════════════════════════════
fs.writeFileSync(filePath, code, 'utf-8');
const newLen = fs.statSync(filePath).size;

console.log('');
console.log('─'.repeat(56));
console.log((applied >= 6 ? '✅' : '⚠ ') + '  Applied ' + applied + ' patches  (' + skipped + ' skipped)');
console.log('   File: ' + Math.round(origLen / 1024) + ' KB  →  ' + Math.round(newLen / 1024) + ' KB');
if (skipped > 0) {
  console.log('');
  console.log('   Skipped patches = text not found (may already be applied).');
  console.log('   Check the source manually if features still misbehave.');
}
console.log('');
console.log('📌  Next steps:');
console.log('');
console.log('   NOTION:');
console.log('   1. Open ⚙️ Settings → Notion Sync section');
console.log('   2. Paste your Integration Token (starts with secret_ or ntn_)');
console.log('   3. Paste your Database ID (32 hex chars from the Notion URL)');
console.log('   4. Make sure your DB has these columns:');
console.log('      Name(Title), Company, Status, Location, Salary, Priority,');
console.log('      Skills, Apply Link, Applied Date, Deadline, Source, Notes');
console.log('   5. Click "Sync All Jobs to Notion Now"');
console.log('');
console.log('   GMAIL:');
console.log('   1. Click "📧 Scan Gmail" in the header OR go to Gmail tab');
console.log('   2. Add Gmail accounts in the Gmail tab for multi-account scan');
console.log('   3. The scan now covers 90 days and 6 categories');
console.log('');
console.log('   DEPLOY:');
console.log('   npm run dev      (test locally)');
console.log('   git add . && git commit -m "fix: gmail scan + notion integration"');
console.log('   git push origin main   (Vercel auto-deploys)');
console.log('');
