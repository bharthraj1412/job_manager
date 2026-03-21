// patch_gmail_v2.cjs — Smarter patch that finds functions by boundary detection
// Run with: node patch_gmail_v2.cjs

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'Dashboard.jsx');
if (!fs.existsSync(filePath)) {
  console.error('❌ src/Dashboard.jsx not found. Run from project root.');
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf-8');
let fixes = 0;

// Find the start and end of a function/block by brace counting
function findFunctionBounds(code, searchStr, startFrom = 0) {
  const idx = code.indexOf(searchStr, startFrom);
  if (idx === -1) return null;
  // find the opening brace
  let braceStart = code.indexOf('{', idx);
  if (braceStart === -1) return null;
  let depth = 0;
  let i = braceStart;
  while (i < code.length) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) return { start: idx, end: i + 1 };
    }
    i++;
  }
  return null;
}

// ══════════════════════════════════════════════════════════
// FIX 1: Replace addGmailAccount function entirely
// ══════════════════════════════════════════════════════════
const addBounds = findFunctionBounds(code, 'async function addGmailAccount()');
if (addBounds) {
  const newFn = `async function addGmailAccount() {
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings first", "err");
    setAddingAccount(true);
    try {
      const gis = await loadGis();
      // ALWAYS use prompt:"select_account" so the user can pick a DIFFERENT Google account.
      // Do NOT use getGoogleToken() here — it caches by scope and always returns the same token.
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
      const profileData = await profileRes.json();
      const email = profileData.email;
      if (!email) throw new Error("Could not get account email");

      if (gmailAccounts.some(a => a.email === email)) {
        notify(\`\${email} is already connected — pick a different account\`, "err");
        setAddingAccount(false);
        return;
      }

      // Cache token keyed by this specific account email (not by scope)
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
      notify(\`✅ \${email} added!\`);
    } catch (err) {
      if (!err.message?.includes("popup_closed") && !err.message?.includes("access_denied")) {
        notify("Could not add account: " + err.message, "err");
      }
    }
    setAddingAccount(false);
  }`;
  code = code.slice(0, addBounds.start) + newFn + code.slice(addBounds.end);
  console.log('✓ addGmailAccount replaced');
  fixes++;
} else {
  console.warn('⚠ addGmailAccount — not found');
}

// ══════════════════════════════════════════════════════════
// FIX 2: Replace removeGmailAccount to also clear cached token
// ══════════════════════════════════════════════════════════
const removeBounds = findFunctionBounds(code, 'function removeGmailAccount(');
if (removeBounds) {
  const newFn = `function removeGmailAccount(id) {
    const account = gmailAccounts.find(a => a.id === id);
    if (account) {
      try { sessionStorage.removeItem(\`gtoken_acct_\${account.email}\`); } catch { }
    }
    const updated = gmailAccounts.filter(a => a.id !== id);
    setGmailAccounts(updated);
    localStorage.setItem("gmailAccounts", JSON.stringify(updated));
    notify("Account removed");
  }`;
  code = code.slice(0, removeBounds.start) + newFn + code.slice(removeBounds.end);
  console.log('✓ removeGmailAccount replaced');
  fixes++;
} else {
  console.warn('⚠ removeGmailAccount — not found');
}

// ══════════════════════════════════════════════════════════
// FIX 3: Replace scanSingleAccount to use per-account token cache
// ══════════════════════════════════════════════════════════
const scanBounds = findFunctionBounds(code, 'async function scanSingleAccount(');
if (scanBounds) {
  const newFn = `async function scanSingleAccount(account) {
    setGmailScanProgress(p => ({ ...p, [account.email]: "scanning" }));
    try {
      // 1. Try the per-account token cached when we added this account
      let token = null;
      try {
        const cached = sessionStorage.getItem(\`gtoken_acct_\${account.email}\`);
        if (cached) {
          const { token: t, exp } = JSON.parse(cached);
          if (t && Date.now() < exp) token = t;
        }
      } catch { }

      // 2. If no cached token, request one via GIS with login_hint (no account picker needed)
      if (!token) {
        const gis = await loadGis();
        token = await new Promise((resolve, reject) => {
          const tc = gis.initTokenClient({
            client_id: clientId,
            scope: "https://www.googleapis.com/auth/gmail.readonly",
            callback: (r) => {
              if (r.error) return reject(new Error(r.error_description || r.error));
              try {
                sessionStorage.setItem(\`gtoken_acct_\${account.email}\`, JSON.stringify({
                  token: r.access_token, exp: Date.now() + 3300000,
                }));
              } catch { }
              resolve(r.access_token);
            },
          });
          // login_hint tells Google to use this specific account silently
          tc.requestAccessToken({ prompt: "", login_hint: account.email });
        });
      }

      const QUERIES = [
        { label: "Interview Scheduled", q: "subject:(interview scheduled OR interview invitation OR interview confirmed) newer_than:30d" },
        { label: "Offer Received",      q: "subject:(offer letter OR job offer OR we would like to offer OR pleased to offer) newer_than:30d" },
        { label: "Rejected",            q: "subject:(regret OR unfortunately OR not moving forward OR not selected OR other candidates) newer_than:30d" },
        { label: "Applied",             q: "subject:(application received OR thank you for applying OR we received your application OR application submitted) newer_than:30d" },
        { label: "Screening",           q: "subject:(screening call OR phone screen OR initial interview OR recruiter would like) newer_than:30d" },
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
      setGmailScanProgress(p => ({ ...p, [account.email]: emails.length > 0 ? "done" : "done_empty" }));
      return { account: account.email, found: emails.length, emails };
    } catch (err) {
      const isUserCancel = err.message?.includes("popup_closed") || err.message?.includes("access_denied");
      setGmailScanProgress(p => ({ ...p, [account.email]: isUserCancel ? "skipped" : "error" }));
      if (!isUserCancel) console.warn(\`Gmail scan error for \${account.email}:\`, err.message);
      return { account: account.email, found: 0, emails: [], error: err.message };
    }
  }`;
  code = code.slice(0, scanBounds.start) + newFn + code.slice(scanBounds.end);
  console.log('✓ scanSingleAccount replaced');
  fixes++;
} else {
  console.warn('⚠ scanSingleAccount — not found');
}

// ══════════════════════════════════════════════════════════
fs.writeFileSync(filePath, code, 'utf-8');
console.log(`\n✅ Applied ${fixes}/3 fixes`);
if (fixes === 3) {
  console.log('\nWhat changed:');
  console.log('  📧 "+ Add Gmail Account" now ALWAYS shows Google account picker');
  console.log('  🔑 Each account token cached separately (gtoken_acct_email)');
  console.log('  🔍 Scan uses each account\'s own token — no cross-account conflicts');
  console.log('  🗑  Removing an account also clears its cached token');
  console.log('\nRun: npm run dev');
} else {
  console.log('\n⚠ Some patches failed. Check warnings above.');
}
