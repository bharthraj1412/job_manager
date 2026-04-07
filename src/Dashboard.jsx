import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import * as XLSX from "xlsx";
import ResumeBuilder, { cleanAI } from './ResumeBuilder';
import Calendar from './Calendar';

// ── Constants ──────────────────────────────────────────────────────────────
const STATUS = ["Bookmarked", "Applied", "Interview", "Offer", "Rejected", "Withdrawn"];
const SC = {
  Bookmarked: { bg: "rgba(29,78,216,0.12)", border: "#1d4ed8", text: "#93c5fd", dot: "#3b82f6" },
  Applied: { bg: "rgba(8,145,178,0.12)", border: "#0891b2", text: "#67e8f9", dot: "#06b6d4" },
  Interview: { bg: "rgba(22,163,74,0.12)", border: "#16a34a", text: "#86efac", dot: "#22c55e" },
  Offer: { bg: "rgba(202,138,4,0.12)", border: "#ca8a04", text: "#fde047", dot: "#eab308" },
  Rejected: { bg: "rgba(220,38,38,0.12)", border: "#dc2626", text: "#fca5a5", dot: "#ef4444" },
  Withdrawn: { bg: "rgba(82,82,82,0.12)", border: "#525252", text: "#a3a3a3", dot: "#737373" },
};
const GMAIL_STATUS_COLORS = {
  "Interview Scheduled": { bg: "rgba(37,99,235,0.18)", fg: "#60a5fa", accent: "#2563eb", lb: "#1e3a8a" },
  "Offer Received": { bg: "rgba(16,185,129,0.18)", fg: "#34d399", accent: "#10b981", lb: "#064e3b" },
  Rejected: { bg: "rgba(239,68,68,0.18)", fg: "#f87171", accent: "#ef4444", lb: "#7f1d1d" },
  Applied: { bg: "rgba(245,158,11,0.18)", fg: "#fbbf24", accent: "#f59e0b", lb: "#78350f" },
  Screening: { bg: "rgba(139,92,246,0.18)", fg: "#4ade80", accent: "#8b5cf6", lb: "#065f46" },
  Pending: { bg: "rgba(148,163,184,0.12)", fg: "#94a3b8", accent: "#64748b", lb: "#1e293b" },
};
const TYPES = ["Full-time", "Part-time", "Internship", "Contract", "Freelance"];
const ADZUNA_CATEGORIES = [
  { value: "", label: "All Categories" }, { value: "it-jobs", label: "IT / Software" },
  { value: "engineering-jobs", label: "Engineering" }, { value: "accounting-finance-jobs", label: "Finance" },
  { value: "sales-jobs", label: "Sales" }, { value: "marketing-jobs", label: "Marketing" },
  { value: "hr-jobs", label: "HR" }, { value: "graduate-jobs", label: "Graduate / Fresher" },
  { value: "healthcare-nursing-jobs", label: "Healthcare" }, { value: "teaching-jobs", label: "Teaching" },
  { value: "creative-design-jobs", label: "Design" }, { value: "legal-jobs", label: "Legal" },
];
const EXPERIENCE_LEVELS = [
  { value: "", label: "All Levels", color: "#94a3b8", keywords: "" },
  { value: "fresher", label: "Fresher / 0–1 yr", color: "#34d399", keywords: "fresher entry level graduate trainee" },
  { value: "junior", label: "Junior / 1–3 yrs", color: "#60a5fa", keywords: "junior associate 1 2 3 years" },
  { value: "mid", label: "Mid / 3–5 yrs", color: "#4ade80", keywords: "mid level 3 4 5 years" },
  { value: "senior", label: "Senior / 5+ yrs", color: "#f59e0b", keywords: "senior lead principal 5 6 7 years" },
  { value: "manager", label: "Manager / Lead", color: "#f87171", keywords: "manager lead head director" },
];

function filterByExperience(results, expValue) {
  if (!expValue) return results;
  const level = EXPERIENCE_LEVELS.find(e => e.value === expValue);
  if (!level) return results;
  const excludeKeywords = {
    fresher: ["senior","lead","principal","manager","head of","director","7+ years","10+ years","5+ years experience"],
    junior:  ["senior","principal","director","10+ years"],
    mid:     [],
    senior:  ["fresher","entry level","graduate trainee","0-1 year"],
    manager: ["fresher","entry level","junior","associate"]
  }[expValue] || [];
  if (!excludeKeywords.length) return results;
  return results.filter(r => {
    const text = `${r.title} ${r.description || ''}`.toLowerCase();
    return !excludeKeywords.some(k => text.includes(k.toLowerCase()));
  });
}

const NVIDIA_API_URL = '/api/ai';
const NVIDIA_MODEL   = import.meta.env.VITE_AI_MODEL || 'meta/llama-3.1-70b-instruct';

const AVAILABLE_MODELS = [
  { value: 'meta/llama-3.1-70b-instruct',          label: 'Llama 3.1 70B Instruct (recommended)' },
  { value: 'meta/llama-3.3-70b-instruct',          label: 'Llama 3.3 70B Instruct' },
  { value: 'meta/llama-3.1-8b-instruct',           label: 'Llama 3.1 8B (fast)' },
  { value: 'mistralai/mistral-7b-instruct-v0.3',   label: 'Mistral 7B v0.3' },
  { value: 'mistralai/mixtral-8x7b-instruct-v0.1', label: 'Mixtral 8x7B' },
  { value: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'Nemotron 70B (NVIDIA)' },
  { value: 'microsoft/phi-3-medium-128k-instruct', label: 'Phi-3 Medium 128K' },
  { value: 'google/gemma-2-27b-it',                label: 'Gemma 2 27B' },
  { value: 'qwen/qwen2.5-72b-instruct',            label: 'Qwen 2.5 72B' },
  { value: 'custom',                                label: '✏️ Custom model string…' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
const daysDiff = d => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;
const todayStr = () => new Date().toISOString().split("T")[0];

function extractSkillsFromText(text) {
  if (!text) return "";
  const SKILL_LIST = ["Python", "Java", "JavaScript", "TypeScript", "React", "Angular", "Vue", "Node.js", "Next.js", "SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "HTML", "CSS", "Tailwind", "REST API", "GraphQL", "PHP", "Go", "Rust", "C++", "C#", ".NET", "Spring Boot", "Django", "Flask", "FastAPI", "Express", "Machine Learning", "Deep Learning", "AI/ML", "TensorFlow", "PyTorch", "NLP", "Data Science", "Tableau", "Power BI", "Excel", "Linux", "Bash", "Git", "Agile", "Scrum", "Figma", "Android", "iOS", "Flutter", "React Native", "Selenium", "Jest", "DevOps", "Cybersecurity", "Blockchain", "VLSI", "Embedded"];
  const found = [];
  const lower = text.toLowerCase();
  for (const skill of SKILL_LIST) {
    if (lower.includes(skill.toLowerCase()) && !found.includes(skill)) found.push(skill);
    if (found.length >= 10) break;
  }
  return found.join(", ");
}

function formatSalary(min, max) {
  if (!min) return null;
  const fmt = n => n >= 100000 ? `₹${(n / 100000).toFixed(1)} LPA` : `₹${Math.round(n).toLocaleString("en-IN")}`;
  return max && max !== min ? `${fmt(min)} – ${fmt(max)}` : fmt(min);
}

// Maps Gmail scan categories to valid tracker job statuses.
// Falls back to "Applied" for any unrecognized category so new jobs
// are always created with a valid status rather than being silently dropped.
function emailCategoryToStatus(category) {
  const map = {
    "Interview Scheduled": "Interview",
    "Offer Received":      "Offer",
    "Rejected":            "Rejected",
    "Applied":             "Applied",
    "Screening":           "Applied",
    "Follow-up":           "Applied",
    "Pending":             "Applied",
  };
  return map[category] || "Applied";
}

// Extracts readable plain-text body from a Gmail message returned by format=full.
// Walks the MIME tree preferring text/plain, falls back to text/html stripped of tags.
// Returns at most maxLen characters so AI prompts stay concise.
function extractEmailBody(payload, maxLen = 800) {
  function decode(b64url) {
    try { return atob(b64url.replace(/-/g, "+").replace(/_/g, "/")); } catch { return ""; }
  }
  function walkPart(part, prefer) {
    if (!part) return "";
    if (part.mimeType === prefer && part.body?.data) return decode(part.body.data);
    if (part.parts) { for (const p of part.parts) { const t = walkPart(p, prefer); if (t) return t; } }
    return "";
  }
  let text = walkPart(payload, "text/plain");
  if (!text) {
    const html = walkPart(payload, "text/html");
    text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  }
  return text.replace(/\s+/g, " ").trim().substring(0, maxLen);
}

function calcMatchScore(jobSkills, profileSkills) {
  if (!jobSkills || !profileSkills) return 0;
  const jSkills = jobSkills.toLowerCase().split(/[,\s]+/).filter(s => s.length > 2);
  const pSkills = profileSkills.toLowerCase().split(/[,\s]+/).filter(s => s.length > 2);
  if (!jSkills.length) return 0;
  const matches = jSkills.filter(js => pSkills.some(ps => ps.includes(js) || js.includes(ps)));
  return Math.round((matches.length / jSkills.length) * 100);
}

function extractEmailFromJob(job) {
  const combined = `${job.notes || ''} ${job.source || ''}`;
  const match = combined.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

function buildApplicationEmailHTML(job, coverLetter, prof) {
  const name = prof.full_name || 'Candidate';
  const lines = coverLetter.split('\n').filter(l => l.trim()).map(l => `<p style="margin:0 0 14px;line-height:1.7">${l}</p>`).join('');
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:auto;padding:40px 20px">
<p style="margin:0 0 20px">Dear Hiring Manager at ${job.company},</p>
${lines}
<p style="margin:20px 0 4px">Sincerely,<br><strong>${name}</strong></p>
${prof.phone    ? `<p style="margin:0;color:#555;font-size:12px">${prof.phone}</p>` : ''}
${prof.email    ? `<p style="margin:0;color:#555;font-size:12px">${prof.email}</p>` : ''}
${prof.linkedin ? `<p style="margin:0;color:#555;font-size:12px">${prof.linkedin}</p>` : ''}
${prof.portfolio? `<p style="margin:0;color:#555;font-size:12px">${prof.portfolio}</p>` : ''}
<hr style="border:none;border-top:1px solid #eee;margin:20px 0">
<p style="font-size:11px;color:#999">Applied via JobBoard Pro · ${new Date().toLocaleDateString()}</p>
</body></html>`;
}

async function callAI(prompt, sys = '', apiKeyOverride, modelOverride, proxyOverride) {
  const messages = [];
  if (sys) messages.push({ role: 'system', content: sys });
  messages.push({ role: 'user', content: prompt });

  const model   = modelOverride   || NVIDIA_MODEL;
  const apiUrl  = proxyOverride   || NVIDIA_API_URL;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKeyOverride) headers['Authorization'] = `Bearer ${apiKeyOverride}`;

  const r = await fetch(apiUrl, {
    method:  'POST',
    headers,
    body: JSON.stringify({ model, messages, max_tokens: 4096 }),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`API ${r.status}: ${t}`); }
  const d = await r.json();
  if (d.error) throw new Error(typeof d.error === 'string' ? d.error : (d.error.message || JSON.stringify(d.error)));
  return d.choices?.[0]?.message?.content || '';
}

function cleanPrepOutput(raw) {
  if (!raw) return '';

  // ── Pass 1: strip inline markdown ─────────────────────────────
  let text = raw
    .replace(/\*\*(.+?)\*\*/gs, '$1')       // **bold**
    .replace(/\*(.+?)\*/gs, '$1')           // *italic*
    .replace(/_{1,2}(.+?)_{1,2}/gs, '$1')     // __under__
    .replace(/\`{1,3}([^\`]+)\`{1,3}/g, '$1') // `code`
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')     // [link](url)
    .replace(/<br\s*\/?>/gi, ' ')            // <br>
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // ── Pass 2: line-by-line processing ───────────────────────────
  const lines = text.split('\n');
  const out   = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Skip pure separator lines: ---, ===, ***
    if (/^[-=*_]{3,}\s*$/.test(trimmed)) { out.push(''); continue; }

    // Skip markdown table separator rows: |---|---|
    if (/^\|[\s|:-]+\|\s*$/.test(trimmed)) continue;

    // Markdown table data rows: | col | col |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      // Skip separator rows
      if (cells.every(c => /^[-:]+$/.test(c))) continue;
      // Skip header rows that are just labels like "#", "Question", "Why", "Answer"
      const isHeader = cells.every(c => /^(#|no|q|question|why|answer|what|how|task|tip|sample|note|detail|matter)s?$/i.test(c) || /^[-:]/.test(c));
      if (isHeader) continue;
      // Convert to readable: skip leading index cell (single digit or empty)
      const dataStart = (cells[0] === '' || /^\d+$/.test(cells[0])) ? 1 : 0;
      const content = cells.slice(dataStart).join(' — ');
      if (content.trim()) out.push('  ' + content.trim());
      continue;
    }

    // ATX headings: ## or ### 
    const headingM = trimmed.match(/^#{1,6}\s+(.+)/);
    if (headingM) {
      out.push('');
      out.push('SECTION: ' + headingM[1].replace(/\*\*/g,'').trim());
      out.push('');
      continue;
    }

    // Emoji-numbered sections like "1️⃣ Section Title" or "2️⃣ Section"
    const emojiSection = trimmed.match(/^[0-9]+[️⃣\u20E3]*\s+(.+)/);
    if (emojiSection && trimmed.length < 80 && !trimmed.includes('?')) {
      out.push('');
      out.push('SECTION: ' + emojiSection[1].trim());
      out.push('');
      continue;
    }

    // Bold-only lines used as headers: **Title**
    const boldHeaderM = trimmed.match(/^\*\*(.+?)\*\*\s*:?\s*$/);
    if (boldHeaderM) {
      out.push('');
      out.push('SECTION: ' + boldHeaderM[1].trim());
      out.push('');
      continue;
    }

    // Numbered lists: "1. text" or "1) text"
    const numListM = trimmed.match(/^(\d+)[.):]\s+(.+)/);
    if (numListM) {
      out.push('Q' + numListM[1] + '. ' + numListM[2]);
      continue;
    }

    // Bullet points: "- text" or "* text" or "• text"
    const bulletM = trimmed.match(/^[-*•]\s+(.+)/);
    if (bulletM) {
      out.push('  • ' + bulletM[1]);
      continue;
    }

    out.push(raw);
  }

  // ── Pass 3: collapse multiple blank lines ──────────────────────
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function scrapeJobFromURL(url, aiFunc) {
  const readerUrl = `https://r.jina.ai/${url}`;
  let pageText = '';
  try {
    const res = await fetch(readerUrl, { 
      headers: { Accept: 'text/plain' }, 
      signal: AbortSignal.timeout(15000) 
    });
    pageText = await res.text();
  } catch (err) {
    throw new Error(`Could not fetch URL: ${err.message}`);
  }
  if (!pageText || pageText.length < 100) throw new Error('No content found at this URL');

  const result = await aiFunc(
    `Extract job posting information from this webpage and return ONLY valid JSON (no markdown):
{
  "title": "exact job title",
  "company": "company name", 
  "location": "location or Remote",
  "type": "Full-time or Part-time or Internship or Contract or Freelance",
  "salary": "salary if mentioned else empty string",
  "skills": "comma-separated skills found",
  "deadline": "YYYY-MM-DD if found else empty string",
  "notes": "key requirements summary max 400 chars",
  "applylink": "${url}"
}

Webpage content:
${pageText.slice(0, 5000)}`,
    'Return ONLY valid JSON. No markdown.'
  );

  const clean = result.replace(/```json|```/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse job data');
  const parsed = JSON.parse(match[0]);
  return {
    title: parsed.title || 'Unknown Role',
    company: parsed.company || 'Unknown Company',
    location: parsed.location || '',
    type: ['Full-time','Part-time','Internship','Contract','Freelance'].includes(parsed.type) ? parsed.type : 'Full-time',
    salary: parsed.salary || '',
    skills: parsed.skills || '',
    deadline: parsed.deadline || '',
    notes: parsed.notes || '',
    applylink: url,
    status: 'Bookmarked',
    priority: 'Medium',
    source: 'URL Import',
    applieddate: '',
  };
}

// ── Gmail / Drive Helpers ────────────────────────────────────────────────────
async function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve(window.google.accounts.oauth2);
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.defer = true;
    s.onload = () => resolve(window.google.accounts.oauth2); s.onerror = reject;
    document.body.appendChild(s);
  });
}

// Scopes granted to session.provider_token at login.
// Auth.jsx now only requests 'email profile' at sign-in to avoid Google's
// "unverified app" warning. ALL Google API features use incremental auth
// via GIS popup (cached 55 min in sessionStorage) so provider_token is
// never used for sensitive scopes.
const OAUTH_LOGIN_SCOPES = new Set([
  // Only basic scopes — no sensitive scopes at login
  "email",
  "profile",
  "openid",
]);

// Stable cache key: sort scope words so order doesn't matter, then hash simply
function scopeCacheKey(scope) {
  const words = scope.trim().split(/\s+/).sort().join("|");
  // simple djb2-style hash → hex string so it's safe as a storage key
  let h = 5381;
  for (let i = 0; i < words.length; i++) h = ((h << 5) + h) ^ words.charCodeAt(i);
  return "gtoken_" + (h >>> 0).toString(16);
}

async function getGoogleToken(scope, session, clientId) {
  // Auth.jsx now only requests email+profile at login, so provider_token
  // never has sensitive scopes. All Google API calls go through GIS popup
  // which shows a minimal, feature-specific consent screen (not scary).

  // 1. Check sessionStorage — cached from a previous GIS consent this session
  const cacheKey = scopeCacheKey(scope);
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { token, exp } = JSON.parse(cached);
      if (token && Date.now() < exp) return token;
    }
  } catch { }

  // 2. Request via GIS — shows "JobBoard Pro wants to access your Gmail" etc.
  //    This only pops up once per scope-set per session (55-min cache).
  if (!clientId) throw new Error(
    "Google Client ID not set — add it in ⚙️ Settings to use Google features."
  );
  const gis = await loadGis();
  return new Promise((resolve, reject) => {
    const tc = gis.initTokenClient({
      client_id: clientId,
      scope,
      callback: (r) => {
        if (r.error) return reject(new Error(r.error_description || r.error));
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            token: r.access_token,
            exp: Date.now() + 3300000, // 55 min
          }));
        } catch { }
        resolve(r.access_token);
      },
    });
    // prompt:"" = no account-picker if already signed in; shows consent only
    tc.requestAccessToken({ prompt: "" });
  });
}

// FIX: Proper UTF-8 → base64url encoding required by Gmail API
function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// FIX: Correct RFC 2822 + Gmail API raw message encoding
async function sendEmailViaGmail(to, subject, htmlBody, token) {
  const subjectB64 = btoa(unescape(encodeURIComponent(subject)));
  const rawEmail = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${subjectB64}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
  ].join("\r\n");

  const encoded = toBase64Url(rawEmail);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Gmail send failed: ${t}`); }
  return res.json();
}

// FIX: Find or create "JobBoard Pro" folder on Drive
async function getOrCreateDriveFolder(folderName, token) {
  const q = encodeURIComponent(
    `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchData = await searchRes.json();
  if (searchData.files?.length) return searchData.files[0].id;

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: folderName, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!createRes.ok) throw new Error("Could not create Drive folder");
  const folder = await createRes.json();
  return folder.id;
}

// FIX: Save file inside "JobBoard Pro" folder
async function saveFileToDrive(filename, content, mimeType, token) {
  const folderId = await getOrCreateDriveFolder("JobBoard Pro", token);
  const metadata = { name: filename, mimeType, parents: [folderId] };
  const fileBlob = new Blob([content], { type: mimeType });
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", fileBlob, filename);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }
  );
  if (!res.ok) { const t = await res.text(); throw new Error(`Drive save failed: ${t}`); }
  return res.json();
}

// FIX: Load PDF.js for proper PDF text extraction
async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = resolve; s.onerror = reject;
    document.body.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return window.pdfjsLib;
}

// ── jsPDF loader (for PDF export) ────────────────────────────────────────────
async function loadJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = resolve; s.onerror = reject;
    document.body.appendChild(s);
  });
  // load autotable plugin
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
    s.onload = resolve; s.onerror = reject;
    document.body.appendChild(s);
  });
  return window.jspdf.jsPDF;
}

// ── Generate Progress Report PDF ──────────────────────────────────────────────
async function generateProgressPDF(jobs, reportDate, profileName) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  // Header gradient bar
  doc.setFillColor(13, 21, 38);
  doc.rect(0, 0, pw, 38, "F");
  doc.setFillColor(29, 78, 216);
  doc.rect(0, 36, pw, 2, "F");

  // Title
  doc.setTextColor(241, 245, 249);
  doc.setFontSize(22); doc.setFont("helvetica", "bold");
  doc.text("🎯 JobBoard Pro", 14, 16);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(`Daily Progress Report  ·  ${reportDate}${profileName ? "  ·  " + profileName : ""}`, 14, 28);

  let y = 48;

  // Stats row
  const stats = STATUS.reduce((a, s) => { a[s] = jobs.filter(j => j.status === s).length; return a; }, {});
  const totalActive = jobs.filter(j => !["Rejected", "Withdrawn"].includes(j.status)).length;
  const responseRate = jobs.length ? Math.round(((stats.Interview || 0) + (stats.Offer || 0) + (stats.Rejected || 0)) / jobs.length * 100) : 0;
  const statBoxes = [
    ["Total", jobs.length, [96, 165, 250]],
    ["Active", totalActive, [134, 239, 172]],
    ["Interviews", stats.Interview || 0, [34, 197, 94]],
    ["Offers", stats.Offer || 0, [253, 224, 71]],
    ["Response", responseRate + "%", [192, 132, 252]],
  ];
  const bw = (pw - 28) / statBoxes.length;
  statBoxes.forEach(([label, val, rgb], i) => {
    const bx = 14 + i * bw;
    doc.setFillColor(6, 16, 30); doc.roundedRect(bx, y, bw - 3, 22, 3, 3, "F");
    doc.setTextColor(...rgb); doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text(String(val), bx + (bw - 3) / 2, y + 13, { align: "center" });
    doc.setTextColor(71, 85, 105); doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), bx + (bw - 3) / 2, y + 20, { align: "center" });
  });
  y += 30;

  // Status breakdown table
  doc.setTextColor(148, 163, 184); doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("STATUS BREAKDOWN", 14, y); y += 5;
  doc.autoTable({
    startY: y,
    head: [["Status", "Count", "% of Total"]],
    body: STATUS.map(s => [s, stats[s] || 0, jobs.length ? Math.round((stats[s] || 0) / jobs.length * 100) + "%" : "—"]),
    theme: "plain",
    styles: { fontSize: 9, textColor: [148, 163, 184], fillColor: [6, 16, 30], cellPadding: 3 },
    headStyles: { fillColor: [7, 17, 31], textColor: [71, 85, 105], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [10, 22, 40] },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Interviews section
  const interviews = jobs.filter(j => j.status === "Interview");
  if (interviews.length) {
    doc.setTextColor(134, 239, 172); doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("🎙 ACTIVE INTERVIEWS", 14, y); y += 5;
    doc.autoTable({
      startY: y,
      head: [["Role", "Company", "Location", "Deadline"]],
      body: interviews.map(j => [j.title, j.company, j.location || "—", j.deadline || "—"]),
      theme: "plain",
      styles: { fontSize: 9, textColor: [148, 163, 184], fillColor: [6, 16, 30], cellPadding: 3 },
      headStyles: { fillColor: [5, 46, 22], textColor: [134, 239, 172], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [10, 22, 40] },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Upcoming deadlines
  const upcoming = jobs.filter(j => j.deadline && daysDiff(j.deadline) >= 0 && daysDiff(j.deadline) <= 7);
  if (upcoming.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setTextColor(251, 191, 36); doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("⏰ DEADLINES THIS WEEK", 14, y); y += 5;
    doc.autoTable({
      startY: y,
      head: [["Role", "Company", "Status", "Days Left"]],
      body: upcoming.sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).map(j => [j.title, j.company, j.status, daysDiff(j.deadline) === 0 ? "Today!" : daysDiff(j.deadline) + "d left"]),
      theme: "plain",
      styles: { fontSize: 9, textColor: [148, 163, 184], fillColor: [6, 16, 30], cellPadding: 3 },
      headStyles: { fillColor: [28, 16, 0], textColor: [251, 191, 36], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [10, 22, 40] },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Recent applications
  const recent = jobs.filter(j => j.status === "Applied").slice(0, 8);
  if (recent.length) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setTextColor(103, 232, 249); doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("✉️ RECENTLY APPLIED", 14, y); y += 5;
    doc.autoTable({
      startY: y,
      head: [["Role", "Company", "Location", "Salary"]],
      body: recent.map(j => [j.title, j.company, j.location || "—", j.salary || "—"]),
      theme: "plain",
      styles: { fontSize: 9, textColor: [148, 163, 184], fillColor: [6, 16, 30], cellPadding: 3 },
      headStyles: { fillColor: [12, 34, 54], textColor: [103, 232, 249], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [10, 22, 40] },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(6, 13, 26); doc.rect(0, 285, pw, 12, "F");
    doc.setTextColor(71, 85, 105); doc.setFontSize(7);
    doc.text(`JobBoard Pro  ·  Generated ${reportDate}  ·  Page ${i}/${totalPages}`, pw / 2, 291, { align: "center" });
  }

  return doc;
}

// ── Job Digest HTML email ──────────────────────────────────────────────────────
function buildJobDigestHTML(results, searchDate, profileName, keywords) {
  const topJobs = results.slice(0, 40);
  const byScore = [...topJobs].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  const jobRows = topJobs.map((r, i) => `
    <tr style="border-bottom:1px solid #0f1c2e;">
      <td style="padding:10px 12px;color:#e2e8f0;font-weight:600;font-size:13px;">
        ${r.applylink ? `<a href="${r.applylink}" style="color:#60a5fa;text-decoration:none;">${r.title}</a>` : r.title}
        ${r.matchScore > 0 ? `<span style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#86efac;padding:1px 7px;border-radius:999px;font-size:10px;margin-left:6px;">⚡${r.matchScore}%</span>` : ""}
      </td>
      <td style="padding:10px 12px;color:#64748b;">${r.company}</td>
      <td style="padding:10px 12px;color:#475569;font-size:12px;">${r.location || "—"}</td>
      <td style="padding:10px 12px;color:#4ade80;font-weight:600;">${r.salary || "—"}</td>
      <td style="padding:10px 12px;color:#334155;font-size:11px;">${r.postedDaysAgo === 0 ? "Today" : r.postedDaysAgo === 1 ? "1d ago" : r.postedDaysAgo != null ? r.postedDaysAgo + "d ago" : "—"}</td>
      <td style="padding:10px 12px;">
        ${r.applylink ? `<a href="${r.applylink}" style="background:rgba(29,78,216,0.25);border:1px solid #1d4ed8;color:#93c5fd;padding:4px 10px;border-radius:6px;font-size:10px;text-decoration:none;font-weight:700;">Apply ↗</a>` : "—"}
      </td>
    </tr>`).join("");

  const topMatchRows = byScore.slice(0, 5).filter(r => r.matchScore > 0).map(r => `
    <tr>
      <td style="padding:8px 12px;color:#86efac;font-weight:600;">${r.title}</td>
      <td style="padding:8px 12px;color:#64748b;">${r.company}</td>
      <td style="padding:8px 12px;color:#22c55e;font-weight:800;">${r.matchScore}%</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:30px 0;">
<tr><td align="center">
<table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;">
  <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0c2236 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center;border:1px solid #1e2d45;border-bottom:none;">
    <div style="font-size:28px;margin-bottom:6px;">🔍</div>
    <h1 style="margin:0;font-size:24px;font-weight:800;color:#67e8f9;">Daily Job Digest</h1>
    <p style="color:#475569;font-size:13px;margin:8px 0 0;">JobBoard Pro${profileName ? " · " + profileName : ""} · ${searchDate}</p>
    <p style="color:#334155;font-size:12px;margin:6px 0 0;">Keywords: <strong style="color:#a5b4fc;">${keywords || "Your profile skills"}</strong></p>
  </td></tr>

  <tr><td style="background:#07101f;border:1px solid #1e2d45;border-top:none;border-bottom:none;padding:20px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;border-radius:12px;border:1px solid #1e2d45;">
      <tr>
        <td style="text-align:center;padding:16px 8px;border-right:1px solid #1e2d45;">
          <div style="font-size:28px;font-weight:800;color:#67e8f9;font-family:monospace;">${results.length}</div>
          <div style="font-size:10px;color:#475569;text-transform:uppercase;margin-top:3px;">Jobs Found</div>
        </td>
        <td style="text-align:center;padding:16px 8px;border-right:1px solid #1e2d45;">
          <div style="font-size:28px;font-weight:800;color:#86efac;font-family:monospace;">${byScore.filter(r => r.matchScore > 0).length}</div>
          <div style="font-size:10px;color:#475569;text-transform:uppercase;margin-top:3px;">Profile Matches</div>
        </td>
        <td style="text-align:center;padding:16px 8px;border-right:1px solid #1e2d45;">
          <div style="font-size:28px;font-weight:800;color:#fde047;font-family:monospace;">${results.filter(r => (r.postedDaysAgo || 99) <= 1).length}</div>
          <div style="font-size:10px;color:#475569;text-transform:uppercase;margin-top:3px;">Posted Today</div>
        </td>
        <td style="text-align:center;padding:16px 8px;">
          <div style="font-size:28px;font-weight:800;color:#4ade80;font-family:monospace;">${byScore[0]?.matchScore || 0}%</div>
          <div style="font-size:10px;color:#475569;text-transform:uppercase;margin-top:3px;">Best Match</div>
        </td>
      </tr>
    </table>
  </td></tr>

  ${topMatchRows ? `<tr><td style="background:#07101f;border:1px solid #1e2d45;border-top:none;border-bottom:none;padding:0 24px 20px;">
    <div style="background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:16px;">
      <p style="color:#86efac;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 12px;">⚡ Top Matches for Your Profile</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><th style="text-align:left;color:#475569;font-size:10px;padding:6px 12px;">Role</th><th style="text-align:left;color:#475569;font-size:10px;padding:6px 12px;">Company</th><th style="text-align:left;color:#475569;font-size:10px;padding:6px 12px;">Match</th></tr>
        ${topMatchRows}
      </table>
    </div>
  </td></tr>` : ""}

  <tr><td style="background:#07101f;border:1px solid #1e2d45;border-top:none;border-bottom:none;padding:0 24px 20px;">
    <p style="color:#67e8f9;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 12px;">📋 All Jobs (Full list in Excel attachment)</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;border-radius:12px;border:1px solid #0891b2;overflow:hidden;">
      <tr style="background:#0c2236;">
        <th style="text-align:left;color:#67e8f9;font-size:10px;padding:10px 12px;">Role</th>
        <th style="text-align:left;color:#67e8f9;font-size:10px;padding:10px 12px;">Company</th>
        <th style="text-align:left;color:#67e8f9;font-size:10px;padding:10px 12px;">Location</th>
        <th style="text-align:left;color:#67e8f9;font-size:10px;padding:10px 12px;">Salary</th>
        <th style="text-align:left;color:#67e8f9;font-size:10px;padding:10px 12px;">Posted</th>
        <th style="text-align:left;color:#67e8f9;font-size:10px;padding:10px 12px;">Apply</th>
      </tr>
      ${jobRows}
    </table>
    ${results.length > 20 ? `<p style="color:#334155;font-size:11px;margin:10px 0 0;text-align:center;">+ ${results.length - 20} more jobs in the Excel attachment</p>` : ""}
  </td></tr>

  <tr><td style="background:#060d1b;border:1px solid #1e2d45;border-top:none;border-radius:0 0 16px 16px;padding:20px 24px;text-align:center;">
    <p style="color:#1e2d45;font-size:11px;margin:0;">JobBoard Pro Daily Job Digest · ${searchDate}</p>
    <p style="color:#1e2d45;font-size:10px;margin:5px 0 0;">Full results in attached Excel. Open JobBoard Pro to save jobs to your tracker.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Job Digest Excel ───────────────────────────────────────────────────────────
function generateJobDigestExcel(results, searchDate, keywords) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: All results sorted by match score
  const sorted = [...results].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  const headers = ["#", "Job Title", "Company", "Location", "Type", "Salary", "Match %", "Skills Required", "Source", "Posted", "Apply Link", "Description"];
  const rows = sorted.map((r, i) => [
    i + 1, r.title, r.company, r.location || "", r.type || "Full-time",
    r.salary || "Not disclosed", r.matchScore ? r.matchScore + "%" : "—",
    r.skills || "", r.source || "Adzuna",
    r.postedDaysAgo === 0 ? "Today" : r.postedDaysAgo === 1 ? "Yesterday" : r.postedDaysAgo != null ? r.postedDaysAgo + "d ago" : "—",
    r.applylink || "", r.description || "",
  ]);
  const ws1 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws1["!cols"] = [{ wch: 4 }, { wch: 35 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 9 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws1, "📋 All Jobs");

  // Sheet 2: Top matches only (>50%)
  const topMatches = sorted.filter(r => r.matchScore >= 50);
  if (topMatches.length) {
    const rows2 = topMatches.map((r, i) => [i + 1, r.title, r.company, r.location || "", r.salary || "—", r.matchScore + "%", r.skills || "", r.applylink || ""]);
    const ws2 = XLSX.utils.aoa_to_sheet([["#", "Role", "Company", "Location", "Salary", "Match", "Skills", "Apply Link"], ...rows2]);
    ws2["!cols"] = [{ wch: 4 }, { wch: 35 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 9 }, { wch: 30 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws2, "⚡ Top Matches");
  }

  // Sheet 3: Fresh jobs (posted today/yesterday)
  const fresh = sorted.filter(r => (r.postedDaysAgo || 99) <= 1);
  if (fresh.length) {
    const rows3 = fresh.map((r, i) => [i + 1, r.title, r.company, r.location || "", r.salary || "—", r.matchScore ? r.matchScore + "%" : "—", r.applylink || ""]);
    const ws3 = XLSX.utils.aoa_to_sheet([["#", "Role", "Company", "Location", "Salary", "Match", "Apply Link"], ...rows3]);
    ws3["!cols"] = [{ wch: 4 }, { wch: 35 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 9 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws3, "🆕 Posted Today");
  }

  // Sheet 4: Summary
  const byType = results.reduce((a, r) => { a[r.type || "Unknown"] = (a[r.type || "Unknown"] || 0) + 1; return a; }, {});
  const byLoc = Object.entries(results.reduce((a, r) => { if (r.location) { const l = r.location.split(",")[0].trim(); a[l] = (a[l] || 0) + 1; } return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const sumData = [
    ["📊 Job Search Summary", ""],
    ["Search Date", searchDate],
    ["Keywords", keywords || "(from profile)"],
    ["Total Results", results.length],
    ["Profile Matches (>0%)", sorted.filter(r => r.matchScore > 0).length],
    ["High Matches (>50%)", sorted.filter(r => r.matchScore >= 50).length],
    ["Posted Today", results.filter(r => (r.postedDaysAgo || 99) <= 1).length],
    ["With Salary Info", results.filter(r => r.salary).length],
    ["", ""],
    ["📍 Top Locations", "Count"],
    ...byLoc.map(([l, c]) => [l, c]),
    ["", ""],
    ["💼 By Job Type", "Count"],
    ...Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, c]) => [t, c]),
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(sumData);
  ws4["!cols"] = [{ wch: 28 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws4, "📊 Summary");

  const date = searchDate.replace(/[^a-zA-Z0-9]/g, "-");
  return { wb, filename: `JobDigest_${date}.xlsx` };
}

// ── Generate Job Digest PDF ────────────────────────────────────────────────────
async function generateJobDigestPDF(results, searchDate, profileName, keywords) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(7, 16, 31);
  doc.rect(0, 0, pw, 36, "F");
  doc.setFillColor(6, 182, 212);
  doc.rect(0, 34, pw, 2, "F");
  doc.setTextColor(103, 232, 249); doc.setFontSize(20); doc.setFont("helvetica", "bold");
  doc.text("🔍 Daily Job Digest", 14, 16);
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(148, 163, 184);
  doc.text(`${searchDate}${profileName ? " · " + profileName : ""}  ·  Keywords: ${keywords || "profile skills"}  ·  ${results.length} jobs found`, 14, 27);

  const sorted = [...results].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  // Stats row
  const statBoxes = [
    ["Total Jobs", results.length, [103, 232, 249]],
    ["Profile Matches", sorted.filter(r => r.matchScore > 0).length, [134, 239, 172]],
    ["High Match (50%+)", sorted.filter(r => r.matchScore >= 50).length, [34, 197, 94]],
    ["Posted Today", results.filter(r => (r.postedDaysAgo || 99) <= 1).length, [253, 224, 71]],
    ["Best Match", (sorted[0]?.matchScore || 0) + "%", [192, 132, 252]],
  ];
  const bw = (pw - 28) / statBoxes.length;
  statBoxes.forEach(([label, val, rgb], i) => {
    const bx = 14 + i * bw;
    doc.setFillColor(6, 16, 30); doc.roundedRect(bx, 42, bw - 3, 20, 2, 2, "F");
    doc.setTextColor(...rgb); doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(String(val), bx + (bw - 3) / 2, 54, { align: "center" });
    doc.setTextColor(71, 85, 105); doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), bx + (bw - 3) / 2, 60, { align: "center" });
  });

  // Main table
  doc.autoTable({
    startY: 68,
    head: [["#", "Role", "Company", "Location", "Salary", "Match", "Type", "Posted", "Skills"]],
    body: sorted.slice(0, 50).map((r, i) => [
      i + 1, r.title?.slice(0, 38) || (r.title || ""), r.company?.slice(0, 40) || "", r.location?.slice(0, 18) || "—",
      r.salary || "—", r.matchScore ? (r.matchScore + "%") : "—", r.type || "Full-time",
      r.postedDaysAgo === 0 ? "Today" : r.postedDaysAgo === 1 ? "1d ago" : r.postedDaysAgo != null ? r.postedDaysAgo + "d ago" : "—",
      (r.skills || "").slice(0, 30),
    ]),
    theme: "plain",
    styles: { fontSize: 7.5, textColor: [148, 163, 184], fillColor: [6, 16, 30], cellPadding: 2.5, overflow: "ellipsize" },
    headStyles: { fillColor: [12, 34, 54], textColor: [103, 232, 249], fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [10, 22, 40] },
    columnStyles: {
      0: { cellWidth: 8 }, 1: { cellWidth: 52 }, 2: { cellWidth: 32 }, 3: { cellWidth: 28 },
      4: { cellWidth: 22, textColor: [167, 139, 250], fontStyle: "bold" }, 5: { cellWidth: 14, textColor: [134, 239, 172], fontStyle: "bold" },
      6: { cellWidth: 20 }, 7: { cellWidth: 14 }, 8: { cellWidth: 40 },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.column.index === 5 && data.section === "body") {
        const val = parseInt(data.cell.text[0]);
        if (val >= 75) data.cell.styles.textColor = [34, 197, 94];
        else if (val >= 50) data.cell.styles.textColor = [245, 158, 11];
        else if (val > 0) data.cell.styles.textColor = [96, 165, 250];
      }
    },
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(6, 13, 26); doc.rect(0, 198, pw, 10, "F");
    doc.setTextColor(71, 85, 105); doc.setFontSize(6.5);
    doc.text(`JobBoard Pro Daily Job Digest  ·  ${searchDate}  ·  Page ${i}/${totalPages}`, pw / 2, 204, { align: "center" });
  }
  return doc;
}

// ── Email Report HTML Template ────────────────────────────────────────────────
function buildReportHTML(jobs, reportDate, profileName) {
  const stats = STATUS.reduce((a, s) => { a[s] = jobs.filter(j => j.status === s).length; return a; }, {});
  const totalActive = jobs.filter(j => !["Rejected", "Withdrawn"].includes(j.status)).length;
  const interviews = jobs.filter(j => j.status === "Interview");
  const upcoming = jobs.filter(j => j.deadline && daysDiff(j.deadline) >= 0 && daysDiff(j.deadline) <= 7);
  const recentApplied = jobs.filter(j => j.status === "Applied").slice(0, 5);

  const statusRow = STATUS.map(s => `
    <td style="text-align:center;padding:12px 8px;">
      <div style="font-size:24px;font-weight:800;color:${SC[s].dot};font-family:monospace;">${stats[s] || 0}</div>
      <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-top:3px;">${s}</div>
    </td>`).join("");

  const interviewRows = interviews.map(j => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #1e293b;color:#e2e8f0;font-weight:600;">${j.title}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #1e293b;color:#60a5fa;">${j.company}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #1e293b;color:#86efac;">${j.deadline ? fmtDate(j.deadline) : "—"}</td>
    </tr>`).join("") || `<tr><td colspan="3" style="text-align:center;padding:20px;color:#475569;">No interviews scheduled</td></tr>`;

  const appliedRows = recentApplied.map(j => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #1e293b;color:#e2e8f0;font-weight:600;">${j.title}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #1e293b;color:#64748b;">${j.company}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #1e293b;color:#475569;">${j.location || "—"}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #1e293b;color:#4ade80;">${j.salary || "—"}</td>
    </tr>`).join("");

  const urgentRows = upcoming.map(j => {
    const d = daysDiff(j.deadline);
    return `<tr>
      <td style="padding:8px 14px;border-bottom:1px solid #1e293b;color:#fbbf24;font-weight:600;">${j.title}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #1e293b;color:#64748b;">${j.company}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #1e293b;color:${d <= 3 ? "#ef4444" : "#f97316"};font-weight:700;">${d === 0 ? "Today!" : d === 1 ? "Tomorrow" : `${d}d left`}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:30px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">
  <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center;border:1px solid #1e2d45;border-bottom:none;">
    <h1 style="margin:0;font-size:26px;font-weight:800;color:#818cf8;">🎯 JobBoard Pro</h1>
    <p style="color:#475569;font-size:13px;margin:8px 0 0;">Daily Report${profileName ? ` · ${profileName}` : ""} · ${reportDate}</p>
  </td></tr>
  <tr><td style="background:#07101f;border:1px solid #1e2d45;border-top:none;border-bottom:none;padding:24px;">
    <p style="color:#94a3b8;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px;">📊 Overview</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;border-radius:12px;border:1px solid #1e2d45;">
      <tr>
        <td style="text-align:center;padding:16px 8px;border-right:1px solid #1e2d45;">
          <div style="font-size:32px;font-weight:800;color:#60a5fa;font-family:monospace;">${jobs.length}</div>
          <div style="font-size:10px;color:#475569;text-transform:uppercase;margin-top:3px;">Total</div>
        </td>
        <td style="text-align:center;padding:16px 8px;border-right:1px solid #1e2d45;">
          <div style="font-size:32px;font-weight:800;color:#86efac;font-family:monospace;">${totalActive}</div>
          <div style="font-size:10px;color:#475569;text-transform:uppercase;margin-top:3px;">Active</div>
        </td>
        <td style="text-align:center;padding:16px 8px;border-right:1px solid #1e2d45;">
          <div style="font-size:32px;font-weight:800;color:#22c55e;font-family:monospace;">${stats.Interview || 0}</div>
          <div style="font-size:10px;color:#475569;text-transform:uppercase;margin-top:3px;">Interviews</div>
        </td>
        <td style="text-align:center;padding:16px 8px;">
          <div style="font-size:32px;font-weight:800;color:#fde047;font-family:monospace;">${stats.Offer || 0}</div>
          <div style="font-size:10px;color:#475569;text-transform:uppercase;margin-top:3px;">Offers</div>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;background:#0a1628;border-radius:12px;border:1px solid #1e2d45;"><tr>${statusRow}</tr></table>
  </td></tr>
  ${upcoming.length > 0 ? `<tr><td style="background:#07101f;border:1px solid #1e2d45;border-top:none;border-bottom:none;padding:0 24px 24px;">
    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:16px;">
      <p style="color:#fbbf24;font-size:12px;font-weight:700;text-transform:uppercase;margin:0 0 12px;">⏰ Deadlines This Week</p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr><th style="text-align:left;color:#475569;font-size:10px;padding:6px 14px;">Role</th><th style="text-align:left;color:#475569;font-size:10px;padding:6px 14px;">Company</th><th style="text-align:left;color:#475569;font-size:10px;padding:6px 14px;">Due</th></tr>${urgentRows}</table>
    </div>
  </td></tr>` : ""}
  ${interviews.length > 0 ? `<tr><td style="background:#07101f;border:1px solid #1e2d45;border-top:none;border-bottom:none;padding:0 24px 24px;">
    <p style="color:#86efac;font-size:12px;font-weight:700;text-transform:uppercase;margin:0 0 12px;">🎙 Active Interviews</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;border-radius:12px;border:1px solid #16a34a;">
      <tr style="background:#052e16;"><th style="text-align:left;color:#86efac;font-size:10px;padding:10px 14px;">Role</th><th style="text-align:left;color:#86efac;font-size:10px;padding:10px 14px;">Company</th><th style="text-align:left;color:#86efac;font-size:10px;padding:10px 14px;">Date</th></tr>
      ${interviewRows}
    </table>
  </td></tr>` : ""}
  ${recentApplied.length > 0 ? `<tr><td style="background:#07101f;border:1px solid #1e2d45;border-top:none;border-bottom:none;padding:0 24px 24px;">
    <p style="color:#67e8f9;font-size:12px;font-weight:700;text-transform:uppercase;margin:0 0 12px;">✉️ Applied (Recent)</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;border-radius:12px;border:1px solid #0891b2;">
      <tr style="background:#0c2236;"><th style="text-align:left;color:#67e8f9;font-size:10px;padding:10px 14px;">Role</th><th style="text-align:left;color:#67e8f9;font-size:10px;padding:10px 14px;">Company</th><th style="text-align:left;color:#67e8f9;font-size:10px;padding:10px 14px;">Location</th><th style="text-align:left;color:#67e8f9;font-size:10px;padding:10px 14px;">Salary</th></tr>
      ${appliedRows}
    </table>
  </td></tr>` : ""}
  <tr><td style="background:#07101f;border:1px solid #1e2d45;border-top:none;border-bottom:none;padding:0 24px 24px;">
    <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:16px;">
      <p style="color:#818cf8;font-size:12px;font-weight:700;margin:0 0 8px;">💡 Today's Focus</p>
      <ul style="color:#64748b;font-size:12px;line-height:1.8;margin:0;padding-left:16px;">
        ${stats.Interview > 0 ? `<li>Prepare for your <strong style="color:#86efac">${stats.Interview} interview${stats.Interview > 1 ? "s" : ""}</strong></li>` : ""}
        ${upcoming.length > 0 ? `<li>Review <strong style="color:#fbbf24">${upcoming.length} upcoming deadline${upcoming.length > 1 ? "s" : ""}</strong></li>` : ""}
        ${stats.Bookmarked > 0 ? `<li>Convert <strong style="color:#93c5fd">${stats.Bookmarked} bookmarked</strong> jobs to applications</li>` : ""}
        <li>Follow up on applications older than 7 days</li>
      </ul>
    </div>
  </td></tr>
  <tr><td style="background:#060d1b;border:1px solid #1e2d45;border-top:none;border-radius:0 0 16px 16px;padding:20px 24px;text-align:center;">
    <p style="color:#334155;font-size:11px;margin:0;">Generated by <strong>JobBoard Pro</strong> · ${reportDate}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Beautiful Excel Generator ─────────────────────────────────────────────────
function generateBeautifulExcel(jobs) {
  const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
  const wb = XLSX.utils.book_new();

  const activeJobs = jobs.filter(j => !["Rejected", "Withdrawn"].includes(j.status));
  const headers1 = ["#", "Job Title", "Company", "Location", "Type", "Salary", "Skills", "Source", "Status", "Priority", "Applied Date", "Deadline", "Apply Link", "Notes"];
  const rows1 = activeJobs.map((j, i) => [i + 1, j.title, j.company, j.location, j.type, j.salary, j.skills, j.source, j.status, j.priority, j.applieddate, j.deadline, j.applylink, j.notes]);
  const ws1 = XLSX.utils.aoa_to_sheet([headers1, ...rows1]);
  ws1["!cols"] = [{ wch: 4 }, { wch: 35 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 40 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws1, "📋 Active Applications");

  const headers2 = ["#", "Job Title", "Company", "Location", "Type", "Salary", "Skills", "Source", "Status", "Priority", "Applied Date", "Deadline", "Notes"];
  const rows2 = jobs.map((j, i) => [i + 1, j.title, j.company, j.location, j.type, j.salary, j.skills, j.source, j.status, j.priority, j.applieddate, j.deadline, j.notes]);
  const ws2 = XLSX.utils.aoa_to_sheet([headers2, ...rows2]);
  ws2["!cols"] = [{ wch: 4 }, { wch: 35 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws2, "📁 All Applications");

  const stats = STATUS.reduce((a, s) => { a[s] = jobs.filter(j => j.status === s).length; return a; }, {});
  const totalActive = jobs.filter(j => !["Rejected", "Withdrawn"].includes(j.status)).length;
  const responseRate = jobs.length ? Math.round(((stats.Interview + stats.Offer + stats.Rejected) / jobs.length) * 100) : 0;
  const summaryData = [
    ["📊 JobBoard Pro — Summary Report", "", ""],
    ["Generated On", date, ""],
    ["", "", ""],
    ["📈 Key Metrics", "", ""],
    ["Total Applications", jobs.length, ""],
    ["Active Applications", totalActive, ""],
    ["Response Rate", `${responseRate}%`, ""],
    ["", "", ""],
    ["📋 By Status", "Count", "% of Total"],
    ...STATUS.map(s => [s, stats[s] || 0, jobs.length ? `${Math.round((stats[s] || 0) / jobs.length * 100)}%` : "-"]),
    ["", "", ""],
    ["🎯 By Priority", "Count", "% of Total"],
    ...["High", "Medium", "Low"].map(p => { const cnt = jobs.filter(j => j.priority === p).length; return [p, cnt, jobs.length ? `${Math.round(cnt / jobs.length * 100)}%` : ""]; }),
    ["", "", ""],
    ["📍 Top Locations", "Count", ""],
    ...Object.entries(jobs.reduce((a, j) => { if (j.location) a[j.location] = (a[j.location] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([l, c]) => [l, c, ""]),
    ["", "", ""],
    ["🏢 Top Companies", "Count", ""],
    ...Object.entries(jobs.reduce((a, j) => { if (j.company) a[j.company] = (a[j.company] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, n]) => [c, n, ""]),
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(summaryData);
  ws3["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws3, "📊 Summary");

  const pipelineHeaders = ["Status", "Job Title", "Company", "Location", "Salary", "Deadline", "Notes"];
  const pipelineRows = [...jobs.filter(j => j.status === "Offer"), ...jobs.filter(j => j.status === "Interview")].map(j => [j.status, j.title, j.company, j.location, j.salary, j.deadline, j.notes]);
  const ws4 = XLSX.utils.aoa_to_sheet([pipelineHeaders, ...pipelineRows]);
  ws4["!cols"] = [{ wch: 14 }, { wch: 35 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws4, "🎙 Interview Pipeline");

  const urgentJobs = jobs.filter(j => j.deadline && daysDiff(j.deadline) >= 0 && daysDiff(j.deadline) <= 14 && !["Rejected", "Withdrawn", "Offer"].includes(j.status)).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const urgentHeaders = ["Days Left", "Job Title", "Company", "Status", "Deadline", "Apply Link"];
  const urgentRows2 = urgentJobs.map(j => [daysDiff(j.deadline), j.title, j.company, j.status, j.deadline, j.applylink]);
  const ws5 = XLSX.utils.aoa_to_sheet([urgentHeaders, ...urgentRows2]);
  ws5["!cols"] = [{ wch: 10 }, { wch: 35 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws5, "⏰ Deadlines");

  return { wb, filename: `JobBoard_Pro_${date}.xlsx` };
}

// ── CSV Generators ────────────────────────────────────────────────────────────
function generateProgressCSV(jobs) {
  const esc = v => `"${String(v || "").replace(/"/g, '""')}"`;
  const headers = ["#", "Job Title", "Company", "Location", "Type", "Salary", "Skills", "Source", "Status", "Priority", "Applied Date", "Deadline", "Notes"];
  const rows = jobs.map((j, i) => [
    i + 1, j.title, j.company, j.location || "", j.type || "", j.salary || "",
    j.skills || "", j.source || "", j.status || "", j.priority || "",
    j.applieddate || "", j.deadline || "", j.notes || ""
  ].map(esc).join(","));

  const stats = STATUS.reduce((a, s) => { a[s] = jobs.filter(j => j.status === s).length; return a }, {});
  const totalActive = jobs.filter(j => !["Rejected", "Withdrawn"].includes(j.status)).length;
  const responseRate = jobs.length ? Math.round(((stats.Interview || 0) + (stats.Offer || 0) + (stats.Rejected || 0)) / jobs.length * 100) : 0;

  const summary = [
    "", "",
    `"📊 SUMMARY","",`,
    `"Generated","${new Date().toLocaleDateString("en-IN")}"`,
    `"Total Applications","${jobs.length}"`,
    `"Active Applications","${totalActive}"`,
    `"Response Rate","${responseRate}%"`,
    "",
    `"Status","Count","% of Total"`,
    ...STATUS.map(s => `${esc(s)},"${stats[s] || 0}","${jobs.length ? Math.round((stats[s] || 0) / jobs.length * 100) : 0}%"`),
    "",
    `"Priority","Count"`,
    ...["High", "Medium", "Low"].map(p => { const cnt = jobs.filter(j => j.priority === p).length; return `${esc(p)},"${cnt}"`; }),
  ];

  return [headers.map(h => esc(h)).join(","), ...rows, ...summary].join("\n");
}

function generateJobDigestCSV(results, keywords, searchDate) {
  const esc = v => `"${String(v || "").replace(/"/g, '""')}"`;
  const headers = ["#", "Job Title", "Company", "Location", "Type", "Salary", "Match %", "Skills Required", "Posted", "Apply Link", "Description"];
  const sorted = [...results].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  const rows = sorted.map((r, i) => [
    i + 1, r.title, r.company, r.location || "", r.type || "Full-time",
    r.salary || "Not disclosed", r.matchScore ? r.matchScore + "%" : "—",
    r.skills || "",
    r.postedDaysAgo === 0 ? "Today" : r.postedDaysAgo === 1 ? "Yesterday" : r.postedDaysAgo != null ? r.postedDaysAgo + "d ago" : "—",
    r.applylink || "", r.description || ""
  ].map(esc).join(","));

  const byType = results.reduce((a, r) => { a[r.type || "Unknown"] = (a[r.type || "Unknown"] || 0) + 1; return a }, {});
  const summary = [
    "", "",
    `"📊 DIGEST SUMMARY"`,
    `"Search Date","${searchDate || ""}"`,
    `"Keywords","${keywords || ""}"`,
    `"Total Results","${results.length}"`,
    `"Profile Matches (>0%)","${sorted.filter(r => r.matchScore > 0).length}"`,
    `"High Matches (50%+)","${sorted.filter(r => r.matchScore >= 50).length}"`,
    `"Posted Today","${results.filter(r => (r.postedDaysAgo || 99) <= 1).length}"`,
    "",
    `"Job Type","Count"`,
    ...Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${esc(t)},"${c}"`),
  ];

  return [headers.map(h => esc(h)).join(","), ...rows, ...summary].join("\n");
}

function downloadCSVFile(content, filename) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// ── Atom Components ───────────────────────────────────────────────────────────
const Btn = ({ children, onClick, v = "def", disabled, sx = {} }) => {
  const vs = {
    def: { background: "#0d1526", border: "1px solid #1e2d45", color: "#94a3b8" },
    pri: { background: "linear-gradient(135deg,#1d4ed8,#4f46e5)", border: "none", color: "#fff" },
    grn: { background: "linear-gradient(135deg,#064e3b,#065f46)", border: "1px solid rgba(34,197,94,0.2)", color: "#6ee7b7" },
    amb: { background: "linear-gradient(135deg,#78350f,#92400e)", border: "1px solid rgba(245,158,11,0.2)", color: "#fde68a" },
    cyn: { background: "linear-gradient(135deg,#164e63,#0e7490)", border: "1px solid rgba(6,182,212,0.2)", color: "#67e8f9" },
    red: { background: "rgba(220,38,38,0.08)", border: "1px solid #450a0a", color: "#f87171" },
    ghost: { background: "transparent", border: "1px solid #1e2d45", color: "#64748b" },
    vio: { background: "linear-gradient(135deg,#065f46,#047857)", border: "1px solid rgba(34,197,94,0.3)", color: "#a7f3d0" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...vs[v], borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontFamily: "inherit", transition: "all .15s", ...sx }}>{children}</button>;
};
const Inp = ({ value, onChange, placeholder, type = "text", sx = {} }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{ width: "100%", background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", transition: "border-color .15s", ...sx }}
    onFocus={e => e.target.style.borderColor = "#4f46e5"} onBlur={e => e.target.style.borderColor = "#1e2d45"} />
);
const Sel = ({ value, onChange, options }) => (
  <select value={value} onChange={onChange} style={{ width: "100%", background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", cursor: "pointer" }}>
    {options.map(o => <option key={o}>{o}</option>)}
  </select>
);
const Txt = ({ value, onChange, placeholder, rows = 3, sx = {} }) => (
  <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
    style={{ width: "100%", background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", ...sx }} />
);
const F = ({ label, children, hint }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
      <span>{label}</span>
      {hint && <span style={{ color: "#334155", fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}>{hint}</span>}
    </div>
    {children}
  </div>
);
const Badge = ({ s }) => {
  const c = SC[s] || SC.Bookmarked;
  return <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />{s}</span>;
};
const PriBadge = ({ p }) => {
  const m = { High: { c: "#f87171", b: "rgba(239,68,68,0.15)", ic: "↑" }, Medium: { c: "#fbbf24", b: "rgba(245,158,11,0.15)", ic: "→" }, Low: { c: "#86efac", b: "rgba(34,197,94,0.15)", ic: "↓" } };
  const s = m[p] || m.Low;
  return <span style={{ background: s.b, color: s.c, padding: "2px 8px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>{s.ic} {p}</span>;
};
const Deadline = ({ date }) => {
  const d = daysDiff(date); if (d === null) return null;
  const col = d < 0 ? "#ef4444" : d <= 3 ? "#f97316" : d <= 7 ? "#eab308" : "#475569";
  const lbl = d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Today!" : d === 1 ? "Tomorrow" : `${d}d left`;
  return <span style={{ color: col, fontSize: 10, fontWeight: 700 }}>⏱ {lbl}</span>;
};
const Modal = ({ title, children, onClose, wide = false }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }} onClick={onClose}>
    <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 18, width: "100%", maxWidth: wide ? 960 : 640, maxHeight: "92vh", overflowY: "auto", padding: 28, animation: "mi .2s ease", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, paddingBottom: 16, borderBottom: "1px solid #0f1c2e" }}>
        <h2 style={{ color: "#f1f5f9", fontFamily: "'Syne',sans-serif", fontSize: 18, margin: 0, fontWeight: 800 }}>{title}</h2>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #1e2d45", color: "#64748b", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);
const StatCard = ({ label, value, color, icon, sub }) => (
  <div style={{ background: "#06101e", border: "1px solid #0f1c2e", borderRadius: 14, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.7 }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
        <div style={{ color, fontSize: 28, fontWeight: 800, fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ color: "#334155", fontSize: 10, marginTop: 4 }}>{sub}</div>}
      </div>
      <span style={{ fontSize: 22, opacity: 0.6 }}>{icon}</span>
    </div>
  </div>
);
const MatchBadge = ({ score }) => {
  const col = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : score >= 25 ? "#60a5fa" : "#475569";
  const bg = score >= 75 ? "rgba(34,197,94,0.1)" : score >= 50 ? "rgba(245,158,11,0.1)" : score >= 25 ? "rgba(96,165,250,0.1)" : "rgba(71,85,105,0.1)";
  if (!score) return null;
  return <span title="Match score" style={{ background: bg, border: `1px solid ${col}`, color: col, padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>⚡{score}%</span>;
};

// ── ScannerEmailRow: single email recipient with verification ───────────────
const ScannerEmailRow = ({ entry, onUpdate, onRemove, onSendCode, onConfirm, isSending }) => {
  const [codeInput, setCodeInput] = useState("");
  const statusColor = entry.status === "verified" ? "#22c55e" : entry.status === "code_sent" ? "#f59e0b" : "#64748b";
  const statusIcon  = entry.status === "verified" ? "✅" : entry.status === "code_sent" ? "📨" : "○";
  const statusLabel = entry.status === "verified" ? "Verified" : entry.status === "code_sent" ? "Code sent" : "Unverified";

  return (
    <div style={{ background: "#070f1c", border: `1px solid ${entry.verified ? "rgba(34,197,94,0.25)" : "#1e2d45"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8, transition: "border-color .2s" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: entry.status === "code_sent" ? 10 : 0 }}>
        <span title={statusLabel} style={{ fontSize: 14, flexShrink: 0 }}>{statusIcon}</span>
        <input
          type="email"
          value={entry.email}
          onChange={e => onUpdate(e.target.value)}
          placeholder="recipient@email.com"
          style={{ flex: 1, background: "transparent", border: "none", borderBottom: "1px solid #1e2d45", color: "#e2e8f0", fontFamily: "inherit", fontSize: 13, outline: "none", padding: "4px 0" }}
          disabled={entry.verified}
        />
        {!entry.verified && entry.email?.includes("@") && (
          <button onClick={onSendCode} disabled={isSending} style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", borderRadius: 7, padding: "4px 10px", cursor: isSending ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600, flexShrink: 0 }}>
            {isSending ? "Sending…" : entry.status === "code_sent" ? "Resend" : "Verify"}
          </button>
        )}
        {entry.verified && (
          <button onClick={() => onUpdate("")} title="Edit email" style={{ background: "transparent", border: "1px solid #1e2d45", color: "#475569", borderRadius: 7, padding: "4px 8px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>✏️</button>
        )}
        <button onClick={onRemove} style={{ background: "rgba(220,38,38,0.07)", border: "1px solid #450a0a", color: "#f87171", borderRadius: 7, padding: "4px 8px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", flexShrink: 0 }}>✕</button>
      </div>
      {entry.status === "code_sent" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingLeft: 22 }}>
          <input
            type="text"
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.replace(/D/g, "").slice(0, 6))}
            placeholder="Enter 6-digit code"
            maxLength={6}
            style={{ flex: 1, background: "#0a1628", border: "1px solid #1e2d45", borderRadius: 8, padding: "7px 12px", color: "#e2e8f0", fontFamily: "'JetBrains Mono',monospace", fontSize: 16, outline: "none", letterSpacing: "4px", textAlign: "center" }}
          />
          <button onClick={() => { onConfirm(codeInput); setCodeInput(""); }} disabled={codeInput.length !== 6} style={{ background: codeInput.length === 6 ? "linear-gradient(135deg,#064e3b,#065f46)" : "#0a1628", border: "1px solid rgba(34,197,94,0.25)", color: codeInput.length === 6 ? "#6ee7b7" : "#334155", borderRadius: 8, padding: "7px 14px", cursor: codeInput.length === 6 ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 12, fontWeight: 700 }}>✓ Confirm</button>
        </div>
      )}
      {entry.verified && (
        <div style={{ paddingLeft: 22, color: "#22c55e", fontSize: 11, marginTop: 4 }}>Reports & digests will be sent to this address</div>
      )}
    </div>
  );
};

// ── CityChips: multi-city tag input ──────────────────────────────────────────
const CityChips = ({ value, onChange }) => {
  const [ccInput, setCcInput] = useState('');
  const ccRef = useRef();
  const cities = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];

  const addCity = (raw) => {
    const parts = raw.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
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
export default function Dashboard({ session }) {
  const [jobs, setJobs] = useState([]);
  const [tab, setTab] = useState("table");
  const [toast, setToast] = useState(null);
  const [filterStatus, setFS] = useState("All");
  const [filterType, setFT] = useState("All");
  const [filterPri, setFP] = useState("All");
  const [sortK, setSortK] = useState("id");
  const [sortD, setSortD] = useState("desc");
  const [q, setQ] = useState("");
  const fileRef = useRef();
  const resumeRef = useRef();
  const dragId = useRef(null);

  // FIX: Supabase caps at 1000 rows by default — paginate to fetch ALL rows
  const fetchJobs = useCallback(async () => {
    const PAGE = 1000;
    let all = [], from = 0, hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("jobs").select("*")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error || !data) break;
      all = all.concat(data);
      hasMore = data.length === PAGE;
      from += PAGE;
    }
    setJobs(all);
  }, []);

  // ── Settings (persisted to localStorage) ──
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem("geminiKey") || "");
  const [clientId, setClientId] = useState(() => localStorage.getItem("googleClientId") || import.meta.env.VITE_GOOGLE_CLIENT_ID || "");
  const [aiModel, setAiModel] = useState(() => localStorage.getItem("aiModel") || NVIDIA_MODEL);
  const [proxyUrl, setProxyUrl] = useState(() => localStorage.getItem("proxyUrl") || NVIDIA_API_URL);
  const [adzunaId,  setAdzunaId]  = useState(() => localStorage.getItem('adzunaId')  || import.meta.env.VITE_ADZUNA_ID  || '');
  const [adzunaKey, setAdzunaKey] = useState(() => localStorage.getItem('adzunaKey') || import.meta.env.VITE_ADZUNA_KEY || '');
  // ── Notion state ─────────────────────────────────────────────────────
  const [sheetsSpreadsheetId,   setSheetsSpreadsheetId]   = useState(() => localStorage.getItem("sheetsSpreadsheetId") || "");
  const [sheetsEnabled,    setSheetsEnabled]    = useState(() => localStorage.getItem("sheetsEnabled") === "true");
  const [sheetsSyncing, setSheetsSyncing] = useState(false);
  const [reportEmail, setReportEmail] = useState(() => localStorage.getItem("reportEmail") || session?.user?.email || "");
  // Multi-email scanner recipients
  const [scannerEmails, setScannerEmails] = useState(() => {
    try {
      const stored = localStorage.getItem("scannerEmails");
      if (stored) return JSON.parse(stored);
      const base = localStorage.getItem("reportEmail") || session?.user?.email || "";
      return base ? [{ id: Date.now(), email: base, verified: true, status: "verified" }] : [];
    } catch { return []; }
  });
  const [emailTestSending, setEmailTestSending] = useState(null); // id of email being tested
  const [autoReport, setAutoReport] = useState(() => localStorage.getItem("autoReport") === "true");
  const [reportTime, setReportTime] = useState(() => localStorage.getItem("reportTime") || "09:00");
  // Multi-account Gmail
  const [gmailAccounts, setGmailAccounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gmailAccounts") || "[]"); } catch { return []; }
  });
  const [addingAccount, setAddingAccount] = useState(false);
  const [gmailScanProgress, setGmailScanProgress] = useState({}); // { accountEmail: "scanning"|"done"|"error" }

  // ── Profile ──
  const [profile, setProfile] = useState({ full_name: "", email: "", phone: "", location: "", headline: "", summary: "", skills: "", education: "", experience: "", certifications: "", languages: "", linkedin: "", github: "", portfolio: "", target_roles: "", target_locations: "", expected_salary: "" });
  const [resumeText, setResumeText] = useState("");
  const [resumeParsing, setResumeParsing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [bio, setBio] = useState("");

  // ── Report ──
  const [reportSending, setReportSending] = useState(false);
  const [reportLog, setReportLog] = useState(() => { try { return JSON.parse(localStorage.getItem("reportLog") || "[]"); } catch { return []; } });

  // ── Daily Job Search state ──
  const [autoJobSearch, setAutoJobSearch] = useState(() => localStorage.getItem("autoJobSearch") === "true");
  const [jobSearchTime, setJobSearchTime] = useState(() => localStorage.getItem("jobSearchTime") || "08:00");
  const [jobSearchKeywords, setJobSearchKeywords] = useState(() => localStorage.getItem("jobSearchKeywords") || "");
  const [jobSearchLocation, setJobSearchLocation] = useState(() => localStorage.getItem("jobSearchLocation") || "");
  const [jobSearchResultCount, setJobSearchResultCount] = useState(() => localStorage.getItem("jobSearchResultCount") || "50");
  const [jobSearchFormat, setJobSearchFormat] = useState(() => localStorage.getItem("jobSearchFormat") || "both");
  const [reportFormat, setReportFormat] = useState(() => localStorage.getItem("reportFormat") || "both");
  const [jobDigestLog, setJobDigestLog] = useState(() => { try { return JSON.parse(localStorage.getItem("jobDigestLog") || "[]"); } catch { return []; } });
  const [digestSending, setDigestSending] = useState(false);
  const [lastDigestResults, setLastDigestResults] = useState([]);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [reportPreviewHTML, setReportPreviewHTML] = useState("");

  // ── Modals ──
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showPrep, setShowPrep] = useState(null);
  const [showCover, setShowCover] = useState(null);
  const [showDetail, setShowDetail] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // ── Auto Apply ──
  const [autoApplying, setAutoApplying]     = useState(null);
  const [appliedJobs,  setAppliedJobs]      = useState(() => {
    try { return JSON.parse(localStorage.getItem('autoAppliedJobs') || '[]'); } catch { return []; }
  });
  const [showAutoApplyLog, setShowAutoApplyLog] = useState(false);
  const [showURLScraper,setShowURLScraper]=useState(false);
  const [scrapeURL,setScrapeURL]=useState("");
  const [scrapeLoading,setScrapeLoading]=useState(false);
  const [scrapeResult,setScrapeResult]=useState(null);
  const [scrapeError,setScrapeError]=useState("");

  // ── Form ──
  const blank = { title: "", company: "", location: "", type: "Full-time", salary: "", skills: "", source: "", applylink: "", status: "Bookmarked", applieddate: "", deadline: "", notes: "", priority: "Medium" };
  const [form, setForm] = useState(blank);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Job Search ──
  // Multi-city search state
  const [sCities, setSCities] = useState(() => localStorage.getItem("sCities") || "");
  // AI Extract on Add
  const [aiExtractNotes, setAiExtractNotes] = useState("");
  const [aiExtractLoading, setAiExtractLoading] = useState(false);

  // Login summary + new feature states
  const [loginSummary, setLoginSummary] = useState({ visible: false, interviews: 0, offers: 0, deadlineSoon: 0, followUpDue: 0 });
  const [interviewPrepJob, setInterviewPrepJob] = useState(null);
  const [interviewPrepResult, setInterviewPrepResult] = useState('');
  const [interviewPrepLoading, setInterviewPrepLoading] = useState(false);
  const [followUpJob, setFollowUpJob] = useState(null);
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [salaryBenchmark, setSalaryBenchmark] = useState(null);
  const [salaryLoading, setSalaryLoading] = useState(false);

  const [sq, setSq] = useState(""); const [sr, setSr] = useState([]); const [sLoad, setSLoad] = useState(false); const [sErr, setSErr] = useState("");
  // Advanced search state
  const [aiRanking, setAiRanking] = useState(false);
  const [aiExpandLoading, setAiExpandLoading] = useState(false);
  const [searchInsights, setSearchInsights] = useState(null);  // { topSkills, salaryRange, topCompanies }
  const [resultsFetched, setResultsFetched] = useState(0);     // total pages fetched so far
  const [searchSessionId, setSearchSessionId] = useState(0);   // to cancel stale fetches
  const [sPage, setSPage] = useState(1); const [sTotalResults, setSTotalResults] = useState(0);
  const [sLocation, setSLocation] = useState(""); const [sJobType, setSJobType] = useState("all");
  const [sSalaryMin, setSSalaryMin] = useState(""); const [sCategory, setSCategory] = useState(""); const [sExperience, setSExperience] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [savedSearches, setSavedSearches] = useState(() => { try { return JSON.parse(localStorage.getItem("savedSearches") || "[]"); } catch { return []; } });

  // ── AI ──
  const [prepOut, setPrepOut] = useState(""); const [prepLoad, setPrepLoad] = useState(false);
  const [coverOut, setCoverOut] = useState(""); const [coverLoad, setCoverLoad] = useState(false);

  // ── Gmail ──
  const [gmailDays, setGmailDays] = useState("30"); const [gmailExtra, setGmailExtra] = useState("");
  const [gmailStatus, setGmailStatus] = useState({ msg: 'Ready — click "Scan Gmail" to begin', type: "" });
  const [gmailEmails, setGmailEmails] = useState([]); const [gmailFilter, setGmailFilter] = useState("all");
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailRows, setGmailRows] = useState([{ id: 1, date: "", company: "", jobTitle: "", status: "Applied", interviewDate: "", interviewTime: "", interviewType: "", notes: "" }]);
  const [gmailStats, setGmailStats] = useState(null);

  // ── Multi-select (table bulk actions) ──
  const [selected, setSelected] = useState(new Set());  // Set of job ids
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkPriority, setBulkPriority] = useState("");

  const notify = (m, t = "ok") => { setToast({ m, t }); setTimeout(() => setToast(null), 3500); };
  const AI = useCallback((prompt, sys = "") => callAI(prompt, sys, geminiKey, aiModel, proxyUrl), [geminiKey, aiModel, proxyUrl]);

  // ── Init ──────────────────────────────────────────────────────────────
  useEffect(() => { fetchJobs(); loadProfile(); }, [session]);

  // Clear selection when tab or filters change so stale ids don't linger
  useEffect(() => { setSelected(new Set()); }, [tab, filterStatus, filterType, filterPri, q]);

  // Auto-send progress report ONCE when jobs first load after login
  useEffect(() => {
    if (!autoReport || !reportEmail || jobs.length === 0) return;
    if (localStorage.getItem("lastReportDate") === todayStr()) return;
    handleSendReport(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length > 0 ? 1 : 0]);

  // Auto-send job digest ONCE when jobs first load after login
  useEffect(() => {
    if (!autoJobSearch || !reportEmail || jobs.length === 0) return;
    if (localStorage.getItem("lastDigestDate") === todayStr()) return;
    handleSendJobDigest(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length > 0 ? 1 : 0]);

  // ── AUTO GMAIL MULTI-SCAN on login ──────────────────────────────────────────
  // Scans 5 categories simultaneously on first load of the day
  useEffect(() => {
    if (!clientId || jobs.length === 0) return;
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
  }, [jobs.length > 0 ? 1 : 0]);



  // ── Send Job Digest ────────────────────────────────────────────────────
  async function fetchJobsForDigest() {
    const keywords = jobSearchKeywords || profile.target_roles || profile.skills?.split(",").slice(0, 3).join(" ") || "";
    const location = jobSearchLocation || profile.target_locations || profile.location || "";
    const count = parseInt(jobSearchResultCount) || 50;
    const pages = Math.ceil(count / 50);

    let all = [];
    for (let p = 1; p <= pages; p++) {
      let url = `https://api.adzuna.com/v1/api/jobs/in/search/${p}?app_id=${adzunaId}&app_key=${adzunaKey}&results_per_page=50&content-type=application/json`;
      if (keywords.trim()) url += `&what=${encodeURIComponent(keywords.trim())}`;
      if (location.trim()) url += `&where=${encodeURIComponent(location.trim())}`;
      try {
        const res = await fetch(url);
        if (!res.ok) break;
        const data = await res.json();
        if (!data.results?.length) break;
        const mapped = data.results.map(j => {
          const rawDesc = (j.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          return {
            title: j.title?.replace(/<[^>]+>/g, "") || "",
            company: j.company?.display_name || "Unknown",
            location: j.location?.display_name || "",
            type: (j.contract_time || "") === "part_time" ? "Part-time" : (j.contract_type || "") === "contract" ? "Contract" : "Full-time",
            salary: formatSalary(j.salary_min, j.salary_max),
            skills: extractSkillsFromText(rawDesc),
            applylink: j.redirect_url || "",
            description: rawDesc.slice(0, 200),
            category: j.category?.label || "",
            postedDaysAgo: j.created ? Math.floor((Date.now() - new Date(j.created).getTime()) / 86400000) : null,
            matchScore: calcMatchScore(extractSkillsFromText(rawDesc), profile.skills || ""),
          };
        });
        all = all.concat(mapped);
      } catch { break; }
    }
    return all;
  }

  async function handleSendJobDigest(isAuto = false) {
    const allTargets = scannerEmails.filter(e => e.verified && e.email).map(e => e.email);
    const digestEmail = allTargets.length > 0 ? allTargets[0] : reportEmail;
    if (!digestEmail) return notify("Set report email in Reports tab", "err");
    if (!adzunaId || !adzunaKey) return notify("Add Adzuna credentials in ⚙️ Settings", "err");
    setDigestSending(true);
    const searchDate = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const keywords = jobSearchKeywords || profile.target_roles || profile.skills?.split(",").slice(0, 3).join(" ") || "jobs";
    try {
      notify("Searching jobs for digest…");
      const results = await fetchJobsForDigest();
      if (!results.length) { notify("No jobs found for digest — check keywords/credentials", "err"); setDigestSending(false); return; }
      setLastDigestResults(results);

      const token = await getGoogleToken(
        "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive.file",
        session, clientId
      );

      const htmlBody = buildJobDigestHTML(results, searchDate, profile.full_name || session.user.email, keywords);
      const subject = `🔍 Daily Job Digest — ${results.length} jobs · ${searchDate}`;

      // Excel
      const { wb, filename } = generateJobDigestExcel(results, searchDate, keywords);
      const xlsxBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" });

      if (jobSearchFormat === "pdf" || jobSearchFormat === "both") {
        // Send email with HTML body (PDF too large to attach via raw, save to Drive instead)
        for (const target of (allTargets.length > 0 ? allTargets : [reportEmail])) {
          await sendEmailViaGmail(target, subject, htmlBody, token);
        }
        const pdfDoc = await generateJobDigestPDF(results, searchDate, profile.full_name || "", keywords);
        const pdfBuf = pdfDoc.output("arraybuffer");
        const pdfFilename = filename.replace(".xlsx", ".pdf");
        await saveFileToDrive(pdfFilename, pdfBuf, "application/pdf", token);
      } else {
        for (const target of (allTargets.length > 0 ? allTargets : [reportEmail])) {
        await sendEmailViaGmail(target, subject, htmlBody, token);
      }
      }

      if (jobSearchFormat === "excel" || jobSearchFormat === "both") {
        await saveFileToDrive(filename, xlsxBuf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", token);
      }

      const entry = { date: todayStr(), time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), count: results.length, keywords, isAuto };
      const newLog = [entry, ...jobDigestLog].slice(0, 30);
      setJobDigestLog(newLog);
      localStorage.setItem("jobDigestLog", JSON.stringify(newLog));
      localStorage.setItem("lastDigestDate", todayStr());
      notify(`Job digest sent! ${results.length} jobs → Gmail + Drive ✓`);
    } catch (err) { notify("Digest failed: " + err.message, "err"); }
    setDigestSending(false);
  }

  async function handleSendReport(isAuto = false) {
    // Also send progress report in PDF format if selected
    const allTargets = scannerEmails.filter(e => e.verified && e.email).map(e => e.email);
    if (allTargets.length === 0 && !reportEmail) return notify("Set report email in Reports tab", "err");
    const targets = allTargets.length > 0 ? allTargets : [reportEmail];
    setReportSending(true);
    const reportDate = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    try {
      const token = await getGoogleToken(
        "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive.file",
        session, clientId
      );
      const htmlBody = buildReportHTML(jobs, reportDate, profile.full_name || session.user.email);
      const subject = `📊 JobBoard Pro Daily Report — ${reportDate}`;

      await sendEmailViaGmail(reportEmail, subject, htmlBody, token);

      if (reportFormat === "excel" || reportFormat === "both") {
        const { wb, filename } = generateBeautifulExcel(jobs);
        const xlsxBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        await saveFileToDrive(filename, xlsxBuf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", token);
      }
      if (reportFormat === "pdf" || reportFormat === "both") {
        const pdfDoc = await generateProgressPDF(jobs, reportDate, profile.full_name || session.user.email);
        const pdfBuf = pdfDoc.output("arraybuffer");
        const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
        await saveFileToDrive(`JobBoard_Report_${date}.pdf`, pdfBuf, "application/pdf", token);
      }

      const entry = { date: todayStr(), time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), jobs: jobs.length, isAuto };
      const newLog = [entry, ...reportLog].slice(0, 30);
      setReportLog(newLog);
      localStorage.setItem("reportLog", JSON.stringify(newLog));
      localStorage.setItem("lastReportDate", todayStr());
      notify(`${isAuto ? "Auto-" : ""}Report sent & saved to Drive ✓`);
    } catch (err) { notify("Report failed: " + err.message, "err"); }
    setReportSending(false);
  }

  // ── Profile CRUD ──────────────────────────────────────────────────────
  // FIX: use maybeSingle() — .single() throws when no profile row exists yet
  async function loadProfile() {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (data) {
      let projects=[];
      try{ projects=data.projects?JSON.parse(data.projects):[]; }catch{ projects=[]; }
      setProfile(p => ({ ...p, ...data, projects }));
      if (data.skills) setBio(`${data.headline || ""}\n${data.summary || ""}`);
    }
    // error is fine here — means no profile row yet, user will create one
  }

  async function saveProfile() {
    setProfileSaving(true);
    const payload = { ...profile, id: session.user.id, projects: JSON.stringify(profile.projects||[]), updated_at: new Date().toISOString() };
    const { error } = await supabase.from("profiles").upsert(payload);
    if (!error) notify("Profile saved ✓");
    else notify(error.message, "err");
    setProfileSaving(false);
  }

  async function parseResume() {
    if (!resumeText.trim()) return notify("Paste your resume text first", "err");
    setResumeParsing(true);
    try {
      const result = await AI(
        `Parse this resume and extract structured data. Return ONLY valid JSON with these exact keys:
full_name, email, phone, location, headline, summary, skills (comma-separated), education, experience, certifications, languages, linkedin, github, portfolio, target_roles, expected_salary.

Resume:
${resumeText.slice(0, 8000)}`,
        "You are a resume parser. Return ONLY valid JSON, no markdown."
      );
      const clean = result.replace(/```json|```/g, "").trim();
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse resume JSON");
      const parsed = JSON.parse(match[0]);
      setProfile(p => ({ ...p, ...parsed }));
      notify("✓ Resume parsed! Review and save your profile.");
    } catch (err) { notify("Parse error: " + err.message, "err"); }
    setResumeParsing(false);
  }

  // FIX: Use PDF.js for proper PDF text extraction
  async function handleResumeFile(e) {
    const file = e.target.files[0]; if (!file) return;

    if (file.name.toLowerCase().endsWith(".pdf")) {
      notify("Reading PDF…");
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const pdfjsLib = await loadPdfJs();
          const pdf = await pdfjsLib.getDocument({ data: ev.target.result }).promise;
          let text = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(" ");
            text += pageText + "\n";
          }
          if (text.trim().length > 80) {
            setResumeText(text.trim());
            notify(`PDF read ✓ (${pdf.numPages} pages) — click Parse Resume`);
          } else {
            notify("PDF appears to be image-based. Please paste your resume text manually.", "err");
          }
        } catch (err) { notify("PDF error: " + err.message + ". Try pasting text manually.", "err"); }
      };
      reader.readAsArrayBuffer(file);
    } else if (file.name.toLowerCase().match(/\.(txt|doc|docx)$/)) {
      const reader = new FileReader();
      reader.onload = ev => { setResumeText(ev.target.result); notify("File loaded ✓ — click Parse Resume"); };
      reader.readAsText(file);
    } else {
      notify("Supported formats: PDF, TXT, DOC", "err");
    }
    e.target.value = "";
  }

  // ── Job CRUD ──────────────────────────────────────────────────────────
  function openAdd() {
    setForm({ ...blank, location: profile.target_locations || profile.location || "", salary: profile.expected_salary || "", skills: profile.skills || "" });
    setEditId(null); setShowAdd(true);
  }
  function openEdit(j) { setForm({ ...j }); setEditId(j.id); setShowAdd(true); }
  async function saveJob() {
    if (!form.title || !form.company) return notify("Title & Company required", "err");
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
          `⚠️ Possible duplicate detected!\n\nYou already have "${duplicate.title}" at "${duplicate.company}" with status "${duplicate.status}".\n\nAdd anyway?`
        );
        if (!proceed) return;
      }
    }
    const payload = { ...form, user_id: session.user.id }; delete payload.id;
    if (editId) {
      const { error } = await supabase.from("jobs").update(payload).eq("id", editId);
      if (!error) { fetchJobs(); notify("Updated ✓"); setShowAdd(false); } else notify(error.message, "err");
    } else {
      const { error } = await supabase.from("jobs").insert([payload]);
      if (!error) { fetchJobs(); notify("Added ✓"); setShowAdd(false); } else notify(error.message, "err");
    }
  }
  async function delJob(id) {
    if (!confirm("Remove this job?")) return;
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (!error) { fetchJobs(); notify("Removed"); }
  }
  async function setStatus(id, status) {
    await supabase.from("jobs").update({ status }).eq("id", id);
    fetchJobs();
  }

  // ── Bulk Operations ──────────────────────────────────────────────────
  function toggleSelect(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    setSelected(s => s.size === visible.length ? new Set() : new Set(visible.map(j => j.id)));
  }
  function clearSelection() { setSelected(new Set()); }

  async function bulkDelete() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} job${selected.size > 1 ? "s" : ""}? This cannot be undone.`)) return;
    const ids = [...selected];
    // Delete in batches of 200 to avoid URL length limits
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from("jobs").delete().in("id", ids.slice(i, i + 200));
      if (error) { notify(error.message, "err"); return; }
    }
    setSelected(new Set());
    fetchJobs();
    notify(`Deleted ${ids.length} job${ids.length > 1 ? "s" : ""} ✓`);
  }

  async function bulkSetStatus(status) {
    if (!selected.size || !status) return;
    const ids = [...selected];
    for (let i = 0; i < ids.length; i += 200) {
      await supabase.from("jobs").update({ status }).in("id", ids.slice(i, i + 200));
    }
    setSelected(new Set()); setBulkStatus("");
    fetchJobs(); notify(`Updated ${ids.length} jobs → ${status} ✓`);
  }

  async function bulkSetPriority(priority) {
    if (!selected.size || !priority) return;
    const ids = [...selected];
    for (let i = 0; i < ids.length; i += 200) {
      await supabase.from("jobs").update({ priority }).in("id", ids.slice(i, i + 200));
    }
    setSelected(new Set()); setBulkPriority("");
    fetchJobs(); notify(`Updated ${ids.length} jobs → ${priority} priority ✓`);
  }

  function bulkExport() {
    if (!selected.size) return;
    const sel = jobs.filter(j => selected.has(j.id));
    const wb = XLSX.utils.book_new();
    const headers = ["Job Title", "Company", "Location", "Type", "Salary", "Skills", "Source", "Status", "Priority", "Applied Date", "Deadline", "Apply Link", "Notes"];
    const rows = sel.map(j => [j.title, j.company, j.location, j.type, j.salary, j.skills, j.source, j.status, j.priority, j.applieddate, j.deadline, j.applylink, j.notes]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, "Selected Jobs");
    XLSX.writeFile(wb, `JobBoard_Selected_${sel.length}.xlsx`);
    notify(`Exported ${sel.length} jobs ✓`);
  }

  async function duplicateJob(job) {
    const payload = { title: `${job.title} (copy)`, company: job.company, location: job.location, type: job.type, salary: job.salary, skills: job.skills, source: job.source, applylink: job.applylink, status: "Bookmarked", applieddate: "", deadline: job.deadline, notes: job.notes, priority: job.priority, user_id: session.user.id };
    const { error } = await supabase.from("jobs").insert([payload]);
    if (!error) { fetchJobs(); notify(`Duplicated "${job.title}" ✓`); } else notify(error.message, "err");
  }

  // ── Reports ─── (moved above, see handleSendReport + handleSendJobDigest) ───

  function previewReport() {
    const reportDate = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    setReportPreviewHTML(buildReportHTML(jobs, reportDate, profile.full_name || session.user.email));
    setShowReportPreview(true);
  }

  function downloadReport() {
    const { wb, filename } = generateBeautifulExcel(jobs);
    XLSX.writeFile(wb, filename);
    notify(`Downloaded ${filename} ✓`);
  }

  async function downloadProgressPDFLocal() {
    const reportDate = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    notify("Generating PDF…");
    try {
      const pdfDoc = await generateProgressPDF(jobs, reportDate, profile.full_name || session.user.email);
      const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
      pdfDoc.save(`JobBoard_Report_${date}.pdf`);
      notify("PDF downloaded ✓");
    } catch (err) { notify("PDF error: " + err.message, "err"); }
  }

  function downloadProgressCSVLocal() {
    const content = generateProgressCSV(jobs);
    const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
    downloadCSVFile(content, `JobBoard_Report_${date}.csv`);
    notify("CSV downloaded ✓");
  }

  function downloadLastDigestExcel() {
    if (!lastDigestResults.length) return notify("Send a digest first to download", "err");
    const searchDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
    const { wb, filename } = generateJobDigestExcel(lastDigestResults, searchDate, jobSearchKeywords || "jobs");
    XLSX.writeFile(wb, filename);
    notify(`Digest Excel downloaded ✓`);
  }

  async function downloadLastDigestPDF() {
    if (!lastDigestResults.length) return notify("Send a digest first to download", "err");
    notify("Generating Digest PDF…");
    try {
      const searchDate = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const pdfDoc = await generateJobDigestPDF(lastDigestResults, searchDate, profile.full_name || "", jobSearchKeywords || "jobs");
      pdfDoc.save(`JobDigest_${todayStr()}.pdf`);
      notify("Digest PDF downloaded ✓");
    } catch (err) { notify("PDF error: " + err.message, "err"); }
  }

  function downloadLastDigestCSV() {
    if (!lastDigestResults.length) return notify("Send a digest first to download", "err");
    const searchDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const content = generateJobDigestCSV(lastDigestResults, jobSearchKeywords || "jobs", searchDate);
    downloadCSVFile(content, `JobDigest_${todayStr()}.csv`);
    notify("Digest CSV downloaded ✓");
  }

  function saveSettings() {
    localStorage.setItem("geminiKey", geminiKey);
    localStorage.setItem("googleClientId", clientId);
    localStorage.setItem("aiModel", aiModel);
    localStorage.setItem("proxyUrl", proxyUrl);
    localStorage.setItem("adzunaId", adzunaId);
    localStorage.setItem("adzunaKey", adzunaKey);
    localStorage.setItem("reportEmail", reportEmail);
    localStorage.setItem("scannerEmails", JSON.stringify(scannerEmails));
    localStorage.setItem("autoReport", String(autoReport));
    localStorage.setItem("reportTime", reportTime);
    localStorage.setItem("gmailAccounts", JSON.stringify(gmailAccounts));
    localStorage.setItem("autoJobSearch", String(autoJobSearch));
    localStorage.setItem("jobSearchTime", jobSearchTime);
    localStorage.setItem("jobSearchKeywords", jobSearchKeywords);
    localStorage.setItem("jobSearchLocation", jobSearchLocation);
    localStorage.setItem("jobSearchResultCount", jobSearchResultCount);
    localStorage.setItem("jobSearchFormat", jobSearchFormat);
    localStorage.setItem("reportFormat", reportFormat);
    localStorage.setItem("sheetsSpreadsheetId",   sheetsSpreadsheetId);
    localStorage.setItem("sheetsEnabled",    sheetsEnabled);
    // Clear ALL cached Google tokens so new clientId / scopes take effect
    try { Object.keys(sessionStorage).filter(k => k.startsWith("gtoken_")).forEach(k => sessionStorage.removeItem(k)); } catch { }
    notify("Settings saved ✓");
    setShowSettings(false);
  }

  // ── Adzuna Job Search ────────────────────────────────────────────────
  function buildAdzunaUrl(page = 1, cityOverride = '') {
    const expLevel = EXPERIENCE_LEVELS.find(e => e.value === sExperience);
    let what = sq.trim();
    if (expLevel?.keywords) what = what ? `${what} ${expLevel.keywords}` : expLevel.keywords;
    let url = `https://api.adzuna.com/v1/api/jobs/in/search/${page}?app_id=${adzunaId}&app_key=${adzunaKey}&results_per_page=50&content-type=application/json&sort_by=date`;
    if (what) url += `&what=${encodeURIComponent(what)}`;
    const _city = cityOverride || sLocation.trim();
    if (_city) url += `&where=${encodeURIComponent(_city)}`;
    if (sJobType === "full-time") url += `&full_time=1`;
    if (sJobType === "part-time") url += `&part_time=1`;
    if (sJobType === "contract") url += `&contract=1`;
    if (sSalaryMin) url += `&salary_min=${sSalaryMin}`;
    if (sCategory) url += `&category=${sCategory}`;
    return url;
  }

  function mapAdzuna(results) {
    return results.map(j => {
      const rawDesc = j.description || "";
      const cleanDesc = rawDesc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      let jobType = "Full-time";
      if ((j.contract_time || "") === "part_time") jobType = "Part-time";
      else if ((j.contract_type || "") === "contract") jobType = "Contract";
      return {
        title: j.title?.replace(/<[^>]+>/g, "") || "",
        company: j.company?.display_name || "Unknown",
        location: j.location?.display_name || "",
        type: jobType, salary: formatSalary(j.salary_min, j.salary_max),
        skills: extractSkillsFromText(cleanDesc), source: "Adzuna",
        applylink: j.redirect_url || "",
        description: cleanDesc.slice(0, 300) + (cleanDesc.length > 300 ? "…" : ""),
        category: j.category?.label || "",
        postedDaysAgo: j.created ? Math.floor((Date.now() - new Date(j.created).getTime()) / 86400000) : null,
        matchScore: calcMatchScore(extractSkillsFromText(cleanDesc), profile.skills),
      };
    });
  }

  async function doSearch(reset = true) {
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
        const key = r.applylink || `${r.title}__${r.company}`;
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
  }

  function saveSearch() {
    const label = sq || sCategory || sLocation || "Search";
    const search = { label, sq, sLocation, sJobType, sSalaryMin, sCategory, sExperience };
    const updated = [search, ...savedSearches.filter(s => s.label !== label)].slice(0, 5);
    setSavedSearches(updated); localStorage.setItem("savedSearches", JSON.stringify(updated));
    notify("Search saved ✓");
  }

  async function addFromSearch(r) {
    const payload = { title: r.title, company: r.company, location: r.location || "", type: r.type || "Full-time", salary: r.salary || "Not disclosed", skills: r.skills || "", source: "Adzuna", applylink: r.applylink || "", status: "Bookmarked", applieddate: "", deadline: "", notes: [r.category ? `Category: ${r.category}` : "", r.description || ""].filter(Boolean).join("\n").trim(), priority: "Medium", user_id: session.user.id };
    const { error } = await supabase.from("jobs").insert([payload]);
    if (!error) { fetchJobs(); notify(`"${r.title}" bookmarked ✓`); } else notify(error.message, "err");
  }



    // ── Scanner Email Management ──────────────────────────────────────────────
  function addScannerEmail() {
    const newEntry = { id: Date.now(), email: "", verified: false, status: "unverified" };
    const updated = [...scannerEmails, newEntry];
    setScannerEmails(updated);
  }

  function removeScannerEmail(id) {
    const updated = scannerEmails.filter(e => e.id !== id);
    setScannerEmails(updated);
    localStorage.setItem("scannerEmails", JSON.stringify(updated));
  }

  function updateScannerEmail(id, email) {
    const updated = scannerEmails.map(e =>
      e.id === id ? { ...e, email, verified: false, status: email ? "unverified" : "empty" } : e
    );
    setScannerEmails(updated);
  }

  async function sendVerificationEmail(id) {
    const entry = scannerEmails.find(e => e.id === id);
    if (!entry?.email || !entry.email.includes("@")) return notify("Enter a valid email first", "err");
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings", "err");
    setEmailTestSending(id);
    try {
      const token = await getGoogleToken(
        "https://www.googleapis.com/auth/gmail.send", session, clientId
      );
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      // Store code temporarily
      const updated = scannerEmails.map(e =>
        e.id === id ? { ...e, verifyCode: code, status: "code_sent" } : e
      );
      setScannerEmails(updated);

      const html = `<html><body style="font-family:Arial,sans-serif;background:#050c1a;color:#e2e8f0;padding:40px 20px;text-align:center">
        <div style="max-width:480px;margin:auto;background:#06101e;border:1px solid #1e2d45;border-radius:16px;padding:36px">
          <div style="font-size:32px;margin-bottom:12px">🎯</div>
          <h2 style="color:#818cf8;font-family:sans-serif;margin:0 0 8px">JobBoard Pro</h2>
          <p style="color:#64748b;font-size:14px;margin-bottom:24px">Email Verification</p>
          <div style="background:#0a1628;border:1px solid #1e2d45;border-radius:12px;padding:24px;margin-bottom:20px">
            <p style="color:#94a3b8;font-size:14px;margin:0 0 12px">Your verification code:</p>
            <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#60a5fa;font-family:monospace">${code}</div>
          </div>
          <p style="color:#475569;font-size:12px">Enter this code in JobBoard Pro to verify this email address.<br>Code expires in 10 minutes.</p>
        </div>
      </body></html>`;

      await sendEmailViaGmail(
        entry.email,
        "🎯 JobBoard Pro — Email Verification Code",
        html,
        token
      );
      notify(`Verification code sent to ${entry.email} ✓`);
    } catch (err) {
      notify("Send failed: " + err.message, "err");
      const updated = scannerEmails.map(e =>
        e.id === id ? { ...e, status: "unverified", verifyCode: null } : e
      );
      setScannerEmails(updated);
    }
    setEmailTestSending(null);
  }

  function confirmVerifyCode(id, inputCode) {
    const entry = scannerEmails.find(e => e.id === id);
    if (!entry?.verifyCode) return notify("Send verification code first", "err");
    if (inputCode.trim() === entry.verifyCode) {
      const updated = scannerEmails.map(e =>
        e.id === id ? { ...e, verified: true, status: "verified", verifyCode: null } : e
      );
      setScannerEmails(updated);
      localStorage.setItem("scannerEmails", JSON.stringify(updated));
      notify(`✅ ${entry.email} verified!`);
    } else {
      notify("Incorrect code — try again", "err");
    }
  }

  function saveScannerEmails() {
    const valid = scannerEmails.filter(e => e.email && e.email.includes("@"));
    localStorage.setItem("scannerEmails", JSON.stringify(valid));
    notify("Email recipients saved ✓");
  }

  // ── AI Extract job from pasted description ───────────────────────────────
  async function aiExtractJob() {
    if (!aiExtractNotes.trim()) return notify("Paste a job description first", "err");
    setAiExtractLoading(true);
    try {
      const result = await callAI(
        `Extract all job details from this description. Return ONLY valid JSON with these exact keys:
{"title":"","company":"","location":"","type":"Full-time or Part-time or Internship or Contract or Freelance","salary":"","skills":"comma-separated skills","deadline":"YYYY-MM-DD or empty","notes":"key requirements max 400 chars"}

Job Description:
${aiExtractNotes.slice(0,5000)}`,
        "Return ONLY valid JSON. No markdown. Extract all details accurately.",
        geminiKey, aiModel, proxyUrl
      );
      const clean = result.replace(/```json|```/g,'').trim();
      const match = clean.match(/\{[\s\S]*\}/);
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

  // ── Notion Sync ──────────────────────────────────────────────────────────
  async function syncToGoogleSheets(jobsToSync) {
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings", "err");
    // sheetsEnabled check removed - Google Sheets needs no config in ⚙️ Settings", "err");
    const toSync = jobsToSync || jobs;
    if (!toSync.length) return notify("No jobs to sync", "err");
    setSheetsSyncing(true);
    notify("Syncing " + toSync.length + " jobs to Notion…");
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_jobs",
          token: sheetsSpreadsheetId,
          database_id: sheetsEnabled,
          jobs: toSync.map(j => ({
            id: j.id,
            title: j.title,
            company: j.company || "",
            location: j.location || "",
            status: j.status,
            priority: j.priority,
            salary: j.salary || "",
            skills: j.skills || "",
            source: j.source || "",
            applylink: j.applylink || "",
            applieddate: j.applieddate || "",
            deadline: j.deadline || "",
            notes: (j.notes || "").slice(0, 500),
          }))
        })
      });
      if (!res.ok) { const t = await res.text(); throw new Error(t); }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      notify("Synced " + (data.synced || 0) + " / " + toSync.length + " jobs to Notion ✓");
    } catch (err) {
      notify("Notion error: " + err.message, "err");
    }
    setSheetsSyncing(false);
  }

  // ── Gmail Multi-Category Scanner (5 categories simultaneously) ──────────
  async function handleGmailMultiScan(silent = false) {
    if (!clientId) {
      if (!silent) notify("Add Google Client ID in ⚙️ Settings to use Gmail scan.", "err");
      return;
    }
    if (!silent) notify("📧 Scanning Gmail for job emails...");
    try {
      const token = await getGoogleToken(
        "https://www.googleapis.com/auth/gmail.readonly",
        session,
        clientId
      );

      // 5 search queries run in parallel
      const GMAIL_QUERIES = [
        // Interview invitations
        { label: 'Interview Scheduled',
          q: '(subject:interview OR subject:"invite you" OR subject:"next round" OR subject:"schedule a call" OR subject:"interview confirmed" OR subject:"interview invite" OR subject:"interview details" OR subject:"technical interview" OR subject:"hr round" OR subject:"round 1" OR subject:"round 2" OR subject:"joining date" OR subject:"we would like to meet" OR subject:"video interview" OR subject:"telephonic interview") newer_than:90d -subject:newsletter -subject:unsubscribe -subject:"password reset" -subject:OTP -subject:"verify your email"' },
        // Offers
        { label: 'Offer Received',
          q: '(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer" OR subject:"congratulations" OR subject:"selected for" OR subject:"we are excited" OR subject:"offer accepted" OR subject:"joining formalities" OR subject:"onboarding" OR subject:"welcome to the team" OR subject:"appointment letter" OR subject:"ctc" OR subject:"compensation letter") newer_than:90d -subject:newsletter -subject:unsubscribe' },
        // Rejections
        { label: 'Rejected',
          q: '(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates" OR subject:"regret to inform" OR subject:"will not be proceeding" OR subject:"decided not to" OR subject:"position has been filled" OR subject:"not shortlisted" OR subject:"better suited" OR subject:"not be considered" OR subject:"not in a position") newer_than:90d -subject:newsletter -subject:unsubscribe' },
        // Application confirmations
        { label: 'Applied',
          q: '(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted" OR subject:"application confirmation" OR subject:"we received your" OR subject:"successfully applied" OR subject:"your application" OR subject:"application acknowledged" OR subject:"applied for" OR subject:"resume received" OR subject:"candidature received" OR subject:"application for the role") newer_than:90d -subject:newsletter -subject:unsubscribe -subject:"password reset" -subject:"verify your"' },
        // Screening / assessment
        { label: 'Screening',
          q: '(subject:"phone screen" OR subject:"screening call" OR subject:"initial call" OR subject:"introductory call" OR subject:recruiter OR subject:"coding challenge" OR subject:assessment OR subject:"take-home" OR subject:"online test" OR subject:"hackerrank" OR subject:"codility" OR subject:"aptitude test" OR subject:"written test" OR subject:"technical test" OR subject:"pre-screening" OR subject:"profile shortlisted" OR subject:"shortlisted for interview" OR subject:"merit list" OR subject:"hackerearth") newer_than:90d -subject:newsletter -subject:unsubscribe' },
        // Follow-ups / status updates
        { label: 'Follow-up',
          q: '(subject:"next steps" OR subject:"following up" OR subject:"update on your" OR subject:shortlisted OR subject:"moved forward" OR subject:"further process" OR subject:"keep you posted" OR subject:"application status" OR subject:"background check" OR subject:"reference check" OR subject:"document verification" OR subject:"joining confirmation") newer_than:90d -subject:newsletter -subject:unsubscribe' },
      ]

      // Fetch all 6 in parallel — queries already contain newer_than so no need to append
      const results = await Promise.allSettled(
        GMAIL_QUERIES.map(({ label, q }) =>
          fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(q)}`,
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
        if (!silent) notify("No new job-related emails found in the last 60 days.");
        localStorage.setItem("lastGmailScan", todayStr());
        return;
      }

      // Fetch email details (up to 40 emails)
      const detailsToFetch = allMessages.slice(0, 40);
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
              return { id: msg.id, subject: get("Subject"), from: get("From"), date: get("Date"), snippet: data.snippet || "", category: msg.category };
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

        if (matchedJob && matchedJob.status !== emailCategoryToStatus(email.category)) {
          // Only update to more advanced status
          const statusOrder = ["Bookmarked", "Applied", "Screening", "Interview", "Offer", "Rejected", "Withdrawn"];
          const mappedStatus = emailCategoryToStatus(email.category);
          const currentIdx = statusOrder.indexOf(matchedJob.status);
          const newIdx = statusOrder.indexOf(mappedStatus);
          if (newIdx > currentIdx || mappedStatus === "Rejected" || mappedStatus === "Offer") {
            updates.push({ ...matchedJob, status: mappedStatus, notes: (matchedJob.notes || "") + `\n[Email ${new Date(email.date).toLocaleDateString()}] ${email.subject}` });
            updatedCount++;
          }
        } else if (!matchedJob) {
          // New job from email — extract company from sender
          const company = email.from.match(/^"?([^"<]+)"?\s*</)?.[1]?.trim() || fromDomain || "Unknown";
          const mappedStatus = emailCategoryToStatus(email.category);
          const newJob = {
            title: email.subject.replace(/re:/i, "").trim().slice(0, 80),
            company: company.slice(0, 50),
            status: mappedStatus,
            notes: `[Imported from Gmail ${new Date(email.date).toLocaleDateString()}]\n${email.subject}`,
            source: "Gmail Scan",
            applieddate: mappedStatus === "Applied" ? new Date(email.date).toISOString().split("T")[0] : "",
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

  // ── Interview Prep Generator ─────────────────────────────────────────────
  async function generateInterviewPrep(job) {
    if (!aiModel) return notify("AI not configured — add API key in ⚙️ Settings", "err");
    setInterviewPrepJob(job);
    setInterviewPrepResult('');
    setInterviewPrepLoading(true);
    try {
const result = await callAI(
        `Generate a structured interview prep guide for this role.

Role: ${job.title} at ${job.company}
Skills/Requirements: ${job.skills || "Not specified"}
Job Notes: ${(job.notes || "").slice(0, 400)}

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
GOAL: [success indicator]`,
        "You are an expert interview coach. You MUST follow the output format exactly. FORBIDDEN: markdown tables, | pipe characters, --- separators, ** asterisks, # hash headers, backticks. Use only the SECTION:/Q:/ANSWER:/TIP:/WHY:/TASK:/HOW:/GOAL: labels shown.",
        geminiKey, aiModel, proxyUrl
      );
      setInterviewPrepResult(cleanPrepOutput(result));
      notify("✓ Interview prep ready!");
    } catch (err) { notify("AI error: " + err.message, "err"); }
    setInterviewPrepLoading(false);
  }

  // ── Follow-Up Draft Generator ─────────────────────────────────────────────
  async function generateFollowUp(job) {
    if (!aiModel) return notify("AI not configured — add API key in ⚙️ Settings", "err");
    setFollowUpJob(job);
    setFollowUpDraft('');
    setFollowUpLoading(true);
    try {
      const appliedDate = job.applieddate ? new Date(job.applieddate).toLocaleDateString("en-IN", { day: "numeric", month: "long" }) : "recently";
      const name = profile?.full_name || "the candidate";
      const result = await callAI(
        `Write a professional follow-up email for a job application.
Role: ${job.title} at ${job.company}
Applied: ${appliedDate}
Applicant: ${name}

Write a concise, friendly follow-up email (3-4 short paragraphs):
1. Opening — who you are, what role you applied for
2. Brief reinforcement of interest and one key qualification
3. Request for status update
4. Professional closing
Plain text only. No markdown.`,
        "Expert career coach. Write professional, warm follow-up emails that get responses.",
        geminiKey, aiModel, proxyUrl
      );
      setFollowUpDraft(result.trim());
      notify("✓ Follow-up draft ready!");
    } catch (err) { notify("AI error: " + err.message, "err"); }
    setFollowUpLoading(false);
  }

  // ── Salary Benchmark ──────────────────────────────────────────────────────
  async function getSalaryBenchmark(title, location) {
    if (!aiModel) return notify("AI not configured", "err");
    setSalaryLoading(true);
    setSalaryBenchmark(null);
    try {
      const result = await callAI(
        `Provide a salary benchmark estimate for: "${title}" in "${location || "India"}".
Return ONLY valid JSON:
{"min_lpa": number, "max_lpa": number, "mid_lpa": number, "currency": "INR", "level": "fresher/junior/mid/senior", "notes": "brief 1-line market context"}`,
        "Return ONLY valid JSON. Provide realistic current market rates.",
        geminiKey, aiModel, proxyUrl
      );
      const match = result.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
      if (match) setSalaryBenchmark(JSON.parse(match[0]));
    } catch (err) { console.error("Salary benchmark:", err); }
    setSalaryLoading(false);
  }









  // ── URL Scraper ───────────────────────────────────────────────────────
  async function doScrapeURL() {
    if(!scrapeURL.trim())return setScrapeError("Please enter a URL");
    let url=scrapeURL.trim();
    if(!url.startsWith("http"))url="https://"+url;
    setScrapeLoading(true); setScrapeError(""); setScrapeResult(null);
    try{
      const result=await scrapeJobFromURL(url,AI);
      setScrapeResult(result);
    }catch(err){setScrapeError(err.message);}
    setScrapeLoading(false);
  }
  async function addScrapedJob(){
    if(!scrapeResult)return;
    const payload={...scrapeResult,user_id:session.user.id};
    const{error}=await supabase.from("jobs").insert([payload]);
    if(!error){fetchJobs();notify(`"${scrapeResult.title}" added ✓`);setShowURLScraper(false);setScrapeResult(null);setScrapeURL("");}
    else notify(error.message,"err");
  }

  // ── AI Features ───────────────────────────────────────────────────────
  async function doPrep(job) {
    if (!job) return;
    setPrepLoad(true); setPrepOut(""); setShowPrep(job);
    const profileCtx = profile.skills ? `\nCandidate: ${profile.headline || ""}. Skills: ${profile.skills}. ${profile.summary || ""}` : "";
    try {
      const t = await AI(
        `Interview prep guide for "${job.title}" at ${job.company}.${profileCtx}
Include: 6 technical Q&A (skills: ${job.skills || "general"}), 3 STAR behavioral Qs with sample answers, 3 questions to ask interviewer, 5 key prep tasks.`,
        "You are an expert career coach. FORBIDDEN: markdown tables, | characters, ---, ** bold, # headers, backticks. Use plain numbered lists only."
      );
      setPrepOut(cleanPrepOutput(cleanAI(t)));
    } catch (err) { setPrepOut("Error: " + err.message); }
    setPrepLoad(false);
  }

  async function doCover(job) {
    if (!job) return;
    setCoverLoad(true); setCoverOut("");
    const profileCtx = profile.full_name ? `Name: ${profile.full_name}. Skills: ${profile.skills}. ${profile.summary || bio || ""}` : bio || "Motivated candidate";
    try {
      const t = await AI(
        `Write a professional cover letter for: Role: ${job.title} at ${job.company} (${job.location}). Skills needed: ${job.skills || "general"}. Candidate: ${profileCtx}. Be specific, genuine, 3 strong paragraphs.`,
        "You are a professional career writer. No clichés."
      );
      setCoverOut(cleanAI(t));
    } catch (err) { setCoverOut("Error: " + err.message); }
    setCoverLoad(false);
  }

  // ── Auto Apply Function ───────────────────────────────────────────────
  async function autoApplyToJob(job) {
    if (!job) return;
    if (appliedJobs.some(a => a.jobId === job.id)) {
      return notify('Already auto-applied to this job', 'err');
    }

    setAutoApplying(job.id);
    notify(`⚡ Auto-applying to ${job.company}…`);

    try {
      // 1. Generate tailored cover letter
      const profileCtx = profile.full_name
        ? `Name: ${profile.full_name}. Headline: ${profile.headline || ''}. Skills: ${profile.skills || ''}. Summary: ${profile.summary || ''}. Experience: ${profile.experience?.slice(0, 300) || ''}. Education: ${profile.education || ''}.`
        : bio || 'Experienced professional';

      const coverLetter = await AI(
        `Write a compelling, concise cover letter (3 paragraphs, max 250 words) for:
Role: ${job.title} at ${job.company} (${job.location || 'Remote'})
Required Skills: ${job.skills || 'general'}
Candidate: ${profileCtx}

Format: Professional letter. Opening hook, relevant experience paragraph, strong closing with CTA. No clichés.`,
        'You are an expert cover letter writer. Be specific, genuine, results-focused.'
      );

      // 2. Detect apply method
      const applyEmail = extractEmailFromJob(job);

      if (applyEmail && clientId) {
        // 3a. Send via Gmail API
        const token = await getGoogleToken(
          'https://www.googleapis.com/auth/gmail.send', session, clientId
        );
        const subject = `Application for ${job.title} — ${profile.full_name || 'Candidate'}`;
        const htmlBody = buildApplicationEmailHTML(job, coverLetter, profile);
        await sendEmailViaGmail(applyEmail, subject, htmlBody, token);
        notify(`✅ Application emailed to ${applyEmail}`);
      } else if (job.applylink) {
        // 3b. Open apply link + copy cover letter to clipboard
        navigator.clipboard?.writeText(coverLetter).catch(() => {});
        window.open(job.applylink, '_blank');
        notify(`✅ Apply link opened · Cover letter copied to clipboard`);
      } else {
        notify(`Cover letter generated — no apply link found. Copy manually.`, 'err');
      }

      // 4. Update status to Applied in DB
      await supabase.from('jobs').update({
        status: 'Applied',
        applieddate: new Date().toISOString().split('T')[0],
        notes: `[Auto-applied ${new Date().toLocaleDateString()}]\n${job.notes || ''}\n\n--- Cover Letter ---\n${coverLetter}`,
      }).eq('id', job.id);

      // 5. Log the application
      const entry = {
        jobId: job.id, title: job.title, company: job.company,
        appliedAt: new Date().toISOString(),
        method: applyEmail ? 'email' : 'link',
        email: applyEmail || job.applylink || '—',
      };
      const newLog = [entry, ...appliedJobs].slice(0, 100);
      setAppliedJobs(newLog);
      localStorage.setItem('autoAppliedJobs', JSON.stringify(newLog));
      fetchJobs();

    } catch (err) {
      notify('Auto-apply failed: ' + err.message, 'err');
    }
    setAutoApplying(null);
  }

  // ── Multi-Account Gmail Management ────────────────────────────────────────
  async function addGmailAccount() {
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings first", "err");
    setAddingAccount(true);
    try {
      const gis = await loadGis();
      // Force the account chooser every time so user can pick a DIFFERENT account
      const token = await new Promise((resolve, reject) => {
        const tc = gis.initTokenClient({
          client_id: clientId,
          scope: "https://www.googleapis.com/auth/gmail.readonly",
          callback: (r) => {
            if (r.error) return reject(new Error(r.error_description || r.error));
            resolve(r.access_token);
          },
        });
        tc.requestAccessToken({ prompt: "select_account" });
      });

      const profileRes = await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!profileRes.ok) throw new Error("Could not fetch account info");
      const profileData = await profileRes.json();
      const email = profileData.email;
      if (!email) throw new Error("Could not get account email");

      if (gmailAccounts.some(a => a.email === email)) {
        notify(`${email} is already connected. To add a different account, first sign in to another Google account in your browser, then click + Add Gmail Account.`, "err");
        setAddingAccount(false);
        return;
      }

      // Store token keyed by this account's email so scan can use it without a popup
      try {
        sessionStorage.setItem(`gtoken_acct_${email}`, JSON.stringify({
          token, exp: Date.now() + 3300000,
        }));
      } catch { }

      const newAccount = {
        id: Date.now(), email,
        name: profileData.name || email,
        picture: profileData.picture || null,
        addedAt: new Date().toISOString(),
      };
      const updated = [...gmailAccounts, newAccount];
      setGmailAccounts(updated);
      localStorage.setItem("gmailAccounts", JSON.stringify(updated));
      notify(`✅ ${email} added! Token cached — scan will work without extra popups.`);
    } catch (err) {
      if (!err.message?.includes("popup_closed") && !err.message?.includes("access_denied")) {
        notify("Could not add account: " + err.message, "err");
      }
    }
    setAddingAccount(false);
  }

  function removeGmailAccount(id) {
    const account = gmailAccounts.find(a => a.id === id);
    if (account) {
      try { sessionStorage.removeItem(`gtoken_acct_${account.email}`); } catch { }
    }
    const updated = gmailAccounts.filter(a => a.id !== id);
    setGmailAccounts(updated);
    localStorage.setItem("gmailAccounts", JSON.stringify(updated));
    setGmailScanProgress(p => {
      const next = { ...p };
      if (account) delete next[account.email];
      return next;
    });
    notify("Account removed");
  }

  async function scanSingleAccount(account) {
    setGmailScanProgress(p => ({ ...p, [account.email]: "scanning" }));
    let token = null;

    // Step 1: Try the cached token stored when this account was added
    try {
      const raw = sessionStorage.getItem(`gtoken_acct_${account.email}`);
      if (raw) {
        const { token: t, exp } = JSON.parse(raw);
        if (t && Date.now() < exp) {
          token = t;
        } else {
          sessionStorage.removeItem(`gtoken_acct_${account.email}`);
        }
      }
    } catch { }

    // Step 2: If no cached token, request a fresh one via GIS
    // login_hint=email means Google will silently use that account if it has an active session
    if (!token) {
      try {
        const gis = await loadGis();
        token = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Token request timed out")), 30000);
          const tc = gis.initTokenClient({
            client_id: clientId,
            scope: "https://www.googleapis.com/auth/gmail.readonly",
            callback: (r) => {
              clearTimeout(timer);
              if (r.error) return reject(new Error(r.error_description || r.error));
              try {
                sessionStorage.setItem(`gtoken_acct_${account.email}`, JSON.stringify({
                  token: r.access_token, exp: Date.now() + 3300000,
                }));
              } catch { }
              resolve(r.access_token);
            },
          });
          tc.requestAccessToken({ prompt: "", login_hint: account.email });
        });
      } catch (authErr) {
        const isCancel = authErr.message?.includes("popup_closed") || authErr.message?.includes("access_denied") || authErr.message?.includes("timed out");
        setGmailScanProgress(p => ({ ...p, [account.email]: isCancel ? "skipped" : "error" }));
        console.warn(`Auth failed for ${account.email}:`, authErr.message);
        return { account: account.email, found: 0, emails: [], error: authErr.message };
      }
    }

    // Step 3: Use token to scan Gmail
    try {
      const days = gmailDays || "60";
      const QUERIES = [
        { label: "Interview Scheduled",
          q: `(subject:interview OR subject:"invite you" OR subject:"next round" OR subject:"schedule a call" OR subject:"interview confirmed" OR subject:"interview invite" OR subject:"interview details" OR subject:"technical interview" OR subject:"hr round" OR subject:"round 1" OR subject:"round 2" OR subject:"joining date" OR subject:"we would like to meet" OR subject:"video interview" OR subject:"telephonic interview") newer_than:${days}d -subject:newsletter -subject:unsubscribe -subject:"password reset" -subject:OTP -subject:"verify your email"` },
        { label: "Offer Received",
          q: `(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer" OR subject:"congratulations" OR subject:"selected for" OR subject:"we are excited" OR subject:"offer accepted" OR subject:"joining formalities" OR subject:"onboarding" OR subject:"welcome to the team" OR subject:"appointment letter" OR subject:"ctc" OR subject:"compensation letter") newer_than:${days}d -subject:newsletter -subject:unsubscribe` },
        { label: "Rejected",
          q: `(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates" OR subject:"regret to inform" OR subject:"will not be proceeding" OR subject:"decided not to" OR subject:"position has been filled" OR subject:"not shortlisted" OR subject:"better suited" OR subject:"not be considered" OR subject:"not in a position") newer_than:${days}d -subject:newsletter -subject:unsubscribe` },
        { label: "Applied",
          q: `(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted" OR subject:"application confirmation" OR subject:"we received your" OR subject:"successfully applied" OR subject:"your application" OR subject:"application acknowledged" OR subject:"applied for" OR subject:"resume received" OR subject:"candidature received" OR subject:"application for the role") newer_than:${days}d -subject:newsletter -subject:unsubscribe -subject:"password reset" -subject:"verify your"` },
        { label: "Screening",
          q: `(subject:"phone screen" OR subject:"screening call" OR subject:"initial call" OR subject:"introductory call" OR subject:recruiter OR subject:"coding challenge" OR subject:assessment OR subject:"take-home" OR subject:"online test" OR subject:"hackerrank" OR subject:"codility" OR subject:"aptitude test" OR subject:"written test" OR subject:"technical test" OR subject:"pre-screening" OR subject:"profile shortlisted" OR subject:"shortlisted for interview" OR subject:"merit list" OR subject:"hackerearth") newer_than:${days}d -subject:newsletter -subject:unsubscribe` },
        { label: "Follow-up",
          q: `(subject:"next steps" OR subject:"following up" OR subject:"update on your" OR subject:shortlisted OR subject:"moved forward" OR subject:"further process" OR subject:"keep you posted" OR subject:"application status" OR subject:"background check" OR subject:"reference check" OR subject:"document verification" OR subject:"joining confirmation") newer_than:${days}d -subject:newsletter -subject:unsubscribe` },
      ];

      const results = await Promise.allSettled(
        QUERIES.map(({ label, q }) =>
          fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(q)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          ).then(async r => {
            if (r.status === 401) {
              // Token expired mid-scan — clear cache
              try { sessionStorage.removeItem(`gtoken_acct_${account.email}`); } catch { }
              throw new Error("Token expired");
            }
            const d = await r.json();
            return { label, messages: d.messages || [] };
          }).catch(() => ({ label, messages: [] }))
        )
      );

      const allMessages = [];
      for (const r of results) {
        if (r.status === "fulfilled") {
          allMessages.push(...r.value.messages.map(m => ({ ...m, category: r.value.label, fromAccount: account.email })));
        }
      }

      if (!allMessages.length) {
        setGmailScanProgress(p => ({ ...p, [account.email]: "done_empty" }));
        return { account: account.email, found: 0, emails: [] };
      }

      const details = await Promise.allSettled(
        allMessages.slice(0, 60).map(msg =>
          fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }
          ).then(r => r.json()).then(data => {
            const hdrs = data.payload?.headers || [];
            const get = n => hdrs.find(h => h.name === n)?.value || "";
            const body = extractEmailBody(data.payload);
            return { id: msg.id, subject: get("Subject"), from: get("From"), date: get("Date"), snippet: data.snippet || "", body, category: msg.category, fromAccount: msg.fromAccount };
          }).catch(() => null)
        )
      );

      const emails = details.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
      setGmailScanProgress(p => ({ ...p, [account.email]: emails.length > 0 ? "done" : "done_empty" }));
      return { account: account.email, found: emails.length, emails };
    } catch (scanErr) {
      setGmailScanProgress(p => ({ ...p, [account.email]: "error" }));
      console.error(`Scan error for ${account.email}:`, scanErr.message);
      return { account: account.email, found: 0, emails: [], error: scanErr.message };
    }
  }

  async function startMultiAccountScan() {
    if (!clientId) return notify("Add Google Client ID in ⚙️ Settings", "err");
    if (gmailAccounts.length === 0) return startGmailScan(); // fallback to single scan

    setGmailLoading(true);
    setGmailEmails([]);
    setGmailStats(null);
    // Show every account as "scanning" from the first frame
    const _initProgress = {};
    gmailAccounts.forEach(a => { _initProgress[a.email] = "scanning"; });
    setGmailScanProgress(_initProgress);
    setGmailStatus({ msg: "Scanning " + gmailAccounts.length + " account" + (gmailAccounts.length > 1 ? "s" : "") + " in parallel…", type: "loading" });

    const combined = [];
    let errorCount = 0;

    // Scan all accounts simultaneously — typically 3-4× faster
    const _scanResults = await Promise.allSettled(
      gmailAccounts.map(acc => scanSingleAccount(acc))
    );
    _scanResults.forEach((r, i) => {
      const acc = gmailAccounts[i];
      if (r.status === "fulfilled") {
        if (r.value?.emails?.length) combined.push(...r.value.emails);
        if (r.value?.error) { errorCount++; }
      } else {
        errorCount++;
        if (acc) setGmailScanProgress(p => ({ ...p, [acc.email]: "error" }));
      }
    });

    if (!combined.length) {
      const msg = errorCount > 0
        ? `Scan had errors on ${errorCount} account(s). Try removing and re-adding them.`
        : `No job-related emails found in the last ${gmailDays} days.`;
      setGmailStatus({ msg, type: errorCount > 0 ? "error" : "success" });
      setGmailLoading(false);
      return;
    }

    // Deduplicate
    const seen = new Set();
    const deduped = combined.filter(e => {
      const key = `${e.subject}|${e.from}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    setGmailStatus({ msg: `Analyzing ${deduped.length} emails with AI…`, type: "loading" });

    try {
      const text = await AI(
        `You are analyzing job-related emails from a candidate's Gmail. Each email includes subject, from, snippet, body (up to 800 chars of actual email content), and a pre-detected category hint.

Classify each email into exactly one status using these rules:
- "Applied": Confirmation the application was received or submitted (no interview scheduled yet). Keywords: "application received", "thank you for applying", "we've received your resume".
- "Screening": A recruiter reached out, or there is an invite/link for a phone screen, online test, coding challenge, or aptitude test. Keywords: recruiter, phone screen, hackerrank, codility, assessment, online test.
- "Interview Scheduled": An interview has been confirmed with a specific date/time/link. Keywords: "interview scheduled", "interview confirmed", "calendar invite", "zoom link", "meet at", "your interview is on".
- "Interview Done": Post-interview follow-up or feedback/thank-you after the interview has already taken place. Keywords: "thank you for interviewing", "it was a pleasure speaking", "next steps after our interview".
- "Offer Received": A job offer, offer letter, CTC/salary details, or appointment letter. Keywords: "offer letter", "pleased to offer", "compensation", "ctc", "appointment letter", "joining date", "onboarding".
- "Rejected": A decline or rejection email. Keywords: "unfortunately", "not moving forward", "not selected", "we regret", "other candidates", "position has been filled", "not shortlisted".
- "Pending": Cannot clearly determine status from the content — general updates, "we'll be in touch", or ambiguous follow-ups.

Extract these fields for each email:
- company: sender's company name (from "from" field or email body)
- jobTitle: job role or position title mentioned in subject/body
- status: one of the 7 statuses above
- interviewDate: ISO date (YYYY-MM-DD) if mentioned, else ""
- interviewTime: time string if mentioned, else ""
- interviewType: "Phone" | "Video" | "In-person" | "Technical" | "" based on context
- sender: the "from" value
- date: email date as-is
- snippet: the snippet value
- subject: the subject value
- fromAccount: the fromAccount value

Return ONLY a valid JSON array with one object per email. No markdown, no explanation.

Emails:
${JSON.stringify(deduped)}`,
        "Return only a valid JSON array, no markdown, no extra text."
      );
      const match = text.replace(/```json|```/g, "").trim().match(/\[[\s\S]*\]/);
      const emails = match ? JSON.parse(match[0]) : [];

      if (emails.length) {
        setGmailEmails(emails);
        const stats = {
          total: emails.length,
          applied: emails.filter(e => e.status === "Applied").length,
          interview: emails.filter(e => e.status?.includes("Interview")).length,
          offer: emails.filter(e => e.status?.includes("Offer")).length,
          rejected: emails.filter(e => e.status === "Rejected").length,
          pending: emails.filter(e => e.status === "Pending" || e.status === "Screening").length,
        };
        setGmailStats(stats);
        setGmailRows(emails.map((e, i) => ({
          id: i + 1,
          date: e.date?.split("T")[0] || "",
          company: e.company || "",
          jobTitle: e.jobTitle || "",
          status: e.status || "Applied",
          interviewDate: e.interviewDate || "",
          interviewTime: e.interviewTime || "",
          interviewType: e.interviewType || "",
          notes: e.snippet || "",
          fromAccount: e.fromAccount || "",
        })));
        setGmailStatus({
          msg: `✓ Found ${emails.length} job email${emails.length !== 1 ? "s" : ""} across ${gmailAccounts.length} account${gmailAccounts.length > 1 ? "s" : ""}`,
          type: "success"
        });
      } else {
        setGmailStatus({ msg: "✓ Scan complete — no structured job emails found.", type: "success" });
      }
    } catch (aiErr) {
      // AI failed but we still have raw emails — show them without AI parsing
      setGmailEmails(deduped.map(e => ({
        company: e.from?.match(/^"?([^"<@]+)/)?.[1]?.trim() || "Unknown",
        jobTitle: e.subject || "Position",
        status: emailCategoryToStatus(e.category),
        sender: e.from,
        date: e.date,
        snippet: e.snippet,
        subject: e.subject,
        fromAccount: e.fromAccount,
      })));
      setGmailStatus({ msg: `✓ Found ${deduped.length} emails (AI analysis failed — showing raw results)`, type: "success" });
    }

    setGmailLoading(false);
  }

  // ── Gmail Scanner ─────────────────────────────────────────────────────
  async function startGmailScan() {
    setGmailLoading(true); setGmailEmails([]); setGmailStats(null);
    setGmailStatus({ msg: "Authorizing Gmail…", type: "loading" });
    try {
      const token = await getGoogleToken("https://www.googleapis.com/auth/gmail.readonly", session, clientId);
      await fetchAndParseEmails(token);
    } catch (err) { setGmailStatus({ msg: "Error: " + err.message, type: "error" }); setGmailLoading(false); }
  }

  async function fetchAndParseEmails(token) {
    try {
      setGmailStatus({ msg: "Searching inbox across 6 categories…", type: "loading" });
      const days = gmailDays || "30";
      const extra = gmailExtra ? ` ${gmailExtra}` : "";

      // 6 targeted queries run in parallel — same coverage as multi-account scan
      const SINGLE_QUERIES = [
        { label: "Interview Scheduled",
          q: `(subject:interview OR subject:"invite you" OR subject:"next round" OR subject:"schedule a call" OR subject:"interview confirmed" OR subject:"interview invite" OR subject:"interview details" OR subject:"technical interview" OR subject:"hr round" OR subject:"round 1" OR subject:"round 2" OR subject:"joining date" OR subject:"we would like to meet" OR subject:"video interview" OR subject:"telephonic interview") newer_than:${days}d -subject:newsletter -subject:unsubscribe -subject:"password reset" -subject:OTP -subject:"verify your email"${extra}` },
        { label: "Offer Received",
          q: `(subject:"offer letter" OR subject:"job offer" OR subject:"pleased to offer" OR subject:"congratulations" OR subject:"selected for" OR subject:"we are excited" OR subject:"offer accepted" OR subject:"joining formalities" OR subject:"onboarding" OR subject:"welcome to the team" OR subject:"appointment letter" OR subject:"ctc" OR subject:"compensation letter") newer_than:${days}d -subject:newsletter -subject:unsubscribe${extra}` },
        { label: "Rejected",
          q: `(subject:"unfortunately" OR subject:"not moving forward" OR subject:"not selected" OR subject:"other candidates" OR subject:"regret to inform" OR subject:"will not be proceeding" OR subject:"decided not to" OR subject:"position has been filled" OR subject:"not shortlisted" OR subject:"better suited" OR subject:"not be considered" OR subject:"not in a position") newer_than:${days}d -subject:newsletter -subject:unsubscribe${extra}` },
        { label: "Applied",
          q: `(subject:"application received" OR subject:"thank you for applying" OR subject:"application submitted" OR subject:"application confirmation" OR subject:"we received your" OR subject:"successfully applied" OR subject:"your application" OR subject:"application acknowledged" OR subject:"applied for" OR subject:"resume received" OR subject:"candidature received" OR subject:"application for the role") newer_than:${days}d -subject:newsletter -subject:unsubscribe -subject:"password reset" -subject:"verify your"${extra}` },
        { label: "Screening",
          q: `(subject:"phone screen" OR subject:"screening call" OR subject:"initial call" OR subject:"introductory call" OR subject:recruiter OR subject:"coding challenge" OR subject:assessment OR subject:"take-home" OR subject:"online test" OR subject:"hackerrank" OR subject:"codility" OR subject:"aptitude test" OR subject:"written test" OR subject:"technical test" OR subject:"pre-screening" OR subject:"profile shortlisted" OR subject:"shortlisted for interview" OR subject:"merit list" OR subject:"hackerearth") newer_than:${days}d -subject:newsletter -subject:unsubscribe${extra}` },
        { label: "Follow-up",
          q: `(subject:"next steps" OR subject:"following up" OR subject:"update on your" OR subject:shortlisted OR subject:"moved forward" OR subject:"further process" OR subject:"keep you posted" OR subject:"application status" OR subject:"background check" OR subject:"reference check" OR subject:"document verification" OR subject:"joining confirmation") newer_than:${days}d -subject:newsletter -subject:unsubscribe${extra}` },
      ];

      const queryResults = await Promise.allSettled(
        SINGLE_QUERIES.map(({ label, q }) =>
          fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(q)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          ).then(r => r.json()).then(data => ({ label, messages: data.messages || [] }))
          .catch(() => ({ label, messages: [] }))
        )
      );

      // Collect all message IDs with their detected category; deduplicate by message id
      const seen = new Set();
      const allMessages = [];
      for (const r of queryResults) {
        if (r.status === "fulfilled") {
          for (const m of r.value.messages) {
            if (!seen.has(m.id)) { seen.add(m.id); allMessages.push({ ...m, category: r.value.label }); }
          }
        }
      }

      if (!allMessages.length) {
        setGmailStatus({ msg: `No job-related emails found in the last ${days} days.`, type: "success" });
        setGmailLoading(false);
        return;
      }

      setGmailStatus({ msg: `Reading ${Math.min(allMessages.length, 60)} emails…`, type: "loading" });

      // Fetch full email content (format=full) so AI gets body text, not just a 100-char snippet
      const details = await Promise.allSettled(
        allMessages.slice(0, 60).map(msg =>
          fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }
          ).then(r => r.json()).then(data => {
            const hdrs = data.payload?.headers || [];
            const get = n => hdrs.find(h => h.name === n)?.value || "";
            const body = extractEmailBody(data.payload);
            return { subject: get("Subject"), sender: get("From"), date: get("Date"), snippet: data.snippet || "", body, category: msg.category };
          }).catch(() => null)
        )
      );

      const payload = details.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
      if (!payload.length) {
        setGmailStatus({ msg: "✓ Scan complete. Could not read email details.", type: "success" });
        setGmailLoading(false);
        return;
      }

      setGmailStatus({ msg: `Analyzing ${payload.length} emails with AI…`, type: "loading" });

      const text = await AI(
        `You are analyzing job-related emails from a candidate's Gmail. Each email includes subject, sender, snippet, body (up to 800 chars of actual email content), and a pre-detected category hint.

Classify each email into exactly one status using these rules:
- "Applied": Confirmation the application was received or submitted (no interview scheduled yet). Keywords: "application received", "thank you for applying", "we've received your resume".
- "Screening": A recruiter reached out, or there is an invite/link for a phone screen, online test, coding challenge, or aptitude test. Keywords: recruiter, phone screen, hackerrank, codility, assessment, online test.
- "Interview Scheduled": An interview has been confirmed with a specific date/time/link. Keywords: "interview scheduled", "interview confirmed", "calendar invite", "zoom link", "meet at", "your interview is on".
- "Interview Done": Post-interview follow-up or feedback/thank-you after the interview has already taken place. Keywords: "thank you for interviewing", "it was a pleasure speaking", "next steps after our interview".
- "Offer Received": A job offer, offer letter, CTC/salary details, or appointment letter. Keywords: "offer letter", "pleased to offer", "compensation", "ctc", "appointment letter", "joining date", "onboarding".
- "Rejected": A decline or rejection email. Keywords: "unfortunately", "not moving forward", "not selected", "we regret", "other candidates", "position has been filled", "not shortlisted".
- "Pending": Cannot clearly determine status from the content — general updates, "we'll be in touch", or ambiguous follow-ups.

Extract these fields for each email:
- company: sender's company name (from "sender" field or email body)
- jobTitle: job role or position title mentioned in subject/body
- status: one of the 7 statuses above
- interviewDate: ISO date (YYYY-MM-DD) if mentioned, else ""
- interviewTime: time string if mentioned, else ""
- interviewType: "Phone" | "Video" | "In-person" | "Technical" | "" based on context
- sender: the "sender" value
- date: the "date" value
- snippet: the "snippet" value
- subject: the "subject" value
- category: the "category" value

Return ONLY a valid JSON array with one object per email. No markdown, no explanation.

Emails:
${JSON.stringify(payload)}`,
        "Return only a valid JSON array, no markdown, no extra text."
      );
      const match = text.replace(/```json|```/g, "").trim().match(/\[[\s\S]*\]/);
      const emails = match ? JSON.parse(match[0]) : [];
      if (emails.length) {
        setGmailEmails(emails);
        const stats = {
          total: emails.length,
          applied: emails.filter(e => e.status === "Applied").length,
          interview: emails.filter(e => e.status?.includes("Interview")).length,
          offer: emails.filter(e => e.status?.includes("Offer")).length,
          rejected: emails.filter(e => e.status === "Rejected").length,
          pending: emails.filter(e => e.status === "Pending" || e.status === "Screening").length,
        };
        setGmailStats(stats);
        setGmailRows(emails.map((e, i) => ({ id: i + 1, date: e.date ? e.date.split("T")[0] : "", company: e.company || "", jobTitle: e.jobTitle || "", status: e.status || "Applied", interviewDate: e.interviewDate || "", interviewTime: e.interviewTime || "", interviewType: e.interviewType || "", notes: e.snippet || "" })));
        setGmailStatus({ msg: `✓ Found ${emails.length} job-related emails`, type: "success" });
      } else {
        // AI returned nothing — show raw results with pre-detected categories mapped to valid statuses
        setGmailEmails(payload.map(e => ({
          company: e.sender?.match(/^"?([^"<@]+)/)?.[1]?.trim() || "Unknown",
          jobTitle: e.subject || "Position",
          status: emailCategoryToStatus(e.category),
          sender: e.sender,
          date: e.date,
          snippet: e.snippet,
          subject: e.subject,
        })));
        const rawStats = {
          total: payload.length,
          applied: payload.filter(e => e.category === "Applied").length,
          interview: payload.filter(e => e.category === "Interview Scheduled").length,
          offer: payload.filter(e => e.category === "Offer Received").length,
          rejected: payload.filter(e => e.category === "Rejected").length,
          pending: payload.filter(e => e.category === "Screening" || e.category === "Follow-up").length,
        };
        setGmailStats(rawStats);
        setGmailStatus({ msg: `✓ Found ${payload.length} emails (showing raw — AI analysis failed)`, type: "success" });
      }
    } catch (err) { setGmailStatus({ msg: "Error: " + err.message, type: "error" }); }
    setGmailLoading(false);
  }

  async function addGmailToTracker(email) {
    const payload = { title: email.jobTitle || "Position", company: email.company || "", location: "", type: "Full-time", salary: "", skills: "", source: "Gmail", applylink: "", status: email.status === "Interview Scheduled" ? "Interview" : email.status === "Offer Received" ? "Offer" : email.status === "Rejected" ? "Rejected" : "Applied", applieddate: email.date ? email.date.split("T")[0] : "", deadline: "", notes: email.snippet || "", priority: "Medium", user_id: session.user.id };
    const { error } = await supabase.from("jobs").insert([payload]);
    if (!error) { fetchJobs(); notify(`"${email.company}" added ✓`); }
  }

  // ── Excel ─────────────────────────────────────────────────────────────
  function exportXLSX() {
    const { wb, filename } = generateBeautifulExcel(jobs);
    XLSX.writeFile(wb, filename);
    notify(`Downloaded ${filename} ✓`);
  }

  async function exportAndSaveToDrive() {
    try {
      notify("Connecting to Drive…");
      const token = await getGoogleToken("https://www.googleapis.com/auth/drive.file", session, clientId);
      const { wb, filename } = generateBeautifulExcel(jobs);
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      await saveFileToDrive(filename, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", token);
      notify(`"${filename}" saved to Drive → JobBoard Pro folder ✓`);
    } catch (err) { notify("Drive: " + err.message, "err"); }
  }

  function importXLSX(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 });
        let hr = aoa.findIndex(r => r && r.some && r.some(c => typeof c === "string" && c.match(/Company|Role|Title/i)));
        if (hr === -1) hr = 0;
        const headers = aoa[hr] || [];
        const data = [];
        for (let R = hr + 1; R < aoa.length; ++R) {
          const rowArr = aoa[R];
          if (!rowArr || !rowArr.some(c => c)) continue;
          const obj = {}; headers.forEach((h, C) => { if (h) obj[h] = rowArr[C]; }); data.push(obj);
        }
        const mapped = data.map(r => ({ title: r["Job Title"] || r.title || "Untitled", company: r.Company || r.company || "", location: r.Location || r.location || "", type: r.Type || r.type || "Full-time", salary: r.Salary || r.salary || "", skills: r.Skills || r.skills || "", source: r.Source || r.source || "Import", applylink: r["Apply Link"] || r.applylink || "", status: r.Status || r.status || "Bookmarked", priority: r.Priority || r.priority || "Medium", applieddate: r["Applied Date"] || r.applieddate || "", deadline: r.Deadline || r.deadline || "", notes: r.Notes || r.notes || "", user_id: session.user.id }));
        const newJobs = []; let skipped = 0;
        mapped.forEach(r => { const isDup = jobs.some(j => j.title?.toLowerCase() === r.title?.toLowerCase() && j.company?.toLowerCase() === r.company?.toLowerCase()); if (isDup) skipped++; else newJobs.push(r); });
        if (!newJobs.length) { notify(`All ${skipped} jobs already exist`); return; }
        const doBatches = async () => {
          // Batch at 100 rows — safe for any Supabase plan, supports unlimited total rows
          const BATCH = 100;
          let inserted = 0, failed = 0;
          for (let i = 0; i < newJobs.length; i += BATCH) {
            const { error } = await supabase.from("jobs").insert(newJobs.slice(i, i + BATCH));
            if (error) { failed += Math.min(BATCH, newJobs.length - i); }
            else { inserted += Math.min(BATCH, newJobs.length - i); }
          }
          fetchJobs();
          const msg = `Imported ${inserted} jobs ✓${failed > 0 ? ` (${failed} failed)` : ""}${skipped > 0 ? ` (${skipped} skipped as duplicates)` : ""}`;
          notify(msg, failed > 0 ? "err" : "ok");
        };
        doBatches();
      } catch { notify("Import failed — check file format", "err"); }
    };
    reader.readAsArrayBuffer(file); e.target.value = "";
  }

  async function addToCalendar(job) {
    const dt = prompt(`Interview date/time for ${job.company} (e.g. 2026-03-25T14:00):`, job.deadline ? `${job.deadline}T09:00` : "");
    if (!dt) return;
    try {
      const token = await getGoogleToken("https://www.googleapis.com/auth/calendar.events", session, clientId);
      const startObj = dt.includes("T") ? { dateTime: new Date(dt).toISOString() } : { date: dt };
      const endObj = dt.includes("T") ? { dateTime: new Date(new Date(dt).getTime() + 3600000).toISOString() } : { date: dt };
      const event = { summary: `Interview: ${job.company} – ${job.title}`, description: `Role: ${job.title}\nLink: ${job.applylink || "none"}`, start: startObj, end: endObj };
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(event) });
      if (!res.ok) throw new Error("Failed to create event");
      notify("Added to Google Calendar ✓");
    } catch (err) { notify("Calendar: " + err.message, "err"); }
  }

  async function saveToDrive(filename, content) {
    try {
      const token = await getGoogleToken("https://www.googleapis.com/auth/drive.file", session, clientId);
      await saveFileToDrive(filename, content, "text/plain", token);
      notify(`Saved to Drive → JobBoard Pro ✓`);
    } catch (err) { notify("Drive: " + err.message, "err"); }
  }

  // ── Filter / Sort ─────────────────────────────────────────────────────
  const baseVisible = jobs.filter(j => filterType === "All" || j.type === filterType).filter(j => filterPri === "All" || j.priority === filterPri).filter(j => !q || (j.title + j.company + j.skills + j.location).toLowerCase().includes(q.toLowerCase()));
  const visible = baseVisible.filter(j => filterStatus === "All" || j.status === filterStatus).sort((a, b) => { let av = sortK === "id" ? a.id : (a[sortK] ?? ""), bv = sortK === "id" ? b.id : (b[sortK] ?? ""); return sortD === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1); });
  function toggleSort(k) { if (sortK === k) setSortD(d => d === "asc" ? "desc" : "asc"); else { setSortK(k); setSortD("asc"); } }
  const sIcon = k => sortK === k ? (sortD === "asc" ? "↑" : "↓") : <span style={{ opacity: .2 }}>↕</span>;
  const stats = STATUS.reduce((a, s) => { a[s] = baseVisible.filter(j => j.status === s).length; return a; }, {});
  const overdue = jobs.filter(j => j.deadline && daysDiff(j.deadline) < 0 && !["Rejected", "Withdrawn", "Offer"].includes(j.status)).length;
  const soonDue = jobs.filter(j => j.deadline && daysDiff(j.deadline) >= 0 && daysDiff(j.deadline) <= 7 && !["Rejected", "Withdrawn", "Offer"].includes(j.status)).length;
  const filteredGmail = gmailEmails.filter(e => gmailFilter === "all" || e.status === gmailFilter);
  const needFollowup=jobs.filter(j=>j.status==="Applied"&&j.applieddate&&Math.abs(daysDiff(j.applieddate))>=7).length;
  const activeFilters = [sLocation, sJobType !== "all" ? sJobType : "", sSalaryMin, sCategory, sExperience].filter(Boolean).length;
  const profileComplete = [profile.full_name, profile.skills, profile.headline].filter(Boolean).length;

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#040c18", minHeight: "100vh", color: "#e2e8f0" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:#070f1c}::-webkit-scrollbar-thumb{background:#1e2d45;border-radius:4px}
        @keyframes mi{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .row:hover td{background:rgba(255,255,255,0.015)!important}.row td{transition:background .1s}
        .kb-drop{transition:background .15s,border-color .15s}.kb-drop.over{background:#0a1628!important;border-color:#4f46e5!important}
        .hbtn{transition:all .15s}.hbtn:hover{opacity:.75;transform:scale(1.05)}
        .email-card{transition:all .2s}.email-card:hover{border-color:#2563eb!important;transform:translateX(3px)}
        .gtab{padding:5px 13px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid rgba(99,150,210,0.2);background:transparent;color:#64748b;font-family:inherit;transition:all .2s}
        .gtab:hover{border-color:#06b6d4;color:#06b6d4}.gtab.active{background:#2563eb;border-color:#2563eb;color:#fff}
        .chip{padding:4px 11px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid #1e2d45;background:#070f1c;color:#64748b;font-family:inherit;transition:all .15s}
        .chip:hover{border-color:#818cf8;color:#818cf8}.chip.active{background:rgba(79,70,229,0.15);border-color:#4f46e5;color:#a5b4fc}
        .nav-tab{background:none;border:none;border-bottom:2px solid transparent;color:#334155;padding:12px 16px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:6px;font-family:inherit;white-space:nowrap}
        .nav-tab:hover{color:#64748b}.nav-tab.active{border-bottom-color:#4f46e5;color:#818cf8}
        .search-card{background:#06101e;border:1px solid #0f1c2e;border-radius:14px;padding:16px;transition:all .2s}
        .search-card:hover{border-color:#1e2d45;background:#07111f}
        input::placeholder{color:#334155}textarea::placeholder{color:#334155}select option{background:#070f1c}
      `}</style>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={importXLSX} />
      <input ref={resumeRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: "none" }} onChange={handleResumeFile} />

      {/* Toast */}
      {toast && <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: toast.t === "err" ? "#2d0a0a" : "#061a0f", border: `1px solid ${toast.t === "err" ? "#7f1d1d" : "#14532d"}`, color: toast.t === "err" ? "#fca5a5" : "#6ee7b7", padding: "11px 18px", borderRadius: 12, fontSize: 13, animation: "mi .2s ease", maxWidth: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16 }}>{toast.t === "err" ? "⚠️" : "✓"}</span>{toast.m}
      </div>}

      {/* HEADER */}
      <div style={{ background: "#050d1a", borderBottom: "1px solid #0a1628", padding: "14px 24px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, maxWidth: 1480, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#1d4ed8,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🎯</div>
            <div>
              <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 19, fontWeight: 800, margin: 0, background: "linear-gradient(90deg,#60a5fa,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>JobBoard Pro</h1>
              <p style={{ color: "#1e2d45", fontSize: 9, marginTop: 1, letterSpacing: "0.05em" }}>Search · Track · Profile · Reports</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
            {profile.full_name && <span style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>👤 {profile.full_name.split(" ")[0]}</span>}
            <Btn onClick={() => setShowAutoApplyLog(true)} v="amb" sx={{ position: 'relative' }}>
              ⚡ Applied {appliedJobs.length > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: 999, padding: '1px 5px', fontSize: 9, fontWeight: 700 }}>
                  {appliedJobs.length}
                </span>
              )}
            </Btn>
            <Btn v="vio" onClick={()=>{setShowURLScraper(true);setScrapeURL("");setScrapeResult(null);setScrapeError("");}}>🔗 Import URL</Btn>
            <Btn onClick={() => handleGmailMultiScan(false)} sx={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', color:'#a5b4fc', gap:6 }}>📧 Scan Gmail</Btn>
            <Btn onClick={() => setShowSearch(true)} v="cyn" sx={{ position: "relative" }}>
              🔍 Find Jobs
              {sr.length > 0 && <span style={{ background: "#06b6d4", color: "#fff", borderRadius: 999, padding: "1px 5px", fontSize: 9, fontWeight: 700, marginLeft: 2 }}>{sr.length}</span>}
            </Btn>
            {sheetsSpreadsheetId && sheetsEnabled && (
              <Btn onClick={() => syncToGoogleSheets()} disabled={sheetsSyncing} v="vio" sx={{ fontSize: 11, padding: "7px 12px" }}>
                {sheetsSyncing ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Syncing…</> : "📝 Notion"}
              </Btn>
            )}
            <Btn onClick={() => setShowSettings(true)} v="ghost">⚙️</Btn>
            <Btn onClick={() => supabase.auth.signOut()} v="red">⏏️</Btn>
            <div style={{ width: 1, height: 20, background: "#1e2d45" }} />
            <Btn onClick={openAdd} v="pri">＋ Add Job</Btn>
            <Btn onClick={() => fileRef.current.click()} v="ghost">📂 Import</Btn>
            <Btn onClick={exportXLSX} v="grn">📥 Excel</Btn>
            <Btn onClick={exportAndSaveToDrive} v="vio">☁️ Drive</Btn>
          </div>
        </div>
      </div>

      {/* ALERT BAR */}
      {(overdue > 0 || soonDue > 0 || needFollowup > 0) && <div style={{ background: "#050d1a", borderBottom: "1px solid #0a1628", padding: "7px 24px" }}>
        <div style={{ maxWidth: 1480, margin: "0 auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
          {overdue > 0 && <span style={{ background: "rgba(220,38,38,0.08)", border: "1px solid #7f1d1d", color: "#f87171", padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>🔴 {overdue} deadline{overdue > 1 ? "s" : ""} overdue</span>}
          {soonDue > 0 && <span style={{ background: "rgba(245,158,11,0.08)", border: "1px solid #78350f", color: "#fbbf24", padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>⏰ {soonDue} due this week</span>}
          {needFollowup>0&&<span style={{background:"rgba(139,92,246,0.08)",border:"1px solid rgba(34,197,94,0.3)",color:"#4ade80",padding:"3px 12px",borderRadius:999,fontSize:11,fontWeight:700}}>📨 {needFollowup} need follow-up (7+ days)</span>}
          {autoReport && <span style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8", padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>📧 Auto-report ON at {reportTime}</span>}
        </div>
      </div>}

      {/* ── LOGIN WELCOME SUMMARY BANNER ── */}
      {loginSummary.visible && (
        <div style={{ background: 'linear-gradient(90deg,rgba(79,70,229,0.12),rgba(6,182,212,0.08))', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12, padding: '14px 24px', margin: "0 auto", maxWidth: 1480, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
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

      {/* STATUS FILTER */}
      <div style={{ background: "#050d1a", borderBottom: "1px solid #0a1628", padding: "9px 24px" }}>
        <div style={{ maxWidth: 1480, margin: "0 auto", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {[["All", baseVisible.length, "#60a5fa"], ...STATUS.map(s => [s, stats[s], SC[s].dot])].map(([s, c, col]) => (
              <button key={s} onClick={() => setFS(s)} style={{ background: filterStatus === s ? `${col}18` : "transparent", border: `1px solid ${filterStatus === s ? col : "#1e2d45"}`, borderRadius: 8, padding: "4px 12px", color: filterStatus === s ? "#f1f5f9" : "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all .15s", fontFamily: "inherit" }}>
                {s} <span style={{ color: col, fontWeight: 700 }}>{c}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={filterType} onChange={e => setFT(e.target.value)} style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "5px 10px", color: filterType !== "All" ? "#a5b4fc" : "#64748b", fontSize: 11, outline: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <option value="All">All Types</option>{TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={filterPri} onChange={e => setFP(e.target.value)} style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "5px 10px", color: filterPri !== "All" ? "#a5b4fc" : "#64748b", fontSize: 11, outline: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <option value="All">All Priorities</option>{["High", "Medium", "Low"].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: "#050d1a", borderBottom: "1px solid #0a1628", padding: "0 24px", overflowX: "auto" }}>
        <div style={{ maxWidth: 1480, margin: "0 auto", display: "flex" }}>
          {[["table", "📋 Table"], ["kanban", "🗂 Kanban"], ["analytics", "📊 Analytics"], ["gmail", "📧 Gmail"], ["profile", "👤 Profile"], ["resume", "📄 Resume"], ["reports", "📨 Reports"], ["calendar", "📅 Calendar"]].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} className={`nav-tab${tab === t ? " active" : ""}`}>
              {l}
              {t === "profile" && profileComplete < 3 && <span style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24", padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>Setup</span>}
              {t === "reports" && autoReport && <span style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#86efac", padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>ON</span>}
              {t === "gmail" && <span style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", color: "#06b6d4", padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>AI</span>}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1480, margin: "0 auto", padding: "22px 24px" }}>

        {/* TABLE */}
        {tab === "table" && <>
          {/* Search bar + result count */}
          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none", opacity: .4 }}>🔍</span>
              <Inp value={q} onChange={e => setQ(e.target.value)} placeholder="Search title, company, skills, location…" sx={{ paddingLeft: 34 }} />
            </div>
            <span style={{ color: "#334155", fontSize: 12 }}>
              {jobs.length > 0 && <span style={{ color: "#475569" }}>{jobs.length} total · </span>}
              {visible.length} shown
            </span>
            {q && <button onClick={() => setQ("")} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>✕ Clear</button>}
            <Btn onClick={openAdd} v="pri" sx={{ marginLeft: "auto" }}>＋ Add Job</Btn>
          </div>

          {/* ── Bulk action toolbar (slides in when rows are selected) ── */}
          {selected.size > 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "rgba(79,70,229,0.1)", border: "1px solid rgba(79,70,229,0.35)", borderRadius: 12, padding: "10px 16px", marginBottom: 12, animation: "mi .15s ease" }}>
              <span style={{ color: "#a5b4fc", fontWeight: 700, fontSize: 13, marginRight: 4 }}>
                ☑ {selected.size} selected
              </span>
              {/* Bulk Status */}
              <select value={bulkStatus} onChange={e => { setBulkStatus(e.target.value); if (e.target.value) bulkSetStatus(e.target.value); }}
                style={{ background: "#0a1628", border: "1px solid #1e2d45", borderRadius: 8, padding: "6px 10px", color: bulkStatus ? "#e2e8f0" : "#475569", fontSize: 11, cursor: "pointer", outline: "none", fontFamily: "inherit" }}>
                <option value="">Set Status…</option>
                {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {/* Bulk Priority */}
              <select value={bulkPriority} onChange={e => { setBulkPriority(e.target.value); if (e.target.value) bulkSetPriority(e.target.value); }}
                style={{ background: "#0a1628", border: "1px solid #1e2d45", borderRadius: 8, padding: "6px 10px", color: bulkPriority ? "#e2e8f0" : "#475569", fontSize: 11, cursor: "pointer", outline: "none", fontFamily: "inherit" }}>
                <option value="">Set Priority…</option>
                {["High", "Medium", "Low"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <Btn v="grn" onClick={bulkExport} sx={{ padding: "6px 12px", fontSize: 11 }}>📥 Export Selected</Btn>
              <Btn v="red" onClick={bulkDelete} sx={{ padding: "6px 12px", fontSize: 11 }}>🗑 Delete {selected.size}</Btn>
              <button onClick={clearSelection} style={{ background: "transparent", border: "none", color: "#475569", cursor: "pointer", fontSize: 12, marginLeft: "auto", fontFamily: "inherit" }}>✕ Deselect all</button>
            </div>
          )}

          <div style={{ overflowX: "auto", borderRadius: 14, border: "1px solid #0a1628" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#06101e", borderBottom: "1px solid #0a1628" }}>
                  {/* Checkbox — select all */}
                  <th style={{ padding: "10px 8px 10px 14px", width: 36 }}>
                    <input type="checkbox"
                      checked={visible.length > 0 && selected.size === visible.length}
                      ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < visible.length; }}
                      onChange={toggleSelectAll}
                      style={{ cursor: "pointer", accentColor: "#4f46e5", width: 14, height: 14 }} />
                  </th>
                  {[["title", "Role", 200], ["company", "Company", 120], ["location", "Location", 95], ["salary", "Salary", 90], ["status", "Status", 130], ["priority", "Pri", 60], ["deadline", "Deadline", 105], ["applieddate", "Applied", 80], ["", "Actions", 170]].map(([k, h, w]) => (
                    <th key={h} onClick={k ? () => toggleSort(k) : undefined}
                      style={{ padding: "10px 13px", color: "#334155", fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", textAlign: "left", cursor: k ? "pointer" : "default", minWidth: w, userSelect: "none" }}>
                      {h}{k && <span style={{ marginLeft: 3 }}>{sIcon(k)}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: "center", padding: "60px", color: "#1e2d45" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                    <div style={{ fontSize: 13, color: "#334155" }}>No jobs match your filters</div>
                  </td></tr>
                )}
                {visible.map(job => {
                  const isSelected = selected.has(job.id);
                  return (
                    <tr key={job.id} className="row"
                      style={{ borderBottom: "1px solid #06101e", background: isSelected ? "rgba(79,70,229,0.07)" : undefined, transition: "background .1s" }}>
                      {/* Checkbox */}
                      <td style={{ padding: "11px 8px 11px 14px" }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(job.id)}
                          style={{ cursor: "pointer", accentColor: "#4f46e5", width: 14, height: 14 }} />
                      </td>
                      {/* Role */}
                      <td style={{ padding: "11px 13px" }}>
                        <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                          {job.applylink
                            ? <a href={job.applylink} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "none" }}>{job.title}</a>
                            : job.title}
                        </div>
                        {job.skills && <div style={{ color: "#334155", fontSize: 10 }}>{job.skills.split(",").slice(0, 3).join(" · ")}</div>}
                        {profile.skills && <MatchBadge score={calcMatchScore(job.skills, profile.skills)} />}
                        {job.status==="Applied"&&job.applieddate&&Math.abs(daysDiff(job.applieddate))>=7&&(
                          <span style={{marginLeft:6,background:"rgba(139,92,246,0.15)",border:"1px solid rgba(34,197,94,0.3)",color:"#4ade80",padding:"1px 6px",borderRadius:999,fontSize:9,fontWeight:700}}>📨 Follow up</span>
                        )}
                      </td>
                      <td style={{ padding: "11px 13px", color: "#94a3b8", fontWeight: 500 }}>{job.company}</td>
                      <td style={{ padding: "11px 13px", color: "#475569", whiteSpace: "nowrap", fontSize: 11 }}>{job.location}</td>
                      <td style={{ padding: "11px 13px", color: "#4ade80", whiteSpace: "nowrap", fontWeight: 600 }}>{job.salary || "—"}</td>
                      {/* Status with inline dropdown */}
                      <td style={{ padding: "11px 13px" }}>
                        <Badge s={job.status} />
                        <select value={job.status} onChange={e => setStatus(job.id, e.target.value)}
                          style={{ display: "block", marginTop: 4, background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 6, padding: "2px 6px", color: "#475569", fontSize: 10, cursor: "pointer", outline: "none", width: "100%", fontFamily: "inherit" }}>
                          {STATUS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "11px 13px" }}><PriBadge p={job.priority} /></td>
                      {/* Deadline with inline date edit */}
                      <td style={{ padding: "11px 13px" }}>
                        <Deadline date={job.deadline} />
                        <input type="date" defaultValue={job.deadline || ""} title="Edit deadline"
                          onBlur={async e => {
                            const val = e.target.value;
                            if (val !== (job.deadline || "")) {
                              await supabase.from("jobs").update({ deadline: val || null }).eq("id", job.id);
                              fetchJobs();
                              notify("Deadline updated ✓");
                            }
                          }}
                          style={{ display: "block", marginTop: 3, background: "transparent", border: "none", borderBottom: "1px solid #1e2d45", color: "#334155", fontSize: 9, fontFamily: "inherit", outline: "none", cursor: "pointer", width: "100%" }} />
                      </td>
                      <td style={{ padding: "11px 13px", color: "#334155", fontSize: 10, whiteSpace: "nowrap" }}>{fmtDate(job.applieddate)}</td>
                      {/* Actions */}
                      <td style={{ padding: "11px 13px" }}>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          {[
                            ["👁", "Details", () => setShowDetail(job)],
                            job.status === "Interview" ? ["🎙", "AI Prep", () => generateInterviewPrep(job)] : ["📋", "Guide", () => doPrep(job)],
                            job.status === "Applied" ? ["📧", "Follow-up", () => generateFollowUp(job)] : null,
                            ["✉", "Cover", () => { setShowCover(job); setCoverOut(""); }],
                            ["⚡","Auto Apply",() => autoApplyToJob(job)],
                            ["📅", "Calendar", () => addToCalendar(job)],
                            ["📋", "Duplicate", () => duplicateJob(job)],
                            ["✏️", "Edit", () => openEdit(job)],
                            ["🗑", "Delete", () => delJob(job.id)],
                          ].filter(Boolean).map(([ic, tt, fn]) => (
                            <button key={tt} onClick={fn} title={tt} className="hbtn"
                              style={{
                                background: tt === 'Delete' ? 'rgba(220,38,38,0.07)' : tt === 'Auto Apply' ? 'rgba(234,179,8,0.07)' : '#070f1c',
                                border: `1px solid ${tt === 'Delete' ? '#450a0a' : tt === 'Auto Apply' ? 'rgba(234,179,8,0.2)' : '#1e2d45'}`,
                                borderRadius: 7, padding: '4px 6px',
                                color: tt === 'Delete' ? '#f87171' : tt === 'Auto Apply' ? '#fde047' : '#64748b',
                                cursor: 'pointer', fontSize: 11,
                                opacity: autoApplying === job.id ? 0.5 : 1,
                              }}>
                              {autoApplying === job.id && tt === 'Auto Apply' ? <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>◌</span> : ic}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer summary */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px 0", flexWrap: "wrap", gap: 8 }}>
            <span style={{ color: "#1e2d45", fontSize: 11 }}>
              {visible.length} shown · {jobs.length} total stored
              {selected.size > 0 && <span style={{ color: "#a5b4fc", marginLeft: 8 }}>· {selected.size} selected</span>}
            </span>
            {selected.size > 0 && (
              <div style={{ display: "flex", gap: 6 }}>
                <Btn v="grn" onClick={bulkExport} sx={{ padding: "5px 10px", fontSize: 11 }}>📥 Export {selected.size}</Btn>
                <Btn v="red" onClick={bulkDelete} sx={{ padding: "5px 10px", fontSize: 11 }}>🗑 Delete {selected.size}</Btn>
              </div>
            )}
          </div>
        </>}

        {/* KANBAN */}
        {tab === "kanban" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(195px,1fr))", gap: 14 }}>
          {STATUS.map(col => {
            const cj = baseVisible.filter(j => j.status === col); const c = SC[col];
            return <div key={col} className="kb-drop" style={{ background: "#06101e", border: `1px solid ${c.border}20`, borderTop: `3px solid ${c.border}`, borderRadius: 14, padding: 14, minHeight: 170 }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("over"); }}
              onDragLeave={e => e.currentTarget.classList.remove("over")}
              onDrop={e => { e.currentTarget.classList.remove("over"); if (dragId.current) { setStatus(dragId.current, col); dragId.current = null; } }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ color: c.text, fontWeight: 700, fontSize: 10, letterSpacing: "0.08em" }}>{col.toUpperCase()}</span>
                <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{cj.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cj.map(job => (
                  <div key={job.id} draggable onDragStart={() => dragId.current = job.id}
                    style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: 10, cursor: "grab" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = c.border}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#1e2d45"}>
                    <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 12, lineHeight: 1.4, marginBottom: 3 }}>{job.title}</div>
                    <div style={{ color: "#475569", fontSize: 11, marginBottom: 5 }}>{job.company}</div>
                    <Deadline date={job.deadline} />
                    <div style={{ marginTop: 8, display: "flex", gap: 4, alignItems: "center" }}>
                      <PriBadge p={job.priority} />
                      <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                        {job.applylink && <a href={job.applylink} target="_blank" rel="noreferrer" style={{ background: "#1d4ed8", borderRadius: 6, padding: "2px 7px", color: "#fff", textDecoration: "none", fontSize: 9, fontWeight: 700 }}>Apply ↗</a>}
                        <button onClick={() => doPrep(job)} className="hbtn" style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 6, padding: "2px 6px", color: "#64748b", cursor: "pointer", fontSize: 10 }}>🎙</button>
                        <button onClick={() => openEdit(job)} className="hbtn" style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 6, padding: "2px 6px", color: "#64748b", cursor: "pointer", fontSize: 10 }}>✏️</button>
                      </div>
                    </div>
                  </div>
                ))}
                {cj.length === 0 && <div style={{ color: "#1e2d45", fontSize: 11, textAlign: "center", padding: "24px 0", border: "1px dashed #1e2d45", borderRadius: 10 }}>Drop here</div>}
              </div>
            </div>;
          })}
        </div>}

        {/* ANALYTICS */}
        {tab === "analytics" && <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 12, marginBottom: 20 }}>
            <StatCard label="Total" value={baseVisible.length} color="#60a5fa" icon="📋" />
            <StatCard label="Active" value={baseVisible.filter(j => !["Rejected", "Withdrawn"].includes(j.status)).length} color="#86efac" icon="✅" />
            <StatCard label="Interviews" value={stats.Interview || 0} color="#22c55e" icon="🎙" />
            <StatCard label="Offers" value={stats.Offer || 0} color="#fde047" icon="🏆" />
            <StatCard label="Response Rate" value={baseVisible.length ? `${Math.round(((stats.Interview || 0) + (stats.Offer || 0) + (stats.Rejected || 0)) / baseVisible.length * 100)}%` : "0%"} color="#c084fc" icon="📈" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 16 }}>
            <div style={{ background: "#06101e", border: "1px solid #0a1628", borderRadius: 14, padding: 20 }}>
              <div style={{ color: "#334155", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 16 }}>APPLICATIONS BY STATUS</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={STATUS.map(s => ({ name: s.slice(0, 6), val: stats[s] || 0 }))} margin={{ left: -24 }}>
                  <XAxis dataKey="name" tick={{ fill: "#334155", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#334155", fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 10, fontSize: 11 }} />
                  <Bar dataKey="val" radius={[5, 5, 0, 0]}>{STATUS.map((s, i) => <Cell key={i} fill={SC[s].dot} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: "#06101e", border: "1px solid #0a1628", borderRadius: 14, padding: 20 }}>
              <div style={{ color: "#334155", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 16 }}>DISTRIBUTION</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ResponsiveContainer width="50%" height={160}>
                  <PieChart>
                    <Pie data={STATUS.filter(s => stats[s] > 0).map(s => ({ name: s, value: stats[s] }))} cx="50%" cy="50%" innerRadius={38} outerRadius={66} paddingAngle={3} dataKey="value">
                      {STATUS.filter(s => stats[s] > 0).map((s, i) => <Cell key={i} fill={SC[s].dot} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 10, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {STATUS.filter(s => stats[s] > 0).map(s => (
                    <div key={s} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: SC[s].dot, flexShrink: 0 }} /><span style={{ color: "#64748b", fontSize: 11 }}>{s}</span></div>
                      <span style={{ color: SC[s].dot, fontWeight: 700, fontSize: 14 }}>{stats[s]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ background: "#06101e", border: "1px solid #0a1628", borderRadius: 14, padding: 20 }}>
              <div style={{ color: "#334155", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 16 }}>PRIORITY BREAKDOWN</div>
              {["High", "Medium", "Low"].map(p => {
                const cnt = baseVisible.filter(j => j.priority === p).length;
                const pct = baseVisible.length ? Math.round(cnt / baseVisible.length * 100) : 0;
                const col = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e" }[p];
                return <div key={p} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: "#64748b", fontSize: 12 }}>{p}</span><span style={{ color: col, fontWeight: 700, fontSize: 12 }}>{cnt} <span style={{ color: "#334155", fontWeight: 400 }}>({pct}%)</span></span></div>
                  <div style={{ background: "#0a1628", borderRadius: 999, height: 6 }}><div style={{ background: col, width: `${pct}%`, height: "100%", borderRadius: 999, transition: "width .5s" }} /></div>
                </div>;
              })}
            </div>
          </div>
        </div>}

        {/* GMAIL */}
        {tab === "gmail" && <div>
          {/* ── Connected Gmail Accounts Panel ── */}
          <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ color: "#06b6d4", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 10 }}>
                📧 Connected Gmail Accounts
                <span style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", padding: "2px 8px", borderRadius: 999, fontSize: 10 }}>{gmailAccounts.length} account{gmailAccounts.length !== 1 ? "s" : ""}</span>
              </div>
              <Btn v="cyn" onClick={addGmailAccount} disabled={addingAccount || !clientId} sx={{ gap: 6, padding: "8px 16px" }}>
                {addingAccount ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Connecting…</> : "＋ Add Gmail Account"}
              </Btn>
            </div>

            {!clientId && (
              <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#fbbf24", marginBottom: 12 }}>
                ⚠️ Add your Google Client ID in ⚙️ Settings to connect Gmail accounts.
              </div>
            )}

            {gmailAccounts.length === 0 && clientId && (
              <div style={{ background: "#070f1c", border: "1px dashed #1e2d45", borderRadius: 12, padding: "28px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
                <div style={{ color: "#475569", fontSize: 13, marginBottom: 6 }}>No Gmail accounts connected yet</div>
                <div style={{ color: "#334155", fontSize: 11, marginBottom: 16 }}>Add one or more Gmail accounts to scan for job emails</div>
                <Btn v="cyn" onClick={addGmailAccount} disabled={addingAccount} sx={{ margin: "0 auto" }}>
                  {addingAccount ? "Connecting…" : "＋ Connect Your First Gmail"}
                </Btn>
              </div>
            )}

            {gmailAccounts.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {gmailAccounts.map(acc => {
                  const progress = gmailScanProgress[acc.email];
                  const progColor = progress === "done" ? "#22c55e" : progress === "error" ? "#ef4444" : progress === "scanning" ? "#f59e0b" : progress === "done_empty" ? "#475569" : progress === "skipped" ? "#f59e0b" : "#334155";
                  const progLabel = progress === "done" ? "✓ Scanned" : progress === "error" ? "✗ Error" : progress === "scanning" ? "Scanning…" : progress === "done_empty" ? "No matches" : progress === "skipped" ? "⚠ Skipped" : "Ready";
                  return (
                    <div key={acc.id} style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, transition: "border-color .2s", borderColor: progress === "scanning" ? "#f59e0b" : progress === "done" ? "rgba(34,197,94,0.3)" : "#1e2d45" }}>
                      {/* Avatar */}
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#1d4ed8,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0, overflow: "hidden" }}>
                        {acc.picture
                          ? <img src={acc.picture} alt={acc.email} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
                          : acc.email.charAt(0).toUpperCase()}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.name || acc.email}</div>
                        <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>{acc.email}</div>
                      </div>
                      {/* Status badge */}
                      <span style={{ background: `${progColor}18`, border: `1px solid ${progColor}40`, color: progColor, padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}>
                        {progress === "scanning" && <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span>}
                        {progLabel}
                      </span>
                      {/* Remove */}
                      <button onClick={() => removeGmailAccount(acc.id)} title="Remove account" style={{ background: "rgba(220,38,38,0.07)", border: "1px solid #450a0a", color: "#f87171", borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✕</button>
                    </div>
                  );
                })}

                {/* Info note */}
                <div style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#a5b4fc", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ flexShrink: 0 }}>🔐</span>
                  <span><strong>To add a 2nd Gmail account:</strong> Click <em>+ Add Gmail Account</em> — a Google account-picker popup will appear. Select the account you want to add (or click "Use another account" to sign in to a new one). Tokens are cached after adding so subsequent scans run silently without extra popups. If the account is already connected, remove it first and re-add it to refresh the token.</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Scan Controls ── */}
          <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22, marginBottom: 20 }}>
            <div style={{ color: "#06b6d4", fontWeight: 700, fontSize: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              🔍 Scan Gmail for Job Emails
              <span style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", padding: "2px 8px", borderRadius: 999, fontSize: 10 }}>Gmail API + AI</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <input type="number" value={gmailDays} onChange={e => setGmailDays(e.target.value)} min="1" max="365" placeholder="Days" style={{ width: 90, background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              <input value={gmailExtra} onChange={e => setGmailExtra(e.target.value)} placeholder="Extra keywords (optional)…" style={{ flex: 1, minWidth: 200, background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              {gmailAccounts.length > 0 ? (
                <Btn v="cyn" onClick={startMultiAccountScan} disabled={gmailLoading} sx={{ fontWeight: 700 }}>
                  {gmailLoading
                    ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Scanning…</>
                    : `⚡ Scan All ${gmailAccounts.length} Account${gmailAccounts.length > 1 ? "s" : ""}`}
                </Btn>
              ) : (
                <Btn v="cyn" onClick={startGmailScan} disabled={gmailLoading}>
                  {gmailLoading ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Scanning…</> : "⚡ Scan Gmail"}
                </Btn>
              )}
              <Btn v="ghost" onClick={() => {
                setGmailEmails([]); setGmailStats(null);
                setGmailStatus({ msg: "Cleared.", type: "" });
                setGmailScanProgress({});
                setGmailRows([{ id: 1, date: "", company: "", jobTitle: "", status: "Applied", interviewDate: "", interviewTime: "", interviewType: "", notes: "" }]);
              }}>✕ Clear</Btn>
            </div>

            {/* Per-account progress */}
            {gmailLoading && gmailAccounts.length > 1 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {gmailAccounts.map(acc => {
                  const p = gmailScanProgress[acc.email];
                  const col = p === "done" ? "#22c55e" : p === "error" ? "#ef4444" : p === "scanning" ? "#f59e0b" : p === "skipped" ? "#f59e0b" : "#334155";
                  return (
                    <div key={acc.id} style={{ background: `${col}12`, border: `1px solid ${col}30`, borderRadius: 8, padding: "4px 12px", fontSize: 11, color: col, display: "flex", alignItems: "center", gap: 6 }}>
                      {p === "scanning" && <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block", fontSize: 10 }}>◌</span>}
                      {p === "done" ? "✓" : (p === "error" ? "✗" : (p === "skipped" ? "⚠" : "○"))} {acc.email.split("@")[0]}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: "12px 16px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, minHeight: 44, display: "flex", alignItems: "center", gap: 10, color: gmailStatus.type === "error" ? "#ef4444" : gmailStatus.type === "success" ? "#10b981" : gmailStatus.type === "loading" ? "#f59e0b" : "#06b6d4" }}>
              {gmailStatus.type === "loading" && <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block", flexShrink: 0 }}>◌</span>}
              {gmailStatus.msg}
            </div>
          </div>
          {gmailStats && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10, marginBottom: 20 }}>
            {[["Found", gmailStats.total, "#60a5fa"], ["Applied", gmailStats.applied, "#f59e0b"], ["Interviews", gmailStats.interview, "#06b6d4"], ["Offers", gmailStats.offer, "#10b981"], ["Rejected", gmailStats.rejected, "#ef4444"], ["Pending", gmailStats.pending, "#8b5cf6"]].map(([l, v, c]) => (
              <div key={l} style={{ background: "#06101e", border: "1px solid #0a1628", borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
                <div style={{ color: c, fontSize: 28, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>{v}</div>
                <div style={{ color: "#334155", fontSize: 10, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
              </div>
            ))}
          </div>}
          {gmailEmails.length > 0 && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ color: "#94a3b8", fontWeight: 700, fontSize: 14 }}>📨 Email Results</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[["all", "All"], ["Interview Scheduled", "Interviews"], ["Offer Received", "Offers"], ["Rejected", "Rejected"], ["Applied", "Applied"]].map(([v, l]) => (
                <button key={v} className={`gtab${gmailFilter === v ? " active" : ""}`} onClick={() => setGmailFilter(v)}>{l}</button>
              ))}
            </div>
          </div>}
          {filteredGmail.map((email, i) => {
            const sc = GMAIL_STATUS_COLORS[email.status] || GMAIL_STATUS_COLORS["Pending"];
            return <div key={i} className="email-card" style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 14, padding: 16, marginBottom: 10, borderLeft: `3px solid ${sc.accent}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: sc.lb, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{(email.company || "?").substring(0, 2).toUpperCase()}</div>
                  <div><div style={{ fontWeight: 700, fontSize: 14 }}>{email.company || "Unknown"}</div><div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{email.jobTitle || email.subject || "Position"}</div></div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ background: sc.bg, color: sc.fg, padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>{email.status}</span>
                  <Btn v="grn" onClick={() => addGmailToTracker(email)} sx={{ padding: "5px 11px", fontSize: 11 }}>+ Add to Tracker</Btn>
                </div>
              </div>
              {email.snippet && <div style={{ color: "#8eafd0", fontSize: 13, marginBottom: 8, lineHeight: 1.6 }}>{email.snippet}</div>}
              {email.interviewDate && <div style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 8, padding: "7px 12px", marginBottom: 8, fontSize: 12, color: "#60a5fa", fontWeight: 600 }}>📅 {email.interviewDate}{email.interviewTime && ` at ${email.interviewTime}`}{email.interviewType && ` — ${email.interviewType}`}</div>}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {email.sender && <span style={{ fontSize: 11, color: "#475569" }}>📧 {email.sender}</span>}
                {email.date && <span style={{ fontSize: 11, color: "#475569" }}>🗓 {email.date}</span>}
                {email.fromAccount && <span style={{ fontSize: 10, color: "#334155", background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", padding: "1px 8px", borderRadius: 999 }}>📧 {email.fromAccount}</span>}
              </div>
            </div>;
          })}
          <div style={{ marginTop: 20 }}>
            <div style={{ color: "#94a3b8", fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📋 Application Tracker</div>
            <div style={{ overflowX: "auto", borderRadius: 14, border: "1px solid #0a1628" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "#06101e", borderBottom: "1px solid #0a1628" }}>{["#", "Account", "Date", "Company", "Job Title", "Status", "Interview Date", "Time", "Type", "Notes"].map(h => <th key={h} style={{ padding: "9px 12px", color: "#334155", fontWeight: 700, fontSize: 10, letterSpacing: "0.07em", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {gmailRows.map((row, i) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #06101e" }}>
                      <td style={{ padding: "8px 12px", color: "#334155", fontSize: 11 }}>{row.id}</td>
                      <td style={{ padding: "4px 10px" }}>
                        {row.fromAccount ? (
                          <span style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", color: "#06b6d4", padding: "2px 8px", borderRadius: 999, fontSize: 10, whiteSpace: "nowrap" }}>
                            {row.fromAccount.split("@")[0]}
                          </span>
                        ) : <span style={{ color: "#334155", fontSize: 10 }}>—</span>}
                      </td>
                      {["date", "company", "jobTitle"].map(k => <td key={k} style={{ padding: "4px 8px" }}><input value={row[k]} onChange={e => setGmailRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: e.target.value } : r))} placeholder={k === "date" ? "YYYY-MM-DD" : k} style={{ background: "transparent", border: "none", color: "#e2e8f0", fontFamily: "inherit", fontSize: 12, width: k === "jobTitle" ? 160 : k === "company" ? 130 : 110, outline: "none" }} /></td>)}
                      <td style={{ padding: "4px 8px" }}><select value={row.status} onChange={e => setGmailRows(rs => rs.map((r, j) => j === i ? { ...r, status: e.target.value } : r))} style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 6, padding: "3px 6px", color: "#e2e8f0", fontSize: 11, cursor: "pointer", outline: "none", fontFamily: "inherit" }}>{["Applied", "Screening", "Interview Scheduled", "Interview Done", "Offer Received", "Accepted", "Rejected", "Withdrawn"].map(s => <option key={s}>{s}</option>)}</select></td>
                      {["interviewDate", "interviewTime", "interviewType", "notes"].map(k => <td key={k} style={{ padding: "4px 8px" }}><input value={row[k]} onChange={e => setGmailRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: e.target.value } : r))} placeholder={k === "interviewType" ? "Video/Phone" : k === "notes" ? "Notes…" : ""} style={{ background: "transparent", border: "none", color: "#e2e8f0", fontFamily: "inherit", fontSize: 12, width: k === "notes" ? 200 : 100, outline: "none" }} /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setGmailRows(rs => [...rs, { id: rs.length + 1, date: "", company: "", jobTitle: "", status: "Applied", interviewDate: "", interviewTime: "", interviewType: "", notes: "" }])} style={{ width: "100%", marginTop: 10, background: "rgba(16,185,129,0.06)", border: "1px dashed rgba(16,185,129,0.25)", color: "#10b981", borderRadius: 10, padding: "10px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>＋ Add Row</button>
          </div>
        </div>}

        {/* PROFILE */}
        {tab === "profile" && <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800, color: "#f1f5f9", margin: 0 }}>👤 Your Profile</h2>
              <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>Upload your resume to auto-fill. Profile powers AI cover letters, job matching & interview prep.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn v="ghost" onClick={() => resumeRef.current.click()}>📎 Upload Resume</Btn>
              <Btn v="pri" onClick={saveProfile} disabled={profileSaving}>{profileSaving ? "Saving…" : "💾 Save Profile"}</Btn>
            </div>
          </div>

          {/* Resume Parser */}
          <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                📄 Resume Parser
                <span style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#4ade80", padding: "2px 8px", borderRadius: 999, fontSize: 10 }}>AI-Powered + PDF.js</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn v="ghost" onClick={() => resumeRef.current.click()} sx={{ fontSize: 11 }}>📎 Upload PDF/TXT</Btn>
                <Btn v="vio" onClick={parseResume} disabled={resumeParsing || !resumeText.trim()}>{resumeParsing ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Parsing…</> : "⚡ Parse Resume"}</Btn>
              </div>
            </div>
            <Txt value={resumeText} onChange={e => setResumeText(e.target.value)} placeholder="Upload a PDF/TXT above, or paste your resume text here…

PDF.js is used for accurate text extraction from PDF files.
After uploading/pasting, click Parse Resume to auto-fill your profile." rows={7} sx={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }} />
            <div style={{ marginTop: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#8b5cf6" }}>
              💡 Supports text-based PDFs, TXT files, and pasted text. Your skills are used for <strong>job match scoring</strong> and personalized AI responses.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 14, padding: 18 }}>
              <div style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Personal Info</div>
              <F label="Full Name"><Inp value={profile.full_name || ""} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} placeholder="Your name" /></F>
              <F label="Email"><Inp value={profile.email || ""} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" /></F>
              <F label="Phone"><Inp value={profile.phone || ""} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" /></F>
              <F label="Location"><Inp value={profile.location || ""} onChange={e => setProfile(p => ({ ...p, location: e.target.value }))} placeholder="City, State" /></F>
              <F label="LinkedIn"><Inp value={profile.linkedin || ""} onChange={e => setProfile(p => ({ ...p, linkedin: e.target.value }))} placeholder="linkedin.com/in/…" /></F>
              <F label="GitHub"><Inp value={profile.github || ""} onChange={e => setProfile(p => ({ ...p, github: e.target.value }))} placeholder="github.com/…" /></F>
            </div>
            <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 14, padding: 18 }}>
              <div style={{ color: "#4ade80", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Professional</div>
              <F label="Headline"><Inp value={profile.headline || ""} onChange={e => setProfile(p => ({ ...p, headline: e.target.value }))} placeholder="e.g. Software Engineer | React & Python" /></F>
              <F label="Summary"><Txt value={profile.summary || ""} onChange={e => setProfile(p => ({ ...p, summary: e.target.value }))} placeholder="2-3 sentence professional summary…" rows={3} /></F>
              <F label="Skills" hint={profile.skills ? `${profile.skills.split(",").filter(s => s.trim()).length} skills` : ""}><Txt value={profile.skills || ""} onChange={e => setProfile(p => ({ ...p, skills: e.target.value }))} placeholder="React, Python, SQL, Node.js…" rows={3} /></F>
              <F label="Certifications"><Inp value={profile.certifications || ""} onChange={e => setProfile(p => ({ ...p, certifications: e.target.value }))} placeholder="AWS, Google Cloud, etc." /></F>
            </div>
            <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 14, padding: 18 }}>
              <div style={{ color: "#86efac", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Background</div>
              <F label="Education"><Txt value={profile.education || ""} onChange={e => setProfile(p => ({ ...p, education: e.target.value }))} placeholder="B.E. Computer Science — 2026" rows={3} /></F>
              <F label="Experience"><Txt value={profile.experience || ""} onChange={e => setProfile(p => ({ ...p, experience: e.target.value }))} placeholder="Intern @ Company (Jun–Aug 2025)&#10;Project: …" rows={4} /></F>
              <F label="Languages"><Inp value={profile.languages || ""} onChange={e => setProfile(p => ({ ...p, languages: e.target.value }))} placeholder="English, Tamil, Hindi" /></F>
            </div>
            <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 14, padding: 18 }}>
              <div style={{ color: "#fde047", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Job Preferences</div>
              <F label="Target Roles"><Inp value={profile.target_roles || ""} onChange={e => setProfile(p => ({ ...p, target_roles: e.target.value }))} placeholder="Software Engineer, Data Analyst…" /></F>
              <F label="Target Locations"><Inp value={profile.target_locations || ""} onChange={e => setProfile(p => ({ ...p, target_locations: e.target.value }))} placeholder="Chennai, Bangalore, Remote" /></F>
              <F label="Expected Salary"><Inp value={profile.expected_salary || ""} onChange={e => setProfile(p => ({ ...p, expected_salary: e.target.value }))} placeholder="₹6–8 LPA" /></F>
              <F label="Portfolio"><Inp value={profile.portfolio || ""} onChange={e => setProfile(p => ({ ...p, portfolio: e.target.value }))} placeholder="yoursite.dev" /></F>
              {profile.skills && <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1e2d45" }}>
                <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Your Skills ({profile.skills.split(",").filter(s => s.trim()).length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {profile.skills.split(",").filter(s => s.trim()).map(sk => <span key={sk} style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{sk.trim()}</span>)}
                </div>
              </div>}
            </div>
          </div>
          {/* Projects */}
          <div style={{background:"#06101e",border:"1px solid #1e2d45",borderRadius:16,padding:22,marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{color:"#fde047",fontSize:13,fontWeight:700}}>🚀 Projects</div>
              <Btn v="amb" onClick={()=>setProfile(p=>({...p,projects:[...(p.projects||[]),{name:"",description:"",tech:"",url:""}]}))}>＋ Add Project</Btn>
            </div>
            {(profile.projects||[]).map((proj,i)=>(
              <div key={i} style={{background:"#070f1c",border:"1px solid #1e2d45",borderRadius:12,padding:16,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{color:"#fde047",fontSize:11,fontWeight:700}}>Project {i+1}{proj.name?` — ${proj.name}`:""}</span>
                  <button onClick={()=>setProfile(p=>({...p,projects:(p.projects||[]).filter((_,j)=>j!==i)}))} style={{background:"rgba(220,38,38,0.08)",border:"1px solid #450a0a",color:"#f87171",borderRadius:7,padding:"3px 8px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>✕ Remove</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}>
                  <F label="Project Name"><Inp value={proj.name||""} onChange={e=>setProfile(p=>{const projects=[...(p.projects||[])];projects[i]={...projects[i],name:e.target.value};return{...p,projects};})} placeholder="My App"/></F>
                  <F label="Tech Stack"><Inp value={proj.tech||""} onChange={e=>setProfile(p=>{const projects=[...(p.projects||[])];projects[i]={...projects[i],tech:e.target.value};return{...p,projects};})} placeholder="React, Node.js"/></F>
                </div>
                <F label="URL"><Inp value={proj.url||""} onChange={e=>setProfile(p=>{const projects=[...(p.projects||[])];projects[i]={...projects[i],url:e.target.value};return{...p,projects};})} placeholder="https://github.com/…"/></F>
                <F label="Description"><Txt value={proj.description||""} onChange={e=>setProfile(p=>{const projects=[...(p.projects||[])];projects[i]={...projects[i],description:e.target.value};return{...p,projects};})} placeholder="What it does, what you built…" rows={2}/></F>
              </div>
            ))}
            {(!profile.projects||profile.projects.length===0)&&<div style={{color:"#1e2d45",fontSize:12,textAlign:"center",padding:"20px",border:"1px dashed #1e2d45",borderRadius:10}}>No projects yet — click "Add Project"</div>}
          </div>
          <Btn v="pri" onClick={saveProfile} disabled={profileSaving} sx={{ width: "100%", justifyContent: "center", padding: "13px", fontSize: 14 }}>{profileSaving ? "Saving…" : "💾 Save Profile"}</Btn>
        </div>}

        {/* RESUME */}
        {tab === 'resume' && (
          <ResumeBuilder
            profile={profile}
            callAI={AI}
            notify={notify}
            onSaveProfile={async (updatedData) => {
              setProfile(p => ({ ...p, ...updatedData }));
              await supabase.from('profiles').upsert({
                ...updatedData, id: session.user.id, updated_at: new Date().toISOString()
              });
              notify('Profile synced from resume ✓');
            }}
          />
        )}

        {/* REPORTS */}
        {tab === "reports" && <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800, color: "#f1f5f9", margin: 0 }}>📨 Automated Daily Reports</h2>
              <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>Progress report + job search digest sent to Gmail daily. Files saved to Google Drive → <strong>JobBoard Pro</strong> folder.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn v="ghost" onClick={previewReport}>👁 Preview</Btn>
              <div style={{ display: "flex", gap: 4, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "4px" }}>
                <Btn v="grn" onClick={downloadReport} sx={{ padding: "6px 12px", fontSize: 11 }}>📥 Excel</Btn>
                <Btn v="grn" onClick={downloadProgressPDFLocal} sx={{ padding: "6px 12px", fontSize: 11 }}>📄 PDF</Btn>
                <Btn v="grn" onClick={downloadProgressCSVLocal} sx={{ padding: "6px 12px", fontSize: 11 }}>📊 CSV</Btn>
              </div>
              <Btn v="vio" onClick={() => handleSendReport()} disabled={reportSending}>{reportSending ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Sending…</> : "📊 Send Progress Now"}</Btn>
              <Btn v="cyn" onClick={() => handleSendJobDigest()} disabled={digestSending}>{digestSending ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Fetching jobs…</> : "🔍 Send Job Digest Now"}</Btn>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22 }}>
                <div style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  📊 Progress Report
                  {autoReport && <span style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#86efac", padding: "1px 8px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>AUTO ON</span>}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Report Recipients</span>
                    <button onClick={addScannerEmail} style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#a5b4fc", borderRadius: 7, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700 }}>＋ Add Email</button>
                  </div>
                  {scannerEmails.length === 0 && (
                    <div style={{ background: "#070f1c", border: "1px dashed #1e2d45", borderRadius: 10, padding: "12px 16px", color: "#334155", fontSize: 12, textAlign: "center" }}>
                      No recipients — click "+ Add Email" to add one
                    </div>
                  )}
                  {scannerEmails.map((entry) => (
                    <ScannerEmailRow
                      key={entry.id}
                      entry={entry}
                      onUpdate={(email) => updateScannerEmail(entry.id, email)}
                      onRemove={() => removeScannerEmail(entry.id)}
                      onSendCode={() => sendVerificationEmail(entry.id)}
                      onConfirm={(code) => confirmVerifyCode(entry.id, code)}
                      isSending={emailTestSending === entry.id}
                    />
                  ))}
                  {scannerEmails.length > 0 && (
                    <button onClick={saveScannerEmails} style={{ width: "100%", marginTop: 8, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", color: "#86efac", borderRadius: 8, padding: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>💾 Save Recipients</button>
                  )}
                </div>
                <F label="Daily Send Time"><Inp value={reportTime} onChange={e => setReportTime(e.target.value)} type="time" /></F>
                <F label="Export Format">
                  <div style={{ display: "flex", gap: 8 }}>
                    {[["both", "Excel + PDF"], ["excel", "Excel Only"], ["pdf", "PDF Only"]].map(([v, l]) => (
                      <button key={v} onClick={() => setReportFormat(v)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: "1px solid " + (reportFormat === v ? "#4f46e5" : "#1e2d45"), background: reportFormat === v ? "rgba(79,70,229,0.15)" : "transparent", color: reportFormat === v ? "#a5b4fc" : "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
                    ))}
                  </div>
                </F>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
                  <div><div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>Auto Send Daily</div><div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>At {reportTime} every day</div></div>
                  <button onClick={() => setAutoReport(v => { localStorage.setItem("autoReport", String(!v)); return !v; })} style={{ width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", background: autoReport ? "#4f46e5" : "#1e2d45", position: "relative", transition: "background .2s" }}>
                    <span style={{ position: "absolute", top: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", left: autoReport ? "23px" : "3px" }} />
                  </button>
                </div>
                <div style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.12)", borderRadius: 10, padding: "11px 14px", fontSize: 11, color: "#06b6d4", lineHeight: 1.7 }}>
                  <strong>Includes:</strong> Status breakdown · Interviews · Deadlines · Recent apps · Priority stats<br />
                  <strong>Drive:</strong> Excel (5 sheets) + PDF report
                </div>
              </div>
              <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22, flex: 1 }}>
                <div style={{ color: "#4ade80", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>📋 Progress History</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {[["Sent", reportLog.length, "#60a5fa"], ["Jobs", jobs.length, "#86efac"], ["Interviews", stats.Interview || 0, "#22c55e"], ["Offers", stats.Offer || 0, "#fde047"]].map(([l, v, c]) => (
                    <div key={l} style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: "10px", textAlign: "center" }}>
                      <div style={{ color: c, fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>{v}</div>
                      <div style={{ color: "#334155", fontSize: 9, marginTop: 2, textTransform: "uppercase" }}>{l}</div>
                    </div>
                  ))}
                </div>
                {reportLog.length === 0 ? <div style={{ color: "#1e2d45", fontSize: 12, textAlign: "center", padding: "16px 0" }}>No reports sent yet</div> :
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
                    {reportLog.map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "8px 12px" }}>
                        <div><div style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 600 }}>{r.date}</div><div style={{ color: "#475569", fontSize: 9, marginTop: 1 }}>{r.time} · {r.jobs} jobs{r.isAuto ? " · auto" : ""}</div></div>
                        <span style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#86efac", padding: "2px 7px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>✓</span>
                      </div>
                    ))}
                  </div>}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22 }}>
                <div style={{ color: "#67e8f9", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  🔍 Daily Job Search Digest
                  {autoJobSearch && <span style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", padding: "1px 8px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>AUTO ON</span>}
                </div>
                <F label="Search Keywords" hint="blank = use profile target roles">
                  <Inp value={jobSearchKeywords} onChange={e => setJobSearchKeywords(e.target.value)} placeholder={profile.target_roles || "React developer, Python analyst"} />
                </F>
                <F label="Location" hint="blank = use profile location">
                  <Inp value={jobSearchLocation} onChange={e => setJobSearchLocation(e.target.value)} placeholder={profile.target_locations || profile.location || "Chennai, Bangalore, Remote"} />
                </F>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <F label="Max Jobs">
                    <select value={jobSearchResultCount} onChange={e => setJobSearchResultCount(e.target.value)} style={{ width: "100%", background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                      {["25", "50", "100", "150", "200"].map(v => <option key={v} value={v}>{v} jobs</option>)}
                    </select>
                  </F>
                  <F label="Export As">
                    <select value={jobSearchFormat} onChange={e => setJobSearchFormat(e.target.value)} style={{ width: "100%", background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                      <option value="both">Excel + PDF</option>
                      <option value="excel">Excel Only</option>
                      <option value="pdf">PDF Only</option>
                    </select>
                  </F>
                </div>
                <F label="Daily Send Time" hint={autoJobSearch ? "active" : "off"}>
                  <Inp value={jobSearchTime} onChange={e => setJobSearchTime(e.target.value)} type="time" />
                </F>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
                  <div><div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>Auto Daily Job Digest</div><div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>Searches + emails at {jobSearchTime}</div></div>
                  <button onClick={() => setAutoJobSearch(v => { localStorage.setItem("autoJobSearch", String(!v)); return !v; })} style={{ width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", background: autoJobSearch ? "#0e7490" : "#1e2d45", position: "relative", transition: "background .2s" }}>
                    <span style={{ position: "absolute", top: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", left: autoJobSearch ? "23px" : "3px" }} />
                  </button>
                </div>
                <div style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.12)", borderRadius: 10, padding: "11px 14px", fontSize: 11, color: "#06b6d4", lineHeight: 1.7 }}>
                  <strong>Email:</strong> Styled HTML with top matches highlighted · best match % · jobs posted today<br />
                  <strong>Drive sheets:</strong> All Jobs · Top Matches (50%+) · Posted Today · Summary
                </div>
              </div>

              <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22, flex: 1 }}>
                <div style={{ color: "#67e8f9", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>📋 Job Digest History</div>
                {lastDigestResults.length > 0 && (
                  <div style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                    <div style={{ color: "#475569", fontSize: 10, marginBottom: 8 }}>LAST DIGEST</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                      {[["Total", lastDigestResults.length, "#67e8f9"], ["Matches", lastDigestResults.filter(r => r.matchScore > 0).length, "#86efac"], ["Today", lastDigestResults.filter(r => (r.postedDaysAgo || 99) <= 1).length, "#fde047"]].map(([l, v, c]) => (
                        <div key={l} style={{ textAlign: "center", background: "#06101e", borderRadius: 8, padding: "8px" }}>
                          <div style={{ color: c, fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>{v}</div>
                          <div style={{ color: "#334155", fontSize: 9, marginTop: 2, textTransform: "uppercase" }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop: "1px solid #1e2d45", paddingTop: 10 }}>
                      <div style={{ color: "#475569", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>Download Last Digest</div>
                      <div style={{ display: "flex", gap: 5 }}>
                        <Btn v="cyn" onClick={downloadLastDigestExcel} sx={{ flex: 1, justifyContent: "center", padding: "7px 6px", fontSize: 10 }}>📥 Excel</Btn>
                        <Btn v="cyn" onClick={downloadLastDigestPDF} sx={{ flex: 1, justifyContent: "center", padding: "7px 6px", fontSize: 10 }}>📄 PDF</Btn>
                        <Btn v="cyn" onClick={downloadLastDigestCSV} sx={{ flex: 1, justifyContent: "center", padding: "7px 6px", fontSize: 10 }}>📊 CSV</Btn>
                      </div>
                    </div>
                  </div>
                )}
                {jobDigestLog.length === 0 ? <div style={{ color: "#1e2d45", fontSize: 12, textAlign: "center", padding: "16px 0" }}>No digests sent yet</div> :
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                    {jobDigestLog.map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "8px 12px" }}>
                        <div>
                          <div style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 600 }}>{r.date} · {r.count} jobs found</div>
                          <div style={{ color: "#475569", fontSize: 9, marginTop: 1 }}>{r.time} · {(r.keywords || "").slice(0, 28)}{r.isAuto ? " · auto" : ""}</div>
                        </div>
                        <span style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", padding: "2px 7px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>✓</span>
                      </div>
                    ))}
                  </div>}
              </div>
            </div>
          </div>

          <div style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ color: "#a5b4fc", fontSize: 12 }}>⚙️ Save keywords, times and format preferences</span>
            <Btn v="pri" onClick={saveSettings}>💾 Save All Settings</Btn>
          </div>
        </div>}

        {/* CALENDAR */}
        {tab === "calendar" && <Calendar jobs={jobs} session={session} notify={notify} />}

      </div>

      {/* ══════ MODALS ══════ */}

      {/* Auto Apply Log */}
      {showAutoApplyLog && (
        <Modal title="⚡ Auto-Apply Log" onClose={() => setShowAutoApplyLog(false)} wide>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>{appliedJobs.length} applications sent</span>
            <button onClick={() => { setAppliedJobs([]); localStorage.removeItem('autoAppliedJobs'); notify('Log cleared'); }}
              style={{ background: 'transparent', border: '1px solid #450a0a', color: '#f87171', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
              🗑 Clear Log
            </button>
          </div>
          {appliedJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#334155' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <p>No auto-applications yet. Click ⚡ on any job to auto-apply.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 500, overflowY: 'auto' }}>
              {appliedJobs.map((a, i) => (
                <div key={i} style={{ background: '#070f1c', border: '1px solid #1e2d45', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13 }}>{a.title} @ {a.company}</div>
                    <div style={{ color: '#475569', fontSize: 11, marginTop: 3 }}>
                      {new Date(a.appliedAt).toLocaleString()} · via {a.method} · {a.email}
                    </div>
                  </div>
                  <span style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac', padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                    ✓ Sent
                  </span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Settings */}
      {showSettings && <Modal title="⚙️ Settings" onClose={() => setShowSettings(false)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <F label="NVIDIA/DeepSeek API Key"><Inp type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="nvapi-…" /></F>
          <F label="API Proxy URL"><Inp value={proxyUrl} onChange={e => setProxyUrl(e.target.value)} placeholder="/api/ai" /></F>
          <F label="AI Model">
            <select
              value={AVAILABLE_MODELS.some(m => m.value === aiModel) ? aiModel : 'custom'}
              onChange={e => { if (e.target.value !== 'custom') setAiModel(e.target.value); }}
              style={{ width: '100%', background: '#070f1c', border: '1px solid #1e2d45', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', fontFamily: 'inherit', cursor: 'pointer', marginBottom: 6 }}
            >
              {AVAILABLE_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {(!AVAILABLE_MODELS.some(m => m.value === aiModel && m.value !== 'custom') || aiModel === 'custom') && (
              <Inp value={aiModel === 'custom' ? '' : aiModel} onChange={e => setAiModel(e.target.value)} placeholder="Enter exact model string e.g. meta/llama-3.1-70b-instruct" />
            )}
            <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
              Current: <span style={{ color: '#a5b4fc', fontFamily: 'monospace' }}>{aiModel}</span>
            </div>
          </F>
          <F label="Google Client ID" hint="For Gmail, Drive, Calendar"><Inp value={clientId} onChange={e => setClientId(e.target.value)} placeholder="…apps.googleusercontent.com" /></F>
          <F label="Report Email"><Inp type="email" value={reportEmail} onChange={e => setReportEmail(e.target.value)} placeholder="daily@email.com" /></F>
          <F label="Daily Send Time"><Inp type="time" value={reportTime} onChange={e => setReportTime(e.target.value)} /></F>
        </div>
        <div style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)", borderRadius: 10, padding: 16, margin: "14px 0" }}>
          <div style={{ color: "#06b6d4", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10 }}>🟢 ADZUNA JOB SEARCH</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <F label="App ID"><Inp value={adzunaId} onChange={e => setAdzunaId(e.target.value)} placeholder="538be205" /></F>
            <F label="App Key"><Inp type="password" value={adzunaKey} onChange={e => setAdzunaKey(e.target.value)} placeholder="your_app_key" /></F>
          </div>
        </div>
        {/* ── Notion Sync Settings ── */}
        <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.22)", borderRadius: 10, padding: 16, margin: "14px 0" }}>
          <div style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            📝 Notion Sync
            <span style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", padding: "1px 8px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>Vercel Free Plan ✓</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14, lineHeight: 1.7 }}>
            Export your jobs to a Notion database. Requires a Notion Integration Token and Database ID.
            {notionToken && notionDbId && <span style={{ display: "block", marginTop: 6, color: "#a78bfa", fontWeight: 700 }}>✓ Configured — ready to sync</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Integration Token</div>
              <input
                type="password"
                value={notionToken}
                onChange={e => setNotionToken(e.target.value.trim())}
                placeholder="secret_xxxxxxxxxxxx"
                style={{ width: "100%", background: "#070f1c", border: `1px solid ${notionToken ? "rgba(139,92,246,0.4)" : "#1e2d45"}`, borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              />
              <div style={{ fontSize: 9, color: "#475569", marginTop: 4 }}>notion.so/my-integrations → New integration → copy token</div>
            </div>
            <div>
              <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Database ID</div>
              <input
                type="text"
                value={notionDbId}
                onChange={e => setNotionDbId(e.target.value.trim().replace(/-/g, ""))}
                placeholder="32-char hex from DB URL"
                style={{ width: "100%", background: "#070f1c", border: `1px solid ${notionDbId ? "rgba(139,92,246,0.4)" : "#1e2d45"}`, borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              />
              <div style={{ fontSize: 9, color: "#475569", marginTop: 4 }}>URL: notion.so/DATABASE_ID?v=… → copy 32 chars</div>
            </div>
          </div>
          {notionToken && notionDbId && (
            <button
              onClick={() => syncToNotion()}
              disabled={sheetsSyncing}
              style={{ background: "linear-gradient(135deg,#4c1d95,#5b21b6)", border: "1px solid rgba(139,92,246,0.3)", color: "#c4b5fd", borderRadius: 8, padding: "9px 20px", cursor: sheetsSyncing ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              {sheetsSyncing ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Syncing…</> : `📝 Sync All ${jobs.length} Jobs to Notion Now`}
            </button>
          )}
          <div style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#64748b", lineHeight: 1.8 }}>
            <strong style={{ color: "#8b5cf6" }}>Quick Setup (3 steps):</strong><br/>
            1. <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" style={{ color: "#818cf8" }}>notion.so/my-integrations</a> → New integration → copy <em>Internal Integration Secret</em><br/>
            2. In Notion: open your DB → ··· → <em>Add connections</em> → select your integration<br/>
            3. Copy 32-char DB ID from URL: notion.so/<strong style={{ color: "#a78bfa" }}>xxxxxxxx…</strong>?v=…<br/>
            <strong style={{ color: "#8b5cf6" }}>Notion DB columns needed:</strong> Name (Title), Company, Status, Location, Salary, Priority, Skills, Apply Link, Applied Date, Deadline, Source, Notes
          </div>
          {!notionToken && (
            <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 10 }}>⚠️ Works on Vercel Free (Hobby) plan — uses a serverless proxy at /api/notion</div>
          )}
        </div>

        <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 10, padding: "14px 16px", marginBottom: 14, fontSize: 12, color: "#fbbf24", lineHeight: 1.8 }}>
          🔐 <strong>Google "Unverified App" warning?</strong><br />
          <span style={{ color: "#94a3b8" }}>
            Fix in 2 minutes: Go to{" "}
            <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>
              Google Cloud Console → OAuth Consent Screen
            </a>
            {" "}→ scroll to <strong>"Test users"</strong> → click <strong>"+ ADD USERS"</strong> → add your Gmail address → Save.<br />
            The warning disappears immediately for anyone you add (up to 100 emails).
          </span>
        </div>
        <div style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.12)", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
          ℹ️ Google features require the Client ID above. Each feature asks for permission once per session — Gmail scan asks for Gmail access, Drive export asks for Drive access, etc. After approving, the token is cached and no more popups appear.
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
          <div><div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>Auto Daily Report</div><div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>Checked every minute at {reportTime}</div></div>
          <button onClick={() => setAutoReport(v => !v)} style={{ width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", background: autoReport ? "#4f46e5" : "#1e2d45", position: "relative", transition: "background .2s" }}>
            <span style={{ position: "absolute", top: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", left: autoReport ? "23px" : "3px" }} />
          </button>
        </div>
        <Btn v="pri" onClick={saveSettings} sx={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: 13 }}>Save All Settings</Btn>
      </Modal>}

      {/* Report Preview */}
      {showReportPreview && <Modal title="👁 Report Preview" onClose={() => setShowReportPreview(false)} wide>
        <div style={{ background: "#040c18", borderRadius: 10, overflow: "hidden", maxHeight: 550, overflowY: "auto" }}>
          <iframe srcDoc={reportPreviewHTML} style={{ width: "100%", height: 600, border: "none", borderRadius: 10 }} title="Report Preview" />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Btn v="vio" onClick={() => handleSendReport()} disabled={reportSending}>{reportSending ? "Sending…" : "📧 Send This Report"}</Btn>
          <div style={{ display: "flex", gap: 4, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "4px" }}>
            <Btn v="grn" onClick={downloadReport} sx={{ padding: "6px 12px", fontSize: 11 }}>📥 Excel</Btn>
            <Btn v="grn" onClick={downloadProgressPDFLocal} sx={{ padding: "6px 12px", fontSize: 11 }}>📄 PDF</Btn>
            <Btn v="grn" onClick={downloadProgressCSVLocal} sx={{ padding: "6px 12px", fontSize: 11 }}>📊 CSV</Btn>
          </div>
        </div>
      </Modal>}

      {/* Add / Edit */}
      {showAdd && <Modal title={editId ? "✏️ Edit Job" : "＋ Add New Job"} onClose={() => setShowAdd(false)}>
        {!editId && (
          <div style={{background:"rgba(34,197,94,0.06)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{color:"#4ade80",fontSize:12,fontWeight:700,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
              🤖 AI Extract from Job Description
              <span style={{background:"rgba(34,197,94,0.12)",border:"1px solid rgba(139,92,246,0.25)",color:"#4ade80",padding:"1px 8px",borderRadius:999,fontSize:9}}>Auto-fill form</span>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <F label="Job Title *"><Inp value={form.title} onChange={e => upd("title", e.target.value)} placeholder="e.g. Software Engineer" /></F>
          <F label="Company *"><Inp value={form.company} onChange={e => upd("company", e.target.value)} placeholder="e.g. Zoho" /></F>
          <F label="Location"><Inp value={form.location} onChange={e => upd("location", e.target.value)} placeholder="City / Remote" /></F>
                    <div style={{ marginBottom: 12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Salary</span>
              {(form.title||form.location) && (
                <button type="button" onClick={() => getSalaryBenchmark(form.title, form.location)}
                  style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', color:'#a5b4fc', borderRadius:6, padding:'2px 8px', cursor:'pointer', fontSize:10, fontFamily:'inherit' }}>
                  {salaryLoading ? '…' : '💡 Benchmark'}
                </button>
              )}
            </div>
            <Inp value={form.salary} onChange={e=>upd("salary", e.target.value)} placeholder="e.g. ₹6 LPA"/>
            {salaryBenchmark && !salaryLoading && (
              <div style={{ marginTop:4, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:8, padding:'8px 12px', fontSize:11 }}>
                <span style={{ color:'#86efac', fontWeight:700 }}>Market: </span>
                <span style={{ color:'#e2e8f0' }}>₹{salaryBenchmark.min_lpa}–{salaryBenchmark.max_lpa} {salaryBenchmark.currency}</span>
                <span style={{ color:'#475569', marginLeft:8 }}>({salaryBenchmark.level})</span>
                {salaryBenchmark.notes && <div style={{ color:'#475569', marginTop:3 }}>{salaryBenchmark.notes}</div>}
                <button type="button" onClick={() => upd("salary", `₹${salaryBenchmark.min_lpa}–${salaryBenchmark.max_lpa} ${salaryBenchmark.currency}`)}
                  style={{ background:'none', border:'none', color:'#818cf8', cursor:'pointer', fontSize:10, fontFamily:'inherit', marginTop:3, padding:0 }}>
                  ↑ Use this range
                </button>
              </div>
            )}
          </div>
          <F label="Job Type"><Sel value={form.type} onChange={e => upd("type", e.target.value)} options={TYPES} /></F>
          <F label="Priority"><Sel value={form.priority} onChange={e => upd("priority", e.target.value)} options={["High", "Medium", "Low"]} /></F>
          <F label="Status"><Sel value={form.status} onChange={e => upd("status", e.target.value)} options={STATUS} /></F>
          <F label="Source"><Inp value={form.source} onChange={e => upd("source", e.target.value)} placeholder="LinkedIn / Naukri…" /></F>
          <F label="Apply Link"><Inp value={form.applylink} onChange={e => upd("applylink", e.target.value)} placeholder="https://…" /></F>
          <F label="Skills"><Inp value={form.skills} onChange={e => upd("skills", e.target.value)} placeholder="Python, React, SQL…" /></F>
          <F label="Applied Date"><Inp type="date" value={form.applieddate} onChange={e => upd("applieddate", e.target.value)} /></F>
          <F label="Deadline"><Inp type="date" value={form.deadline} onChange={e => upd("deadline", e.target.value)} /></F>
        </div>
        <F label="Notes"><Txt value={form.notes} onChange={e => upd("notes", e.target.value)} placeholder="Interview notes, contacts…" rows={2} /></F>
        {profile.skills && form.skills && <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8, padding: "8px 14px", marginBottom: 14, fontSize: 11, color: "#86efac" }}>⚡ Profile match: <strong>{calcMatchScore(form.skills, profile.skills)}%</strong></div>}
        <Btn v="pri" onClick={saveJob} sx={{ width: "100%", justifyContent: "center", marginTop: 6, padding: "12px", fontSize: 13 }}>{editId ? "Save Changes" : "Add to Tracker"}</Btn>
      </Modal>}

      {/* Job Search */}
      {showSearch && <Modal title="🔍 Live Job Search — Adzuna" onClose={() => { setShowSearch(false); setSr([]); setSErr(""); }} wide>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none", opacity: .4 }}>🔍</span>
            <input value={sq} onChange={e => setSq(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()} placeholder='e.g. "React developer", "Python analyst"…' style={{ width: "100%", background: "#070f1c", border: "1px solid #2d4a6b", borderRadius: 10, padding: "12px 14px 12px 38px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} onFocus={e => e.target.style.borderColor = "#4f46e5"} onBlur={e => e.target.style.borderColor = "#2d4a6b"} />
          </div>
          <Btn v="pri" onClick={() => doSearch()} disabled={sLoad} sx={{ padding: "12px 20px", fontSize: 13, fontWeight: 700 }}>{sLoad ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Searching…</> : "Search"}</Btn>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Experience Level</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {EXPERIENCE_LEVELS.map(lvl => (
              <button key={lvl.value} onClick={() => setSExperience(sExperience === lvl.value ? "" : lvl.value)} style={{ padding: "5px 13px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", background: sExperience === lvl.value ? `${lvl.color}18` : "transparent", border: `1px solid ${sExperience === lvl.value ? lvl.color : "#1e2d45"}`, color: sExperience === lvl.value ? lvl.color : "#64748b", fontFamily: "inherit", transition: "all .15s" }}>{lvl.label}</button>
            ))}
          </div>
        </div>
        {savedSearches.length > 0 && <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Saved Searches</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {savedSearches.map((s, i) => <button key={i} onClick={() => { setSq(s.sq); setSLocation(s.sLocation); setSJobType(s.sJobType); setSSalaryMin(s.sSalaryMin); setSCategory(s.sCategory); setSExperience(s.sExperience); }} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8", cursor: "pointer", fontFamily: "inherit" }}>🔖 {s.label}</button>)}
          </div>
        </div>}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{flex:1,minWidth:220}}>
            <div style={{color:"#475569",fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>Search Cities (add multiple)</div>
            <CityChips value={typeof sCities !== 'undefined' ? sCities : ''} onChange={v=>{if(typeof setSCities !== 'undefined'){setSCities(v);localStorage.setItem("sCities",v);}}}/>
            {typeof sCities !== 'undefined' && sCities&&<button onClick={()=>{setSCities("");localStorage.removeItem("sCities");}} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:10,marginTop:4,fontFamily:"inherit"}}>✕ Clear all cities</button>}
          </div>
          <select value={sCategory} onChange={e => setSCategory(e.target.value)} style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit" }}>{ADZUNA_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          <select value={sJobType} onChange={e => setSJobType(e.target.value)} style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit" }}>
            <option value="all">All Types</option><option value="full-time">Full-Time</option><option value="part-time">Part-Time</option><option value="contract">Contract</option>
          </select>
          <Btn v="ghost" onClick={saveSearch} sx={{ fontSize: 11 }}>🔖 Save</Btn>
        </div>
        {/* Results count + insights */}
        {sr.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>
                Showing <strong style={{ color: "#67e8f9" }}>{sr.length}</strong> jobs
                {sTotalResults > 0 && <span style={{ color: "#334155" }}> of ~{sTotalResults.toLocaleString()} total</span>}
                {aiRanking && <span style={{ color: "#4ade80", marginLeft: 6 }}> · AI ranking…</span>}
              </span>
              {searchInsights && (
                <span style={{ color: "#475569", fontSize: 11 }}>
                  🆕 <strong style={{ color: "#86efac" }}>{searchInsights.freshToday}</strong> today
                  {searchInsights.withSalary > 0 && <> · 💰 <strong style={{ color: "#fde047" }}>{searchInsights.withSalary}</strong> with salary</>}
                  {profile.skills && <> · ⚡ <strong style={{ color: "#60a5fa" }}>{sr.filter(r => (r.matchScore || 0) >= 50).length}</strong> high match</>}
                </span>
              )}
            </div>
            {searchInsights?.topSkills?.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ color: "#334155", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>Top Skills:</span>
                {searchInsights.topSkills.slice(0, 6).map(({ skill, count }) => (
                  <button key={skill} onClick={() => setSq(sq ? `${sq} ${skill}` : skill)} title={`Click to add "${skill}" to search`}
                    style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {skill} <span style={{ color: "#475569" }}>({count})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {sErr && <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid #7f1d1d", borderRadius: 10, padding: "12px 16px", color: "#f87171", fontSize: 12, marginBottom: 14 }}>⚠️ {sErr}</div>}
        {sr.length > 0 && <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 500, overflowY: "auto", paddingRight: 4 }}>
            {sr.map((r, i) => (
              <div key={i} className="search-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                      {r.applylink ? <a href={r.applylink} target="_blank" rel="noreferrer" style={{ color: "#93c5fd", textDecoration: "none" }}>{r.title} <span style={{ fontSize: 11, opacity: .6 }}>↗</span></a> : r.title}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>{r.company}</span>
                      {r.location && <span style={{ color: "#475569", fontSize: 11 }}>📍 {r.location}</span>}
                      {r.salary && <span style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", color: "#4ade80", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{r.salary}</span>}
                      {r.matchScore > 0 && <MatchBadge score={r.matchScore} />}
                      {r.postedDaysAgo !== null && <span style={{ color: r.postedDaysAgo <= 3 ? "#86efac" : "#475569", fontSize: 10 }}>{r.postedDaysAgo === 0 ? "Today" : `${r.postedDaysAgo}d ago`}</span>}
                    </div>
                    {r.skills && <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>{r.skills.split(", ").map(sk => <span key={sk} style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600 }}>{sk}</span>)}</div>}
                    {r.description && <div style={{ color: "#64748b", fontSize: 11, lineHeight: 1.6 }}>{r.description}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <Btn v="grn" onClick={() => addFromSearch(r)} sx={{ padding: "7px 14px", fontSize: 11, fontWeight: 700 }}>＋ Add</Btn>
                    {r.applylink && <a href={r.applylink} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn v="pri" sx={{ padding: "7px 14px", fontSize: 11, width: "100%", justifyContent: "center" }}>Apply ↗</Btn></a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => doSearch(false)} disabled={sLoad} style={{ width: "100%", marginTop: 14, background: "rgba(6,182,212,0.06)", border: "1px dashed rgba(6,182,212,0.25)", color: sLoad ? "#334155" : "#06b6d4", borderRadius: 12, padding: "12px", cursor: sLoad ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, opacity: sLoad ? 0.5 : 1 }}>
            {sLoad ? "Loading…" : `⬇ Load More (page ${sPage + 1})`}
          </button>
        </>}
      </Modal>}

      {/* Detail */}
      {showDetail && <Modal title={showDetail.title} onClose={() => setShowDetail(null)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[["Company", showDetail.company], ["Location", showDetail.location], ["Type", showDetail.type], ["Salary", showDetail.salary], ["Skills", showDetail.skills], ["Source", showDetail.source], ["Priority", showDetail.priority], ["Applied", fmtDate(showDetail.applieddate)], ["Deadline", showDetail.deadline ? fmtDate(showDetail.deadline) : "—"]].map(([k, v]) => v && (
            <div key={k} style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: 12 }}>
              <div style={{ color: "#334155", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{k}</div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>{v}</div>
            </div>
          ))}
        </div>
        {profile.skills && showDetail.skills && <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#86efac" }}>⚡ Profile match: <strong>{calcMatchScore(showDetail.skills, profile.skills)}%</strong></div>}
        {showDetail.notes && <div style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: 14, marginBottom: 14 }}><div style={{ color: "#334155", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>NOTES</div><div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.7 }}>{showDetail.notes}</div></div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {showDetail.applylink && <a href={showDetail.applylink} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn v="pri">Apply ↗</Btn></a>}
          <Btn onClick={() => addToCalendar(showDetail)}>📅 Calendar</Btn>
          <Btn onClick={() => { doPrep(showDetail); setShowDetail(null); }}>🎙 Prep</Btn>
          <Btn onClick={() => { setShowCover(showDetail); setCoverOut(""); setShowDetail(null); }}>✉ Cover</Btn>
        </div>
      </Modal>}

      {/* Interview Prep */}
      {showPrep && <Modal title={`🎙 Interview Prep — ${showPrep.title}`} onClose={() => { setShowPrep(null); setPrepOut(""); }} wide>
        {prepLoad && <div style={{ textAlign: "center", padding: "40px", color: "#334155" }}><div style={{ fontSize: 32, display: "inline-block", animation: "spin 1.2s linear infinite", marginBottom: 12 }}>⚡</div><p style={{ fontSize: 12, color: "#475569" }}>Generating personalized prep guide…</p></div>}
        {!prepLoad && prepOut && (
          <div style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 12, padding: 18, maxHeight: 520, overflowY: "auto" }}>
            {prepOut.split('\n').map((line, i) => {
              if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
              if (line.startsWith('▸ ')) return <div key={i} style={{ color:'#a5b4fc', fontWeight:700, fontSize:13, marginTop:14, marginBottom:5, paddingBottom:5, borderBottom:'1px solid rgba(99,102,241,0.2)' }}>◆ {line.slice(2)}</div>;
              if (line.includes('   |   ')) {
                const cells = line.split('   |   ').map(c => c.trim()).filter(Boolean);
                return <div key={i} style={{ display:'flex', gap:10, padding:'5px 8px', background:'rgba(255,255,255,0.025)', borderRadius:5, marginBottom:2, fontSize:12, flexWrap:'wrap' }}>{cells.map((c,ci) => <span key={ci} style={{ flex:ci===0?'0 0 auto':1, color:ci===0?'#60a5fa':'#94a3b8', minWidth:ci===0?20:80 }}>{c}</span>)}</div>;
              }
              if (line.trim().startsWith('• ') || line.trim().startsWith('- ')) return <div key={i} style={{ display:'flex', gap:8, padding:'2px 6px', fontSize:13, color:'#94a3b8' }}><span style={{ color:'#4f46e5' }}>•</span><span>{line.trim().slice(2)}</span></div>;
              const nm = line.trim().match(/^([QqA]?d+[.):]?)s+(.+)/);
              if (nm) return <div key={i} style={{ display:'flex', gap:10, padding:'4px 6px', fontSize:13 }}><span style={{ color:'#818cf8', fontWeight:700, minWidth:26, fontFamily:'monospace', fontSize:12 }}>{nm[1]}</span><span style={{ color:'#d1d5db' }}>{nm[2]}</span></div>;
              return <div key={i} style={{ fontSize:13, color:'#94a3b8', lineHeight:1.65, padding:'2px 6px' }}>{line}</div>;
            })}
          </div>
        )}
        {!prepOut && !prepLoad && <Btn v="pri" onClick={() => doPrep(showPrep)}>⚡ Generate Prep Guide</Btn>}
        {prepOut && !prepLoad && <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn v="pri" onClick={() => doPrep(showPrep)}>🔄 Regenerate</Btn>
          <Btn onClick={() => { navigator.clipboard?.writeText(prepOut); notify("Copied ✓"); }}>📋 Copy</Btn>
          <Btn v="cyn" onClick={() => saveToDrive(`Interview_Prep_${showPrep.company}.txt`, prepOut)}>☁️ Drive</Btn>
        </div>}
      </Modal>}

      {/* Cover Letter */}
      {showCover && <Modal title={`✉ Cover Letter — ${showCover.title} @ ${showCover.company}`} onClose={() => { setShowCover(null); setCoverOut(""); }} wide>
        {profile.skills
          ? <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#86efac" }}>✓ Using profile: <strong>{profile.full_name}</strong> · {profile.headline}</div>
          : <F label="Your Background (optional)"><Txt value={bio} onChange={e => setBio(e.target.value)} placeholder="e.g. Final year BE CSE with ML projects…" rows={2} /></F>
        }
        <Btn v="amb" onClick={() => doCover(showCover)} disabled={coverLoad}>{coverLoad ? "Generating…" : "⚡ Generate Cover Letter"}</Btn>
        {coverLoad && <div style={{ textAlign: "center", padding: "24px", color: "#475569", animation: "pulse 1.2s infinite", marginTop: 10 }}>✍️ Writing your cover letter…</div>}
        {coverOut && !coverLoad && <>
          <div style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 12, padding: 18, whiteSpace: "pre-wrap", lineHeight: 1.85, fontSize: 13, color: "#94a3b8", marginTop: 16, maxHeight: 460, overflowY: "auto" }}>{coverOut}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Btn onClick={() => { navigator.clipboard?.writeText(coverOut); notify("Copied ✓"); }}>📋 Copy</Btn>
            <Btn v="cyn" onClick={() => saveToDrive(`Cover_Letter_${showCover.company}.txt`, coverOut)}>☁️ Drive</Btn>
            <Btn v="ghost" onClick={() => doCover(showCover)}>🔄 Regenerate</Btn>
          </div>
        </>}
      </Modal>}

      {showURLScraper&&<Modal title="🔗 Import Job from URL" onClose={()=>setShowURLScraper(false)}>
        <p style={{color:"#94a3b8",fontSize:13,lineHeight:1.7,marginBottom:14}}>
          Paste any job posting URL — LinkedIn, Naukri, Indeed, company career pages. AI extracts all details.
        </p>
        <div style={{background:"rgba(34,197,94,0.06)",border:"1px solid rgba(139,92,246,0.18)",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:11,color:"#4ade80"}}>
          ✨ Supported: LinkedIn Jobs · Naukri · Indeed · Internshala · Glassdoor · Any public job URL
        </div>
        <F label="Job Posting URL">
          <Inp value={scrapeURL} onChange={e=>setScrapeURL(e.target.value)} placeholder="https://www.linkedin.com/jobs/view/… or any job URL"/>
        </F>
        {scrapeError&&<div style={{background:"rgba(220,38,38,0.06)",border:"1px solid #7f1d1d",borderRadius:8,padding:"10px 14px",color:"#f87171",fontSize:12,marginTop:10}}>{scrapeError}</div>}
        <Btn v="vio" onClick={doScrapeURL} disabled={scrapeLoading||!scrapeURL.trim()} sx={{width:"100%",justifyContent:"center",padding:"12px",fontSize:13,marginTop:12,marginBottom:16}}>
          {scrapeLoading?<><span style={{animation:"spin 0.8s linear infinite",display:"inline-block"}}>◌</span> Extracting…</>:"🔍 Extract Job Details"}
        </Btn>
        {scrapeResult&&<div style={{background:"#070f1c",border:"1px solid #1e2d45",borderRadius:14,padding:18,animation:"mi .2s ease"}}>
          <div style={{color:"#86efac",fontSize:12,fontWeight:700,marginBottom:14}}>✓ Job Extracted!</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {[["Title",scrapeResult.title],["Company",scrapeResult.company],["Location",scrapeResult.location||"—"],["Type",scrapeResult.type],["Salary",scrapeResult.salary||"Not disclosed"],["Deadline",scrapeResult.deadline||"—"]].map(([k,v])=>(
              <div key={k} style={{background:"#06101e",border:"1px solid #1e2d45",borderRadius:8,padding:"10px 12px"}}>
                <div style={{color:"#334155",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>{k}</div>
                <div style={{color:"#94a3b8",fontSize:12}}>{v}</div>
              </div>
            ))}
          </div>
          {scrapeResult.skills&&<div style={{marginBottom:10}}><div style={{color:"#475569",fontSize:10,marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Skills Detected</div><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{scrapeResult.skills.split(",").filter(s=>s.trim()).map(sk=><span key={sk} style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",color:"#a5b4fc",padding:"2px 9px",borderRadius:999,fontSize:11}}>{sk.trim()}</span>)}</div></div>}
          {profile.skills&&<div style={{background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.15)",borderRadius:8,padding:"8px 14px",marginBottom:14,fontSize:12,color:"#86efac"}}>⚡ Profile match: <strong>{calcMatchScore(scrapeResult.skills,profile.skills)}%</strong></div>}
          <div style={{display:"flex",gap:8}}>
            <Btn v="grn" onClick={addScrapedJob} sx={{flex:1,justifyContent:"center",padding:"11px",fontSize:13}}>+ Add to Tracker</Btn>
            <Btn v="ghost" onClick={()=>{setScrapeResult(null);setScrapeURL("");}}>← Try Another URL</Btn>
          </div>
        </div>}
      </Modal>}
      {/* ── INTERVIEW PREP MODAL ── */}
      {interviewPrepJob && (
        <Modal title={`🎙 Interview Prep — ${interviewPrepJob.title} @ ${interviewPrepJob.company}`} onClose={() => { setInterviewPrepJob(null); setInterviewPrepResult(''); }} wide>
          {interviewPrepLoading ? (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'#64748b' }}>
              <div style={{ fontSize:32, marginBottom:12, animation:'spin 1s linear infinite', display:'inline-block' }}>⚙️</div>
              <p>Generating tailored interview questions…</p>
            </div>
          ) : interviewPrepResult ? (
            <>
<div style={{ maxHeight:540, overflowY:'auto', padding:'0 4px' }}>
                {(() => {
                  const text = interviewPrepResult;
                  const elements = [];
                  const lines = text.split('\n');
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
                      const title = trimmed.replace(/^SECTION:\s*/i, '').replace(/[*_#]/g,'').trim();
                      elements.push(
                        <div key={key} style={{ display:'flex', alignItems:'center', gap:10, marginTop:22, marginBottom:10, paddingBottom:8, borderBottom:'1px solid rgba(99,102,241,0.25)' }}>
                          <span style={{ background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.35)', color:'#a5b4fc', borderRadius:8, padding:'3px 10px', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
                            {title.includes('Technical') ? '⚙️' : title.includes('Behavioral') ? '🧠' : title.includes('Culture') || title.includes('Company') ? '🏢' : title.includes('Ask') ? '💬' : title.includes('Prep') || title.includes('Task') ? '✅' : '▸'}
                          </span>
                          <span style={{ color:'#a7f3d0', fontWeight:700, fontSize:14 }}>{title}</span>
                        </div>
                      );
                      i++; continue;
                    }

                    // Q<n>. question line — look ahead for ANSWER/TIP/WHY
                    const qMatch = trimmed.match(/^(Q\d+|TASK\s*\d+)[.):]\s*(.+)/i);
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
                        const subM = sub.match(/^(ANSWER|TIP|WHY|HOW|GOAL):\s*(.+)/i);
                        if (subM) { subs.push({ label: subM[1].toUpperCase(), text: subM[2].trim() }); i++; }
                        else if (/^(Q\d+|TASK|SECTION|Q:)/i.test(sub)) break;
                        else { subs.push({ label: 'NOTE', text: sub.replace(/^[-*•]\s*/,'') }); i++; }
                      }

                      const accentColor = isTask ? '#86efac' : '#67e8f9';
                      const bgColor     = isTask ? 'rgba(34,197,94,0.04)' : 'rgba(6,182,212,0.04)';
                      const borderColor = isTask ? 'rgba(34,197,94,0.2)' : 'rgba(6,182,212,0.2)';

                      elements.push(
                        <div key={key} style={{ background:bgColor, border:`1px solid ${borderColor}`, borderRadius:12, padding:'14px 16px', marginBottom:10 }}>
                          <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom: subs.length ? 10 : 0 }}>
                            <span style={{ background: isTask ? 'rgba(34,197,94,0.15)' : 'rgba(6,182,212,0.15)', color: accentColor, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700, flexShrink:0, fontFamily:"'JetBrains Mono',monospace", marginTop:1 }}>{qLabel}</span>
                            <span style={{ color:'#e2e8f0', fontWeight:600, fontSize:13, lineHeight:1.55 }}>{qText}</span>
                          </div>
                          {subs.map((s, si) => {
                            const labelColors = { ANSWER:'#94a3b8', TIP:'#fbbf24', WHY:'#4ade80', HOW:'#86efac', GOAL:'#60a5fa', NOTE:'#64748b' };
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
                    const qLabelM = trimmed.match(/^(QUESTION|Q):\s*(.+)/i);
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
                    const subLabelM = trimmed.match(/^(ANSWER|TIP|WHY|HOW|GOAL):\s*(.+)/i);
                    if (subLabelM) {
                      const labelColors = { ANSWER:'#94a3b8', TIP:'#fbbf24', WHY:'#4ade80', HOW:'#86efac', GOAL:'#60a5fa' };
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
                    const bulletM = trimmed.match(/^[•\-*]\s+(.+)/);
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
        <Modal title={`📧 Follow-Up Email — ${followUpJob.title} @ ${followUpJob.company}`} onClose={() => { setFollowUpJob(null); setFollowUpDraft(''); }} wide>
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
                {reportEmail && clientId && <Btn v="grn" onClick={async () => {
                  try {
                    const token = await getGoogleToken("https://www.googleapis.com/auth/gmail.send", session, clientId);
                    const toEmail = extractEmailFromJob(followUpJob) || "";
                    if (!toEmail) return notify("No email found for this job — copy and send manually.", "err");
                    const html = `<html><body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:auto;padding:40px 20px"><pre style="white-space:pre-wrap;font-family:inherit">${followUpDraft}</pre></body></html>`;
                    await sendEmailViaGmail(toEmail, `Follow-up: ${followUpJob.title} Application`, html, token);
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

    </div>
  );
}