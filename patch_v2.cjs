// patch_v2.cjs — Run with: node patch_v2.cjs
// Applies 6 changes to src/Dashboard.jsx:
// 1. CityChips component (multi-city search)
// 2. sCities + aiExtract state vars
// 3. Auto-send once on login (not setInterval)
// 4. aiExtractJob function
// 5. Multi-city doSearch
// 6. AI Extract section in Add Job modal
// 7. CityChips in Search modal

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'Dashboard.jsx');
if (!fs.existsSync(filePath)) {
  console.error('❌ src/Dashboard.jsx not found. Run from project root.');
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf-8');
const orig = code.length;
let patchCount = 0;

function patch(name, from, to) {
  if (code.includes(from)) {
    code = code.replace(from, to);
    console.log(`✓ ${name}`);
    patchCount++;
  } else {
    console.warn(`⚠ ${name} — marker not found (may already be applied)`);
  }
}

// ══════════════════════════════════════════════════════════════
// PATCH 1: CityChips component — insert before export default Dashboard
// ══════════════════════════════════════════════════════════════
patch(
  'CityChips component',
  '// ═══════════════════════════════════════════════════════════════════\nexport default function Dashboard',
  `// ── CityChips: multi-city tag input ──────────────────────────────────────────
const CityChips = ({ value, onChange }) => {
  const [ccInput, setCcInput] = useState('');
  const ccRef = useRef();
  const cities = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];

  const addCity = (raw) => {
    const parts = raw.split(/[,\\n]+/).map(s => s.trim()).filter(Boolean);
    onChange([...new Set([...cities, ...parts])].join(', '));
    setCcInput('');
  };
  const removeCity = (i) => onChange(cities.filter((_, idx) => idx !== i).join(', '));

  return (
    <div onClick={() => ccRef.current?.focus()}
      style={{ display:'flex', flexWrap:'wrap', gap:6, padding:'8px 10px',
        background:'#070f1c', border:'1px solid #1e2d45', borderRadius:8,
        cursor:'text', minHeight:44, alignItems:'center' }}>
      {cities.map((c, i) => (
        <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:4,
          background:'rgba(6,182,212,0.12)', border:'1px solid rgba(6,182,212,0.3)',
          color:'#67e8f9', padding:'3px 10px', borderRadius:999, fontSize:12, fontWeight:600 }}>
          📍 {c}
          <button onClick={e => { e.stopPropagation(); removeCity(i); }}
            style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:13, padding:'0 0 0 2px' }}>×</button>
        </span>
      ))}
      <input ref={ccRef} value={ccInput} onChange={e => setCcInput(e.target.value)}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ',') && ccInput.trim()) { e.preventDefault(); addCity(ccInput); }
          if (e.key === 'Backspace' && !ccInput && cities.length) removeCity(cities.length - 1);
        }}
        onBlur={() => ccInput.trim() && addCity(ccInput)}
        placeholder={cities.length === 0 ? 'Add cities, e.g. Chennai, Bangalore, Remote…' : ''}
        style={{ background:'none', border:'none', outline:'none', color:'#e2e8f0',
          fontSize:12, fontFamily:'inherit', flex:1, minWidth:180 }} />
      {cities.length > 0 && <span style={{ fontSize:10, color:'#334155', marginLeft:'auto' }}>{cities.length} {cities.length===1?'city':'cities'}</span>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
export default function Dashboard`
);

// ══════════════════════════════════════════════════════════════
// PATCH 2: Add sCities + aiExtract state
// ══════════════════════════════════════════════════════════════
patch(
  'sCities + aiExtract state',
  `  const [sq, setSq] = useState(""); const [sr, setSr] = useState([]);`,
  `  // Multi-city search state
  const [sCities, setSCities] = useState(() => localStorage.getItem("sCities") || "");
  // AI Extract on Add
  const [aiExtractNotes, setAiExtractNotes] = useState("");
  const [aiExtractLoading, setAiExtractLoading] = useState(false);

  const [sq, setSq] = useState(""); const [sr, setSr] = useState([]);`
);

// ══════════════════════════════════════════════════════════════
// PATCH 3a: Auto report — once on login not setInterval
// ══════════════════════════════════════════════════════════════
patch(
  'Auto report — once on login',
  `  // FIX: Auto daily report — use setInterval to check every minute instead of firing once
  useEffect(() => {
    if (!autoReport || !reportEmail) return;
    const check = () => {
      const lastSent = localStorage.getItem("lastReportDate");
      if (lastSent === todayStr()) return;
      const [h, m] = reportTime.split(":").map(Number);
      const now = new Date();
      if (now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)) {
        if (jobs.length > 0) handleSendReport(true);
      }
    };
    check(); // also check immediately on mount
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [autoReport, reportEmail, reportTime, jobs.length]);`,
  `  // Auto-send progress report ONCE when jobs first load after login
  useEffect(() => {
    if (!autoReport || !reportEmail || jobs.length === 0) return;
    if (localStorage.getItem("lastReportDate") === todayStr()) return;
    handleSendReport(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length > 0 ? 1 : 0]);`
);

// ══════════════════════════════════════════════════════════════
// PATCH 3b: Auto job digest — once on login not setInterval
// ══════════════════════════════════════════════════════════════
patch(
  'Auto job digest — once on login',
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
  `  // Auto-send job digest ONCE when jobs first load after login
  useEffect(() => {
    if (!autoJobSearch || !reportEmail || jobs.length === 0) return;
    if (localStorage.getItem("lastDigestDate") === todayStr()) return;
    handleSendJobDigest(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length > 0 ? 1 : 0]);`
);

// ══════════════════════════════════════════════════════════════
// PATCH 4: aiExtractJob function — insert before URL scraper
// ══════════════════════════════════════════════════════════════
patch(
  'aiExtractJob function',
  `  // ── URL Scraper ───────────────────────────────────────────────────────`,
  `  // ── AI Extract job from pasted description ───────────────────────────────
  async function aiExtractJob() {
    if (!aiExtractNotes.trim()) return notify("Paste a job description first", "err");
    setAiExtractLoading(true);
    try {
      const result = await AI(
        \`Extract all job details from this description. Return ONLY valid JSON with these exact keys:
{"title":"","company":"","location":"","type":"Full-time or Part-time or Internship or Contract or Freelance","salary":"","skills":"comma-separated skills","deadline":"YYYY-MM-DD or empty","notes":"key requirements max 400 chars"}

Job Description:
\${aiExtractNotes.slice(0,5000)}\`,
        "Return ONLY valid JSON. No markdown. Extract all details accurately."
      );
      const clean = result.replace(/\`\`\`json|\`\`\`/g,'').trim();
      const match = clean.match(/\\{[\\s\\S]*\\}/);
      if (!match) throw new Error("Could not parse job data");
      const parsed = JSON.parse(match[0]);
      setForm(f => ({
        ...f,
        ...(parsed.title    && { title:    parsed.title }),
        ...(parsed.company  && { company:  parsed.company }),
        ...(parsed.location && { location: parsed.location }),
        ...(['Full-time','Part-time','Internship','Contract','Freelance'].includes(parsed.type) && { type: parsed.type }),
        ...(parsed.salary   && { salary:   parsed.salary }),
        ...(parsed.skills   && { skills:   parsed.skills }),
        ...(parsed.deadline && { deadline: parsed.deadline }),
        ...(parsed.notes    && { notes:    parsed.notes }),
      }));
      notify("✓ Job details extracted — review and save!");
      setAiExtractNotes("");
    } catch (err) { notify("AI Extract: " + err.message, "err"); }
    setAiExtractLoading(false);
  }

  // ── URL Scraper ───────────────────────────────────────────────────────`
);

// ══════════════════════════════════════════════════════════════
// PATCH 5a: buildAdzunaUrl — accept city param
// ══════════════════════════════════════════════════════════════
patch(
  'buildAdzunaUrl signature',
  '  function buildAdzunaUrl(page = 1) {',
  '  function buildAdzunaUrl(page = 1, cityOverride = \'\') {'
);

patch(
  'buildAdzunaUrl use city param',
  '    if (sLocation.trim()) url += `&where=${encodeURIComponent(sLocation.trim())}`;',
  '    const _city = cityOverride || sLocation.trim();\n    if (_city) url += `&where=${encodeURIComponent(_city)}`;'
);

// ══════════════════════════════════════════════════════════════
// PATCH 5b: doSearch — multi-city
// ══════════════════════════════════════════════════════════════
patch(
  'doSearch multi-city',
  `  async function doSearch(reset = true) {
    if (!sq.trim() && !sLocation.trim() && !sCategory && !sExperience) { setSErr("Enter a keyword or select filters."); return; }
    if (!adzunaId || !adzunaKey) { setSErr("Add Adzuna credentials in ⚙️ Settings."); return; }
    setSLoad(true); if (reset) { setSr([]); setSErr(""); setSPage(1); setSTotalResults(0); }
    try {
      const page = reset ? 1 : sPage + 1;
      const res = await fetch(buildAdzunaUrl(page));
      if (!res.ok) throw new Error(\`Adzuna error \${res.status}\`);
      const data = await res.json();
      if (!data.results?.length) { setSErr("No results — try different keywords."); setSLoad(false); return; }
      let mapped = mapAdzuna(data.results);
      mapped = filterByExperience(mapped, sExperience);
      if (reset) { setSr(mapped); setSPage(1); } else { setSr(p => [...p, ...mapped]); setSPage(p => p + 1); }
      if (data.count) setSTotalResults(data.count);
    } catch (err) { setSErr(err.message); }
    setSLoad(false);
  }`,
  `  async function doSearch(reset = true) {
    if (!sq.trim() && !sLocation.trim() && !sCities.trim() && !sCategory && !sExperience) {
      setSErr("Enter a keyword, location, or select filters."); return;
    }
    if (!adzunaId || !adzunaKey) { setSErr("Add Adzuna credentials in ⚙️ Settings."); return; }
    setSLoad(true);
    if (reset) { setSr([]); setSErr(""); setSPage(1); setSTotalResults(0); }
    try {
      const cityList = sCities
        ? sCities.split(',').map(c => c.trim()).filter(Boolean)
        : sLocation.trim() ? [sLocation.trim()] : [''];
      const page = reset ? 1 : sPage + 1;
      let allResults = [], totalCount = 0;
      for (const city of cityList) {
        try {
          const res = await fetch(buildAdzunaUrl(page, city));
          if (!res.ok) continue;
          const data = await res.json();
          if (!data.results?.length) continue;
          let mapped = mapAdzuna(data.results);
          mapped = filterByExperience(mapped, sExperience);
          mapped = mapped.map(r => ({ ...r, searchCity: city || 'All India' }));
          allResults = allResults.concat(mapped);
          if (data.count) totalCount += data.count;
        } catch { /* skip failed city */ }
      }
      // Deduplicate by applylink or title+company
      const seen = new Set();
      allResults = allResults.filter(r => {
        const key = r.applylink || \`\${r.title}__\${r.company}\`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
      allResults.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      if (!allResults.length) { setSErr("No results — try different keywords or cities."); setSLoad(false); return; }
      if (reset) { setSr(allResults); setSPage(1); } else { setSr(p => [...p, ...allResults]); setSPage(p => p + 1); }
      if (totalCount) setSTotalResults(totalCount);
      if (sCities) localStorage.setItem("sCities", sCities);
    } catch (err) { setSErr(err.message); }
    setSLoad(false);
  }`
);

// ══════════════════════════════════════════════════════════════
// PATCH 6: AI Extract in Add Job modal
// ══════════════════════════════════════════════════════════════
patch(
  'AI Extract in Add Job modal',
  `      {showAdd && <Modal title={editId ? "✏️ Edit Job" : "＋ Add New Job"} onClose={() => setShowAdd(false)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>`,
  `      {showAdd && <Modal title={editId ? "✏️ Edit Job" : "＋ Add New Job"} onClose={() => setShowAdd(false)}>
        {!editId && (
          <div style={{background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{color:"#a78bfa",fontSize:12,fontWeight:700,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
              🤖 AI Extract from Job Description
              <span style={{background:"rgba(139,92,246,0.12)",border:"1px solid rgba(139,92,246,0.25)",color:"#a78bfa",padding:"1px 8px",borderRadius:999,fontSize:9}}>Auto-fill form</span>
            </div>
            <Txt value={aiExtractNotes} onChange={e=>setAiExtractNotes(e.target.value)}
              placeholder="Paste any job description here — AI extracts title, company, location, skills, salary, deadline and fills the form automatically…" rows={4}/>
            <Btn v="vio" onClick={aiExtractJob} disabled={aiExtractLoading||!aiExtractNotes.trim()}
              sx={{width:"100%",justifyContent:"center",padding:"10px",fontSize:13,marginTop:4}}>
              {aiExtractLoading?<><span style={{animation:"spin 0.8s linear infinite",display:"inline-block"}}>◌</span> Extracting…</>:"🤖 Extract & Fill Form"}
            </Btn>
            <div style={{fontSize:10,color:"#475569",marginTop:8,textAlign:"center"}}>Paste any job posting · AI fills all fields · review before saving</div>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>`
);

// ══════════════════════════════════════════════════════════════
// PATCH 7: Replace location input in search modal with CityChips
// ══════════════════════════════════════════════════════════════
patch(
  'Search modal → CityChips',
  `          <input value={sLocation} onChange={e=>setSLocation(e.target.value)} placeholder="📍 Location" style={{flex:1,minWidth:140,background:"#070f1c",border:"1px solid #1e2d45",borderRadius:8,padding:"9px 12px",color:"#e2e8f0",fontSize:12,outline:"none",fontFamily:"inherit"}}/>`,
  `          <div style={{flex:1,minWidth:220}}>
            <div style={{color:"#475569",fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Search Cities (add multiple)</div>
            <CityChips value={sCities} onChange={v=>{setSCities(v);localStorage.setItem("sCities",v);}}/>
            {sCities&&<button onClick={()=>{setSCities("");localStorage.removeItem("sCities");}} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:10,marginTop:4,fontFamily:"inherit"}}>✕ Clear all cities</button>}
          </div>`
);

// ══════════════════════════════════════════════════════════════
// Done
// ══════════════════════════════════════════════════════════════
fs.writeFileSync(filePath, code, 'utf-8');
const newSize = fs.statSync(filePath).size;
console.log(`\n✅ Applied ${patchCount}/9 patches`);
console.log(`   File: ${Math.round(orig/1024)}KB → ${Math.round(newSize/1024)}KB`);
if (patchCount < 9) {
  console.log('\n⚠ Some patches could not apply — the Dashboard may already have them,');
  console.log('  or the source has a slightly different format. Check warnings above.');
}
