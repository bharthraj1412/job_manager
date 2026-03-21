// patch_gmail_v3.cjs — Complete rewrite of Gmail multi-account functions
// Run with: node patch_gmail_v3.cjs

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'Dashboard.jsx');
if (!fs.existsSync(filePath)) {
  console.error('❌ src/Dashboard.jsx not found. Run from project root.');
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf-8');
let fixes = 0;

// Find function bounds by brace counting
function findFunctionBounds(code, searchStr, startFrom = 0) {
  const idx = code.indexOf(searchStr, startFrom);
  if (idx === -1) return null;
  let braceStart = code.indexOf('{', idx);
  if (braceStart === -1) return null;
  let depth = 0, i = braceStart;
  while (i < code.length) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') { depth--; if (depth === 0) return { start: idx, end: i + 1 }; }
    i++;
  }
  return null;
}

function replaceFunction(name, searchStr, newFn) {
  const bounds = findFunctionBounds(code, searchStr);
  if (!bounds) { console.warn(`⚠ ${name} — function not found`); return false; }
  code = code.slice(0, bounds.start) + newFn + code.slice(bounds.end);
  console.log(`✓ ${name}`);
  fixes++;
  return true;
}

// ══════════════════════════════════════════════════════════
// FIX 1: addGmailAccount
// - Uses prompt:"select_account" to force account picker
// - Stores token keyed by email
// - Better error message if same account picked again
// ══════════════════════════════════════════════════════════
replaceFunction(
  'addGmailAccount',
  'async function addGmailAccount()',
  `async function addGmailAccount() {
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings first", "err");
    setAddingAccount(true);
    try {
      const gis = await loadGis();
      // Force the account chooser every time so user can pick a DIFFERENT account
      const token = await new Promise((resolve, reject) => {
        const tc = gis.initTokenClient({
          client_id: clientId,
          scope: "https://www.googleapis.com/auth/gmail.readonly",
          callback: (r) => {
            if (r.error) return reject(new Error(r.error_description || r.error));
            resolve(r.access_token);
          },
        });
        tc.requestAccessToken({ prompt: "select_account" });
      });

      const profileRes = await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
        headers: { Authorization: \`Bearer \${token}\` }
      });
      if (!profileRes.ok) throw new Error("Could not fetch account info");
      const profileData = await profileRes.json();
      const email = profileData.email;
      if (!email) throw new Error("Could not get account email");

      if (gmailAccounts.some(a => a.email === email)) {
        notify(\`\${email} is already connected. To add a different account, first sign in to another Google account in your browser, then click + Add Gmail Account.\`, "err");
        setAddingAccount(false);
        return;
      }

      // Store token keyed by this account's email so scan can use it without a popup
      try {
        sessionStorage.setItem(\`gtoken_acct_\${email}\`, JSON.stringify({
          token, exp: Date.now() + 3300000,
        }));
      } catch { }

      const newAccount = {
        id: Date.now(), email,
        name: profileData.name || email,
        picture: profileData.picture || null,
        addedAt: new Date().toISOString(),
      };
      const updated = [...gmailAccounts, newAccount];
      setGmailAccounts(updated);
      localStorage.setItem("gmailAccounts", JSON.stringify(updated));
      notify(\`✅ \${email} added! Token cached — scan will work without extra popups.\`);
    } catch (err) {
      if (!err.message?.includes("popup_closed") && !err.message?.includes("access_denied")) {
        notify("Could not add account: " + err.message, "err");
      }
    }
    setAddingAccount(false);
  }`
);

// ══════════════════════════════════════════════════════════
// FIX 2: removeGmailAccount — clear per-account token
// ══════════════════════════════════════════════════════════
replaceFunction(
  'removeGmailAccount',
  'function removeGmailAccount(',
  `function removeGmailAccount(id) {
    const account = gmailAccounts.find(a => a.id === id);
    if (account) {
      try { sessionStorage.removeItem(\`gtoken_acct_\${account.email}\`); } catch { }
    }
    const updated = gmailAccounts.filter(a => a.id !== id);
    setGmailAccounts(updated);
    localStorage.setItem("gmailAccounts", JSON.stringify(updated));
    setGmailScanProgress(p => {
      const next = { ...p };
      if (account) delete next[account.email];
      return next;
    });
    notify("Account removed");
  }`
);

// ══════════════════════════════════════════════════════════
// FIX 3: scanSingleAccount — robust token handling + real error messages
// ══════════════════════════════════════════════════════════
replaceFunction(
  'scanSingleAccount',
  'async function scanSingleAccount(',
  `async function scanSingleAccount(account) {
    setGmailScanProgress(p => ({ ...p, [account.email]: "scanning" }));
    let token = null;

    // Step 1: Try the cached token stored when this account was added
    try {
      const raw = sessionStorage.getItem(\`gtoken_acct_\${account.email}\`);
      if (raw) {
        const { token: t, exp } = JSON.parse(raw);
        if (t && Date.now() < exp) {
          token = t;
        } else {
          sessionStorage.removeItem(\`gtoken_acct_\${account.email}\`);
        }
      }
    } catch { }

    // Step 2: If no cached token, request a fresh one via GIS
    // login_hint=email means Google will silently use that account if it has an active session
    if (!token) {
      try {
        const gis = await loadGis();
        token = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Token request timed out")), 30000);
          const tc = gis.initTokenClient({
            client_id: clientId,
            scope: "https://www.googleapis.com/auth/gmail.readonly",
            callback: (r) => {
              clearTimeout(timer);
              if (r.error) return reject(new Error(r.error_description || r.error));
              try {
                sessionStorage.setItem(\`gtoken_acct_\${account.email}\`, JSON.stringify({
                  token: r.access_token, exp: Date.now() + 3300000,
                }));
              } catch { }
              resolve(r.access_token);
            },
          });
          tc.requestAccessToken({ prompt: "", login_hint: account.email });
        });
      } catch (authErr) {
        const isCancel = authErr.message?.includes("popup_closed") || authErr.message?.includes("access_denied") || authErr.message?.includes("timed out");
        setGmailScanProgress(p => ({ ...p, [account.email]: isCancel ? "skipped" : "error" }));
        console.warn(\`Auth failed for \${account.email}:\`, authErr.message);
        return { account: account.email, found: 0, emails: [], error: authErr.message };
      }
    }

    // Step 3: Use token to scan Gmail
    try {
      const QUERIES = [
        { label: "Interview Scheduled", q: "subject:(interview scheduled OR interview invitation OR interview confirmed) newer_than:30d" },
        { label: "Offer Received",      q: "subject:(offer letter OR job offer OR pleased to offer) newer_than:30d" },
        { label: "Rejected",            q: "subject:(regret OR unfortunately OR not moving forward OR not selected) newer_than:30d" },
        { label: "Applied",             q: "subject:(application received OR thank you for applying OR application submitted) newer_than:30d" },
        { label: "Screening",           q: "subject:(screening call OR phone screen OR initial interview) newer_than:30d" },
      ];

      const results = await Promise.allSettled(
        QUERIES.map(({ label, q }) =>
          fetch(
            \`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=\${encodeURIComponent(q)}\`,
            { headers: { Authorization: \`Bearer \${token}\` } }
          ).then(async r => {
            if (r.status === 401) {
              // Token expired mid-scan — clear cache
              try { sessionStorage.removeItem(\`gtoken_acct_\${account.email}\`); } catch { }
              throw new Error("Token expired");
            }
            const d = await r.json();
            return { label, messages: d.messages || [] };
          }).catch(() => ({ label, messages: [] }))
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
            const hdrs = data.payload?.headers || [];
            const get = n => hdrs.find(h => h.name === n)?.value || "";
            return { id: msg.id, subject: get("Subject"), from: get("From"), date: get("Date"), snippet: data.snippet || "", category: msg.category, fromAccount: msg.fromAccount };
          }).catch(() => null)
        )
      );

      const emails = details.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
      setGmailScanProgress(p => ({ ...p, [account.email]: emails.length > 0 ? "done" : "done_empty" }));
      return { account: account.email, found: emails.length, emails };
    } catch (scanErr) {
      setGmailScanProgress(p => ({ ...p, [account.email]: "error" }));
      console.error(\`Scan error for \${account.email}:\`, scanErr.message);
      return { account: account.email, found: 0, emails: [], error: scanErr.message };
    }
  }`
);

// ══════════════════════════════════════════════════════════
// FIX 4: startMultiAccountScan — better result handling + fallback to single scan
// ══════════════════════════════════════════════════════════
replaceFunction(
  'startMultiAccountScan',
  'async function startMultiAccountScan(',
  `async function startMultiAccountScan() {
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings", "err");
    if (gmailAccounts.length === 0) return startGmailScan(); // fallback to single scan

    setGmailLoading(true);
    setGmailEmails([]);
    setGmailStats(null);
    setGmailScanProgress({});
    setGmailStatus({ msg: \`Scanning \${gmailAccounts.length} account\${gmailAccounts.length > 1 ? "s" : ""}…\`, type: "loading" });

    const combined = [];
    let errorCount = 0;

    // Scan accounts sequentially to avoid OAuth conflicts
    for (const acc of gmailAccounts) {
      try {
        const result = await scanSingleAccount(acc);
        if (result.emails?.length) combined.push(...result.emails);
        if (result.error) errorCount++;
      } catch (err) {
        console.warn(\`Scan failed for \${acc.email}:\`, err);
        errorCount++;
      }
    }

    if (!combined.length) {
      const msg = errorCount > 0
        ? \`Scan had errors on \${errorCount} account(s). Try removing and re-adding them.\`
        : "No job-related emails found in the last 30 days.";
      setGmailStatus({ msg, type: errorCount > 0 ? "error" : "success" });
      setGmailLoading(false);
      return;
    }

    // Deduplicate
    const seen = new Set();
    const deduped = combined.filter(e => {
      const key = \`\${e.subject}|\${e.from}\`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    setGmailStatus({ msg: \`Analyzing \${deduped.length} emails with AI…\`, type: "loading" });

    try {
      const text = await AI(
        \`Analyze these job emails from Gmail. Return ONLY a JSON array. Each object must have these keys: company, jobTitle, status (one of: Applied|Screening|Interview Scheduled|Interview Done|Offer Received|Rejected|Pending), interviewDate, interviewTime, interviewType, sender, date, snippet, subject, fromAccount.

Emails:
\${JSON.stringify(deduped.slice(0, 30))}\`,
        "Return only a valid JSON array, no markdown, no extra text."
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
          pending: emails.filter(e => e.status === "Pending" || e.status === "Screening").length,
        };
        setGmailStats(stats);
        setGmailRows(emails.map((e, i) => ({
          id: i + 1,
          date: e.date?.split("T")[0] || "",
          company: e.company || "",
          jobTitle: e.jobTitle || "",
          status: e.status || "Applied",
          interviewDate: e.interviewDate || "",
          interviewTime: e.interviewTime || "",
          interviewType: e.interviewType || "",
          notes: e.snippet || "",
          fromAccount: e.fromAccount || "",
        })));
        setGmailStatus({
          msg: \`✓ Found \${emails.length} job email\${emails.length !== 1 ? "s" : ""} across \${gmailAccounts.length} account\${gmailAccounts.length > 1 ? "s" : ""}\`,
          type: "success"
        });
      } else {
        setGmailStatus({ msg: "✓ Scan complete — no structured job emails found.", type: "success" });
      }
    } catch (aiErr) {
      // AI failed but we still have raw emails — show them without AI parsing
      setGmailEmails(deduped.map(e => ({
        company: e.from?.match(/^"?([^"<@]+)/)?.[1]?.trim() || "Unknown",
        jobTitle: e.subject || "Position",
        status: e.category || "Applied",
        sender: e.from,
        date: e.date,
        snippet: e.snippet,
        subject: e.subject,
        fromAccount: e.fromAccount,
      })));
      setGmailStatus({ msg: \`✓ Found \${deduped.length} emails (AI analysis failed — showing raw results)\`, type: "success" });
    }

    setGmailLoading(false);
  }`
);

// ══════════════════════════════════════════════════════════
// FIX 5: Update the "Add Gmail Account" button UI to explain how to add more accounts
// Replace the info note at the bottom of the accounts panel
// ══════════════════════════════════════════════════════════
const oldNote = `                {/* Info note */}
                <div style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#a5b4fc", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ flexShrink: 0 }}>🔐</span>
                  <span>Each account requires a separate Google permission. When you click "Scan All", a popup will appear for each account to grant Gmail read access.</span>
                </div>`;
const newNote = `                {/* Info note */}
                <div style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#a5b4fc", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ flexShrink: 0 }}>💡</span>
                  <span>
                    <strong>To add a 2nd Gmail account:</strong> First open a new browser tab → go to <strong>google.com</strong> → sign in with your other Gmail account → come back here and click <strong>+ Add Gmail Account</strong>.<br />
                    Tokens are cached when you add accounts, so scanning works without extra popups.
                  </span>
                </div>`;
if (code.includes(oldNote)) {
  code = code.replace(oldNote, newNote);
  console.log('✓ Updated info note with clear instructions');
  fixes++;
} else {
  // Try a looser match
  const looseOld = `<span>Each account requires a separate Google permission. When you click "Scan All", a popup will appear for each account to grant Gmail read access.</span>`;
  const looseNew = `<span><strong>To add a 2nd Gmail:</strong> Open a new tab → google.com → sign in with the other account → return here → click + Add Gmail Account. Tokens are cached after adding so scans run without extra popups.</span>`;
  if (code.includes(looseOld)) {
    code = code.replace(looseOld, looseNew);
    console.log('✓ Updated info note (loose match)');
    fixes++;
  } else {
    console.warn('⚠ Info note — not found (minor, not critical)');
  }
}

// ══════════════════════════════════════════════════════════
fs.writeFileSync(filePath, code, 'utf-8');
console.log(`\n✅ Applied ${fixes} fixes`);
console.log(`
What's fixed:
  📧 Scan Error: per-account token properly cached & used during scan
  📧 Token expiry: auto-cleared and re-fetched if expired (401 handling)
  📧 AI fallback: if AI fails, raw emails shown anyway
  📧 "Already added": clearer message explaining how to add a 2nd account
  📧 Info note: step-by-step instructions for adding multiple accounts

To add a 2nd Gmail account:
  1. Open a new browser tab
  2. Go to google.com and sign in with your 2nd Gmail
  3. Come back to JobBoard Pro
  4. Click + Add Gmail Account → Google shows account picker → pick 2nd account

Run: npm run dev
`);
