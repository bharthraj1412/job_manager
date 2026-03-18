import { useState } from 'react';
import { supabase } from './supabase';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [msg, setMsg] = useState({text:'', type:''});

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({text:'', type:''});
    
    let error;
    if (isLogin) {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      error = err;
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password });
      error = err;
      if (!error) setMsg({text:'Signup successful! You can now log in.', type:'ok'});
    }
    
    if (error) setMsg({text:error.message, type:'error'});
    setLoading(false);
  };

  return (
    <div style={{minHeight:'100vh', background:'#050c1a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans', sans-serif", color:'#e2e8f0', padding:20}}>
      <div style={{background:'#07101f', border:'1px solid #1e293b', borderRadius:16, width:400, padding:32, boxShadow:'0 10px 25px rgba(0,0,0,0.5)'}}>
        <div style={{textAlign:'center', marginBottom:24}}>
          <h2 style={{fontSize:24, fontFamily:"'Syne', sans-serif", fontWeight:800, margin:0, background:'linear-gradient(90deg,#60a5fa,#818cf8,#c084fc)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>JobBoard Pro</h2>
          <p style={{color:'#64748b', fontSize:13, marginTop:8}}>{isLogin ? 'Sign in to your account' : 'Create a new account'}</p>
        </div>
        
        {msg.text && (
          <div style={{background:msg.type==='error'?'rgba(239,68,68,0.1)':'rgba(16,185,129,0.1)', border:`1px solid ${msg.type==='error'?'#ef4444':'#10b981'}`, color:msg.type==='error'?'#fca5a5':'#6ee7b7', padding:12, borderRadius:8, fontSize:13, marginBottom:16, textAlign:'center'}}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleAuth} style={{display:'flex', flexDirection:'column', gap:16}}>
          <div>
            <label style={{display:'block', fontSize:11, fontWeight:700, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em'}}>Email</label>
            <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} style={{width:'100%', padding:'10px 12px', background:'#0a111e', border:'1px solid #1e293b', borderRadius:8, color:'#f1f5f9', outline:'none', boxSizing:'border-box', fontFamily:'inherit'}} placeholder="you@example.com" />
          </div>
          <div>
            <label style={{display:'block', fontSize:11, fontWeight:700, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em'}}>Password</label>
            <input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} style={{width:'100%', padding:'10px 12px', background:'#0a111e', border:'1px solid #1e293b', borderRadius:8, color:'#f1f5f9', outline:'none', boxSizing:'border-box', fontFamily:'inherit'}} placeholder="••••••••" />
          </div>
          <button disabled={loading} style={{background:'linear-gradient(135deg,#1d4ed8,#4f46e5)', border:'none', color:'#fff', padding:'12px', borderRadius:8, fontSize:14, fontWeight:700, cursor:loading?'not-allowed':'pointer', marginTop:8, opacity:loading?0.7:1}}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>
        
        <div style={{textAlign:'center', marginTop:20, fontSize:13, color:'#64748b'}}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setIsLogin(!isLogin); setMsg({text:'', type:''}); }} style={{background:'none', border:'none', color:'#818cf8', fontWeight:600, cursor:'pointer', padding:0}}>
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
