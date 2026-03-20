#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# JobBoard Pro — Git Update Script
# Run this in your project root directory
# ═══════════════════════════════════════════════════════════════════

set -e  # Exit immediately on any error

# ── Colors ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔═══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     JobBoard Pro — Git Push v2.0      ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════╝${NC}"

# ── 1. Safety checks ────────────────────────────────────────────────
echo -e "\n${YELLOW}▶ Running pre-push safety checks...${NC}"

# Check we're in a git repo
if [ ! -d ".git" ]; then
  echo -e "${RED}✗ Not a git repository. Run: git init${NC}"
  exit 1
fi

# Check .env is in .gitignore (SECURITY — never commit secrets)
if ! grep -q "\.env" .gitignore 2>/dev/null; then
  echo -e "${RED}✗ .env is NOT in .gitignore — SECURITY RISK!${NC}"
  echo "  Adding .env to .gitignore now..."
  echo -e "\n# Environment variables — NEVER commit\n.env\n.env.local\n.env.production\n.env.*.local" >> .gitignore
  echo -e "${GREEN}  ✓ .gitignore updated${NC}"
fi

# Warn if .env file exists (make sure it's not staged)
if [ -f ".env" ]; then
  if git ls-files --error-unmatch .env 2>/dev/null; then
    echo -e "${RED}✗ CRITICAL: .env is tracked by git! Running: git rm --cached .env${NC}"
    git rm --cached .env
    echo -e "${GREEN}  ✓ Removed .env from git tracking${NC}"
  else
    echo -e "${GREEN}  ✓ .env exists but is NOT tracked (safe)${NC}"
  fi
fi

# Check for accidentally committed secrets
echo -e "${YELLOW}▶ Scanning for hardcoded secrets...${NC}"
SECRET_PATTERNS=(
  "nvapi-[A-Za-z0-9_-]{20,}"
  "ADZUNA_KEY.*=.*[a-f0-9]{32}"
  "supabase.*anon.*eyJ"
  "sk-[A-Za-z0-9]{20,}"
)
FOUND_SECRET=0
for pattern in "${SECRET_PATTERNS[@]}"; do
  if grep -rq "$pattern" src/ 2>/dev/null; then
    echo -e "${RED}  ✗ Possible hardcoded secret found matching: $pattern${NC}"
    FOUND_SECRET=1
  fi
done
if [ $FOUND_SECRET -eq 0 ]; then
  echo -e "${GREEN}  ✓ No hardcoded secrets detected${NC}"
else
  echo -e "${RED}  ⚠  Fix hardcoded secrets before pushing!${NC}"
  echo -e "${RED}     Move them to .env and use import.meta.env.VITE_*${NC}"
  read -p "  Continue anyway? (y/N): " -n 1 -r; echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then exit 1; fi
fi

# ── 2. Show current status ───────────────────────────────────────────
echo -e "\n${YELLOW}▶ Current git status:${NC}"
git status --short

# ── 3. Stage all changes ─────────────────────────────────────────────
echo -e "\n${YELLOW}▶ Staging changes...${NC}"
git add .

# Show what's staged
STAGED=$(git diff --cached --name-only)
if [ -z "$STAGED" ]; then
  echo -e "${YELLOW}  Nothing to commit — working tree is clean${NC}"
  echo -e "${GREEN}  Already up to date!${NC}"
  exit 0
fi

echo "  Staged files:"
git diff --cached --name-only | while read f; do echo "    + $f"; done

# ── 4. Commit with descriptive message ───────────────────────────────
echo -e "\n${YELLOW}▶ Creating commit...${NC}"

COMMIT_MSG="feat: AI Resume Builder (4 templates), Auto-Apply, security hardening

## New Features
- 📄 AI Resume Builder with 4 professional templates (Professional, Modern, Minimal, ATS Pro)
  - Live preview with iframe rendering
  - AI-powered content generation per section
  - ATS compatibility checker with missing keyword detection
  - Print-to-PDF and HTML download
  - Sync resume data back to profile
- ⚡ Auto-Apply feature
  - AI-generated tailored cover letter per job
  - Gmail API email sending when email found in job notes
  - Opens apply link + copies cover letter to clipboard as fallback
  - Marks job status as Applied automatically
  - Persistent auto-apply log (localStorage + Supabase)
  - Dedicated log modal with sent history

## Security Fixes
- 🔐 Removed hardcoded NVIDIA API key from client code (moved to server-side proxy)
- 🔐 Removed hardcoded Adzuna credentials from source (moved to .env)
- 🔐 Removed hardcoded Supabase credentials from supabase.js
- 🔐 Added CORS restriction to api/ai.js (no longer wildcard *)
- 🔐 Added IP-based rate limiting to API proxy (20 req/min)
- 🔐 Input validation on proxy endpoint

## Database (supabase_schema.sql)
- Added profiles table with full column set + job preferences
- Added auto_apply_log table for persistent apply history
- Added saved_searches table (replaces localStorage)
- Added job_notes table for rich per-job notes
- Added new columns to jobs table (auto_applied, match_score, updated_at)
- Added updated_at triggers on jobs and profiles
- Added full-text search index on jobs (GIN)
- Added performance indexes on all foreign keys
- Added get_job_stats() server function
- Added search_jobs() full-text function
- Added upsert_profile() helper function
- Added Supabase Storage bucket for resume file uploads
- Fixed all RLS policies (dropped and recreated cleanly)

## Resume Builder tab added to main navigation"

git commit -m "$COMMIT_MSG"
echo -e "${GREEN}  ✓ Committed${NC}"

# ── 5. Push to remote ────────────────────────────────────────────────
echo -e "\n${YELLOW}▶ Pushing to origin/main...${NC}"

# Check if remote exists
if ! git remote get-url origin &>/dev/null; then
  echo -e "${RED}  ✗ No remote 'origin' configured${NC}"
  echo ""
  echo "  Add your GitHub remote:"
  echo -e "  ${CYAN}git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git${NC}"
  echo -e "  ${CYAN}git push -u origin main${NC}"
  exit 1
fi

git push origin main
echo -e "${GREEN}  ✓ Pushed to origin/main${NC}"

# ── 6. Done ──────────────────────────────────────────────────────────
echo -e "\n${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  Push complete!                  ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"

echo -e "\n${CYAN}Next steps:${NC}"
echo "  1. Set Vercel env vars (NOT in .env — in Vercel Dashboard):"
echo "     NVIDIA_API_KEY=nvapi-..."
echo "     ALLOWED_ORIGIN=https://your-app.vercel.app"
echo ""
echo "  2. Apply Supabase schema:"
echo "     Supabase Dashboard → SQL Editor → paste supabase_schema.sql"
echo ""
echo "  3. Vercel will auto-deploy from main branch"
echo ""
