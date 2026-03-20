// src/ResumeBuilder.jsx — AI Resume Builder v2.0
// Editable skill chips · Projects section · 4 improved templates · ATS checker · Markdown-clean AI

import { useState, useRef } from 'react';

// ── Markdown Cleaner ─────────────────────────────────────────────────────────
export function cleanAI(text) {
  if (!text) return '';
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/^[\t ]*[-*+]\s+/gm, '• ')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/_{1,2}(.+?)_{1,2}/gs, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Editable Skill Chips ─────────────────────────────────────────────────────
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

  const removeSkill = (i) => {
    const updated = skills.filter((_, idx) => idx !== i);
    onChange(updated.join(', '));
  };

  const handleKey = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      addSkill(input);
    }
    if (e.key === 'Backspace' && !input && skills.length) {
      removeSkill(skills.length - 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    addSkill(pasted);
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px',
        background: '#070f1c', border: '1px solid #1e2d45', borderRadius: 8,
        cursor: 'text', minHeight: 44, alignItems: 'center',
      }}
    >
      {skills.map((sk, i) => (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)',
          color: '#a5b4fc', padding: '3px 10px 3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
        }}>
          {sk}
          <button onClick={(e) => { e.stopPropagation(); removeSkill(i); }} style={{
            background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
            fontSize: 13, padding: '0 0 0 2px', lineHeight: 1, display: 'flex', alignItems: 'center',
          }}>×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onPaste={handlePaste}
        onBlur={() => input.trim() && addSkill(input)}
        placeholder={skills.length === 0 ? placeholder : ''}
        style={{
          background: 'none', border: 'none', outline: 'none',
          color: '#e2e8f0', fontSize: 12, fontFamily: 'inherit',
          flex: 1, minWidth: 120,
        }}
      />
      {skills.length > 0 && (
        <span style={{ fontSize: 10, color: '#334155', marginLeft: 'auto' }}>
          {skills.length} skills
        </span>
      )}
    </div>
  );
}

// ── HTML escape ──────────────────────────────────────────────────────────────
const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const nl = (s) => String(s || '').replace(/\n/g, '<br>');

// ── Template: Professional ───────────────────────────────────────────────────
function tplProfessional(d) {
  const skills = (d.skills || '').split(',').filter(s => s.trim()).map(s =>
    `<span style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;padding:3px 11px;border-radius:3px;font-size:9pt;margin:2px 3px;">${esc(s.trim())}</span>`
  ).join('');

  const projects = (d.projects || []).filter(p => p.name).map(p => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <strong style="font-size:11pt">${esc(p.name)}</strong>
        ${p.url ? `<a href="${esc(p.url)}" style="color:#2563eb;font-size:9pt;">${esc(p.url)}</a>` : ''}
      </div>
      ${p.tech ? `<div style="color:#6b7280;font-size:9.5pt;font-style:italic;margin:2px 0">${esc(p.tech)}</div>` : ''}
      ${p.description ? `<div style="font-size:10pt;color:#374151;margin-top:3px">${nl(p.description)}</div>` : ''}
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Georgia','Times New Roman',serif;color:#111;background:#fff;padding:44px 52px;font-size:11pt;line-height:1.55}
h1{font-size:26pt;letter-spacing:2px;text-transform:uppercase;color:#111;margin-bottom:3px;font-weight:normal}
.tagline{color:#1d4ed8;font-size:11pt;font-style:italic;margin-bottom:8px}
.contact{font-size:9.5pt;color:#555;margin-bottom:16px;border-bottom:2.5px double #111;padding-bottom:10px}
.contact a{color:#1d4ed8;text-decoration:none}
h2{font-size:10pt;letter-spacing:2.5px;text-transform:uppercase;color:#1d4ed8;margin:18px 0 8px;border-bottom:1px solid #dbeafe;padding-bottom:3px}
.summary{font-size:10.5pt;line-height:1.7;color:#333}
.body{font-size:10pt;color:#374151;line-height:1.65;white-space:pre-wrap}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media print{body{padding:22px 28px}}
</style></head><body>
<h1>${esc(d.full_name||'Your Name')}</h1>
${d.headline?`<div class="tagline">${esc(d.headline)}</div>`:''}
<div class="contact">
  ${[d.email,d.phone,d.location].filter(Boolean).map(esc).join('<span style="margin:0 8px;color:#d1d5db">|</span>')}
  ${d.linkedin?`<span style="margin:0 8px;color:#d1d5db">|</span><a href="${esc(d.linkedin)}">${esc(d.linkedin)}</a>`:''}
  ${d.github?`<span style="margin:0 8px;color:#d1d5db">|</span><a href="${esc(d.github)}">${esc(d.github)}</a>`:''}
  ${d.portfolio?`<span style="margin:0 8px;color:#d1d5db">|</span><a href="${esc(d.portfolio)}">${esc(d.portfolio)}</a>`:''}
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
    <div style="margin-bottom:14px;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
      <div style="font-weight:700;font-size:10pt;color:#e0e7ff">${esc(p.name)}</div>
      ${p.tech?`<div style="color:#a5b4fc;font-size:8.5pt;margin:2px 0">${esc(p.tech)}</div>`:''}
      ${p.description?`<div style="font-size:8.5pt;color:#9ca3af;margin-top:4px;line-height:1.5">${nl(p.description)}</div>`:''}
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Segoe UI','Trebuchet MS',sans-serif;background:#fff;display:flex;min-height:100vh;font-size:10.5pt}
.sidebar{width:240px;min-width:240px;background:linear-gradient(160deg,#1e1b4b 0%,#2d2380 60%,#1e3a5f 100%);color:#e0e7ff;padding:36px 22px;flex-shrink:0}
.main{flex:1;padding:38px 34px;background:#fafbff}
.avatar{width:74px;height:74px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:26pt;font-weight:bold;color:#fff;margin-bottom:14px;box-shadow:0 4px 16px rgba(124,58,237,0.4)}
h1{font-size:18pt;color:#fff;font-weight:700;line-height:1.2;margin-bottom:3px}
.tagline{color:#a5b4fc;font-size:9pt;font-style:italic;margin-bottom:18px}
.sidebar h3{font-size:7.5pt;letter-spacing:2.5px;text-transform:uppercase;color:#818cf8;margin:16px 0 8px;padding-bottom:3px;border-bottom:1px solid rgba(129,140,248,0.2)}
.ci{font-size:8.5pt;color:#c7d2fe;margin:4px 0;word-break:break-all;line-height:1.4}
.main h2{font-size:13pt;color:#1e1b4b;font-weight:800;margin:0 0 10px;padding-bottom:5px;border-bottom:3px solid #7c3aed;display:inline-block}
.sec{margin-bottom:22px}
.body{font-size:10pt;color:#374151;line-height:1.65;white-space:pre-wrap}
@media print{body{min-height:auto}}
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
  ${d.portfolio?`<div class="ci">🌐 ${esc(d.portfolio)}</div>`:''}
  ${d.skills?`<h3>Skills</h3>${skills}`:''}
  ${d.certifications?`<h3>Certifications</h3><div style="font-size:8.5pt;color:#c7d2fe;line-height:1.6">${esc(d.certifications)}</div>`:''}
  ${d.languages?`<h3>Languages</h3><div style="font-size:8.5pt;color:#c7d2fe">${esc(d.languages)}</div>`:''}
  ${projects?`<h3>Projects</h3>${projects}`:''}
</div>
<div class="main">
  ${d.summary?`<div class="sec"><h2>Profile</h2><br><p style="font-size:10.5pt;line-height:1.7;color:#374151">${esc(d.summary)}</p></div>`:''}
  ${d.experience?`<div class="sec"><h2>Experience</h2><br><div class="body">${nl(d.experience)}</div></div>`:''}
  ${d.education?`<div class="sec"><h2>Education</h2><br><div class="body">${nl(d.education)}</div></div>`:''}
  ${d.expected_salary?`<div style="margin-top:auto;padding-top:14px;border-top:1px solid #e5e7eb;font-size:9.5pt;color:#6b7280">Expected Salary: <strong style="color:#1e1b4b">${esc(d.expected_salary)}</strong></div>`:''}
</div>
</body></html>`;
}

// ── Template: Minimal ────────────────────────────────────────────────────────
function tplMinimal(d) {
  const skills = (d.skills||'').split(',').filter(s=>s.trim());
  const projects = (d.projects||[]).filter(p=>p.name).map(p=>`
    <div style="margin-bottom:14px;padding-left:16px;border-left:2px solid #d1fae5">
      <div style="font-weight:600;font-size:11pt;color:#065f46">${esc(p.name)}${p.url?` <a href="${esc(p.url)}" style="color:#0f766e;font-size:9pt;font-weight:normal">↗</a>`:''}</div>
      ${p.tech?`<div style="color:#6b7280;font-size:9.5pt;margin:2px 0">${esc(p.tech)}</div>`:''}
      ${p.description?`<div style="font-size:10pt;color:#374151;margin-top:4px;line-height:1.6">${nl(p.description)}</div>`:''}
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Helvetica Neue','Arial',sans-serif;color:#111;background:#fff;padding:52px 60px;font-size:10.5pt;line-height:1.6;max-width:820px;margin:auto}
h1{font-size:30pt;font-weight:200;letter-spacing:-1.5px;color:#111;margin-bottom:2px}
.tag{color:#0f766e;font-size:11pt;font-weight:500;margin-bottom:10px}
.meta{font-size:9.5pt;color:#6b7280;display:flex;flex-wrap:wrap;gap:14px;padding:10px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:28px}
.meta a{color:#0f766e;text-decoration:none}
h2{font-size:8pt;letter-spacing:4px;text-transform:uppercase;color:#0f766e;font-weight:700;margin:26px 0 10px}
p,.body{font-size:10.5pt;color:#374151;line-height:1.75}
.skills{display:flex;flex-wrap:wrap;gap:7px;margin-top:6px}
.sk{background:#f0fdf4;border:1px solid #bbf7d0;color:#065f46;padding:4px 14px;border-radius:999px;font-size:9pt}
@media print{body{padding:24px 32px}}
</style></head><body>
<h1>${esc(d.full_name||'Your Name')}</h1>
${d.headline?`<div class="tag">${esc(d.headline)}</div>`:''}
<div class="meta">
  ${[d.email,d.phone,d.location].filter(Boolean).map(esc).join('<span style="color:#d1d5db">·</span>')}
  ${d.linkedin?`<span style="color:#d1d5db">·</span><a href="${esc(d.linkedin)}">${esc(d.linkedin)}</a>`:''}
  ${d.github?`<span style="color:#d1d5db">·</span><a href="${esc(d.github)}">${esc(d.github)}</a>`:''}
  ${d.portfolio?`<span style="color:#d1d5db">·</span><a href="${esc(d.portfolio)}">${esc(d.portfolio)}</a>`:''}
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
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Arial','Helvetica',sans-serif;color:#000;background:#fff;padding:36px 44px;font-size:11pt;line-height:1.5}
h1{font-size:18pt;font-weight:bold;text-align:center;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.contact{text-align:center;font-size:10pt;color:#333;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #000}
h2{font-size:11pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #000;padding-bottom:2px;margin:16px 0 8px}
p,.body{font-size:10.5pt;color:#111;line-height:1.6}
@media print{body{padding:16px 24px}}
</style></head><body>
<h1>${esc(d.full_name||'YOUR NAME')}</h1>
${d.headline?`<div style="text-align:center;font-style:italic;font-size:11pt;color:#444;margin-bottom:6px">${esc(d.headline)}</div>`:''}
<div class="contact">
  ${[d.email,d.phone,d.location,d.linkedin,d.github,d.portfolio].filter(Boolean).map(esc).join(' | ')}
</div>
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
  professional: { name:'Professional', icon:'🏢', color:'#1e3a5f', accent:'#2563eb', desc:'Classic serif — elegant & timeless', fn:tplProfessional },
  modern:       { name:'Modern',       icon:'✨', color:'#1e1b4b', accent:'#7c3aed', desc:'Sidebar design — bold & contemporary', fn:tplModern },
  minimal:      { name:'Minimal',      icon:'🎯', color:'#064e3b', accent:'#0f766e', desc:'Ultra-clean — lets content shine', fn:tplMinimal },
  ats:          { name:'ATS Pro',      icon:'🤖', color:'#111827', accent:'#374151', desc:'Optimized for applicant tracking systems', fn:tplATS },
};

const BLANK_PROJECT = { name:'', description:'', tech:'', url:'' };

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ResumeBuilder({ profile = {}, onSaveProfile, callAI, notify }) {
  const [selectedTpl, setSelectedTpl] = useState('professional');
  const [data, setData] = useState({
    ...profile,
    projects: profile.projects || [{ ...BLANK_PROJECT }],
  });
  const [generating, setGenerating] = useState(false);
  const [genField, setGenField] = useState('');
  const [jobTarget, setJobTarget] = useState('');
  const [atsScore, setAtsScore] = useState(null);
  const [tab, setTab] = useState('editor');

  const upd = (k, v) => setData(p => ({ ...p, [k]: v }));
  const updProject = (i, k, v) => setData(p => {
    const projects = [...(p.projects || [])];
    projects[i] = { ...projects[i], [k]: v };
    return { ...p, projects };
  });
  const addProject = () => setData(p => ({ ...p, projects: [...(p.projects||[]), { ...BLANK_PROJECT }] }));
  const removeProject = (i) => setData(p => ({ ...p, projects: (p.projects||[]).filter((_,j)=>j!==i) }));

  const previewHTML = TEMPLATES[selectedTpl].fn(data);

  // ── AI Generation ────────────────────────────────────────────────────────
  async function generateField(field, instructions) {
    if (!callAI) return notify('AI not configured — add API key in ⚙️ Settings', 'err');
    setGenerating(true); setGenField(field);
    try {
      const ctx = `Name: ${data.full_name||''}, Skills: ${data.skills||''}, Experience: ${(data.experience||'').slice(0,400)}, Education: ${data.education||''}`;
      const raw = await callAI(
        `${instructions}\n\nCandidate context:\n${ctx}\n${jobTarget?`\nTarget role: ${jobTarget}`:''}`,
        'You are an expert resume writer. Write concisely and powerfully. Use plain text, no markdown symbols like * # or **. Use bullet points written as "• " only.'
      );
      upd(field, cleanAI(raw.trim()));
      notify(`✓ ${field} updated`);
    } catch (err) {
      notify('AI error: ' + err.message, 'err');
    }
    setGenerating(false); setGenField('');
  }

  async function generateProjectDescription(i) {
    if (!callAI) return notify('AI not configured', 'err');
    const proj = data.projects?.[i];
    if (!proj?.name) return notify('Enter project name first', 'err');
    setGenerating(true); setGenField(`proj_${i}`);
    try {
      const raw = await callAI(
        `Write a concise 2-3 sentence project description for resume:
Project: ${proj.name}
Tech: ${proj.tech || 'not specified'}
Context: Built by ${data.full_name||'a developer'} with skills: ${data.skills||'general'}
${jobTarget?`Target role: ${jobTarget}`:''}

Write as resume bullet points starting with action verbs. Plain text only, no * or #.`,
        'Return only the description text, no formatting symbols.'
      );
      updProject(i, 'description', cleanAI(raw.trim()));
      notify('Project description generated ✓');
    } catch (err) { notify('AI error: ' + err.message, 'err'); }
    setGenerating(false); setGenField('');
  }

  async function generateFullResume() {
    if (!callAI) return notify('AI not configured', 'err');
    setGenerating(true); setGenField('full');
    try {
      const prompt = `Create a complete ATS-optimized resume for:
Name: ${data.full_name || 'Candidate'}
Target Role: ${jobTarget || data.target_roles || 'Software Engineer'}
Current Skills: ${data.skills || 'N/A'}
Education: ${data.education || 'N/A'}
Experience: ${(data.experience || 'N/A').slice(0,300)}
${data.certifications?`Certifications: ${data.certifications}`:''}

Return ONLY valid JSON with keys: summary, experience, skills (comma-separated), education, certifications.
Plain text only — no *, #, **, or other markdown symbols. Use "• " for bullet points.`;

      const raw = await callAI(prompt, 'Return ONLY valid JSON. Use plain text, no markdown formatting symbols.');
      const clean = raw.replace(/```json|```/g, '').trim();
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        // Clean all fields
        Object.keys(parsed).forEach(k => {
          if (typeof parsed[k] === 'string') parsed[k] = cleanAI(parsed[k]);
        });
        setData(p => ({ ...p, ...parsed }));
        notify('✓ Full resume generated!');
      }
    } catch (err) {
      notify('Generation error: ' + err.message, 'err');
    }
    setGenerating(false); setGenField('');
  }

  async function checkATS() {
    if (!callAI) return notify('AI not configured', 'err');
    if (!jobTarget.trim()) return notify('Enter target job role first', 'err');
    setGenerating(true); setGenField('ats');
    try {
      const resumeText = `${data.summary||''} ${data.experience||''} ${data.skills||''} ${data.education||''} ${(data.projects||[]).map(p=>`${p.name} ${p.tech} ${p.description}`).join(' ')}`;
      const result = await callAI(
        `Analyze this resume for ATS compatibility against: "${jobTarget}"\n\nResume:\n${resumeText.slice(0,2000)}\n\nReturn JSON: {score:0-100,missing_keywords:[],strengths:[],improvements:[],verdict:"string"}`,
        'Return ONLY valid JSON. No markdown.'
      );
      const match = result.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/);
      if (match) { setAtsScore(JSON.parse(match[0])); setTab('ats'); }
    } catch (err) { notify('ATS check error: ' + err.message, 'err'); }
    setGenerating(false); setGenField('');
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function openPrint() {
    const w = window.open('', '_blank');
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
    notify('HTML downloaded — open in Chrome → Print → Save as PDF ✓');
  }
  function syncToProfile() {
    if (onSaveProfile) {
      const { projects, ...rest } = data;
      onSaveProfile({ ...rest, projects: JSON.stringify(projects || []) });
      notify('✓ Synced to profile');
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const S = {
    card: { background:'#06101e', border:'1px solid #1e2d45', borderRadius:14, padding:20 },
    lbl:  { color:'#475569', fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6, display:'flex', alignItems:'center', justifyContent:'space-between' },
    inp:  { width:'100%', background:'#070f1c', border:'1px solid #1e2d45', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit', marginBottom:12 },
    ta:   { width:'100%', background:'#070f1c', border:'1px solid #1e2d45', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontSize:12, outline:'none', resize:'vertical', fontFamily:'inherit', marginBottom:12, lineHeight:1.6 },
    btn:  (extra={}) => ({ background:'#0d1526', border:'1px solid #1e2d45', color:'#94a3b8', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, fontFamily:'inherit', transition:'all .15s', ...extra }),
    spin: { animation:'spin 0.8s linear infinite', display:'inline-block' },
  };

  const Btn = ({ children, onClick, style={}, disabled }) => (
    <button onClick={onClick} disabled={disabled}
      style={{ ...S.btn(), ...style, opacity:disabled?.5:1, cursor:disabled?'not-allowed':'pointer' }}>
      {children}
    </button>
  );

  const AIBtn = ({ field, prompt, label }) => (
    <button onClick={() => generateField(field, prompt)} disabled={generating}
      style={{ ...S.btn({ background:'linear-gradient(135deg,#4c1d95,#5b21b6)', border:'1px solid rgba(139,92,246,0.4)', color:'#c4b5fd', padding:'3px 9px', fontSize:10, marginLeft:6 }), opacity:generating?.5:1, cursor:generating?'not-allowed':'pointer' }}>
      {generating && genField === field ? <span style={S.spin}>◌</span> : '✨'} {label||'AI'}
    </button>
  );

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .proj-card:hover{border-color:#1e2d45!important}`}</style>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:'#f1f5f9', margin:0 }}>📄 AI Resume Builder</h2>
          <p style={{ color:'#475569', fontSize:12, marginTop:4 }}>4 templates · Editable skill chips · Projects · ATS checker · PDF export</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <Btn onClick={syncToProfile} style={{ background:'linear-gradient(135deg,#064e3b,#065f46)', border:'1px solid rgba(34,197,94,0.2)', color:'#6ee7b7' }}>🔄 Sync to Profile</Btn>
          <Btn onClick={openPrint}     style={{ background:'linear-gradient(135deg,#1d4ed8,#4f46e5)', border:'none', color:'#fff' }}>🖨 Print / PDF</Btn>
          <Btn onClick={downloadHTML}  style={{ background:'#0e7490', border:'1px solid rgba(6,182,212,0.3)', color:'#67e8f9' }}>📥 HTML</Btn>
        </div>
      </div>

      {/* AI Controls */}
      <div style={{ ...S.card, marginBottom:18 }}>
        <div style={{ color:'#a78bfa', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
          ✨ AI Generation
          <span style={{ background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.25)', color:'#a78bfa', padding:'1px 8px', borderRadius:999, fontSize:9 }}>Markdown-free output</span>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:12, alignItems:'center' }}>
          <input value={jobTarget} onChange={e => setJobTarget(e.target.value)} placeholder="Target job role or paste job description for AI context…"
            style={{ ...S.inp, flex:1, minWidth:240, margin:0 }} />
          <Btn onClick={generateFullResume} disabled={generating}
            style={{ background:'linear-gradient(135deg,#4c1d95,#5b21b6)', border:'1px solid rgba(139,92,246,0.3)', color:'#c4b5fd', padding:'10px 18px' }}>
            {generating && genField==='full' ? <><span style={S.spin}>◌</span> Generating…</> : '⚡ Generate Full Resume'}
          </Btn>
          <Btn onClick={checkATS} disabled={generating}
            style={{ background:'#0c4a6e', border:'1px solid rgba(14,116,144,0.4)', color:'#67e8f9', padding:'10px 14px' }}>
            {generating && genField==='ats' ? <span style={S.spin}>◌</span> : '🎯'} ATS Check
          </Btn>
        </div>
        <div style={{ fontSize:11, color:'#334155' }}>
          💡 AI produces plain text — no * or # symbols. Enter target role for keyword-optimized content.
        </div>
      </div>

      {/* Template Selector */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {Object.entries(TEMPLATES).map(([key, tpl]) => (
          <button key={key} onClick={() => setSelectedTpl(key)} style={{
            background: selectedTpl===key ? `${tpl.accent}18` : '#06101e',
            border: `2px solid ${selectedTpl===key ? tpl.accent : '#1e2d45'}`,
            borderRadius:12, padding:'14px 12px', cursor:'pointer', textAlign:'left',
            transition:'all .15s', fontFamily:'inherit',
          }}>
            <div style={{ fontSize:22, marginBottom:6 }}>{tpl.icon}</div>
            <div style={{ color:selectedTpl===key?'#f1f5f9':'#94a3b8', fontWeight:700, fontSize:13, marginBottom:3 }}>{tpl.name}</div>
            <div style={{ color:'#475569', fontSize:10, lineHeight:1.5 }}>{tpl.desc}</div>
            {selectedTpl===key && <div style={{ marginTop:8, background:tpl.accent, color:'#fff', fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:999, display:'inline-block' }}>ACTIVE</div>}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, background:'#070f1c', border:'1px solid #1e2d45', borderRadius:12, padding:4, marginBottom:18, width:'fit-content' }}>
        {[['editor','✏️ Editor'],['preview','👁 Live Preview'],['ats','🎯 ATS Report']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background:tab===t?'#1e2d45':'transparent', border:'none',
            color:tab===t?'#e2e8f0':'#475569', padding:'8px 18px', borderRadius:8,
            cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600, transition:'all .15s',
          }}>{l}</button>
        ))}
      </div>

      {/* ── EDITOR ── */}
      {tab==='editor' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* Left */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={S.card}>
              <div style={{ color:'#60a5fa', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:14 }}>Personal Info</div>
              {[['full_name','Full Name'],['headline','Professional Headline'],['email','Email'],['phone','Phone'],['location','Location'],['linkedin','LinkedIn URL'],['github','GitHub URL'],['portfolio','Portfolio URL']].map(([k,lbl]) => (
                <div key={k}>
                  <label style={S.lbl}>{lbl}</label>
                  <input value={data[k]||''} onChange={e=>upd(k,e.target.value)} style={S.inp} placeholder={lbl} />
                </div>
              ))}
              <div>
                <label style={S.lbl}>Job Preferences</label>
              </div>
              {[['target_roles','Target Roles'],['target_locations','Target Locations'],['expected_salary','Expected Salary']].map(([k,lbl]) => (
                <div key={k}>
                  <label style={{ ...S.lbl, color:'#94a3b8', fontSize:9 }}>{lbl}</label>
                  <input value={data[k]||''} onChange={e=>upd(k,e.target.value)} style={{ ...S.inp }} placeholder={lbl} />
                </div>
              ))}
            </div>

            {/* Projects */}
            <div style={S.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div style={{ color:'#fde047', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>🚀 Projects</div>
                <button onClick={addProject} style={{ ...S.btn({ background:'rgba(253,224,71,0.08)', border:'1px solid rgba(253,224,71,0.2)', color:'#fde047', padding:'4px 12px', fontSize:11 }) }}>
                  ＋ Add Project
                </button>
              </div>
              {(data.projects||[]).map((proj, i) => (
                <div key={i} className="proj-card" style={{ background:'#070f1c', border:'1px solid #1e2d45', borderRadius:10, padding:14, marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <span style={{ color:'#fde047', fontSize:11, fontWeight:700 }}>Project {i+1}</span>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => generateProjectDescription(i)} disabled={generating}
                        style={{ ...S.btn({ background:'linear-gradient(135deg,#4c1d95,#5b21b6)', border:'1px solid rgba(139,92,246,0.4)', color:'#c4b5fd', padding:'3px 9px', fontSize:10 }), opacity:generating?.5:1 }}>
                        {generating && genField===`proj_${i}` ? <span style={S.spin}>◌</span> : '✨'} AI Desc
                      </button>
                      <button onClick={() => removeProject(i)} style={{ ...S.btn({ background:'rgba(220,38,38,0.08)', border:'1px solid #450a0a', color:'#f87171', padding:'3px 8px', fontSize:11 }) }}>
                        ✕
                      </button>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ ...S.lbl, fontSize:9 }}>Project Name *</label>
                      <input value={proj.name||''} onChange={e=>updProject(i,'name',e.target.value)} style={{ ...S.inp, marginBottom:0 }} placeholder="My Awesome App" />
                    </div>
                    <div>
                      <label style={{ ...S.lbl, fontSize:9 }}>Tech Stack</label>
                      <input value={proj.tech||''} onChange={e=>updProject(i,'tech',e.target.value)} style={{ ...S.inp, marginBottom:0 }} placeholder="React, Node.js, PostgreSQL" />
                    </div>
                  </div>
                  <div style={{ marginTop:10 }}>
                    <label style={{ ...S.lbl, fontSize:9 }}>URL / GitHub Link</label>
                    <input value={proj.url||''} onChange={e=>updProject(i,'url',e.target.value)} style={S.inp} placeholder="https://github.com/…" />
                  </div>
                  <div>
                    <label style={{ ...S.lbl, fontSize:9 }}>Description</label>
                    <textarea value={proj.description||''} onChange={e=>updProject(i,'description',e.target.value)} rows={3}
                      style={S.ta} placeholder="Built a full-stack app that…&#10;• Key achievement 1&#10;• Key achievement 2" />
                  </div>
                </div>
              ))}
              {(!data.projects || data.projects.length===0) && (
                <div style={{ color:'#1e2d45', fontSize:12, textAlign:'center', padding:'20px 0', border:'1px dashed #1e2d45', borderRadius:10 }}>
                  Add projects to boost your resume
                </div>
              )}
            </div>
          </div>

          {/* Right */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={S.card}>
              <div style={{ color:'#a78bfa', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:14 }}>Professional Content</div>

              {/* Summary */}
              <div>
                <label style={S.lbl}>
                  <span>Professional Summary</span>
                  <AIBtn field="summary" label="Generate"
                    prompt="Write a powerful 3-sentence professional summary: expertise, key skills, and career goal. Use plain text only — no *, #, or **. Start each sentence strong." />
                </label>
                <textarea value={data.summary||''} onChange={e=>upd('summary',e.target.value)} rows={4} style={S.ta} placeholder="A results-driven software engineer with…" />
              </div>

              {/* Skills — Editable Chips */}
              <div>
                <label style={S.lbl}>
                  <span>Skills (type + Enter to add)</span>
                  <div style={{ display:'flex', gap:4 }}>
                    <AIBtn field="skills" label="Enhance"
                      prompt="Return a comma-separated list of relevant technical and soft skills for the candidate's target role. Include in-demand keywords. Plain text only, no symbols." />
                    {data.skills && (
                      <button onClick={() => upd('skills','')}
                        style={{ ...S.btn({ background:'rgba(220,38,38,0.08)', border:'1px solid #450a0a', color:'#f87171', padding:'3px 9px', fontSize:10 }) }}>
                        Clear All
                      </button>
                    )}
                  </div>
                </label>
                <SkillChips value={data.skills||''} onChange={v => upd('skills', v)} />
                <div style={{ marginTop:8, marginBottom:12, fontSize:10, color:'#334155' }}>
                  Tip: paste comma-separated skills to add many at once
                </div>
              </div>

              {/* Experience */}
              <div>
                <label style={S.lbl}>
                  <span>Experience</span>
                  <AIBtn field="experience" label="Enhance"
                    prompt="Rewrite the experience section with powerful action verbs and quantified achievements. Use bullet points written as '• '. Plain text only — no *, #, or ** symbols." />
                </label>
                <textarea value={data.experience||''} onChange={e=>upd('experience',e.target.value)} rows={6} style={S.ta}
                  placeholder="Software Engineer @ Company (2023–2025)&#10;• Led development of X, improving Y by 40%&#10;• Built Z using React and Python" />
              </div>

              {/* Education */}
              <div>
                <label style={S.lbl}>
                  <span>Education</span>
                  <AIBtn field="education" label="Format"
                    prompt="Format the education section professionally: degree, institution, year, relevant coursework. Plain text only, no markdown symbols." />
                </label>
                <textarea value={data.education||''} onChange={e=>upd('education',e.target.value)} rows={3} style={S.ta}
                  placeholder="B.E. Computer Science — XYZ University (2022–2026)&#10;CGPA: 8.5/10 | Relevant: DSA, ML, DBMS" />
              </div>

              {[['certifications','Certifications'],['languages','Languages']].map(([k,lbl]) => (
                <div key={k}>
                  <label style={S.lbl}>{lbl}</label>
                  <input value={data[k]||''} onChange={e=>upd(k,e.target.value)} style={S.inp} placeholder={lbl} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {tab==='preview' && (
        <div style={S.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
            <div style={{ color:'#94a3b8', fontSize:13, fontWeight:600 }}>
              {TEMPLATES[selectedTpl].icon} {TEMPLATES[selectedTpl].name} — Live Preview
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <Btn onClick={openPrint}   style={{ background:'linear-gradient(135deg,#1d4ed8,#4f46e5)', border:'none', color:'#fff' }}>🖨 Print / PDF</Btn>
              <Btn onClick={downloadHTML} style={{ background:'#0e7490', border:'1px solid rgba(6,182,212,0.3)', color:'#67e8f9' }}>📥 HTML</Btn>
            </div>
          </div>
          <div style={{ borderRadius:8, overflow:'hidden', border:'1px solid #1e2d45', background:'#fff' }}>
            <iframe srcDoc={previewHTML} style={{ width:'100%', height:720, border:'none' }} title="Resume Preview" />
          </div>
          <div style={{ marginTop:12, background:'rgba(6,182,212,0.06)', border:'1px solid rgba(6,182,212,0.15)', borderRadius:8, padding:'10px 14px', fontSize:11, color:'#06b6d4' }}>
            💡 <strong>Save as PDF:</strong> Click "Print / PDF" → In dialog, set destination to "Save as PDF" → Save.
          </div>
        </div>
      )}

      {/* ── ATS REPORT ── */}
      {tab==='ats' && (
        <div style={S.card}>
          <div style={{ color:'#67e8f9', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:16 }}>🎯 ATS Compatibility Report</div>
          {!atsScore ? (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'#334155' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🤖</div>
              <p style={{ fontSize:13, marginBottom:16 }}>Enter target role above and click <strong style={{ color:'#67e8f9' }}>ATS Check</strong></p>
              <p style={{ fontSize:11, color:'#475569' }}>Scores your resume, finds missing keywords, and recommends improvements</p>
            </div>
          ) : (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:24, marginBottom:24, flexWrap:'wrap' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ width:100, height:100, borderRadius:'50%', border:`8px solid ${atsScore.score>=75?'#22c55e':atsScore.score>=50?'#f59e0b':'#ef4444'}`, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
                    <div style={{ fontSize:24, fontWeight:800, color:atsScore.score>=75?'#22c55e':atsScore.score>=50?'#f59e0b':'#ef4444' }}>{atsScore.score}</div>
                    <div style={{ fontSize:10, color:'#475569' }}>/ 100</div>
                  </div>
                  <div style={{ marginTop:8, color:atsScore.score>=75?'#22c55e':atsScore.score>=50?'#f59e0b':'#ef4444', fontWeight:700, fontSize:12 }}>
                    {atsScore.score>=75?'✅ Strong':atsScore.score>=50?'⚠️ Moderate':'❌ Weak'}
                  </div>
                </div>
                <p style={{ color:'#94a3b8', fontSize:13, lineHeight:1.6, flex:1 }}>{atsScore.verdict}</p>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>
                {atsScore.strengths?.length>0 && (
                  <div style={{ background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:10, padding:14 }}>
                    <div style={{ color:'#86efac', fontWeight:700, fontSize:11, marginBottom:8 }}>✅ Strengths</div>
                    {atsScore.strengths.map((s,i)=><div key={i} style={{ color:'#94a3b8', fontSize:11, marginBottom:5 }}>• {s}</div>)}
                  </div>
                )}
                {atsScore.missing_keywords?.length>0 && (
                  <div style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:14 }}>
                    <div style={{ color:'#f87171', fontWeight:700, fontSize:11, marginBottom:8 }}>🔍 Missing Keywords</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {atsScore.missing_keywords.map((k,i)=>(
                        <span key={i} style={{ background:'rgba(239,68,68,0.1)', color:'#f87171', padding:'2px 8px', borderRadius:999, fontSize:10 }}>{k}</span>
                      ))}
                    </div>
                  </div>
                )}
                {atsScore.improvements?.length>0 && (
                  <div style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10, padding:14 }}>
                    <div style={{ color:'#fbbf24', fontWeight:700, fontSize:11, marginBottom:8 }}>💡 Improvements</div>
                    {atsScore.improvements.map((im,i)=><div key={i} style={{ color:'#94a3b8', fontSize:11, marginBottom:5 }}>• {im}</div>)}
                  </div>
                )}
              </div>
              {atsScore.missing_keywords?.length>0 && (
                <button onClick={() => {
                  const current = data.skills||'';
                  const added = atsScore.missing_keywords.join(', ');
                  upd('skills', current ? `${current}, ${added}` : added);
                  notify('✓ Missing keywords added to skills');
                }} style={{ ...S.btn({ background:'linear-gradient(135deg,#064e3b,#065f46)', border:'1px solid rgba(34,197,94,0.2)', color:'#6ee7b7' }), marginTop:14 }}>
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
