# 🎯 JobBoard Pro

JobBoard Pro is a premium, privacy-first job application tracker designed to streamline your career search. Built with a modern tech stack, it combines powerful AI search capabilities with seamless integrations.

## 🚀 Key Features

- **🔍 Live Job Search (Adzuna)**: Fetch real-time job listings directly from Adzuna. Supports 50 results per page with infinite "Load More" pagination.
- **📧 Gmail Scanner**: Connect your Google account to automatically identify and import job-related emails (Interviews, Offers, Rejections).
- **📋 Management Dashboard**: Track applications via a sleek table or a dynamic Kanban board.
- **📊 Smart Analytics**: Visualize your application funnel with real-time charts and priority breakdowns.
- **🎙️ AI Interview Prep**: Generate tailored interview guides for any role using DeepSeek-R1.
- **✉️ AI Cover Letters**: Write professional, tailored cover letters in seconds.
- **📂 Excel Import/Export**: Seamlessly migrate your data to and from Excel.

## 🛠️ Tech Stack

- **Frontend**: React + Vite + Vanilla CSS (Premium Dark Theme)
- **Backend/DB**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Email & Google OAuth)
- **AI Engine**: DeepSeek-R1 via NVIDIA NIM API
- **Live Jobs**: Adzuna Search API

## ⚙️ Setup & Configuration

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Environment Variables**: Create a `.env` file with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GOOGLE_CLIENT_ID=your_google_client_id
   ```
3. **Run Locally**:
   ```bash
   npm run dev
   ```

## ⬆️ How to Update to GitHub

To push your latest changes to GitHub, run these commands in your terminal:

```bash
# 1. Stage all changes
git add .

# 2. Commit with a descriptive message
git commit -m "feat: integrate Adzuna live search with pagination and UI improvements"

# 3. Push to your repository
git push origin main
```

---
*Built with ❤️ for career growth.*
