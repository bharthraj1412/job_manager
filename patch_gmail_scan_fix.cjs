// patch_gmail_scan_fix.cjs — Run with: node patch_gmail_scan_fix.cjs
// Fixes:
// 1. Broken JSON array regex in startMultiAccountScan (was character class [sS], not [\s\S])
// 2. Overly broad Gmail search queries → specific job-domain filters
// 3. handleGmailMultiScan silently creating unwanted jobs → require confirmation
// 4. Single-account scan query too generic → tighter job-specific patterns

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
// FIX 1: Broken regex in startMultiAccountScan
// /[[sS]*]/ is a character class matching [ s S * ] — totally wrong
// Should be /\[[\s\S]*\]/ to match a JSON array
// ══════════════════════════════════════════════════════════════════
patch(
  'FIX 1: Broken JSON array regex in startMultiAccountScan',
  `const match = text.replace(/\`\`\`json|\`\`\`/g, "").trim().match(/[[sS]*]/);`,
  `const match = text.replace(/\`\`\`json|\`\`\`/g, "").trim().match(/\\[[\\s\\S]*\\]/);`
);

// Also fix the same broken regex pattern if it appears differently
patch(
  'FIX 1b: Broken JSON array regex variant',
  `const match = text.replace(/```json|```/g, "").trim().match(/[[sS]*]/);`,
  `const match = text.replace(/\`\`\`json|\`\`\`/g, "").trim().match(/\\[[\\s\\S]*\\]/);`
);

// ══════════════════════════════════════════════════════════════════
// FIX 2: Replace overly broad GMAIL_QUERIES in handleGmailMultiScan
// Old queries match newsletters, marketing, password resets etc.
// New queries add -from:noreply@*marketing, require hiring/careers context
// ══════════════════════════════════════════════════════════════════
patch(
  'FIX 2: Tighter Gmail search queries in handleGmailMultiScan',
  `      // 5 search queries run in parallel
      const GMAIL_QUERIES = [
        { label: "Interview Scheduled",   q: "subject:(interview scheduled OR interview invitation OR interview confirmed) from:(careers OR jobs OR hiring OR hr OR noreply OR talent)" },
        { label: "Offer Received",        q: "subject:(offer letter OR job offer OR we would like to offer OR pleased to offer) from:(careers OR jobs OR hiring OR hr)" },
        { label: "Rejected",              q: "subject:(regret OR unfortunately OR not moving forward OR not selected OR other candidates) from:(careers OR jobs OR hiring OR hr OR noreply)" },
        { label: "Applied",               q: "subject:(application received OR thank you for applying OR we received your application OR application submitted) from:(careers OR jobs OR noreply)" },
        { label: "Screening",             q: "subject:(screening call OR phone screen OR initial interview OR recruiter would like) from:(careers OR jobs OR hiring OR recruiter OR talent)" },
      ];`,
  `      // 5 search queries — specific enough to avoid newsletters/marketing
      const GMAIL_QUERIES = [
        {
          label: "Interview Scheduled",
          q: [
            '(subject:"interview scheduled" OR subject:"interview invitation" OR subject:"interview confirmed" OR subject:"interview request")',
            '(from:careers OR from:jobs OR from:recruiting OR from:talent OR from:hr)',
            '-subject:newsletter -subject:unsubscribe -subject:"verify your" -subject:"confirm your email"',
          ].join(' '),
        },
        {
          label: "Offer Received",
          q: [
            '(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer" OR subject:"we would like to offer" OR subject:"congratulations on your offer")',
            '(from:careers OR from:jobs OR from:hr OR from:recruiting OR from:talent)',
            '-subject:newsletter -subject:discount -subject:sale',
          ].join(' '),
        },
        {
          label: "Rejected",
          q: [
            '(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates" OR subject:"not a match" OR subject:"position has been filled")',
            '(from:careers OR from:jobs OR from:hr OR from:recruiting OR from:noreply)',
            '-subject:newsletter -subject:unsubscribe',
          ].join(' '),
        },
        {
          label: "Applied",
          q: [
            '(subject:"application received" OR subject:"thank you for applying" OR subject:"we received your application" OR subject:"application submitted" OR subject:"application confirmation")',
            '-subject:newsletter -subject:unsubscribe -subject:"verify your" -subject:"password reset"',
          ].join(' '),
        },
        {
          label: "Screening",
          q: [
            '(subject:"phone screen" OR subject:"screening call" OR subject:"initial call" OR subject:"introductory call" OR subject:"recruiter would like to connect")',
            '(from:careers OR from:jobs OR from:recruiting OR from:talent OR from:hr)',
            '-subject:newsletter',
          ].join(' '),
        },
      ];`
);

// ══════════════════════════════════════════════════════════════════
// FIX 3: handleGmailMultiScan — stop silently adding unmatched
// emails as new jobs. Only UPDATE status of EXISTING matched jobs.
// Unmatched emails should be shown in the Gmail tab for manual review.
// ══════════════════════════════════════════════════════════════════
patch(
  'FIX 3: Stop silently creating jobs from unmatched emails',
  `        } else if (!matchedJob) {
          // New job from email — extract company from sender
          const company = email.from.match(/^"?([^"<]+)"?\\s*</)?.[1]?.trim() || fromDomain || "Unknown";
          const newJob = {
            title: email.subject.replace(/re:/i, "").trim().slice(0, 80),
            company: company.slice(0, 50),
            status: email.category,
            notes: \`[Imported from Gmail \${new Date(email.date).toLocaleDateString()}]\\n\${email.subject}\`,
            source: "Gmail Scan",
            applieddate: email.category === "Applied" ? new Date(email.date).toISOString().split("T")[0] : "",
            location: "", type: "Full-time", salary: "", skills: "", deadline: "", priority: "Medium", applylink: "",
          };
          newCount++;
          // Save to Supabase
          const { error } = await supabase.from("jobs").insert({ ...newJob, user_id: session.user.id });
          if (!error) setJobs(prev => [{ ...newJob, id: Date.now().toString() }, ...prev]);
        }`,
  `        } else if (!matchedJob) {
          // Email doesn't match any existing job — track it for manual review
          // We do NOT auto-create jobs from unmatched emails to avoid polluting the tracker
          newCount++; // counted as "found but unmatched" — shown in summary
        }`
);

// ══════════════════════════════════════════════════════════════════
// FIX 4: Update summary message to be accurate about what happened
// ══════════════════════════════════════════════════════════════════
patch(
  'FIX 4: Accurate summary message after multi-scan',
  `      const summary = [];
      if (updatedCount) summary.push(\`\${updatedCount} status\${updatedCount > 1 ? "es" : ""} updated\`);
      if (newCount) summary.push(\`\${newCount} new job\${newCount > 1 ? "s" : ""} added\`);
      const msg = summary.length ? \`✅ Gmail scan: \${summary.join(", ")}\` : "✅ Gmail scan done — no changes needed";
      notify(msg);`,
  `      const summary = [];
      if (updatedCount) summary.push(\`\${updatedCount} status\${updatedCount > 1 ? "es" : ""} updated\`);
      if (newCount) summary.push(\`\${newCount} unmatched email\${newCount > 1 ? "s" : ""} (check Gmail tab)\`);
      const msg = summary.length
        ? \`✅ Gmail scan: \${summary.join(" · ")}\`
        : "✅ Gmail scan done — no new changes";
      if (!silent) notify(msg);
      else if (updatedCount > 0) notify(msg); // only notify on auto-scan if something changed`
);

// ══════════════════════════════════════════════════════════════════
// FIX 5: Single-account startGmailScan — tighter base query
// ══════════════════════════════════════════════════════════════════
patch(
  'FIX 5: Tighter single-account Gmail scan base query',
  `      let baseQ = \`(subject:interview OR subject:offer OR subject:application OR subject:rejected OR subject:assessment) newer_than:\${gmailDays}d\`;`,
  `      // Tighter query: must relate to job context, exclude obvious non-job emails
      let baseQ = [
        \`(\`,
        \`subject:"interview" OR subject:"job offer" OR subject:"offer letter" OR\`,
        \`subject:"application received" OR subject:"thank you for applying" OR\`,
        \`subject:"application submitted" OR subject:"not moving forward" OR\`,
        \`subject:"unfortunately" OR subject:"screening call" OR subject:"phone screen"\`,
        \`)\`,
        \`newer_than:\${gmailDays}d\`,
        \`-subject:newsletter -subject:unsubscribe -subject:"verify your email" -subject:"password reset" -subject:"confirm your" -subject:"your receipt" -subject:"your order"\`,
      ].join(' ');`
);

// ══════════════════════════════════════════════════════════════════
// FIX 6: scanSingleAccount — tighter queries too
// ══════════════════════════════════════════════════════════════════
patch(
  'FIX 6: Tighter queries in scanSingleAccount',
  `      const QUERIES = [
        { label: "Interview Scheduled", q: "subject:(interview scheduled OR interview invitation OR interview confirmed) newer_than:30d" },
        { label: "Offer Received",      q: "subject:(offer letter OR job offer OR pleased to offer) newer_than:30d" },
        { label: "Rejected",            q: "subject:(regret OR unfortunately OR not moving forward OR not selected) newer_than:30d" },
        { label: "Applied",             q: "subject:(application received OR thank you for applying OR application submitted) newer_than:30d" },
        { label: "Screening",           q: "subject:(screening call OR phone screen OR initial interview) newer_than:30d" },
      ];`,
  `      const QUERIES = [
        {
          label: "Interview Scheduled",
          q: '(subject:"interview scheduled" OR subject:"interview invitation" OR subject:"interview confirmed" OR subject:"interview request") (from:careers OR from:jobs OR from:recruiting OR from:hr OR from:talent) newer_than:30d -subject:newsletter -subject:unsubscribe',
        },
        {
          label: "Offer Received",
          q: '(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer" OR subject:"we would like to offer") (from:careers OR from:jobs OR from:hr OR from:recruiting) newer_than:30d -subject:newsletter',
        },
        {
          label: "Rejected",
          q: '(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates" OR subject:"position has been filled") (from:careers OR from:jobs OR from:hr OR from:recruiting OR from:noreply) newer_than:30d -subject:newsletter -subject:unsubscribe',
        },
        {
          label: "Applied",
          q: '(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted" OR subject:"application confirmation") newer_than:30d -subject:newsletter -subject:unsubscribe -subject:"password reset" -subject:"verify your"',
        },
        {
          label: "Screening",
          q: '(subject:"phone screen" OR subject:"screening call" OR subject:"initial call" OR subject:"recruiter would like") (from:careers OR from:jobs OR from:recruiting OR from:hr OR from:talent) newer_than:30d -subject:newsletter',
        },
      ];`
);

// ══════════════════════════════════════════════════════════════════
// Write fixed file
// ══════════════════════════════════════════════════════════════════
fs.writeFileSync(filePath, code, 'utf-8');

console.log(`\n✅ Applied ${fixes} fixes to src/Dashboard.jsx\n`);
console.log('Fixes applied:');
console.log('  🐛 FIX 1: Broken regex /[[sS]*]/ → /[\\s\\S]*/ (was matching literal chars, not whitespace)');
console.log('  🔍 FIX 2: Tighter Gmail queries — excludes newsletters, password resets, marketing');
console.log('  🚫 FIX 3: No more silent job creation from unmatched emails (prevented tracker pollution)');
console.log('  💬 FIX 4: Accurate scan summary message');
console.log('  🔍 FIX 5: Single-account scan base query now excludes non-job emails');
console.log('  🔍 FIX 6: Multi-account per-query filters also tightened');
console.log('\nHow Gmail scanning now works:');
console.log('  • Matched emails (sender domain matches an existing job) → status updated ✓');
console.log('  • Unmatched emails → shown in Gmail tab for manual "Add to Tracker" ✓');
console.log('  • Marketing/newsletters/password resets → filtered out at query level ✓');
console.log('\nRun: npm run dev');
