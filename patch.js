const fs = require('fs');
let code = fs.readFileSync('./src/Dashboard.jsx', 'utf-8');

// 1. imports
code = code.replace(/import \{ useState, useRef \} from "react";/, 'import { useState, useRef, useEffect } from "react";\nimport { supabase } from "./supabase";');

// 2. component signature
code = code.replace(/export default function App\(\) \{/, 'export default function Dashboard({ session }) {');

// 3. state fixes
code = code.replace(/const \[jobs, setJobs\][ \t]*=[ \t]*useState\(SEED\);\n[ \t]*const \[nid,[ \t]*setNid\][ \t]*=[ \t]*useState\(4\);/, `const [jobs, setJobs] = useState([]);
  
  useEffect(() => { fetchJobs(); }, [session]);
  const fetchJobs = async () => {
    const { data } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    if (data) setJobs(data);
  };`);

// 4. saveJob
code = code.replace(/function saveJob\(\) \{[\s\S]*?setShowAdd\(false\);\n[ \t]*\}/, `async function saveJob() {
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
  }`);

// 5. delJob & setStatus
code = code.replace(/function delJob\(id\) \{[^\}]+\}/, `async function delJob(id) {
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (!error) { fetchJobs(); notify("Removed"); }
  }`);
code = code.replace(/function setStatus\(id,status\) \{[^\}]+\}/, `async function setStatus(id,status) {
    const { error } = await supabase.from('jobs').update({status}).eq('id', id);
    if (!error) fetchJobs();
  }`);

// 6. remove AI features safely by stubbing them
code = code.replace(/async function doSearch\(\)[ \s\S]*?setSLoad\(false\);\n[ \t]*\}/, `async function doSearch() { notify("AI feature disconnected.", "err"); }`);
code = code.replace(/async function doPrep[\s\S]*?setPrepLoad\(false\);\n[ \t]*\}/, `async function doPrep() { notify("AI feature disconnected.", "err"); }`);
code = code.replace(/async function doCover[\s\S]*?setCoverLoad\(false\);\n[ \t]*\}/, `async function doCover() { notify("AI feature disconnected.", "err"); }`);
code = code.replace(/async function startGmailScan[\s\S]*?setGmailLoading\(false\);\n[ \t]*\}/, `async function startGmailScan() { notify("MCP Gmail module disconnected.", "err"); }`);

// 7. Excel Import Fix
code = code.replace(/const mapped=rows\.map[\s\S]*?setJobs\(js=>\[\.\.\.js,\.\.\.mapped\]\); setNid\(n=>n\+mapped\.length\); notify\(\`Imported \$\{mapped\.length\} jobs ✓\`\);/, `const mapped=rows.map((r)=>({title:r["Job Title"]||r.title||"Untitled",company:r.Company||r.company||"",location:r.Location||r.location||"",type:r.Type||r.type||"Full-time",salary:r.Salary||r.salary||"",skills:r.Skills||r.skills||"",source:r.Source||r.source||"Import",applyLink:r["Apply Link"]||r.applyLink||"",status:r.Status||r.status||"Bookmarked",priority:r.Priority||r.priority||"Medium",appliedDate:r["Applied Date"]||r.appliedDate||"",deadline:r.Deadline||r.deadline||"",notes:r.Notes||r.notes||"",user_id:session.user.id}));
        supabase.from('jobs').insert(mapped).then(({error})=>{ if(!error){ fetchJobs(); notify("Imported Excel Data ✓"); } });`);

// 8. Add Sign Out header button & remove old AI search
code = code.replace(/<Btn onClick=\{\(\)=>setShowSearch\(true\)\} v="pri">🔍 AI Search<\/Btn>/, `<Btn onClick={() => supabase.auth.signOut()} v="red">⏏️ Logout</Btn>`);

fs.writeFileSync('./src/Dashboard.jsx', code);
