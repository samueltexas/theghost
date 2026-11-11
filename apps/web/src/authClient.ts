// In-memory CSRF token; authentication is an HttpOnly server-side session.
export type Session={authenticated:boolean;username:string;role:string;csrfToken:string;csrfHeader:string};
let csrf='';let csrfHeader='X-CSRF-TOKEN';
export async function getSession():Promise<Session>{
 const r=await fetch('/api/v1/auth/session',{credentials:'same-origin',cache:'no-store'});
 if(!r.ok)throw Error(`Session HTTP ${r.status}`);
 const s=await r.json() as Session;csrf=s.csrfToken;csrfHeader=s.csrfHeader;return s;
}
export async function login(username:string,password:string):Promise<Session>{
 await getSession();
 const r=await fetch('/api/v1/auth/login',{method:'POST',credentials:'same-origin',
  headers:{'Content-Type':'application/x-www-form-urlencoded',[csrfHeader]:csrf},
  body:new URLSearchParams({username,password})});
 if(!r.ok)throw Error(r.status===401?'Invalid password':`Login HTTP ${r.status}`);
 return getSession();
}
export async function logout():Promise<void>{
 const r=await fetch('/api/v1/auth/logout',{method:'POST',credentials:'same-origin',headers:{[csrfHeader]:csrf}});
 if(!r.ok)throw Error(`Logout HTTP ${r.status}`);csrf='';
}
export async function protectedFetch(url:string,init:RequestInit={}):Promise<Response>{
 const method=(init.method||'GET').toUpperCase();
 if(!['GET','HEAD','OPTIONS'].includes(method)&&!csrf)await getSession();
 const headers=new Headers(init.headers);
 if(!['GET','HEAD','OPTIONS'].includes(method))headers.set(csrfHeader,csrf);
 const r=await fetch(url,{...init,headers,credentials:'same-origin'});
 if(r.status===401)window.dispatchEvent(new Event('ghost-session-expired'));
 return r;
}
