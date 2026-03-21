// patch_v4.cjs — Run with: node patch_v4.cjs
// Fixes blank page after login caused by:
// 1. null element in actions array crashing .map()
// 2. undefined `e` variable in action handlers
// 3. Duplicate function declarations (handleGmailMultiScan, generateInterviewPrep,
//    generateFollowUp, getSalaryBenchmark)

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'Dashboard.jsx');
if (!fs.existsSync(filePath)) {
  console.error('❌ src/Dashboard.jsx not found. Run from project root.');
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf-8');
const originalLength = code.length;
let patchCount = 0;

function patch(name, from, to) {
  if (code.includes(from)) {
    code = code.replace(from, to);
    console.log(`✓ ${name}`);
    patchCount++;
    return true;
  }
  console.warn(`⚠ ${name} — marker not found`);
  return false;
}

// ── FIX 1: null in actions array + undefined `e` variable ──────────────────
// The null element (when job.status !== 'Applied') causes .map() to crash
// because it tries to destructure null as [ic, tt, fn]
patch(
  'Fix null in actions array + undefined e in handlers',
  `                            job.status === "Interview" ? ["🎙", "AI Prep", () => { e.stopPropagation(); generateInterviewPrep(job); }] : ["📋", "Guide", () => doPrep(job)],
                            job.status === "Applied" ? ["📧", "Follow-up", () => { e.stopPropagation(); generateFollowUp(job); }] : null,
                            ["✉", "Cover", () => { setShowCover(job); setCoverOut(""); }],
                            ["⚡","Auto Apply",() => autoApplyToJob(job)],
                            ["📅", "Calendar", () => addToCalendar(job)],
                            ["📋", "Duplicate", () => duplicateJob(job)],
                            ["✏️", "Edit", () => openEdit(job)],
                            ["🗑", "Delete", () => delJob(job.id)],
                          ].map(([ic, tt, fn]) => (`,
  `                            job.status === "Interview" ? ["🎙", "AI Prep", () => generateInterviewPrep(job)] : ["📋", "Guide", () => doPrep(job)],
                            job.status === "Applied" ? ["📧", "Follow-up", () => generateFollowUp(job)] : null,
                            ["✉", "Cover", () => { setShowCover(job); setCoverOut(""); }],
                            ["⚡","Auto Apply",() => autoApplyToJob(job)],
                            ["📅", "Calendar", () => addToCalendar(job)],
                            ["📋", "Duplicate", () => duplicateJob(job)],
                            ["✏️", "Edit", () => openEdit(job)],
                            ["🗑", "Delete", () => delJob(job.id)],
                          ].filter(Boolean).map(([ic, tt, fn]) => (`
);

// ── FIX 2: Remove second duplicate handleGmailMultiScan declaration ─────────
// The function is declared twice; the second declaration causes issues
// We identify the second occurrence by the comment before it

// Count occurrences of handleGmailMultiScan function declarations
const gmailScanMatches = (code.match(/async function handleGmailMultiScan/g) || []).length;
console.log(`  Found ${gmailScanMatches} handleGmailMultiScan declarations`);

if (gmailScanMatches >= 2) {
  // Remove the second full duplicate by finding the second occurrence
  // The second one starts after the first complete function
  const marker1 = '  // ── Gmail Multi-Category Scanner (5 categories simultaneously) ──────────\n  async function handleGmailMultiScan';
  const firstIdx = code.indexOf(marker1);
  if (firstIdx !== -1) {
    const secondIdx = code.indexOf(marker1, firstIdx + 100);
    if (secondIdx !== -1) {
      // Find the end of the second function (next top-level function or comment block)
      const endMarker = '\n\n  // ── Interview Prep Generator';
      const endIdx = code.indexOf(endMarker, secondIdx);
      if (endIdx !== -1) {
        code = code.slice(0, secondIdx) + code.slice(endIdx);
        console.log('✓ Removed duplicate handleGmailMultiScan');
        patchCount++;
      }
    }
  }
}

// ── FIX 3: Remove second duplicate generateInterviewPrep declaration ─────────
const prepMatches = (code.match(/async function generateInterviewPrep/g) || []).length;
console.log(`  Found ${prepMatches} generateInterviewPrep declarations`);

if (prepMatches >= 2) {
  const marker = '  // ── Interview Prep Generator ─────────────────────────────────────────────\n  async function generateInterviewPrep';
  const firstIdx = code.indexOf(marker);
  if (firstIdx !== -1) {
    const secondIdx = code.indexOf(marker, firstIdx + 100);
    if (secondIdx !== -1) {
      const endMarker = '\n\n  // ── Follow-Up Draft Generator';
      const endIdx = code.indexOf(endMarker, secondIdx);
      if (endIdx !== -1) {
        code = code.slice(0, secondIdx) + code.slice(endIdx);
        console.log('✓ Removed duplicate generateInterviewPrep');
        patchCount++;
      }
    }
  }
}

// ── FIX 4: Remove second duplicate generateFollowUp declaration ──────────────
const followMatches = (code.match(/async function generateFollowUp/g) || []).length;
console.log(`  Found ${followMatches} generateFollowUp declarations`);

if (followMatches >= 2) {
  const marker = '  // ── Follow-Up Draft Generator ─────────────────────────────────────────────\n  async function generateFollowUp';
  const firstIdx = code.indexOf(marker);
  if (firstIdx !== -1) {
    const secondIdx = code.indexOf(marker, firstIdx + 100);
    if (secondIdx !== -1) {
      const endMarker = '\n\n  // ── Salary Benchmark';
      const endIdx = code.indexOf(endMarker, secondIdx);
      if (endIdx !== -1) {
        code = code.slice(0, secondIdx) + code.slice(endIdx);
        console.log('✓ Removed duplicate generateFollowUp');
        patchCount++;
      }
    }
  }
}

// ── FIX 5: Remove second duplicate getSalaryBenchmark declaration ────────────
const salaryMatches = (code.match(/async function getSalaryBenchmark/g) || []).length;
console.log(`  Found ${salaryMatches} getSalaryBenchmark declarations`);

if (salaryMatches >= 2) {
  const marker = '  // ── Salary Benchmark ──────────────────────────────────────────────────────\n  async function getSalaryBenchmark';
  const firstIdx = code.indexOf(marker);
  if (firstIdx !== -1) {
    const secondIdx = code.indexOf(marker, firstIdx + 100);
    if (secondIdx !== -1) {
      const endMarker = '\n\n  // ── Gmail Multi-Category Scanner';
      const endIdx = code.indexOf(endMarker, secondIdx);
      if (endIdx !== -1) {
        code = code.slice(0, secondIdx) + code.slice(endIdx);
        console.log('✓ Removed duplicate getSalaryBenchmark');
        patchCount++;
      } else {
        // Try alternate end marker
        const endMarker2 = '\n\n  // ── URL Scraper';
        const endIdx2 = code.indexOf(endMarker2, secondIdx);
        if (endIdx2 !== -1) {
          code = code.slice(0, secondIdx) + code.slice(endIdx2);
          console.log('✓ Removed duplicate getSalaryBenchmark (alt)');
          patchCount++;
        }
      }
    }
  }
}

// ── FIX 6: Remove duplicate LOGIN WELCOME SUMMARY useEffect ─────────────────
const loginSummaryMatches = (code.match(/\/\/ ── LOGIN WELCOME SUMMARY/g) || []).length;
console.log(`  Found ${loginSummaryMatches} LOGIN WELCOME SUMMARY useEffects`);

if (loginSummaryMatches >= 2) {
  const marker = '  // ── AUTO GMAIL MULTI-SCAN on login ──────────────────────────────────────────\n  // Scans 5 categories simultaneously on first load of the day\n  useEffect(() => {\n    if (!clientId || jobs.length === 0) return;\n    if (localStorage.getItem("lastGmailScan") === todayStr()) return;\n    // Silently scan all email categories in the background\n    handleGmailMultiScan(true);\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [jobs.length > 0 ? 1 : 0]);\n\n  // ── LOGIN WELCOME SUMMARY ───────────────────────────────────────────────────\n  useEffect(() => {\n    if (jobs.length === 0) return;\n    const lastVisit = localStorage.getItem("lastVisitDate");';
  
  const firstIdx = code.indexOf(marker);
  if (firstIdx !== -1) {
    const secondIdx = code.indexOf(marker, firstIdx + 100);
    if (secondIdx !== -1) {
      // Find end of the second block
      const endMarker = '\n\n  // ── Send Job Digest';
      const endIdx = code.indexOf(endMarker, secondIdx);
      if (endIdx !== -1) {
        code = code.slice(0, secondIdx) + code.slice(endIdx);
        console.log('✓ Removed duplicate AUTO GMAIL + LOGIN SUMMARY useEffects');
        patchCount++;
      }
    }
  }
}

// ── FIX 7: Duplicate INTERVIEW PREP MODAL JSX ───────────────────────────────
const modalMatches = (code.match(/\{\/\* ── INTERVIEW PREP MODAL ── \*\/\}/g) || []).length;
console.log(`  Found ${modalMatches} INTERVIEW PREP MODAL JSX blocks`);

if (modalMatches >= 2) {
  // Find and remove the duplicate modal blocks at the end
  const marker = `      {/* ── INTERVIEW PREP MODAL ── */}
      {interviewPrepJob && (`;
  const firstIdx = code.indexOf(marker);
  if (firstIdx !== -1) {
    const secondIdx = code.indexOf(marker, firstIdx + 100);
    if (secondIdx !== -1) {
      // Find the end of the duplicate section (closing of the component)
      const endMarker = '\n    </div>\n  );\n}';
      // The second set of duplicate modals goes to the end of the return
      // Remove everything from secondIdx up to end of file (keeping the closing tags)
      const closingTags = '\n    </div>\n  );\n}';
      const closingIdx = code.lastIndexOf(closingTags);
      if (closingIdx > secondIdx) {
        code = code.slice(0, secondIdx) + closingTags;
        console.log('✓ Removed duplicate Interview Prep + Follow-Up modal JSX');
        patchCount++;
      }
    }
  }
}

// ── Write fixed file ─────────────────────────────────────────────────────────
fs.writeFileSync(filePath, code, 'utf-8');

const newLength = code.length;
console.log(`\n✅ Applied ${patchCount} fixes`);
console.log(`   File: ${Math.round(originalLength/1024)}KB → ${Math.round(newLength/1024)}KB`);
console.log('\nNow run: npm run dev');
console.log('The blank page after login should be fixed.');
