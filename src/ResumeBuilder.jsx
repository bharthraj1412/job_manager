// src/ResumeBuilder.jsx
// AI Resume Creator — 4 templates, live preview, PDF/print export, AI content generation

import { useState, useCallback } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────
const esc = (str) => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
const raw = (str) => String(str || '');

// ── Template HTML Builders ────────────────────────────────────────────────────

function tplProfessional(d) {
  const skills = (d.skills || '').split(',').filter(s => s.trim()).map(s =>
    `<span style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;padding:3px 11px;border-radius:3px;font-size:9.5pt;margin:2px;display:inline-block;">${esc(s.trim())}</span>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Georgia','Times New Roman',serif;color:#111;background:#fff;padding:44px 52px;font-size:11pt;line-height:1.5}
h1{font-size:27pt;letter-spacing:3px;text-transform:uppercase;color:#111;margin-bottom:3px;font-weight:normal}
.tagline{color:#1e40af;font-size:11pt;font-style:italic;margin-bottom:8px}
.contact{font-size:9.5pt;color:#555;margin-bottom:14px;border-bottom:2px solid #111;padding-bottom:10px}
.contact a{color:#1e40af;text-decoration:none}
.contact span{margin:0 6px}
h2{font-size:10pt;letter-spacing:2.5px;text-transform:uppercase;color:#1e40af;margin:18px 0 7px;border-bottom:1px solid #dbeafe;padding-bottom:3px}
.summary{font-size:10.5pt;line-height:1.7;color:#333}
.item{margin-bottom:12px}
.item-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}
.item-title{font-weight:bold;font-size:11pt}
.item-sub{color:#444;font-size:10pt;font-style:italic}
.item-date{color:#666;font-size:9.5pt;white-space:nowrap}
.item-body{font-size:10pt;color:#444;line-height:1.6;margin-top:3px;white-space:pre-wrap}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media print{body{padding:22px 28px}}
</style></head><body>
<h1>${esc(d.full_name || 'Your Name')}</h1>
${d.headline ? `<div class="tagline">${esc(d.headline)}</div>` : ''}
<div class="contact">
  ${[d.email, d.phone, d.location].filter(Boolean).map(esc).join('<span>|</span>')}
  ${d.linkedin ? `<span>|</span><a href="${esc(d.linkedin)}">${esc(d.linkedin)}</a>` : ''}
  ${d.github   ? `<span>|</span><a href="${esc(d.github)}">${esc(d.github)}</a>` : ''}
  ${d.portfolio? `<span>|</span><a href="${esc(d.portfolio)}">${esc(d.portfolio)}</a>` : ''}
</div>

${d.summary ? `<h2>Professional Summary</h2><p class="summary">${esc(d.summary)}</p>` : ''}

${d.experience ? `<h2>Experience</h2>
<div class="item"><div class="item-body">${raw(d.experience).replace(/\n/g,'<br>')}</div></div>` : ''}

${d.education ? `<h2>Education</h2>
<div class="item"><div class="item-body">${raw(d.education).replace(/\n/g,'<br>')}</div></div>` : ''}

${d.skills ? `<h2>Skills &amp; Technologies</h2><div style="margin-top:4px">${skills}</div>` : ''}

<div class="two-col">
${d.certifications ? `<div><h2>Certifications</h2><p class="item-body">${esc(d.certifications)}</p></div>` : ''}
${d.languages      ? `<div><h2>Languages</h2><p class="item-body">${esc(d.languages)}</p></div>` : ''}
</div>

</body></html>`;
}

function tplModern(d) {
  const skills = (d.skills || '').split(',').filter(s => s.trim()).map(s =>
    `<div style="margin:4px 0;display:flex;align-items:center;gap:7px">
      <span style="width:6px;height:6px;border-radius:50%;background:#a78bfa;flex-shrink:0"></span>
      <span style="font-size:9.5pt">${esc(s.trim())}</span>
    </div>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Trebuchet MS','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;display:flex;min-height:100vh;font-size:10.5pt}
.sidebar{width:230px;min-width:230px;background:linear-gradient(160deg,#1e1b4b 0%,#312e81 100%);color:#e2e8f0;padding:36px 22px;flex-shrink:0}
.main{flex:1;padding:36px 32px;background:#fff}
.avatar{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:28pt;font-weight:bold;color:#fff;margin-bottom:16px}
h1{font-size:20pt;color:#fff;font-weight:700;line-height:1.2;margin-bottom:4px}
.tagline{color:#a5b4fc;font-size:9.5pt;font-style:italic;margin-bottom:20px}
.sidebar h3{font-size:8.5pt;letter-spacing:2px;text-transform:uppercase;color:#a5b4fc;margin:18px 0 8px;padding-bottom:4px;border-bottom:1px solid rgba(165,180,252,0.25)}
.contact-item{font-size:9pt;color:#c7d2fe;margin:5px 0;word-break:break-all}
.main h2{font-size:13pt;color:#312e81;font-weight:700;margin:0 0 10px;padding-bottom:5px;border-bottom:2px solid #7c3aed}
.main .section{margin-bottom:22px}
.summary{font-size:10.5pt;line-height:1.7;color:#374151}
.exp-body{font-size:10pt;color:#4b5563;line-height:1.6;white-space:pre-wrap}
@media print{body{min-height:auto}}
</style></head><body>

<div class="sidebar">
  <div class="avatar">${(d.full_name || 'Y').charAt(0).toUpperCase()}</div>
  <h1>${esc(d.full_name || 'Your Name')}</h1>
  ${d.headline ? `<div class="tagline">${esc(d.headline)}</div>` : ''}

  <h3>Contact</h3>
  ${d.email    ? `<div class="contact-item">✉ ${esc(d.email)}</div>` : ''}
  ${d.phone    ? `<div class="contact-item">📞 ${esc(d.phone)}</div>` : ''}
  ${d.location ? `<div class="contact-item">📍 ${esc(d.location)}</div>` : ''}
  ${d.linkedin ? `<div class="contact-item">🔗 ${esc(d.linkedin)}</div>` : ''}
  ${d.github   ? `<div class="contact-item">💻 ${esc(d.github)}</div>` : ''}
  ${d.portfolio? `<div class="contact-item">🌐 ${esc(d.portfolio)}</div>` : ''}

  ${d.skills ? `<h3>Skills</h3>${skills}` : ''}
  ${d.certifications ? `<h3>Certifications</h3><div style="font-size:9pt;color:#c7d2fe;line-height:1.6">${esc(d.certifications)}</div>` : ''}
  ${d.languages ? `<h3>Languages</h3><div style="font-size:9pt;color:#c7d2fe">${esc(d.languages)}</div>` : ''}
</div>

<div class="main">
  ${d.summary ? `<div class="section"><h2>Profile</h2><p class="summary">${esc(d.summary)}</p></div>` : ''}
  ${d.experience ? `<div class="section"><h2>Experience</h2><div class="exp-body">${raw(d.experience).replace(/\n/g,'<br>')}</div></div>` : ''}
  ${d.education  ? `<div class="section"><h2>Education</h2><div class="exp-body">${raw(d.education).replace(/\n/g,'<br>')}</div></div>` : ''}
  ${d.expected_salary ? `<div style="margin-top:auto;padding-top:16px;border-top:1px solid #e5e7eb;font-size:9.5pt;color:#6b7280">Expected Salary: <strong style="color:#312e81">${esc(d.expected_salary)}</strong></div>` : ''}
</div>

</body></html>`;
}

function tplMinimal(d) {
  const skills = (d.skills || '').split(',').filter(s => s.trim());
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue','Arial',sans-serif;color:#111;background:#fff;padding:52px 60px;font-size:10.5pt;line-height:1.6;max-width:800px;margin:auto}
h1{font-size:30pt;font-weight:300;letter-spacing:-1px;color:#111;margin-bottom:2px}
.tagline{color:#0f766e;font-size:11pt;font-weight:500;margin-bottom:12px}
.meta{font-size:9.5pt;color:#6b7280;display:flex;flex-wrap:wrap;gap:12px;padding:10px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin-bottom:30px}
h2{font-size:8.5pt;letter-spacing:3px;text-transform:uppercase;color:#0f766e;font-weight:600;margin:26px 0 10px}
p,div.body{font-size:10.5pt;color:#374151;line-height:1.75}
.skills{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.skill{background:#f0fdf4;border:1px solid #bbf7d0;color:#065f46;padding:4px 14px;border-radius:999px;font-size:9pt}
@media print{body{padding:24px 32px}}
</style></head><body>

<h1>${esc(d.full_name || 'Your Name')}</h1>
${d.headline ? `<div class="tagline">${esc(d.headline)}</div>` : ''}

<div class="meta">
  ${[d.email, d.phone, d.location, d.linkedin, d.github, d.portfolio].filter(Boolean).map(esc).join('<span style="color:#d1d5db">·</span>')}
</div>

${d.summary ? `<h2>About</h2><p>${esc(d.summary)}</p>` : ''}

${d.experience ? `<h2>Experience</h2><div class="body" style="white-space:pre-wrap">${raw(d.experience).replace(/\n/g,'<br>')}</div>` : ''}

${d.education ? `<h2>Education</h2><div class="body" style="white-space:pre-wrap">${raw(d.education).replace(/\n/g,'<br>')}</div>` : ''}

${skills.length ? `<h2>Skills</h2><div class="skills">${skills.map(s=>`<span class="skill">${esc(s.trim())}</span>`).join('')}</div>` : ''}

${d.certifications ? `<h2>Certifications</h2><p>${esc(d.certifications)}</p>` : ''}
${d.languages ? `<h2>Languages</h2><p>${esc(d.languages)}</p>` : ''}

</body></html>`;
}

function tplATS(d) {
  const skills = (d.skills || '').split(',').filter(s => s.trim()).join(' | ');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Arial','Helvetica',sans-serif;color:#000;background:#fff;padding:36px 44px;font-size:11pt;line-height:1.5}
h1{font-size:18pt;font-weight:bold;text-align:center;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.contact{text-align:center;font-size:10pt;color:#333;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #000}
h2{font-size:11pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #000;padding-bottom:2px;margin:16px 0 8px}
p,div.body{font-size:10.5pt;color:#111;line-height:1.6}
.skills-line{font-size:10.5pt;color:#111}
ul{margin-left:18px}
ul li{margin:3px 0;font-size:10.5pt}
@media print{body{padding:16px 24px}}
</style></head><body>

<h1>${esc(d.full_name || 'YOUR NAME')}</h1>
<div class="contact">
  ${[d.email, d.phone, d.location, d.linkedin, d.github, d.portfolio].filter(Boolean).map(esc).join(' | ')}
</div>

${d.summary ? `<h2>Professional Summary</h2><p>${esc(d.summary)}</p>` : ''}

${skills ? `<h2>Core Competencies</h2><p class="skills-line">${esc(skills)}</p>` : ''}

${d.experience ? `<h2>Professional Experience</h2><div class="body" style="white-space:pre-wrap">${raw(d.experience).replace(/\n/g,'<br>')}</div>` : ''}

${d.education ? `<h2>Education</h2><div class="body" style="white-space:pre-wrap">${raw(d.education).replace(/\n/g,'<br>')}</div>` : ''}

${d.certifications ? `<h2>Certifications &amp; Training</h2><p>${esc(d.certifications)}</p>` : ''}

${d.languages ? `<h2>Languages</h2><p>${esc(d.languages)}</p>` : ''}

</body></html>`;
}

const TEMPLATES = {
  professional: { name: 'Professional',  icon: '🏢', color: '#1e3a5f', accent: '#2563eb',  desc: 'Classic serif layout — elegant & timeless',   fn: tplProfessional },
  modern:       { name: 'Modern',        icon: '✨', color: '#1e1b4b', accent: '#7c3aed',  desc: 'Sidebar design — bold & contemporary',         fn: tplModern       },
  minimal:      { name: 'Minimal',       icon: '🎯', color: '#064e3b', accent: '#0f766e',  desc: 'Ultra-clean — lets content shine',             fn: tplMinimal      },
  ats:          { name: 'ATS Pro',       icon: '🤖', color: '#111827', accent: '#374151',  desc: 'Keyword-optimized for applicant tracking',     fn: tplATS          },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ResumeBuilder({ profile = {}, onSaveProfile, callAI, notify }) {
  const [selectedTpl, setSelectedTpl] = useState('professional');
  const [data, setData]               = useState({ ...profile });
  const [generating, setGenerating]   = useState(false);
  const [genField, setGenField]       = useState('');
  const [jobTarget, setJobTarget]     = useState('');
  const [atsScore, setAtsScore]       = useState(null);
  const [tab, setTab]                 = useState('editor'); // editor | preview | ats

  const upd = (k, v) => setData(p => ({ ...p, [k]: v }));

  const previewHTML = TEMPLATES[selectedTpl].fn(data);

  // ── AI Generation ──────────────────────────────────────────────────────────
  async function generateField(field, instructions) {
    if (!callAI) return notify('AI not configured — add API key in ⚙️ Settings', 'err');
    setGenerating(true); setGenField(field);
    try {
      const ctx = `Name: ${data.full_name || ''}, Skills: ${data.skills || ''}, Experience: ${data.experience?.slice(0,400) || ''}, Education: ${data.education || ''}`;
      const result = await callAI(
        `${instructions}\n\nCandidate context:\n${ctx}\n${jobTarget ? `\nTarget role: ${jobTarget}` : ''}`,
        'You are an expert resume writer. Write concisely and powerfully. No clichés. Be specific and results-driven.'
      );
      upd(field, result.trim());
      notify(`✓ ${field} generated`);
    } catch (err) {
      notify('AI error: ' + err.message, 'err');
    }
    setGenerating(false); setGenField('');
  }

  async function generateFullResume() {
    if (!callAI) return notify('AI not configured', 'err');
    setGenerating(true); setGenField('full');
    try {
      const prompt = `Create a complete, ATS-optimized resume for:
Name: ${data.full_name || 'Candidate'}
Target Role: ${jobTarget || data.target_roles || 'Software Engineer'}
Skills: ${data.skills || 'N/A'}
Education: ${data.education || 'N/A'}
Experience: ${data.experience || 'N/A'}
${data.certifications ? `Certifications: ${data.certifications}` : ''}

Return ONLY valid JSON with keys: summary, experience, skills (comma-separated, keyword-rich), education, certifications.
No markdown. Make summary 3 powerful sentences. Experience as rich bullet points. Optimize for ATS keywords.`;

      const raw2 = await callAI(prompt, 'Return ONLY valid JSON, no markdown, no explanation.');
      const clean = raw2.replace(/```json|```/g,'').trim();
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setData(p => ({ ...p, ...parsed }));
        notify('✓ Full resume generated!');
      }
    } catch (err) {
      notify('Generation error: ' + err.message, 'err');
    }
    setGenerating(false); setGenField('');
  }

  // ── ATS Score ─────────────────────────────────────────────────────────────
  async function checkATS() {
    if (!callAI) return notify('AI not configured', 'err');
    if (!jobTarget.trim()) return notify('Enter target job role/description for ATS check', 'err');
    setGenerating(true); setGenField('ats');
    try {
      const resumeText = `${data.summary || ''} ${data.experience || ''} ${data.skills || ''} ${data.education || ''}`;
      const result = await callAI(
        `Analyze this resume for ATS compatibility against the role: "${jobTarget}"\n\nResume:\n${resumeText.slice(0,1500)}\n\nReturn JSON: {score: 0-100, missing_keywords: [], strengths: [], improvements: [], verdict: "string"}`,
        'Return ONLY valid JSON.'
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
    setTimeout(() => w.print(), 500);
  }

  function downloadHTML() {
    const blob = new Blob([previewHTML], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `Resume_${(data.full_name || 'Resume').replace(/\s+/g,'_')}.html`;
    a.click(); URL.revokeObjectURL(url);
    notify('HTML downloaded — open in Chrome → Print → Save as PDF ✓');
  }

  function syncToProfile() {
    if (onSaveProfile) { onSaveProfile(data); notify('✓ Synced to profile'); }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const s = {
    card:   { background: '#06101e', border: '1px solid #1e2d45', borderRadius: 14, padding: 20 },
    label:  { color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, display: 'block' },
    inp:    { width: '100%', background: '#070f1c', border: '1px solid #1e2d45', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12 },
    ta:     { width: '100%', background: '#070f1c', border: '1px solid #1e2d45', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit', marginBottom: 12 },
    btn:    { background: '#0d1526', border: '1px solid #1e2d45', color: '#94a3b8', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' },
    pri:    { background: 'linear-gradient(135deg,#1d4ed8,#4f46e5)', border: 'none', color: '#fff' },
    grn:    { background: 'linear-gradient(135deg,#064e3b,#065f46)', border: '1px solid rgba(34,197,94,0.2)', color: '#6ee7b7' },
    amb:    { background: 'linear-gradient(135deg,#78350f,#92400e)', border: 'none', color: '#fde68a' },
    vio:    { background: 'linear-gradient(135deg,#4c1d95,#5b21b6)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' },
    spin:   { animation: 'spin 0.8s linear infinite', display: 'inline-block' },
  };

  const Btn = ({ children, onClick, style = {}, disabled }) => (
    <button onClick={onClick} disabled={disabled}
      style={{ ...s.btn, ...style, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {children}
    </button>
  );

  const AIBtn = ({ field, prompt, label }) => (
    <button onClick={() => generateField(field, prompt)} disabled={generating}
      style={{ ...s.btn, ...s.vio, padding: '4px 10px', fontSize: 10, marginLeft: 6, opacity: generating ? 0.5 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}>
      {generating && genField === field ? <span style={s.spin}>◌</span> : '✨'} {label || 'AI Fill'}
    </button>
  );

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>📄 AI Resume Builder</h2>
          <p style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>4 professional templates · AI-powered content · PDF export · ATS checker</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn onClick={syncToProfile}   style={s.grn}>🔄 Sync to Profile</Btn>
          <Btn onClick={openPrint}       style={s.pri}>🖨 Print / Save PDF</Btn>
          <Btn onClick={downloadHTML}    style={{ ...s.btn, background: '#0e7490', border: '1px solid rgba(6,182,212,0.3)', color: '#67e8f9' }}>📥 Download HTML</Btn>
        </div>
      </div>

      {/* Target Role + AI Controls */}
      <div style={{ ...s.card, marginBottom: 18 }}>
        <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          ✨ AI Generation
          <span style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa', padding: '1px 8px', borderRadius: 999, fontSize: 9 }}>Powered by DeepSeek-R1</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          <input value={jobTarget} onChange={e => setJobTarget(e.target.value)} placeholder="Target job role or paste job description for AI context…"
            style={{ ...s.inp, flex: 1, minWidth: 240, margin: 0 }} />
          <Btn onClick={generateFullResume} disabled={generating} style={{ ...s.vio, padding: '10px 18px' }}>
            {generating && genField === 'full' ? <><span style={s.spin}>◌</span> Generating…</> : '⚡ Generate Full Resume'}
          </Btn>
          <Btn onClick={checkATS} disabled={generating} style={{ background: '#0c4a6e', border: '1px solid rgba(14,116,144,0.4)', color: '#67e8f9', padding: '10px 14px' }}>
            {generating && genField === 'ats' ? <span style={s.spin}>◌</span> : '🎯'} ATS Check
          </Btn>
        </div>
        <div style={{ fontSize: 11, color: '#334155' }}>💡 Enter target role for personalized AI content and ATS keyword optimization</div>
      </div>

      {/* Template Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {Object.entries(TEMPLATES).map(([key, tpl]) => (
          <button key={key} onClick={() => setSelectedTpl(key)} style={{
            background: selectedTpl === key ? `${tpl.accent}18` : '#06101e',
            border: `2px solid ${selectedTpl === key ? tpl.accent : '#1e2d45'}`,
            borderRadius: 12, padding: '14px 12px', cursor: 'pointer', textAlign: 'left',
            transition: 'all .15s', fontFamily: 'inherit',
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{tpl.icon}</div>
            <div style={{ color: selectedTpl === key ? '#f1f5f9' : '#94a3b8', fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{tpl.name}</div>
            <div style={{ color: '#475569', fontSize: 10, lineHeight: 1.5 }}>{tpl.desc}</div>
            {selectedTpl === key && <div style={{ marginTop: 8, background: tpl.accent, color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999, display: 'inline-block' }}>ACTIVE</div>}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, background: '#070f1c', border: '1px solid #1e2d45', borderRadius: 12, padding: 4, marginBottom: 18, width: 'fit-content' }}>
        {[['editor','✏️ Editor'],['preview','👁 Live Preview'],['ats','🎯 ATS Report']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? '#1e2d45' : 'transparent', border: 'none', color: tab === t ? '#e2e8f0' : '#475569', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, transition: 'all .15s' }}>{l}</button>
        ))}
      </div>

      {/* Editor */}
      {tab === 'editor' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={s.card}>
              <div style={{ color: '#60a5fa', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Personal Info</div>
              {[['full_name','Full Name'],['headline','Professional Headline'],['email','Email'],['phone','Phone'],['location','Location'],['linkedin','LinkedIn URL'],['github','GitHub URL'],['portfolio','Portfolio URL']].map(([k,lbl]) => (
                <div key={k}>
                  <label style={s.label}>{lbl}</label>
                  <input value={data[k] || ''} onChange={e => upd(k, e.target.value)} style={s.inp} placeholder={lbl} />
                </div>
              ))}
            </div>
            <div style={s.card}>
              <div style={{ color: '#fde047', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Job Preferences</div>
              {[['target_roles','Target Roles'],['target_locations','Target Locations'],['expected_salary','Expected Salary']].map(([k,lbl]) => (
                <div key={k}>
                  <label style={s.label}>{lbl}</label>
                  <input value={data[k] || ''} onChange={e => upd(k, e.target.value)} style={s.inp} placeholder={lbl} />
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={s.card}>
              <div style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Professional Content</div>

              <div>
                <label style={s.label}>
                  Professional Summary
                  <AIBtn field="summary" label="Generate" prompt="Write a powerful 3-sentence professional summary that highlights expertise, key skills, and career goal. Be specific, avoid clichés, quantify impact where possible." />
                </label>
                <textarea value={data.summary || ''} onChange={e => upd('summary', e.target.value)} rows={4} style={s.ta} placeholder="A results-driven software engineer with…" />
              </div>

              <div>
                <label style={s.label}>
                  Skills (comma-separated)
                  <AIBtn field="skills" label="Enhance" prompt="Expand and enrich the candidate's skills list with relevant, in-demand technical and soft skills for their target role. Return comma-separated skills, no explanations." />
                </label>
                <textarea value={data.skills || ''} onChange={e => upd('skills', e.target.value)} rows={3} style={s.ta} placeholder="React, Node.js, Python, SQL, AWS…" />
                {data.skills && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                    {data.skills.split(',').filter(s2=>s2.trim()).map(sk => (
                      <span key={sk} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc', padding: '2px 9px', borderRadius: 999, fontSize: 10 }}>{sk.trim()}</span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={s.label}>
                  Experience
                  <AIBtn field="experience" label="Enhance" prompt="Rewrite the experience section with powerful action verbs, quantified achievements, and ATS-optimized keywords. Use bullet points. Be specific about impact and results." />
                </label>
                <textarea value={data.experience || ''} onChange={e => upd('experience', e.target.value)} rows={6} style={s.ta} placeholder="Software Engineer @ Company (2023–2025)&#10;• Led development of X, resulting in Y% improvement&#10;• Built Z using React and Node.js" />
              </div>

              <div>
                <label style={s.label}>
                  Education
                  <AIBtn field="education" label="Format" prompt="Format the education section professionally with degree, institution, year, relevant coursework, and GPA if strong. Make it ATS-friendly." />
                </label>
                <textarea value={data.education || ''} onChange={e => upd('education', e.target.value)} rows={3} style={s.ta} placeholder="B.E. Computer Science — XYZ University (2022–2026)&#10;CGPA: 8.5/10" />
              </div>

              {[['certifications','Certifications'],['languages','Languages']].map(([k,lbl]) => (
                <div key={k}>
                  <label style={s.label}>{lbl}</label>
                  <input value={data[k] || ''} onChange={e => upd(k, e.target.value)} style={s.inp} placeholder={lbl} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {tab === 'preview' && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
              {TEMPLATES[selectedTpl].icon} {TEMPLATES[selectedTpl].name} Template — Live Preview
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={openPrint}    style={s.pri}>🖨 Print / Save as PDF</Btn>
              <Btn onClick={downloadHTML} style={{ ...s.btn, background: '#0e7490', border: '1px solid rgba(6,182,212,0.3)', color: '#67e8f9' }}>📥 HTML</Btn>
            </div>
          </div>
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #1e2d45', background: '#fff' }}>
            <iframe srcDoc={previewHTML} style={{ width: '100%', height: 720, border: 'none' }} title="Resume Preview" />
          </div>
          <div style={{ marginTop: 12, background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#06b6d4' }}>
            💡 <strong>To save as PDF:</strong> Click "Print / Save as PDF" → In the print dialog, change destination to "Save as PDF" → Save. This gives you a perfect, print-quality PDF.
          </div>
        </div>
      )}

      {/* ATS Report */}
      {tab === 'ats' && (
        <div style={s.card}>
          <div style={{ color: '#67e8f9', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>🎯 ATS Compatibility Report</div>
          {!atsScore ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#334155' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
              <p style={{ fontSize: 13, marginBottom: 16 }}>Enter a target job role above and click <strong style={{ color: '#67e8f9' }}>ATS Check</strong> to analyze your resume</p>
              <p style={{ fontSize: 11, color: '#475569' }}>The AI will score your resume, identify missing keywords, and provide improvement recommendations</p>
            </div>
          ) : (
            <div>
              {/* Score circle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 100, height: 100, borderRadius: '50%', border: `8px solid ${atsScore.score >= 75 ? '#22c55e' : atsScore.score >= 50 ? '#f59e0b' : '#ef4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', margin: '0 auto' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: atsScore.score >= 75 ? '#22c55e' : atsScore.score >= 50 ? '#f59e0b' : '#ef4444' }}>{atsScore.score}</div>
                    <div style={{ fontSize: 10, color: '#475569' }}>/ 100</div>
                  </div>
                  <div style={{ marginTop: 8, color: atsScore.score >= 75 ? '#22c55e' : atsScore.score >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 700, fontSize: 12 }}>
                    {atsScore.score >= 75 ? '✅ Strong' : atsScore.score >= 50 ? '⚠️ Moderate' : '❌ Weak'}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>{atsScore.verdict}</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                {atsScore.strengths?.length > 0 && (
                  <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: 14 }}>
                    <div style={{ color: '#86efac', fontWeight: 700, fontSize: 11, marginBottom: 8 }}>✅ Strengths</div>
                    {atsScore.strengths.map((s2,i) => <div key={i} style={{ color: '#94a3b8', fontSize: 11, marginBottom: 5 }}>• {s2}</div>)}
                  </div>
                )}
                {atsScore.missing_keywords?.length > 0 && (
                  <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 14 }}>
                    <div style={{ color: '#f87171', fontWeight: 700, fontSize: 11, marginBottom: 8 }}>🔍 Missing Keywords</div>
                    {atsScore.missing_keywords.map((k2,i) => (
                      <span key={i} style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '2px 8px', borderRadius: 999, fontSize: 10, margin: '2px', display: 'inline-block' }}>{k2}</span>
                    ))}
                  </div>
                )}
                {atsScore.improvements?.length > 0 && (
                  <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: 14 }}>
                    <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: 11, marginBottom: 8 }}>💡 Improvements</div>
                    {atsScore.improvements.map((im,i) => <div key={i} style={{ color: '#94a3b8', fontSize: 11, marginBottom: 5 }}>• {im}</div>)}
                  </div>
                )}
              </div>
              {atsScore.missing_keywords?.length > 0 && (
                <button onClick={() => {
                  upd('skills', `${data.skills || ''}${data.skills ? ', ' : ''}${atsScore.missing_keywords.join(', ')}`);
                  notify('✓ Missing keywords added to skills');
                }} style={{ ...s.btn, ...s.grn, marginTop: 14 }}>
                  ➕ Add Missing Keywords to Resume
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
