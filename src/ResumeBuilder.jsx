// src/ResumeBuilder.jsx — AI Resume Builder v2.1
// A4 preview · Black professional template · Editable skill chips · Projects · ATS checker

import { useState, useRef } from 'react';
import { cleanAI } from './utils/cleanAI';

function SkillChips({ value, onChange, placeholder = 'Type skill + Enter…' }) {
  const [input, setInput] = useState('');
  const inputRef = useRef();
  const skills = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];

  const addSkill = (raw) => {
    const parts = raw.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
    const unique = [...new Set([...skills, ...parts])];
    onChange(unique.join(', '));
    setInput('');
  };
  const removeSkill = (i) => onChange(skills.filter((_, idx) => idx !== i).join(', '));
  const handleKey = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) { e.preventDefault(); addSkill(input); }
    if (e.key === 'Backspace' && !input && skills.length) removeSkill(skills.length - 1);
  };
  const handlePaste = (e) => { e.preventDefault(); addSkill(e.clipboardData.getData('text')); };

  return (
    <div onClick={() => inputRef.current?.focus()} style={{ display:'flex',flexWrap:'wrap',gap:6,padding:'8px 10px',background:'#070f1c',border:'1px solid #1e2d45',borderRadius:8,cursor:'text',minHeight:44,alignItems:'center' }}>
      {skills.map((sk, i) => (
        <span key={i} style={{ display:'inline-flex',alignItems:'center',gap:4,background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.35)',color:'#a5b4fc',padding:'3px 10px',borderRadius:999,fontSize:12,fontWeight:600 }}>
          {sk}
          <button onClick={e => { e.stopPropagation(); removeSkill(i); }} style={{ background:'none',border:'none',color:'#6b7280',cursor:'pointer',fontSize:13,padding:'0 0 0 2px',lineHeight:1 }}>×</button>
        </span>
      ))}
      <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} onPaste={handlePaste} onBlur={() => input.trim() && addSkill(input)} placeholder={skills.length === 0 ? placeholder : ''} style={{ background:'none',border:'none',outline:'none',color:'#e2e8f0',fontSize:12,fontFamily:'inherit',flex:1,minWidth:120 }} />
      {skills.length > 0 && <span style={{ fontSize:10,color:'#334155',marginLeft:'auto' }}>{skills.length} skills</span>}
    </div>
  );
}

function Btn({ children, onClick, style = {}, disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background:'#0d1526', border:'1px solid #1e2d45', color:'#94a3b8', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:disabled?'not-allowed':'pointer', display:'inline-flex', alignItems:'center', gap:6, fontFamily:'inherit', transition:'all .15s', opacity:disabled?.5:1, ...style }}>
      {children}
    </button>
  );
}

function AIBtn({ field, prompt, label, generateField, generating, genField }) {
  return (
    <button onClick={() => generateField(field, prompt)} disabled={generating}
      style={{ background:'linear-gradient(135deg,#4c1d95,#5b21b6)', border:'1px solid rgba(139,92,246,0.4)', color:'#c4b5fd', borderRadius:7, padding:'3px 9px', fontSize:10, cursor:generating?'not-allowed':'pointer', display:'inline-flex', alignItems:'center', gap:4, fontFamily:'inherit', opacity:generating?.5:1, marginLeft:6 }}>
      {generating && genField===field ? <span style={{ animation:'spin 0.8s linear infinite', display:'inline-block' }}>◌</span> : '✨'} {label||'AI'}
    </button>
  );
}

const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const nl  = (s) => String(s||'').replace(/\n/g,'<br>');

// ── A4 dimensions: 210mm × 297mm @ 96dpi = 794px × 1123px ──────────────────

// ── Template: Professional (BLACK) ──────────────────────────────────────────
function tplProfessional(d) {
  const skills = (d.skills||'').split(',').filter(s=>s.trim()).map(s =>
    `<span style="display:inline-block;background:#f4f4f5;border:1px solid #d4d4d8;color:#1a1a1a;padding:3px 11px;border-radius:3px;font-size:9pt;margin:2px 3px;">${esc(s.trim())}</span>`
  ).join('');
  const projects = (d.projects||[]).filter(p=>p.name).map(p => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <strong style="font-size:11pt;color:#111">${esc(p.name)}</strong>
        ${p.url?`<a href="${esc(p.url)}" style="color:#111;font-size:9pt;">${esc(p.url)}</a>`:''}
      </div>
      ${p.tech?`<div style="color:#374151;font-size:9.5pt;font-style:italic;margin:2px 0">${esc(p.tech)}</div>`:''}
      ${p.description?`<div style="font-size:10pt;color:#374151;margin-top:3px">${nl(p.description)}</div>`:''}
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Georgia','Times New Roman',serif;color:#111;background:#fff;
  width:210mm;min-height:297mm;padding:18mm 20mm 16mm;font-size:11pt;line-height:1.55}
h1{font-size:24pt;letter-spacing:1.5px;text-transform:uppercase;color:#111;margin-bottom:3px;font-weight:normal}
.tagline{color:#374151;font-size:11pt;font-style:italic;margin-bottom:8px}
.contact{font-size:9.5pt;color:#555;margin-bottom:16px;border-bottom:2.5px double #111;padding-bottom:10px}
.contact a{color:#111;text-decoration:none}
h2{font-size:10pt;letter-spacing:2.5px;text-transform:uppercase;color:#111;margin:18px 0 8px;
  border-bottom:1.5px solid #111;padding-bottom:3px;font-weight:700}
.summary{font-size:10.5pt;line-height:1.7;color:#333}
.body{font-size:10pt;color:#374151;line-height:1.65;white-space:pre-wrap}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media print{body{padding:12mm 16mm;width:210mm;min-height:297mm}}
</style></head><body>
<h1>${esc(d.full_name||'Your Name')}</h1>
${d.headline?`<div class="tagline">${esc(d.headline)}</div>`:''}
<div class="contact">
  ${[d.email,d.phone,d.location].filter(Boolean).map(esc).join('<span style="margin:0 8px;color:#9ca3af">|</span>')}
  ${d.linkedin?`<span style="margin:0 8px;color:#9ca3af">|</span><a href="${esc(d.linkedin)}">${esc(d.linkedin)}</a>`:''}
  ${d.github?`<span style="margin:0 8px;color:#9ca3af">|</span><a href="${esc(d.github)}">${esc(d.github)}</a>`:''}
  ${d.portfolio?`<span style="margin:0 8px;color:#9ca3af">|</span><a href="${esc(d.portfolio)}">${esc(d.portfolio)}</a>`:''}
</div>
${d.summary?`<h2>Professional Summary</h2><p class="summary">${esc(d.summary)}</p>`:''}
${d.experience?`<h2>Experience</h2><div class="body">${nl(d.experience)}</div>`:''}
${d.education?`<h2>Education</h2><div class="body">${nl(d.education)}</div>`:''}
${projects?`<h2>Projects</h2>${projects}`:''}
${skills?`<h2>Technical Skills</h2><div style="margin-top:4px">${skills}</div>`:''}
<div class="two-col">
  ${d.certifications?`<div><h2>Certifications</h2><p style="font-size:10pt;color:#374151">${esc(d.certifications)}</p></div>`:''}
  ${d.languages?`<div><h2>Languages</h2><p style="font-size:10pt;color:#374151">${esc(d.languages)}</p></div>`:''}
</div>
</body></html>`;
}

// ── Template: Modern Sidebar ─────────────────────────────────────────────────
function tplModern(d) {
  const skills = (d.skills||'').split(',').filter(s=>s.trim()).map(s=>`
    <div style="display:flex;align-items:center;gap:8px;margin:5px 0">
      <div style="flex:1;height:3px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:80%;background:linear-gradient(90deg,#a78bfa,#818cf8);border-radius:3px"></div>
      </div>
      <span style="font-size:9pt;color:#c7d2fe;white-space:nowrap">${esc(s.trim())}</span>
    </div>`).join('');
  const projects = (d.projects||[]).filter(p=>p.name).map(p=>`
    <div style="margin-bottom:14px;padding:10px;background:rgba(255,255,255,.04);border-radius:8px;border:1px solid rgba(255,255,255,.08)">
      <div style="font-weight:700;font-size:10pt;color:#e0e7ff">${esc(p.name)}</div>
      ${p.tech?`<div style="color:#a5b4fc;font-size:8.5pt;margin:2px 0">${esc(p.tech)}</div>`:''}
      ${p.description?`<div style="font-size:8.5pt;color:#9ca3af;margin-top:4px;line-height:1.5">${nl(p.description)}</div>`:''}
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Segoe UI','Trebuchet MS',sans-serif;background:#fff;display:flex;
  width:210mm;min-height:297mm;font-size:10.5pt}
.sidebar{width:220px;min-width:220px;background:linear-gradient(160deg,#1e1b4b 0%,#2d2380 60%,#1e3a5f 100%);color:#e0e7ff;padding:32px 20px;flex-shrink:0}
.main{flex:1;padding:34px 28px;background:#fafbff;overflow:hidden}
.avatar{width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:24pt;font-weight:bold;color:#fff;margin-bottom:12px}
h1{font-size:16pt;color:#fff;font-weight:700;line-height:1.2;margin-bottom:3px}
.tagline{color:#a5b4fc;font-size:9pt;font-style:italic;margin-bottom:16px}
.sidebar h3{font-size:7pt;letter-spacing:2.5px;text-transform:uppercase;color:#818cf8;margin:14px 0 6px;padding-bottom:3px;border-bottom:1px solid rgba(129,140,248,.2)}
.ci{font-size:8pt;color:#c7d2fe;margin:4px 0;word-break:break-all;line-height:1.4}
.main h2{font-size:12pt;color:#1e1b4b;font-weight:800;margin:0 0 8px;padding-bottom:4px;border-bottom:3px solid #7c3aed;display:inline-block}
.sec{margin-bottom:18px}
.body{font-size:10pt;color:#374151;line-height:1.65;white-space:pre-wrap}
@media print{body{width:210mm;min-height:297mm}}
</style></head><body>
<div class="sidebar">
  <div class="avatar">${(d.full_name||'Y').charAt(0).toUpperCase()}</div>
  <h1>${esc(d.full_name||'Your Name')}</h1>
  ${d.headline?`<div class="tagline">${esc(d.headline)}</div>`:''}
  <h3>Contact</h3>
  ${d.email?`<div class="ci">✉ ${esc(d.email)}</div>`:''}
  ${d.phone?`<div class="ci">📞 ${esc(d.phone)}</div>`:''}
  ${d.location?`<div class="ci">📍 ${esc(d.location)}</div>`:''}
  ${d.linkedin?`<div class="ci">🔗 ${esc(d.linkedin)}</div>`:''}
  ${d.github?`<div class="ci">💻 ${esc(d.github)}</div>`:''}
  ${d.skills?`<h3>Skills</h3>${skills}`:''}
  ${d.certifications?`<h3>Certifications</h3><div style="font-size:8pt;color:#c7d2fe;line-height:1.6">${esc(d.certifications)}</div>`:''}
  ${d.languages?`<h3>Languages</h3><div style="font-size:8pt;color:#c7d2fe">${esc(d.languages)}</div>`:''}
  ${projects?`<h3>Projects</h3>${projects}`:''}
</div>
<div class="main">
  ${d.summary?`<div class="sec"><h2>Profile</h2><br><p style="font-size:10.5pt;line-height:1.7;color:#374151">${esc(d.summary)}</p></div>`:''}
  ${d.experience?`<div class="sec"><h2>Experience</h2><br><div class="body">${nl(d.experience)}</div></div>`:''}
  ${d.education?`<div class="sec"><h2>Education</h2><br><div class="body">${nl(d.education)}</div></div>`:''}
</div>
</body></html>`;
}

// ── Template: Minimal ────────────────────────────────────────────────────────
function tplMinimal(d) {
  const skills = (d.skills||'').split(',').filter(s=>s.trim());
  const projects = (d.projects||[]).filter(p=>p.name).map(p=>`
    <div style="margin-bottom:12px;padding-left:14px;border-left:2px solid #d1fae5">
      <div style="font-weight:600;font-size:11pt;color:#065f46">${esc(p.name)}${p.url?` <a href="${esc(p.url)}" style="color:#0f766e;font-size:9pt;font-weight:normal">↗</a>`:''}</div>
      ${p.tech?`<div style="color:#6b7280;font-size:9.5pt;margin:2px 0">${esc(p.tech)}</div>`:''}
      ${p.description?`<div style="font-size:10pt;color:#374151;margin-top:4px;line-height:1.6">${nl(p.description)}</div>`:''}
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Helvetica Neue','Arial',sans-serif;color:#111;background:#fff;
  width:210mm;min-height:297mm;padding:18mm 22mm 16mm;font-size:10.5pt;line-height:1.6}
h1{font-size:28pt;font-weight:200;letter-spacing:-1px;color:#111;margin-bottom:2px}
.tag{color:#0f766e;font-size:11pt;font-weight:500;margin-bottom:10px}
.meta{font-size:9.5pt;color:#6b7280;display:flex;flex-wrap:wrap;gap:12px;padding:10px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:26px}
.meta a{color:#0f766e;text-decoration:none}
h2{font-size:8pt;letter-spacing:4px;text-transform:uppercase;color:#0f766e;font-weight:700;margin:22px 0 9px}
p,.body{font-size:10.5pt;color:#374151;line-height:1.75}
.skills{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.sk{background:#f0fdf4;border:1px solid #bbf7d0;color:#065f46;padding:3px 12px;border-radius:999px;font-size:9pt}
@media print{body{padding:12mm 16mm;width:210mm;min-height:297mm}}
</style></head><body>
<h1>${esc(d.full_name||'Your Name')}</h1>
${d.headline?`<div class="tag">${esc(d.headline)}</div>`:''}
<div class="meta">
  ${[d.email,d.phone,d.location].filter(Boolean).map(esc).join('<span>·</span>')}
  ${d.linkedin?`<span>·</span><a href="${esc(d.linkedin)}">${esc(d.linkedin)}</a>`:''}
  ${d.github?`<span>·</span><a href="${esc(d.github)}">${esc(d.github)}</a>`:''}
</div>
${d.summary?`<h2>About</h2><p>${esc(d.summary)}</p>`:''}
${d.experience?`<h2>Experience</h2><div class="body" style="white-space:pre-wrap">${nl(d.experience)}</div>`:''}
${d.education?`<h2>Education</h2><div class="body" style="white-space:pre-wrap">${nl(d.education)}</div>`:''}
${projects?`<h2>Projects</h2>${projects}`:''}
${skills.length?`<h2>Skills</h2><div class="skills">${skills.map(s=>`<span class="sk">${esc(s.trim())}</span>`).join('')}</div>`:''}
${d.certifications?`<h2>Certifications</h2><p>${esc(d.certifications)}</p>`:''}
${d.languages?`<h2>Languages</h2><p>${esc(d.languages)}</p>`:''}
</body></html>`;
}

// ── Template: ATS Pro ────────────────────────────────────────────────────────
function tplATS(d) {
  const skills = (d.skills||'').split(',').filter(s=>s.trim()).join(' • ');
  const projects = (d.projects||[]).filter(p=>p.name).map(p=>
    `<p style="margin-bottom:8px"><strong>${esc(p.name)}</strong>${p.tech?` | ${esc(p.tech)}`:''}<br>${p.description?`<span style="font-size:10pt">${nl(p.description)}</span>`:''}</p>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Arial','Helvetica',sans-serif;color:#000;background:#fff;
  width:210mm;min-height:297mm;padding:16mm 20mm 14mm;font-size:11pt;line-height:1.5}
h1{font-size:18pt;font-weight:bold;text-align:center;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.contact{text-align:center;font-size:10pt;color:#333;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #000}
h2{font-size:11pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #000;padding-bottom:2px;margin:16px 0 8px}
p,.body{font-size:10.5pt;color:#111;line-height:1.6}
@media print{body{padding:10mm 14mm;width:210mm;min-height:297mm}}
</style></head><body>
<h1>${esc(d.full_name||'YOUR NAME')}</h1>
${d.headline?`<div style="text-align:center;font-style:italic;font-size:11pt;color:#444;margin-bottom:6px">${esc(d.headline)}</div>`:''}
<div class="contact">${[d.email,d.phone,d.location,d.linkedin,d.github].filter(Boolean).map(esc).join(' | ')}</div>
${d.summary?`<h2>Professional Summary</h2><p>${esc(d.summary)}</p>`:''}
${skills?`<h2>Core Competencies</h2><p>${esc(skills)}</p>`:''}
${d.experience?`<h2>Professional Experience</h2><div class="body" style="white-space:pre-wrap">${nl(d.experience)}</div>`:''}
${d.education?`<h2>Education</h2><div class="body" style="white-space:pre-wrap">${nl(d.education)}</div>`:''}
${projects?`<h2>Projects</h2>${projects}`:''}
${d.certifications?`<h2>Certifications</h2><p>${esc(d.certifications)}</p>`:''}
${d.languages?`<h2>Languages</h2><p>${esc(d.languages)}</p>`:''}
</body></html>`;
}

const TEMPLATES = {
  professional: { name:'Professional', icon:'🏢', color:'#111827', accent:'#111', desc:'Classic black serif — timeless & elegant', fn:tplProfessional },
  modern:       { name:'Modern',       icon:'✨', color:'#1e1b4b', accent:'#7c3aed', desc:'Sidebar design — bold & contemporary', fn:tplModern },
  minimal:      { name:'Minimal',      icon:'🎯', color:'#064e3b', accent:'#0f766e', desc:'Ultra-clean — lets content shine', fn:tplMinimal },
  ats:          { name:'ATS Pro',      icon:'🤖', color:'#111827', accent:'#374151', desc:'Optimized for applicant tracking systems', fn:tplATS },
};

const BLANK_PROJECT = { name:'', description:'', tech:'', url:'' };

export default function ResumeBuilder({ profile = {}, onSaveProfile, callAI, notify }) {
  const [selectedTpl, setSelectedTpl] = useState('professional');
  const [data, setData] = useState({
    ...profile,
    projects: Array.isArray(profile.projects)
      ? profile.projects
      : (typeof profile.projects === 'string' && profile.projects
          ? (() => { try { return JSON.parse(profile.projects); } catch { return [{ ...BLANK_PROJECT }]; } })()
          : [{ ...BLANK_PROJECT }]),
  });
  const [generating, setGenerating] = useState(false);
  const [genField, setGenField]     = useState('');
  const [jobTarget, setJobTarget]   = useState('');
  const [atsScore, setAtsScore]     = useState(null);
  const [tab, setTab]               = useState('editor');

  const upd = (k, v) => setData(p => ({ ...p, [k]: v }));
  const updProject = (i, k, v) => setData(p => {
    const projects = [...(p.projects||[])];
    projects[i] = { ...projects[i], [k]: v };
    return { ...p, projects };
  });
  const addProject    = () => setData(p => ({ ...p, projects: [...(p.projects||[]), { ...BLANK_PROJECT }] }));
  const removeProject = (i) => setData(p => ({ ...p, projects: (p.projects||[]).filter((_,j)=>j!==i) }));

  const previewHTML = TEMPLATES[selectedTpl].fn(data);

  async function generateField(field, instructions) {
    if (!callAI) return notify('AI not configured — add API key in ⚙️ Settings', 'err');
    setGenerating(true); setGenField(field);
    try {
      const ctx = `Name:${data.full_name||''}, Skills:${data.skills||''}, Exp:${(data.experience||'').slice(0,300)}, Edu:${data.education||''}`;
      const raw = await callAI(`${instructions}\n\nContext:\n${ctx}${jobTarget?`\nTarget:${jobTarget}`:''}`, 'Expert resume writer. Plain text only. No *, #, **. Bullet points as "• " only.');
      upd(field, cleanAI(raw.trim()));
      notify(`✓ ${field} updated`);
    } catch (err) { notify('AI error: '+err.message, 'err'); }
    setGenerating(false); setGenField('');
  }

  async function generateProjectDescription(i) {
    if (!callAI) return notify('AI not configured', 'err');
    const proj = data.projects?.[i];
    if (!proj?.name) return notify('Enter project name first', 'err');
    setGenerating(true); setGenField(`proj_${i}`);
    try {
      const raw = await callAI(`Write a concise 2-3 sentence project description for resume:\nProject:${proj.name}\nTech:${proj.tech||'not specified'}\nDeveloper skills:${data.skills||'general'}\n${jobTarget?`Target:${jobTarget}`:''}\nAction verbs, plain text, no markdown.`, 'Return only description text.');
      updProject(i, 'description', cleanAI(raw.trim()));
      notify('Project description generated ✓');
    } catch (err) { notify('AI error: '+err.message, 'err'); }
    setGenerating(false); setGenField('');
  }

  async function generateFullResume() {
    if (!callAI) return notify('AI not configured', 'err');
    setGenerating(true); setGenField('full');
    try {
      const raw = await callAI(`Create complete ATS resume JSON:\nName:${data.full_name||'Candidate'}\nRole:${jobTarget||data.target_roles||'Software Engineer'}\nSkills:${data.skills||'N/A'}\nEdu:${data.education||'N/A'}\nExp:${(data.experience||'N/A').slice(0,300)}\n\nReturn ONLY JSON keys: summary,experience,skills(comma-separated),education,certifications.\nPlain text only, no markdown.`, 'Return ONLY valid JSON.');
      const clean = raw.replace(/```json|```/g,'').trim();
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        Object.keys(parsed).forEach(k => { if (typeof parsed[k]==='string') parsed[k]=cleanAI(parsed[k]); });
        setData(p => ({ ...p, ...parsed }));
        notify('✓ Full resume generated!');
      }
    } catch (err) { notify('Generation error: '+err.message, 'err'); }
    setGenerating(false); setGenField('');
  }

  async function checkATS() {
    if (!callAI) return notify('AI not configured', 'err');
    if (!jobTarget.trim()) return notify('Enter target job role first', 'err');
    setGenerating(true); setGenField('ats');
    try {
      const resumeText = `${data.summary||''} ${data.experience||''} ${data.skills||''} ${data.education||''} ${(data.projects||[]).map(p=>`${p.name} ${p.tech} ${p.description}`).join(' ')}`;
      const result = await callAI(`Analyze resume vs "${jobTarget}"\n\n${resumeText.slice(0,2000)}\n\nJSON:{score:0-100,missing_keywords:[],strengths:[],improvements:[],verdict:"string"}`, 'Return ONLY valid JSON.');
      const match = result.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/);
      if (match) { setAtsScore(JSON.parse(match[0])); setTab('ats'); }
    } catch (err) { notify('ATS error: '+err.message, 'err'); }
    setGenerating(false); setGenField('');
  }

  function openPrint() {
    const w = window.open('','_blank');
    w.document.write(previewHTML);
    w.document.close();
    setTimeout(() => w.print(), 600);
  }
  function downloadHTML() {
    const blob = new Blob([previewHTML], { type:'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Resume_${(data.full_name||'Resume').replace(/\s+/g,'_')}.html`;
    a.click(); URL.revokeObjectURL(url);
    notify('HTML downloaded — open in Chrome → Print → Save as PDF (A4, no margins) ✓');
  }
  function syncToProfile() {
    if (onSaveProfile) {
      const { projects, ...rest } = data;
      onSaveProfile({ ...rest, projects: JSON.stringify(projects||[]) });
      notify('✓ Synced to profile');
    }
  }

  const S = {
    card: { background:'#06101e', border:'1px solid #1e2d45', borderRadius:14, padding:20 },
    lbl:  { color:'#475569', fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6, display:'flex', alignItems:'center', justifyContent:'space-between' },
    inp:  { width:'100%', background:'#070f1c', border:'1px solid #1e2d45', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit', marginBottom:12 },
    ta:   { width:'100%', background:'#070f1c', border:'1px solid #1e2d45', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontSize:12, outline:'none', resize:'vertical', fontFamily:'inherit', marginBottom:12, lineHeight:1.6, boxSizing:'border-box' },
    spin: { animation:'spin 0.8s linear infinite', display:'inline-block' },
  };


  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .proj-card:hover{border-color:#1e2d45!important}`}</style>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:'#f1f5f9', margin:0 }}>📄 AI Resume Builder</h2>
          <p style={{ color:'#475569', fontSize:12, marginTop:4 }}>A4 format · Black professional template · 4 designs · ATS checker · PDF export</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <Btn onClick={syncToProfile} style={{ background:'linear-gradient(135deg,#064e3b,#065f46)', border:'1px solid rgba(34,197,94,.2)', color:'#6ee7b7' }}>🔄 Sync to Profile</Btn>
          <Btn onClick={openPrint}    style={{ background:'linear-gradient(135deg,#1d4ed8,#4f46e5)', border:'none', color:'#fff' }}>🖨 Print / PDF (A4)</Btn>
          <Btn onClick={downloadHTML} style={{ background:'#0e7490', border:'1px solid rgba(6,182,212,.3)', color:'#67e8f9' }}>📥 HTML</Btn>
        </div>
      </div>

      {/* AI Controls */}
      <div style={{ ...S.card, marginBottom:18 }}>
        <div style={{ color:'#a78bfa', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
          ✨ AI Generation
          <span style={{ background:'rgba(139,92,246,.1)', border:'1px solid rgba(139,92,246,.25)', color:'#a78bfa', padding:'1px 8px', borderRadius:999, fontSize:9 }}>No markdown symbols</span>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10, alignItems:'center' }}>
          <input value={jobTarget} onChange={e=>setJobTarget(e.target.value)} placeholder="Target job role or paste job description for AI context…"
            style={{ ...S.inp, flex:1, minWidth:240, margin:0 }} />
          <Btn onClick={generateFullResume} disabled={generating} style={{ background:'linear-gradient(135deg,#4c1d95,#5b21b6)', border:'1px solid rgba(139,92,246,.3)', color:'#c4b5fd', padding:'10px 18px' }}>
            {generating&&genField==='full'?<><span style={S.spin}>◌</span> Generating…</>:'⚡ Generate Full Resume'}
          </Btn>
          <Btn onClick={checkATS} disabled={generating} style={{ background:'#0c4a6e', border:'1px solid rgba(14,116,144,.4)', color:'#67e8f9', padding:'10px 14px' }}>
            {generating&&genField==='ats'?<span style={S.spin}>◌</span>:'🎯'} ATS Check
          </Btn>
        </div>
        <div style={{ fontSize:11, color:'#334155' }}>💡 Enter target role for keyword-optimized content · PDF prints at real A4 size</div>
      </div>

      {/* Template Selector */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {Object.entries(TEMPLATES).map(([key, tpl]) => (
          <button key={key} onClick={() => setSelectedTpl(key)} style={{ background:selectedTpl===key?`${tpl.accent}18`:'#06101e', border:`2px solid ${selectedTpl===key?tpl.accent:'#1e2d45'}`, borderRadius:12, padding:'14px 12px', cursor:'pointer', textAlign:'left', transition:'all .15s', fontFamily:'inherit' }}>
            <div style={{ fontSize:22, marginBottom:6 }}>{tpl.icon}</div>
            <div style={{ color:selectedTpl===key?'#f1f5f9':'#94a3b8', fontWeight:700, fontSize:13, marginBottom:3 }}>{tpl.name}</div>
            <div style={{ color:'#475569', fontSize:10, lineHeight:1.5 }}>{tpl.desc}</div>
            {selectedTpl===key && <div style={{ marginTop:8, background:tpl.accent, color:'#fff', fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:999, display:'inline-block' }}>ACTIVE</div>}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, background:'#070f1c', border:'1px solid #1e2d45', borderRadius:12, padding:4, marginBottom:18, width:'fit-content' }}>
        {[['editor','✏️ Editor'],['preview','👁 A4 Preview'],['ats','🎯 ATS Report']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ background:tab===t?'#1e2d45':'transparent', border:'none', color:tab===t?'#e2e8f0':'#475569', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600, transition:'all .15s' }}>{l}</button>
        ))}
      </div>

      {/* EDITOR */}
      {tab==='editor' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={S.card}>
              <div style={{ color:'#60a5fa', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:14 }}>Personal Info</div>
              {[['full_name','Full Name'],['headline','Professional Headline'],['email','Email'],['phone','Phone'],['location','Location'],['linkedin','LinkedIn URL'],['github','GitHub URL'],['portfolio','Portfolio URL']].map(([k,lbl]) => (
                <div key={k}><label style={S.lbl}>{lbl}</label><input value={data[k]||''} onChange={e=>upd(k,e.target.value)} style={S.inp} placeholder={lbl} /></div>
              ))}
              {[['target_roles','Target Roles'],['target_locations','Target Locations'],['expected_salary','Expected Salary']].map(([k,lbl]) => (
                <div key={k}><label style={{ ...S.lbl, color:'#94a3b8', fontSize:9 }}>{lbl}</label><input value={data[k]||''} onChange={e=>upd(k,e.target.value)} style={{ ...S.inp }} placeholder={lbl} /></div>
              ))}
            </div>

            {/* Projects */}
            <div style={S.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div style={{ color:'#fde047', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>🚀 Projects</div>
                <Btn onClick={addProject} style={{ background:'rgba(253,224,71,.08)', border:'1px solid rgba(253,224,71,.2)', color:'#fde047', padding:'4px 12px', fontSize:11 }}>＋ Add Project</Btn>
              </div>
              {(data.projects||[]).map((proj, i) => (
                <div key={i} className="proj-card" style={{ background:'#070f1c', border:'1px solid #1e2d45', borderRadius:10, padding:14, marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <span style={{ color:'#fde047', fontSize:11, fontWeight:700 }}>Project {i+1}</span>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => generateProjectDescription(i)} disabled={generating}
                        style={{ background:'linear-gradient(135deg,#4c1d95,#5b21b6)', border:'1px solid rgba(139,92,246,.4)', color:'#c4b5fd', borderRadius:7, padding:'3px 9px', fontSize:10, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4, fontFamily:'inherit', opacity:generating?.5:1 }}>
                        {generating&&genField===`proj_${i}`?<span style={S.spin}>◌</span>:'✨'} AI Desc
                      </button>
                      <button onClick={() => removeProject(i)} style={{ background:'rgba(220,38,38,.08)', border:'1px solid #450a0a', color:'#f87171', borderRadius:7, padding:'3px 8px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>✕</button>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div><label style={{ ...S.lbl, fontSize:9 }}>Project Name *</label><input value={proj.name||''} onChange={e=>updProject(i,'name',e.target.value)} style={{ ...S.inp, marginBottom:0 }} placeholder="My App" /></div>
                    <div><label style={{ ...S.lbl, fontSize:9 }}>Tech Stack</label><input value={proj.tech||''} onChange={e=>updProject(i,'tech',e.target.value)} style={{ ...S.inp, marginBottom:0 }} placeholder="React, Node.js" /></div>
                  </div>
                  <div style={{ marginTop:10 }}><label style={{ ...S.lbl, fontSize:9 }}>URL</label><input value={proj.url||''} onChange={e=>updProject(i,'url',e.target.value)} style={S.inp} placeholder="https://github.com/…" /></div>
                  <div><label style={{ ...S.lbl, fontSize:9 }}>Description</label><textarea value={proj.description||''} onChange={e=>updProject(i,'description',e.target.value)} rows={3} style={S.ta} placeholder="Built a full-stack app that…&#10;• Key achievement 1" /></div>
                </div>
              ))}
              {(!data.projects||data.projects.length===0) && <div style={{ color:'#1e2d45', fontSize:12, textAlign:'center', padding:'20px 0', border:'1px dashed #1e2d45', borderRadius:10 }}>Add projects to boost your resume</div>}
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={S.card}>
              <div style={{ color:'#a78bfa', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:14 }}>Professional Content</div>

              <div>
                <label style={S.lbl}><span>Professional Summary</span><AIBtn field="summary" label="Generate" prompt="Write a powerful 3-sentence professional summary: expertise, key skills, career goal. Plain text, no markdown." generateField={generateField} generating={generating} genField={genField} /></label>
                <textarea value={data.summary||''} onChange={e=>upd('summary',e.target.value)} rows={4} style={S.ta} placeholder="A results-driven engineer with…" />
              </div>

              <div>
                <label style={S.lbl}>
                  <span>Skills (type + Enter to add)</span>
                  <div style={{ display:'flex', gap:4 }}>
                    <AIBtn field="skills" label="Enhance" prompt="Return comma-separated relevant technical and soft skills for the candidate's role. Plain text only." generateField={generateField} generating={generating} genField={genField} />
                    {data.skills && <button onClick={() => upd('skills','')} style={{ background:'rgba(220,38,38,.08)', border:'1px solid #450a0a', color:'#f87171', borderRadius:7, padding:'3px 9px', fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>Clear</button>}
                  </div>
                </label>
                <SkillChips value={data.skills||''} onChange={v => upd('skills', v)} />
                <div style={{ marginTop:8, marginBottom:12, fontSize:10, color:'#334155' }}>Tip: paste comma-separated skills to add many at once</div>
              </div>

              <div>
                <label style={S.lbl}><span>Experience</span><AIBtn field="experience" label="Enhance" prompt="Rewrite experience with powerful action verbs and quantified achievements. Bullet points as '• '. No markdown." generateField={generateField} generating={generating} genField={genField} /></label>
                <textarea value={data.experience||''} onChange={e=>upd('experience',e.target.value)} rows={6} style={S.ta} placeholder="Software Engineer @ Company (2023–2025)&#10;• Led development of X, improving Y by 40%&#10;• Built Z using React and Python" />
              </div>

              <div>
                <label style={S.lbl}><span>Education</span><AIBtn field="education" label="Format" prompt="Format education professionally: degree, institution, year, coursework. Plain text." generateField={generateField} generating={generating} genField={genField} /></label>
                <textarea value={data.education||''} onChange={e=>upd('education',e.target.value)} rows={3} style={S.ta} placeholder="B.E. Computer Science — XYZ University (2022–2026)&#10;CGPA: 8.5 | Relevant: DSA, ML, DBMS" />
              </div>

              {[['certifications','Certifications'],['languages','Languages']].map(([k,lbl]) => (
                <div key={k}><label style={S.lbl}>{lbl}</label><input value={data[k]||''} onChange={e=>upd(k,e.target.value)} style={S.inp} placeholder={lbl} /></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* A4 PREVIEW */}
      {tab==='preview' && (
        <div style={S.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
            <div style={{ color:'#94a3b8', fontSize:13, fontWeight:600 }}>
              {TEMPLATES[selectedTpl].icon} {TEMPLATES[selectedTpl].name} — A4 Preview (210mm × 297mm)
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <Btn onClick={openPrint}   style={{ background:'linear-gradient(135deg,#1d4ed8,#4f46e5)', border:'none', color:'#fff' }}>🖨 Print / Save as PDF</Btn>
              <Btn onClick={downloadHTML} style={{ background:'#0e7490', border:'1px solid rgba(6,182,212,.3)', color:'#67e8f9' }}>📥 HTML</Btn>
            </div>
          </div>

          {/* A4 scrollable container */}
          <div style={{ background:'#1a1a2e', borderRadius:10, padding:20, overflowY:'auto', maxHeight:'80vh', display:'flex', justifyContent:'center' }}>
            <div style={{ boxShadow:'0 8px 32px rgba(0,0,0,.6)', borderRadius:2 }}>
              <iframe
                srcDoc={previewHTML}
                style={{ width:794, height:1123, border:'none', display:'block', borderRadius:2 }}
                title="A4 Resume Preview"
              />
            </div>
          </div>

          <div style={{ marginTop:12, background:'rgba(6,182,212,.06)', border:'1px solid rgba(6,182,212,.15)', borderRadius:8, padding:'10px 14px', fontSize:11, color:'#06b6d4' }}>
            💡 <strong>Save as PDF:</strong> Click "Print / Save as PDF" → Set paper to <strong>A4</strong> → Margins: <strong>None</strong> → Save. For best results use Chrome.
          </div>
        </div>
      )}

      {/* ATS REPORT */}
      {tab==='ats' && (
        <div style={S.card}>
          <div style={{ color:'#67e8f9', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:16 }}>🎯 ATS Compatibility Report</div>
          {!atsScore ? (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'#334155' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🤖</div>
              <p style={{ fontSize:13, marginBottom:14 }}>Enter target role above and click <strong style={{ color:'#67e8f9' }}>ATS Check</strong></p>
              <p style={{ fontSize:11, color:'#475569' }}>Scores your resume, finds missing keywords, recommends improvements</p>
            </div>
          ) : (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:24, marginBottom:24, flexWrap:'wrap' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ width:100, height:100, borderRadius:'50%', border:`8px solid ${atsScore.score>=75?'#22c55e':atsScore.score>=50?'#f59e0b':'#ef4444'}`, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
                    <div style={{ fontSize:24, fontWeight:800, color:atsScore.score>=75?'#22c55e':atsScore.score>=50?'#f59e0b':'#ef4444' }}>{atsScore.score}</div>
                    <div style={{ fontSize:10, color:'#475569' }}>/ 100</div>
                  </div>
                  <div style={{ marginTop:8, fontWeight:700, fontSize:12, color:atsScore.score>=75?'#22c55e':atsScore.score>=50?'#f59e0b':'#ef4444' }}>
                    {atsScore.score>=75?'✅ Strong':atsScore.score>=50?'⚠️ Moderate':'❌ Weak'}
                  </div>
                </div>
                <p style={{ color:'#94a3b8', fontSize:13, lineHeight:1.6, flex:1 }}>{atsScore.verdict}</p>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
                {atsScore.strengths?.length>0 && (
                  <div style={{ background:'rgba(34,197,94,.06)', border:'1px solid rgba(34,197,94,.2)', borderRadius:10, padding:14 }}>
                    <div style={{ color:'#86efac', fontWeight:700, fontSize:11, marginBottom:8 }}>✅ Strengths</div>
                    {atsScore.strengths.map((s,i)=><div key={i} style={{ color:'#94a3b8', fontSize:11, marginBottom:5 }}>• {s}</div>)}
                  </div>
                )}
                {atsScore.missing_keywords?.length>0 && (
                  <div style={{ background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', borderRadius:10, padding:14 }}>
                    <div style={{ color:'#f87171', fontWeight:700, fontSize:11, marginBottom:8 }}>🔍 Missing Keywords</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {atsScore.missing_keywords.map((k,i)=><span key={i} style={{ background:'rgba(239,68,68,.1)', color:'#f87171', padding:'2px 8px', borderRadius:999, fontSize:10 }}>{k}</span>)}
                    </div>
                  </div>
                )}
                {atsScore.improvements?.length>0 && (
                  <div style={{ background:'rgba(245,158,11,.06)', border:'1px solid rgba(245,158,11,.2)', borderRadius:10, padding:14 }}>
                    <div style={{ color:'#fbbf24', fontWeight:700, fontSize:11, marginBottom:8 }}>💡 Improvements</div>
                    {atsScore.improvements.map((im,i)=><div key={i} style={{ color:'#94a3b8', fontSize:11, marginBottom:5 }}>• {im}</div>)}
                  </div>
                )}
              </div>
              {atsScore.missing_keywords?.length>0 && (
                <button onClick={() => { const c=data.skills||''; upd('skills',c?`${c}, ${atsScore.missing_keywords.join(', ')}`:atsScore.missing_keywords.join(', ')); notify('✓ Missing keywords added to skills'); }}
                  style={{ background:'linear-gradient(135deg,#064e3b,#065f46)', border:'1px solid rgba(34,197,94,.2)', color:'#6ee7b7', borderRadius:8, padding:'8px 16px', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600, marginTop:14, display:'inline-flex', alignItems:'center', gap:6 }}>
                  ➕ Add Missing Keywords to Skills
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
