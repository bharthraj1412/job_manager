const fs = require('fs');
let code = fs.readFileSync('src/Dashboard.jsx', 'utf-8');
let patchCount = 0;

function robustReplace(name, searchRegExp, replacer) {
  if (searchRegExp.test(code)) {
    code = code.replace(searchRegExp, replacer);
    console.log('✓ ' + name);
    patchCount++;
  } else {
    console.warn('⚠ ' + name + ' — marker not found');
  }
}

// 1. CityChips component
robustReplace(
  'CityChips component',
  /\/\/\s*[═]+\s*export\s+default\s+function\s+Dashboard/m,
  `// ── CityChips: multi-city tag input ──────────────────────────────────────────
const CityChips = ({ value, onChange }) => {
  const [ccInput, setCcInput] = React.useState('');
  const ccRef = React.useRef();
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

// 2. Add sCities + aiExtract state
robustReplace(
  'sCities + aiExtract state',
  /const\s+\[sq,\s*setSq\]\s*=\s*useState\(['"]{2}\);\s*const\s+\[sr,\s*setSr\]\s*=\s*useState\(\[\]\);/m,
  `  // Multi-city search state
  const [sCities, setSCities] = useState(() => localStorage.getItem("sCities") || "");
  // AI Extract on Add
  const [aiExtractNotes, setAiExtractNotes] = useState("");
  const [aiExtractLoading, setAiExtractLoading] = useState(false);

  const [sq, setSq] = useState(""); const [sr, setSr] = useState([]);`
);

// 3a. Auto report — once on login
robustReplace(
  'Auto report — once on login',
  /\/\/ FIX: Auto daily report — use setInterval up to clear interval[\\s\\S]*?return \(\) => clearInterval\(interval\);\s*\}, \[autoReport, reportEmail, reportTime, jobs\.length\]\);/m,
  `  // Auto-send progress report ONCE when jobs first load after login
  useEffect(() => {
    if (!autoReport || !reportEmail || jobs.length === 0) return;
    if (localStorage.getItem("lastReportDate") === todayStr()) return;
    handleSendReport(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length > 0 ? 1 : 0]);`
);
// fallback for 3a if FIX comment is missing or different:
if (!/lastReportDate/.test(code) || /setInterval\s*\(\s*check\s*,\s*60000\s*\)/.test(code)) {
    code = code.replace(
      /useEffect\(\(\) => \{\s*if \(\!autoReport[\\s\\S]*?clearInterval\(interval\);\s*\}, \[autoReport, reportEmail, reportTime, jobs\.length\]\);/m,
      `  // Auto-send progress report ONCE when jobs first load after login
  useEffect(() => {
    if (!autoReport || !reportEmail || jobs.length === 0) return;
    if (localStorage.getItem("lastReportDate") === todayStr()) return;
    handleSendReport(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length > 0 ? 1 : 0]);`
    );
}

// 3b. Auto job digest — once on login
robustReplace(
  'Auto job digest — once on login',
  /\/\/ ── Auto daily job search[\\s\\S]*?return \(\) => clearInterval\(interval\);\s*\}, \[autoJobSearch, reportEmail, jobSearchTime, jobSearchKeywords, jobSearchLocation\]\);/m,
  `  // Auto-send job digest ONCE when jobs first load after login
  useEffect(() => {
    if (!autoJobSearch || !reportEmail || jobs.length === 0) return;
    if (localStorage.getItem("lastDigestDate") === todayStr()) return;
    handleSendJobDigest(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length > 0 ? 1 : 0]);`
);

// 4. aiExtractJob function
robustReplace(
  'aiExtractJob function',
  /\/\/ ── URL Scraper/m,
  `  // ── AI Extract job from pasted description ───────────────────────────────
  async function aiExtractJob() {
    if (!aiExtractNotes.trim()) return notify("Paste a job description first", "err");
    setAiExtractLoading(true);
    try {
      const result = await callAI(
        \`Extract all job details from this description. Return ONLY valid JSON with these exact keys:
{"title":"","company":"","location":"","type":"Full-time or Part-time or Internship or Contract or Freelance","salary":"","skills":"comma-separated skills","deadline":"YYYY-MM-DD or empty","notes":"key requirements max 400 chars"}

Job Description:
\${aiExtractNotes.slice(0,5000)}\`,
        "Return ONLY valid JSON. No markdown. Extract all details accurately.",
        geminiKey, aiModel, proxyUrl
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

  // ── URL Scraper`
);

// 5a. buildAdzunaUrl signature
robustReplace(
  'buildAdzunaUrl signature',
  /function buildAdzunaUrl\(page\s*=\s*1\)\s*\{/m,
  `function buildAdzunaUrl(page = 1, cityOverride = '') {`
);

// 5a. buildAdzunaUrl use city param
robustReplace(
  'buildAdzunaUrl use city param',
  /if\s*\([\s]*sLocation\.trim\(\)[\s]*\)\s*url\s*\+=\s*`&where=\$\{encodeURIComponent\(sLocation\.trim\(\)\)\}`;/m,
  `const _city = cityOverride || sLocation.trim();\n    if (_city) url += \`&where=\${encodeURIComponent(_city)}\`;`
);

// 5b. doSearch — multi-city
robustReplace(
  'doSearch multi-city',
  /async\s+function\s+doSearch\(reset\s*=\s*true\)\s*\{[\s\S]*?setSLoad\(false\);\s*\}/m,
  `async function doSearch(reset = true) {
    if (!sq.trim() && !sLocation.trim() && !(typeof sCities !== 'undefined' && sCities.trim()) && !sCategory && !sExperience) {
      setSErr("Enter a keyword, location, or select filters."); return;
    }
    if (!adzunaId || !adzunaKey) { setSErr("Add Adzuna credentials in ⚙️ Settings."); return; }
    setSLoad(true);
    if (reset) { setSr([]); setSErr(""); setSPage(1); setSTotalResults(0); }
    try {
      const cityList = typeof sCities !== 'undefined' && sCities
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
          if (typeof filterByExperience !== 'undefined') mapped = filterByExperience(mapped, sExperience);
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
      if (typeof sCities !== 'undefined' && sCities) localStorage.setItem("sCities", sCities);
    } catch (err) { setSErr(err.message); }
    setSLoad(false);
  }`
);

// 6. AI Extract in Add Job modal
robustReplace(
  'AI Extract in Add Job modal',
  /\{showAdd\s*&&\s*<Modal\s+title=\{editId\s*\?\s*"✏️ Edit Job"\s*:\s*"＋ Add New Job"\}\s*onClose=\{\(\)\s*=>\s*setShowAdd\(false\)\}>\s*<div\s+style=\{\{display\s*:\s*"grid",\s*gridTemplateColumns\s*:\s*"1fr 1fr",\s*gap\s*:\s*12\}\}>/m,
  `      {showAdd && <Modal title={editId ? "✏️ Edit Job" : "＋ Add New Job"} onClose={() => setShowAdd(false)}>
        {!editId && (
          <div style={{background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{color:"#a78bfa",fontSize:12,fontWeight:700,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
              🤖 AI Extract from Job Description
              <span style={{background:"rgba(139,92,246,0.12)",border:"1px solid rgba(139,92,246,0.25)",color:"#a78bfa",padding:"1px 8px",borderRadius:999,fontSize:9}}>Auto-fill form</span>
            </div>
            <Txt value={typeof aiExtractNotes !== 'undefined' ? aiExtractNotes : ''} onChange={e=>setAiExtractNotes && setAiExtractNotes(e.target.value)}
              placeholder="Paste any job description here — AI extracts title, company, location, skills, salary, deadline and fills the form automatically…" rows={4}/>
            <Btn v="vio" onClick={typeof aiExtractJob !== 'undefined' ? aiExtractJob : () => {}} disabled={(typeof aiExtractLoading !== 'undefined' && aiExtractLoading)||(typeof aiExtractNotes !== 'undefined' && !aiExtractNotes.trim())}
              sx={{width:"100%",justifyContent:"center",padding:"10px",fontSize:13,marginTop:4}}>
              {typeof aiExtractLoading !== 'undefined' && aiExtractLoading?<><span style={{animation:"spin 0.8s linear infinite",display:"inline-block"}}>◌</span> Extracting…</>:"🤖 Extract & Fill Form"}
            </Btn>
            <div style={{fontSize:10,color:"#475569",marginTop:8,textAlign:"center"}}>Paste any job posting · AI fills all fields · review before saving</div>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>`
);

// 7. Replace location input in search modal with CityChips
robustReplace(
  'Search modal → CityChips',
  /<input\s+value=\{sLocation\}\s+onChange=\{e=>setSLocation\(e\.target\.value\)\}\s+placeholder="📍 Location"\s+style=\{\{flex:1,minWidth:140,background:"#070f1c",border:"1px solid #1e2d45",borderRadius:8,padding:"9px 12px",color:"#e2e8f0",fontSize:12,outline:"none",fontFamily:"inherit"\}\}\/>/m,
  `<div style={{flex:1,minWidth:220}}>
            <div style={{color:"#475569",fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Search Cities (add multiple)</div>
            <CityChips value={typeof sCities !== 'undefined' ? sCities : ''} onChange={v=>{if(typeof setSCities !== 'undefined'){setSCities(v);localStorage.setItem("sCities",v);}}}/>
            {typeof sCities !== 'undefined' && sCities&&<button onClick={()=>{setSCities("");localStorage.removeItem("sCities");}} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:10,marginTop:4,fontFamily:"inherit"}}>✕ Clear all cities</button>}
          </div>`
);

fs.writeFileSync('src/Dashboard.jsx', code, 'utf-8');
console.log('✅ Custom patcher complete.');
