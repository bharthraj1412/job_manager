// patch_gmail_fix.cjs — Run with: node patch_gmail_fix.cjs
// Fixes multi-Gmail account scanning:
// 1. scanSingleAccount: loads GIS before using window.google
// 2. startMultiAccountScan: scans accounts sequentially (not parallel) to avoid token conflicts
// 3. Improves UI when no accounts are connected

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'Dashboard.jsx');
if (!fs.existsSync(filePath)) {
  console.error('❌ src/Dashboard.jsx not found.');
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf-8');
let fixes = 0;

function patch(name, from, to) {
  if (code.includes(from)) {
    code = code.replace(from, to);
    console.log(`✓ ${name}`);
    fixes++;
    return true;
  }
  console.warn(`⚠ ${name} — marker not found`);
  return false;
}

// ── FIX 1: scanSingleAccount — load GIS before using window.google ──────────
patch(
  'scanSingleAccount: load GIS properly',
  `  async function scanSingleAccount(account) {
    setGmailScanProgress(p => ({ ...p, [account.email]: "scanning" }));
    try {
      const token = await new Promise((resolve, reject) => {
        const gis = window.google.accounts.oauth2;
        const tc = gis.initTokenClient({`,
  `  async function scanSingleAccount(account) {
    setGmailScanProgress(p => ({ ...p, [account.email]: "scanning" }));
    try {
      // Load GIS first (may already be loaded, loadGis() caches it)
      const gis = await loadGis();
      const token = await new Promise((resolve, reject) => {
        const tc = gis.initTokenClient({`
);

// ── FIX 2: startMultiAccountScan — scan sequentially, not in parallel ────────
patch(
  'startMultiAccountScan: sequential scanning',
  `    const allResults = await Promise.allSettled(accountsToScan.map(acc => scanSingleAccount(acc)));
    const combined = [];
    for (const r of allResults) {
      if (r.status === "fulfilled" && r.value.emails) combined.push(...r.value.emails);
    }`,
  `    // Scan accounts SEQUENTIALLY to avoid Google OAuth token conflicts
    const combined = [];
    for (const acc of accountsToScan) {
      try {
        const result = await scanSingleAccount(acc);
        if (result.emails?.length) combined.push(...result.emails);
      } catch (err) {
        console.warn(\`Scan failed for \${acc.email}:\`, err);
      }
    }`
);

// ── FIX 3: Improve scan controls UI — better message when no accounts ────────
patch(
  'Scan controls: better no-accounts message',
  `            <div style={{ color: "#06b6d4", fontWeight: 700, fontSize: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              🔍 Scan Gmail for Job Emails
              <span style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", padding: "2px 8px", borderRadius: 999, fontSize: 10 }}>Gmail API + AI</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>`,
  `            <div style={{ color: "#06b6d4", fontWeight: 700, fontSize: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              🔍 Scan Gmail for Job Emails
              <span style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", padding: "2px 8px", borderRadius: 999, fontSize: 10 }}>Gmail API + AI</span>
            </div>
            {gmailAccounts.length === 0 && clientId && (
              <div style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.18)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#67e8f9", display: "flex", gap: 8 }}>
                💡 <span>Add Gmail accounts above for multi-account scanning. Or use single-scan below to scan your current Google session.</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>`
);

// ── FIX 4: Add loadGis() call inside addGmailAccount to ensure it's ready ────
patch(
  'addGmailAccount: ensure GIS loaded before token request',
  `  async function addGmailAccount() {
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings first", "err");
    setAddingAccount(true);
    try {
      const token = await getGoogleToken("https://www.googleapis.com/auth/gmail.readonly", session, clientId);`,
  `  async function addGmailAccount() {
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings first", "err");
    setAddingAccount(true);
    try {
      // Pre-load GIS so the consent popup appears quickly
      await loadGis();
      const token = await getGoogleToken("https://www.googleapis.com/auth/gmail.readonly", session, clientId);`
);

// ── FIX 5: handleGmailMultiScan — use clientId variable (not googleClientId) ──
// The variable in state is 'clientId', not 'googleClientId'
patch(
  'handleGmailMultiScan: fix variable name clientId vs googleClientId',
  `  async function handleGmailMultiScan(silent = false) {
    if (!googleClientId) {
      if (!silent) notify("Add Google Client ID in ⚙️ Settings to use Gmail scan.", "err");
      return;
    }
    if (!silent) notify("📧 Scanning Gmail for job emails...");
    try {
      const token = await getGoogleToken(
        "https://www.googleapis.com/auth/gmail.readonly",
        session,
        googleClientId
      );`,
  `  async function handleGmailMultiScan(silent = false) {
    if (!clientId) {
      if (!silent) notify("Add Google Client ID in ⚙️ Settings to use Gmail scan.", "err");
      return;
    }
    if (!silent) notify("📧 Scanning Gmail for job emails...");
    try {
      const token = await getGoogleToken(
        "https://www.googleapis.com/auth/gmail.readonly",
        session,
        clientId
      );`
);

// ── FIX 6: AUTO GMAIL MULTI-SCAN useEffect — same variable fix ───────────────
patch(
  'Auto Gmail scan useEffect: fix variable name',
  `    if (!clientId || jobs.length === 0) return;
    if (localStorage.getItem("lastGmailScan") === todayStr()) return;
    // Silently scan all email categories in the background
    handleGmailMultiScan(true);`,
  `    if (!clientId || jobs.length === 0) return;
    if (localStorage.getItem("lastGmailScan") === todayStr()) return;
    // Only auto-scan if we have accounts set up
    if (gmailAccounts.length > 0) handleGmailMultiScan(true);`
);

// ── FIX 7: scanSingleAccount — better error message ───────────────────────────
patch(
  'scanSingleAccount: better error handling for popup_closed',
  `      setGmailScanProgress(p => ({ ...p, [account.email]: "error" }));
      return { account: account.email, found: 0, emails: [], error: err.message };`,
  `      const isUserCancel = err.message?.includes("popup_closed") || err.message?.includes("access_denied");
      setGmailScanProgress(p => ({ ...p, [account.email]: isUserCancel ? "skipped" : "error" }));
      if (!isUserCancel) console.warn(\`Gmail scan error for \${account.email}:\`, err.message);
      return { account: account.email, found: 0, emails: [], error: err.message };`
);

// ── FIX 8: Show "skipped" status in per-account progress badges ───────────────
patch(
  'Per-account progress: show skipped state',
  `                  const progColor = progress === "done" ? "#22c55e" : progress === "error" ? "#ef4444" : progress === "scanning" ? "#f59e0b" : progress === "done_empty" ? "#475569" : "#334155";
                  const progLabel = progress === "done" ? "✓ Scanned" : progress === "error" ? "✗ Error" : progress === "scanning" ? "Scanning…" : progress === "done_empty" ? "No matches" : "Ready";`,
  `                  const progColor = progress === "done" ? "#22c55e" : progress === "error" ? "#ef4444" : progress === "scanning" ? "#f59e0b" : progress === "done_empty" ? "#475569" : progress === "skipped" ? "#f59e0b" : "#334155";
                  const progLabel = progress === "done" ? "✓ Scanned" : progress === "error" ? "✗ Error" : progress === "scanning" ? "Scanning…" : progress === "done_empty" ? "No matches" : progress === "skipped" ? "⚠ Skipped" : "Ready";`
);

// ── FIX 9: Same fix in the loading progress display ───────────────────────────
patch(
  'Loading progress display: show skipped',
  `                      {p === "done" ? "✓" : p === "error" ? "✗" : "○"} {acc.email.split("@")[0]}`,
  `                      {p === "done" ? "✓" : p === "error" ? "✗" : p === "skipped" ? "⚠" : "○"} {acc.email.split("@")[0]}`
);

fs.writeFileSync(filePath, code, 'utf-8');
console.log(`\n✅ Applied ${fixes} fixes to src/Dashboard.jsx`);
console.log(`\nFixes applied:`);
console.log(`  🔧 scanSingleAccount: now loads GIS before using window.google`);
console.log(`  🔧 startMultiAccountScan: scans accounts sequentially (not parallel)`);
console.log(`  🔧 addGmailAccount: pre-loads GIS for faster popup`);
console.log(`  🔧 handleGmailMultiScan: fixed variable name (clientId, not googleClientId)`);
console.log(`  🔧 Auto-scan: only runs when accounts are configured`);
console.log(`  🔧 UI: better message when no accounts connected`);
console.log(`  🔧 Error handling: shows "skipped" when user cancels popup`);
console.log(`\nHow to use multi-Gmail:`);
console.log(`  1. Go to Gmail tab`);
console.log(`  2. Click "＋ Add Gmail Account" → Google popup → sign in`);
console.log(`  3. Repeat for each Gmail account you want to scan`);
console.log(`  4. Click "⚡ Scan All N Accounts" → approve each account's popup`);
console.log(`\nRun: npm run dev`);
