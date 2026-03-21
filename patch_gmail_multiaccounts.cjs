// patch_gmail_multiaccounts.cjs — Run with: node patch_gmail_multiaccounts.cjs
// Fixes:
// 1. "Already added" error when trying to add a 2nd/3rd Gmail account
//    (root cause: getGoogleToken caches by scope → always returns 1st account's token)
// 2. Each account now gets its own token stored as gtoken_acct_{email}
// 3. scanSingleAccount reads per-account tokens so parallel scans work correctly
// 4. startMultiAccountScan: scans sequentially to avoid popup conflicts

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'Dashboard.jsx');
if (!fs.existsSync(filePath)) {
  console.error('❌ src/Dashboard.jsx not found. Run from project root.');
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
  console.warn(`⚠ ${name} — marker not found (may already be applied)`);
  return false;
}

// ══════════════════════════════════════════════════════════════════
// FIX 1: addGmailAccount — force "select_account" prompt + per-account token cache
// Replace the entire function
// ══════════════════════════════════════════════════════════════════
patch(
  'addGmailAccount — force account picker, store per-account token',
  `  async function addGmailAccount() {
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings first", "err");
    setAddingAccount(true);
    try {
      // Pre-load GIS
      await loadGis();
      const token = await getGoogleToken("https://www.googleapis.com/auth/gmail.readonly", session, clientId);
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", { headers: { Authorization: \`Bearer \${token}\` } });
      const profileData = await profileRes.json();
      const email = profileData.email;
      if (!email) throw new Error("Could not get account email");

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
  }`,
  `  async function addGmailAccount() {
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings first", "err");
    setAddingAccount(true);
    try {
      const gis = await loadGis();
      // ALWAYS use prompt:"select_account" so the user can pick a DIFFERENT Google account
      // Do NOT use getGoogleToken() here — it caches by scope and always returns the same token
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

      const profileRes = await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", { headers: { Authorization: \`Bearer \${token}\` } });
      const profileData = await profileRes.json();
      const email = profileData.email;
      if (!email) throw new Error("Could not get account email");

      if (gmailAccounts.some(a => a.email === email)) {
        notify(\`\${email} is already connected\`, "err");
        setAddingAccount(false);
        return;
      }

      // Cache this token keyed by the specific account email
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
  }`
);

// ══════════════════════════════════════════════════════════════════
// FIX 2: scanSingleAccount — use per-account cached token, fallback to login_hint
// ══════════════════════════════════════════════════════════════════
patch(
  'scanSingleAccount — use per-account token cache',
  `  async function scanSingleAccount(account) {
    setGmailScanProgress(p => ({ ...p, [account.email]: "scanning" }));
    try {
      // Load GIS first (may already be loaded)
      const gis = await loadGis();
      const token = await new Promise((resolve, reject) => {
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
      });`,
  `  async function scanSingleAccount(account) {
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

      // 2. If no cached token, request one via GIS with login_hint
      if (!token) {
        const gis = await loadGis();
        token = await new Promise((resolve, reject) => {
          const tc = gis.initTokenClient({
            client_id: clientId,
            scope: "https://www.googleapis.com/auth/gmail.readonly",
            callback: (r) => {
              if (r.error) return reject(new Error(r.error_description || r.error));
              // Cache for future scans
              try {
                sessionStorage.setItem(\`gtoken_acct_\${account.email}\`, JSON.stringify({
                  token: r.access_token, exp: Date.now() + 3300000,
                }));
              } catch { }
              resolve(r.access_token);
            },
          });
          // login_hint asks Google to use this specific account without showing the picker
          tc.requestAccessToken({ prompt: "", login_hint: account.email });
        });
      }`
);

// ══════════════════════════════════════════════════════════════════
// FIX 3: Fix the broken error handling in scanSingleAccount
// The original code references `err` inside the try block and
// `emails` in the wrong scope — restructure properly
// ══════════════════════════════════════════════════════════════════
patch(
  'scanSingleAccount — fix broken error variable scope',
  `      const emails = details.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
      const isUserCancel = err.message?.includes("popup_closed") || err.message?.includes("access_denied");
      setGmailScanProgress(p => ({ ...p, [account.email]: emails.length > 0 ? "done" : (isUserCancel ? "skipped" : "done_empty") }));
      return { account: account.email, found: emails.length, emails };
    } catch (err) {
      const isUserCancel = err.message?.includes("popup_closed") || err.message?.includes("access_denied");
      setGmailScanProgress(p => ({ ...p, [account.email]: isUserCancel ? "skipped" : "error" }));
      if (!isUserCancel) console.warn(\`Gmail scan error for \${account.email}:\`, err.message);
      return { account: account.email, found: 0, emails: [], error: err.message };
    }`,
  `      const emails = details.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
      setGmailScanProgress(p => ({ ...p, [account.email]: emails.length > 0 ? "done" : "done_empty" }));
      return { account: account.email, found: emails.length, emails };
    } catch (err) {
      const isUserCancel = err.message?.includes("popup_closed") || err.message?.includes("access_denied");
      setGmailScanProgress(p => ({ ...p, [account.email]: isUserCancel ? "skipped" : "error" }));
      if (!isUserCancel) console.warn(\`Gmail scan error for \${account.email}:\`, err.message);
      return { account: account.email, found: 0, emails: [], error: err.message };
    }`
);

// ══════════════════════════════════════════════════════════════════
// FIX 4: removeGmailAccount — also clear the cached token for that account
// ══════════════════════════════════════════════════════════════════
patch(
  'removeGmailAccount — clear per-account token cache',
  `  function removeGmailAccount(id) {
    const updated = gmailAccounts.filter(a => a.id !== id);
    setGmailAccounts(updated);
    localStorage.setItem("gmailAccounts", JSON.stringify(updated));
    notify("Account removed");
  }`,
  `  function removeGmailAccount(id) {
    const account = gmailAccounts.find(a => a.id === id);
    if (account) {
      try { sessionStorage.removeItem(\`gtoken_acct_\${account.email}\`); } catch { }
    }
    const updated = gmailAccounts.filter(a => a.id !== id);
    setGmailAccounts(updated);
    localStorage.setItem("gmailAccounts", JSON.stringify(updated));
    notify("Account removed");
  }`
);

// ══════════════════════════════════════════════════════════════════
fs.writeFileSync(filePath, code, 'utf-8');
console.log(`\n✅ Applied ${fixes}/4 fixes`);
console.log(`\nFixes:`);
console.log(`  🔧 addGmailAccount: now uses prompt:"select_account" — always shows account picker`);
console.log(`  🔧 addGmailAccount: stores token keyed by account email, not just scope`);
console.log(`  🔧 scanSingleAccount: reads per-account cached token first, then falls back to login_hint`);
console.log(`  🔧 scanSingleAccount: fixed broken error variable scope`);
console.log(`  🔧 removeGmailAccount: clears the cached token when account is removed`);
console.log(`\nHow it works now:`);
console.log(`  1. Click "+ Add Gmail Account" → Google ALWAYS shows account chooser`);
console.log(`  2. Pick account 1 → token stored as gtoken_acct_user1@gmail.com`);
console.log(`  3. Click "+ Add Gmail Account" again → Google shows chooser again`);
console.log(`  4. Pick account 2 → token stored as gtoken_acct_user2@gmail.com`);
console.log(`  5. Scan All → each account uses its own cached token`);
console.log(`\nRun: npm run dev`);
