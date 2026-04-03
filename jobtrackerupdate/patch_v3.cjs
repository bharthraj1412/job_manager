// patch_v3.cjs — JobBoard Pro v3.0 Fixes + Notion Sync
// Run with: node patch_v3.cjs  (from your project root)
//
// Fixes applied:
//   1. CRITICAL: `targets` variable bug in handleSendJobDigest (undefined var crash)
//   2. Multi-Gmail scan: parallel scanning (faster, better progress)
//   3. Multi-Gmail scan: initialise all accounts to "scanning" immediately in UI
//   4. Notion Sync: state variables + syncToNotion() function
//   5. Notion Sync: save/load from localStorage
//   6. Notion Sync: button in header
//   7. Notion Sync: settings section in Settings modal
//   8. Gmail scan: better error state propagation
// ─────────────────────────────────────────────────────────────────────────────

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

console.log('\n🔧  JobBoard Pro — patch_v3.cjs\n');

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 1 ─ CRITICAL: fix undefined `targets` variable in handleSendJobDigest
//   The function defines `allTargets` but one branch uses the never-declared
//   `targets`, crashing the job-digest send entirely.
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Fix `targets` variable bug in handleSendJobDigest',
  // exact indentation from the source file (8 spaces, then 8 spaces, then 6)
  '        for (const target of targets) {\n        await sendEmailViaGmail(target, subject, htmlBody, token);\n      }',
  '        for (const target of (allTargets.length > 0 ? allTargets : [reportEmail])) {\n          await sendEmailViaGmail(target, subject, htmlBody, token);\n        }'
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 2 ─ Add Notion state variables (after adzunaKey)
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Add Notion state variables',
  "  const [adzunaKey, setAdzunaKey] = useState(() => localStorage.getItem('adzunaKey') || import.meta.env.VITE_ADZUNA_KEY || '');",
  [
    "  const [adzunaKey, setAdzunaKey] = useState(() => localStorage.getItem('adzunaKey') || import.meta.env.VITE_ADZUNA_KEY || '');",
    "  // ── Notion state ─────────────────────────────────────────────────────",
    '  const [notionToken,   setNotionToken]   = useState(() => localStorage.getItem("notionToken") || "");',
    '  const [notionDbId,    setNotionDbId]    = useState(() => localStorage.getItem("notionDbId")  || "");',
    '  const [notionSyncing, setNotionSyncing] = useState(false);',
  ].join('\n')
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 3 ─ Persist Notion settings in saveSettings()
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Persist Notion settings',
  '    localStorage.setItem("reportFormat", reportFormat);\n    // Clear ALL cached Google tokens so new clientId / scopes take effect',
  [
    '    localStorage.setItem("reportFormat", reportFormat);',
    '    localStorage.setItem("notionToken",   notionToken);',
    '    localStorage.setItem("notionDbId",    notionDbId);',
    '    // Clear ALL cached Google tokens so new clientId / scopes take effect',
  ].join('\n')
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 4 ─ Add syncToNotion() function (before URL scraper section)
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Add syncToNotion() function',
  '  // ── URL Scraper ───────────────────────────────────────────────────────',
  `  // ── Notion Sync ──────────────────────────────────────────────────────────
  async function syncToNotion(jobsToSync) {
    if (!notionToken) return notify("Add your Notion Integration Token in ⚙️ Settings", "err");
    if (!notionDbId)  return notify("Add your Notion Database ID in ⚙️ Settings", "err");
    const toSync = jobsToSync || jobs;
    if (!toSync.length) return notify("No jobs to sync", "err");
    setNotionSyncing(true);
    notify("Syncing " + toSync.length + " jobs to Notion…");
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_jobs",
          token: notionToken,
          database_id: notionDbId,
          jobs: toSync.map(j => ({
            id: j.id,
            title: j.title,
            company: j.company || "",
            location: j.location || "",
            status: j.status,
            priority: j.priority,
            salary: j.salary || "",
            skills: j.skills || "",
            source: j.source || "",
            applylink: j.applylink || "",
            applieddate: j.applieddate || "",
            deadline: j.deadline || "",
            notes: (j.notes || "").slice(0, 500),
          }))
        })
      });
      if (!res.ok) { const t = await res.text(); throw new Error(t); }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      notify("Synced " + (data.synced || 0) + " / " + toSync.length + " jobs to Notion ✓");
    } catch (err) {
      notify("Notion error: " + err.message, "err");
    }
    setNotionSyncing(false);
  }

  // ── URL Scraper ───────────────────────────────────────────────────────`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 5 ─ Multi-account scan: initialise all accounts to "scanning" at start
//   Before this patch every account showed "Ready" until its turn came up.
//   Now all show the spinner the moment the user clicks "Scan".
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Init all accounts to scanning immediately',
  '    setGmailScanProgress({});\n    setGmailStatus({ msg: `Scanning ${gmailAccounts.length} account${gmailAccounts.length > 1 ? "s" : ""}…`, type: "loading" });',
  [
    '    // Show every account as "scanning" from the first frame',
    '    const _initProgress = {};',
    '    gmailAccounts.forEach(a => { _initProgress[a.email] = "scanning"; });',
    '    setGmailScanProgress(_initProgress);',
    '    setGmailStatus({ msg: "Scanning " + gmailAccounts.length + " account" + (gmailAccounts.length > 1 ? "s" : "") + " in parallel…", type: "loading" });',
  ].join('\n    ')
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 6 ─ Multi-account scan: switch from sequential to parallel
//   Sequential: 3 accounts × ~8 s each = ~24 s total
//   Parallel:   3 accounts simultaneously → ~8 s total
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Parallel Gmail multi-account scan (Promise.allSettled)',
  [
    '    // Scan accounts sequentially to avoid OAuth conflicts',
    '    for (const acc of gmailAccounts) {',
    '      try {',
    '        const result = await scanSingleAccount(acc);',
    '        if (result.emails?.length) combined.push(...result.emails);',
    '        if (result.error) errorCount++;',
    '      } catch (err) {',
    '        console.warn(`Scan failed for ${acc.email}:`, err);',
    '        errorCount++;',
    '      }',
    '    }',
  ].join('\n'),
  [
    '    // Scan all accounts simultaneously — typically 3-4× faster',
    '    const _scanResults = await Promise.allSettled(',
    '      gmailAccounts.map(acc => scanSingleAccount(acc))',
    '    );',
    '    _scanResults.forEach((r, i) => {',
    '      const acc = gmailAccounts[i];',
    '      if (r.status === "fulfilled") {',
    '        if (r.value?.emails?.length) combined.push(...r.value.emails);',
    '        if (r.value?.error) { errorCount++; }',
    '      } else {',
    '        errorCount++;',
    '        if (acc) setGmailScanProgress(p => ({ ...p, [acc.email]: "error" }));',
    '      }',
    '    });',
  ].join('\n')
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 7 ─ Notion sync button in the app header
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Notion button in app header',
  '            <Btn onClick={() => setShowSettings(true)} v="ghost">⚙️</Btn>',
  [
    '            {notionToken && notionDbId && (',
    '              <Btn onClick={() => syncToNotion()} disabled={notionSyncing} v="vio" sx={{ fontSize: 11, padding: "7px 12px" }}>',
    '                {notionSyncing ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Syncing…</> : "📝 Notion"}',
    '              </Btn>',
    '            )}',
    '            <Btn onClick={() => setShowSettings(true)} v="ghost">⚙️</Btn>',
  ].join('\n            ')
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 8 ─ Notion settings section inside the ⚙️ Settings modal
//   Inserted just before the existing Google "Unverified App" warning block.
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Notion settings section in Settings modal',
  '        <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 10, padding: "14px 16px", marginBottom: 14,',
  `        {/* ── Notion Sync Settings ── */}
        <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.22)", borderRadius: 10, padding: 16, margin: "14px 0" }}>
          <div style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            📝 Notion Sync
            <span style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", padding: "1px 8px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>Export jobs to Notion</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <F label="Integration Token" hint="notion.so/my-integrations">
              <Inp type="password" value={notionToken} onChange={e => setNotionToken(e.target.value)} placeholder="secret_…" />
            </F>
            <F label="Database ID" hint="32 chars from Notion DB URL">
              <Inp value={notionDbId} onChange={e => setNotionDbId(e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
            </F>
          </div>
          {notionToken && notionDbId && (
            <button
              onClick={() => syncToNotion()}
              disabled={notionSyncing}
              style={{ background: "linear-gradient(135deg,#4c1d95,#5b21b6)", border: "1px solid rgba(139,92,246,0.3)", color: "#c4b5fd", borderRadius: 8, padding: "9px 20px", cursor: notionSyncing ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              {notionSyncing
                ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Syncing…</>
                : "📝 Sync All " + jobs.length + " Jobs to Notion Now"}
            </button>
          )}
          <div style={{ fontSize: 10, color: "#475569", marginTop: 10, lineHeight: 1.8 }}>
            <strong style={{ color: "#6b7280" }}>Setup (3 steps):</strong><br/>
            1. notion.so/my-integrations → New integration → copy <em>Internal Integration Token</em><br/>
            2. In Notion: create a DB with columns → Name, Company, Status, Location, Salary, Priority, Skills, Apply Link, Applied Date, Deadline, Source<br/>
            3. Open that DB → ··· menu → <em>Add connections</em> → pick your integration → copy the 32-char DB ID from the URL
          </div>
        </div>

        <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 10, padding: "14px 16px", marginBottom: 14,`
);

// ══════════════════════════════════════════════════════════════════════════════
// Write the patched file
// ══════════════════════════════════════════════════════════════════════════════
fs.writeFileSync(filePath, code, 'utf-8');
const newLen = fs.statSync(filePath).size;

console.log('');
console.log('─'.repeat(50));
console.log((applied === 8 ? '✅' : '⚠ ') + '  Applied ' + applied + ' / 8 patches  (' + skipped + ' skipped)');
console.log('   File: ' + Math.round(origLen / 1024) + ' KB  →  ' + Math.round(newLen / 1024) + ' KB');
if (skipped > 0) {
  console.log('');
  console.log('   Skipped patches usually mean the string already exists or');
  console.log('   Dashboard.jsx has slightly different formatting/indentation.');
  console.log('   Those sections can be applied manually — see patch_v3.cjs for content.');
}
console.log('');
console.log('📌  Next steps:');
console.log('   1.  Copy api/notion.js → your project\'s api/ folder');
console.log('   2.  Run the calendar_events SQL in Supabase SQL editor');
console.log('   3.  npm run dev  (Notion button appears in header once token + DB ID saved)');
console.log('');
