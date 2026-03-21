// patch_prep_fix.cjs — Run with: node patch_prep_fix.cjs
// Fixes interview prep output showing raw markdown (tables, ----, |, ** etc.)

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'Dashboard.jsx');
if (!fs.existsSync(filePath)) {
  console.error('❌ src/Dashboard.jsx not found.');
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf-8');
let fixes = 0;

function patch(name, from, to) {
  if (code.includes(from)) {
    code = code.replace(from, to);
    console.log(`✓ ${name}`);
    fixes++;
    return true;
  }
  console.warn(`⚠ ${name} — not found`);
  return false;
}

// ══════════════════════════════════════════════════════════════════
// FIX 1: Add cleanPrepOutput helper after the callAI function
// Converts markdown tables, headers, bold, separators → readable plain text
// ══════════════════════════════════════════════════════════════════
patch(
  'Add cleanPrepOutput helper',
  `async function scrapeJobFromURL(url, aiFunc) {`,
  `function cleanPrepOutput(text) {
  if (!text) return '';

  const lines = text.split('\n');
  const out = [];
  let inTable = false;
  let tableRows = [];
  let colHeaders = [];

  function flushTable() {
    if (!tableRows.length) { inTable = false; return; }
    // Print headers if we have them
    if (colHeaders.length) {
      out.push('  ' + colHeaders.join('   |   '));
      out.push('  ' + colHeaders.map(h => '─'.repeat(Math.max(h.length, 4))).join('───────'));
    }
    tableRows.forEach(row => {
      // row is array of cell strings
      const cleaned = row.map(c => c.trim()).filter(Boolean);
      if (cleaned.length) out.push('  ' + cleaned.join('   |   '));
    });
    out.push('');
    tableRows = [];
    colHeaders = [];
    inTable = false;
  }

  lines.forEach(raw => {
    const line = raw;

    // Markdown table lines start with |
    if (line.trim().startsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);

      // Separator row like |---|---|
      if (cells.every(c => /^[-:]+$/.test(c))) {
        // skip separator, mark next rows as data
        if (!inTable && colHeaders.length) inTable = true;
        return;
      }

      if (!inTable && !colHeaders.length) {
        // First real row = headers
        // Strip leading numbering column (empty or "#")
        const filtered = cells.filter(c => c && c !== '#');
        colHeaders = filtered.map(c =>
          c.replace(/\*\*/g, '').replace(/\`/g, '').trim()
        );
        inTable = true;
        return;
      }

      // Data row — skip index column if it's just a number
      const dataStart = /^\d+$/.test(cells[0]) ? 1 : 0;
      const row = cells.slice(dataStart).map(c =>
        c.replace(/\*\*/g, '').replace(/\`/g, '')
         .replace(/<br\s*\/?>/gi, ' ')
         .replace(/&nbsp;/g, ' ')
         .trim()
      );
      tableRows.push(row);
      return;
    }

    // Non-table line — flush any open table first
    if (inTable || tableRows.length) flushTable();

    // Horizontal rules --- or ===
    if (/^[-=]{3,}\s*$/.test(line.trim())) {
      out.push('');
      return;
    }

    // ATX headings: ## Heading or ### Heading
    const headingMatch = line.match(/^#{1,6}\s+(.+)/);
    if (headingMatch) {
      out.push('');
      out.push('▸ ' + headingMatch[1]
        .replace(/\*\*/g, '').replace(/\`/g, '').replace(/\*/g, '').trim());
      out.push('');
      return;
    }

    // Numbered section like "1️⃣ Section" or "1. Section" at line start
    const emojiSection = line.match(/^([0-9]+[️⃣]*)\s*(.*)/);

    // Bold lines used as headers: **Some Title**
    const boldHeader = line.trim().match(/^\*\*(.+)\*\*\s*:?\s*$/);
    if (boldHeader) {
      out.push('');
      out.push('▸ ' + boldHeader[1].trim());
      out.push('');
      return;
    }

    // Inline cleanup: remove **, *, \`backticks\`, keep content
    let cleaned = line
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/\`{1,3}([^\`]+)\`{1,3}/g, '$1')
      .replace(/_{1,2}(.+?)_{1,2}/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/<br\s*\/?>/gi, '')
      .replace(/&nbsp;/g, ' ');

    out.push(cleaned);
  });

  // Flush any remaining table
  if (inTable || tableRows.length) flushTable();

  // Collapse 3+ blank lines to 2
  const result = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return result;
}

async function scrapeJobFromURL(url, aiFunc) {`
);

// ══════════════════════════════════════════════════════════════════
// FIX 2: Apply cleanPrepOutput to interview prep result
// ══════════════════════════════════════════════════════════════════
patch(
  'Apply cleanPrepOutput in generateInterviewPrep',
  `      setInterviewPrepResult(result.trim());
      notify("✓ Interview prep ready!");
    } catch (err) { notify("AI error: " + err.message, "err"); }
    setInterviewPrepLoading(false);
  }

  // ── Follow-Up Draft Generator`,
  `      setInterviewPrepResult(cleanPrepOutput(result));
      notify("✓ Interview prep ready!");
    } catch (err) { notify("AI error: " + err.message, "err"); }
    setInterviewPrepLoading(false);
  }

  // ── Follow-Up Draft Generator`
);

// ══════════════════════════════════════════════════════════════════
// FIX 3: Also apply to the old doPrep function
// ══════════════════════════════════════════════════════════════════
patch(
  'Apply cleanPrepOutput in doPrep',
  `      setPrepOut(cleanAI(t));`,
  `      setPrepOut(cleanPrepOutput(cleanAI(t)));`
);

// ══════════════════════════════════════════════════════════════════
// FIX 4: Update the system prompt to discourage markdown tables
// ══════════════════════════════════════════════════════════════════
patch(
  'Update generateInterviewPrep system prompt',
  `        "You are an expert interview coach. Provide practical, specific interview prep. Plain text only, no markdown.",`,
  `        "You are an expert interview coach. Provide practical, specific interview prep. CRITICAL: Plain text only. No markdown tables (no | characters). No --- separators. No ** bold. No # headers. Use numbered lists and plain paragraphs only.",`
);

patch(
  'Update doPrep system prompt',
  `        "You are an expert career coach. Be specific and actionable."`,
  `        "You are an expert career coach. Be specific and actionable. CRITICAL: Plain text only. No markdown tables (no | characters). No --- separators. No ** bold. No # headers. Use numbered lists and plain paragraphs only."`
);

// ══════════════════════════════════════════════════════════════════
// FIX 5: Style the interview prep display better
// Replace the pre-wrap div with styled output
// ══════════════════════════════════════════════════════════════════
patch(
  'Style interview prep display',
  `              <div style={{ whiteSpace:'pre-wrap', color:'#e2e8f0', fontSize:13, lineHeight:1.7, maxHeight:500, overflowY:'auto', padding:'0 2px' }}>
                {interviewPrepResult}
              </div>`,
  `              <div style={{ maxHeight:520, overflowY:'auto', padding:'0 4px' }}>
                {interviewPrepResult.split('\\n').map((line, i) => {
                  const isEmpty = !line.trim();
                  if (isEmpty) return <div key={i} style={{ height: 8 }} />;

                  // Section header line (starts with ▸)
                  if (line.startsWith('▸ ')) {
                    return (
                      <div key={i} style={{ color:'#a5b4fc', fontWeight:700, fontSize:13, marginTop:16, marginBottom:6, paddingBottom:6, borderBottom:'1px solid rgba(99,102,241,0.2)', display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ color:'#4f46e5', fontSize:16 }}>◆</span>
                        {line.slice(2)}
                      </div>
                    );
                  }

                  // Table row (lines starting with "  " and containing |)
                  if (line.includes('   |   ')) {
                    const isRule = line.trim().replace(/[─|\\s]/g,'').length === 0;
                    if (isRule) return <div key={i} style={{ borderBottom:'1px solid #1e2d45', margin:'2px 0 4px' }} />;
                    const cells = line.split('   |   ').map(c => c.trim()).filter(Boolean);
                    return (
                      <div key={i} style={{ display:'flex', gap:12, padding:'6px 10px', background:'rgba(255,255,255,0.025)', borderRadius:6, marginBottom:3, fontSize:12, color:'#94a3b8', flexWrap:'wrap' }}>
                        {cells.map((cell, ci) => (
                          <span key={ci} style={{ flex: ci === 0 ? '0 0 auto' : 1, minWidth: ci === 0 ? 20 : 80, color: ci === 0 ? '#60a5fa' : '#94a3b8' }}>{cell}</span>
                        ))}
                      </div>
                    );
                  }

                  // Bullet point
                  if (line.trim().startsWith('• ') || line.trim().startsWith('- ')) {
                    return (
                      <div key={i} style={{ display:'flex', gap:8, padding:'3px 8px', fontSize:13, color:'#94a3b8', lineHeight:1.6 }}>
                        <span style={{ color:'#4f46e5', flexShrink:0, marginTop:2 }}>•</span>
                        <span>{line.trim().slice(2)}</span>
                      </div>
                    );
                  }

                  // Numbered item: "1. " or "Q1 " or "1 "
                  const numMatch = line.trim().match(/^([QqA]?\d+[\.\):]?)\s+(.+)/);
                  if (numMatch) {
                    return (
                      <div key={i} style={{ display:'flex', gap:10, padding:'5px 8px', fontSize:13, color:'#e2e8f0', lineHeight:1.65, marginBottom:2 }}>
                        <span style={{ color:'#818cf8', fontWeight:700, flexShrink:0, minWidth:28, fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>{numMatch[1]}</span>
                        <span style={{ color:'#d1d5db' }}>{numMatch[2]}</span>
                      </div>
                    );
                  }

                  // Tip / note line
                  if (/^tip:|^note:|^hint:/i.test(line.trim())) {
                    return (
                      <div key={i} style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#a5b4fc', margin:'6px 0', lineHeight:1.6 }}>
                        💡 {line.replace(/^tip:|^note:|^hint:/i, '').trim()}
                      </div>
                    );
                  }

                  // Plain text
                  return (
                    <div key={i} style={{ fontSize:13, color:'#94a3b8', lineHeight:1.65, padding:'2px 8px' }}>
                      {line}
                    </div>
                  );
                })}
              </div>`
);

// Also fix the old showPrep modal (doPrep output)
patch(
  'Style old prep modal display',
  `{!prepLoad && prepOut && <div style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 12, padding: 18, whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 13, color: "#94a3b8", maxHeight: 520, overflowY: "auto" }}>{prepOut}</div>}`,
  `{!prepLoad && prepOut && (
          <div style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 12, padding: 18, maxHeight: 520, overflowY: "auto" }}>
            {prepOut.split('\\n').map((line, i) => {
              if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
              if (line.startsWith('▸ ')) return <div key={i} style={{ color:'#a5b4fc', fontWeight:700, fontSize:13, marginTop:14, marginBottom:5, paddingBottom:5, borderBottom:'1px solid rgba(99,102,241,0.2)' }}>◆ {line.slice(2)}</div>;
              if (line.includes('   |   ')) {
                const cells = line.split('   |   ').map(c => c.trim()).filter(Boolean);
                return <div key={i} style={{ display:'flex', gap:10, padding:'5px 8px', background:'rgba(255,255,255,0.025)', borderRadius:5, marginBottom:2, fontSize:12, flexWrap:'wrap' }}>{cells.map((c,ci) => <span key={ci} style={{ flex:ci===0?'0 0 auto':1, color:ci===0?'#60a5fa':'#94a3b8', minWidth:ci===0?20:80 }}>{c}</span>)}</div>;
              }
              if (line.trim().startsWith('• ') || line.trim().startsWith('- ')) return <div key={i} style={{ display:'flex', gap:8, padding:'2px 6px', fontSize:13, color:'#94a3b8' }}><span style={{ color:'#4f46e5' }}>•</span><span>{line.trim().slice(2)}</span></div>;
              const nm = line.trim().match(/^([QqA]?\d+[\.\):]?)\s+(.+)/);
              if (nm) return <div key={i} style={{ display:'flex', gap:10, padding:'4px 6px', fontSize:13 }}><span style={{ color:'#818cf8', fontWeight:700, minWidth:26, fontFamily:'monospace', fontSize:12 }}>{nm[1]}</span><span style={{ color:'#d1d5db' }}>{nm[2]}</span></div>;
              return <div key={i} style={{ fontSize:13, color:'#94a3b8', lineHeight:1.65, padding:'2px 6px' }}>{line}</div>;
            })}
          </div>
        )}`
);

// ══════════════════════════════════════════════════════════════════
fs.writeFileSync(filePath, code, 'utf-8');
console.log(`\n✅ Applied ${fixes} fixes`);
console.log(`\n  🎙 Interview prep now renders clean, readable output`);
console.log(`  📋 Markdown tables → styled rows`);
console.log(`  ✦  Headers, bullets, numbered items all styled`);
console.log(`  🚫 System prompt updated to discourage markdown`);
console.log(`\nRun: npm run dev`);
