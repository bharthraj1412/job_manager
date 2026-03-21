// patch_fix.cjs — Run with: node patch_fix.cjs
// Fixes:
// 1. CityChips crash (React.useState / React.useRef not defined)
// 2. Multi-email support for scanner (add/remove/verify emails)

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
  console.warn(`⚠ ${name} — not found (may already be applied)`);
  return false;
}

// ══════════════════════════════════════════════════════════════════
// FIX 1: CityChips — React.useState / React.useRef → useState / useRef
// ══════════════════════════════════════════════════════════════════
patch(
  'CityChips: fix React.useState',
  `  const [ccInput, setCcInput] = React.useState('');`,
  `  const [ccInput, setCcInput] = useState('');`
);

patch(
  'CityChips: fix React.useRef',
  `  const ccRef = React.useRef();`,
  `  const ccRef = useRef();`
);

// ══════════════════════════════════════════════════════════════════
// FIX 2: Multi-email state — replace single reportEmail with array
// Insert after existing reportEmail state
// ══════════════════════════════════════════════════════════════════
patch(
  'Add multi-email state',
  `  const [reportEmail, setReportEmail] = useState(() => localStorage.getItem("reportEmail") || session?.user?.email || "");`,
  `  const [reportEmail, setReportEmail] = useState(() => localStorage.getItem("reportEmail") || session?.user?.email || "");
  // Multi-email scanner recipients
  const [scannerEmails, setScannerEmails] = useState(() => {
    try {
      const stored = localStorage.getItem("scannerEmails");
      if (stored) return JSON.parse(stored);
      const base = localStorage.getItem("reportEmail") || session?.user?.email || "";
      return base ? [{ id: Date.now(), email: base, verified: true, status: "verified" }] : [];
    } catch { return []; }
  });
  const [emailTestSending, setEmailTestSending] = useState(null); // id of email being tested`
);

// ══════════════════════════════════════════════════════════════════
// FIX 3: saveScannerEmails helper + addScannerEmail + removeScannerEmail
// Insert before the AI Extract function
// ══════════════════════════════════════════════════════════════════
patch(
  'Add scanner email management functions',
  `  // ── AI Extract job from pasted description ───────────────────────────────`,
  `  // ── Scanner Email Management ──────────────────────────────────────────────
  function addScannerEmail() {
    const newEntry = { id: Date.now(), email: "", verified: false, status: "unverified" };
    const updated = [...scannerEmails, newEntry];
    setScannerEmails(updated);
  }

  function removeScannerEmail(id) {
    const updated = scannerEmails.filter(e => e.id !== id);
    setScannerEmails(updated);
    localStorage.setItem("scannerEmails", JSON.stringify(updated));
  }

  function updateScannerEmail(id, email) {
    const updated = scannerEmails.map(e =>
      e.id === id ? { ...e, email, verified: false, status: email ? "unverified" : "empty" } : e
    );
    setScannerEmails(updated);
  }

  async function sendVerificationEmail(id) {
    const entry = scannerEmails.find(e => e.id === id);
    if (!entry?.email || !entry.email.includes("@")) return notify("Enter a valid email first", "err");
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings", "err");
    setEmailTestSending(id);
    try {
      const token = await getGoogleToken(
        "https://www.googleapis.com/auth/gmail.send", session, clientId
      );
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      // Store code temporarily
      const updated = scannerEmails.map(e =>
        e.id === id ? { ...e, verifyCode: code, status: "code_sent" } : e
      );
      setScannerEmails(updated);

      const html = \`<html><body style="font-family:Arial,sans-serif;background:#050c1a;color:#e2e8f0;padding:40px 20px;text-align:center">
        <div style="max-width:480px;margin:auto;background:#06101e;border:1px solid #1e2d45;border-radius:16px;padding:36px">
          <div style="font-size:32px;margin-bottom:12px">🎯</div>
          <h2 style="color:#818cf8;font-family:sans-serif;margin:0 0 8px">JobBoard Pro</h2>
          <p style="color:#64748b;font-size:14px;margin-bottom:24px">Email Verification</p>
          <div style="background:#0a1628;border:1px solid #1e2d45;border-radius:12px;padding:24px;margin-bottom:20px">
            <p style="color:#94a3b8;font-size:14px;margin:0 0 12px">Your verification code:</p>
            <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#60a5fa;font-family:monospace">\${code}</div>
          </div>
          <p style="color:#475569;font-size:12px">Enter this code in JobBoard Pro to verify this email address.<br>Code expires in 10 minutes.</p>
        </div>
      </body></html>\`;

      await sendEmailViaGmail(
        entry.email,
        "🎯 JobBoard Pro — Email Verification Code",
        html,
        token
      );
      notify(\`Verification code sent to \${entry.email} ✓\`);
    } catch (err) {
      notify("Send failed: " + err.message, "err");
      const updated = scannerEmails.map(e =>
        e.id === id ? { ...e, status: "unverified", verifyCode: null } : e
      );
      setScannerEmails(updated);
    }
    setEmailTestSending(null);
  }

  function confirmVerifyCode(id, inputCode) {
    const entry = scannerEmails.find(e => e.id === id);
    if (!entry?.verifyCode) return notify("Send verification code first", "err");
    if (inputCode.trim() === entry.verifyCode) {
      const updated = scannerEmails.map(e =>
        e.id === id ? { ...e, verified: true, status: "verified", verifyCode: null } : e
      );
      setScannerEmails(updated);
      localStorage.setItem("scannerEmails", JSON.stringify(updated));
      notify(\`✅ \${entry.email} verified!\`);
    } else {
      notify("Incorrect code — try again", "err");
    }
  }

  function saveScannerEmails() {
    const valid = scannerEmails.filter(e => e.email && e.email.includes("@"));
    localStorage.setItem("scannerEmails", JSON.stringify(valid));
    notify("Email recipients saved ✓");
  }

  // ── AI Extract job from pasted description ───────────────────────────────`
);

// ══════════════════════════════════════════════════════════════════
// FIX 4: Replace single reportEmail in handleSendReport with all verified emails
// ══════════════════════════════════════════════════════════════════
patch(
  'handleSendReport — send to all verified emails',
  `  async function handleSendReport(isAuto = false) {
    // Also send progress report in PDF format if selected
    if (!reportEmail) return notify("Set report email in Reports tab", "err");
    setReportSending(true);`,
  `  async function handleSendReport(isAuto = false) {
    // Also send progress report in PDF format if selected
    const allTargets = scannerEmails.filter(e => e.verified && e.email).map(e => e.email);
    if (allTargets.length === 0 && !reportEmail) return notify("Set report email in Reports tab", "err");
    const targets = allTargets.length > 0 ? allTargets : [reportEmail];
    setReportSending(true);`
);

// Fix the actual sendEmailViaGmail call in handleSendReport to loop targets
patch(
  'handleSendReport — loop through targets',
  `      await sendEmailViaGmail(reportEmail, subject, htmlBody, token);`,
  `      for (const target of targets) {
        await sendEmailViaGmail(target, subject, htmlBody, token);
      }`
);

// ══════════════════════════════════════════════════════════════════
// FIX 5: Add multi-email UI in Reports tab
// Replace the single "Send To Email" field
// ══════════════════════════════════════════════════════════════════
patch(
  'Reports tab — add multi-email UI',
  `                <F label="Send To Email"><Inp value={reportEmail} onChange={e => setReportEmail(e.target.value)} placeholder="your@email.com" type="email" /></F>`,
  `                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Report Recipients</span>
                    <button onClick={addScannerEmail} style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#a5b4fc", borderRadius: 7, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700 }}>＋ Add Email</button>
                  </div>
                  {scannerEmails.length === 0 && (
                    <div style={{ background: "#070f1c", border: "1px dashed #1e2d45", borderRadius: 10, padding: "12px 16px", color: "#334155", fontSize: 12, textAlign: "center" }}>
                      No recipients — click "+ Add Email" to add one
                    </div>
                  )}
                  {scannerEmails.map((entry) => (
                    <ScannerEmailRow
                      key={entry.id}
                      entry={entry}
                      onUpdate={(email) => updateScannerEmail(entry.id, email)}
                      onRemove={() => removeScannerEmail(entry.id)}
                      onSendCode={() => sendVerificationEmail(entry.id)}
                      onConfirm={(code) => confirmVerifyCode(entry.id, code)}
                      isSending={emailTestSending === entry.id}
                    />
                  ))}
                  {scannerEmails.length > 0 && (
                    <button onClick={saveScannerEmails} style={{ width: "100%", marginTop: 8, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", color: "#86efac", borderRadius: 8, padding: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>💾 Save Recipients</button>
                  )}
                </div>`
);

// ══════════════════════════════════════════════════════════════════
// FIX 6: Add ScannerEmailRow component near other atom components
// ══════════════════════════════════════════════════════════════════
patch(
  'Add ScannerEmailRow component',
  `// ── CityChips: multi-city tag input ──────────────────────────────────────────`,
  `// ── ScannerEmailRow: single email recipient with verification ───────────────
const ScannerEmailRow = ({ entry, onUpdate, onRemove, onSendCode, onConfirm, isSending }) => {
  const [codeInput, setCodeInput] = useState("");
  const statusColor = entry.status === "verified" ? "#22c55e" : entry.status === "code_sent" ? "#f59e0b" : "#64748b";
  const statusIcon  = entry.status === "verified" ? "✅" : entry.status === "code_sent" ? "📨" : "○";
  const statusLabel = entry.status === "verified" ? "Verified" : entry.status === "code_sent" ? "Code sent" : "Unverified";

  return (
    <div style={{ background: "#070f1c", border: \`1px solid \${entry.verified ? "rgba(34,197,94,0.25)" : "#1e2d45"}\`, borderRadius: 10, padding: "12px 14px", marginBottom: 8, transition: "border-color .2s" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: entry.status === "code_sent" ? 10 : 0 }}>
        <span title={statusLabel} style={{ fontSize: 14, flexShrink: 0 }}>{statusIcon}</span>
        <input
          type="email"
          value={entry.email}
          onChange={e => onUpdate(e.target.value)}
          placeholder="recipient@email.com"
          style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px solid #1e2d45", color: "#e2e8f0", fontFamily: "inherit", fontSize: 13, outline: "none", padding: "4px 0" }}
          disabled={entry.verified}
        />
        {!entry.verified && entry.email?.includes("@") && (
          <button onClick={onSendCode} disabled={isSending} style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", borderRadius: 7, padding: "4px 10px", cursor: isSending ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600, flexShrink: 0 }}>
            {isSending ? "Sending…" : entry.status === "code_sent" ? "Resend" : "Verify"}
          </button>
        )}
        {entry.verified && (
          <button onClick={() => onUpdate("")} title="Edit email" style={{ background: "transparent", border: "1px solid #1e2d45", color: "#475569", borderRadius: 7, padding: "4px 8px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>✏️</button>
        )}
        <button onClick={onRemove} style={{ background: "rgba(220,38,38,0.07)", border: "1px solid #450a0a", color: "#f87171", borderRadius: 7, padding: "4px 8px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", flexShrink: 0 }}>✕</button>
      </div>
      {entry.status === "code_sent" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingLeft: 22 }}>
          <input
            type="text"
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter 6-digit code"
            maxLength={6}
            style={{ flex: 1, background: "#0a1628", border: "1px solid #1e2d45", borderRadius: 8, padding: "7px 12px", color: "#e2e8f0", fontFamily: "'JetBrains Mono',monospace", fontSize: 16, outline: "none", letterSpacing: "4px", textAlign: "center" }}
          />
          <button onClick={() => { onConfirm(codeInput); setCodeInput(""); }} disabled={codeInput.length !== 6} style={{ background: codeInput.length === 6 ? "linear-gradient(135deg,#064e3b,#065f46)" : "#0a1628", border: "1px solid rgba(34,197,94,0.25)", color: codeInput.length === 6 ? "#6ee7b7" : "#334155", borderRadius: 8, padding: "7px 14px", cursor: codeInput.length === 6 ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>✓ Confirm</button>
        </div>
      )}
      {entry.verified && (
        <div style={{ paddingLeft: 22, color: "#22c55e", fontSize: 11, marginTop: 4 }}>Reports & digests will be sent to this address</div>
      )}
    </div>
  );
};

// ── CityChips: multi-city tag input ──────────────────────────────────────────`
);

// ══════════════════════════════════════════════════════════════════
// FIX 7: Also update handleSendJobDigest to use all verified emails
// ══════════════════════════════════════════════════════════════════
patch(
  'handleSendJobDigest — use all verified emails',
  `  async function handleSendJobDigest(isAuto = false) {
    if (!reportEmail) return notify("Set report email in Reports tab", "err");`,
  `  async function handleSendJobDigest(isAuto = false) {
    const allTargets = scannerEmails.filter(e => e.verified && e.email).map(e => e.email);
    const digestEmail = allTargets.length > 0 ? allTargets[0] : reportEmail;
    if (!digestEmail) return notify("Set report email in Reports tab", "err");`
);

// Fix the subject/html send call in digest
patch(
  'handleSendJobDigest — send to digest target',
  `      await sendEmailViaGmail(reportEmail, subject, htmlBody, token);`,
  `      for (const target of (allTargets.length > 0 ? allTargets : [reportEmail])) {
        await sendEmailViaGmail(target, subject, htmlBody, token);
      }`
);

// ══════════════════════════════════════════════════════════════════
// FIX 8: saveSettings — persist scannerEmails
// ══════════════════════════════════════════════════════════════════
patch(
  'saveSettings — persist scanner emails',
  `    localStorage.setItem("reportEmail", reportEmail);`,
  `    localStorage.setItem("reportEmail", reportEmail);
    localStorage.setItem("scannerEmails", JSON.stringify(scannerEmails));`
);

// ══════════════════════════════════════════════════════════════════
// Done
// ══════════════════════════════════════════════════════════════════
fs.writeFileSync(filePath, code, 'utf-8');
console.log(`\n✅ Applied ${fixes} fixes`);
console.log(`\nFixes:`);
console.log(`  🐛 CityChips crash (React.useState → useState, React.useRef → useRef)`);
console.log(`  📧 Multi-email recipients with verification code`);
console.log(`  📨 Reports & digests now sent to ALL verified emails`);
console.log(`\nRun: npm run dev`);
