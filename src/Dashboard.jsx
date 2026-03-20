import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import * as XLSX from "xlsx";

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS = ["Bookmarked","Applied","Interview","Offer","Rejected","Withdrawn"];
const SC = {
  Bookmarked:{ bg:"#0f1f35", border:"#1d4ed8", text:"#93c5fd", dot:"#3b82f6" },
  Applied:   { bg:"#0c2236", border:"#0891b2", text:"#67e8f9", dot:"#06b6d4" },
  Interview: { bg:"#0f2518", border:"#16a34a", text:"#86efac", dot:"#22c55e" },
  Offer:     { bg:"#1c1a00", border:"#ca8a04", text:"#fde047", dot:"#eab308" },
  Rejected:  { bg:"#230d0d", border:"#dc2626", text:"#fca5a5", dot:"#ef4444" },
  Withdrawn: { bg:"#141414", border:"#525252", text:"#a3a3a3", dot:"#737373" },
};
const GMAIL_STATUS_COLORS = {
  "Interview Scheduled":{ bg:"rgba(37,99,235,0.18)", fg:"#60a5fa", accent:"#2563eb", lb:"#1e3a8a" },
  "Interview Done":     { bg:"rgba(37,99,235,0.18)", fg:"#60a5fa", accent:"#2563eb", lb:"#1e3a8a" },
  "Offer Received":     { bg:"rgba(16,185,129,0.18)", fg:"#34d399", accent:"#10b981", lb:"#064e3b" },
  "Accepted":           { bg:"rgba(16,185,129,0.18)", fg:"#34d399", accent:"#10b981", lb:"#064e3b" },
  "Rejected":           { bg:"rgba(239,68,68,0.18)", fg:"#f87171", accent:"#ef4444", lb:"#7f1d1d" },
  "Applied":            { bg:"rgba(245,158,11,0.18)", fg:"#fbbf24", accent:"#f59e0b", lb:"#78350f" },
  "Screening":          { bg:"rgba(139,92,246,0.18)", fg:"#a78bfa", accent:"#8b5cf6", lb:"#4c1d95" },
  "Pending":            { bg:"rgba(148,163,184,0.12)", fg:"#94a3b8", accent:"#64748b", lb:"#1e293b" },
};
const TYPES = ["Full-time","Part-time","Internship","Contract","Freelance"];

const ADZUNA_CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "it-jobs", label: "IT / Software" },
  { value: "engineering-jobs", label: "Engineering" },
  { value: "accounting-finance-jobs", label: "Finance / Accounting" },
  { value: "sales-jobs", label: "Sales" },
  { value: "marketing-jobs", label: "Marketing" },
  { value: "hr-jobs", label: "HR / Recruitment" },
  { value: "graduate-jobs", label: "Graduate / Fresher" },
  { value: "healthcare-nursing-jobs", label: "Healthcare" },
  { value: "teaching-jobs", label: "Teaching / Education" },
  { value: "logistics-warehouse-jobs", label: "Logistics" },
  { value: "trade-construction-jobs", label: "Construction" },
  { value: "legal-jobs", label: "Legal" },
  { value: "creative-design-jobs", label: "Design / Creative" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : "—";
const daysDiff = d => d ? Math.ceil((new Date(d)-new Date())/86400000) : null;

const NVIDIA_API_URL  = "/api/ai";
const NVIDIA_API_KEY  = "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";
const NVIDIA_MODEL    = "deepseek-ai/deepseek-r1";

// Extract skills by scanning job description text
function extractSkillsFromText(text) {
  if (!text) return "";
  const SKILL_LIST = [
    "Python","Java","JavaScript","TypeScript","React","Angular","Vue","Node.js","Next.js","Nuxt",
    "SQL","MySQL","PostgreSQL","MongoDB","Redis","Oracle","SQLite","DynamoDB","Firebase",
    "AWS","Azure","GCP","Docker","Kubernetes","Terraform","Jenkins","CI/CD","GitHub Actions",
    "HTML","CSS","SASS","Bootstrap","Tailwind","Webpack","Vite","REST API","GraphQL",
    "PHP","Ruby","Go","Rust","Swift","Kotlin","C++","C#",".NET","Spring Boot","Hibernate",
    "Django","Flask","FastAPI","Express","Laravel","Rails","Microservices","gRPC",
    "Machine Learning","Deep Learning","AI/ML","TensorFlow","PyTorch","NLP","OpenCV","Scikit-learn",
    "Data Science","R","Tableau","Power BI","Excel","Apache Spark","Hadoop","Kafka","Airflow",
    "Linux","Unix","Bash","Shell Scripting","Git","Agile","Scrum","Jira","Confluence",
    "Android","iOS","Flutter","React Native","Unity","Unreal","Figma","Adobe XD","Photoshop",
    "Salesforce","SAP","ERP","Selenium","Cypress","Jest","JUnit","Testing","QA",
    "Networking","CCNA","DevOps","SRE","Security","Cybersecurity","Blockchain","Solidity",
    "AutoCAD","MATLAB","SolidWorks","VLSI","Embedded","Arduino","ROS","PLC",
  ];
  const found = [];
  const lower = text.toLowerCase();
  for (const skill of SKILL_LIST) {
    if (lower.includes(skill.toLowerCase()) && !found.includes(skill)) {
      found.push(skill);
    }
    if (found.length >= 8) break;
  }
  return found.join(", ");
}

// Format salary smartly — Adzuna returns annual numbers for India
function formatSalary(min, max) {
  if (!min) return "Not disclosed";
  const fmt = (n) => {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)} LPA`;
    return `₹${Math.round(n).toLocaleString("en-IN")}`;
  };
  if (max && max !== min) return `${fmt(min)} – ${fmt(max)}`;
  return fmt(min);
}

async function callGemini(prompt, sysprompt="", apiKey=NVIDIA_API_KEY, modelName=NVIDIA_MODEL, proxyUrl=NVIDIA_API_URL) {
  if (!apiKey) throw new Error("API key is required. Please add it in Settings.");
  const messages = [];
  if (sysprompt) messages.push({ role: "system", content: sysprompt });
  messages.push({ role: "user", content: prompt });
  const body = { model: modelName, messages, temperature: 0.6, top_p: 0.7, max_tokens: 4096 };
  const r = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const errorText = await r.text();
    throw new Error(`API Error: ${r.status} ${errorText}`);
  }
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.choices?.[0]?.message?.content || "";
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
const Btn = ({children,onClick,v="def",disabled,sx={}}) => {
  const vs = {
    def:{background:"#0f172a",border:"1px solid #1e293b",color:"#94a3b8"},
    pri:{background:"linear-gradient(135deg,#1d4ed8,#4f46e5)",border:"none",color:"#fff"},
    grn:{background:"linear-gradient(135deg,#064e3b,#065f46)",border:"none",color:"#6ee7b7"},
    amb:{background:"linear-gradient(135deg,#78350f,#92400e)",border:"none",color:"#fde68a"},
    cyn:{background:"linear-gradient(135deg,#164e63,#0e7490)",border:"none",color:"#67e8f9"},
    red:{background:"#0f172a",border:"1px solid #450a0a",color:"#f87171"},
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...vs[v],borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:600,
      cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.55:1,
      display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap",fontFamily:"inherit",...sx
    }}>{children}</button>
  );
};
const Inp = ({value,onChange,placeholder,type="text",sx={}}) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{width:"100%",background:"#0a111e",border:"1px solid #1e293b",borderRadius:8,
      padding:"8px 11px",color:"#e2e8f0",fontSize:13,outline:"none",
      boxSizing:"border-box",fontFamily:"inherit",...sx}}/>
);
const Sel = ({value,onChange,options}) => (
  <select value={value} onChange={onChange} style={{width:"100%",background:"#0a111e",
    border:"1px solid #1e293b",borderRadius:8,padding:"8px 11px",color:"#e2e8f0",
    fontSize:13,outline:"none",fontFamily:"inherit"}}>
    {options.map(o=><option key={o}>{o}</option>)}
  </select>
);
const Txt = ({value,onChange,placeholder,rows=3}) => (
  <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
    style={{width:"100%",background:"#0a111e",border:"1px solid #1e293b",borderRadius:8,
      padding:"8px 11px",color:"#e2e8f0",fontSize:13,outline:"none",
      resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"}}/>
);
const F = ({label,children}) => (
  <div style={{marginBottom:12}}>
    <div style={{color:"#334155",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:5}}>{label}</div>
    {children}
  </div>
);
const Badge = ({s}) => {
  const c = SC[s]||SC.Bookmarked;
  return (
    <span style={{background:c.bg,border:`1px solid ${c.border}`,color:c.text,
      padding:"2px 8px",borderRadius:999,fontSize:10,fontWeight:700,
      display:"inline-flex",alignItems:"center",gap:4}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:c.dot}}/>
      {s}
    </span>
  );
};
const PriBadge = ({p}) => {
  const m={High:{c:"#f87171",b:"#450a0a"},Medium:{c:"#fbbf24",b:"#451a03"},Low:{c:"#86efac",b:"#052e16"}};
  const s=m[p]||m.Low;
  return <span style={{border:`1px solid ${s.b}`,color:s.c,padding:"1px 6px",borderRadius:999,fontSize:9,fontWeight:700}}>{p}</span>;
};
const Deadline = ({date}) => {
  const d=daysDiff(date); if(d===null)return null;
  const col=d<0?"#ef4444":d<=3?"#f97316":d<=7?"#eab308":"#475569";
  const lbl=d<0?`${Math.abs(d)}d overdue`:d===0?"Today!":d===1?"Tomorrow":`${d}d left`;
  return <span style={{color:col,fontSize:10,fontWeight:700}}>⏱ {lbl}</span>;
};
const Modal = ({title,children,onClose,wide=false}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:900,
    display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflowY:"auto"}}
    onClick={onClose}>
    <div style={{background:"#07101f",border:"1px solid #1e293b",borderRadius:16,
      width:"100%",maxWidth:wide?900:620,maxHeight:"92vh",overflowY:"auto",
      padding:26,animation:"mi .18s ease"}}
      onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
        marginBottom:20,paddingBottom:14,borderBottom:"1px solid #0f172a"}}>
        <h2 style={{color:"#f1f5f9",fontFamily:"'Syne',sans-serif",fontSize:17,margin:0}}>{title}</h2>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#334155",fontSize:20,cursor:"pointer"}}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
export default function Dashboard({ session }) {
  const [jobs, setJobs] = useState([]);
  const [tab,  setTab]      = useState("table");
  const [toast, setToast]   = useState(null);
  const [filterStatus, setFS] = useState("All");
  const [filterType, setFT]   = useState("All");
  const [filterPri, setFP]    = useState("All");
  const [sortK, setSortK]   = useState("id");
  const [sortD, setSortD]   = useState("desc");
  const [q, setQ]           = useState("");
  const fileRef             = useRef();
  const dragId              = useRef(null);

  const fetchJobs = async () => {
    const { data } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    if (data) setJobs(data);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchJobs(); }, [session]);

  // modals
  const [showAdd,    setShowAdd]    = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showPrep,   setShowPrep]   = useState(null);
  const [showCover,  setShowCover]  = useState(null);
  const [showDetail, setShowDetail] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem("geminiKey") || NVIDIA_API_KEY);
  const [clientId, setClientId] = useState(() => localStorage.getItem("googleClientId") || import.meta.env.VITE_GOOGLE_CLIENT_ID || "");
  const [aiModel, setAiModel] = useState(() => localStorage.getItem("aiModel") || NVIDIA_MODEL);
  const [proxyUrl, setProxyUrl] = useState(() => localStorage.getItem("proxyUrl") || NVIDIA_API_URL);
  const [adzunaId,  setAdzunaId]  = useState(() => localStorage.getItem("adzunaId")  || "538be205");
  const [adzunaKey, setAdzunaKey] = useState(() => localStorage.getItem("adzunaKey") || "8821660cdab1e3b4a33c8ee8a23f3c3f");

  function saveSettings() {
    localStorage.setItem("geminiKey", geminiKey);
    localStorage.setItem("googleClientId", clientId);
    localStorage.setItem("aiModel", aiModel);
    localStorage.setItem("proxyUrl", proxyUrl);
    localStorage.setItem("adzunaId",  adzunaId);
    localStorage.setItem("adzunaKey", adzunaKey);
    notify("Settings saved ✓");
    setShowSettings(false);
  }

  const blank = {title:"",company:"",location:"",type:"Full-time",salary:"",skills:"",source:"",applylink:"",status:"Bookmarked",applieddate:"",deadline:"",notes:"",priority:"Medium"};
  const [form, setForm] = useState(blank);
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  // ── Search state ──────────────────────────────────────────────────────────
  const [sq, setSq]           = useState("");
  const [sr, setSr]           = useState([]);
  const [sLoad, setSLoad]     = useState(false);
  const [sErr,  setSErr]      = useState("");
  const [sPage, setSPage]     = useState(1);
  // Search filters
  const [sLocation, setSLocation] = useState("");
  const [sJobType, setSJobType]   = useState("all");
  const [sSalaryMin, setSSalaryMin] = useState("");
  const [sCategory, setSCategory] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // prep / cover
  const [prepOut, setPrepOut]     = useState(""); const [prepLoad, setPrepLoad] = useState(false);
  const [coverOut, setCoverOut]   = useState(""); const [coverLoad, setCoverLoad] = useState(false);
  const [bio, setBio]             = useState("");

  // gmail scanner state
  const [gmailDays, setGmailDays]     = useState("30");
  const [gmailExtra, setGmailExtra]   = useState("");
  const [gmailStatus, setGmailStatus] = useState({msg:"Ready — click \"Scan Gmail\" to find job-related emails",type:""});
  const [gmailEmails, setGmailEmails] = useState([]);
  const [gmailFilter, setGmailFilter] = useState("all");
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailRows, setGmailRows]     = useState([{id:1,date:"",company:"",jobTitle:"",status:"Applied",interviewDate:"",interviewTime:"",interviewType:"",notes:""}]);
  const [gmailStats, setGmailStats]   = useState(null);

  const notify = (m,t="ok") => { setToast({m,t}); setTimeout(()=>setToast(null),3200); };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  function openAdd() { setForm(blank); setEditId(null); setShowAdd(true); }
  function openEdit(j) { setForm({...j}); setEditId(j.id); setShowAdd(true); }
  async function saveJob() {
    if (!form.title||!form.company) return notify("Title & Company required","err");
    const payload = {...form, user_id: session.user.id};
    delete payload.id;
    if (editId) {
      const { error } = await supabase.from('jobs').update(payload).eq('id', editId);
      if (!error) { fetchJobs(); notify("Updated ✓"); setShowAdd(false); } else notify(error.message, "err");
    } else {
      const { error } = await supabase.from('jobs').insert([payload]);
      if (!error) { fetchJobs(); notify("Added ✓"); setShowAdd(false); } else notify(error.message, "err");
    }
  }
  async function delJob(id) {
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (!error) { fetchJobs(); notify("Removed"); }
  }
  async function setStatus(id,status) {
    const { error } = await supabase.from('jobs').update({status}).eq('id', id);
    if (!error) fetchJobs();
  }
  async function addFromSearch(r) {
    const payload = {
      title:       r.title       || "Untitled",
      company:     r.company     || "",
      location:    r.location    || "",
      type:        r.type        || "Full-time",
      salary:      r.salary      || "Not disclosed",
      skills:      r.skills      || "",
      source:      r.source      || "Adzuna",
      applylink:   r.applylink   || "",
      status:      "Bookmarked",
      applieddate: "",
      deadline:    "",
      notes:       [r.category ? `Category: ${r.category}` : "", r.description || ""].filter(Boolean).join("\n").trim(),
      priority:    "Medium",
      user_id:     session.user.id
    };
    const {error} = await supabase.from('jobs').insert([payload]);
    if(!error) { fetchJobs(); notify(`"${r.title}" added ✓`); }
    else notify(error.message, "err");
  }
  async function addGmailToTracker(email) {
    const payload = {title:email.jobTitle||"Position",company:email.company||"",location:"",type:"Full-time",salary:"",skills:"",source:"Gmail",applylink:"",status:email.status==="Interview Scheduled"?"Interview":email.status==="Offer Received"?"Offer":email.status==="Rejected"?"Rejected":"Applied",applieddate:email.date?email.date.split("T")[0]:"",deadline:"",notes:email.snippet||"",priority:"Medium",user_id:session.user.id};
    const {error} = await supabase.from('jobs').insert([payload]);
    if(!error) { fetchJobs(); notify(`"${email.company}" added to tracker ✓`); }
  }

  // ── Filter / Sort ─────────────────────────────────────────────────────────
  const baseVisible = jobs
    .filter(j=>filterType==="All"||j.type===filterType)
    .filter(j=>filterPri==="All"||j.priority===filterPri)
    .filter(j=>!q||(j.title+j.company+j.skills+j.location).toLowerCase().includes(q.toLowerCase()));

  const visible = baseVisible
    .filter(j=>filterStatus==="All"||j.status===filterStatus)
    .sort((a,b)=>{
      let av=sortK==="id"?a.id:(a[sortK]??""), bv=sortK==="id"?b.id:(b[sortK]??"");
      return sortD==="asc"?(av>bv?1:-1):(av<bv?1:-1);
    });
  function toggleSort(k){if(sortK===k)setSortD(d=>d==="asc"?"desc":"asc");else{setSortK(k);setSortD("asc");}}
  const sIcon=k=>sortK===k?(sortD==="asc"?"↑":"↓"):<span style={{opacity:.2}}>↕</span>;

  // ── Adzuna helpers ────────────────────────────────────────────────────────
  function buildAdzunaUrl(page = 1) {
    let url = `https://api.adzuna.com/v1/api/jobs/in/search/${page}?app_id=${adzunaId}&app_key=${adzunaKey}&results_per_page=50&content-type=application/json`;
    if (sq.trim())        url += `&what=${encodeURIComponent(sq.trim())}`;
    if (sLocation.trim()) url += `&where=${encodeURIComponent(sLocation.trim())}`;
    if (sJobType === "full-time")  url += `&full_time=1`;
    if (sJobType === "part-time")  url += `&part_time=1`;
    if (sJobType === "contract")   url += `&contract=1`;
    if (sJobType === "permanent")  url += `&permanent=1`;
    if (sSalaryMin)       url += `&salary_min=${sSalaryMin}`;
    if (sCategory)        url += `&category=${sCategory}`;
    return url;
  }

  function mapAdzuna(results) {
    return results.map(j => {
      const rawDesc = j.description || "";
      const cleanDesc = rawDesc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const contractType = j.contract_type || "";
      const contractTime = j.contract_time || "";
      let jobType = "Full-time";
      if (contractTime === "part_time")   jobType = "Part-time";
      else if (contractType === "contract") jobType = "Contract";
      return {
        title:       j.title?.replace(/<[^>]+>/g, "") || "",
        company:     j.company?.display_name || "Unknown",
        location:    j.location?.display_name || "",
        type:        jobType,
        salary:      formatSalary(j.salary_min, j.salary_max),
        skills:      extractSkillsFromText(cleanDesc),
        source:      "Adzuna",
        applylink:   j.redirect_url || "",
        description: cleanDesc.slice(0, 400) + (cleanDesc.length > 400 ? "…" : ""),
        category:    j.category?.label || "",
        postedDate:  j.created ? new Date(j.created).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : "",
      };
    });
  }

  // ── Job Search (Adzuna Live Jobs) ─────────────────────────────────────────
  async function doSearch() {
    if (!sq.trim() && !sLocation.trim() && !sCategory) {
      setSErr("Enter at least a keyword or location to search.");
      return;
    }
    setSLoad(true); setSr([]); setSErr(""); setSPage(1);
    if (!adzunaId || !adzunaKey) {
      setSErr("Adzuna App ID and Key required — add them in ⚙️ Settings.");
      setSLoad(false); return;
    }
    try {
      const res = await fetch(buildAdzunaUrl(1));
      if (!res.ok) throw new Error(`Adzuna error ${res.status}`);
      const data = await res.json();
      if (!data.results?.length) {
        setSErr("No jobs found — try different keywords or broaden your filters.");
        setSLoad(false); return;
      }
      setSr(mapAdzuna(data.results));
    } catch(err) { setSErr(err.message); }
    setSLoad(false);
  }

  async function doSearchMore() {
    const nextPage = sPage + 1;
    setSLoad(true);
    try {
      const res = await fetch(buildAdzunaUrl(nextPage));
      if (!res.ok) throw new Error(`Adzuna error ${res.status}`);
      const data = await res.json();
      if (!data.results?.length) {
        setSErr("No more results found.");
      } else {
        setSr(prev => [...prev, ...mapAdzuna(data.results)]);
        setSPage(nextPage);
      }
    } catch(err) { setSErr(err.message); }
    setSLoad(false);
  }

  // ── AI Interview Prep ─────────────────────────────────────────────────────
  async function doPrep(job) {
    if(!job) return;
    setPrepLoad(true); setPrepOut(""); setShowPrep(job);
    try {
      const t = await callGemini(
        `Create a concise interview prep guide for "${job.title}" at ${job.company}. Include: 5 technical questions with answer hints (skills: ${job.skills}), 3 STAR behavioral questions, 2 questions to ask them, 3 things to research about ${job.company}. Use clear headers.`,
        "You are an expert career coach. Provide specific, actionable interview preparation.",
        geminiKey, aiModel, proxyUrl
      );
      setPrepOut(t);
    } catch(err) { setPrepOut("Error: " + err.message); }
    setPrepLoad(false);
  }

  // ── AI Cover Letter ───────────────────────────────────────────────────────
  async function doCover(job) {
    if(!job) return;
    setCoverLoad(true); setCoverOut("");
    try {
      const t = await callGemini(
        `Write a compelling 3-paragraph cover letter for: Role: ${job.title} at ${job.company} (${job.location}). Skills needed: ${job.skills}. Candidate background: ${bio||"Recent graduate"}. Be specific, genuine. No clichés.`,
        "You are a professional career writer. Write natural, tailored cover letters.",
        geminiKey, aiModel, proxyUrl
      );
      setCoverOut(t);
    } catch(err) { setCoverOut("Error: " + err.message); }
    setCoverLoad(false);
  }

  // ── Google helpers ────────────────────────────────────────────────────────
  async function loadGis() {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) return resolve(window.google.accounts.oauth2);
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true; script.defer = true;
      script.onload = () => resolve(window.google.accounts.oauth2);
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  async function getGoogleToken(scope) {
    if (session?.provider_token) return session.provider_token;
    if (!clientId) throw new Error("Google Client ID needed in Settings.");
    const gis = await loadGis();
    return new Promise((resolve, reject) => {
      const tokenClient = gis.initTokenClient({
        client_id: clientId,
        scope,
        callback: (resp) => {
          if (resp.error) reject(new Error(resp.error));
          else resolve(resp.access_token);
        }
      });
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  async function addToCalendar(job) {
    const dateTimeStr = prompt(`Enter interview date/time for ${job.company} (e.g. 2026-03-25T14:00):`, job.deadline ? `${job.deadline}T09:00` : "");
    if(dateTimeStr === null) return;
    try {
      notify("Requesting Calendar access…");
      const token = await getGoogleToken("https://www.googleapis.com/auth/calendar.events");
      const isAllDay = dateTimeStr && !dateTimeStr.includes("T");
      const startObj = isAllDay ? { date: dateTimeStr } : { dateTime: new Date(dateTimeStr).toISOString() };
      const endObj   = isAllDay ? { date: dateTimeStr } : { dateTime: new Date(new Date(dateTimeStr).getTime() + 3600000).toISOString() };
      const event = { summary: `Interview: ${job.company} - ${job.title}`, description: `Role: ${job.title}\nLink: ${job.applylink||"none"}\nNotes: ${job.notes||"none"}`, start: startObj, end: endObj };
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(event)
      });
      if(!res.ok) throw new Error("Failed to create event");
      notify("Added to Google Calendar ✓");
    } catch(err) { notify("Calendar error: " + err.message, "err"); }
  }

  async function saveToDrive(filename, content) {
    try {
      notify("Requesting Drive access…");
      const token = await getGoogleToken("https://www.googleapis.com/auth/drive.file");
      const boundary = "-------314159265358979323846";
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";
      const metadata = { name: filename, mimeType: "text/plain" };
      const body = delimiter + "Content-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata) + delimiter + "Content-Type: text/plain; charset=UTF-8\r\n\r\n" + content + close_delim;
      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": `multipart/related; boundary="${boundary}"` },
        body
      });
      if(!res.ok) throw new Error("Failed to save to Drive");
      notify(`Saved "${filename}" to Google Drive ✓`);
    } catch(err) { notify("Drive error: " + err.message, "err"); }
  }

  // ── Gmail Scanner ─────────────────────────────────────────────────────────
  async function startGmailScan() {
    setGmailLoading(true); setGmailEmails([]); setGmailStats(null);
    setGmailStatus({msg:"Authorizing with Google…",type:"loading"});
    try {
      if (session?.provider_token) {
        setGmailStatus({msg:"Using saved Google credentials…",type:"loading"});
        await fetchAndParseEmails(session.provider_token);
        return;
      }
      if(!clientId) throw new Error("Google Client ID needed in Settings.");
      const gis = await loadGis();
      const tokenClient = gis.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/gmail.readonly",
        callback: async (resp) => {
          if (resp.error) {
            setGmailStatus({msg:"Google auth error: " + resp.error, type:"error"});
            setGmailLoading(false);
            return;
          }
          await fetchAndParseEmails(resp.access_token);
        }
      });
      tokenClient.requestAccessToken({prompt: 'consent'});
    } catch(err) {
      setGmailStatus({msg:"Error: "+err.message, type:"error"});
      setGmailLoading(false);
    }
  }

  async function fetchAndParseEmails(token) {
    try {
      setGmailStatus({msg:"Fetching emails via Gmail API…",type:"loading"});
      let baseQ = `(subject:interview OR subject:offer OR subject:application OR subject:referred OR subject:rejected OR subject:"assessment" OR subject:"next steps" OR subject:"position") newer_than:${gmailDays}d`;
      if (gmailExtra) baseQ += ` ${gmailExtra}`;
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(baseQ)}&maxResults=35`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if(!data.messages?.length) {
        setGmailStatus({msg:"✓ Scan complete — no job-related emails found.",type:"success"});
        setGmailLoading(false); return;
      }
      setGmailStatus({msg:`Reading ${data.messages.length} matched emails…`,type:"loading"});
      const batch = await Promise.all(data.messages.map(m =>
        fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r=>r.json())
      ));
      const payload = batch.map(d => {
        let subject="", sender="", date="";
        d.payload?.headers?.forEach(h => {
          if(h.name.toLowerCase()==="subject") subject = h.value;
          if(h.name.toLowerCase()==="from") sender = h.value;
          if(h.name.toLowerCase()==="date") date = h.value;
        });
        return { subject, sender, date, snippet: d.snippet };
      });
      setGmailStatus({msg:"Analyzing emails with AI…",type:"loading"});
      const prompt = `Analyze these emails and return a JSON array of job-related emails:\n${JSON.stringify(payload)}\nReturn JSON array where objects have: company, jobTitle, status (Applied, Screening, Interview Scheduled, Interview Done, Offer Received, Rejected, Pending), interviewDate, interviewTime, interviewType, sender, date, snippet, subject. ONLY JSON array.`;
      const text = await callGemini(prompt, "You are a job application analyzer. Always return valid JSON arrays only.", geminiKey, aiModel, proxyUrl);
      const clean = text.replace(/```json|```/g,"").trim();
      const match = clean.match(/\[[\s\S]*\]/);
      const emails = match ? JSON.parse(match[0]) : [];
      if(emails.length===0) {
        setGmailStatus({msg:"✓ Scan complete — no exact matches found.",type:"success"});
      } else {
        setGmailEmails(emails);
        const stats = {
          total:emails.length,
          applied:emails.filter(e=>e.status==="Applied").length,
          interview:emails.filter(e=>e.status.includes("Interview")).length,
          offer:emails.filter(e=>e.status.includes("Offer")||e.status==="Accepted").length,
          rejected:emails.filter(e=>e.status==="Rejected").length,
          pending:emails.filter(e=>e.status==="Pending").length,
        };
        setGmailStats(stats);
        setGmailRows(emails.map((e,i)=>({id:i+1,date:e.date?e.date.split("T")[0]:"",company:e.company||"",jobTitle:e.jobTitle||"",status:e.status||"Applied",interviewDate:e.interviewDate||"",interviewTime:e.interviewTime||"",interviewType:e.interviewType||"",notes:e.snippet||""})));
        setGmailStatus({msg:`✓ Found ${emails.length} job-related emails — review below!`,type:"success"});
      }
    } catch(err) {
      setGmailStatus({msg:"Error: " + err.message, type:"error"});
    }
    setGmailLoading(false);
  }

  // ── Excel ─────────────────────────────────────────────────────────────────
  function exportXLSX() {
    const rows = jobs.map(j=>({"Job Title":j.title,"Company":j.company,"Location":j.location,"Type":j.type,"Salary":j.salary,"Skills":j.skills,"Source":j.source,"Apply Link":j.applylink,"Status":j.status,"Priority":j.priority,"Applied Date":j.applieddate,"Deadline":j.deadline,"Notes":j.notes}));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"]=[{wch:35},{wch:20},{wch:22},{wch:13},{wch:14},{wch:30},{wch:14},{wch:40},{wch:20},{wch:10},{wch:14},{wch:14},{wch:50}];
    const ws2 = XLSX.utils.json_to_sheet([...STATUS.map(s=>({Status:s,Count:jobs.filter(j=>j.status===s).length})),{Status:"TOTAL",Count:jobs.length}]);
    ws2["!cols"]=[{wch:22},{wch:10}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Applications");
    XLSX.utils.book_append_sheet(wb,ws2,"Summary");
    XLSX.writeFile(wb,"JobBoard_Pro.xlsx");
    notify("Excel downloaded ✓");
  }

  function importXLSX(e) {
    const file=e.target.files[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try {
        const wb=XLSX.read(ev.target.result,{type:"array"});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const aoa=XLSX.utils.sheet_to_json(ws,{header:1});
        let hr=aoa.findIndex(r=>r&&r.some&&r.some(c=>typeof c==='string'&&c.match(/Company|Role|Title/i)));
        if(hr===-1) hr=0;
        const headers=aoa[hr]||[];
        const applyColIdx=headers.findIndex(h=>typeof h==='string'&&h.match(/Apply/i));
        const data=[];
        for(let R=hr+1; R<aoa.length; ++R){
          const rowArr=aoa[R];
          if(!rowArr||rowArr.length===0||!rowArr.some(c=>c)) continue;
          const obj={};
          headers.forEach((h,C)=>{if(h) obj[h]=rowArr[C];});
          if(applyColIdx!==-1){
            const cellAddr=XLSX.utils.encode_cell({r:R,c:applyColIdx});
            const cell=ws[cellAddr];
            if(cell&&cell.l&&cell.l.Target) obj[headers[applyColIdx]]=cell.l.Target;
          }
          data.push(obj);
        }
        const mapped=data.map(r=>{
          const notesParts=[];
          if(r["Job Description"]) notesParts.push(r["Job Description"]);
          if(r.Eligibility) notesParts.push("Eligibility: "+r.Eligibility);
          if(r["Perks & Benefits"]) notesParts.push("Perks: "+r["Perks & Benefits"]);
          return {
            title:r["Job Title"]||r["Job Role"]||r.title||"Untitled",
            company:r.Company||r.company||"",
            location:r.Location||r.location||"",
            type:r["Work Mode"]||r.Type||r.type||"Full-time",
            salary:r["Salary / Stipend (INR)"]||r.Salary||r.salary||"",
            skills:r["Skills Required"]||r.Skills||r.skills||"",
            source:r.Source||r.source||"Import",
            applylink:r["Apply Link"]||r.applylink||"",
            status:r.Status||r.status||"Bookmarked",
            priority:r.Priority||r.priority||"Medium",
            applieddate:r["Posted On"]||r["Applied Date"]||r.applieddate||"",
            deadline:r.Deadline||r.deadline||"",
            notes:notesParts.join(" | ")||r.Notes||r.notes||"",
            user_id:session.user.id
          };
        });
        const newJobs=[]; let skipped=0;
        mapped.forEach(r=>{
          const isDup=jobs.some(j=>j.title.toLowerCase()===r.title.toLowerCase()&&j.company.toLowerCase()===r.company.toLowerCase());
          if(isDup) skipped++; else newJobs.push(r);
        });
        if(newJobs.length===0){ notify(`Import ignored — ${skipped} duplicate jobs skipped.`); return; }
        const doBatches=async()=>{
          let hasErrs=false, msg="";
          for(let i=0;i<newJobs.length;i+=500){
            const {error}=await supabase.from('jobs').insert(newJobs.slice(i,i+500));
            if(error){hasErrs=true;msg=error.message;break;}
          }
          if(!hasErrs){fetchJobs();notify(`Imported ${newJobs.length} jobs ✓${skipped>0?` (${skipped} duplicates skipped)`:""}`);}
          else notify(msg,"err");
        };
        doBatches();
      } catch{ notify("Import failed — check file format","err"); }
    };
    reader.readAsArrayBuffer(file); e.target.value="";
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = STATUS.reduce((a,s)=>{a[s]=baseVisible.filter(j=>j.status===s).length;return a},{});
  const overdue  = jobs.filter(j=>j.deadline&&daysDiff(j.deadline)<0&&!["Rejected","Withdrawn","Offer"].includes(j.status)).length;
  const soonDue  = jobs.filter(j=>j.deadline&&daysDiff(j.deadline)>=0&&daysDiff(j.deadline)<=7&&!["Rejected","Withdrawn","Offer"].includes(j.status)).length;
  const filteredGmail = gmailEmails.filter(e=>gmailFilter==="all"||e.status===gmailFilter);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#050c1a",minHeight:"100vh",color:"#e2e8f0"}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#0a111e}
        ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:4px}
        @keyframes mi{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .row:hover td{background:#07101f!important}
        .kb-drop{transition:background .15s}
        .kb-drop.over{background:#0a1628!important}
        .hbtn:hover{opacity:.75}
        .email-card{transition:all .2s}
        .email-card:hover{border-color:#2563eb!important;transform:translateX(2px)}
        .gtab{padding:5px 13px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid rgba(99,150,210,0.2);background:transparent;color:#64748b;font-family:inherit;transition:all .2s}
        .gtab:hover{border-color:#06b6d4;color:#06b6d4}
        .gtab.active{background:#2563eb;border-color:#2563eb;color:#fff}
        .filter-chip{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid #1e293b;background:#0a111e;color:#64748b;font-family:inherit;transition:all .15s}
        .filter-chip:hover{border-color:#818cf8;color:#818cf8}
        .filter-chip.active{background:#1e1b4b;border-color:#4f46e5;color:#a5b4fc}
      `}</style>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={importXLSX}/>

      {/* Toast */}
      {toast&&<div style={{position:"fixed",top:16,right:16,zIndex:9999,background:toast.t==="err"?"#450a0a":"#052e16",border:`1px solid ${toast.t==="err"?"#dc2626":"#16a34a"}`,color:"#fff",padding:"10px 16px",borderRadius:10,fontSize:13,animation:"mi .2s ease",maxWidth:300}}>{toast.m}</div>}

      {/* HEADER */}
      <div style={{background:"#060d1b",borderBottom:"1px solid #0a1628",padding:"18px 24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,maxWidth:1440,margin:"0 auto"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:2}}>
              <span style={{fontSize:22}}>🎯</span>
              <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,margin:0,background:"linear-gradient(90deg,#60a5fa,#818cf8,#c084fc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>JobBoard Pro</h1>
            </div>
            <p style={{color:"#1e293b",fontSize:11,margin:"0 0 0 31px"}}>Search · Track · Gmail · Export</p>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn onClick={()=>setShowSearch(true)} v="cyn">🔍 Job Search</Btn>
            <Btn onClick={()=>setShowSettings(true)}>⚙️ Settings</Btn>
            <Btn onClick={()=>supabase.auth.signOut()} v="red">⏏️ Logout</Btn>
            <Btn onClick={openAdd}>＋ Add Job</Btn>
            <Btn onClick={()=>fileRef.current.click()}>📂 Import</Btn>
            <Btn onClick={exportXLSX} v="grn">📥 Export Excel</Btn>
          </div>
        </div>
      </div>

      {/* ALERT BAR */}
      {(overdue>0||soonDue>0)&&(
        <div style={{background:"#07101f",borderBottom:"1px solid #0a1628",padding:"9px 24px"}}>
          <div style={{maxWidth:1440,margin:"0 auto",display:"flex",gap:10,flexWrap:"wrap"}}>
            {overdue>0&&<span style={{background:"#2a0a0a",border:"1px solid #7f1d1d",color:"#f87171",padding:"3px 12px",borderRadius:999,fontSize:11,fontWeight:700}}>🔴 {overdue} deadline{overdue>1?"s":""} overdue</span>}
            {soonDue>0&&<span style={{background:"#1c1000",border:"1px solid #78350f",color:"#fbbf24",padding:"3px 12px",borderRadius:999,fontSize:11,fontWeight:700}}>⏰ {soonDue} due within 7 days</span>}
          </div>
        </div>
      )}

      {/* STATUS FILTER & ADVANCED FILTERS */}
      <div style={{background:"#060d1b",borderBottom:"1px solid #0a1628",padding:"9px 24px"}}>
        <div style={{maxWidth:1440,margin:"0 auto",display:"flex",gap:16,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            {[["All",baseVisible.length,"#60a5fa"],...STATUS.map(s=>[s,stats[s],SC[s].dot])].map(([s,c,col])=>(
              <button key={s} onClick={()=>setFS(s)} style={{background:filterStatus===s?"#0a1628":"transparent",border:`1px solid ${filterStatus===s?col:"#1e293b"}`,borderRadius:8,padding:"4px 12px",color:filterStatus===s?"#f1f5f9":"#334155",fontSize:11,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>
                {s} <span style={{color:col,marginLeft:3}}>{c}</span>
              </button>
            ))}
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{color:"#475569",fontSize:11,fontWeight:700}}>FILTERS</span>
            <select value={filterType} onChange={e=>setFT(e.target.value)} style={{background:"#0a111e",border:"1px solid #1e293b",borderRadius:8,padding:"5px 10px",color:"#94a3b8",fontSize:11,outline:"none",cursor:"pointer"}}>
              <option value="All">All Types</option>
              {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterPri} onChange={e=>setFP(e.target.value)} style={{background:"#0a111e",border:"1px solid #1e293b",borderRadius:8,padding:"5px 10px",color:"#94a3b8",fontSize:11,outline:"none",cursor:"pointer"}}>
              <option value="All">All Priorities</option>
              {["High","Medium","Low"].map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{background:"#060d1b",borderBottom:"1px solid #0a1628",padding:"0 24px"}}>
        <div style={{maxWidth:1440,margin:"0 auto",display:"flex"}}>
          {[["table","📋 Table"],["kanban","🗂 Kanban"],["analytics","📊 Analytics"],["gmail","📧 Gmail Scanner"]].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",borderBottom:`2px solid ${tab===t?"#4f46e5":"transparent"}`,color:tab===t?"#818cf8":"#334155",padding:"11px 16px",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s",display:"flex",alignItems:"center",gap:6}}>
              {l}
              {t==="gmail"&&<span style={{background:"rgba(6,182,212,0.15)",border:"1px solid rgba(6,182,212,0.3)",color:"#06b6d4",padding:"1px 6px",borderRadius:999,fontSize:9,fontWeight:700}}>MCP</span>}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{maxWidth:1440,margin:"0 auto",padding:"20px 24px"}}>

        {/* ══ TABLE ══ */}
        {tab==="table"&&(
          <>
            <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
              <Inp value={q} onChange={e=>setQ(e.target.value)} placeholder="Search title, company, skills…" sx={{flex:1,minWidth:200}}/>
              <span style={{color:"#1e293b",fontSize:12}}>{visible.length} result{visible.length!==1?"s":""}</span>
            </div>
            <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #0a1628"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:"#07101f",borderBottom:"1px solid #0a1628"}}>
                    {[["title","Role",200],["company","Company",120],["location","Location",100],["salary","Salary",90],["status","Status",120],["priority","Pri",55],["deadline","Deadline",100],["applieddate","Applied",85],["","Actions",130]].map(([k,h,w])=>(
                      <th key={h} onClick={k?()=>toggleSort(k):undefined} style={{padding:"9px 12px",color:"#1e293b",fontWeight:700,fontSize:10,letterSpacing:"0.08em",textAlign:"left",cursor:k?"pointer":"default",minWidth:w,userSelect:"none"}}>{h}{k&&<span style={{marginLeft:3}}>{sIcon(k)}</span>}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.length===0&&<tr><td colSpan={9} style={{textAlign:"center",padding:"40px",color:"#1e293b"}}>No jobs match your filters.</td></tr>}
                  {visible.map(job=>(
                    <tr key={job.id} className="row" style={{borderBottom:"1px solid #07101f"}}>
                      <td style={{padding:"10px 12px"}}>
                        <div style={{color:"#e2e8f0",fontWeight:600,fontSize:13}}>
                          {job.applylink?<a href={job.applylink} target="_blank" rel="noreferrer" style={{color:"#60a5fa",textDecoration:"none"}}>{job.title}</a>:job.title}
                        </div>
                        {job.notes&&<div style={{color:"#1e293b",fontSize:10,marginTop:1,maxWidth:190,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={job.notes}>{job.notes}</div>}
                      </td>
                      <td style={{padding:"10px 12px",color:"#64748b"}}>{job.company}</td>
                      <td style={{padding:"10px 12px",color:"#334155",whiteSpace:"nowrap"}}>{job.location}</td>
                      <td style={{padding:"10px 12px",color:"#a78bfa",whiteSpace:"nowrap"}}>{job.salary}</td>
                      <td style={{padding:"10px 12px"}}>
                        <Badge s={job.status}/>
                        <select value={job.status} onChange={e=>setStatus(job.id,e.target.value)} style={{display:"block",marginTop:4,background:"#0a111e",border:"1px solid #1e293b",borderRadius:6,padding:"2px 6px",color:"#475569",fontSize:10,cursor:"pointer",outline:"none",width:"100%"}}>
                          {STATUS.map(s=><option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{padding:"10px 12px"}}><PriBadge p={job.priority}/></td>
                      <td style={{padding:"10px 12px"}}><Deadline date={job.deadline}/>{job.deadline&&<div style={{color:"#1e293b",fontSize:9,marginTop:1}}>{fmtDate(job.deadline)}</div>}</td>
                      <td style={{padding:"10px 12px",color:"#1e293b",fontSize:10,whiteSpace:"nowrap"}}>{fmtDate(job.applieddate)}</td>
                      <td style={{padding:"10px 12px"}}>
                        <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                          {[["👁","Details",()=>setShowDetail(job)],["🎙","Prep",()=>doPrep(job)],["✉","Cover",()=>{setShowCover(job);setCoverOut("");}],["✏️","Edit",()=>openEdit(job)],["🗑","Del",()=>delJob(job.id)]].map(([ic,tt,fn])=>(
                            <button key={tt} onClick={fn} title={tt} className="hbtn" style={{background:"#0a111e",border:"1px solid #1e293b",borderRadius:6,padding:"3px 6px",color:"#334155",cursor:"pointer",fontSize:11}}>{ic}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══ KANBAN ══ */}
        {tab==="kanban"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(195px,1fr))",gap:12}}>
            {STATUS.map(col=>{
              const cj=baseVisible.filter(j=>j.status===col); const c=SC[col];
              return(
                <div key={col} className="kb-drop" style={{background:"#07101f",border:`1px solid ${c.border}18`,borderTop:`2px solid ${c.border}`,borderRadius:12,padding:12,minHeight:160}}
                  onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add("over")}}
                  onDragLeave={e=>e.currentTarget.classList.remove("over")}
                  onDrop={e=>{e.currentTarget.classList.remove("over");if(dragId.current){setStatus(dragId.current,col);dragId.current=null;}}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <span style={{color:c.text,fontWeight:700,fontSize:11,letterSpacing:"0.06em"}}>{col.toUpperCase()}</span>
                    <span style={{background:c.bg,border:`1px solid ${c.border}`,color:c.text,borderRadius:999,padding:"1px 7px",fontSize:10,fontWeight:700}}>{cj.length}</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {cj.map(job=>(
                      <div key={job.id} draggable onDragStart={()=>dragId.current=job.id}
                        style={{background:"#0a111e",border:"1px solid #1e293b",borderRadius:9,padding:9,cursor:"grab"}}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=c.border}
                        onMouseLeave={e=>e.currentTarget.style.borderColor="#1e293b"}>
                        <div style={{color:"#e2e8f0",fontWeight:600,fontSize:12,lineHeight:1.3,marginBottom:3}}>{job.title}</div>
                        <div style={{color:"#475569",fontSize:11,marginBottom:5}}>{job.company}</div>
                        <Deadline date={job.deadline}/>
                        <div style={{marginTop:6,display:"flex",gap:4,alignItems:"center"}}>
                          <PriBadge p={job.priority}/>
                          <div style={{marginLeft:"auto",display:"flex",gap:4}}>
                            {job.applylink&&<a href={job.applylink} target="_blank" rel="noreferrer" style={{background:"#1d4ed8",borderRadius:5,padding:"2px 8px",color:"#fff",textDecoration:"none",fontSize:9,fontWeight:700}}>Apply ↗</a>}
                            <button onClick={()=>doPrep(job)} style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:5,padding:"2px 6px",color:"#334155",cursor:"pointer",fontSize:9}}>🎙</button>
                            <button onClick={()=>openEdit(job)} style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:5,padding:"2px 6px",color:"#334155",cursor:"pointer",fontSize:9}}>✏️</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {cj.length===0&&<div style={{color:"#1e293b",fontSize:11,textAlign:"center",padding:"18px 0",border:"1px dashed #1e293b",borderRadius:8}}>Drop here</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══ ANALYTICS ══ */}
        {tab==="analytics"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
            <div style={{background:"#07101f",border:"1px solid #0a1628",borderRadius:14,padding:18}}>
              <div style={{color:"#1e293b",fontSize:10,fontWeight:700,letterSpacing:"0.1em",marginBottom:14}}>APPLICATIONS BY STATUS</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={STATUS.map(s=>({name:s.slice(0,6),val:stats[s]}))} margin={{left:-24}}>
                  <XAxis dataKey="name" tick={{fill:"#1e293b",fontSize:9}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"#1e293b",fontSize:9}} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip contentStyle={{background:"#07101f",border:"1px solid #1e293b",borderRadius:8,fontSize:11}}/>
                  <Bar dataKey="val" radius={[4,4,0,0]}>{STATUS.map((s,i)=><Cell key={i} fill={SC[s].dot}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{background:"#07101f",border:"1px solid #0a1628",borderRadius:14,padding:18}}>
              <div style={{color:"#1e293b",fontSize:10,fontWeight:700,letterSpacing:"0.1em",marginBottom:14}}>DISTRIBUTION</div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <ResponsiveContainer width="52%" height={160}>
                  <PieChart>
                    <Pie data={STATUS.filter(s=>stats[s]>0).map(s=>({name:s,value:stats[s]}))} cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={3} dataKey="value">
                      {STATUS.filter(s=>stats[s]>0).map((s,i)=><Cell key={i} fill={SC[s].dot}/>)}
                    </Pie>
                    <Tooltip contentStyle={{background:"#07101f",border:"1px solid #1e293b",borderRadius:8,fontSize:11}}/>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{flex:1}}>
                  {STATUS.filter(s=>stats[s]>0).map(s=>(
                    <div key={s} style={{display:"flex",justifyContent:"space-between",marginBottom:7,alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:7,height:7,borderRadius:"50%",background:SC[s].dot}}/><span style={{color:"#475569",fontSize:11}}>{s}</span></div>
                      <span style={{color:SC[s].dot,fontWeight:700,fontSize:13}}>{stats[s]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{background:"#07101f",border:"1px solid #0a1628",borderRadius:14,padding:18}}>
              <div style={{color:"#1e293b",fontSize:10,fontWeight:700,letterSpacing:"0.1em",marginBottom:14}}>PRIORITY BREAKDOWN</div>
              {["High","Medium","Low"].map(p=>{
                const cnt=baseVisible.filter(j=>j.priority===p).length;
                const pct=baseVisible.length?Math.round(cnt/baseVisible.length*100):0;
                const col={High:"#ef4444",Medium:"#f59e0b",Low:"#22c55e"}[p];
                return <div key={p} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#475569",fontSize:12}}>{p}</span><span style={{color:col,fontWeight:700,fontSize:12}}>{cnt}</span></div>
                  <div style={{background:"#0a111e",borderRadius:999,height:5}}><div style={{background:col,width:`${pct}%`,height:"100%",borderRadius:999,transition:"width .5s"}}/></div>
                </div>;
              })}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["Total",baseVisible.length,"#60a5fa","📋"],["Applied",stats.Applied,"#67e8f9","✉️"],["Interviews",stats.Interview,"#86efac","🎙"],["Offers",stats.Offer,"#fde047","🏆"]].map(([l,v,c,ic])=>(
                <div key={l} style={{background:"#07101f",border:"1px solid #0a1628",borderRadius:12,padding:16,textAlign:"center"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{ic}</div>
                  <div style={{color:c,fontSize:26,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{v}</div>
                  <div style={{color:"#1e293b",fontSize:10,marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ GMAIL SCANNER ══ */}
        {tab==="gmail"&&(
          <div>
            <div style={{background:"#07101f",border:"1px solid #1e293b",borderRadius:16,padding:24,marginBottom:20}}>
              <div style={{color:"#06b6d4",fontWeight:700,fontSize:14,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
                🔍 Scan Gmail for Job Replies
                <span style={{background:"rgba(6,182,212,0.12)",border:"1px solid rgba(6,182,212,0.25)",color:"#06b6d4",padding:"1px 8px",borderRadius:999,fontSize:10,fontWeight:700}}>Gmail MCP</span>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
                <input type="number" value={gmailDays} onChange={e=>setGmailDays(e.target.value)} min="1" max="365"
                  placeholder="Days" style={{width:90,background:"#0a111e",border:"1px solid #1e293b",borderRadius:8,padding:"10px 12px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
                <input value={gmailExtra} onChange={e=>setGmailExtra(e.target.value)}
                  placeholder="Extra keywords (e.g. interview, offer, rejected)…"
                  style={{flex:1,minWidth:220,background:"#0a111e",border:"1px solid #1e293b",borderRadius:8,padding:"10px 12px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
                <Btn v="cyn" onClick={startGmailScan} disabled={gmailLoading}>
                  {gmailLoading?<><span style={{display:"inline-block",animation:"spin 0.8s linear infinite"}}>◌</span> Scanning…</>:"⚡ Scan Gmail"}
                </Btn>
                <Btn onClick={()=>{setGmailEmails([]);setGmailStats(null);setGmailStatus({msg:"Cleared.",type:""});setGmailRows([{id:1,date:"",company:"",jobTitle:"",status:"Applied",interviewDate:"",interviewTime:"",interviewType:"",notes:""}]);}}>✕ Clear</Btn>
              </div>
              <div style={{background:"#0a111e",border:"1px solid #1e293b",borderRadius:10,padding:"12px 16px",fontFamily:"'JetBrains Mono',monospace",fontSize:12,minHeight:44,display:"flex",alignItems:"center",gap:10,
                color:gmailStatus.type==="error"?"#ef4444":gmailStatus.type==="success"?"#10b981":gmailStatus.type==="loading"?"#f59e0b":"#06b6d4"}}>
                {gmailStatus.type==="loading"&&<span style={{display:"inline-block",animation:"spin 0.8s linear infinite",flexShrink:0}}>◌</span>}
                <span>{gmailStatus.msg}</span>
              </div>
              <div style={{background:"rgba(6,182,212,0.06)",border:"1px solid rgba(6,182,212,0.18)",borderRadius:10,padding:"10px 14px",marginTop:12,fontSize:12,color:"#06b6d4",display:"flex",gap:8}}>
                💡 <span>After scanning, job emails appear below. Click <strong>"+ Add to Tracker"</strong> on any card to sync it.</span>
              </div>
            </div>

            {gmailStats&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:10,marginBottom:20}}>
                {[["Emails Found",gmailStats.total,"#60a5fa"],["Applied",gmailStats.applied,"#f59e0b"],["Interviews",gmailStats.interview,"#06b6d4"],["Offers",gmailStats.offer,"#10b981"],["Rejected",gmailStats.rejected,"#ef4444"],["Pending",gmailStats.pending,"#8b5cf6"]].map(([l,v,c])=>(
                  <div key={l} style={{background:"#07101f",border:"1px solid #0a1628",borderRadius:12,padding:"14px 12px",textAlign:"center"}}>
                    <div style={{color:c,fontSize:28,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
                    <div style={{color:"#334155",fontSize:10,marginTop:3,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</div>
                  </div>
                ))}
              </div>
            )}

            {gmailEmails.length>0&&(
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
                <div style={{color:"#94a3b8",fontWeight:600,fontSize:14}}>📨 Email Results</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {[["all","All"],["Interview Scheduled","Interviews"],["Offer Received","Offers"],["Rejected","Rejected"],["Applied","Applied"]].map(([v,l])=>(
                    <button key={v} className={`gtab${gmailFilter===v?" active":""}`} onClick={()=>setGmailFilter(v)}>{l}</button>
                  ))}
                </div>
              </div>
            )}

            {filteredGmail.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
                {filteredGmail.map((email,i)=>{
                  const sc=GMAIL_STATUS_COLORS[email.status]||GMAIL_STATUS_COLORS["Pending"];
                  const initials=(email.company||"?").substring(0,2).toUpperCase();
                  const dateStr=email.date?new Date(email.date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"";
                  return (
                    <div key={i} className="email-card" style={{background:"#07101f",border:"1px solid #1e293b",borderRadius:14,padding:18,borderLeft:`3px solid ${sc.accent}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,flexWrap:"wrap",gap:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:36,height:36,borderRadius:8,background:sc.lb,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",flexShrink:0}}>{initials}</div>
                          <div>
                            <div style={{fontWeight:700,fontSize:15}}>{email.company||"Unknown Company"}</div>
                            <div style={{color:"#64748b",fontSize:12,marginTop:1}}>{email.jobTitle||email.subject||"Position"}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                          <span style={{background:sc.bg,color:sc.fg,padding:"3px 10px",borderRadius:999,fontSize:10,fontWeight:700}}>{email.status}</span>
                          <Btn v="grn" onClick={()=>addGmailToTracker(email)} sx={{padding:"4px 10px",fontSize:11}}>+ Add to Tracker</Btn>
                        </div>
                      </div>
                      {email.snippet&&<div style={{color:"#8eafd0",fontSize:13,marginBottom:10,lineHeight:1.5}}>{email.snippet}</div>}
                      {email.interviewDate&&(
                        <div style={{background:"rgba(37,99,235,0.1)",border:"1px solid rgba(37,99,235,0.25)",borderRadius:8,padding:"7px 12px",marginBottom:10,fontSize:12,color:"#60a5fa",fontWeight:600,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          📅 Interview: {email.interviewDate}
                          {email.interviewTime&&` at ${email.interviewTime}`}
                          {email.interviewType&&` — ${email.interviewType}`}
                        </div>
                      )}
                      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                        {email.sender&&<span style={{fontSize:11,color:"#475569"}}>📧 {email.sender}</span>}
                        {dateStr&&<span style={{fontSize:11,color:"#475569"}}>🗓 {dateStr}</span>}
                        {email.subject&&<span style={{fontSize:11,color:"#334155"}} title={email.subject}>📌 {email.subject.slice(0,50)}{email.subject.length>50?"…":""}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Editable Tracker Table */}
            <div style={{marginTop:8}}>
              <div style={{color:"#94a3b8",fontWeight:600,fontSize:14,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                📋 Application Tracker
                <span style={{color:"#334155",fontWeight:400,fontSize:11}}>(editable — syncs with your Excel export)</span>
              </div>
              <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #0a1628"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{background:"#07101f",borderBottom:"1px solid #0a1628"}}>
                      {["#","Date Applied","Company","Job Title","Status","Interview Date","Interview Time","Interview Type","Notes"].map(h=>(
                        <th key={h} style={{padding:"9px 12px",color:"#334155",fontWeight:700,fontSize:10,letterSpacing:"0.07em",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gmailRows.map((row,i)=>(
                      <tr key={row.id} style={{borderBottom:"1px solid #07101f"}}>
                        <td style={{padding:"8px 12px",color:"#334155",fontSize:11}}>{row.id}</td>
                        <td style={{padding:"4px 8px"}}><input value={row.date} onChange={e=>setGmailRows(rs=>rs.map((r,j)=>j===i?{...r,date:e.target.value}:r))} placeholder="YYYY-MM-DD" style={{background:"transparent",border:"none",color:"#e2e8f0",fontFamily:"inherit",fontSize:12,width:"100%",outline:"none",padding:"2px 0"}}/></td>
                        <td style={{padding:"4px 8px"}}><input value={row.company} onChange={e=>setGmailRows(rs=>rs.map((r,j)=>j===i?{...r,company:e.target.value}:r))} placeholder="Company" style={{background:"transparent",border:"none",color:"#e2e8f0",fontFamily:"inherit",fontSize:12,width:"100%",outline:"none",padding:"2px 0"}}/></td>
                        <td style={{padding:"4px 8px"}}><input value={row.jobTitle} onChange={e=>setGmailRows(rs=>rs.map((r,j)=>j===i?{...r,jobTitle:e.target.value}:r))} placeholder="Job title" style={{background:"transparent",border:"none",color:"#e2e8f0",fontFamily:"inherit",fontSize:12,width:"100%",outline:"none",padding:"2px 0"}}/></td>
                        <td style={{padding:"4px 8px"}}>
                          <select value={row.status} onChange={e=>setGmailRows(rs=>rs.map((r,j)=>j===i?{...r,status:e.target.value}:r))} style={{background:"#0a111e",border:"1px solid #1e293b",borderRadius:6,padding:"3px 6px",color:"#e2e8f0",fontSize:11,cursor:"pointer",outline:"none"}}>
                            {["Applied","Screening","Interview Scheduled","Interview Done","Offer Received","Accepted","Rejected","Withdrawn"].map(s=><option key={s}>{s}</option>)}
                          </select>
                        </td>
                        {["interviewDate","interviewTime","interviewType","notes"].map(k=>(
                          <td key={k} style={{padding:"4px 8px"}}><input value={row[k]} onChange={e=>setGmailRows(rs=>rs.map((r,j)=>j===i?{...r,[k]:e.target.value}:r))} placeholder={k==="interviewType"?"Video/Phone/In-person":k==="notes"?"Notes…":""} style={{background:"transparent",border:"none",color:"#e2e8f0",fontFamily:"inherit",fontSize:12,width:"100%",outline:"none",padding:"2px 0"}}/></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={()=>setGmailRows(rs=>[...rs,{id:rs.length+1,date:"",company:"",jobTitle:"",status:"Applied",interviewDate:"",interviewTime:"",interviewType:"",notes:""}])}
                style={{width:"100%",marginTop:10,background:"rgba(16,185,129,0.08)",border:"1px dashed rgba(16,185,129,0.3)",color:"#10b981",borderRadius:10,padding:"11px",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,transition:"all .2s"}}>
                ＋ Add New Application
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Settings */}
      {showSettings&&(
        <Modal title="⚙️ AI & Integrations Settings" onClose={()=>setShowSettings(false)}>
          <F label="NVIDIA API Key *"><Inp type="password" value={geminiKey} onChange={e=>setGeminiKey(e.target.value)} placeholder="nvapi-…"/></F>
          <F label="API Base URL"><Inp value={proxyUrl} onChange={e=>setProxyUrl(e.target.value)} placeholder="https://integrate.api.nvidia.com/v1/chat/completions"/></F>
          <F label="AI Model"><Inp value={aiModel} onChange={e=>setAiModel(e.target.value)} placeholder="deepseek-ai/deepseek-r1"/></F>
          <F label="Google Client ID (for Gmail Scanner)"><Inp value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="…apps.googleusercontent.com"/></F>
          <div style={{borderTop:"1px solid #1e293b",margin:"14px 0 14px",paddingTop:14}}>
            <div style={{color:"#06b6d4",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>
              🟢 Adzuna Job Search (Real Listings)
            </div>
            <F label="Adzuna App ID"><Inp value={adzunaId} onChange={e=>setAdzunaId(e.target.value)} placeholder="e.g. 538be205"/></F>
            <F label="Adzuna App Key"><Inp type="password" value={adzunaKey} onChange={e=>setAdzunaKey(e.target.value)} placeholder="your_app_key"/></F>
          </div>
          <div style={{color:"#475569",fontSize:11,marginBottom:16,lineHeight:1.5,padding:"10px 12px",background:"#0a111e",borderRadius:8,border:"1px solid #1e293b"}}>
            ℹ️ Settings are stored in your browser only (localStorage).<br/>
            🤖 Powered by DeepSeek-R1 via NVIDIA NIM API.
          </div>
          <Btn v="pri" onClick={saveSettings} sx={{width:"100%",justifyContent:"center",padding:"11px"}}>Save Settings</Btn>
        </Modal>
      )}

      {/* Add / Edit */}
      {showAdd&&(
        <Modal title={editId?"✏️ Edit Job":"＋ Add Job"} onClose={()=>setShowAdd(false)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <F label="Job Title *"><Inp value={form.title} onChange={e=>upd("title",e.target.value)} placeholder="e.g. Software Engineer"/></F>
            <F label="Company *"><Inp value={form.company} onChange={e=>upd("company",e.target.value)} placeholder="e.g. TCS"/></F>
            <F label="Location"><Inp value={form.location} onChange={e=>upd("location",e.target.value)} placeholder="City / Remote"/></F>
            <F label="Salary"><Inp value={form.salary} onChange={e=>upd("salary",e.target.value)} placeholder="e.g. ₹4 LPA"/></F>
            <F label="Job Type"><Sel value={form.type} onChange={e=>upd("type",e.target.value)} options={TYPES}/></F>
            <F label="Priority"><Sel value={form.priority} onChange={e=>upd("priority",e.target.value)} options={["High","Medium","Low"]}/></F>
            <F label="Status"><Sel value={form.status} onChange={e=>upd("status",e.target.value)} options={STATUS}/></F>
            <F label="Source"><Inp value={form.source} onChange={e=>upd("source",e.target.value)} placeholder="LinkedIn / Naukri…"/></F>
            <F label="Apply Link"><Inp value={form.applylink} onChange={e=>upd("applylink",e.target.value)} placeholder="https://…"/></F>
            <F label="Skills"><Inp value={form.skills} onChange={e=>upd("skills",e.target.value)} placeholder="Python, SQL…"/></F>
            <F label="Applied Date"><Inp type="date" value={form.applieddate} onChange={e=>upd("applieddate",e.target.value)}/></F>
            <F label="Deadline"><Inp type="date" value={form.deadline} onChange={e=>upd("deadline",e.target.value)}/></F>
          </div>
          <F label="Notes"><Txt value={form.notes} onChange={e=>upd("notes",e.target.value)} placeholder="Interview notes, requirements, contacts…" rows={2}/></F>
          <Btn v="pri" onClick={saveJob} sx={{width:"100%",justifyContent:"center",marginTop:6,padding:"11px"}}>{editId?"Save Changes":"Add to Tracker"}</Btn>
        </Modal>
      )}

      {/* ══ Job Search Modal ══ */}
      {showSearch&&(
        <Modal title="🔍 Job Search" onClose={()=>{setShowSearch(false);setSr([]);setSq("");setSErr("");}} wide>
          {/* Status bar */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,padding:"8px 12px",background:"#0a111e",borderRadius:8,border:"1px solid #1e293b",fontSize:12}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:adzunaId&&adzunaKey?"#22c55e":"#f59e0b",flexShrink:0}}/>
            <span style={{color:adzunaId&&adzunaKey?"#86efac":"#fbbf24"}}>
              {adzunaId&&adzunaKey ? "Live jobs via Adzuna — real listings with direct apply links" : "Add Adzuna credentials in ⚙️ Settings to enable live job search"}
            </span>
          </div>

          {/* Main search bar */}
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1,position:"relative"}}>
              <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:14,pointerEvents:"none"}}>🔍</span>
              <input
                value={sq}
                onChange={e=>setSq(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&doSearch()}
                placeholder='e.g. "React developer", "Data analyst fresher", "Python engineer remote"…'
                style={{width:"100%",background:"#0a111e",border:"1px solid #334155",borderRadius:8,padding:"10px 12px 10px 34px",color:"#e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}
              />
            </div>
            <Btn v="pri" onClick={doSearch} disabled={sLoad} sx={{padding:"10px 20px",fontSize:13}}>
              {sLoad ? <><span style={{display:"inline-block",animation:"spin 0.8s linear infinite"}}>◌</span> Searching…</> : "Search"}
            </Btn>
          </div>

          {/* Filter toggle */}
          <button onClick={()=>setShowFilters(f=>!f)} style={{background:"transparent",border:"1px solid #1e293b",borderRadius:8,padding:"6px 12px",color:showFilters?"#818cf8":"#475569",fontSize:11,fontWeight:600,cursor:"pointer",marginBottom:showFilters?10:14,display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",transition:"all .15s"}}>
            <span>{showFilters?"▲":"▼"}</span>
            {showFilters ? "Hide Filters" : "Show Filters"}
            {(sLocation||sJobType!=="all"||sSalaryMin||sCategory)&&(
              <span style={{background:"#4f46e5",color:"#fff",borderRadius:999,padding:"1px 7px",fontSize:10,fontWeight:700}}>
                {[sLocation,sJobType!=="all"?sJobType:"",sSalaryMin,sCategory].filter(Boolean).length} active
              </span>
            )}
          </button>

          {/* Filters panel */}
          {showFilters&&(
            <div style={{background:"#0a111e",border:"1px solid #1e293b",borderRadius:12,padding:16,marginBottom:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <F label="📍 Location">
                <input
                  value={sLocation}
                  onChange={e=>setSLocation(e.target.value)}
                  placeholder="e.g. Chennai, Bangalore, Remote…"
                  style={{width:"100%",background:"#07101f",border:"1px solid #1e293b",borderRadius:8,padding:"8px 11px",color:"#e2e8f0",fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}
                />
              </F>
              <F label="💼 Job Type">
                <select value={sJobType} onChange={e=>setSJobType(e.target.value)} style={{width:"100%",background:"#07101f",border:"1px solid #1e293b",borderRadius:8,padding:"8px 11px",color:"#e2e8f0",fontSize:12,outline:"none",fontFamily:"inherit"}}>
                  <option value="all">All Types</option>
                  <option value="full-time">Full-Time</option>
                  <option value="part-time">Part-Time</option>
                  <option value="contract">Contract</option>
                  <option value="permanent">Permanent</option>
                </select>
              </F>
              <F label="🏷️ Category">
                <select value={sCategory} onChange={e=>setSCategory(e.target.value)} style={{width:"100%",background:"#07101f",border:"1px solid #1e293b",borderRadius:8,padding:"8px 11px",color:"#e2e8f0",fontSize:12,outline:"none",fontFamily:"inherit"}}>
                  {ADZUNA_CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </F>
              <F label="💰 Min Salary (₹/yr)">
                <input
                  type="number"
                  value={sSalaryMin}
                  onChange={e=>setSSalaryMin(e.target.value)}
                  placeholder="e.g. 300000 for ₹3 LPA"
                  style={{width:"100%",background:"#07101f",border:"1px solid #1e293b",borderRadius:8,padding:"8px 11px",color:"#e2e8f0",fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}
                />
              </F>
              {/* Quick location chips */}
              <div style={{gridColumn:"1 / -1"}}>
                <div style={{color:"#334155",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:7}}>Quick Locations</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {["Chennai","Bangalore","Mumbai","Hyderabad","Pune","Delhi","Remote","Coimbatore"].map(loc=>(
                    <button key={loc} className={`filter-chip${sLocation===loc?" active":""}`} onClick={()=>setSLocation(sLocation===loc?"":loc)}>{loc}</button>
                  ))}
                </div>
              </div>
              {/* Quick category chips */}
              <div style={{gridColumn:"1 / -1"}}>
                <div style={{color:"#334155",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:7}}>Quick Categories</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {[["it-jobs","💻 IT"],["engineering-jobs","⚙️ Engineering"],["graduate-jobs","🎓 Fresher"],["accounting-finance-jobs","💹 Finance"],["marketing-jobs","📣 Marketing"]].map(([val,label])=>(
                    <button key={val} className={`filter-chip${sCategory===val?" active":""}`} onClick={()=>setSCategory(sCategory===val?"":val)}>{label}</button>
                  ))}
                </div>
              </div>
              {/* Reset */}
              <div style={{gridColumn:"1 / -1",textAlign:"right"}}>
                <button onClick={()=>{setSLocation("");setSJobType("all");setSSalaryMin("");setSCategory("");}} style={{background:"transparent",border:"none",color:"#ef4444",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✕ Reset all filters</button>
              </div>
            </div>
          )}

          {/* Results */}
          {sLoad&&!sr.length&&(
            <div style={{textAlign:"center",padding:"36px",color:"#334155"}}>
              <div style={{fontSize:32,display:"inline-block",animation:"spin 1.2s linear infinite"}}>🔍</div>
              <p style={{fontSize:12,marginTop:10,color:"#475569"}}>Searching Adzuna for live jobs…</p>
            </div>
          )}
          {sErr&&<div style={{background:"#2a0a0a",border:"1px solid #7f1d1d",borderRadius:8,padding:"10px 14px",color:"#f87171",fontSize:12,marginBottom:12}}>{sErr}</div>}

          {sr.length>0&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span style={{color:"#475569",fontSize:12}}>{sr.length} jobs found</span>
                <span style={{color:"#334155",fontSize:11}}>Click + to add to tracker</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:460,overflowY:"auto"}}>
                {sr.map((r,i)=>(
                  <div key={i} style={{background:"#0a111e",border:"1px solid #1e293b",borderRadius:10,padding:14,display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",transition:"border-color .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="#334155"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="#1e293b"}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:4}}>
                        <div style={{color:"#e2e8f0",fontWeight:700,fontSize:13,lineHeight:1.3}}>
                          {r.applylink
                            ? <a href={r.applylink} target="_blank" rel="noreferrer" style={{color:"#60a5fa",textDecoration:"none"}}>{r.title} ↗</a>
                            : r.title}
                        </div>
                        {r.postedDate&&<span style={{color:"#334155",fontSize:10,whiteSpace:"nowrap",flexShrink:0}}>{r.postedDate}</span>}
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:6}}>
                        <span style={{color:"#64748b",fontSize:12,fontWeight:600}}>{r.company}</span>
                        {r.location&&<span style={{color:"#334155",fontSize:11}}>📍 {r.location}</span>}
                        <span style={{color:"#a78bfa",fontSize:11,fontWeight:600}}>{r.salary}</span>
                        <span style={{background:"#0f172a",border:"1px solid #1e293b",color:"#64748b",padding:"1px 7px",borderRadius:999,fontSize:10}}>{r.type}</span>
                        {r.category&&<span style={{color:"#334155",fontSize:10}}>🏷 {r.category}</span>}
                      </div>
                      {r.skills&&(
                        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
                          {r.skills.split(", ").map(sk=>(
                            <span key={sk} style={{background:"rgba(99,102,241,0.12)",border:"1px solid rgba(99,102,241,0.25)",color:"#a5b4fc",padding:"1px 7px",borderRadius:999,fontSize:10,fontWeight:600}}>{sk}</span>
                          ))}
                        </div>
                      )}
                      {r.description&&<div style={{color:"#475569",fontSize:11,lineHeight:1.5,marginTop:2}}>{r.description}</div>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                      <Btn v="grn" onClick={()=>addFromSearch(r)} sx={{padding:"5px 12px",fontSize:11}}>+ Add</Btn>
                      {r.applylink&&(
                        <a href={r.applylink} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}>
                          <Btn v="pri" sx={{padding:"5px 12px",fontSize:11,width:"100%",justifyContent:"center"}}>Apply ↗</Btn>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={doSearchMore} disabled={sLoad} style={{
                width:"100%",marginTop:10,
                background:"rgba(6,182,212,0.08)",border:"1px dashed rgba(6,182,212,0.3)",
                color:"#06b6d4",borderRadius:10,padding:"10px",
                cursor:sLoad?"not-allowed":"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,
                opacity:sLoad?0.5:1
              }}>
                {sLoad ? "Loading…" : `⬇ Load More (page ${sPage + 1})`}
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Detail */}
      {showDetail&&(
        <Modal title={showDetail.title} onClose={()=>setShowDetail(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
            {[["Company",showDetail.company],["Location",showDetail.location],["Type",showDetail.type],["Salary",showDetail.salary],["Skills",showDetail.skills],["Source",showDetail.source],["Priority",showDetail.priority],["Applied",fmtDate(showDetail.applieddate)],["Deadline",showDetail.deadline?fmtDate(showDetail.deadline):"—"]].map(([k,v])=>v&&(
              <div key={k} style={{background:"#0a111e",border:"1px solid #1e293b",borderRadius:8,padding:10}}>
                <div style={{color:"#1e293b",fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>{k}</div>
                <div style={{color:"#94a3b8",fontSize:12}}>{v}</div>
              </div>
            ))}
          </div>
          {showDetail.notes&&<div style={{background:"#0a111e",border:"1px solid #1e293b",borderRadius:8,padding:12,marginBottom:12}}>
            <div style={{color:"#1e293b",fontSize:9,fontWeight:700,letterSpacing:"0.1em",marginBottom:6}}>NOTES</div>
            <div style={{color:"#64748b",fontSize:12,lineHeight:1.6}}>{showDetail.notes}</div>
          </div>}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {showDetail.applylink&&<a href={showDetail.applylink} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn v="pri">Apply Now ↗</Btn></a>}
            <Btn onClick={()=>{addToCalendar(showDetail);setShowDetail(null);}}>📅 Calendar</Btn>
            <Btn onClick={()=>{doPrep(showDetail);setShowDetail(null);}}>🎙 Interview Prep</Btn>
            <Btn onClick={()=>{setShowCover(showDetail);setCoverOut("");setShowDetail(null);}}>✉ Cover Letter</Btn>
          </div>
        </Modal>
      )}

      {/* Interview Prep */}
      {showPrep&&(
        <Modal title={`🎙 Interview Prep — ${showPrep.title}`} onClose={()=>{setShowPrep(null);setPrepOut("");}} wide>
          {prepLoad&&<div style={{textAlign:"center",padding:"28px",color:"#334155"}}><div style={{fontSize:28,display:"inline-block",animation:"spin 1.2s linear infinite"}}>⚡</div><p style={{fontSize:11,marginTop:8}}>Generating prep guide…</p></div>}
          {!prepLoad&&prepOut&&<div style={{background:"#0a111e",border:"1px solid #1e293b",borderRadius:10,padding:16,whiteSpace:"pre-wrap",lineHeight:1.75,fontSize:13,color:"#94a3b8",maxHeight:500,overflowY:"auto"}}>{prepOut}</div>}
          {!prepOut&&!prepLoad&&<Btn v="pri" onClick={()=>doPrep(showPrep)}>⚡ Generate Prep Guide</Btn>}
          {prepOut&&!prepLoad&&<div style={{display:"flex",gap:8,marginTop:12}}>
            <Btn v="pri" onClick={()=>doPrep(showPrep)}>🔄 Regenerate</Btn>
            <Btn onClick={()=>{navigator.clipboard?.writeText(prepOut);notify("Copied ✓");}}>📋 Copy</Btn>
            <Btn v="cyn" onClick={()=>saveToDrive(`Interview_Prep_${showPrep.company}.txt`,prepOut)}>📥 Save to Drive</Btn>
          </div>}
        </Modal>
      )}

      {/* Cover Letter */}
      {showCover&&(
        <Modal title={`✉ Cover Letter — ${showCover.title} @ ${showCover.company}`} onClose={()=>{setShowCover(null);setCoverOut("");}} wide>
          <F label="Your background (optional)">
            <Txt value={bio} onChange={e=>setBio(e.target.value)} placeholder="e.g. Final year BE CSE student with ML and Python projects…" rows={2}/>
          </F>
          <Btn v="amb" onClick={()=>doCover(showCover)} disabled={coverLoad}>{coverLoad?"Generating…":"⚡ Generate Cover Letter"}</Btn>
          {coverLoad&&<div style={{textAlign:"center",padding:"20px",color:"#334155",animation:"pulse 1.2s infinite"}}>✍️ Writing your letter…</div>}
          {coverOut&&!coverLoad&&(
            <>
              <div style={{background:"#0a111e",border:"1px solid #1e293b",borderRadius:10,padding:16,whiteSpace:"pre-wrap",lineHeight:1.8,fontSize:13,color:"#94a3b8",marginTop:14,maxHeight:460,overflowY:"auto"}}>{coverOut}</div>
              <div style={{display:"flex",gap:8,marginTop:12}}>
                <Btn onClick={()=>{navigator.clipboard?.writeText(coverOut);notify("Copied ✓");}}>📋 Copy Letter</Btn>
                <Btn v="cyn" onClick={()=>saveToDrive(`Cover_Letter_${showCover.company}.txt`,coverOut)}>📥 Save to Drive</Btn>
                <Btn onClick={()=>doCover(showCover)}>🔄 Regenerate</Btn>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
