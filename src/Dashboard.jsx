import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import * as XLSX from "xlsx";

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
  "Rejected": { bg: "rgba(239,68,68,0.18)", fg: "#f87171", accent: "#ef4444", lb: "#7f1d1d" },
  "Applied": { bg: "rgba(245,158,11,0.18)", fg: "#fbbf24", accent: "#f59e0b", lb: "#78350f" },
  "Screening": { bg: "rgba(139,92,246,0.18)", fg: "#a78bfa", accent: "#8b5cf6", lb: "#4c1d95" },
  "Pending": { bg: "rgba(148,163,184,0.12)", fg: "#94a3b8", accent: "#64748b", lb: "#1e293b" },
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
  { value: "mid", label: "Mid / 3–5 yrs", color: "#a78bfa", keywords: "mid level 3 4 5 years" },
  { value: "senior", label: "Senior / 5+ yrs", color: "#f59e0b", keywords: "senior lead principal 5 6 7 years" },
  { value: "manager", label: "Manager / Lead", color: "#f87171", keywords: "manager lead head director" },
];

const NVIDIA_API_URL = "/api/ai";
const NVIDIA_API_KEY = "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";
const NVIDIA_MODEL = "deepseek-ai/deepseek-r1";

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
const fmtDateFull = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
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

function calcMatchScore(jobSkills, profileSkills) {
  if (!jobSkills || !profileSkills) return 0;
  const jSkills = jobSkills.toLowerCase().split(/[,\s]+/).filter(s => s.length > 2);
  const pSkills = profileSkills.toLowerCase().split(/[,\s]+/).filter(s => s.length > 2);
  if (!jSkills.length) return 0;
  const matches = jSkills.filter(js => pSkills.some(ps => ps.includes(js) || js.includes(ps)));
  return Math.round((matches.length / jSkills.length) * 100);
}

async function callAI(prompt, sysprompt = "", apiKey = NVIDIA_API_KEY, modelName = NVIDIA_MODEL, proxyUrl = NVIDIA_API_URL) {
  if (!apiKey) throw new Error("API key required.");
  const messages = [];
  if (sysprompt) messages.push({ role: "system", content: sysprompt });
  messages.push({ role: "user", content: prompt });
  const r = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelName, messages, temperature: 0.6, top_p: 0.7, max_tokens: 4096 })
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`API Error ${r.status}: ${t}`); }
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.choices?.[0]?.message?.content || "";
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

async function getGoogleToken(scope, session, clientId) {
  if (session?.provider_token) return session.provider_token;
  if (!clientId) throw new Error("Google Client ID needed in Settings.");
  const gis = await loadGis();
  return new Promise((resolve, reject) => {
    const tc = gis.initTokenClient({ client_id: clientId, scope, callback: (r) => r.error ? reject(new Error(r.error)) : resolve(r.access_token) });
    tc.requestAccessToken({ prompt: "" });
  });
}

async function sendEmailViaGmail(to, subject, htmlBody, token) {
  const rawEmail = [`To: ${to}`, `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`, `MIME-Version: 1.0`, `Content-Type: text/html; charset=UTF-8`, ``, htmlBody].join("\r\n");
  const encoded = btoa(unescape(encodeURIComponent(rawEmail))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded })
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Gmail send failed: ${t}`); }
  return res.json();
}

async function saveFileToDrive(filename, content, mimeType, token) {
  const metadata = { name: filename, mimeType };
  const isBuffer = content instanceof ArrayBuffer || content instanceof Uint8Array;
  const fileBlob = isBuffer ? new Blob([content], { type: mimeType }) : new Blob([content], { type: mimeType });
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", fileBlob, filename);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: form
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Drive save failed: ${t}`); }
  return res.json();
}

// ── Email Report HTML Template ────────────────────────────────────────────────
function buildReportHTML(jobs, reportDate, profileName) {
  const stats = STATUS.reduce((a, s) => { a[s] = jobs.filter(j => j.status === s).length; return a }, {});
  const totalActive = jobs.filter(j => !["Rejected", "Withdrawn"].includes(j.status)).length;
  const interviews = jobs.filter(j => j.status === "Interview");
  const offers = jobs.filter(j => j.status === "Offer");
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
      <td style="padding:10px 14px;border-bottom:1px solid #1e293b;color:#a78bfa;">${j.salary || "—"}</td>
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
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:30px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center;border:1px solid #1e2d45;border-bottom:none;">
    <div style="font-size:28px;margin-bottom:6px;">🎯</div>
    <h1 style="margin:0;font-size:26px;font-weight:800;background:linear-gradient(90deg,#60a5fa,#818cf8,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#818cf8;">JobBoard Pro</h1>
    <p style="color:#475569;font-size:13px;margin:8px 0 0;">Daily Report${profileName ? ` · ${profileName}` : ""} · ${reportDate}</p>
  </td></tr>

  <!-- HERO STATS -->
  <tr><td style="background:#07101f;border:1px solid #1e2d45;border-top:none;border-bottom:none;padding:24px;">
    <p style="color:#94a3b8;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px;">📊 Application Overview</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;border-radius:12px;border:1px solid #1e2d45;">
      <tr>
        <td style="text-align:center;padding:16px 8px;border-right:1px solid #1e2d45;">
          <div style="font-size:32px;font-weight:800;color:#60a5fa;font-family:monospace;">${jobs.length}</div>
          <div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin-top:3px;">Total</div>
        </td>
        <td style="text-align:center;padding:16px 8px;border-right:1px solid #1e2d45;">
          <div style="font-size:32px;font-weight:800;color:#86efac;font-family:monospace;">${totalActive}</div>
          <div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin-top:3px;">Active</div>
        </td>
        <td style="text-align:center;padding:16px 8px;border-right:1px solid #1e2d45;">
          <div style="font-size:32px;font-weight:800;color:#22c55e;font-family:monospace;">${stats.Interview || 0}</div>
          <div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin-top:3px;">Interviews</div>
        </td>
        <td style="text-align:center;padding:16px 8px;">
          <div style="font-size:32px;font-weight:800;color:#fde047;font-family:monospace;">${stats.Offer || 0}</div>
          <div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin-top:3px;">Offers</div>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;background:#0a1628;border-radius:12px;border:1px solid #1e2d45;"><tr>${statusRow}</tr></table>
  </td></tr>

  ${upcoming.length > 0 ? `
  <!-- URGENT DEADLINES -->
  <tr><td style="background:#07101f;border:1px solid #1e2d45;border-top:none;border-bottom:none;padding:0 24px 24px;">
    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:16px;">
      <p style="color:#fbbf24;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 12px;">⏰ Deadlines This Week</p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr><th style="text-align:left;color:#475569;font-size:10px;padding:6px 14px;text-transform:uppercase;">Role</th><th style="text-align:left;color:#475569;font-size:10px;padding:6px 14px;text-transform:uppercase;">Company</th><th style="text-align:left;color:#475569;font-size:10px;padding:6px 14px;text-transform:uppercase;">Due</th></tr>${urgentRows}</table>
    </div>
  </td></tr>`: ""}

  ${interviews.length > 0 ? `
  <!-- INTERVIEWS -->
  <tr><td style="background:#07101f;border:1px solid #1e2d45;border-top:none;border-bottom:none;padding:0 24px 24px;">
    <p style="color:#86efac;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 12px;">🎙 Active Interviews</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;border-radius:12px;border:1px solid #16a34a;overflow:hidden;">
      <tr style="background:#052e16;"><th style="text-align:left;color:#86efac;font-size:10px;padding:10px 14px;text-transform:uppercase;">Role</th><th style="text-align:left;color:#86efac;font-size:10px;padding:10px 14px;text-transform:uppercase;">Company</th><th style="text-align:left;color:#86efac;font-size:10px;padding:10px 14px;text-transform:uppercase;">Date</th></tr>
      ${interviewRows}
    </table>
  </td></tr>`: ""}

  <!-- APPLIED JOBS -->
  ${recentApplied.length > 0 ? `
  <tr><td style="background:#07101f;border:1px solid #1e2d45;border-top:none;border-bottom:none;padding:0 24px 24px;">
    <p style="color:#67e8f9;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 12px;">✉️ Applied (Recent)</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;border-radius:12px;border:1px solid #0891b2;overflow:hidden;">
      <tr style="background:#0c2236;"><th style="text-align:left;color:#67e8f9;font-size:10px;padding:10px 14px;">Role</th><th style="text-align:left;color:#67e8f9;font-size:10px;padding:10px 14px;">Company</th><th style="text-align:left;color:#67e8f9;font-size:10px;padding:10px 14px;">Location</th><th style="text-align:left;color:#67e8f9;font-size:10px;padding:10px 14px;">Salary</th></tr>
      ${appliedRows}
    </table>
  </td></tr>`: ""}

  <!-- TIPS -->
  <tr><td style="background:#07101f;border:1px solid #1e2d45;border-top:none;border-bottom:none;padding:0 24px 24px;">
    <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:16px;">
      <p style="color:#818cf8;font-size:12px;font-weight:700;margin:0 0 8px;">💡 Today's Focus</p>
      <ul style="color:#64748b;font-size:12px;line-height:1.8;margin:0;padding-left:16px;">
        ${stats.Interview > 0 ? `<li>Prepare thoroughly for your <strong style="color:#86efac">${stats.Interview} interview${stats.Interview > 1 ? "s" : ""}</strong></li>` : ""}
        ${upcoming.length > 0 ? `<li>Review <strong style="color:#fbbf24">${upcoming.length} upcoming deadline${upcoming.length > 1 ? "s" : ""}</strong></li>` : ""}
        ${stats.Bookmarked > 0 ? `<li>Convert <strong style="color:#93c5fd">${stats.Bookmarked} bookmarked</strong> jobs to applications</li>` : ""}
        <li>Follow up on applications older than 7 days</li>
        <li>Keep your resume updated for each role</li>
      </ul>
    </div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#060d1b;border:1px solid #1e2d45;border-top:none;border-radius:0 0 16px 16px;padding:20px 24px;text-align:center;">
    <p style="color:#1e2d45;font-size:11px;margin:0;">Generated by <strong style="color:#475569">JobBoard Pro</strong> · ${reportDate}</p>
    <p style="color:#1e2d45;font-size:10px;margin:6px 0 0;">This is your automated daily career report. An Excel file is attached.</p>
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

  // Sheet 1: Active Applications
  const activeJobs = jobs.filter(j => !["Rejected", "Withdrawn"].includes(j.status));
  const headers1 = ["#", "Job Title", "Company", "Location", "Type", "Salary", "Skills", "Source", "Status", "Priority", "Applied Date", "Deadline", "Apply Link", "Notes"];
  const rows1 = activeJobs.map((j, i) => [i + 1, j.title, j.company, j.location, j.type, j.salary, j.skills, j.source, j.status, j.priority, j.applieddate, j.deadline, j.applylink, j.notes]);
  const ws1 = XLSX.utils.aoa_to_sheet([headers1, ...rows1]);
  ws1["!cols"] = [{ wch: 4 }, { wch: 35 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 40 }, { wch: 50 }];
  ws1["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, ws1, "📋 Active Applications");

  // Sheet 2: All Applications
  const headers2 = ["#", "Job Title", "Company", "Location", "Type", "Salary", "Skills", "Source", "Status", "Priority", "Applied Date", "Deadline", "Notes"];
  const rows2 = jobs.map((j, i) => [i + 1, j.title, j.company, j.location, j.type, j.salary, j.skills, j.source, j.status, j.priority, j.applieddate, j.deadline, j.notes]);
  const ws2 = XLSX.utils.aoa_to_sheet([headers2, ...rows2]);
  ws2["!cols"] = [{ wch: 4 }, { wch: 35 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws2, "📁 All Applications");

  // Sheet 3: Summary Statistics
  const stats = STATUS.reduce((a, s) => { a[s] = jobs.filter(j => j.status === s).length; return a }, {});
  const totalActive = jobs.filter(j => !["Rejected", "Withdrawn"].includes(j.status)).length;
  const responseRate = jobs.length ? Math.round(((stats.Interview + stats.Offer + stats.Rejected) / jobs.length) * 100) : 0;
  const summaryData = [
    ["📊 JobBoard Pro — Summary Report", "", "", ""],
    ["Generated On", date, "", ""],
    ["", "", "", ""],
    ["📈 Key Metrics", "", "", ""],
    ["Total Applications", jobs.length, "", ""],
    ["Active Applications", totalActive, "", ""],
    ["Response Rate", `${responseRate}%`, "", ""],
    ["", "", "", ""],
    ["📋 By Status", "Count", "% of Total", ""],
    ...STATUS.map(s => [s, stats[s] || 0, jobs.length ? `${Math.round((stats[s] || 0) / jobs.length * 100)}%` : "-", ""]),
    ["", "", "", ""],
    ["🎯 By Priority", "Count", "% of Active", ""],
    ...["High", "Medium", "Low"].map(p => {
      const cnt = jobs.filter(j => j.priority === p).length;
      return [p, cnt, jobs.length ? `${Math.round(cnt / jobs.length * 100)}%` : ""];
    }),
    ["", "", "", ""],
    ["📍 Top Locations", "Count", "", ""],
    ...Object.entries(jobs.reduce((a, j) => { if (j.location) a[j.location] = (a[j.location] || 0) + 1; return a }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([l, c]) => [l, c, "", ""]),
    ["", "", "", ""],
    ["🏢 Top Companies", "Count", "", ""],
    ...Object.entries(jobs.reduce((a, j) => { if (j.company) a[j.company] = (a[j.company] || 0) + 1; return a }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, n]) => [c, n, "", ""]),
    ["", "", "", ""],
    ["🔗 Top Sources", "Count", "", ""],
    ...Object.entries(jobs.reduce((a, j) => { if (j.source) a[j.source] = (a[j.source] || 0) + 1; return a }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, c]) => [s, c, "", ""]),
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(summaryData);
  ws3["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws3, "📊 Summary");

  // Sheet 4: Interview Pipeline
  const interviewJobs = jobs.filter(j => j.status === "Interview");
  const offerJobs = jobs.filter(j => j.status === "Offer");
  const pipelineHeaders = ["Status", "Job Title", "Company", "Location", "Salary", "Deadline", "Notes"];
  const pipelineRows = [...offerJobs, ...interviewJobs].map(j => [j.status, j.title, j.company, j.location, j.salary, j.deadline, j.notes]);
  const ws4 = XLSX.utils.aoa_to_sheet([pipelineHeaders, ...pipelineRows]);
  ws4["!cols"] = [{ wch: 14 }, { wch: 35 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws4, "🎙 Interview Pipeline");

  // Sheet 5: Upcoming Deadlines
  const urgentJobs = jobs.filter(j => j.deadline && daysDiff(j.deadline) >= 0 && daysDiff(j.deadline) <= 14 && !["Rejected", "Withdrawn", "Offer"].includes(j.status)).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const urgentHeaders = ["Days Left", "Job Title", "Company", "Status", "Deadline", "Apply Link"];
  const urgentRows2 = urgentJobs.map(j => [daysDiff(j.deadline), j.title, j.company, j.status, j.deadline, j.applylink]);
  const ws5 = XLSX.utils.aoa_to_sheet([urgentHeaders, ...urgentRows2]);
  ws5["!cols"] = [{ wch: 10 }, { wch: 35 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws5, "⏰ Deadlines");

  return { wb, filename: `JobBoard_Pro_${date}.xlsx` };
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
    vio: { background: "linear-gradient(135deg,#4c1d95,#5b21b6)", border: "1px solid rgba(139,92,246,0.3)", color: "#c4b5fd" },
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
  return <span title="Match with your profile skills" style={{ background: bg, border: `1px solid ${col}`, color: col, padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>⚡{score}%</span>;
};

// ═══════════════════════════════════════════════════════════════════════════
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

  const fetchJobs = useCallback(async () => {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (data) setJobs(data);
  }, []);

  // ── Settings ──
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem("geminiKey") || NVIDIA_API_KEY);
  const [clientId, setClientId] = useState(() => localStorage.getItem("googleClientId") || import.meta.env.VITE_GOOGLE_CLIENT_ID || "");
  const [aiModel, setAiModel] = useState(() => localStorage.getItem("aiModel") || NVIDIA_MODEL);
  const [proxyUrl, setProxyUrl] = useState(() => localStorage.getItem("proxyUrl") || NVIDIA_API_URL);
  const [adzunaId, setAdzunaId] = useState(() => localStorage.getItem("adzunaId") || "538be205");
  const [adzunaKey, setAdzunaKey] = useState(() => localStorage.getItem("adzunaKey") || "8821660cdab1e3b4a33c8ee8a23f3c3f");
  const [reportEmail, setReportEmail] = useState(() => localStorage.getItem("reportEmail") || session?.user?.email || "");
  const [autoReport, setAutoReport] = useState(() => localStorage.getItem("autoReport") === "true");
  const [reportTime, setReportTime] = useState(() => localStorage.getItem("reportTime") || "09:00");

  // ── Profile ──
  const [profile, setProfile] = useState({ full_name: "", email: "", phone: "", location: "", headline: "", summary: "", skills: "", education: "", experience: "", certifications: "", languages: "", linkedin: "", github: "", portfolio: "", target_roles: "", target_locations: "", expected_salary: "" });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [resumeParsing, setResumeParsing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [showResumeHelp, setShowResumeHelp] = useState(false);

  // ── Report ──
  const [reportSending, setReportSending] = useState(false);
  const [reportLog, setReportLog] = useState(() => { try { return JSON.parse(localStorage.getItem("reportLog") || "[]") } catch { return [] } });
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

  // ── Form ──
  const blank = { title: "", company: "", location: "", type: "Full-time", salary: "", skills: "", source: "", applylink: "", status: "Bookmarked", applieddate: "", deadline: "", notes: "", priority: "Medium" };
  const [form, setForm] = useState(blank);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Search ──
  const [sq, setSq] = useState("");
  const [sr, setSr] = useState([]);
  const [sLoad, setSLoad] = useState(false);
  const [sErr, setSErr] = useState("");
  const [sPage, setSPage] = useState(1);
  const [sTotalResults, setSTotalResults] = useState(0);
  const [sLocation, setSLocation] = useState("");
  const [sJobType, setSJobType] = useState("all");
  const [sSalaryMin, setSSalaryMin] = useState("");
  const [sCategory, setSCategory] = useState("");
  const [sExperience, setSExperience] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [savedSearches, setSavedSearches] = useState(() => { try { return JSON.parse(localStorage.getItem("savedSearches") || "[]") } catch { return [] } });

  // ── AI ──
  const [prepOut, setPrepOut] = useState(""); const [prepLoad, setPrepLoad] = useState(false);
  const [coverOut, setCoverOut] = useState(""); const [coverLoad, setCoverLoad] = useState(false);
  const [bio, setBio] = useState("");

  // ── Gmail ──
  const [gmailDays, setGmailDays] = useState("30");
  const [gmailExtra, setGmailExtra] = useState("");
  const [gmailStatus, setGmailStatus] = useState({ msg: 'Ready — click "Scan Gmail" to begin', type: "" });
  const [gmailEmails, setGmailEmails] = useState([]);
  const [gmailFilter, setGmailFilter] = useState("all");
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailRows, setGmailRows] = useState([{ id: 1, date: "", company: "", jobTitle: "", status: "Applied", interviewDate: "", interviewTime: "", interviewType: "", notes: "" }]);
  const [gmailStats, setGmailStats] = useState(null);

  const notify = (m, t = "ok") => { setToast({ m, t }); setTimeout(() => setToast(null), 3500); };
  const AI = useCallback((prompt, sys = "") => callAI(prompt, sys, geminiKey, aiModel, proxyUrl), [geminiKey, aiModel, proxyUrl]);

  // ── Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchJobs();
    loadProfile();
  }, [session]);

  // Auto daily report check
  useEffect(() => {
    if (!autoReport || !reportEmail || jobs.length === 0) return;
    const lastSent = localStorage.getItem("lastReportDate");
    const today = todayStr();
    if (lastSent === today) return;
    const [h, m] = reportTime.split(":").map(Number);
    const now = new Date();
    if (now.getHours() >= h && now.getMinutes() >= m) {
      handleSendReport(true);
    }
  }, [jobs, autoReport]);

  // ── Profile CRUD ──────────────────────────────────────────────────────
  async function loadProfile() {
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (data) {
      setProfile(p => ({ ...p, ...data }));
      if (data.skills) setBio(`${data.headline || ""}\n${data.summary || ""}`);
    }
    setProfileLoaded(true);
  }

  async function saveProfile() {
    setProfileSaving(true);
    const payload = { ...profile, id: session.user.id, updated_at: new Date().toISOString() };
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
        full_name, email, phone, location, headline (job title/role), summary (professional summary 2-3 sentences),
        skills (comma-separated technical skills), education (formatted string), experience (recent 3 jobs as string),
        certifications, languages, linkedin, github, portfolio, target_roles, expected_salary.
        
        Resume text:
        ${resumeText.slice(0, 8000)}`,
        "You are a resume parser. Return ONLY valid JSON, no markdown, no explanation."
      );
      const clean = result.replace(/```json|```/g, "").trim();
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse resume");
      const parsed = JSON.parse(match[0]);
      setProfile(p => ({ ...p, ...parsed }));
      notify("✓ Resume parsed! Review and save your profile.");
    } catch (err) { notify("Parse error: " + err.message, "err"); }
    setResumeParsing(false);
  }

  async function handleResumeFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    if (file.name.endsWith(".txt")) {
      reader.onload = ev => { setResumeText(ev.target.result); notify("File loaded ✓ — click Parse Resume"); };
      reader.readAsText(file);
    } else if (file.name.endsWith(".pdf")) {
      reader.onload = async ev => {
        try {
          const text = new TextDecoder("utf-8").decode(new Uint8Array(ev.target.result)).replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
          if (text.length > 200) { setResumeText(text); notify("PDF text extracted ✓ — click Parse Resume"); }
          else notify("PDF appears image-based. Please paste your resume text manually.", "err");
        } catch { notify("Could not read PDF. Please paste text manually.", "err"); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = ev => { setResumeText(ev.target.result); notify("File loaded ✓"); };
      reader.readAsText(file);
    }
    e.target.value = "";
  }

  // ── CRUD ──────────────────────────────────────────────────────────────
  function openAdd() {
    const prefill = {
      title: "", company: "", location: profile.target_locations || profile.location || "",
      type: "Full-time", salary: profile.expected_salary || "",
      skills: profile.skills || "", source: "", applylink: "",
      status: "Bookmarked", applieddate: "", deadline: "", notes: "", priority: "Medium"
    };
    setForm(prefill); setEditId(null); setShowAdd(true);
  }
  function openEdit(j) { setForm({ ...j }); setEditId(j.id); setShowAdd(true); }
  async function saveJob() {
    if (!form.title || !form.company) return notify("Title & Company required", "err");
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
    const { error } = await supabase.from("jobs").update({ status }).eq("id", id);
    if (!error) fetchJobs();
  }

  // ── Reports ───────────────────────────────────────────────────────────
  async function handleSendReport(isAuto = false) {
    if (!reportEmail) return notify("Set report email in Reports tab", "err");
    setReportSending(true);
    const reportDate = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    try {
      const token = await getGoogleToken(
        "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive.file",
        session, clientId
      );
      // Build report
      const htmlBody = buildReportHTML(jobs, reportDate, profile.full_name || session.user.email);
      const { wb, filename } = generateBeautifulExcel(jobs);
      const xlsxBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" });

      // Send email
      await sendEmailViaGmail(reportEmail, `📊 JobBoard Pro Daily Report — ${reportDate}`, htmlBody, token);
      // Save to Drive
      await saveFileToDrive(filename, xlsxBuf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", token);

      const entry = { date: todayStr(), time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), jobs: jobs.length, isAuto };
      const newLog = [entry, ...reportLog].slice(0, 30);
      setReportLog(newLog);
      localStorage.setItem("reportLog", JSON.stringify(newLog));
      localStorage.setItem("lastReportDate", todayStr());
      notify(`${isAuto ? "Auto-" : ""}Report sent & saved to Drive ✓`);
    } catch (err) { notify("Report failed: " + err.message, "err"); }
    setReportSending(false);
  }

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

  function saveSettings() {
    localStorage.setItem("geminiKey", geminiKey);
    localStorage.setItem("googleClientId", clientId);
    localStorage.setItem("aiModel", aiModel);
    localStorage.setItem("proxyUrl", proxyUrl);
    localStorage.setItem("adzunaId", adzunaId);
    localStorage.setItem("adzunaKey", adzunaKey);
    localStorage.setItem("reportEmail", reportEmail);
    localStorage.setItem("autoReport", String(autoReport));
    localStorage.setItem("reportTime", reportTime);
    notify("Settings saved ✓");
    setShowSettings(false);
  }

  // ── Search ────────────────────────────────────────────────────────────
  function buildAdzunaUrl(page = 1) {
    const expLevel = EXPERIENCE_LEVELS.find(e => e.value === sExperience);
    let what = sq.trim();
    if (expLevel?.keywords) what = what ? `${what} ${expLevel.keywords}` : expLevel.keywords;
    let url = `https://api.adzuna.com/v1/api/jobs/in/search/${page}?app_id=${adzunaId}&app_key=${adzunaKey}&results_per_page=50&content-type=application/json`;
    if (what) url += `&what=${encodeURIComponent(what)}`;
    if (sLocation.trim()) url += `&where=${encodeURIComponent(sLocation.trim())}`;
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
    if (!sq.trim() && !sLocation.trim() && !sCategory && !sExperience) { setSErr("Enter a keyword or select filters."); return; }
    if (!adzunaId || !adzunaKey) { setSErr("Add Adzuna credentials in ⚙️ Settings."); return; }
    setSLoad(true); if (reset) { setSr([]); setSErr(""); setSPage(1); setSTotalResults(0); }
    try {
      const page = reset ? 1 : sPage + 1;
      const res = await fetch(buildAdzunaUrl(page));
      if (!res.ok) throw new Error(`Adzuna error ${res.status}`);
      const data = await res.json();
      if (!data.results?.length) { setSErr("No results — try different keywords."); setSLoad(false); return; }
      const mapped = mapAdzuna(data.results);
      if (reset) { setSr(mapped); setSPage(1); } else { setSr(p => [...p, ...mapped]); setSPage(p => p + 1); }
      if (data.count) setSTotalResults(data.count);
    } catch (err) { setSErr(err.message); }
    setSLoad(false);
  }

  function saveSearch() {
    const label = sq || sCategory || sLocation || "Search";
    const search = { label, sq, sLocation, sJobType, sSalaryMin, sCategory, sExperience, date: new Date().toLocaleDateString() };
    const updated = [search, ...savedSearches.filter(s => s.label !== label)].slice(0, 5);
    setSavedSearches(updated); localStorage.setItem("savedSearches", JSON.stringify(updated));
    notify("Search saved ✓");
  }

  async function addFromSearch(r) {
    const payload = { title: r.title, company: r.company, location: r.location || "", type: r.type || "Full-time", salary: r.salary || "Not disclosed", skills: r.skills || "", source: "Adzuna", applylink: r.applylink || "", status: "Bookmarked", applieddate: "", deadline: "", notes: [r.category ? `Category: ${r.category}` : "", r.description || ""].filter(Boolean).join("\n").trim(), priority: "Medium", user_id: session.user.id };
    const { error } = await supabase.from("jobs").insert([payload]);
    if (!error) { fetchJobs(); notify(`"${r.title}" bookmarked ✓`); } else notify(error.message, "err");
  }

  // ── AI Features ───────────────────────────────────────────────────────
  async function doPrep(job) {
    if (!job) return;
    setPrepLoad(true); setPrepOut(""); setShowPrep(job);
    const profileCtx = profile.skills ? `\nCandidate profile: ${profile.headline || ""}. Skills: ${profile.skills}. Background: ${profile.summary || ""}` : "";
    try {
      const t = await AI(
        `Create a detailed interview prep guide for "${job.title}" at ${job.company}.${profileCtx}
        Include: 6 technical Q&A (skills: ${job.skills}), 3 STAR behavioral questions with sample answers, 3 questions to ask them, company research tips for ${job.company}, 5 key preparation tasks. Use clear headers.`,
        "You are an expert career coach. Be specific and actionable."
      );
      setPrepOut(t);
    } catch (err) { setPrepOut("Error: " + err.message); }
    setPrepLoad(false);
  }

  async function doCover(job) {
    if (!job) return;
    setCoverLoad(true); setCoverOut("");
    const profileCtx = profile.full_name ? `Name: ${profile.full_name}. Skills: ${profile.skills}. Experience: ${profile.experience}. ${profile.summary}` : bio || "Recent graduate";
    try {
      const t = await AI(
        `Write a compelling professional cover letter for: Role: ${job.title} at ${job.company} (${job.location}). Required skills: ${job.skills}. Candidate background: ${profileCtx}. Be specific, genuine, 3 strong paragraphs. No clichés.`,
        "You are a professional career writer. Write natural, tailored, compelling cover letters."
      );
      setCoverOut(t);
    } catch (err) { setCoverOut("Error: " + err.message); }
    setCoverLoad(false);
  }

  // ── Gmail Scanner ─────────────────────────────────────────────────────
  async function startGmailScan() {
    setGmailLoading(true); setGmailEmails([]); setGmailStats(null);
    setGmailStatus({ msg: "Authorizing…", type: "loading" });
    try {
      const token = await getGoogleToken("https://www.googleapis.com/auth/gmail.readonly", session, clientId);
      await fetchAndParseEmails(token);
    } catch (err) { setGmailStatus({ msg: "Error: " + err.message, type: "error" }); setGmailLoading(false); }
  }

  async function fetchAndParseEmails(token) {
    try {
      setGmailStatus({ msg: "Searching inbox…", type: "loading" });
      let baseQ = `(subject:interview OR subject:offer OR subject:application OR subject:rejected OR subject:assessment) newer_than:${gmailDays}d`;
      if (gmailExtra) baseQ += ` ${gmailExtra}`;
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(baseQ)}&maxResults=35`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.messages?.length) { setGmailStatus({ msg: "No job-related emails found.", type: "success" }); setGmailLoading(false); return; }
      setGmailStatus({ msg: `Reading ${data.messages.length} emails…`, type: "loading" });
      const batch = await Promise.all(data.messages.map(m => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())));
      const payload = batch.map(d => {
        let subject = "", sender = "", date = "";
        d.payload?.headers?.forEach(h => {
          if (h.name.toLowerCase() === "subject") subject = h.value;
          if (h.name.toLowerCase() === "from") sender = h.value;
          if (h.name.toLowerCase() === "date") date = h.value;
        });
        return { subject, sender, date, snippet: d.snippet };
      });
      setGmailStatus({ msg: "Analyzing with AI…", type: "loading" });
      const text = await AI(`Analyze these job-related emails. Return a JSON array only. Each object: {company,jobTitle,status(Applied|Screening|Interview Scheduled|Interview Done|Offer Received|Rejected|Pending),interviewDate,interviewTime,interviewType,sender,date,snippet,subject}. ONLY valid JSON array:\n${JSON.stringify(payload)}`, "Return only a valid JSON array, no markdown.");
      const match = text.replace(/```json|```/g, "").trim().match(/\[[\s\S]*\]/);
      const emails = match ? JSON.parse(match[0]) : [];
      if (emails.length) {
        setGmailEmails(emails);
        const stats = { total: emails.length, applied: emails.filter(e => e.status === "Applied").length, interview: emails.filter(e => e.status.includes("Interview")).length, offer: emails.filter(e => e.status.includes("Offer") || e.status === "Accepted").length, rejected: emails.filter(e => e.status === "Rejected").length, pending: emails.filter(e => e.status === "Pending").length };
        setGmailStats(stats);
        setGmailRows(emails.map((e, i) => ({ id: i + 1, date: e.date ? e.date.split("T")[0] : "", company: e.company || "", jobTitle: e.jobTitle || "", status: e.status || "Applied", interviewDate: e.interviewDate || "", interviewTime: e.interviewTime || "", interviewType: e.interviewType || "", notes: e.snippet || "" })));
        setGmailStatus({ msg: `✓ Found ${emails.length} job-related emails`, type: "success" });
      } else setGmailStatus({ msg: "✓ No matched emails.", type: "success" });
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
      notify("Requesting Drive access…");
      const token = await getGoogleToken("https://www.googleapis.com/auth/drive.file", session, clientId);
      const { wb, filename } = generateBeautifulExcel(jobs);
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      await saveFileToDrive(filename, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", token);
      notify(`"${filename}" saved to Google Drive ✓`);
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
        mapped.forEach(r => { const isDup = jobs.some(j => j.title.toLowerCase() === r.title.toLowerCase() && j.company.toLowerCase() === r.company.toLowerCase()); if (isDup) skipped++; else newJobs.push(r); });
        if (!newJobs.length) { notify(`All ${skipped} jobs already exist`); return; }
        const doBatches = async () => { for (let i = 0; i < newJobs.length; i += 500) { const { error } = await supabase.from("jobs").insert(newJobs.slice(i, i + 500)); if (error) { notify(error.message, "err"); return; } } fetchJobs(); notify(`Imported ${newJobs.length} jobs ✓${skipped > 0 ? ` (${skipped} skipped)` : ""}`); };
        doBatches();
      } catch { notify("Import failed — check format", "err"); }
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
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(event) });
      if (!res.ok) throw new Error("Failed to create event");
      notify("Added to Google Calendar ✓");
    } catch (err) { notify("Calendar: " + err.message, "err"); }
  }

  async function saveToDrive(filename, content) {
    try {
      const token = await getGoogleToken("https://www.googleapis.com/auth/drive.file", session, clientId);
      await saveFileToDrive(filename, content, "text/plain", token);
      notify(`Saved to Drive ✓`);
    } catch (err) { notify("Drive: " + err.message, "err"); }
  }

  // ── Filter / Sort ─────────────────────────────────────────────────────
  const baseVisible = jobs.filter(j => filterType === "All" || j.type === filterType).filter(j => filterPri === "All" || j.priority === filterPri).filter(j => !q || (j.title + j.company + j.skills + j.location).toLowerCase().includes(q.toLowerCase()));
  const visible = baseVisible.filter(j => filterStatus === "All" || j.status === filterStatus).sort((a, b) => { let av = sortK === "id" ? a.id : (a[sortK] ?? ""), bv = sortK === "id" ? b.id : (b[sortK] ?? ""); return sortD === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1); });
  function toggleSort(k) { if (sortK === k) setSortD(d => d === "asc" ? "desc" : "asc"); else { setSortK(k); setSortD("asc"); } }
  const sIcon = k => sortK === k ? (sortD === "asc" ? "↑" : "↓") : <span style={{ opacity: .2 }}>↕</span>;

  const stats = STATUS.reduce((a, s) => { a[s] = baseVisible.filter(j => j.status === s).length; return a }, {});
  const overdue = jobs.filter(j => j.deadline && daysDiff(j.deadline) < 0 && !["Rejected", "Withdrawn", "Offer"].includes(j.status)).length;
  const soonDue = jobs.filter(j => j.deadline && daysDiff(j.deadline) >= 0 && daysDiff(j.deadline) <= 7 && !["Rejected", "Withdrawn", "Offer"].includes(j.status)).length;
  const filteredGmail = gmailEmails.filter(e => gmailFilter === "all" || e.status === gmailFilter);
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
        .search-card{background:#06101e;border:1px solid #0f1c2e;border-radius:14px;padding:16px;transition:all .2s;position:relative;overflow:hidden}
        .search-card:hover{border-color:#1e2d45;background:#07111f}
        input::placeholder{color:#334155}textarea::placeholder{color:#334155}select option{background:#070f1c}
        .profile-field{background:#070f1c;border:1px solid #1e2d45;border-radius:8px;padding:10px 12px;color:#e2e8f0;font-size:12px;line-height:1.6;min-height:36px}
      `}</style>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={importXLSX} />
      <input ref={resumeRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: "none" }} onChange={handleResumeFile} />

      {/* Toast */}
      {toast && <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: toast.t === "err" ? "#2d0a0a" : "#061a0f", border: `1px solid ${toast.t === "err" ? "#7f1d1d" : "#14532d"}`, color: toast.t === "err" ? "#fca5a5" : "#6ee7b7", padding: "11px 18px", borderRadius: 12, fontSize: 13, animation: "mi .2s ease", maxWidth: 340, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16 }}>{toast.t === "err" ? "⚠️" : "✓"}</span>{toast.m}
      </div>}

      {/* HEADER */}
      <div style={{ background: "#050d1a", borderBottom: "1px solid #0a1628", padding: "14px 24px", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, maxWidth: 1480, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#1d4ed8,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>🎯</div>
            <div>
              <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 19, fontWeight: 800, margin: 0, background: "linear-gradient(90deg,#60a5fa,#818cf8,#c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>JobBoard Pro</h1>
              <p style={{ color: "#1e2d45", fontSize: 9, marginTop: 1, letterSpacing: "0.05em" }}>Search · Track · Profile · Reports</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
            {profile.full_name && <span style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>👤 {profile.full_name.split(" ")[0]}</span>}
            <Btn onClick={() => setShowSearch(true)} v="cyn" sx={{ fontWeight: 700 }}>🔍 Find Jobs</Btn>
            <Btn onClick={() => setShowSettings(true)} v="ghost">⚙️</Btn>
            <Btn onClick={() => supabase.auth.signOut()} v="red">⏏️</Btn>
            <div style={{ width: 1, height: 20, background: "#1e2d45" }} />
            <Btn onClick={openAdd} v="pri">＋ Add Job</Btn>
            <Btn onClick={() => fileRef.current.click()} v="ghost">📂</Btn>
            <Btn onClick={exportXLSX} v="grn">📥 Excel</Btn>
            <Btn onClick={exportAndSaveToDrive} v="vio">☁️ Drive</Btn>
          </div>
        </div>
      </div>

      {/* ALERT BAR */}
      {(overdue > 0 || soonDue > 0) && <div style={{ background: "#050d1a", borderBottom: "1px solid #0a1628", padding: "7px 24px" }}>
        <div style={{ maxWidth: 1480, margin: "0 auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
          {overdue > 0 && <span style={{ background: "rgba(220,38,38,0.08)", border: "1px solid #7f1d1d", color: "#f87171", padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>🔴 {overdue} deadline{overdue > 1 ? "s" : ""} overdue</span>}
          {soonDue > 0 && <span style={{ background: "rgba(245,158,11,0.08)", border: "1px solid #78350f", color: "#fbbf24", padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>⏰ {soonDue} due this week</span>}
          {autoReport && <span style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8", padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>📧 Auto-report {reportTime}</span>}
        </div>
      </div>}

      {/* STATUS FILTER */}
      <div style={{ background: "#050d1a", borderBottom: "1px solid #0a1628", padding: "9px 24px" }}>
        <div style={{ maxWidth: 1480, margin: "0 auto", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {[["All", baseVisible.length, "#60a5fa"], ...STATUS.map(s => [s, stats[s], SC[s].dot])].map(([s, c, col]) => (
              <button key={s} onClick={() => setFS(s)} style={{ background: filterStatus === s ? `${col}18` : "transparent", border: `1px solid ${filterStatus === s ? col : "#1e2d45"}`, borderRadius: 8, padding: "4px 12px", color: filterStatus === s ? "#f1f5f9" : "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all .15s", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
                {filterStatus === s && <span style={{ width: 5, height: 5, borderRadius: "50%", background: col }} />}
                {s} <span style={{ color: col, fontWeight: 700 }}>{c}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
          {[["table", "📋 Table"], ["kanban", "🗂 Kanban"], ["analytics", "📊 Analytics"], ["gmail", "📧 Gmail"], ["profile", "👤 Profile"], ["reports", "📨 Reports"]].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} className={`nav-tab${tab === t ? " active" : ""}`}>
              {l}
              {t === "profile" && profileComplete < 3 && <span style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24", padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>Setup</span>}
              {t === "reports" && autoReport && <span style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#86efac", padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>ON</span>}
              {t === "gmail" && <span style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", color: "#06b6d4", padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>AI</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 1480, margin: "0 auto", padding: "22px 24px" }}>

        {/* TABLE */}
        {tab === "table" && <>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none", opacity: .4 }}>🔍</span>
              <Inp value={q} onChange={e => setQ(e.target.value)} placeholder="Search title, company, skills, location…" sx={{ paddingLeft: 34 }} />
            </div>
            <span style={{ color: "#334155", fontSize: 12 }}>{visible.length} result{visible.length !== 1 ? "s" : ""}</span>
            {q && <button onClick={() => setQ("")} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>✕ Clear</button>}
          </div>
          <div style={{ overflowX: "auto", borderRadius: 14, border: "1px solid #0a1628", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#06101e", borderBottom: "1px solid #0a1628" }}>
                  {[["title", "Role", 220], ["company", "Company", 130], ["location", "Location", 100], ["salary", "Salary", 95], ["status", "Status", 130], ["priority", "Pri", 65], ["deadline", "Deadline", 105], ["applieddate", "Applied", 85], ["", "Actions", 140]].map(([k, h, w]) => (
                    <th key={h} onClick={k ? () => toggleSort(k) : undefined} style={{ padding: "10px 13px", color: "#334155", fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", textAlign: "left", cursor: k ? "pointer" : "default", minWidth: w, userSelect: "none" }}>{h}{k && <span style={{ marginLeft: 3 }}>{sIcon(k)}</span>}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: "60px", color: "#1e2d45" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📭</div><div style={{ fontSize: 13, color: "#334155" }}>No jobs match your filters</div></td></tr>}
                {visible.map(job => (
                  <tr key={job.id} className="row" style={{ borderBottom: "1px solid #06101e" }}>
                    <td style={{ padding: "11px 13px" }}>
                      <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                        {job.applylink ? <a href={job.applylink} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "none" }}>{job.title}</a> : job.title}
                      </div>
                      {job.skills && <div style={{ color: "#334155", fontSize: 10, marginTop: 2 }}>{job.skills.split(",").slice(0, 3).join(" · ")}</div>}
                      {profile.skills && <MatchBadge score={calcMatchScore(job.skills, profile.skills)} />}
                    </td>
                    <td style={{ padding: "11px 13px", color: "#94a3b8", fontWeight: 500 }}>{job.company}</td>
                    <td style={{ padding: "11px 13px", color: "#475569", whiteSpace: "nowrap", fontSize: 11 }}>{job.location}</td>
                    <td style={{ padding: "11px 13px", color: "#a78bfa", whiteSpace: "nowrap", fontWeight: 600 }}>{job.salary || "—"}</td>
                    <td style={{ padding: "11px 13px" }}>
                      <Badge s={job.status} />
                      <select value={job.status} onChange={e => setStatus(job.id, e.target.value)} style={{ display: "block", marginTop: 4, background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 6, padding: "2px 6px", color: "#475569", fontSize: 10, cursor: "pointer", outline: "none", width: "100%", fontFamily: "inherit" }}>
                        {STATUS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "11px 13px" }}><PriBadge p={job.priority} /></td>
                    <td style={{ padding: "11px 13px" }}><Deadline date={job.deadline} />{job.deadline && <div style={{ color: "#334155", fontSize: 9, marginTop: 2 }}>{fmtDate(job.deadline)}</div>}</td>
                    <td style={{ padding: "11px 13px", color: "#334155", fontSize: 10, whiteSpace: "nowrap" }}>{fmtDate(job.applieddate)}</td>
                    <td style={{ padding: "11px 13px" }}>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {[["👁", "Details", () => setShowDetail(job)], ["🎙", "Prep", () => doPrep(job)], ["✉", "Cover", () => { setShowCover(job); setCoverOut(""); }], ["📅", "Cal", () => addToCalendar(job)], ["✏️", "Edit", () => openEdit(job)], ["🗑", "Del", () => delJob(job.id)]].map(([ic, tt, fn]) => (
                          <button key={tt} onClick={fn} title={tt} className="hbtn" style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 7, padding: "4px 6px", color: "#64748b", cursor: "pointer", fontSize: 11 }}>{ic}</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* KANBAN */}
        {tab === "kanban" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(195px,1fr))", gap: 14 }}>
          {STATUS.map(col => {
            const cj = baseVisible.filter(j => j.status === col); const c = SC[col];
            return <div key={col} className="kb-drop" style={{ background: "#06101e", border: `1px solid ${c.border}20`, borderTop: `3px solid ${c.border}`, borderRadius: 14, padding: 14, minHeight: 170 }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("over") }}
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
                    {profile.skills && job.skills && <div style={{ marginTop: 4 }}><MatchBadge score={calcMatchScore(job.skills, profile.skills)} /></div>}
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
            <StatCard label="Total" value={baseVisible.length} color="#60a5fa" icon="📋" sub={`${jobs.length} total`} />
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
          <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22, marginBottom: 20 }}>
            <div style={{ color: "#06b6d4", fontWeight: 700, fontSize: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>🔍 Scan Gmail for Job Emails<span style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", padding: "2px 8px", borderRadius: 999, fontSize: 10 }}>Gmail API + AI</span></div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <input type="number" value={gmailDays} onChange={e => setGmailDays(e.target.value)} min="1" max="365" placeholder="Days" style={{ width: 90, background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              <input value={gmailExtra} onChange={e => setGmailExtra(e.target.value)} placeholder="Extra keywords…" style={{ flex: 1, minWidth: 200, background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              <Btn v="cyn" onClick={startGmailScan} disabled={gmailLoading}>{gmailLoading ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Scanning…</> : "⚡ Scan Gmail"}</Btn>
              <Btn v="ghost" onClick={() => { setGmailEmails([]); setGmailStats(null); setGmailStatus({ msg: "Cleared.", type: "" }); setGmailRows([{ id: 1, date: "", company: "", jobTitle: "", status: "Applied", interviewDate: "", interviewTime: "", interviewType: "", notes: "" }]); }}>✕ Clear</Btn>
            </div>
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
            const initials = (email.company || "?").substring(0, 2).toUpperCase();
            return <div key={i} className="email-card" style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 14, padding: 16, marginBottom: 10, borderLeft: `3px solid ${sc.accent}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: sc.lb, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials}</div>
                  <div><div style={{ fontWeight: 700, fontSize: 14 }}>{email.company || "Unknown"}</div><div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{email.jobTitle || email.subject || "Position"}</div></div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ background: sc.bg, color: sc.fg, padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>{email.status}</span>
                  <Btn v="grn" onClick={() => addGmailToTracker(email)} sx={{ padding: "5px 11px", fontSize: 11 }}>+ Add to Tracker</Btn>
                </div>
              </div>
              {email.snippet && <div style={{ color: "#8eafd0", fontSize: 13, marginBottom: 8, lineHeight: 1.6 }}>{email.snippet}</div>}
              {email.interviewDate && <div style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 8, padding: "7px 12px", marginBottom: 8, fontSize: 12, color: "#60a5fa", fontWeight: 600 }}>📅 Interview: {email.interviewDate}{email.interviewTime && ` at ${email.interviewTime}`}{email.interviewType && ` — ${email.interviewType}`}</div>}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{email.sender && <span style={{ fontSize: 11, color: "#475569" }}>📧 {email.sender}</span>}{email.date && <span style={{ fontSize: 11, color: "#475569" }}>🗓 {email.date}</span>}</div>
            </div>;
          })}
          <div style={{ marginTop: 20 }}>
            <div style={{ color: "#94a3b8", fontWeight: 700, fontSize: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>📋 Application Tracker <span style={{ color: "#334155", fontWeight: 400, fontSize: 11 }}>(editable)</span></div>
            <div style={{ overflowX: "auto", borderRadius: 14, border: "1px solid #0a1628" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "#06101e", borderBottom: "1px solid #0a1628" }}>{["#", "Date", "Company", "Job Title", "Status", "Interview Date", "Time", "Type", "Notes"].map(h => <th key={h} style={{ padding: "9px 12px", color: "#334155", fontWeight: 700, fontSize: 10, letterSpacing: "0.07em", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {gmailRows.map((row, i) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #06101e" }}>
                      <td style={{ padding: "8px 12px", color: "#334155", fontSize: 11 }}>{row.id}</td>
                      <td style={{ padding: "4px 8px" }}><input value={row.date} onChange={e => setGmailRows(rs => rs.map((r, j) => j === i ? { ...r, date: e.target.value } : r))} placeholder="YYYY-MM-DD" style={{ background: "transparent", border: "none", color: "#e2e8f0", fontFamily: "inherit", fontSize: 12, width: 110, outline: "none" }} /></td>
                      <td style={{ padding: "4px 8px" }}><input value={row.company} onChange={e => setGmailRows(rs => rs.map((r, j) => j === i ? { ...r, company: e.target.value } : r))} placeholder="Company" style={{ background: "transparent", border: "none", color: "#e2e8f0", fontFamily: "inherit", fontSize: 12, width: 120, outline: "none" }} /></td>
                      <td style={{ padding: "4px 8px" }}><input value={row.jobTitle} onChange={e => setGmailRows(rs => rs.map((r, j) => j === i ? { ...r, jobTitle: e.target.value } : r))} placeholder="Job title" style={{ background: "transparent", border: "none", color: "#e2e8f0", fontFamily: "inherit", fontSize: 12, width: 160, outline: "none" }} /></td>
                      <td style={{ padding: "4px 8px" }}><select value={row.status} onChange={e => setGmailRows(rs => rs.map((r, j) => j === i ? { ...r, status: e.target.value } : r))} style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 6, padding: "3px 6px", color: "#e2e8f0", fontSize: 11, cursor: "pointer", outline: "none", fontFamily: "inherit" }}>{["Applied", "Screening", "Interview Scheduled", "Interview Done", "Offer Received", "Accepted", "Rejected", "Withdrawn"].map(s => <option key={s}>{s}</option>)}</select></td>
                      {["interviewDate", "interviewTime", "interviewType", "notes"].map(k => (
                        <td key={k} style={{ padding: "4px 8px" }}><input value={row[k]} onChange={e => setGmailRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: e.target.value } : r))} placeholder={k === "interviewType" ? "Video/Phone" : k === "notes" ? "Notes…" : ""} style={{ background: "transparent", border: "none", color: "#e2e8f0", fontFamily: "inherit", fontSize: 12, width: k === "notes" ? 200 : 100, outline: "none" }} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setGmailRows(rs => [...rs, { id: rs.length + 1, date: "", company: "", jobTitle: "", status: "Applied", interviewDate: "", interviewTime: "", interviewType: "", notes: "" }])} style={{ width: "100%", marginTop: 10, background: "rgba(16,185,129,0.06)", border: "1px dashed rgba(16,185,129,0.25)", color: "#10b981", borderRadius: 10, padding: "10px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>＋ Add Row</button>
          </div>
        </div>}

        {/* ═══ PROFILE TAB ═══ */}
        {tab === "profile" && <div>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800, color: "#f1f5f9", margin: 0 }}>👤 Your Profile</h2>
              <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>Upload your resume to auto-fill. Profile powers AI cover letters, interview prep & job matching.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn v="ghost" onClick={() => resumeRef.current.click()}>📎 Upload Resume</Btn>
              <Btn v="pri" onClick={saveProfile} disabled={profileSaving}>{profileSaving ? "Saving…" : "💾 Save Profile"}</Btn>
            </div>
          </div>

          {/* Resume Parser */}
          <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ color: "#a78bfa", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                📄 Resume Parser <span style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa", padding: "2px 8px", borderRadius: 999, fontSize: 10 }}>AI-Powered</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn v="ghost" onClick={() => resumeRef.current.click()} sx={{ fontSize: 11 }}>📎 Upload PDF/TXT</Btn>
                <Btn v="vio" onClick={parseResume} disabled={resumeParsing || !resumeText.trim()}>{resumeParsing ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Parsing…</> : "⚡ Parse Resume"}</Btn>
              </div>
            </div>
            <Txt value={resumeText} onChange={e => setResumeText(e.target.value)} placeholder="Paste your complete resume text here, or upload a PDF/TXT file above…

The AI will extract: name, contact details, skills, education, work experience, certifications and more.
Then review & save to your profile." rows={7} sx={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }} />
            <div style={{ marginTop: 10, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#8b5cf6", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0 }}>💡</span>
              <span>Supports PDF (text-based), .txt, and pasted text. After parsing, review the extracted data below and save to your profile. Your profile skills are used for <strong>job match scoring</strong> and <strong>AI-personalized</strong> cover letters & interview prep.</span>
            </div>
          </div>

          {/* Profile Fields */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16, marginBottom: 20 }}>
            {/* Personal */}
            <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 14, padding: 18 }}>
              <div style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Personal Info</div>
              <F label="Full Name"><Inp value={profile.full_name || ""} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} placeholder="Your name" /></F>
              <F label="Email"><Inp value={profile.email || ""} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" /></F>
              <F label="Phone"><Inp value={profile.phone || ""} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" /></F>
              <F label="Location"><Inp value={profile.location || ""} onChange={e => setProfile(p => ({ ...p, location: e.target.value }))} placeholder="City, State" /></F>
              <F label="LinkedIn"><Inp value={profile.linkedin || ""} onChange={e => setProfile(p => ({ ...p, linkedin: e.target.value }))} placeholder="linkedin.com/in/…" /></F>
              <F label="GitHub"><Inp value={profile.github || ""} onChange={e => setProfile(p => ({ ...p, github: e.target.value }))} placeholder="github.com/…" /></F>
            </div>

            {/* Professional */}
            <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 14, padding: 18 }}>
              <div style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Professional</div>
              <F label="Headline"><Inp value={profile.headline || ""} onChange={e => setProfile(p => ({ ...p, headline: e.target.value }))} placeholder="e.g. Software Engineer | React & Python" /></F>
              <F label="Summary"><Txt value={profile.summary || ""} onChange={e => setProfile(p => ({ ...p, summary: e.target.value }))} placeholder="2-3 sentence professional summary…" rows={3} /></F>
              <F label="Skills" hint={profile.skills ? `${profile.skills.split(",").length} skills` : ""}><Txt value={profile.skills || ""} onChange={e => setProfile(p => ({ ...p, skills: e.target.value }))} placeholder="React, Python, SQL, Node.js…" rows={3} /></F>
              <F label="Certifications"><Inp value={profile.certifications || ""} onChange={e => setProfile(p => ({ ...p, certifications: e.target.value }))} placeholder="AWS, Google, etc." /></F>
            </div>

            {/* Background */}
            <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 14, padding: 18 }}>
              <div style={{ color: "#86efac", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Background</div>
              <F label="Education"><Txt value={profile.education || ""} onChange={e => setProfile(p => ({ ...p, education: e.target.value }))} placeholder="B.E. Computer Science — Anna University 2026" rows={3} /></F>
              <F label="Experience"><Txt value={profile.experience || ""} onChange={e => setProfile(p => ({ ...p, experience: e.target.value }))} placeholder="Intern @ Company (Jun–Aug 2025)&#10;Project: …" rows={4} /></F>
              <F label="Languages"><Inp value={profile.languages || ""} onChange={e => setProfile(p => ({ ...p, languages: e.target.value }))} placeholder="English, Tamil, Hindi" /></F>
            </div>

            {/* Job Preferences */}
            <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 14, padding: 18 }}>
              <div style={{ color: "#fde047", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Job Preferences</div>
              <F label="Target Roles"><Inp value={profile.target_roles || ""} onChange={e => setProfile(p => ({ ...p, target_roles: e.target.value }))} placeholder="Software Engineer, Data Analyst…" /></F>
              <F label="Target Locations"><Inp value={profile.target_locations || ""} onChange={e => setProfile(p => ({ ...p, target_locations: e.target.value }))} placeholder="Chennai, Bangalore, Remote" /></F>
              <F label="Expected Salary"><Inp value={profile.expected_salary || ""} onChange={e => setProfile(p => ({ ...p, expected_salary: e.target.value }))} placeholder="₹6–8 LPA" /></F>
              <F label="Portfolio"><Inp value={profile.portfolio || ""} onChange={e => setProfile(p => ({ ...p, portfolio: e.target.value }))} placeholder="yoursite.dev" /></F>

              {/* Skills visualization */}
              {profile.skills && <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1e2d45" }}>
                <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Your Skills ({profile.skills.split(",").filter(s => s.trim()).length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {profile.skills.split(",").filter(s => s.trim()).map(sk => (
                    <span key={sk} style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{sk.trim()}</span>
                  ))}
                </div>
              </div>}
            </div>
          </div>

          <Btn v="pri" onClick={saveProfile} disabled={profileSaving} sx={{ width: "100%", justifyContent: "center", padding: "13px", fontSize: 14 }}>
            {profileSaving ? "Saving…" : "💾 Save Profile"}
          </Btn>
        </div>}

        {/* ═══ REPORTS TAB ═══ */}
        {tab === "reports" && <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800, color: "#f1f5f9", margin: 0 }}>📨 Daily Reports</h2>
              <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>Auto-generates a beautiful HTML email + Excel file, sends to your inbox and saves to Google Drive daily.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn v="ghost" onClick={previewReport}>👁 Preview</Btn>
              <Btn v="grn" onClick={downloadReport}>📥 Download Excel</Btn>
              <Btn v="vio" onClick={() => handleSendReport()} disabled={reportSending}>{reportSending ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Sending…</> : "📧 Send Report Now"}</Btn>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* Config */}
            <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22 }}>
              <div style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>⚙️ Report Configuration</div>
              <F label="Send To Email"><Inp value={reportEmail} onChange={e => setReportEmail(e.target.value)} placeholder="your@email.com" type="email" /></F>
              <F label="Daily Send Time"><Inp value={reportTime} onChange={e => setReportTime(e.target.value)} type="time" /></F>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
                <div>
                  <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>Auto Daily Report</div>
                  <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>Automatically send at configured time</div>
                </div>
                <button onClick={() => setAutoReport(v => { localStorage.setItem("autoReport", String(!v)); return !v; })} style={{ width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", transition: "all .2s", background: autoReport ? "#4f46e5" : "#1e2d45", position: "relative" }}>
                  <span style={{ position: "absolute", top: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "all .2s", left: autoReport ? "23px" : "3px" }} />
                </button>
              </div>
              <Btn v="pri" onClick={saveSettings} sx={{ width: "100%", justifyContent: "center", padding: "11px" }}>Save Settings</Btn>
              <div style={{ marginTop: 14, background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.12)", borderRadius: 10, padding: "12px 14px", fontSize: 11, color: "#06b6d4", lineHeight: 1.7 }}>
                <strong>📋 What's included:</strong><br />
                • Summary stats & status breakdown<br />
                • Upcoming deadlines (this week)<br />
                • Active interview pipeline<br />
                • Recent applications table<br />
                • Career tips & action items<br />
                • Beautiful Excel (5 sheets) saved to Drive
              </div>
            </div>

            {/* Stats + Log */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Stats */}
              <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22 }}>
                <div style={{ color: "#86efac", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>📊 Report Stats</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[["Reports Sent", reportLog.length, "#60a5fa"], ["Applications", jobs.length, "#86efac"], ["Interviews", stats.Interview || 0, "#22c55e"], ["Offers", stats.Offer || 0, "#fde047"]].map(([l, v, c]) => (
                    <div key={l} style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: "14px", textAlign: "center" }}>
                      <div style={{ color: c, fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>{v}</div>
                      <div style={{ color: "#334155", fontSize: 10, marginTop: 3 }}>{l}</div>
                    </div>
                  ))}
                </div>
                {reportLog.length > 0 && <div style={{ marginTop: 12, padding: "10px 14px", background: "#070f1c", borderRadius: 10, border: "1px solid #1e2d45", fontSize: 11, color: "#475569", display: "flex", justifyContent: "space-between" }}>
                  <span>Last sent:</span><span style={{ color: "#86efac", fontWeight: 600 }}>{reportLog[0].date} at {reportLog[0].time}</span>
                </div>}
              </div>

              {/* Log */}
              <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22, flex: 1 }}>
                <div style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>📋 Report History</div>
                {reportLog.length === 0 ? <div style={{ color: "#1e2d45", fontSize: 13, textAlign: "center", padding: "24px 0" }}>No reports sent yet</div> :
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 240, overflowY: "auto" }}>
                    {reportLog.map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 8, padding: "10px 14px" }}>
                        <div><div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{r.date}</div><div style={{ color: "#475569", fontSize: 10, marginTop: 2 }}>at {r.time} · {r.jobs} jobs{r.isAuto ? " · auto" : ""}</div></div>
                        <span style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#86efac", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>✓ Sent</span>
                      </div>
                    ))}
                  </div>}
              </div>
            </div>
          </div>

          {/* What's in the Excel */}
          <div style={{ background: "#06101e", border: "1px solid #1e2d45", borderRadius: 16, padding: 22 }}>
            <div style={{ color: "#fde047", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>📊 Excel File Contents (5 Sheets)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
              {[
                ["📋 Active Applications", "All non-rejected/withdrawn jobs with full details", "#60a5fa"],
                ["📁 All Applications", "Complete history of every job tracked", "#94a3b8"],
                ["📊 Summary", "Stats, sources, locations, companies breakdown", "#86efac"],
                ["🎙 Interview Pipeline", "Current interviews & offers in progress", "#fde047"],
                ["⏰ Deadlines", "Jobs with deadlines in the next 14 days", "#f97316"],
              ].map(([title, desc, col]) => (
                <div key={title} style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: "14px" }}>
                  <div style={{ color: col, fontWeight: 700, fontSize: 12, marginBottom: 5 }}>{title}</div>
                  <div style={{ color: "#475569", fontSize: 11, lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>}

      </div>

      {/* ══════════════ MODALS ══════════════ */}

      {/* Settings */}
      {showSettings && <Modal title="⚙️ Settings" onClose={() => setShowSettings(false)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <F label="NVIDIA/DeepSeek API Key"><Inp type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="nvapi-…" /></F>
          <F label="API Proxy URL"><Inp value={proxyUrl} onChange={e => setProxyUrl(e.target.value)} placeholder="/api/ai" /></F>
          <F label="AI Model"><Inp value={aiModel} onChange={e => setAiModel(e.target.value)} placeholder="deepseek-ai/deepseek-r1" /></F>
          <F label="Google Client ID"><Inp value={clientId} onChange={e => setClientId(e.target.value)} placeholder="…apps.googleusercontent.com" /></F>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
          <div><div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>Auto Daily Report</div><div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>Auto-send at {reportTime}</div></div>
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
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn v="vio" onClick={() => handleSendReport()} disabled={reportSending}>{reportSending ? "Sending…" : "📧 Send This Report"}</Btn>
          <Btn v="grn" onClick={downloadReport}>📥 Download Excel</Btn>
        </div>
      </Modal>}

      {/* Add / Edit */}
      {showAdd && <Modal title={editId ? "✏️ Edit Job" : "＋ Add New Job"} onClose={() => setShowAdd(false)}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <F label="Job Title *"><Inp value={form.title} onChange={e => upd("title", e.target.value)} placeholder="e.g. Software Engineer" /></F>
          <F label="Company *"><Inp value={form.company} onChange={e => upd("company", e.target.value)} placeholder="e.g. Zoho" /></F>
          <F label="Location"><Inp value={form.location} onChange={e => upd("location", e.target.value)} placeholder="City / Remote" /></F>
          <F label="Salary"><Inp value={form.salary} onChange={e => upd("salary", e.target.value)} placeholder="e.g. ₹6 LPA" /></F>
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

      {/* Job Search Modal */}
      {showSearch && <Modal title="🔍 Live Job Search" onClose={() => { setShowSearch(false); setSr([]); setSErr(""); }} wide>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "8px 14px", background: "#070f1c", borderRadius: 10, border: "1px solid #1e2d45" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: adzunaId && adzunaKey ? "#22c55e" : "#f59e0b", flexShrink: 0, boxShadow: adzunaId && adzunaKey ? "0 0 8px #22c55e" : "none" }} />
          <span style={{ color: adzunaId && adzunaKey ? "#86efac" : "#fbbf24", fontSize: 12 }}>{adzunaId && adzunaKey ? "Live Adzuna job data" : "Add Adzuna credentials in ⚙️ Settings"}</span>
          {sTotalResults > 0 && <span style={{ marginLeft: "auto", color: "#334155", fontSize: 11 }}>{sTotalResults.toLocaleString()} total</span>}
          {profile.skills && <span style={{ color: "#a5b4fc", fontSize: 11 }}>⚡ Match scoring active</span>}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none", opacity: .4 }}>🔍</span>
            <input value={sq} onChange={e => setSq(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()} placeholder='e.g. "React developer", "Python analyst", "Java backend"…' style={{ width: "100%", background: "#070f1c", border: "1px solid #2d4a6b", borderRadius: 10, padding: "12px 14px 12px 38px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} onFocus={e => e.target.style.borderColor = "#4f46e5"} onBlur={e => e.target.style.borderColor = "#2d4a6b"} />
          </div>
          <Btn v="pri" onClick={() => doSearch()} disabled={sLoad} sx={{ padding: "12px 20px", fontSize: 13, fontWeight: 700 }}>{sLoad ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Searching…</> : "Search"}</Btn>
        </div>

        {/* Experience Level */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Experience Level</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {EXPERIENCE_LEVELS.map(lvl => (
              <button key={lvl.value} onClick={() => setSExperience(sExperience === lvl.value ? "" : lvl.value)} style={{ padding: "5px 13px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", background: sExperience === lvl.value ? `${lvl.color}18` : "transparent", border: `1px solid ${sExperience === lvl.value ? lvl.color : "#1e2d45"}`, color: sExperience === lvl.value ? lvl.color : "#64748b", fontFamily: "inherit", transition: "all .15s" }}>
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Saved searches */}
        {savedSearches.length > 0 && <div style={{ marginBottom: 14 }}>
          <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Recent</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {savedSearches.map((s, i) => <button key={i} onClick={() => { setSq(s.sq); setSLocation(s.sLocation); setSJobType(s.sJobType); setSSalaryMin(s.sSalaryMin); setSCategory(s.sCategory); setSExperience(s.sExperience); }} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8", cursor: "pointer", fontFamily: "inherit" }}>🔖 {s.label}</button>)}
          </div>
        </div>}

        {/* Filters */}
        <button onClick={() => setShowFilters(f => !f)} style={{ background: "transparent", border: "1px solid #1e2d45", borderRadius: 8, padding: "6px 14px", color: showFilters ? "#818cf8" : "#475569", fontSize: 11, fontWeight: 600, cursor: "pointer", marginBottom: showFilters ? 14 : 12, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", transition: "all .15s" }}>
          <span style={{ transform: showFilters ? "rotate(180deg)" : "none", transition: "transform .2s", display: "inline-block" }}>▼</span>
          Advanced Filters {activeFilters > 0 && <span style={{ background: "#4f46e5", color: "#fff", borderRadius: 999, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{activeFilters}</span>}
        </button>

        {showFilters && <div style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 12, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <F label="📍 Location"><input value={sLocation} onChange={e => setSLocation(e.target.value)} placeholder="Chennai, Bangalore, Remote…" style={{ width: "100%", background: "#06101e", border: "1px solid #1e2d45", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></F>
            <F label="💼 Contract Type"><select value={sJobType} onChange={e => setSJobType(e.target.value)} style={{ width: "100%", background: "#06101e", border: "1px solid #1e2d45", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit" }}><option value="all">All Types</option><option value="full-time">Full-Time</option><option value="part-time">Part-Time</option><option value="contract">Contract</option><option value="permanent">Permanent</option></select></F>
            <F label="🏷️ Category"><select value={sCategory} onChange={e => setSCategory(e.target.value)} style={{ width: "100%", background: "#06101e", border: "1px solid #1e2d45", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit" }}>{ADZUNA_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></F>
            <F label="💰 Min Salary (₹/yr)"><input type="number" value={sSalaryMin} onChange={e => setSSalaryMin(e.target.value)} placeholder="e.g. 300000 = ₹3 LPA" style={{ width: "100%", background: "#06101e", border: "1px solid #1e2d45", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></F>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Quick Locations</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["Chennai", "Bangalore", "Mumbai", "Hyderabad", "Pune", "Delhi NCR", "Coimbatore", "Remote"].map(loc => <button key={loc} className={`chip${sLocation === loc ? " active" : ""}`} onClick={() => setSLocation(sLocation === loc ? "" : loc)}>{loc}</button>)}</div>
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
              <button onClick={() => { setSLocation(""); setSJobType("all"); setSSalaryMin(""); setSCategory(""); }} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>✕ Reset all</button>
              <Btn v="ghost" onClick={saveSearch} sx={{ fontSize: 11, padding: "5px 12px" }}>🔖 Save Search</Btn>
            </div>
          </div>
        </div>}

        {sLoad && !sr.length && <div style={{ textAlign: "center", padding: "48px 20px", color: "#334155" }}><div style={{ fontSize: 36, display: "inline-block", animation: "spin 1.5s linear infinite", marginBottom: 12 }}>🔍</div><p style={{ fontSize: 13, color: "#475569" }}>Searching Adzuna…</p></div>}
        {sErr && <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid #7f1d1d", borderRadius: 10, padding: "12px 16px", color: "#f87171", fontSize: 12, marginBottom: 14 }}>⚠️ {sErr}</div>}

        {sr.length > 0 && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>{sr.length} jobs{sTotalResults > sr.length && ` of ${sTotalResults.toLocaleString()}`}</span>
            <span style={{ color: "#334155", fontSize: 11 }}>Click + to add to tracker</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 500, overflowY: "auto", paddingRight: 4 }}>
            {sr.map((r, i) => (
              <div key={i} className="search-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                      <div>
                        <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14, lineHeight: 1.3, marginBottom: 2 }}>
                          {r.applylink ? <a href={r.applylink} target="_blank" rel="noreferrer" style={{ color: "#93c5fd", textDecoration: "none" }}>{r.title} <span style={{ fontSize: 11, opacity: .6 }}>↗</span></a> : r.title}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>{r.company}</span>
                          {r.location && <span style={{ color: "#475569", fontSize: 11 }}>📍 {r.location}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                        {r.matchScore > 0 && <MatchBadge score={r.matchScore} />}
                        {r.postedDaysAgo !== null && <span style={{ color: r.postedDaysAgo <= 3 ? "#86efac" : r.postedDaysAgo <= 7 ? "#fbbf24" : "#475569", fontSize: 10, fontWeight: 600, background: r.postedDaysAgo <= 3 ? "rgba(34,197,94,0.08)" : r.postedDaysAgo <= 7 ? "rgba(245,158,11,0.08)" : "transparent", padding: "2px 8px", borderRadius: 999, border: `1px solid ${r.postedDaysAgo <= 3 ? "rgba(34,197,94,0.2)" : r.postedDaysAgo <= 7 ? "rgba(245,158,11,0.2)" : "transparent"}` }}>
                          {r.postedDaysAgo === 0 ? "Today" : r.postedDaysAgo === 1 ? "1d ago" : `${r.postedDaysAgo}d ago`}
                        </span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                      {r.salary && <span style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{r.salary}</span>}
                      <span style={{ background: "#070f1c", border: "1px solid #1e2d45", color: "#64748b", padding: "2px 9px", borderRadius: 999, fontSize: 10 }}>{r.type}</span>
                      {r.category && <span style={{ color: "#475569", fontSize: 10 }}>🏷 {r.category}</span>}
                    </div>
                    {r.skills && <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                      {r.skills.split(", ").map(sk => <span key={sk} style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600 }}>{sk}</span>)}
                    </div>}
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
        {profile.skills && showDetail.skills && <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#86efac" }}>⚡ Your profile match: <strong>{calcMatchScore(showDetail.skills, profile.skills)}%</strong></div>}
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
        {prepLoad && <div style={{ textAlign: "center", padding: "40px", color: "#334155" }}><div style={{ fontSize: 32, display: "inline-block", animation: "spin 1.2s linear infinite", marginBottom: 12 }}>⚡</div><p style={{ fontSize: 12, color: "#475569" }}>Generating personalized prep guide…{profile.skills ? " (using your profile skills)" : ""}</p></div>}
        {!prepLoad && prepOut && <div style={{ background: "#070f1c", border: "1px solid #1e2d45", borderRadius: 12, padding: 18, whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 13, color: "#94a3b8", maxHeight: 520, overflowY: "auto" }}>{prepOut}</div>}
        {!prepOut && !prepLoad && <Btn v="pri" onClick={() => doPrep(showPrep)}>⚡ Generate Prep Guide</Btn>}
        {prepOut && !prepLoad && <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn v="pri" onClick={() => doPrep(showPrep)}>🔄 Regenerate</Btn>
          <Btn onClick={() => { navigator.clipboard?.writeText(prepOut); notify("Copied ✓"); }}>📋 Copy</Btn>
          <Btn v="cyn" onClick={() => saveToDrive(`Interview_Prep_${showPrep.company}.txt`, prepOut)}>☁️ Drive</Btn>
        </div>}
      </Modal>}

      {/* Cover Letter */}
      {showCover && <Modal title={`✉ Cover Letter — ${showCover.title} @ ${showCover.company}`} onClose={() => { setShowCover(null); setCoverOut(""); }} wide>
        {profile.skills ? <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#86efac" }}>✓ Using your profile: <strong>{profile.full_name}</strong> · {profile.headline}</div> :
          <F label="Your Background (optional)"><Txt value={bio} onChange={e => setBio(e.target.value)} placeholder="e.g. Final year BE CSE with ML projects…" rows={2} /></F>}
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
    </div>
  );
}
