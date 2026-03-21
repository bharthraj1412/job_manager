// patch_prep_v2.cjs — Run with: node patch_prep_v2.cjs
// Complete rewrite of interview prep markdown cleaner + renderer

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'Dashboard.jsx');
if (!fs.existsSync(filePath)) {
  console.error('❌ src/Dashboard.jsx not found.'); process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf-8');
let fixes = 0;

function patch(name, from, to) {
  if (code.includes(from)) {
    code = code.replace(from, to);
    console.log(`✓ ${name}`); fixes++; return true;
  }
  console.warn(`⚠ ${name} — not found`); return false;
}

// ══════════════════════════════════════════════════════════════════
// STEP 1: Replace cleanPrepOutput with a complete rewrite
// Find from "function cleanPrepOutput" to the closing "}" before scrapeJobFromURL
// ══════════════════════════════════════════════════════════════════

// Find and replace the entire cleanPrepOutput function
const oldFnStart = `function cleanPrepOutput(text) {`;
const oldFnEnd = `async function scrapeJobFromURL(url, aiFunc) {`;

const oldFnIdx = code.indexOf(oldFnStart);
const newFnIdx = code.indexOf(oldFnEnd);

if (oldFnIdx !== -1 && newFnIdx !== -1) {
  const before = code.slice(0, oldFnIdx);
  const after  = code.slice(newFnIdx);
  code = before + NEW_CLEAN_FN + '\n\n' + after;
  console.log('✓ Replaced cleanPrepOutput with complete rewrite'); fixes++;
} else {
  console.warn('⚠ cleanPrepOutput function boundaries not found — inserting fresh');
  // Insert before scrapeJobFromURL
  code = code.replace(
    `async function scrapeJobFromURL(url, aiFunc) {`,
    NEW_CLEAN_FN + '\n\nasync function scrapeJobFromURL(url, aiFunc) {'
  );
  fixes++;
}

// ══════════════════════════════════════════════════════════════════
// STEP 2: Strengthen AI prompts — forbid markdown aggressively
// ══════════════════════════════════════════════════════════════════

patch(
  'Strengthen generateInterviewPrep prompt',
  `Generate 8-10 highly specific interview questions for this role. Include:
- 3 technical/role-specific questions based on the job requirements
- 2 behavioral questions (STAR format)
- 2 company/culture fit questions
- 1-2 questions the candidate should ask the interviewer

Role: ${job.title} at ${job.company}
Skills/Requirements: ${job.skills || "Not specified"}
Job Notes: ${(job.notes || "").slice(0, 400)}

Format each question clearly numbered. Add a brief tip for each.`,
  `Generate a structured interview prep guide for this role.

Role: \${job.title} at \${job.company}
Skills/Requirements: \${job.skills || "Not specified"}
Job Notes: \${(job.notes || "").slice(0, 400)}

Output format — use EXACTLY this plain text structure, no exceptions:

SECTION: Technical Questions
Q1. [question]
ANSWER: [2-3 sentence answer]
TIP: [one sentence tip]

Q2. [question]
ANSWER: [2-3 sentence answer]
TIP: [one sentence tip]

Q3. [question]
ANSWER: [answer]
TIP: [tip]

SECTION: Behavioral Questions
Q4. [STAR question]
ANSWER: [STAR answer]
TIP: [tip]

Q5. [STAR question]
ANSWER: [STAR answer]
TIP: [tip]

SECTION: Company & Culture Questions
Q6. [question]
ANSWER: [answer]
TIP: [tip]

Q7. [question]
ANSWER: [answer]
TIP: [tip]

SECTION: Questions to Ask the Interviewer
Q8. [question to ask]
WHY: [why this question is smart to ask]

Q9. [question to ask]
WHY: [why this question is smart to ask]

SECTION: 5 Key Prep Tasks
TASK 1. [task title]
HOW: [concrete steps]
GOAL: [success indicator]

TASK 2. [task title]
HOW: [concrete steps]
GOAL: [success indicator]

TASK 3. [task title]
HOW: [concrete steps]
GOAL: [success indicator]

TASK 4. [task title]
HOW: [concrete steps]
GOAL: [success indicator]

TASK 5. [task title]
HOW: [concrete steps]
GOAL: [success indicator]`
);

patch(
  'Strengthen generateInterviewPrep system prompt',
  `"You are an expert interview coach. Provide practical, specific interview prep. CRITICAL: Plain text only. No markdown tables (no | characters). No --- separators. No ** bold. No # headers. Use numbered lists and plain paragraphs only.",`,
  `"You are an expert interview coach. You MUST follow the output format exactly. FORBIDDEN: markdown tables, | pipe characters, --- separators, ** asterisks, # hash headers, backticks. Use only the SECTION:/Q:/ANSWER:/TIP:/WHY:/TASK:/HOW:/GOAL: labels shown.",`
);

patch(
  'Strengthen doPrep system prompt',
  `"You are an expert career coach. Be specific and actionable. CRITICAL: Plain text only. No markdown tables (no | characters). No --- separators. No ** bold. No # headers. Use numbered lists and plain paragraphs only."`,
  `"You are an expert career coach. FORBIDDEN: markdown tables, | characters, ---, ** bold, # headers, backticks. Use plain numbered lists only."`
);

// ══════════════════════════════════════════════════════════════════
// STEP 3: Replace the interview prep display renderer completely
// ══════════════════════════════════════════════════════════════════

// Remove old renderer and replace with new clean one
const OLD_RENDERER_START = `              <div style={{ maxHeight:520, overflowY:'auto', padding:'0 4px' }}>
                {interviewPrepResult.split('\\n').map((line, i) => {`;
const OLD_RENDERER_END   = `              </div>`;

const rendererStart = code.indexOf(OLD_RENDERER_START);
if (rendererStart !== -1) {
  // Find matching closing div after the map
  let depth = 0, pos = rendererStart, found = -1;
  // We need to find the </div> that closes the outer div
  // Count from the opening div
  const searchFrom = rendererStart + OLD_RENDERER_START.length;
  // Find the line that has just "              </div>" after the map closes
  const afterMap = code.indexOf(`              </div>\n              <div style={{ display:'flex', gap:8, marginTop:16 }}`, rendererStart);
  if (afterMap !== -1) {
    const oldRenderer = code.slice(rendererStart, afterMap + `              </div>`.length);
    code = code.replace(oldRenderer, NEW_RENDERER);
    console.log('✓ Replaced interview prep renderer'); fixes++;
  } else {
    console.warn('⚠ Could not find renderer end boundary — trying alternate');
    // Try alternate: just replace the whole block
    const altEnd = code.indexOf(`</div>\n              <div style={{ display:'flex', gap:8, marginTop:16 }}>`, rendererStart);
    if (altEnd !== -1) {
      const oldBlock = code.slice(rendererStart, altEnd + `</div>`.length);
      code = code.replace(oldBlock, NEW_RENDERER);
      console.log('✓ Replaced interview prep renderer (alt)'); fixes++;
    }
  }
} else {
  console.warn('⚠ New renderer start not found, trying to replace pre-wrap div');
  patch(
    'Replace pre-wrap renderer fallback',
    `<div style={{ whiteSpace:'pre-wrap', color:'#e2e8f0', fontSize:13, lineHeight:1.7, maxHeight:500, overflowY:'auto', padding:'0 2px' }}>
                {interviewPrepResult}
              </div>`,
    NEW_RENDERER
  );
}

// ══════════════════════════════════════════════════════════════════
fs.writeFileSync(filePath, code, 'utf-8');
console.log(`\n✅ Applied ${fixes} fixes`);
console.log(`\n  🎙 Interview prep output completely rewritten`);
console.log(`  📋 AI now outputs structured SECTION:/Q:/ANSWER: format`);
console.log(`  🎨 Renderer parses and styles each part distinctly`);
console.log(`  🚫 All markdown (tables, |, ---, **) stripped at both prompt and render level`);
console.log(`\nRun: npm run dev`);

// ══════════════════════════════════════════════════════════════════
// NEW cleanPrepOutput — handles ALL markdown patterns
// ══════════════════════════════════════════════════════════════════

var NEW_CLEAN_FN = `function cleanPrepOutput(raw) {
  if (!raw) return '';

  // ── Pass 1: strip inline markdown ─────────────────────────────
  let text = raw
    .replace(/\\*\\*(.+?)\\*\\*/gs, '$1')       // **bold**
    .replace(/\\*(.+?)\\*/gs, '$1')           // *italic*
    .replace(/_{1,2}(.+?)_{1,2}/gs, '$1')     // __under__
    .replace(/\\`{1,3}([^\\`]+)\\`{1,3}/g, '$1') // \\`code\\`
    .replace(/\\[(.+?)\\]\\(.+?\\)/g, '$1')     // [link](url)
    .replace(/<br\\s*\\/?>/gi, ' ')            // <br>
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // ── Pass 2: line-by-line processing ───────────────────────────
  const lines = text.split('\\n');
  const out   = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Skip pure separator lines: ---, ===, ***
    if (/^[-=*_]{3,}\\s*$/.test(trimmed)) { out.push(''); continue; }

    // Skip markdown table separator rows: |---|---|
    if (/^\\|[\\s|:-]+\\|\\s*$/.test(trimmed)) continue;

    // Markdown table data rows: | col | col |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      // Skip separator rows
      if (cells.every(c => /^[-:]+$/.test(c))) continue;
      // Skip header rows that are just labels like "#", "Question", "Why", "Answer"
      const isHeader = cells.every(c => /^(#|no|q|question|why|answer|what|how|task|tip|sample|note|detail|matter)s?$/i.test(c) || /^[-:]/.test(c));
      if (isHeader) continue;
      // Convert to readable: skip leading index cell (single digit or empty)
      const dataStart = (cells[0] === '' || /^\\d+$/.test(cells[0])) ? 1 : 0;
      const content = cells.slice(dataStart).join(' — ');
      if (content.trim()) out.push('  ' + content.trim());
      continue;
    }

    // ATX headings: ## or ### 
    const headingM = trimmed.match(/^#{1,6}\\s+(.+)/);
    if (headingM) {
      out.push('');
      out.push('SECTION: ' + headingM[1].replace(/\\*\\*/g,'').trim());
      out.push('');
      continue;
    }

    // Emoji-numbered sections like "1️⃣ Section Title" or "2️⃣ Section"
    const emojiSection = trimmed.match(/^[0-9]+[️⃣\u20E3]*\\s+(.+)/);
    if (emojiSection && trimmed.length < 80 && !trimmed.includes('?')) {
      out.push('');
      out.push('SECTION: ' + emojiSection[1].trim());
      out.push('');
      continue;
    }

    // Bold-only lines used as headers: **Title**
    const boldHeaderM = trimmed.match(/^\\*\\*(.+?)\\*\\*\\s*:?\\s*$/);
    if (boldHeaderM) {
      out.push('');
      out.push('SECTION: ' + boldHeaderM[1].trim());
      out.push('');
      continue;
    }

    // Numbered lists: "1. text" or "1) text"
    const numListM = trimmed.match(/^(\\d+)[.):]\\s+(.+)/);
    if (numListM) {
      out.push('Q' + numListM[1] + '. ' + numListM[2]);
      continue;
    }

    // Bullet points: "- text" or "* text" or "• text"
    const bulletM = trimmed.match(/^[-*•]\\s+(.+)/);
    if (bulletM) {
      out.push('  • ' + bulletM[1]);
      continue;
    }

    out.push(raw);
  }

  // ── Pass 3: collapse multiple blank lines ──────────────────────
  return out.join('\\n').replace(/\\n{3,}/g, '\\n\\n').trim();
}`;

// ══════════════════════════════════════════════════════════════════
// NEW RENDERER — parses structured SECTION:/Q:/ANSWER:/TIP:/etc format
// ══════════════════════════════════════════════════════════════════

var NEW_RENDERER = `              <div style={{ maxHeight:540, overflowY:'auto', padding:'0 4px' }}>
                {(() => {
                  const text = interviewPrepResult;
                  const elements = [];
                  const lines = text.split('\\n');
                  let key = 0;
                  let i = 0;

                  while (i < lines.length) {
                    const line = lines[i];
                    const trimmed = line.trim();
                    key++;

                    // Empty line
                    if (!trimmed) { elements.push(<div key={key} style={{ height: 6 }} />); i++; continue; }

                    // SECTION: header
                    if (trimmed.startsWith('SECTION:')) {
                      const title = trimmed.replace(/^SECTION:\\s*/i, '').replace(/[*_#]/g,'').trim();
                      elements.push(
                        <div key={key} style={{ display:'flex', alignItems:'center', gap:10, marginTop:22, marginBottom:10, paddingBottom:8, borderBottom:'1px solid rgba(99,102,241,0.25)' }}>
                          <span style={{ background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.35)', color:'#a5b4fc', borderRadius:8, padding:'3px 10px', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
                            {title.includes('Technical') ? '⚙️' : title.includes('Behavioral') ? '🧠' : title.includes('Culture') || title.includes('Company') ? '🏢' : title.includes('Ask') ? '💬' : title.includes('Prep') || title.includes('Task') ? '✅' : '▸'}
                          </span>
                          <span style={{ color:'#c4b5fd', fontWeight:700, fontSize:14 }}>{title}</span>
                        </div>
                      );
                      i++; continue;
                    }

                    // Q<n>. question line — look ahead for ANSWER/TIP/WHY
                    const qMatch = trimmed.match(/^(Q\\d+|TASK\\s*\\d+)[.):]\\s*(.+)/i);
                    if (qMatch) {
                      const qLabel = qMatch[1].toUpperCase();
                      const qText  = qMatch[2].replace(/[*_]/g,'').trim();
                      const isTask = qLabel.startsWith('TASK');

                      // Collect sub-lines (ANSWER, TIP, WHY, HOW, GOAL)
                      const subs = [];
                      i++;
                      while (i < lines.length) {
                        const sub = lines[i].trim();
                        if (!sub) { i++; break; }
                        const subM = sub.match(/^(ANSWER|TIP|WHY|HOW|GOAL):\\s*(.+)/i);
                        if (subM) { subs.push({ label: subM[1].toUpperCase(), text: subM[2].trim() }); i++; }
                        else if (/^(Q\\d+|TASK|SECTION|Q:)/i.test(sub)) break;
                        else { subs.push({ label: 'NOTE', text: sub.replace(/^[-*•]\\s*/,'') }); i++; }
                      }

                      const accentColor = isTask ? '#86efac' : '#67e8f9';
                      const bgColor     = isTask ? 'rgba(34,197,94,0.04)' : 'rgba(6,182,212,0.04)';
                      const borderColor = isTask ? 'rgba(34,197,94,0.2)' : 'rgba(6,182,212,0.2)';

                      elements.push(
                        <div key={key} style={{ background:bgColor, border:\`1px solid \${borderColor}\`, borderRadius:12, padding:'14px 16px', marginBottom:10 }}>
                          <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom: subs.length ? 10 : 0 }}>
                            <span style={{ background: isTask ? 'rgba(34,197,94,0.15)' : 'rgba(6,182,212,0.15)', color: accentColor, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700, flexShrink:0, fontFamily:"'JetBrains Mono',monospace", marginTop:1 }}>{qLabel}</span>
                            <span style={{ color:'#e2e8f0', fontWeight:600, fontSize:13, lineHeight:1.55 }}>{qText}</span>
                          </div>
                          {subs.map((s, si) => {
                            const labelColors = { ANSWER:'#94a3b8', TIP:'#fbbf24', WHY:'#a78bfa', HOW:'#86efac', GOAL:'#60a5fa', NOTE:'#64748b' };
                            const labelIcons  = { ANSWER:'💬', TIP:'💡', WHY:'🎯', HOW:'📋', GOAL:'✓', NOTE:'•' };
                            return (
                              <div key={si} style={{ display:'flex', gap:8, marginTop:8, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.04)', alignItems:'flex-start' }}>
                                <span style={{ color: labelColors[s.label] || '#64748b', fontSize:10, fontWeight:700, minWidth:52, flexShrink:0, marginTop:2, display:'flex', alignItems:'center', gap:4 }}>
                                  {labelIcons[s.label] || '•'} {s.label}
                                </span>
                                <span style={{ color:'#94a3b8', fontSize:12, lineHeight:1.65, flex:1 }}>{s.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                      continue;
                    }

                    // Q: / QUESTION: label (alternate format)
                    const qLabelM = trimmed.match(/^(QUESTION|Q):\\s*(.+)/i);
                    if (qLabelM) {
                      elements.push(
                        <div key={key} style={{ display:'flex', gap:8, padding:'8px 12px', background:'rgba(6,182,212,0.04)', borderRadius:8, marginBottom:4 }}>
                          <span style={{ color:'#67e8f9', fontSize:10, fontWeight:700, minWidth:60, flexShrink:0 }}>❓ Q</span>
                          <span style={{ color:'#e2e8f0', fontSize:13, fontWeight:600 }}>{qLabelM[2]}</span>
                        </div>
                      );
                      i++; continue;
                    }

                    // ANSWER: / TIP: / WHY: as standalone lines
                    const subLabelM = trimmed.match(/^(ANSWER|TIP|WHY|HOW|GOAL):\\s*(.+)/i);
                    if (subLabelM) {
                      const labelColors = { ANSWER:'#94a3b8', TIP:'#fbbf24', WHY:'#a78bfa', HOW:'#86efac', GOAL:'#60a5fa' };
                      const labelIcons  = { ANSWER:'💬', TIP:'💡', WHY:'🎯', HOW:'📋', GOAL:'✓' };
                      const lbl = subLabelM[1].toUpperCase();
                      elements.push(
                        <div key={key} style={{ display:'flex', gap:8, padding:'6px 12px', marginBottom:3, alignItems:'flex-start' }}>
                          <span style={{ color: labelColors[lbl] || '#64748b', fontSize:10, fontWeight:700, minWidth:52, flexShrink:0, marginTop:2 }}>
                            {labelIcons[lbl] || '•'} {lbl}
                          </span>
                          <span style={{ color:'#94a3b8', fontSize:12, lineHeight:1.65 }}>{subLabelM[2]}</span>
                        </div>
                      );
                      i++; continue;
                    }

                    // Bullet points
                    const bulletM = trimmed.match(/^[•\\-*]\\s+(.+)/);
                    if (bulletM) {
                      elements.push(
                        <div key={key} style={{ display:'flex', gap:8, padding:'3px 12px', alignItems:'flex-start' }}>
                          <span style={{ color:'#4f46e5', flexShrink:0, marginTop:3, fontSize:10 }}>●</span>
                          <span style={{ color:'#94a3b8', fontSize:13, lineHeight:1.6 }}>{bulletM[1]}</span>
                        </div>
                      );
                      i++; continue;
                    }

                    // Plain text line
                    elements.push(
                      <div key={key} style={{ color:'#64748b', fontSize:13, lineHeight:1.65, padding:'2px 4px' }}>{trimmed}</div>
                    );
                    i++;
                  }

                  return elements;
                })()}
              </div>`;
