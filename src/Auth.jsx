import { useState } from 'react';
import { supabase } from './supabase';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });

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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMsg({ text: '', type: '' });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // FIX: Added gmail.send so Google-login users can send email reports
        // without needing a secondary GIS popup.
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/drive.file',
        ].join(' '),
        queryParams: { access_type: 'offline', prompt: 'consent' },
        redirectTo: window.location.origin,
      },
    });
    if (error) setMsg({ text: error.message, type: 'error' });
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050c1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", color: '#e2e8f0', padding: 20 }}>
      <div style={{ background: '#07101f', border: '1px solid #1e293b', borderRadius: 16, width: 400, padding: 32, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontFamily: "'Syne', sans-serif", fontWeight: 800, margin: 0, background: 'linear-gradient(90deg,#60a5fa,#818cf8,#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>JobBoard Pro</h2>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>{isLogin ? 'Sign in to your account' : 'Create a new account'}</p>
        </div>

        {msg.text && (
          <div style={{ background: msg.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${msg.type === 'error' ? '#ef4444' : '#10b981'}`, color: msg.type === 'error' ? '#fca5a5' : '#6ee7b7', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#0a111e', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} placeholder="you@example.com" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#0a111e', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} placeholder="••••••••" />
          </div>
          <button disabled={loading} style={{ background: 'linear-gradient(135deg,#1d4ed8,#4f46e5)', border: 'none', color: '#fff', padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#1e293b' }}></div>
          <div style={{ padding: '0 10px', color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>or</div>
          <div style={{ flex: 1, height: 1, background: '#1e293b' }}></div>
        </div>

        <button onClick={handleGoogleLogin} disabled={loading} style={{ width: '100%', background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a', padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
          Sign {isLogin ? 'in' : 'up'} with Google
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setIsLogin(!isLogin); setMsg({ text: '', type: '' }); }} style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>

        <div style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)', borderRadius: 10, fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
          ℹ️ <strong style={{ color: '#94a3b8' }}>Email/password users:</strong> Google features (Gmail scan, Drive, Calendar, email reports) require a Google Client ID in ⚙️ Settings. You'll see a one-time authorization popup per session.
        </div>
      </div>
    </div>
  );
}
