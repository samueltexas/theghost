import {protectedFetch} from './authClient';
import { useMemo, useState } from 'react';
import { ArrowRight, Download, ShieldCheck, Search, FlaskConical } from 'lucide-react';

export type Asset = { id: string; name: string; kind: string; criticality: number };
export type Edge = { source: string; target: string; kind: string; requires: string[] };
export type Scenario = { name: string; assets: Asset[]; relationships: Edge[]; initial_access: string[]; target: string };
export type Analysis = { status: string; path: string[]; reachable: string[]; snapshot_sha256: string; rule_version: string; evidence: { edge: string; kind: string; requires: string[] }[]; disclaimer: string };
type Props = { scenario: Scenario; analysis: Analysis | null; connected: boolean; go: (page: string) => void };
const syntheticNote = 'Synthetic model only; no real-world exploitability or security guarantee.';
function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Section({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <section className="panel feature-card"><div className="card-eyebrow">{eyebrow}</div><h2>{title}</h2>{children}</section>;
}
function Stat({ name, value }: { name: string; value: string | number }) {
  return <div className="intel-stat"><span>{name}</span><strong>{value}</strong></div>;
}
export function AttackPathDetails({ scenario, analysis, go }: Props) {
  const [step, setStep] = useState<string | null>(null);
  const path = analysis?.path || [];
  const active = step && path.includes(step) ? step : path[0];
  const index = path.indexOf(active || '');
  const prev = index > 0 ? path[index - 1] : null;
  const next = index >= 0 && index < path.length - 1 ? path[index + 1] : null;
  const evidence = analysis?.evidence.filter(e => e.edge.includes(active || '')) || [];
  return <Section eyebrow="ATTACK PATH INTELLIGENCE / ENGINE PROVENANCE" title="Inspect a modeled path">
    {!analysis || !path.length ? <p className="empty-state">No engine-computed path available.</p> : <>
      <div className="intel-step-list">{path.map((id, i) => <button key={id} className={'intel-step ' + (active === id ? 'active' : '')} onClick={() => setStep(id)}><span>{String(i + 1).padStart(2, '0')}</span>{scenario.assets.find(a => a.id === id)?.name || id}<ArrowRight size={15}/></button>)}</div>
      <div className="intel-inspector"><h3>{scenario.assets.find(a => a.id === active)?.name || active}</h3>
        <Stat name="Asset ID" value={active || '—'}/><Stat name="Previous step" value={prev || 'Initial access'}/><Stat name="Next step" value={next || 'Target reached'}/><Stat name="Matching evidence records" value={evidence.length}/>
        <p className="muted">Engine path selection. A modeled path does not establish exploitability.</p>
      </div>
      <button className="secondary-btn" onClick={() => go('Evidence Vault')}>VIEW EVIDENCE <ArrowRight size={15}/></button>
    </>}
  </Section>;
}
// theghost-phase4-engine-connected: backend is the single source of model calculations.
type EngineAnalysis = Analysis & { iterations?: number };
type CompareResponse = {
  baseline: EngineAnalysis;
  alternate: EngineAnalysis;
  removed_reachable: string[];
  added_reachable: string[];
};
type OptimizeResponse = {
  status: string;
  mitigations: string[];
  cost: number | null;
  verified: boolean;
  algorithm: string;
};
type Candidate = { relationship: string; cost: number };
const edgeId = (e: Edge) => `${e.source}->${e.target}`;
function makeScenario(s: Scenario) {
  return {
    name: s.name,
    assets: s.assets,
    relationships: s.relationships.map(e => ({...e, enabled: true})),
    initial_access: s.initial_access,
    target: s.target,
    blocked_relationships: [] as string[]
  };
}
async function enginePost<T>(operation: 'analyze' | 'compare' | 'optimize', payload: unknown): Promise<T> {
  const response = await protectedFetch(`/api/v1/engine/${operation}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    let details = '';
    try {
      const body = await response.json();
      details = typeof body?.detail === 'string' ? body.detail : JSON.stringify(body?.detail || body?.error || '');
    } catch { /* Error responses may not contain JSON. */ }
    throw new Error(`Engine HTTP ${response.status}${details ? ': ' + details.slice(0, 350) : ''}`);
  }
  return response.json() as Promise<T>;
}
function useEngineTask<T>() {
  const [result, setResult] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const run = async (job: () => Promise<T>) => {
    setLoading(true);
    setError('');
    setResult(null);
    try { setResult(await job()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unknown engine error'); }
    finally { setLoading(false); }
  };
  const reset = () => { setResult(null); setError(''); };
  return {result, loading, error, run, reset};
}
function EngineStatus({loading, error}: {loading:boolean; error:string}) {
  return <div aria-live="polite">{loading && <p className="muted">Running security engine…</p>}
    {error && <p className="disclaimer" role="alert">Engine request failed: {error}</p>}</div>;
}
function EngineSummary({analysis, label}: {analysis:EngineAnalysis; label:string}) {
  return <div className="intel-inspector">
    <h3>{label}</h3>
    <div className="intel-stats">
      <Stat name="Engine decision" value={analysis.status}/>
      <Stat name="Reachable assets" value={analysis.reachable.length}/>
      <Stat name="Path length" value={analysis.path.length}/>
      <Stat name="Evidence records" value={analysis.evidence.length}/>
    </div>
    <p className="muted">Path: {analysis.path.join(' → ') || 'No path returned'}</p>
    <p className="muted">Rule: {analysis.rule_version} · Snapshot: {analysis.snapshot_sha256}</p>
  </div>;
}
function EdgeSelection({scenario, selected, onChange}: {
  scenario:Scenario; selected:string[]; onChange:(items:string[])=>void
}) {
  return <div className="control-grid">{scenario.relationships.map(edge => {
    const id=edgeId(edge);
    return <label key={id} className="control-tile">
      <input type="checkbox" checked={selected.includes(id)}
        onChange={e => onChange(e.target.checked ? [...selected,id] : selected.filter(x => x!==id))}/>
      <ShieldCheck size={17}/>
      <span><strong>{id}</strong><small>{edge.kind} · prerequisites: {edge.requires.join(', ') || 'none'}</small></span>
    </label>;
  })}</div>;
}
export function DefenseModule({scenario, connected}:Props) {
  const [budget,setBudget]=useState(6);
  const [costs,setCosts]=useState<Record<string,number>>({});
  const task=useEngineTask<OptimizeResponse>();
  const edges=scenario.relationships.map(edge=>edgeId(edge));
  const candidates:Candidate[]=edges.map(relationship=>({relationship,cost:costs[relationship] || 3}));
  return <Section eyebrow="DEFENSE OPTIMIZER / SECURITY ENGINE V2" title="Find minimum-cost modeled mitigations">
    <p className="muted">The Python engine searches for the lowest-cost set of blocked relationships that disconnects the modeled target. Cost values are illustrative, not financial estimates.</p>
    <div className="control-grid">{candidates.map(c=><label className="control-tile" key={c.relationship}>
      <ShieldCheck size={17}/><span><strong>{c.relationship}</strong><small>Hypothetical mitigation cost</small>
      <input aria-label={`Cost for ${c.relationship}`} type="number" min="1" max="100" value={c.cost}
        onChange={e=>{const value=Math.max(1,Math.min(100,Number(e.target.value)||1));setCosts(old=>({...old,[c.relationship]:value}));task.reset();}}/>
      </span></label>)}</div>
    <label className="intel-label">Maximum model budget <input type="number" min="0" max="1000" value={budget}
      onChange={e=>{setBudget(Math.max(0,Math.min(1000,Number(e.target.value)||0)));task.reset();}}/></label>
    <div className="intel-toolbar"><button className="secondary-btn" disabled={!connected || task.loading}
      onClick={()=>task.run(()=>enginePost<OptimizeResponse>('optimize',{scenario:makeScenario(scenario),candidates,budget}))}>
      <ShieldCheck size={15}/> RUN BACKEND OPTIMIZER</button></div>
    <EngineStatus loading={task.loading} error={task.error}/>
    {!connected && <p className="disclaimer">Backend not connected. No simulated result will be substituted.</p>}
    {task.result && <div className="intel-inspector">
      <Stat name="Engine status" value={task.result.status}/>
      <Stat name="Minimum cost" value={task.result.cost ?? 'Not found'}/>
      <Stat name="Algorithm" value={task.result.algorithm}/>
      <Stat name="Verified in model" value={task.result.verified ? 'Yes' : 'No'}/>
      <p className="muted">Mitigations: {task.result.mitigations.join(', ') || 'None'}</p>
    </div>}
    <p className="disclaimer">Synthetic model only. Mitigations are not applied to real infrastructure.</p>
  </Section>;
}
export function SimulationsModule({scenario,connected}:Props) {
  const [blocked,setBlocked]=useState<string[]>([]);
  const task=useEngineTask<CompareResponse>();
  return <Section eyebrow="SIMULATIONS / SECURITY ENGINE V2" title="Simulate relationship blocking">
    <p className="muted">Choose relationships to remove from a hypothetical scenario, then compare the engine's baseline and alternate results. Prerequisites are evaluated by Python.</p>
    <EdgeSelection scenario={scenario} selected={blocked} onChange={items=>{setBlocked(items);task.reset();}}/>
    <div className="intel-toolbar"><button className="secondary-btn" disabled={!connected || task.loading}
      onClick={()=>task.run(()=>enginePost<CompareResponse>('compare',{scenario:makeScenario(scenario),blocked}))}>
      RUN ENGINE SIMULATION <ArrowRight size={15}/></button>
      <button className="secondary-btn" onClick={()=>{setBlocked([]);task.reset();}}>RESET</button></div>
    <EngineStatus loading={task.loading} error={task.error}/>
    {!connected && <p className="disclaimer">Backend not connected. No local fallback is presented as an engine result.</p>}
    {task.result && <><EngineSummary analysis={task.result.baseline} label="Baseline"/>
      <EngineSummary analysis={task.result.alternate} label="Modified scenario"/>
      <p className="muted">No longer reachable: {task.result.removed_reachable.join(', ') || 'None'}</p></>}
    <p className="disclaimer">This operation changes only a synthetic model; it performs no network actions.</p>
  </Section>;
}
export function ParallelModule({scenario,connected}:Props) {
  const [left,setLeft]=useState<string[]>([]);
  const [right,setRight]=useState<string[]>([]);
  const [results,setResults]=useState<{a:CompareResponse;b:CompareResponse}|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const run=async()=>{
    setLoading(true);setError('');setResults(null);
    try {
      const payload=makeScenario(scenario);
      const [a,b]=await Promise.all([
        enginePost<CompareResponse>('compare',{scenario:payload,blocked:left}),
        enginePost<CompareResponse>('compare',{scenario:payload,blocked:right})
      ]);
      setResults({a,b});
    } catch(reason) {setError(reason instanceof Error?reason.message:'Unknown engine error');}
    finally {setLoading(false);}
  };
  const invalidate=()=>{setResults(null);setError('');};
  return <div>
    <div className="intel-columns">
      <Section eyebrow="PARALLEL UNIVERSE / A" title="Scenario A">
        <EdgeSelection scenario={scenario} selected={left} onChange={items=>{setLeft(items);invalidate();}}/>
        {results && <EngineSummary analysis={results.a.alternate} label="Engine result A"/>}
      </Section>
      <Section eyebrow="PARALLEL UNIVERSE / B" title="Scenario B">
        <EdgeSelection scenario={scenario} selected={right} onChange={items=>{setRight(items);invalidate();}}/>
        {results && <EngineSummary analysis={results.b.alternate} label="Engine result B"/>}
      </Section>
    </div>
    <div className="intel-toolbar"><button className="secondary-btn" disabled={!connected||loading} onClick={run}>
      COMPARE BOTH UNIVERSES <ArrowRight size={15}/></button></div>
    <EngineStatus loading={loading} error={error}/>
    {!connected && <p className="disclaimer">Backend not connected. Comparison unavailable.</p>}
    {results && <div className="intel-inspector">
      <Stat name="A: reachable assets" value={results.a.alternate.reachable.length}/>
      <Stat name="B: reachable assets" value={results.b.alternate.reachable.length}/>
      <Stat name="A: target path" value={results.a.alternate.path.length ? 'Present' : 'Blocked by model'}/>
      <Stat name="B: target path" value={results.b.alternate.path.length ? 'Present' : 'Blocked by model'}/>
    </div>}
    <p className="disclaimer">Both universes are evaluated by the same Python rule engine. No actual defensive configuration is changed.</p>
  </div>;
}
export function EvidenceModule({ analysis }: Props) {
  const [query, setQuery] = useState('');
  const evidence = (analysis?.evidence || []).filter(e => `${e.edge} ${e.kind} ${e.requires.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return <Section eyebrow="EVIDENCE VAULT / SOURCE TRACEABILITY" title="Search and export evidence">
    <div className="intel-toolbar"><label className="search-box"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search edge, rule, prerequisite"/></label>
    <button className="secondary-btn" disabled={!analysis} onClick={() => download('theghost-evidence.json', JSON.stringify({ snapshot: analysis?.snapshot_sha256, ruleVersion: analysis?.rule_version, evidence }, null, 2), 'application/json')}><Download size={15}/> EXPORT FILTERED JSON</button></div>
    <Stat name="Matching records" value={evidence.length}/>
    {evidence.map((e, i) => <div className="path-item" key={`${e.edge}-${i}`}><span className="step-number">{String(i + 1).padStart(2, '0')}</span><div><strong>{e.edge}</strong><small>{e.kind} · prerequisites: {e.requires.join(', ') || 'none'}</small></div></div>)}
    {!evidence.length && <p className="empty-state">No matching engine evidence.</p>}
    <p className="disclaimer">Only evidence returned by the engine is shown. Filtering does not alter the original analysis.</p>
  </Section>;
}
export function InvestigatorModule({ scenario, analysis }: Props) {
  const [question, setQuestion] = useState('Which assets are reachable?');
  const response = useMemo(() => {
    const q = question.toLowerCase();
    if (!analysis) return 'Engine analysis is unavailable. No security conclusions can be produced.';
    if (/reach|accessible/.test(q)) return `The engine reports ${analysis.reachable.length} reachable assets: ${analysis.reachable.map(id => scenario.assets.find(a => a.id === id)?.name || id).join(', ') || 'none'}.`;
    if (/path|attack|route/.test(q)) return analysis.path.length ? `The engine returned this modeled path: ${analysis.path.map(id => scenario.assets.find(a => a.id === id)?.name || id).join(' → ')}.` : 'No modeled path was returned.';
    if (/evidence|rule|proof/.test(q)) return `The engine returned ${analysis.evidence.length} evidence records under rule version ${analysis.rule_version}. Snapshot: ${analysis.snapshot_sha256}.`;
    if (/critical|target|vault/.test(q)) return `The configured target is ${scenario.assets.find(a => a.id === scenario.target)?.name || scenario.target}. This is a scenario property, not a validated vulnerability.`;
    return 'This offline evidence assistant supports questions about reachable assets, attack paths, evidence, rules and target. It does not use an LLM or invent unsupported findings.';
  }, [question, analysis, scenario]);
  return <Section eyebrow="GHOST INVESTIGATOR / DETERMINISTIC EVIDENCE ASSISTANT" title="Ask about the synthetic model">
    <p className="muted">Evidence-grounded, rule-based answers. No LLM is connected in this version.</p>
    <div className="intel-toolbar"><input className="intel-query" aria-label="Investigation question" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about paths, evidence, reachable assets..."/></div>
    <div className="intel-answer"><strong>INVESTIGATION RESULT</strong><p>{response}</p></div>
    <p className="disclaimer">The response is generated locally from the engine response and scenario. It is not a real-world security assessment.</p>
  </Section>;
}
export function ReportsModule({ scenario, analysis, connected }: Props) {
  const report = { title: 'theghost Synthetic Security Model Report', generatedAt: new Date().toISOString(), environment: scenario.name, source: connected ? 'Connected engine' : 'Local fallback scenario', synthetic: true, assets: scenario.assets.length, relationships: scenario.relationships.length, analysis: analysis ? { status: analysis.status, path: analysis.path, reachable: analysis.reachable, snapshot_sha256: analysis.snapshot_sha256, rule_version: analysis.rule_version, evidenceCount: analysis.evidence.length } : null, limitations: syntheticNote };
  const md = `# ${report.title}\n\nGenerated: ${report.generatedAt}\n\nEnvironment: ${report.environment}\n\nSource: ${report.source}\n\nAssets: ${report.assets}\n\nRelationships: ${report.relationships}\n\nEngine analysis: ${analysis ? 'available' : 'unavailable'}\n\nRule version: ${analysis?.rule_version || 'unavailable'}\n\nSnapshot: ${analysis?.snapshot_sha256 || 'unavailable'}\n\nModeled path: ${analysis?.path.join(' → ') || 'unavailable'}\n\nEvidence records: ${analysis?.evidence.length ?? 'unavailable'}\n\n## Limitations\n\n${syntheticNote}\n`;
  return <Section eyebrow="REPORTS / SYNTHETIC EXPORTS" title="Generate an evidence-aware report">
    <Stat name="Assets" value={scenario.assets.length}/><Stat name="Relationships" value={scenario.relationships.length}/><Stat name="Engine status" value={connected ? 'Connected' : 'Offline'}/>
    <div className="intel-toolbar"><button className="secondary-btn" onClick={() => download('theghost-synthetic-report.json', JSON.stringify(report, null, 2), 'application/json')}><Download size={15}/> DOWNLOAD JSON</button>
    <button className="secondary-btn" onClick={() => download('theghost-synthetic-report.md', md, 'text/markdown')}><Download size={15}/> DOWNLOAD MARKDOWN</button></div>
    <p className="disclaimer">{syntheticNote} Reports are generated in the browser; no server-side document storage.</p>
  </Section>;
}
export function LabModule({ scenario }: Props) {
  const [active, setActive] = useState(false);
  return <Section eyebrow="GHOST LAB / NON-EXECUTING DEMO" title="Safe model exercise">
    <p className="muted">This lab only explores the existing synthetic graph. It does not create containers, scan targets, or execute attack techniques.</p>
    <button className="secondary-btn" onClick={() => setActive(v => !v)}><FlaskConical size={16}/>{active ? 'CLOSE EXERCISE' : 'START EXERCISE'}</button>
    {active && <div className="intel-answer"><strong>EXERCISE: OBSERVE REACHABILITY</strong><p>The model contains {scenario.assets.length} assets and {scenario.relationships.length} relationships. Review the engine-computed path in Attack Paths. Open Simulations to compare hypothetical mitigations.</p></div>}
    <p className="disclaimer">{syntheticNote}</p>
  </Section>;
}
export function AdministrationModule({ scenario, connected }: Props) {
  return <Section eyebrow="ADMINISTRATION / PUBLIC DEMO READ-ONLY" title="Environment information">
    <Stat name="Workspace" value="Public synthetic demo"/><Stat name="Backend connection" value={connected ? 'Connected' : 'Unavailable'}/>
    <Stat name="Active scenario" value={scenario.name}/><Stat name="Access policy" value="Read-only demonstration"/>
    <p className="disclaimer">Authentication, RBAC, organization management, audit log persistence and private administration are not implemented. No administrative actions are available in this demo.</p>
  </Section>;
}
export function AdditionalModules({ page, ...props }: Props & { page: string }) {
  switch (page) {
    case 'Simulations': return <SimulationsModule {...props}/>;
    case 'Parallel Universes': return <ParallelModule {...props}/>;
    case 'AI Investigator': return <InvestigatorModule {...props}/>;
    case 'Reports': return <ReportsModule {...props}/>;
    case 'Ghost Lab': return <LabModule {...props}/>;
    case 'Administration': return <AdministrationModule {...props}/>;
    default: return null;
  }
}
