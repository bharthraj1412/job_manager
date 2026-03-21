// patch_multi_gmail.cjs — Run with: node patch_multi_gmail.cjs
// Adds multiple Gmail account support to the Gmail Scanner tab

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
  console.warn(`⚠ ${name} — not found`);
  return false;
}

// ══════════════════════════════════════════════════════════════════
// FIX 1: Add gmailAccounts state after gmailLoading state
// ══════════════════════════════════════════════════════════════════
patch(
  'Add gmailAccounts state',
  `  const [gmailRows, setGmailRows] = useState([{ id: 1, date: "", company: "", jobTitle: "", status: "Applied", interviewDate: "", interviewTime: "", interviewType: "", notes: "" }]);
  const [gmailStats, setGmailStats] = useState(null);`,
  `  const [gmailRows, setGmailRows] = useState([{ id: 1, date: "", company: "", jobTitle: "", status: "Applied", interviewDate: "", interviewTime: "", interviewType: "", notes: "" }]);
  const [gmailStats, setGmailStats] = useState(null);
  // Multi-account Gmail
  const [gmailAccounts, setGmailAccounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gmailAccounts") || "[]"); } catch { return []; }
  });
  const [addingAccount, setAddingAccount] = useState(false);
  const [gmailScanProgress, setGmailScanProgress] = useState({}); // { accountEmail: "scanning"|"done"|"error" }`
);

// ══════════════════════════════════════════════════════════════════
// FIX 2: Add multi-account Gmail functions before startGmailScan
// ══════════════════════════════════════════════════════════════════
patch(
  'Add multi-account Gmail functions',
  `  // ── Gmail Scanner ─────────────────────────────────────────────────────────
  async function startGmailScan() {`,
  `  // ── Multi-Account Gmail Management ────────────────────────────────────────
  async function addGmailAccount() {
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings first", "err");
    setAddingAccount(true);
    try {
      // Request token — this triggers Google account picker
      const token = await getGoogleToken(
        "https://www.googleapis.com/auth/gmail.readonly",
        session,
        clientId
      );
      // Get the email of this account
      const profileRes = await fetch(
        "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
        { headers: { Authorization: \`Bearer \${token}\` } }
      );
      const profileData = await profileRes.json();
      const email = profileData.email;
      if (!email) throw new Error("Could not get account email");

      // Check for duplicates
      if (gmailAccounts.some(a => a.email === email)) {
        notify(\`\${email} is already added\`, "err");
        setAddingAccount(false);
        return;
      }

      const newAccount = { id: Date.now(), email, name: profileData.name || email, picture: profileData.picture || null, addedAt: new Date().toISOString() };
      const updated = [...gmailAccounts, newAccount];
      setGmailAccounts(updated);
      localStorage.setItem("gmailAccounts", JSON.stringify(updated));
      notify(\`✅ \${email} added!\`);
    } catch (err) {
      if (!err.message.includes("popup_closed")) notify("Could not add account: " + err.message, "err");
    }
    setAddingAccount(false);
  }

  function removeGmailAccount(id) {
    const updated = gmailAccounts.filter(a => a.id !== id);
    setGmailAccounts(updated);
    localStorage.setItem("gmailAccounts", JSON.stringify(updated));
    notify("Account removed");
  }

  async function scanSingleAccount(account) {
    setGmailScanProgress(p => ({ ...p, [account.email]: "scanning" }));
    try {
      // Force a fresh token for this specific account by clearing cache for the scope
      const scopeKey = "gtoken_" + (() => {
        const scope = "https://www.googleapis.com/auth/gmail.readonly";
        const words = scope.trim().split(/\s+/).sort().join("|");
        let h = 5381;
        for (let i = 0; i < words.length; i++) h = ((h << 5) + h) ^ words.charCodeAt(i);
        return (h >>> 0).toString(16);
      })();
      // We can't force a specific account via GIS without prompt:"select_account"
      // so we use the cached token which should correspond to the last authed account
      const token = await (async () => {
        const gis = await loadGis();
        return new Promise((resolve, reject) => {
          const tc = gis.initTokenClient({
            client_id: clientId,
            scope: "https://www.googleapis.com/auth/gmail.readonly",
            hint: account.email,
            callback: (r) => {
              if (r.error) return reject(new Error(r.error_description || r.error));
              resolve(r.access_token);
            },
          });
          tc.requestAccessToken({ prompt: "", login_hint: account.email });
        });
      })();

      const QUERIES = [
        { label: "Interview Scheduled", q: "subject:(interview scheduled OR interview invitation OR interview confirmed) from:(careers OR jobs OR hiring OR hr OR noreply OR talent) newer_than:30d" },
        { label: "Offer Received",      q: "subject:(offer letter OR job offer OR we would like to offer OR pleased to offer) from:(careers OR jobs OR hiring OR hr) newer_than:30d" },
        { label: "Rejected",            q: "subject:(regret OR unfortunately OR not moving forward OR not selected OR other candidates) from:(careers OR jobs OR hiring OR hr OR noreply) newer_than:30d" },
        { label: "Applied",             q: "subject:(application received OR thank you for applying OR we received your application OR application submitted) from:(careers OR jobs OR noreply) newer_than:30d" },
        { label: "Screening",           q: "subject:(screening call OR phone screen OR initial interview OR recruiter would like) from:(careers OR jobs OR hiring OR recruiter OR talent) newer_than:30d" },
      ];

      const results = await Promise.allSettled(
        QUERIES.map(({ label, q }) =>
          fetch(
            \`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=\${encodeURIComponent(q)}\`,
            { headers: { Authorization: \`Bearer \${token}\` } }
          ).then(r => r.json()).then(d => ({ label, messages: d.messages || [] })).catch(() => ({ label, messages: [] }))
        )
      );

      const allMessages = [];
      for (const r of results) {
        if (r.status === "fulfilled") {
          allMessages.push(...r.value.messages.map(m => ({ ...m, category: r.value.label, fromAccount: account.email })));
        }
      }

      if (!allMessages.length) {
        setGmailScanProgress(p => ({ ...p, [account.email]: "done_empty" }));
        return { account: account.email, found: 0, emails: [] };
      }

      const details = await Promise.allSettled(
        allMessages.slice(0, 20).map(msg =>
          fetch(
            \`https://gmail.googleapis.com/gmail/v1/users/me/messages/\${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date\`,
            { headers: { Authorization: \`Bearer \${token}\` } }
          ).then(r => r.json()).then(data => {
            const headers = data.payload?.headers || [];
            const get = n => headers.find(h => h.name === n)?.value || "";
            return { id: msg.id, subject: get("Subject"), from: get("From"), date: get("Date"), snippet: data.snippet || "", category: msg.category, fromAccount: msg.fromAccount };
          }).catch(() => null)
        )
      );

      const emails = details.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
      setGmailScanProgress(p => ({ ...p, [account.email]: "done" }));
      return { account: account.email, found: emails.length, emails };
    } catch (err) {
      setGmailScanProgress(p => ({ ...p, [account.email]: "error" }));
      console.error(\`Gmail scan error for \${account.email}:\`, err);
      return { account: account.email, found: 0, emails: [], error: err.message };
    }
  }

  async function startMultiAccountScan() {
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings", "err");
    const accountsToScan = gmailAccounts.length > 0 ? gmailAccounts : null;
    if (!accountsToScan) {
      // Fall back to single account scan
      return startGmailScan();
    }
    setGmailLoading(true);
    setGmailEmails([]);
    setGmailStats(null);
    setGmailScanProgress({});
    setGmailStatus({ msg: \`Scanning \${accountsToScan.length} account\${accountsToScan.length > 1 ? "s" : ""}…\`, type: "loading" });

    const allResults = await Promise.allSettled(accountsToScan.map(acc => scanSingleAccount(acc)));
    const combined = [];
    let totalFound = 0;

    for (const r of allResults) {
      if (r.status === "fulfilled" && r.value.emails) {
        combined.push(...r.value.emails);
        totalFound += r.value.found;
      }
    }

    if (!combined.length) {
      setGmailStatus({ msg: "No job-related emails found across all accounts.", type: "success" });
      setGmailLoading(false);
      return;
    }

    // Deduplicate by subject+from
    const seen = new Set();
    const deduped = combined.filter(e => {
      const key = \`\${e.subject}|\${e.from}\`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    // Convert to gmailEmails format via AI
    setGmailStatus({ msg: \`Analyzing \${deduped.length} emails with AI…\`, type: "loading" });
    try {
      const payload = deduped.map(d => ({
        subject: d.subject, sender: d.from, date: d.date,
        snippet: d.snippet, fromAccount: d.fromAccount, category: d.category
      }));
      const text = await AI(
        \`Analyze these job emails from multiple Gmail accounts. Return ONLY a JSON array. Each object must have: {company, jobTitle, status(Applied|Screening|Interview Scheduled|Interview Done|Offer Received|Rejected|Pending), interviewDate, interviewTime, interviewType, sender, date, snippet, subject, fromAccount}.\n\${JSON.stringify(payload)}\`,
        "Return only a valid JSON array, no markdown."
      );
      const match = text.replace(/\`\`\`json|\`\`\`/g, "").trim().match(/\[[\s\S]*\]/);
      const emails = match ? JSON.parse(match[0]) : [];

      if (emails.length) {
        setGmailEmails(emails);
        const stats = {
          total: emails.length,
          applied: emails.filter(e => e.status === "Applied").length,
          interview: emails.filter(e => e.status?.includes("Interview")).length,
          offer: emails.filter(e => e.status?.includes("Offer")).length,
          rejected: emails.filter(e => e.status === "Rejected").length,
          pending: emails.filter(e => e.status === "Pending").length,
        };
        setGmailStats(stats);
        setGmailRows(emails.map((e, i) => ({
          id: i + 1, date: e.date ? e.date.split("T")[0] : "", company: e.company || "",
          jobTitle: e.jobTitle || "", status: e.status || "Applied",
          interviewDate: e.interviewDate || "", interviewTime: e.interviewTime || "",
          interviewType: e.interviewType || "", notes: e.snippet || "",
          fromAccount: e.fromAccount || "",
        })));
        setGmailStatus({ msg: \`✓ Found \${emails.length} job emails across \${accountsToScan.length} account\${accountsToScan.length > 1 ? "s" : ""}\`, type: "success" });
      } else {
        setGmailStatus({ msg: "✓ Scan complete. No structured matches found.", type: "success" });
      }
    } catch (err) {
      setGmailStatus({ msg: "AI analysis error: " + err.message, type: "error" });
    }
    setGmailLoading(false);
  }

  // ── Gmail Scanner ─────────────────────────────────────────────────────────
  async function startGmailScan() {`
);

// ══════════════════════════════════════════════════════════════════
// FIX 3: Replace the Gmail tab UI scan button + add accounts panel
// ══════════════════════════════════════════════════════════════════
patch(
  'Replace Gmail tab UI with multi-account version',
  `        {tab === "gmail" && <div>
          <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22, marginBottom: 20 }}>
            <div style={{ color: "#06b6d4", fontWeight: 700, fontSize: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>🔍 Scan Gmail for Job Emails
              <span style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", padding: "2px 8px", borderRadius: 999, fontSize: 10 }}>Gmail API + AI</span>
            </div>
            {!clientId && <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#fbbf24" }}>⚠️ Add your Google Client ID in ⚙️ Settings to use Gmail scanning.</div>}
            {clientId && <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#a5b4fc", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0 }}>🔐</span>
              <span>Clicking <strong>Scan Gmail</strong> will open a Google permission popup asking for <strong>Gmail read access</strong> for this app. You only see this once per session — subsequent scans reuse the cached token automatically.</span>
            </div>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <input type="number" value={gmailDays} onChange={e => setGmailDays(e.target.value)} min="1" max="365" placeholder="Days" style={{ width: 90, background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              <input value={gmailExtra} onChange={e => setGmailExtra(e.target.value)} placeholder="Extra keywords (optional)…" style={{ flex: 1, minWidth: 200, background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              <Btn v="cyn" onClick={startGmailScan} disabled={gmailLoading}>{gmailLoading ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Scanning…</> : "⚡ Scan Gmail"}</Btn>
              <Btn v="ghost" onClick={() => { setGmailEmails([]); setGmailStats(null); setGmailStatus({ msg: "Cleared.", type: "" }); setGmailRows([{ id: 1, date: "", company: "", jobTitle: "", status: "Applied", interviewDate: "", interviewTime: "", interviewType: "", notes: "" }]); }}>✕ Clear</Btn>
            </div>
            <div style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: "12px 16px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, minHeight: 44, display: "flex", alignItems: "center", gap: 10, color: gmailStatus.type === "error" ? "#ef4444" : gmailStatus.type === "success" ? "#10b981" : gmailStatus.type === "loading" ? "#f59e0b" : "#06b6d4" }}>
              {gmailStatus.type === "loading" && <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block", flexShrink: 0 }}>◌</span>}
              {gmailStatus.msg}
            </div>
          </div>`,
  `        {tab === "gmail" && <div>
          {/* ── Connected Gmail Accounts Panel ── */}
          <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ color: "#06b6d4", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 10 }}>
                📧 Connected Gmail Accounts
                <span style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", padding: "2px 8px", borderRadius: 999, fontSize: 10 }}>{gmailAccounts.length} account{gmailAccounts.length !== 1 ? "s" : ""}</span>
              </div>
              <Btn v="cyn" onClick={addGmailAccount} disabled={addingAccount || !clientId} sx={{ gap: 6, padding: "8px 16px" }}>
                {addingAccount ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Connecting…</> : "＋ Add Gmail Account"}
              </Btn>
            </div>

            {!clientId && (
              <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#fbbf24", marginBottom: 12 }}>
                ⚠️ Add your Google Client ID in ⚙️ Settings to connect Gmail accounts.
              </div>
            )}

            {gmailAccounts.length === 0 && clientId && (
              <div style={{ background: "#070f1c", border: "1px dashed #1e2d45", borderRadius: 12, padding: "28px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
                <div style={{ color: "#475569", fontSize: 13, marginBottom: 6 }}>No Gmail accounts connected yet</div>
                <div style={{ color: "#334155", fontSize: 11, marginBottom: 16 }}>Add one or more Gmail accounts to scan for job emails</div>
                <Btn v="cyn" onClick={addGmailAccount} disabled={addingAccount} sx={{ margin: "0 auto" }}>
                  {addingAccount ? "Connecting…" : "＋ Connect Your First Gmail"}
                </Btn>
              </div>
            )}

            {gmailAccounts.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {gmailAccounts.map(acc => {
                  const progress = gmailScanProgress[acc.email];
                  const progColor = progress === "done" ? "#22c55e" : progress === "error" ? "#ef4444" : progress === "scanning" ? "#f59e0b" : progress === "done_empty" ? "#475569" : "#334155";
                  const progLabel = progress === "done" ? "✓ Scanned" : progress === "error" ? "✗ Error" : progress === "scanning" ? "Scanning…" : progress === "done_empty" ? "No matches" : "Ready";
                  return (
                    <div key={acc.id} style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, transition: "border-color .2s", borderColor: progress === "scanning" ? "#f59e0b" : progress === "done" ? "rgba(34,197,94,0.3)" : "#1e2d45" }}>
                      {/* Avatar */}
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#1d4ed8,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0, overflow: "hidden" }}>
                        {acc.picture
                          ? <img src={acc.picture} alt={acc.email} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
                          : acc.email.charAt(0).toUpperCase()}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.name || acc.email}</div>
                        <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>{acc.email}</div>
                      </div>
                      {/* Status badge */}
                      <span style={{ background: \`\${progColor}18\`, border: \`1px solid \${progColor}40\`, color: progColor, padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}>
                        {progress === "scanning" && <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span>}
                        {progLabel}
                      </span>
                      {/* Remove */}
                      <button onClick={() => removeGmailAccount(acc.id)} title="Remove account" style={{ background: "rgba(220,38,38,0.07)", border: "1px solid #450a0a", color: "#f87171", borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✕</button>
                    </div>
                  );
                })}

                {/* Info note */}
                <div style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#a5b4fc", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ flexShrink: 0 }}>🔐</span>
                  <span>Each account requires a separate Google permission. When you click "Scan All", a popup will appear for each account to grant Gmail read access.</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Scan Controls ── */}
          <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22, marginBottom: 20 }}>
            <div style={{ color: "#06b6d4", fontWeight: 700, fontSize: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              🔍 Scan Gmail for Job Emails
              <span style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", padding: "2px 8px", borderRadius: 999, fontSize: 10 }}>Gmail API + AI</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <input type="number" value={gmailDays} onChange={e => setGmailDays(e.target.value)} min="1" max="365" placeholder="Days" style={{ width: 90, background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              <input value={gmailExtra} onChange={e => setGmailExtra(e.target.value)} placeholder="Extra keywords (optional)…" style={{ flex: 1, minWidth: 200, background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              {gmailAccounts.length > 0 ? (
                <Btn v="cyn" onClick={startMultiAccountScan} disabled={gmailLoading} sx={{ fontWeight: 700 }}>
                  {gmailLoading
                    ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Scanning…</>
                    : \`⚡ Scan All \${gmailAccounts.length} Account\${gmailAccounts.length > 1 ? "s" : ""}\`}
                </Btn>
              ) : (
                <Btn v="cyn" onClick={startGmailScan} disabled={gmailLoading}>
                  {gmailLoading ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Scanning…</> : "⚡ Scan Gmail"}
                </Btn>
              )}
              <Btn v="ghost" onClick={() => {
                setGmailEmails([]); setGmailStats(null);
                setGmailStatus({ msg: "Cleared.", type: "" });
                setGmailScanProgress({});
                setGmailRows([{ id: 1, date: "", company: "", jobTitle: "", status: "Applied", interviewDate: "", interviewTime: "", interviewType: "", notes: "" }]);
              }}>✕ Clear</Btn>
            </div>

            {/* Per-account progress */}
            {gmailLoading && gmailAccounts.length > 1 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {gmailAccounts.map(acc => {
                  const p = gmailScanProgress[acc.email];
                  const col = p === "done" ? "#22c55e" : p === "error" ? "#ef4444" : p === "scanning" ? "#f59e0b" : "#334155";
                  return (
                    <div key={acc.id} style={{ background: \`\${col}12\`, border: \`1px solid \${col}30\`, borderRadius: 8, padding: "4px 12px", fontSize: 11, color: col, display: "flex", alignItems: "center", gap: 6 }}>
                      {p === "scanning" && <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block", fontSize: 10 }}>◌</span>}
                      {p === "done" ? "✓" : p === "error" ? "✗" : "○"} {acc.email.split("@")[0]}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: "12px 16px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, minHeight: 44, display: "flex", alignItems: "center", gap: 10, color: gmailStatus.type === "error" ? "#ef4444" : gmailStatus.type === "success" ? "#10b981" : gmailStatus.type === "loading" ? "#f59e0b" : "#06b6d4" }}>
              {gmailStatus.type === "loading" && <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block", flexShrink: 0 }}>◌</span>}
              {gmailStatus.msg}
            </div>
          </div>`
);

// ══════════════════════════════════════════════════════════════════
// FIX 4: Show fromAccount badge on email cards
// ══════════════════════════════════════════════════════════════════
patch(
  'Show fromAccount on email cards',
  `              {email.date && <span style={{ fontSize: 11, color: "#475569" }}>🗓 {email.date}</span>}</div>
            </div>;
          })}`,
  `              {email.date && <span style={{ fontSize: 11, color: "#475569" }}>🗓 {email.date}</span>}
                {email.fromAccount && <span style={{ fontSize: 10, color: "#334155", background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", padding: "1px 8px", borderRadius: 999 }}>📧 {email.fromAccount}</span>}
              </div>
            </div>;
          })}`)

// ══════════════════════════════════════════════════════════════════
// FIX 5: Show fromAccount in tracker table
// ══════════════════════════════════════════════════════════════════
patch(
  'Show fromAccount in tracker table headers',
  `              {["#", "Date", "Company", "Job Title", "Status", "Interview Date", "Time", "Type", "Notes"].map(h => <th key={h} style={{ padding: "9px 12px", color: "#334155", fontWeight: 700, fontSize: 10, letterSpacing: "0.07em", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>`,
  `              {["#", "Account", "Date", "Company", "Job Title", "Status", "Interview Date", "Time", "Type", "Notes"].map(h => <th key={h} style={{ padding: "9px 12px", color: "#334155", fontWeight: 700, fontSize: 10, letterSpacing: "0.07em", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>`
);

patch(
  'Show fromAccount in tracker table rows',
  `                      <td style={{ padding: "8px 12px", color: "#334155", fontSize: 11 }}>{row.id}</td>
                      {["date", "company", "jobTitle"].map(k => <td key={k} style={{ padding: "4px 8px" }}><input value={row[k]}`,
  `                      <td style={{ padding: "8px 12px", color: "#334155", fontSize: 11 }}>{row.id}</td>
                      <td style={{ padding: "4px 10px" }}>
                        {row.fromAccount ? (
                          <span style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", color: "#06b6d4", padding: "2px 8px", borderRadius: 999, fontSize: 10, whiteSpace: "nowrap" }}>
                            {row.fromAccount.split("@")[0]}
                          </span>
                        ) : <span style={{ color: "#334155", fontSize: 10 }}>—</span>}
                      </td>
                      {["date", "company", "jobTitle"].map(k => <td key={k} style={{ padding: "4px 8px" }}><input value={row[k]}`
);

// ══════════════════════════════════════════════════════════════════
fs.writeFileSync(filePath, code, 'utf-8');
console.log(`\n✅ Applied ${fixes} patches`);
console.log(`\nNew features:`);
console.log(`  📧 Connect multiple Gmail accounts with Google OAuth`);
console.log(`  ⚡ "Scan All N Accounts" button scans all at once`);
console.log(`  📊 Per-account progress indicators during scan`);
console.log(`  🏷  Each email card shows which account it came from`);
console.log(`  🗂  Tracker table shows account column`);
console.log(`  💾 Accounts persist in localStorage`);
console.log(`\nRun: npm run dev`);
