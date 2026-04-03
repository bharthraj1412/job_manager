const fs = require('fs');
const path = require('path');

const file = path.join('g:', 'job tracker project', 'job-tracker-react', 'src', 'Dashboard.jsx');
let content = fs.readFileSync(file, 'utf8');
const initialContent = content;

console.log('Original size:', content.length);

// Helper to escape regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// FIX 1: handleGmailMultiScan querying and limits
content = content.replace(/maxResults=10&/, 'maxResults=50&');
content = content.replace(/newer_than:14d/g, 'newer_than:60d');
content = content.replace(/in the last 14 days/g, 'in the last 60 days');
content = content.replace(/up to 15 emails/g, 'up to 40 emails');
content = content.replace(/\.slice\(0, 15\)/g, '.slice(0, 40)');

// Broaden queries for handleGmailMultiScan
const oldQueries = /const GMAIL_QUERIES = \[\s*\{ label: "Interview Scheduled",\s*q: "[^"]+" \},\s*\{ label: "Offer Received",\s*q: "[^"]+" \},\s*\{ label: "Rejected",\s*q: "[^"]+" \},\s*\{ label: "Applied",\s*q: "[^"]+" \},\s*\{ label: "Screening",\s*q: "[^"]+" \},\s*\];/m;

const newQueries = `const ATS = "from:greenhouse.io OR from:lever.co OR from:workday.com OR from:myworkdayjobs.com OR from:icims.com OR from:smartrecruiters.com OR from:ashbyhq.com OR from:bamboohr.com OR from:jazz.co";
      const HIR = "from:careers OR from:jobs OR from:hiring OR from:hr OR from:noreply OR from:talent OR from:recruiting OR from:recruit OR from:team OR from:people OR from:no-reply";
      const EXCL = "-subject:newsletter -subject:unsubscribe -subject:promotion";

      const GMAIL_QUERIES = [
        { label: "Interview Scheduled",   q: \`(subject:interview OR subject:"invite you" OR subject:"next round" OR subject:"schedule a call" OR subject:"interview confirmed") (\${HIR} OR \${ATS}) \${EXCL}\` },
        { label: "Offer Received",        q: \`(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer" OR subject:"congratulations" OR subject:"selected for" OR subject:"we are excited") (\${HIR} OR \${ATS}) \${EXCL}\` },
        { label: "Rejected",              q: \`(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates" OR subject:"regret" OR subject:"will not be proceeding") (\${HIR} OR \${ATS}) \${EXCL}\` },
        { label: "Applied",               q: \`(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted" OR subject:"application confirmation" OR subject:"we received your" OR subject:"successfully applied" OR subject:"your application") (\${HIR} OR \${ATS}) \${EXCL}\` },
        { label: "Screening",             q: \`(subject:"phone screen" OR subject:"screening call" OR subject:"initial call" OR subject:"introductory call" OR subject:"recruiter" OR subject:"let's connect") (\${HIR} OR \${ATS}) \${EXCL}\` },
        { label: "Assessment",            q: \`(subject:"coding challenge" OR subject:"assessment" OR subject:"take-home" OR subject:"online test" OR subject:"technical test" OR subject:"hackerrank" OR subject:"codility") (\${HIR} OR \${ATS}) \${EXCL}\` },
        { label: "Follow-up",             q: \`(subject:"next steps" OR subject:"following up" OR subject:"update on your" OR subject:"shortlisted" OR subject:"moved forward") (\${HIR} OR \${ATS}) \${EXCL}\` },
      ];`;

content = content.replace(oldQueries, newQueries);

// FIX 2: scanSingleAccount querying and limits
content = content.replace(/maxResults=15&/g, 'maxResults=50&');
content = content.replace(/\.slice\(0, 20\)/g, '.slice(0, 40)');
content = content.replace(/newer_than:30d/g, 'newer_than:60d');

// Replace scanSingleAccount specific queries (using generic replace for parts)
content = content.replace(/\(subject:"interview scheduled"[^\)]*\)/g, '(subject:interview OR subject:"invite you" OR subject:"next round" OR subject:"schedule a call" OR subject:"interview confirmed")');
content = content.replace(/\(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer"\)/g, '(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer" OR subject:"congratulations" OR subject:"selected for" OR subject:"we are excited")');
content = content.replace(/\(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates"\)/g, '(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates" OR subject:"regret" OR subject:"will not be proceeding" OR subject:"decided not to")');
content = content.replace(/\(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted"\)/g, '(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted" OR subject:"application confirmation" OR subject:"we received your" OR subject:"successfully applied" OR subject:"your application")');
content = content.replace(/\(subject:"phone screen" OR subject:"screening call" OR subject:"initial call"\)/g, '(subject:"phone screen" OR subject:"screening call" OR subject:"initial call" OR subject:"introductory call" OR subject:recruiter OR subject:"coding challenge" OR subject:assessment OR subject:"take-home" OR subject:"next steps" OR subject:"following up" OR subject:shortlisted)');
content = content.replace(/\(from:careers OR from:jobs OR from:recruiting OR from:hr OR from:talent\)/g, '(from:careers OR from:jobs OR from:recruiting OR from:hr OR from:talent OR from:greenhouse.io OR from:lever.co OR from:workday.com OR from:icims.com OR from:smartrecruiters.com)');
content = content.replace(/\(from:careers OR from:jobs OR from:hr OR from:recruiting\)/g, '(from:careers OR from:jobs OR from:hr OR from:recruiting OR from:greenhouse.io OR from:lever.co OR from:workday.com OR from:icims.com OR from:smartrecruiters.com)');
content = content.replace(/\(from:careers OR from:jobs OR from:hr OR from:noreply\)/g, '(from:careers OR from:jobs OR from:hr OR from:noreply OR from:recruiting OR from:greenhouse.io OR from:lever.co OR from:workday.com OR from:icims.com OR from:smartrecruiters.com)');


// FIX 3: fetchAndParseEmails querying and limits
content = content.replace(/maxResults=35/g, 'maxResults=60');
content = content.replace(/subject:"unfortunately" OR subject:"screening call" OR subject:"phone screen"\)"/g, 'subject:"unfortunately" OR subject:"not selected" OR subject:"regret" OR subject:"screening call" OR subject:"phone screen" OR subject:"coding challenge" OR subject:"assessment" OR subject:"take-home" OR subject:"next steps" OR subject:"congratulations" OR subject:"selected for" OR subject:"following up" OR subject:"shortlisted")"');


// FIX 4: Notion to Google Sheets
// State variables
content = content.replace(/const \[notionToken,\s*setNotionToken\]\s*=\s*useState\(\(\) => localStorage.getItem\("notionToken"\) \|\| ""\);/g, 'const [sheetsSpreadsheetId, setSheetsSpreadsheetId] = useState(() => localStorage.getItem("sheetsSpreadsheetId") || "");');
content = content.replace(/const \[notionDbId,\s*setNotionDbId\]\s*=\s*useState\(\(\) => localStorage.getItem\("notionDbId"\)\s*\|\| ""\);/g, 'const [sheetsEnabled, setSheetsEnabled] = useState(() => localStorage.getItem("sheetsEnabled") === "true");');
content = content.replace(/const \[notionSyncing,\s*setNotionSyncing\]\s*=\s*useState\(false\);/g, 'const [sheetsSyncing, setSheetsSyncing] = useState(false);');

// Save settings replacements
content = content.replace(/localStorage.setItem\("notionToken",\s*notionToken\);/g, 'localStorage.setItem("sheetsSpreadsheetId", sheetsSpreadsheetId);');
content = content.replace(/localStorage.setItem\("notionDbId",\s*notionDbId\);/g, 'localStorage.setItem("sheetsEnabled", String(sheetsEnabled));');

// Toolbar button
content = content.replace(/\{notionToken && notionDbId && \(/g, '{clientId && (');
content = content.replace(/<Btn onClick=\{\(\) => syncToNotion\(\)\} disabled=\{notionSyncing\} v="vio" sx=\{\{ fontSize: 11, padding: "7px 12px" \}\}>/g, '<Btn onClick={() => syncToGoogleSheets()} disabled={sheetsSyncing} v="grn" sx={{ fontSize: 11, padding: "7px 12px" }}>');
content = content.replace(/\{notionSyncing \? <><span style=\{\{ animation: "spin 0.8s linear infinite", display: "inline-block" \}\}>◌<\/span> Syncing…<\/> : "📝 Notion"\}/g, '{sheetsSyncing ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Syncing…</> : "📊 Sheets"}');

// Replace the syncToNotion function entirely
const oldSyncFuncMatch = content.match(/\/\/ ── Notion Sync[\s\S]+?setNotionSyncing\(false\);\s*\}/);
if (oldSyncFuncMatch) {
  const newSyncFunc = `// ── Google Sheets Sync (free alternative to Notion) ───────────────────────
  async function syncToGoogleSheets(jobsToSync) {
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings first", "err");
    const toSync = jobsToSync || jobs;
    if (!toSync.length) return notify("No jobs to sync", "err");
    setSheetsSyncing(true);
    notify("📊 Syncing " + toSync.length + " jobs to Google Sheets…");
    try {
      const token = await getGoogleToken(
        "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
        session, clientId
      );

      let spreadsheetId = sheetsSpreadsheetId;

      // Create new spreadsheet if none exists
      if (!spreadsheetId) {
        const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
          method: "POST",
          headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" },
          body: JSON.stringify({
            properties: { title: "JobBoard Pro — Job Tracker" },
            sheets: [{ properties: { title: "Jobs", gridProperties: { frozenRowCount: 1 } } }]
          })
        });
        if (!createRes.ok) throw new Error("Could not create spreadsheet: " + (await createRes.text()));
        const created = await createRes.json();
        spreadsheetId = created.spreadsheetId;
        setSheetsSpreadsheetId(spreadsheetId);
        localStorage.setItem("sheetsSpreadsheetId", spreadsheetId);
      }

      // Build data: headers + rows
      const headers = ["Job Title", "Company", "Status", "Priority", "Location", "Type", "Salary", "Skills", "Source", "Apply Link", "Applied Date", "Deadline", "Notes"];
      const rows = toSync.map(j => [
        j.title || "", j.company || "", j.status || "", j.priority || "",
        j.location || "", j.type || "", j.salary || "", j.skills || "",
        j.source || "", j.applylink || "", j.applieddate || "",
        j.deadline || "", (j.notes || "").slice(0, 500)
      ]);
      const values = [headers, ...rows];

      // Clear and write
      await fetch(\`https://sheets.googleapis.com/v4/spreadsheets/\${spreadsheetId}/values/Jobs!A:Z:clear\`, {
        method: "POST",
        headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" },
        body: "{}"
      });

      const updateRes = await fetch(
        \`https://sheets.googleapis.com/v4/spreadsheets/\${spreadsheetId}/values/Jobs!A1?valueInputOption=USER_ENTERED\`,
        {
          method: "PUT",
          headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" },
          body: JSON.stringify({ range: "Jobs!A1", majorDimension: "ROWS", values })
        }
      );
      if (!updateRes.ok) throw new Error("Sheets update failed: " + (await updateRes.text()));

      // Format header row (bold + color)
      await fetch(\`https://sheets.googleapis.com/v4/spreadsheets/\${spreadsheetId}:batchUpdate\`, {
        method: "POST",
        headers: { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests: [
          { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.05, green: 0.1, blue: 0.2 }, textFormat: { bold: true, foregroundColor: { red: 0.7, green: 0.8, blue: 1 }, fontSize: 11 } } }, fields: "userEnteredFormat" } },
          { updateDimensionProperties: { range: { sheetId: 0, dimension: "COLUMNS", startIndex: 0, endIndex: 13 }, properties: { pixelSize: 150 }, fields: "pixelSize" } },
          { setBasicFilter: { filter: { range: { sheetId: 0, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 13, endRowIndex: values.length } } } }
        ] })
      });

      setSheetsEnabled(true);
      localStorage.setItem("sheetsEnabled", "true");
      notify(\`✅ Synced \${toSync.length} jobs to Google Sheets! Opening…\`);
      window.open(\`https://docs.google.com/spreadsheets/d/\${spreadsheetId}\`, "_blank");
    } catch (err) {
      notify("Sheets error: " + err.message, "err");
    }
    setSheetsSyncing(false);
  }`;
  content = content.replace(oldSyncFuncMatch[0], newSyncFunc);
}

// Replace Notion UI settings
const oldSettingsMatch = content.match(/\{\/\* ── Notion Sync Settings ── \*\/\}[\s\S]+?3\. Open that DB → ··· menu → <em>Add connections<\/em> → pick your integration → copy the 32-char DB ID from the URL\s*<\/div>\s*<\/div>/);
if (oldSettingsMatch) {
  const newSettingsUI = `{/* ── Google Sheets Sync Settings ── */}
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
        </div>`;
  content = content.replace(oldSettingsMatch[0], newSettingsUI);
}

if (content !== initialContent) {
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully updated Dashboard.jsx, new size:', content.length);
} else {
  console.log('No changes needed or matching failed');
}
