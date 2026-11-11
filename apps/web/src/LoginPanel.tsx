import {useState} from 'react';
import {LockKeyhole,ArrowRight} from 'lucide-react';
import {login} from './authClient';
import type {Session} from './authClient';
import './auth.css';
export function LoginPanel({onSuccess,onBack}:{onSuccess:(s:Session)=>void;onBack:()=>void}){
 const [password,setPassword]=useState('');
 const [username,setUsername]=useState('admin');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');
  try{const s=await login(username,password);setPassword('');onSuccess(s);}
  catch(err){setError(err instanceof Error?err.message:'Authentication unavailable');}
  finally{setBusy(false);}};
 return <div className="ghost-login-shell"><div className="ghost-login-panel">
  <div className="card-eyebrow">THEGHOST / SECURE ACCESS</div><LockKeyhole size={36} color="#00d5f5"/>
  <h1>Operator <em>Sign In.</em></h1><p>Local administrator · Synthetic cybersecurity environment</p>
  <form onSubmit={submit}><label htmlFor="ghost-username">Username</label>
      <input id="ghost-username" type="text" autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)}/>
      <label htmlFor="ghost-password">Administrator password</label>
  <input id="ghost-password" type="password" autoComplete="current-password" value={password} required onChange={e=>setPassword(e.target.value)}/>
  {error&&<p role="alert" className="ghost-login-error">{error}</p>}
  <button className="cta" disabled={busy}>{busy?'AUTHENTICATING…':'SIGN IN'} <ArrowRight size={17}/></button></form>
  <button className="secondary-btn" onClick={onBack}>BACK TO WEBSITE</button>
 </div></div>;
}
