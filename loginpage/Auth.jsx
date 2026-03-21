import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function Auth() {
  const [loading, setLoading]   = useState(false);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin]   = useState(true);
  const [msg, setMsg]           = useState({ text: '', type: '' });
  const [showModal, setShowModal] = useState(false);
  const [scrolled, setScrolled]   = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMsg({ text: '', type: '' });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'email profile',
        queryParams: { access_type: 'offline', prompt: 'select_account' },
        redirectTo: window.location.origin,
      },
    });
    if (error) { setMsg({ text: error.message, type: 'error' }); setLoading(false); }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ text: '', type: '' });
    let error;
    if (isLogin) {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      error = err;
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password });
      error = err;
      if (!error) setMsg({ text: 'Signup successful! You can now log in.', type: 'ok' });
    }
    if (error) setMsg({ text: error.message, type: 'error' });
    setLoading(false);
  };

  // ── FEATURES data ──
  const features = [
    { icon: '🔍', title: 'Live Job Search', desc: 'Real-time listings from Adzuna across multiple cities simultaneously. Filter by experience, salary, type and more.' },
    { icon: '🤖', title: 'AI-Powered', desc: 'Auto-extracts job details from any description. Generates cover letters, interview prep guides, and ATS-optimized resumes.' },
    { icon: '📊', title: 'Smart Tracker', desc: 'Kanban board + table view with drag-and-drop. Bulk actions, deadline alerts, follow-up reminders, and analytics.' },
    { icon: '📧', title: 'Gmail Scanner', desc: 'Scans your inbox for job emails — interviews, offers, rejections — and imports them to your tracker automatically.' },
    { icon: '📄', title: 'Resume Builder', desc: '4 professional A4 templates with ATS checker. AI generates content, skill chips, project sections and PDF export.' },
    { icon: '📅', title: 'Daily Reports', desc: 'Automated progress reports and job digests delivered to your Gmail with Excel & PDF attachments saved to Drive.' },
  ];

  const steps = [
    { n: '01', title: 'Sign in with Google', desc: 'One click — stays logged in for 30 days. No passwords to remember.' },
    { n: '02', title: 'Build Your Profile', desc: 'Upload your resume — AI parses it and fills your profile, skills and preferences instantly.' },
    { n: '03', title: 'Find & Track Jobs', desc: 'Search multiple cities, bookmark jobs, AI-applies with your cover letter, tracks every stage.' },
  ];

  const stats = [
    { value: '50+', label: 'Jobs per search' },
    { value: '4', label: 'Resume templates' },
    { value: 'AI', label: 'Cover letters' },
    { value: '∞', label: 'Applications' },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#040c18', color: '#e2e8f0', minHeight: '100vh', overflowX: 'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#040c18}::-webkit-scrollbar-thumb{background:#1e2d45;border-radius:4px}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}
        @keyframes glow{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes mi{from{opacity:0;transform:scale(.96)translateY(10px)}to{opacity:1;transform:scale(1)translateY(0)}}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        .hero-glow{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none}
        .grid-bg{background-image:linear-gradient(rgba(99,102,241,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,.04) 1px,transparent 1px);background-size:48px 48px}
        .feat-card{background:rgba(6,16,30,.8);border:1px solid #0f1c2e;border-radius:18px;padding:28px 24px;transition:all .25s;cursor:default;backdrop-filter:blur(8px)}
        .feat-card:hover{border-color:rgba(99,102,241,.5);transform:translateY(-4px);box-shadow:0 20px 60px rgba(0,0,0,.4)}
        .step-num{background:linear-gradient(135deg,#1d4ed8,#4f46e5);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-family:'Syne',sans-serif;font-size:48px;font-weight:900;line-height:1;opacity:.7}
        .google-btn{width:100%;background:#fff;border:2px solid #e2e8f0;color:#0f172a;padding:14px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:12px;transition:all .2s;font-family:inherit}
        .google-btn:hover{background:#f8fafc;border-color:#4f46e5;transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,.15)}
        .google-btn:active{transform:translateY(0)}
        .cta-btn{background:linear-gradient(135deg,#1d4ed8,#4f46e5);border:none;color:#fff;padding:16px 36px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;display:inline-flex;align-items:center;gap:8px}
        .cta-btn:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(79,70,229,.5)}
        .ghost-btn{background:transparent;border:1px solid rgba(255,255,255,.15);color:#94a3b8;padding:14px 28px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s}
        .ghost-btn:hover{border-color:rgba(255,255,255,.3);color:#f1f5f9}
        input:focus{border-color:#4f46e5!important;outline:none}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .15s ease}
        .modal-box{background:#060d1a;border:1px solid #1e2d45;border-radius:22px;width:100%;max-width:440px;padding:36px;animation:mi .2s ease;box-shadow:0 32px 80px rgba(0,0,0,.7);position:relative}
        .shimmer-text{background:linear-gradient(90deg,#60a5fa 0%,#818cf8 30%,#c084fc 60%,#60a5fa 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 4s linear infinite}
      `}</style>

      {/* ── STICKY NAV ── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, transition: 'all .3s', background: scrolled ? 'rgba(4,12,24,.95)' : 'transparent', borderBottom: scrolled ? '1px solid rgba(255,255,255,.06)' : '1px solid transparent', backdropFilter: scrolled ? 'blur(12px)' : 'none', padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎯</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, background: 'linear-gradient(90deg,#60a5fa,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>JobBoard Pro</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="ghost-btn" style={{ padding: '8px 20px', fontSize: 13 }} onClick={() => { setIsLogin(true); setShowModal(true); }}>Sign In</button>
          <button className="cta-btn" style={{ padding: '9px 22px', fontSize: 13 }} onClick={() => { setIsLogin(false); setShowModal(true); }}>Get Started Free</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="grid-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        {/* Background glows */}
        <div className="hero-glow" style={{ width: 600, height: 600, background: 'radial-gradient(circle,rgba(79,70,229,.18),transparent 70%)', top: '10%', left: '50%', transform: 'translateX(-50%)' }} />
        <div className="hero-glow" style={{ width: 300, height: 300, background: 'radial-gradient(circle,rgba(124,58,237,.12),transparent 70%)', top: '20%', right: '10%', animation: 'glow 4s ease-in-out infinite' }} />
        <div className="hero-glow" style={{ width: 200, height: 200, background: 'radial-gradient(circle,rgba(6,182,212,.1),transparent 70%)', bottom: '20%', left: '8%', animation: 'glow 5s ease-in-out infinite 1s' }} />

        <div style={{ textAlign: 'center', maxWidth: 820, position: 'relative', zIndex: 1 }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(79,70,229,.12)', border: '1px solid rgba(79,70,229,.3)', borderRadius: 999, padding: '6px 16px', marginBottom: 28, animation: 'slideUp .6s ease' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#a5b4fc', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>AI-Powered · Free to Use · No Credit Card</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 'clamp(38px,6.5vw,78px)', fontWeight: 900, lineHeight: 1.05, marginBottom: 22, animation: 'slideUp .7s ease .1s both' }}>
            Land Your Dream Job<br />
            <span className="shimmer-text">10× Faster</span>
          </h1>

          <p style={{ color: '#64748b', fontSize: 'clamp(15px,2vw,19px)', lineHeight: 1.7, maxWidth: 640, margin: '0 auto 40px', animation: 'slideUp .7s ease .2s both' }}>
            JobBoard Pro combines AI job search, smart tracking, auto-apply, and resume building into one seamless workflow. From bookmarked to hired.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56, animation: 'slideUp .7s ease .3s both' }}>
            <button className="google-btn" style={{ width: 'auto', padding: '14px 28px', fontSize: 14 }} onClick={handleGoogleLogin} disabled={loading}>
              {loading
                ? <span style={{ animation: 'spin .8s linear infinite', display: 'inline-block' }}>◌</span>
                : <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              }
              {loading ? 'Connecting…' : 'Continue with Google — It\'s Free'}
            </button>
            <button className="ghost-btn" onClick={() => { setIsLogin(true); setShowModal(true); }}>Sign in with Email</button>
          </div>

          {/* Trust line */}
          <p style={{ color: '#1e2d45', fontSize: 12, animation: 'slideUp .7s ease .4s both' }}>
            🔒 Stays signed in for 30 days · Google-secured · No spam ever
          </p>
        </div>

        {/* Floating dashboard preview mockup */}
        <div style={{ marginTop: 60, position: 'relative', animation: 'float 6s ease-in-out infinite', zIndex: 1 }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(6,16,30,.9),rgba(10,22,40,.9))', border: '1px solid rgba(99,102,241,.2)', borderRadius: 20, padding: '20px 24px', backdropFilter: 'blur(16px)', boxShadow: '0 32px 80px rgba(0,0,0,.5)', minWidth: 'min(680px,90vw)' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {['#ef4444','#f59e0b','#22c55e'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
              {[['📋','32','Total'],['🎙','5','Interviews'],['🏆','2','Offers'],['📈','78%','Response']].map(([ic,n,l]) => (
                <div key={l} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{ic}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", color: '#818cf8', fontSize: 20, fontWeight: 700 }}>{n}</div>
                  <div style={{ color: '#334155', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
                </div>
              ))}
            </div>
            {[['Software Engineer','Google','Interview','#22c55e'],['Data Analyst','Microsoft','Applied','#06b6d4'],['Frontend Dev','Stripe','Offer','#fde047']].map(([t,c,s,col]) => (
              <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,.02)', borderRadius: 8, marginBottom: 6, border: '1px solid rgba(255,255,255,.04)' }}>
                <div>
                  <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>{t}</div>
                  <div style={{ color: '#475569', fontSize: 10 }}>{c}</div>
                </div>
                <span style={{ background: `${col}18`, border: `1px solid ${col}40`, color: col, padding: '2px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,.05)', borderBottom: '1px solid rgba(255,255,255,.05)', background: 'rgba(6,16,30,.6)', backdropFilter: 'blur(8px)', padding: '28px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, textAlign: 'center' }}>
          {stats.map(({ value, label }) => (
            <div key={label}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, background: 'linear-gradient(135deg,#60a5fa,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{value}</div>
              <div style={{ color: '#475569', fontSize: 12, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: '100px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p style={{ color: '#4f46e5', fontSize: 12, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 12 }}>EVERYTHING YOU NEED</p>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2 }}>Built for serious job seekers</h2>
          <p style={{ color: '#475569', fontSize: 16, marginTop: 14, maxWidth: 480, margin: '14px auto 0' }}>Every feature you need to go from search to signed offer letter.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 18 }}>
          {features.map(({ icon, title, desc }) => (
            <div key={title} className="feat-card">
              <div style={{ fontSize: 32, marginBottom: 14 }}>{icon}</div>
              <h3 style={{ color: '#f1f5f9', fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
              <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '80px 24px 100px', background: 'rgba(6,16,30,.5)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <p style={{ color: '#06b6d4', fontSize: 12, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 12 }}>SIMPLE PROCESS</p>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, color: '#f1f5f9' }}>From sign-up to hired in 3 steps</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 24 }}>
            {steps.map(({ n, title, desc }) => (
              <div key={n} style={{ position: 'relative', padding: '32px 24px', background: 'rgba(6,16,30,.9)', border: '1px solid #0f1c2e', borderRadius: 18 }}>
                <div className="step-num">{n}</div>
                <h3 style={{ color: '#f1f5f9', fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, margin: '10px 0 8px' }}>{title}</h3>
                <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: '100px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="hero-glow" style={{ width: 500, height: 500, background: 'radial-gradient(circle,rgba(79,70,229,.12),transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 'clamp(28px,4.5vw,54px)', fontWeight: 900, color: '#f1f5f9', marginBottom: 16, lineHeight: 1.15 }}>
            Start your job search<br />the smart way
          </h2>
          <p style={{ color: '#475569', fontSize: 16, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
            Join job seekers who track smarter, apply faster and land interviews — powered by AI.
          </p>
          <button className="google-btn" style={{ width: 'auto', display: 'inline-flex', padding: '16px 36px', fontSize: 15, borderRadius: 14 }} onClick={handleGoogleLogin} disabled={loading}>
            {loading
              ? <span style={{ animation: 'spin .8s linear infinite', display: 'inline-block' }}>◌</span>
              : <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            }
            {loading ? 'Connecting…' : 'Get Started Free with Google'}
          </button>
          <p style={{ color: '#1e2d45', fontSize: 12, marginTop: 16 }}>Stays signed in 30 days · No credit card · Free forever</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '28px 24px', textAlign: 'center', color: '#1e2d45', fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>🎯</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, color: '#334155', fontSize: 13 }}>JobBoard Pro</span>
        </div>
        Built with AI · Track smarter, apply faster, land sooner.
      </footer>

      {/* ── AUTH MODAL ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.05)', border: '1px solid #1e2d45', color: '#64748b', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, background: 'linear-gradient(90deg,#60a5fa,#818cf8,#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>JobBoard Pro</h2>
              <p style={{ color: '#64748b', fontSize: 13 }}>{isLogin ? 'Welcome back! Sign in to continue.' : 'Create your free account.'}</p>
            </div>

            {/* Google — primary */}
            <button className="google-btn" onClick={handleGoogleLogin} disabled={loading} style={{ marginBottom: 18 }}>
              {loading
                ? <span style={{ animation: 'spin .8s linear infinite', display: 'inline-block' }}>◌</span>
                : <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              }
              {loading ? 'Connecting to Google…' : `${isLogin ? 'Sign in' : 'Sign up'} with Google — Fast & Secure`}
            </button>
            <p style={{ textAlign: 'center', color: '#334155', fontSize: 11, marginBottom: 16 }}>Stays signed in for 30 days automatically</p>

            <div style={{ display: 'flex', alignItems: 'center', margin: '0 0 18px' }}>
              <div style={{ flex: 1, height: 1, background: '#1e2d45' }} /><span style={{ padding: '0 12px', color: '#334155', fontSize: 11, fontWeight: 600 }}>or continue with email</span><div style={{ flex: 1, height: 1, background: '#1e2d45' }} />
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', background: '#070f1c', border: '1px solid #1e2d45', borderRadius: 10, padding: 3, marginBottom: 18 }}>
              {['Sign In', 'Sign Up'].map((l, i) => (
                <button key={l} onClick={() => { setIsLogin(i === 0); setMsg({ text: '', type: '' }); }} style={{ flex: 1, background: isLogin === (i === 0) ? '#1e2d45' : 'transparent', border: 'none', color: isLogin === (i === 0) ? '#e2e8f0' : '#475569', padding: '8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, transition: 'all .15s' }}>{l}</button>
              ))}
            </div>

            {msg.text && (
              <div style={{ background: msg.type === 'error' ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.1)', border: `1px solid ${msg.type === 'error' ? '#ef4444' : '#10b981'}`, color: msg.type === 'error' ? '#fca5a5' : '#6ee7b7', padding: 12, borderRadius: 9, fontSize: 12, marginBottom: 16, textAlign: 'center' }}>{msg.text}</div>
            )}

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={{ width: '100%', padding: '11px 13px', background: '#070f1c', border: '1px solid #1e2d45', borderRadius: 9, color: '#f1f5f9', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border .15s' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Password</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '11px 13px', background: '#070f1c', border: '1px solid #1e2d45', borderRadius: 9, color: '#f1f5f9', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border .15s' }} />
              </div>
              <button type="submit" disabled={loading} style={{ background: 'linear-gradient(135deg,#1d4ed8,#4f46e5)', border: 'none', color: '#fff', padding: '13px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 4, opacity: loading ? .7 : 1, transition: 'all .2s' }}>
                {loading ? 'Processing…' : (isLogin ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div style={{ marginTop: 18, padding: '12px 14px', background: 'rgba(6,182,212,.05)', border: '1px solid rgba(6,182,212,.13)', borderRadius: 10, fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
              ℹ️ Google sign-in only requests basic profile. Gmail, Drive & Calendar permissions are asked separately when you use those features.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
