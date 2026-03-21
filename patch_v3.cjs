// patch_v3.cjs — Run with: node patch_v3.cjs
// NEW FEATURES:
// 1. Auto Gmail scan on login — scans 5 email categories simultaneously (interviews, offers, rejections, confirmations, follow-ups)
// 2. Login welcome summary banner — shows stats since last visit
// 3. Interview prep AI — generates likely questions for Interview-stage jobs
// 4. Smart duplicate detection — warns when adding a job that already exists
// 5. Follow-up draft generator — AI writes follow-up for Applied jobs
// 6. Salary benchmark — AI estimates salary range for role + location

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'Dashboard.jsx');
if (!fs.existsSync(filePath)) {
  console.error('❌ src/Dashboard.jsx not found. Run from project root.');
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf-8');
let patchCount = 0;

function patch(name, from, to) {
  if (code.includes(from)) {
    code = code.replace(from, to);
    console.log(`✓ ${name}`);
    patchCount++;
    return true;
  }
  console.warn(`⚠ ${name} — marker not found (may already be applied or code differs)`);
  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 1: Add auto Gmail multi-scan on login + login summary state
// Insert after the job digest useEffect
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Auto Gmail multi-scan on login + login summary state',
  `  // ── Auto daily job search ─────────────────────────────────────────────────
  useEffect(() => {
    if (!autoJobSearch || !reportEmail) return;
    const check = () => {
      const lastSent = localStorage.getItem("lastDigestDate");
      if (lastSent === todayStr()) return;
      const [h, m] = jobSearchTime.split(":").map(Number);
      const now = new Date();
      if (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)) {
        handleSendJobDigest(true);
      }
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [autoJobSearch, reportEmail, jobSearchTime, jobSearchKeywords, jobSearchLocation]);`,

  `  // Auto-send job digest ONCE on login (jobs loaded)
  useEffect(() => {
    if (!autoJobSearch || !reportEmail || jobs.length === 0) return;
    if (localStorage.getItem("lastDigestDate") === todayStr()) return;
    handleSendJobDigest(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length > 0 ? 1 : 0]);

  // ── AUTO GMAIL MULTI-SCAN on login ──────────────────────────────────────────
  // Scans 5 categories simultaneously on first load of the day
  useEffect(() => {
    if (!googleClientId || jobs.length === 0) return;
    if (localStorage.getItem("lastGmailScan") === todayStr()) return;
    // Silently scan all email categories in the background
    handleGmailMultiScan(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length > 0 ? 1 : 0]);

  // ── LOGIN WELCOME SUMMARY ───────────────────────────────────────────────────
  useEffect(() => {
    if (jobs.length === 0) return;
    const lastVisit = localStorage.getItem("lastVisitDate");
    const today = todayStr();
    if (lastVisit === today) return;
    // Build summary of current state
    const interviews = jobs.filter(j => j.status === "Interview").length;
    const offers = jobs.filter(j => j.status === "Offer").length;
    const deadlineSoon = jobs.filter(j => {
      const d = daysDiff(j.deadline);
      return d !== null && d >= 0 && d <= 3 && j.status !== "Rejected" && j.status !== "Withdrawn";
    }).length;
    const followUpDue = jobs.filter(j => {
      if (j.status !== "Applied") return false;
      const applied = j.applieddate ? new Date(j.applieddate) : null;
      if (!applied) return false;
      return (Date.now() - applied.getTime()) / 86400000 >= 7;
    }).length;
    if (interviews || offers || deadlineSoon || followUpDue) {
      setLoginSummary({ visible: true, interviews, offers, deadlineSoon, followUpDue });
    }
    localStorage.setItem("lastVisitDate", today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length > 0 ? 1 : 0]);`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 2: Add loginSummary state variable
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'loginSummary state + interviewPrep + salaryBenchmark state',
  `  const [sq, setSq] = useState(""); const [sr, setSr] = useState([]);`,
  `  // Login summary + new feature states
  const [loginSummary, setLoginSummary] = useState({ visible: false, interviews: 0, offers: 0, deadlineSoon: 0, followUpDue: 0 });
  const [interviewPrepJob, setInterviewPrepJob] = useState(null);
  const [interviewPrepResult, setInterviewPrepResult] = useState('');
  const [interviewPrepLoading, setInterviewPrepLoading] = useState(false);
  const [followUpJob, setFollowUpJob] = useState(null);
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [salaryBenchmark, setSalaryBenchmark] = useState(null);
  const [salaryLoading, setSalaryLoading] = useState(false);

  const [sq, setSq] = useState(""); const [sr, setSr] = useState([]);`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 3: Add handleGmailMultiScan function (multi-category Gmail scan)
// Insert before the URL Scraper section
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'handleGmailMultiScan function',
  `  // ── URL Scraper ───────────────────────────────────────────────────────`,
  `  // ── Gmail Multi-Category Scanner (5 categories simultaneously) ──────────
  async function handleGmailMultiScan(silent = false) {
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
      );

      // 5 search queries run in parallel
      const GMAIL_QUERIES = [
        { label: "Interview Scheduled",   q: "subject:(interview scheduled OR interview invitation OR interview confirmed) from:(careers OR jobs OR hiring OR hr OR noreply OR talent)" },
        { label: "Offer Received",        q: "subject:(offer letter OR job offer OR we would like to offer OR pleased to offer) from:(careers OR jobs OR hiring OR hr)" },
        { label: "Rejected",              q: "subject:(regret OR unfortunately OR not moving forward OR not selected OR other candidates) from:(careers OR jobs OR hiring OR hr OR noreply)" },
        { label: "Applied",               q: "subject:(application received OR thank you for applying OR we received your application OR application submitted) from:(careers OR jobs OR noreply)" },
        { label: "Screening",             q: "subject:(screening call OR phone screen OR initial interview OR recruiter would like) from:(careers OR jobs OR hiring OR recruiter OR talent)" },
      ];

      // Fetch all 5 in parallel
      const results = await Promise.allSettled(
        GMAIL_QUERIES.map(({ label, q }) =>
          fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${encodeURIComponent(q + " newer_than:14d")}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
            .then(r => r.json())
            .then(data => ({ label, messages: data.messages || [] }))
            .catch(() => ({ label, messages: [] }))
        )
      );

      const allMessages = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          allMessages.push(...result.value.messages.map(m => ({ ...m, category: result.value.label })));
        }
      }

      if (!allMessages.length) {
        if (!silent) notify("No new job-related emails found in the last 14 days.");
        localStorage.setItem("lastGmailScan", todayStr());
        return;
      }

      // Fetch email details (up to 15 emails)
      const detailsToFetch = allMessages.slice(0, 15);
      const emailDetails = await Promise.allSettled(
        detailsToFetch.map(msg =>
          fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
            .then(r => r.json())
            .then(data => {
              const headers = data.payload?.headers || [];
              const get = (n) => headers.find(h => h.name === n)?.value || "";
              return { id: msg.id, subject: get("Subject"), from: get("From"), date: get("Date"), category: msg.category };
            })
            .catch(() => null)
        )
      );

      const emails = emailDetails
        .filter(r => r.status === "fulfilled" && r.value)
        .map(r => r.value);

      if (!emails.length) {
        localStorage.setItem("lastGmailScan", todayStr());
        return;
      }

      // Match emails to existing jobs and update statuses
      let updatedCount = 0;
      let newCount = 0;
      const updates = [];

      for (const email of emails) {
        const fromDomain = email.from.match(/@([a-zA-Z0-9.-]+)/)?.[1] || "";
        const subjectLow = email.subject.toLowerCase();

        // Try to match to existing job
        const matchedJob = jobs.find(j => {
          const company = (j.company || "").toLowerCase();
          const fromLow = email.from.toLowerCase();
          return (
            (company && fromLow.includes(company.replace(/\s+/g, ""))) ||
            (company.split(/\s+/)[0] && fromDomain.includes(company.split(/\s+/)[0])) ||
            (j.applylink && fromDomain && j.applylink.includes(fromDomain))
          );
        });

        if (matchedJob && matchedJob.status !== email.category) {
          // Only update to more advanced status
          const statusOrder = ["Bookmarked", "Applied", "Screening", "Interview", "Offer", "Rejected", "Withdrawn"];
          const currentIdx = statusOrder.indexOf(matchedJob.status);
          const newIdx = statusOrder.indexOf(email.category);
          if (newIdx > currentIdx || email.category === "Rejected" || email.category === "Offer") {
            updates.push({ ...matchedJob, status: email.category, notes: (matchedJob.notes || "") + `\n[Email ${new Date(email.date).toLocaleDateString()}] ${email.subject}` });
            updatedCount++;
          }
        } else if (!matchedJob) {
          // New job from email — extract company from sender
          const company = email.from.match(/^"?([^"<]+)"?\s*</)?.[1]?.trim() || fromDomain || "Unknown";
          const newJob = {
            title: email.subject.replace(/re:/i, "").trim().slice(0, 80),
            company: company.slice(0, 50),
            status: email.category,
            notes: `[Imported from Gmail ${new Date(email.date).toLocaleDateString()}]\n${email.subject}`,
            source: "Gmail Scan",
            applieddate: email.category === "Applied" ? new Date(email.date).toISOString().split("T")[0] : "",
            location: "", type: "Full-time", salary: "", skills: "", deadline: "", priority: "Medium", applylink: "",
          };
          newCount++;
          // Save to Supabase
          const { error } = await supabase.from("jobs").insert({ ...newJob, user_id: session.user.id });
          if (!error) setJobs(prev => [{ ...newJob, id: Date.now().toString() }, ...prev]);
        }
      }

      // Batch update matched jobs
      for (const upd of updates) {
        await supabase.from("jobs").update({ status: upd.status, notes: upd.notes }).eq("id", upd.id).eq("user_id", session.user.id);
        setJobs(prev => prev.map(j => j.id === upd.id ? { ...j, status: upd.status, notes: upd.notes } : j));
      }

      localStorage.setItem("lastGmailScan", todayStr());

      const summary = [];
      if (updatedCount) summary.push(`${updatedCount} status${updatedCount > 1 ? "es" : ""} updated`);
      if (newCount) summary.push(`${newCount} new job${newCount > 1 ? "s" : ""} added`);
      const msg = summary.length ? `✅ Gmail scan: ${summary.join(", ")}` : "✅ Gmail scan done — no changes needed";
      notify(msg);

    } catch (err) {
      if (!silent) notify(`Gmail scan error: ${err.message}`, "err");
      console.error("Gmail multi-scan:", err);
    }
  }

  // ── URL Scraper ───────────────────────────────────────────────────────`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 4: Interview prep AI function
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Interview prep AI function',
  `  // ── URL Scraper ───────────────────────────────────────────────────────`,
  `  // ── Interview Prep Generator ─────────────────────────────────────────────
  async function generateInterviewPrep(job) {
    if (!AI) return notify("AI not configured — add API key in ⚙️ Settings", "err");
    setInterviewPrepJob(job);
    setInterviewPrepResult('');
    setInterviewPrepLoading(true);
    try {
      const result = await AI(
        \`Generate 8-10 highly specific interview questions for this role. Include:
- 3 technical/role-specific questions based on the job requirements
- 2 behavioral questions (STAR format)
- 2 company/culture fit questions
- 1-2 questions the candidate should ask the interviewer

Role: \${job.title} at \${job.company}
Skills/Requirements: \${job.skills || "Not specified"}
Job Notes: \${(job.notes || "").slice(0, 400)}

Format each question clearly numbered. Add a brief tip for each.\`,
        "You are an expert interview coach. Provide practical, specific interview prep. Plain text only, no markdown."
      );
      setInterviewPrepResult(result.trim());
      notify("✓ Interview prep ready!");
    } catch (err) { notify("AI error: " + err.message, "err"); }
    setInterviewPrepLoading(false);
  }

  // ── Follow-Up Draft Generator ─────────────────────────────────────────────
  async function generateFollowUp(job) {
    if (!AI) return notify("AI not configured — add API key in ⚙️ Settings", "err");
    setFollowUpJob(job);
    setFollowUpDraft('');
    setFollowUpLoading(true);
    try {
      const appliedDate = job.applieddate ? new Date(job.applieddate).toLocaleDateString("en-IN", { day: "numeric", month: "long" }) : "recently";
      const name = profile?.full_name || "the candidate";
      const result = await AI(
        \`Write a professional follow-up email for a job application.
Role: \${job.title} at \${job.company}
Applied: \${appliedDate}
Applicant: \${name}

Write a concise, friendly follow-up email (3-4 short paragraphs):
1. Opening — who you are, what role you applied for
2. Brief reinforcement of interest and one key qualification
3. Request for status update
4. Professional closing
Plain text only. No markdown.\`,
        "Expert career coach. Write professional, warm follow-up emails that get responses."
      );
      setFollowUpDraft(result.trim());
      notify("✓ Follow-up draft ready!");
    } catch (err) { notify("AI error: " + err.message, "err"); }
    setFollowUpLoading(false);
  }

  // ── Salary Benchmark ──────────────────────────────────────────────────────
  async function getSalaryBenchmark(title, location) {
    if (!AI) return notify("AI not configured", "err");
    setSalaryLoading(true);
    setSalaryBenchmark(null);
    try {
      const result = await AI(
        \`Provide a salary benchmark estimate for: "\${title}" in "\${location || "India"}".
Return ONLY valid JSON:
{"min_lpa": number, "max_lpa": number, "mid_lpa": number, "currency": "INR", "level": "fresher/junior/mid/senior", "notes": "brief 1-line market context"}\`,
        "Return ONLY valid JSON. Provide realistic current market rates."
      );
      const match = result.replace(/\`\`\`json|\`\`\`/g, '').trim().match(/\{[\s\S]*\}/);
      if (match) setSalaryBenchmark(JSON.parse(match[0]));
    } catch (err) { console.error("Salary benchmark:", err); }
    setSalaryLoading(false);
  }

  // ── URL Scraper ───────────────────────────────────────────────────────`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 5: Smart duplicate detection in saveJob
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Smart duplicate detection in saveJob',
  `  async function saveJob(e) {
    e.preventDefault();`,
  `  async function saveJob(e) {
    e.preventDefault();
    // Smart duplicate detection — check before saving new job
    if (!editId && form.company && form.title) {
      const titleLow = form.title.toLowerCase();
      const companyLow = form.company.toLowerCase();
      const duplicate = jobs.find(j =>
        j.company?.toLowerCase() === companyLow &&
        (j.title?.toLowerCase().includes(titleLow.split(" ")[0]) || titleLow.includes(j.title?.toLowerCase().split(" ")[0] || ""))
      );
      if (duplicate) {
        const proceed = window.confirm(
          \`⚠️ Possible duplicate detected!\n\nYou already have "\${duplicate.title}" at "\${duplicate.company}" with status "\${duplicate.status}".\n\nAdd anyway?\`
        );
        if (!proceed) return;
      }
    }`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 6: Login welcome summary banner JSX (add near top of Dashboard JSX)
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Login summary banner JSX',
  `      {/* Main content */}
      <main style={{`,
  `      {/* ── LOGIN WELCOME SUMMARY BANNER ── */}
      {loginSummary.visible && (
        <div style={{ background: 'linear-gradient(90deg,rgba(79,70,229,0.12),rgba(6,182,212,0.08))', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18 }}>👋</span>
            <span style={{ color: '#a5b4fc', fontWeight: 700, fontSize: 13 }}>Welcome back!</span>
            {loginSummary.interviews > 0 && <span style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>🎙 {loginSummary.interviews} Interview{loginSummary.interviews > 1 ? "s" : ""}</span>}
            {loginSummary.offers > 0 && <span style={{ background: 'rgba(253,224,71,0.12)', border: '1px solid rgba(253,224,71,0.25)', color: '#fde047', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>🏆 {loginSummary.offers} Offer{loginSummary.offers > 1 ? "s" : ""}</span>}
            {loginSummary.deadlineSoon > 0 && <span style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>⚠️ {loginSummary.deadlineSoon} Deadline{loginSummary.deadlineSoon > 1 ? "s" : ""} soon</span>}
            {loginSummary.followUpDue > 0 && <span style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>📧 {loginSummary.followUpDue} Follow-up{loginSummary.followUpDue > 1 ? "s" : ""} due</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => handleGmailMultiScan(false)} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700 }}>📧 Scan Gmail</button>
            <button onClick={() => setLoginSummary(s => ({ ...s, visible: false }))} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main style={{`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 7: Add Interview Prep & Follow-Up buttons to job row actions
// (In the table view job actions)
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Interview prep and follow-up buttons in job detail/actions',
  `                          {job.status === "Interview" && <Btn v="grn" onClick={() => handleAutoApply(job)} sx={{ fontSize: 10, padding: '3px 8px' }}>🎙 Prep</Btn>}`,
  `                          {job.status === "Interview" && <Btn v="grn" onClick={() => generateInterviewPrep(job)} sx={{ fontSize: 10, padding: '3px 8px' }}>🎙 Prep</Btn>}
                          {job.status === "Applied" && <Btn v="yel" onClick={() => generateFollowUp(job)} sx={{ fontSize: 10, padding: '3px 8px' }}>📧 Follow-up</Btn>}`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 8: Salary benchmark button in Add/Edit modal
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Salary benchmark in Add/Edit modal',
  `          <div><label>Salary</label><Inp value={form.salary} onChange={e=>setForm(f=>({...f,salary:e.target.value}))} placeholder="e.g. ₹8–12 LPA"/></div>`,
  `          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <label>Salary</label>
              {(form.title||form.location) && (
                <button type="button" onClick={() => getSalaryBenchmark(form.title, form.location)}
                  style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', color:'#a5b4fc', borderRadius:6, padding:'2px 8px', cursor:'pointer', fontSize:10, fontFamily:'inherit' }}>
                  {salaryLoading ? '…' : '💡 Benchmark'}
                </button>
              )}
            </div>
            <Inp value={form.salary} onChange={e=>setForm(f=>({...f,salary:e.target.value}))} placeholder="e.g. ₹8–12 LPA"/>
            {salaryBenchmark && !salaryLoading && (
              <div style={{ marginTop:4, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:8, padding:'8px 12px', fontSize:11 }}>
                <span style={{ color:'#a5b4fc', fontWeight:700 }}>Market: </span>
                <span style={{ color:'#e2e8f0' }}>₹{salaryBenchmark.min_lpa}–{salaryBenchmark.max_lpa} LPA</span>
                <span style={{ color:'#475569', marginLeft:8 }}>({salaryBenchmark.level})</span>
                {salaryBenchmark.notes && <div style={{ color:'#475569', marginTop:3 }}>{salaryBenchmark.notes}</div>}
                <button type="button" onClick={() => setForm(f => ({...f, salary: \`₹\${salaryBenchmark.min_lpa}–\${salaryBenchmark.max_lpa} LPA\`}))}
                  style={{ background:'none', border:'none', color:'#818cf8', cursor:'pointer', fontSize:10, fontFamily:'inherit', marginTop:3, padding:0 }}>
                  ↑ Use this range
                </button>
              </div>
            )}
          </div>`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 9: Interview Prep modal JSX
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Interview prep modal JSX',
  `      {/* Gmail scan modal */}`,
  `      {/* ── INTERVIEW PREP MODAL ── */}
      {interviewPrepJob && (
        <Modal title={\`🎙 Interview Prep — \${interviewPrepJob.title} @ \${interviewPrepJob.company}\`} onClose={() => { setInterviewPrepJob(null); setInterviewPrepResult(''); }}>
          {interviewPrepLoading ? (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'#64748b' }}>
              <div style={{ fontSize:32, marginBottom:12, animation:'spin 1s linear infinite', display:'inline-block' }}>⚙️</div>
              <p>Generating tailored interview questions…</p>
            </div>
          ) : interviewPrepResult ? (
            <>
              <div style={{ whiteSpace:'pre-wrap', color:'#e2e8f0', fontSize:13, lineHeight:1.7, maxHeight:500, overflowY:'auto', padding:'0 2px' }}>
                {interviewPrepResult}
              </div>
              <div style={{ display:'flex', gap:8, marginTop:16 }}>
                <Btn v="vio" onClick={() => generateInterviewPrep(interviewPrepJob)}>🔄 Regenerate</Btn>
                <Btn onClick={() => { navigator.clipboard?.writeText(interviewPrepResult); notify('Copied!'); }}>📋 Copy</Btn>
              </div>
            </>
          ) : (
            <div style={{ textAlign:'center', padding:'40px 20px' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🎙</div>
              <p style={{ color:'#64748b', marginBottom:16 }}>AI will generate role-specific questions for this interview</p>
              <Btn v="grn" onClick={() => generateInterviewPrep(interviewPrepJob)}>Generate Interview Questions</Btn>
            </div>
          )}
        </Modal>
      )}

      {/* ── FOLLOW-UP DRAFT MODAL ── */}
      {followUpJob && (
        <Modal title={\`📧 Follow-Up Email — \${followUpJob.title} @ \${followUpJob.company}\`} onClose={() => { setFollowUpJob(null); setFollowUpDraft(''); }}>
          {followUpLoading ? (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'#64748b' }}>
              <div style={{ fontSize:32, marginBottom:12, animation:'spin 1s linear infinite', display:'inline-block' }}>✉️</div>
              <p>Writing your follow-up email…</p>
            </div>
          ) : followUpDraft ? (
            <>
              <Txt value={followUpDraft} onChange={e => setFollowUpDraft(e.target.value)} rows={10} style={{ fontSize:13, lineHeight:1.7 }}/>
              <div style={{ display:'flex', gap:8, marginTop:12 }}>
                <Btn v="vio" onClick={() => generateFollowUp(followUpJob)}>🔄 Regenerate</Btn>
                <Btn onClick={() => { navigator.clipboard?.writeText(followUpDraft); notify('Copied!'); }}>📋 Copy</Btn>
                {reportEmail && googleClientId && <Btn v="grn" onClick={async () => {
                  try {
                    const token = await getGoogleToken("https://www.googleapis.com/auth/gmail.send", session, googleClientId);
                    const toEmail = extractEmailFromJob(followUpJob) || "";
                    if (!toEmail) return notify("No email found for this job — copy and send manually.", "err");
                    const html = \`<html><body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:auto;padding:40px 20px"><pre style="white-space:pre-wrap;font-family:inherit">\${followUpDraft}</pre></body></html>\`;
                    await sendEmailViaGmail(toEmail, \`Follow-up: \${followUpJob.title} Application\`, html, token);
                    notify("✅ Follow-up sent via Gmail!");
                    setFollowUpJob(null); setFollowUpDraft('');
                  } catch(err) { notify("Send error: " + err.message, "err"); }
                }}>📤 Send via Gmail</Btn>}
              </div>
            </>
          ) : (
            <div style={{ textAlign:'center', padding:'40px 20px' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📧</div>
              <p style={{ color:'#64748b', marginBottom:16 }}>AI will write a professional follow-up email for this application</p>
              <Btn v="yel" onClick={() => generateFollowUp(followUpJob)}>Generate Follow-Up Email</Btn>
            </div>
          )}
        </Modal>
      )}

      {/* Gmail scan modal */}`
);

// ══════════════════════════════════════════════════════════════════════════════
// PATCH 10: Add "Scan Gmail" button to the header toolbar
// ══════════════════════════════════════════════════════════════════════════════
patch(
  'Scan Gmail button in header',
  `            {activeTab === "gmail" && <Btn v="pri" onClick={() => setShowGmailScan(true)} sx={{ gap: 6 }}>📧 Scan Gmail</Btn>}`,
  `            {activeTab === "gmail" && <Btn v="pri" onClick={() => setShowGmailScan(true)} sx={{ gap: 6 }}>📧 Scan Gmail</Btn>}
            {activeTab === "gmail" && <Btn onClick={() => handleGmailMultiScan(false)} sx={{ gap: 6, background:'rgba(6,182,212,0.1)', border:'1px solid rgba(6,182,212,0.2)', color:'#67e8f9' }}>⚡ Quick Scan All</Btn>}`
);

// ══════════════════════════════════════════════════════════════════════════════
// DONE
// ══════════════════════════════════════════════════════════════════════════════
fs.writeFileSync(filePath, code, 'utf-8');
const stats = fs.statSync(filePath);
console.log(`\n✅ Applied ${patchCount}/10 patches`);
console.log(`   File: ${Math.round(stats.size / 1024)}KB`);
console.log(`\nNew features added:`);
console.log(`  📧 Auto Gmail multi-scan on login (5 categories in parallel)`);
console.log(`  👋 Login welcome summary banner`);
console.log(`  🎙 Interview prep AI (tailored questions per job)`);
console.log(`  📧 Follow-up email draft generator`);
console.log(`  💡 Salary benchmark AI`);
console.log(`  ⚠️ Smart duplicate detection`);
