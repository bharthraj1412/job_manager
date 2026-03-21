// patch_gmail_scan_fix.cjs — Run with: node patch_gmail_scan_fix.cjs
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'Dashboard.jsx');
if (!fs.existsSync(filePath)) {
  console.error('src/Dashboard.jsx not found. Run from project root.');
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf-8');
let fixes = 0;

function patch(name, from, to) {
  if (code.includes(from)) {
    code = code.split(from).join(to);
    console.log('OK: ' + name);
    fixes++;
    return true;
  }
  console.warn('SKIP: ' + name + ' (marker not found)');
  return false;
}

// ══════════════════════════════════════════════════════════════
// FIX 1: Broken JSON array regex — /[[sS]*]/ is wrong
// ══════════════════════════════════════════════════════════════
(function() {
  var bad  = 'const match = text.replace(/```json|```/g, "").trim().match(/[[sS]*]/);';
  var good = 'const match = text.replace(/```json|```/g, "").trim().match(/\\[[\\s\\S]*\\]/);';
  if (code.includes(bad)) {
    code = code.split(bad).join(good);
    console.log('OK: FIX 1 - broken regex [[sS]*] -> [\\s\\S]*');
    fixes++;
  } else {
    console.warn('SKIP: FIX 1 - broken regex not found (already fixed or different)');
  }
})();

// ══════════════════════════════════════════════════════════════
// FIX 2: Tighter GMAIL_QUERIES in handleGmailMultiScan
// ══════════════════════════════════════════════════════════════
patch(
  'FIX 2 - Tighter GMAIL_QUERIES',
  '      // 5 search queries run in parallel\n      const GMAIL_QUERIES = [\n        { label: "Interview Scheduled",   q: "subject:(interview scheduled OR interview invitation OR interview confirmed) from:(careers OR jobs OR hiring OR hr OR noreply OR talent)" },\n        { label: "Offer Received",        q: "subject:(offer letter OR job offer OR we would like to offer OR pleased to offer) from:(careers OR jobs OR hiring OR hr)" },\n        { label: "Rejected",              q: "subject:(regret OR unfortunately OR not moving forward OR not selected OR other candidates) from:(careers OR jobs OR hiring OR hr OR noreply)" },\n        { label: "Applied",               q: "subject:(application received OR thank you for applying OR we received your application OR application submitted) from:(careers OR jobs OR noreply)" },\n        { label: "Screening",             q: "subject:(screening call OR phone screen OR initial interview OR recruiter would like) from:(careers OR jobs OR hiring OR recruiter OR talent)" },\n      ];',

  '      // Tight queries — require hiring context, exclude newsletters/marketing\n' +
  '      const GMAIL_QUERIES = [\n' +
  '        { label: "Interview Scheduled", q: \'(subject:"interview scheduled" OR subject:"interview invitation" OR subject:"interview confirmed") (from:careers OR from:jobs OR from:recruiting OR from:hr OR from:talent) -subject:newsletter -subject:unsubscribe\' },\n' +
  '        { label: "Offer Received",      q: \'(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer" OR subject:"we would like to offer") (from:careers OR from:jobs OR from:hr OR from:recruiting) -subject:newsletter\' },\n' +
  '        { label: "Rejected",            q: \'(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates" OR subject:"position has been filled") (from:careers OR from:jobs OR from:hr OR from:noreply) -subject:newsletter -subject:unsubscribe\' },\n' +
  '        { label: "Applied",             q: \'(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted" OR subject:"application confirmation") -subject:newsletter -subject:unsubscribe -subject:"password reset" -subject:"verify your"\' },\n' +
  '        { label: "Screening",           q: \'(subject:"phone screen" OR subject:"screening call" OR subject:"initial call" OR subject:"recruiter would like") (from:careers OR from:jobs OR from:recruiting OR from:hr OR from:talent) -subject:newsletter\' },\n' +
  '      ];'
);

// ══════════════════════════════════════════════════════════════
// FIX 3: Stop silently creating jobs from unmatched emails
// ══════════════════════════════════════════════════════════════
patch(
  'FIX 3 - No silent job creation from unmatched emails',
  '        } else if (!matchedJob) {\n' +
  '          // New job from email — extract company from sender\n' +
  '          const company = email.from.match(/^"?([^"<]+)"?\\s*</)?.[1]?.trim() || fromDomain || "Unknown";\n' +
  '          const newJob = {\n' +
  '            title: email.subject.replace(/re:/i, "").trim().slice(0, 80),\n' +
  '            company: company.slice(0, 50),\n' +
  '            status: email.category,\n' +
  '            notes: `[Imported from Gmail ${new Date(email.date).toLocaleDateString()}]\\n${email.subject}`,\n' +
  '            source: "Gmail Scan",\n' +
  '            applieddate: email.category === "Applied" ? new Date(email.date).toISOString().split("T")[0] : "",\n' +
  '            location: "", type: "Full-time", salary: "", skills: "", deadline: "", priority: "Medium", applylink: "",\n' +
  '          };\n' +
  '          newCount++;\n' +
  '          // Save to Supabase\n' +
  '          const { error } = await supabase.from("jobs").insert({ ...newJob, user_id: session.user.id });\n' +
  '          if (!error) setJobs(prev => [{ ...newJob, id: Date.now().toString() }, ...prev]);\n' +
  '        }',

  '        } else if (!matchedJob) {\n' +
  '          // No matching job found — do NOT auto-create; user can add manually from Gmail tab\n' +
  '          newCount++;\n' +
  '        }'
);

// ══════════════════════════════════════════════════════════════
// FIX 4: Accurate summary message
// ══════════════════════════════════════════════════════════════
patch(
  'FIX 4 - Accurate scan summary',
  '      const summary = [];\n' +
  '      if (updatedCount) summary.push(`${updatedCount} status${updatedCount > 1 ? "es" : ""} updated`);\n' +
  '      if (newCount) summary.push(`${newCount} new job${newCount > 1 ? "s" : ""} added`);\n' +
  '      const msg = summary.length ? `✅ Gmail scan: ${summary.join(", ")}` : "✅ Gmail scan done — no changes needed";\n' +
  '      notify(msg);',

  '      const summary = [];\n' +
  '      if (updatedCount) summary.push(`${updatedCount} status${updatedCount > 1 ? "es" : ""} updated`);\n' +
  '      if (newCount) summary.push(`${newCount} unmatched (check Gmail tab)`);\n' +
  '      const msg = summary.length\n' +
  '        ? `✅ Gmail scan: ${summary.join(" · ")}`\n' +
  '        : "✅ Gmail scan done — no status changes";\n' +
  '      if (!silent || updatedCount > 0) notify(msg);'
);

// ══════════════════════════════════════════════════════════════
// FIX 5: Tighter single-account scan base query
// ══════════════════════════════════════════════════════════════
patch(
  'FIX 5 - Tighter single-account base query',
  '      let baseQ = `(subject:interview OR subject:offer OR subject:application OR subject:rejected OR subject:assessment) newer_than:${gmailDays}d`;',
  '      const baseQParts = [\n' +
  '        "(",\n' +
  '        "subject:\\"interview\\" OR subject:\\"job offer\\" OR subject:\\"offer letter\\" OR",\n' +
  '        "subject:\\"application received\\" OR subject:\\"thank you for applying\\" OR",\n' +
  '        "subject:\\"application submitted\\" OR subject:\\"not moving forward\\" OR",\n' +
  '        "subject:\\"unfortunately\\" OR subject:\\"screening call\\" OR subject:\\"phone screen\\"",\n' +
  '        ")",\n' +
  '        "-subject:newsletter -subject:unsubscribe -subject:\\"verify your email\\" -subject:\\"password reset\\" -subject:\\"your receipt\\" -subject:\\"your order\\"",\n' +
  '      ];\n' +
  '      let baseQ = baseQParts.join(" ") + " newer_than:" + gmailDays + "d";'
);

// ══════════════════════════════════════════════════════════════
// FIX 6: Tighter queries in scanSingleAccount
// ══════════════════════════════════════════════════════════════
patch(
  'FIX 6 - Tighter scanSingleAccount queries',
  '      const QUERIES = [\n' +
  '        { label: "Interview Scheduled", q: "subject:(interview scheduled OR interview invitation OR interview confirmed) newer_than:30d" },\n' +
  '        { label: "Offer Received",      q: "subject:(offer letter OR job offer OR pleased to offer) newer_than:30d" },\n' +
  '        { label: "Rejected",            q: "subject:(regret OR unfortunately OR not moving forward OR not selected) newer_than:30d" },\n' +
  '        { label: "Applied",             q: "subject:(application received OR thank you for applying OR application submitted) newer_than:30d" },\n' +
  '        { label: "Screening",           q: "subject:(screening call OR phone screen OR initial interview) newer_than:30d" },\n' +
  '      ];',

  '      const QUERIES = [\n' +
  '        { label: "Interview Scheduled", q: \'(subject:"interview scheduled" OR subject:"interview invitation" OR subject:"interview confirmed") (from:careers OR from:jobs OR from:recruiting OR from:hr OR from:talent) newer_than:30d -subject:newsletter -subject:unsubscribe\' },\n' +
  '        { label: "Offer Received",      q: \'(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer") (from:careers OR from:jobs OR from:hr OR from:recruiting) newer_than:30d -subject:newsletter\' },\n' +
  '        { label: "Rejected",            q: \'(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates") (from:careers OR from:jobs OR from:hr OR from:noreply) newer_than:30d -subject:newsletter -subject:unsubscribe\' },\n' +
  '        { label: "Applied",             q: \'(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted") newer_than:30d -subject:newsletter -subject:unsubscribe -subject:"password reset" -subject:"verify your"\' },\n' +
  '        { label: "Screening",           q: \'(subject:"phone screen" OR subject:"screening call" OR subject:"initial call") (from:careers OR from:jobs OR from:recruiting OR from:hr OR from:talent) newer_than:30d -subject:newsletter\' },\n' +
  '      ];'
);

// ══════════════════════════════════════════════════════════════
fs.writeFileSync(filePath, code, 'utf-8');
console.log('\nDone: ' + fixes + ' fixes applied');
console.log('\nWhat changed:');
console.log('  FIX 1  Broken regex /[[sS]*]/ -> /[\\s\\S]*/ so JSON parsing works');
console.log('  FIX 2  Gmail queries require hiring senders, exclude newsletters/marketing');
console.log('  FIX 3  Unmatched emails no longer silently create tracker entries');
console.log('  FIX 4  Scan summary is accurate; auto-scan only notifies on real changes');
console.log('  FIX 5  Single-account scan excludes receipts, password resets, promotions');
console.log('  FIX 6  Per-account queries also tightened');
console.log('\nRun: npm run dev');
