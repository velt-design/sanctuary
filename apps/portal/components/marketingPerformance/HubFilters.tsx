import { ageBands } from '@/lib/marketingPerformance/overview';
import { useEffect, useState } from 'react';
import { Button, Input, Select } from '@/components/ui/foundation/FoundationControls';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { PIPELINE_STAGES } from '@/lib/projects/pipelineDefinition';
import { PROJECT_OWNER_OPTIONS } from '@/lib/projects/commandCentre/projectOwners';
import { type HubFilters as Filters, type HubReport, hubQuery, parseHubFilters, evidenceForView } from '@/lib/marketingPerformance/hub';
import { UNKNOWN_SOURCE, NO_CAMPAIGN, validPeriod } from '@/lib/marketingPerformance/contract';
import DateRangeShortcuts from './DateRangeShortcuts';
import styles from './MarketingPerformance.module.css';

type SavedView = { name: string; query: string };
export default function HubFilters({draft,setDraft,apply,hub,validation,savedOnly=false}: {
  draft:Filters; setDraft:(f:Filters)=>void; apply:(f:Filters)=>void; hub:HubReport|null; validation:string;savedOnly?:boolean;
}) {
  const [saved,setSaved] = useState<SavedView[]>([]), [name,setName] = useState(''), [storageMessage,setStorageMessage] = useState('');
  useEffect(() => { try { const value = JSON.parse(localStorage.getItem('marketing-hub-views-v1') ?? '[]');
    if (Array.isArray(value)) setSaved(value.filter(v => typeof v?.name === 'string' && typeof v?.query === 'string').slice(0,10));
  } catch { setStorageMessage('Saved views are unavailable in this browser.'); } },[]);
  const persist = (next:SavedView[]) => { try { localStorage.setItem('marketing-hub-views-v1',JSON.stringify(next)); setSaved(next); setStorageMessage('Saved on this browser, with these exact dates.'); } catch { setStorageMessage('Could not save in this browser.'); } };
  const sourceRows = [...(hub?.projects ?? []),...(hub?.enquiries.rows ?? [])];
  const sources = [...new Set([UNKNOWN_SOURCE,...sourceRows.map(r=>r.source ?? UNKNOWN_SOURCE),draft.source].filter(Boolean))].sort();
  const campaigns = [...new Set([NO_CAMPAIGN,...sourceRows.map(r=>r.campaign ?? NO_CAMPAIGN),draft.campaign].filter(Boolean))].sort();
  const SavedContainer=savedOnly?'div':'details';
  return <Card title={savedOnly?undefined:"Explore your records"} padding="compact">
    {!savedOnly&&<><DateRangeShortcuts start={draft.start} end={draft.end} onSelect={dates=>apply({...draft,...dates})}/>
    <form onSubmit={event=>{event.preventDefault();apply(draft);}}>
      <div className={styles.hubFilters}>
        <Input type="date" label="From" value={draft.start} required onChange={e=>setDraft({...draft,start:e.target.value})}/>
        <Input type="date" label="To" value={draft.end} required onChange={e=>setDraft({...draft,end:e.target.value})}/>
        <Select label="Observed source" value={draft.source} onChange={e=>setDraft({...draft,source:e.target.value})}><option value="">All sources</option>{sources.map(s=><option key={s}>{s}</option>)}</Select>
        <Select label="Campaign" value={draft.campaign} onChange={e=>setDraft({...draft,campaign:e.target.value})}><option value="">All campaigns</option>{campaigns.map(s=><option key={s}>{s}</option>)}</Select>
        <Select label="Current project owner" value={draft.owner} onChange={e=>setDraft({...draft,owner:e.target.value})}><option value="">All owners</option><option value="unassigned">Unassigned / no project</option>{PROJECT_OWNER_OPTIONS.map(o=><option key={o.key} value={o.key}>{o.displayName}</option>)}</Select>
        <Select label="Current project stage" value={draft.stage} onChange={e=>setDraft({...draft,stage:e.target.value})}><option value="">All stages</option>{PIPELINE_STAGES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}<option value="__unknown">Unknown stage</option></Select>
        <Select label="Project state" value={draft.state} onChange={e=>setDraft({...draft,state:e.target.value})}><option value="">All states, including archived</option>{['ACTIVE','WAITING','CLOSED','ARCHIVED','UNKNOWN'].map(s=><option key={s}>{s}</option>)}</Select>
        <Select label="Evidence" value={draft.evidence} onChange={e=>setDraft({...draft,evidence:e.target.value})}>{evidenceForView(draft.view).map(([key,label])=><option key={key} value={key}>{label}</option>)}</Select>
      {draft.view==='portfolio'&&<Select label="Age of active / waiting projects" value={draft.age} onChange={e=>setDraft({...draft,age:e.target.value})}><option value="">All ages and states</option>{ageBands.map(b=><option key={b.key} value={b.key}>{b.label}</option>)}</Select>}
      </div>
      <div className={styles.hubActions}><Button type="submit">Apply filters</Button><Button type="button" variant="secondary" onClick={()=>apply({...draft,source:'',campaign:'',owner:'',stage:'',state:'',evidence:'all',created:false,kind:'',inspect:'all',age:''})}>Clear filters</Button>
        <label><input type="checkbox" disabled={draft.view!=='portfolio'} checked={draft.created} onChange={e=>apply({...draft,created:e.target.checked})}/> Limit portfolio to projects created in these dates</label></div>
    </form>
    <div className={styles.filterNote} aria-live="polite">{validation || (draft.view==='overview' ? 'Stages and ages describe the current portfolio; dates limit sales activity only. All charts use the other filters above.' : draft.view==='portfolio' ? draft.created ? 'Current project position, filtered by project-created date. Includes archived projects unless filtered.' : 'Current position of all projects. Dates do not limit the portfolio unless the box above is selected.' : draft.view==='sales' ? 'Auckland event dates, inclusive. Includes projects regardless of when they were created or enquired.' : 'Auckland enquiry-received dates, inclusive. Outcomes reflect evidence available now, including later progress.')}</div>
    </>}
    <SavedContainer>{!savedOnly&&<summary>Saved views · {saved.length}</summary>}<div className={styles.hubActions}>
      <Input label="View name" value={name} maxLength={60} onChange={e=>setName(e.target.value)}/>
      <Button variant="secondary" disabled={!name.trim() || !validPeriod(draft.start,draft.end) || saved.length>=10 && !saved.some(v=>v.name===name.trim())} onClick={()=>{apply(draft);persist([...saved.filter(v=>v.name!==name.trim()),{name:name.trim(),query:hubQuery(draft).toString()}]);setName('');}}>Save this view</Button>
      {saved.map(v=><span key={v.name}><Button variant="quiet" onClick={()=>apply(parseHubFilters(new URLSearchParams(v.query),draft))}>{v.name}</Button><Button variant="quiet" aria-label={`Remove saved view ${v.name}`} onClick={()=>persist(saved.filter(s=>s.name!==v.name))}>×</Button></span>)}
      <span role="status" className={styles.muted}>{storageMessage || 'Saved on this browser only; report records are not stored.'}</span>
    </div></SavedContainer>
  </Card>;
}
