import {useEffect,useState} from 'react';
import {Database,Plus,Save,Trash2,History,Play,RefreshCw} from 'lucide-react';
import {protectedFetch} from './authClient';

type Asset={id:string;name:string;kind:string;criticality:number};
type Edge={source:string;target:string;kind:string;requires:string[]};
type Scenario={name:string;assets:Asset[];relationships:Edge[];initial_access:string[];target:string;blocked_relationships?:string[]};
type Analysis={status:string;path:string[];reachable:string[];snapshot_sha256:string;rule_version:string;evidence:{edge:string;kind:string;requires:string[]}[];disclaimer:string};
type Summary={id:string;name:string;revision:number;updated_at:string};
type Stored={id:string;revision:number;scenario:Scenario};
type Revision={revision:number;action:string;recorded_at:string};
const copy=(s:Scenario):Scenario=>JSON.parse(JSON.stringify(s)) as Scenario;
const empty=():Scenario=>({name:'New synthetic scenario',assets:[{id:'entry',name:'Entry Point',kind:'network',criticality:1},{id:'target',name:'Protected Target',kind:'database',criticality:5}],relationships:[{source:'entry',target:'target',kind:'connects',requires:[]}],initial_access:['entry'],target:'target'});
async function call<T>(url:string,method='GET',body?:unknown):Promise<T>{
 const r=await protectedFetch(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error(`HTTP ${r.status}: ${(await r.text()).slice(0,250)}`);
 if(r.status===204)return undefined as T;
 return r.json() as Promise<T>;
}
function validate(s:Scenario):string|null{
 if(!s.name.trim()||s.name.length>160)return 'Scenario name must be 1–160 characters';
 const ids=s.assets.map(a=>a.id);
 if(!ids.length||ids.length>200||new Set(ids).size!==ids.length||ids.some(id=>!/^[a-zA-Z0-9_-]{1,80}$/.test(id)))return 'Asset IDs must be unique, valid and nonempty';
 if(s.assets.some(a=>!a.name.trim()||!a.kind.trim()||a.criticality<1||a.criticality>5))return 'Asset name, kind and criticality (1–5) are required';
 if(!ids.includes(s.target)||s.initial_access.some(x=>!ids.includes(x)))return 'Target and initial access must reference assets';
 const keys=s.relationships.map(e=>`${e.source}->${e.target}`);
 if(keys.length>1000||new Set(keys).size!==keys.length)return 'Duplicate relationships or too many relationships';
 const kinds=['connects','trusts','administers','authenticates','contains'];
 if(s.relationships.some(e=>!ids.includes(e.source)||!ids.includes(e.target)||!kinds.includes(e.kind)||e.requires.some(x=>!ids.includes(x))))return 'Invalid relationship or prerequisite';
 return null;
}
export function ScenarioManager({current,onLoad,connected}:{current:Scenario;onLoad:(s:Scenario,a:Analysis)=>void;connected:boolean}){
 const [items,setItems]=useState<Summary[]>([]);
 const [draft,setDraft]=useState<Scenario>(()=>copy(current));
 const [record,setRecord]=useState<{id:string;revision:number}|null>(null);
 const [history,setHistory]=useState<Revision[]>([]);
 const [preview,setPreview]=useState<Stored|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const field={background:'#0b1c29',border:'1px solid #315367',borderRadius:6,color:'#e7f5fa',padding:'9px 11px',maxWidth:'100%'};
 const section={background:'#0a1c29',border:'1px solid #274253',borderRadius:10,padding:16,marginTop:16};
 const row={display:'flex',gap:10,flexWrap:'wrap' as const,alignItems:'center' as const,marginBottom:10};
 const mutate=(fn:(s:Scenario)=>void)=>{setDraft(old=>{const next=copy(old);fn(next);return next;});setPreview(null);setNotice('');};
 const execute=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 const refresh=async()=>setItems(await call<Summary[]>('/api/v1/scenarios'));
 useEffect(()=>{void refresh().catch(e=>setError(String(e)));},[]);
 const select=(id:string)=>void execute(async()=>{const r=await call<Stored>(`/api/v1/scenarios/${id}`);setDraft(r.scenario);setRecord({id:r.id,revision:r.revision});setPreview(null);setHistory(await call<Revision[]>(`/api/v1/scenarios/${id}/history`));setNotice('Loaded into editor. Activate to change the Digital Twin.');});
 const save=()=>void execute(async()=>{const problem=validate(draft);if(problem)throw Error(problem);
  const r=record?await call<{id:string;revision:number}>(`/api/v1/scenarios/${record.id}?expectedRevision=${record.revision}`,'PUT',draft):await call<{id:string;revision:number}>('/api/v1/scenarios','POST',draft);
  setRecord(r);setHistory(await call<Revision[]>(`/api/v1/scenarios/${r.id}/history`));await refresh();setNotice(`Saved revision ${r.revision}. Activate to update the workspace.`);
 });
 const activate=()=>void execute(async()=>{const problem=validate(draft);if(problem)throw Error(problem);const analysis=await call<Analysis>('/api/v1/engine/analyze','POST',draft);onLoad(copy(draft),analysis);});
 const remove=()=>void execute(async()=>{if(!record||!window.confirm(`Delete ${draft.name}? Historical revisions remain stored.`))return;await call<void>(`/api/v1/scenarios/${record.id}`,'DELETE');setRecord(null);setDraft(empty());setHistory([]);setPreview(null);await refresh();setNotice('Scenario deleted. Active workspace remains unchanged.');});
 const showRevision=(revision:number)=>void execute(async()=>{if(record)setPreview(await call<Stored>(`/api/v1/scenarios/${record.id}/history/${revision}`));});
 return <div className="panel feature-card">
  <div className="card-head"><div><div className="card-eyebrow">SCENARIO LIBRARY / POSTGRESQL</div><h2>Scenario Manager</h2></div><span className="badge badge-cyan">{items.length} SAVED</span></div>
  <p className="muted">Manage synthetic infrastructure models and their revision history. Saving does not activate a scenario.</p>
  <div style={row}><button className="secondary-btn" disabled={busy} onClick={()=>void execute(refresh)}><RefreshCw size={15}/> REFRESH</button><button className="secondary-btn" onClick={()=>{setDraft(empty());setRecord(null);setHistory([]);setPreview(null);}}><Plus size={15}/> NEW</button><button className="secondary-btn" onClick={()=>{setDraft(copy(current));setRecord(null);setHistory([]);setPreview(null);}}><Database size={15}/> COPY ACTIVE</button></div>
  <div style={section}><h3>Saved scenarios</h3>{items.length===0&&<p className="muted">No saved scenarios yet.</p>}{items.map(item=><button key={item.id} className="dashboard-list-row" style={{width:'100%',textAlign:'left'}} disabled={busy} onClick={()=>select(item.id)}><Database size={16}/><span><strong>{item.name}</strong><small>Revision {item.revision} · {item.updated_at}</small></span></button>)}</div>
  <div style={section}><div className="card-eyebrow">SCENARIO EDITOR / {record?`REVISION ${record.revision}`:'UNSAVED'}</div>
   <label>Name <input style={{...field,width:'100%'}} value={draft.name} onChange={e=>mutate(s=>{s.name=e.target.value;})}/></label>
   <h3>Assets</h3>{draft.assets.map((a,i)=><div key={i} style={row}>
    <input style={{...field,width:115}} aria-label="Asset ID" value={a.id} onChange={e=>mutate(s=>{const old=s.assets[i].id;const id=e.target.value;s.assets[i].id=id;s.relationships.forEach(r=>{if(r.source===old)r.source=id;if(r.target===old)r.target=id;r.requires=r.requires.map(x=>x===old?id:x);});s.initial_access=s.initial_access.map(x=>x===old?id:x);if(s.target===old)s.target=id;})}/>
    <input style={{...field,flex:1,minWidth:120}} aria-label="Asset name" value={a.name} onChange={e=>mutate(s=>{s.assets[i].name=e.target.value;})}/>
    <input style={{...field,width:110}} aria-label="Asset kind" value={a.kind} onChange={e=>mutate(s=>{s.assets[i].kind=e.target.value;})}/>
    <select style={field} aria-label="Criticality" value={a.criticality} onChange={e=>mutate(s=>{s.assets[i].criticality=Number(e.target.value);})}>{[1,2,3,4,5].map(n=><option key={n} value={n}>Risk {n}</option>)}</select>
    <button className="secondary-btn" aria-label="Remove asset" onClick={()=>mutate(s=>{const id=s.assets[i].id;s.assets.splice(i,1);s.relationships=s.relationships.filter(r=>r.source!==id&&r.target!==id).map(r=>({...r,requires:r.requires.filter(x=>x!==id)}));s.initial_access=s.initial_access.filter(x=>x!==id);if(s.target===id)s.target=s.assets[0]?.id||'';})}><Trash2 size={15}/></button>
   </div>)}<button className="secondary-btn" onClick={()=>mutate(s=>{s.assets.push({id:`asset_${Date.now().toString(36)}`,name:'New asset',kind:'server',criticality:3});})}><Plus size={15}/> ADD ASSET</button>
   <h3>Relationships</h3>{draft.relationships.map((edge,i)=><div key={i} style={row}>
    <select style={field} aria-label="Source" value={edge.source} onChange={e=>mutate(s=>{s.relationships[i].source=e.target.value;})}>{draft.assets.map(a=><option key={a.id} value={a.id}>{a.id}</option>)}</select><span>→</span>
    <select style={field} aria-label="Target" value={edge.target} onChange={e=>mutate(s=>{s.relationships[i].target=e.target.value;})}>{draft.assets.map(a=><option key={a.id} value={a.id}>{a.id}</option>)}</select>
    <select style={field} aria-label="Relation kind" value={edge.kind} onChange={e=>mutate(s=>{s.relationships[i].kind=e.target.value;})}>{['connects','trusts','administers','authenticates','contains'].map(k=><option key={k}>{k}</option>)}</select>
    <input style={{...field,flex:1,minWidth:140}} aria-label="Prerequisites" placeholder="Requires: comma-separated asset IDs" value={edge.requires.join(', ')} onChange={e=>mutate(s=>{s.relationships[i].requires=e.target.value.split(',').map(x=>x.trim()).filter(Boolean);})}/>
    <button className="secondary-btn" aria-label="Remove relationship" onClick={()=>mutate(s=>{s.relationships.splice(i,1);})}><Trash2 size={15}/></button>
   </div>)}<button className="secondary-btn" disabled={draft.assets.length<2} onClick={()=>mutate(s=>{s.relationships.push({source:s.assets[0].id,target:s.assets[1].id,kind:'connects',requires:[]});})}><Plus size={15}/> ADD RELATIONSHIP</button>
   <h3>Initial access and target</h3><div style={row}><label>Initial access <select multiple size={Math.min(5,Math.max(2,draft.assets.length))} style={field} value={draft.initial_access} onChange={e=>mutate(s=>{s.initial_access=Array.from(e.target.selectedOptions,x=>x.value);})}>{draft.assets.map(a=><option key={a.id} value={a.id}>{a.id}</option>)}</select></label><label>Target <select style={field} value={draft.target} onChange={e=>mutate(s=>{s.target=e.target.value;})}>{draft.assets.map(a=><option key={a.id} value={a.id}>{a.id}</option>)}</select></label></div>
   <div style={row}><button className="secondary-btn" disabled={busy} onClick={save}><Save size={15}/> {record?'SAVE REVISION':'SAVE NEW'}</button><button className="cta small" disabled={busy||!connected} onClick={activate}><Play size={15}/> ACTIVATE IN WORKSPACE</button>{record&&<button className="secondary-btn" disabled={busy} onClick={remove}><Trash2 size={15}/> DELETE</button>}</div>
  </div>
  {record&&<div style={section}><h3><History size={17}/> Version history</h3>{history.map(h=><button className="dashboard-list-row" key={h.revision} style={{width:'100%',textAlign:'left'}} onClick={()=>showRevision(h.revision)}><span><strong>Revision {h.revision} · {h.action}</strong><small>{h.recorded_at}</small></span></button>)}{preview&&<div className="intel-inspector"><strong>Revision {preview.revision} preview</strong><p className="muted">{preview.scenario.name} · {preview.scenario.assets.length} assets</p><button className="secondary-btn" onClick={()=>{setDraft(copy(preview.scenario));setPreview(null);setNotice('Historical revision copied into editor; save to create a new revision.');}}>RESTORE INTO EDITOR</button></div>}</div>}
  {busy&&<p className="muted" role="status">Working…</p>}{error&&<p className="disclaimer" role="alert">Error: {error}</p>}{notice&&<p className="muted" role="status">{notice}</p>}
  <p className="disclaimer">Local synthetic demo. No authentication or tenant isolation: do not expose scenario write endpoints publicly.</p>
 </div>;
}
