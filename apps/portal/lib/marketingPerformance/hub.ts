import { ageBands, matchesAge } from './overview';
import { z } from 'zod';
import { reportSchema, type Filters, type MarketingRow, UNKNOWN_SOURCE, NO_CAMPAIGN, aucklandDay } from './contract';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import { PROJECT_OWNER_OPTIONS } from '@/lib/projects/commandCentre/projectOwners';

export const projectSchema = z.object({
  id: z.string().uuid(), name: z.string().nullable(), createdAt: z.string().datetime({ offset: true }),
  stage: z.string().nullable(), state: z.string(), owner: z.string().nullable(), closedOutcome: z.string().nullable(),
  originId: z.string().uuid().nullable(), originAt: z.string().datetime({ offset: true }).nullable(),
  source: z.string().nullable(), campaign: z.string().nullable(), receiptCount: z.number().int().nonnegative(),
  paymentVerified: z.boolean(), knownTest: z.boolean(), testCandidate: z.boolean(),
});
export const eventSchema = z.object({
  id: z.string(), projectId: z.string().uuid(), kind: z.enum(['quote_sent','quote_accepted','payment','reversal','adjustment','invoice_paid']),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: z.string(), amountCents: z.number().int().nullable(),
});
export const hubSchema = z.object({
  schemaVersion: z.literal(1), asOf: z.string().datetime({ offset: true }), start: z.string(), end: z.string(),
  enquiries: reportSchema, projects: z.array(projectSchema).max(5000), events: z.array(eventSchema).max(10000),
  earliestReceipt: z.string().datetime({ offset: true }).nullable(), candidateEnquiryIds: z.array(z.string().uuid()),
}).superRefine((hub, ctx) => {
  const ids = new Set(hub.projects.map(p => p.id));
  if (ids.size !== hub.projects.length || new Set(hub.events.map(e => e.id)).size !== hub.events.length
    || hub.events.some(e => !ids.has(e.projectId) || e.day < hub.start || e.day > hub.end)
    || hub.enquiries.start !== hub.start || hub.enquiries.end !== hub.end)
    ctx.addIssue({ code: 'custom', message: 'Inconsistent hub evidence' });
});
export type HubReport = z.infer<typeof hubSchema>;
export type HubProject = z.infer<typeof projectSchema>;
export type HubEvent = z.infer<typeof eventSchema>;
export const views = [{ key: 'overview', label: 'Business overview' }, { key: 'enquiries', label: 'Enquiries' }, { key: 'sales', label: 'Sales activity' }, { key: 'portfolio', label: 'Project portfolio' }] as const;
export type HubView = typeof views[number]['key'];
export const evidenceOptions = [
  ['all','All evidence'], ['qualified','Qualified enquiries'], ['unreviewed','Awaiting assessment'],
  ['visit','Recorded confirmations'], ['quote','Sent-quote evidence'], ['accepted','Current accepted scope'],
  ['payment','Payment-verified projects'], ['no_receipt','Projects without enquiry receipts'],
  ['unlinked','Unlinked enquiries'], ['unknown_source','Unknown source'],
  ['paid_gap','Marked paid, missing payment evidence'], ['test','Possible / known tests'],
] as const;
export function evidenceForView(view:HubView) {
  return evidenceOptions.filter(([key]) => view==='enquiries' ? key!=='no_receipt'
    : !['qualified','unreviewed','visit','quote','accepted','unlinked'].includes(key));
}
export type HubFilters = Filters & { view: HubView; owner: string; stage: string; state: string; evidence: string; created: boolean; kind:string; inspect:string; chartMetric:string; chartScale:string; age:string };
export function hubDefaults(filters: Filters): HubFilters {
  return { ...filters, view: 'enquiries', owner: '', stage: '', state: '', evidence: 'all', created: false, kind:'', inspect:'all', chartMetric:'enquiries', chartScale:'count', age:'' };
}
export function parseHubFilters(query: URLSearchParams, fallback: Filters): HubFilters {
  const base = hubDefaults(fallback);
  for (const key of ['start','end','source','campaign','owner','stage','state'] as const) base[key] = query.get(key) ?? base[key];
  base.stage=base.stage==='__unknown'?'__unknown':normalizePipelineStageKey(base.stage)??'';
  const metric=query.get('chartMetric'); if(metric&&['enquiries','qualified','quote','accepted','won'].includes(metric))base.chartMetric=metric;
  if(query.get('chartScale')==='rate')base.chartScale='rate';
  if(base.state && !['ACTIVE','WAITING','CLOSED','ARCHIVED','UNKNOWN'].includes(base.state)) base.state='';
  if(base.owner!=='unassigned' && !PROJECT_OWNER_OPTIONS.some(o=>o.key===base.owner)) base.owner='';
  const view = query.get('view'); if (views.some(v => v.key === view)) base.view = view as HubView;
  const evidence = query.get('evidence'); if (evidenceForView(base.view).some(([key]) => key === evidence)) base.evidence = evidence!;
  const kind=query.get('kind'); if(kind && (kind==='receipts'||Object.hasOwn(eventLabels,kind))) base.kind=kind;
  const inspect=query.get('inspect'); if(base.view!=='sales' && inspect && (evidenceForView(base.view).some(([key])=>key===inspect)||(base.view==='portfolio'&&inspect==='paid'))) base.inspect=inspect;
  const age=query.get('age'); if(ageBands.some(b=>b.key===age))base.age=age!;
  base.created = query.get('created') === 'true';
  return base;
}
export function hubQuery(filters: HubFilters): URLSearchParams {
  return new URLSearchParams(Object.entries(filters).filter(([,v]) => v !== '' && v !== false).map(([k,v]) => [k,String(v)]));
}
function matchesProject(p: HubProject | undefined, f: HubFilters) {
  return (!f.owner || (p?.owner ?? 'unassigned') === f.owner)
    && (!f.stage || (normalizePipelineStageKey(p?.stage)??'__unknown') === f.stage)
    && (!f.state || p?.state === f.state);
}
function matchesSource(p: { source: string | null; campaign: string | null }, f: HubFilters) {
  return (!f.source || (p.source ?? UNKNOWN_SOURCE) === f.source) && (!f.campaign || (p.campaign ?? NO_CAMPAIGN) === f.campaign);
}
function matchesEvidence(p: HubProject | undefined, row: MarketingRow | undefined, f: HubFilters, candidate: boolean) {
  switch (f.evidence) {
    case 'qualified': case 'unreviewed': return row?.qualification === f.evidence;
    case 'visit': case 'quote': case 'accepted': return Boolean(row?.origin && row[f.evidence]);
    case 'payment': return row ? row.origin && row.won : Boolean(p?.paymentVerified);
    case 'no_receipt': return p?.receiptCount === 0;
    case 'unlinked': return Boolean(row && !row.projectId);
    case 'unknown_source': return (row ?? p)?.source === null;
    case 'paid_gap': return normalizePipelineStageKey(p?.stage) === 'paid' && !p?.paymentVerified;
    case 'paid': return normalizePipelineStageKey(p?.stage) === 'paid';
    case 'test': return candidate || Boolean(p?.testCandidate || p?.knownTest);
    default: return true;
  }
}
export function selectHub(hub: HubReport, f: HubFilters) {
  const projectMap = new Map(hub.projects.map(p => [p.id,p]));
  const candidates = new Set(hub.candidateEnquiryIds);
  const enquiries = hub.enquiries.rows.filter(r => {
    const p = projectMap.get(r.projectId ?? '');
    return matchesProject(p,f) && matchesSource(r,f) && matchesEvidence(p,r,f,candidates.has(r.enquiryId))
      && matchesEvidence(p,r,{...f,evidence:f.inspect},candidates.has(r.enquiryId));
  });
  const origins = new Map(hub.enquiries.rows.filter(r => r.origin).map(r => [r.projectId,r]));
  const projects = hub.projects.filter(p => matchesProject(p,f) && matchesSource(p,f)
    && matchesEvidence(p, ['qualified','unreviewed','visit','quote','accepted'].includes(f.evidence) ? origins.get(p.id) : undefined,f,false)
    && matchesEvidence(p, ['qualified','unreviewed','visit','quote','accepted'].includes(f.inspect) ? origins.get(p.id) : undefined,{...f,evidence:f.inspect},false)
    && (f.view !== 'portfolio' || !f.created || (aucklandDay(new Date(p.createdAt)) >= f.start && aucklandDay(new Date(p.createdAt)) <= f.end))
    && (f.view !== 'portfolio' || !f.age || matchesAge(p,hub.asOf,f.age)));
  const ids = new Set(projects.map(p => p.id));
  const events = hub.events.filter(e => ids.has(e.projectId));
  return { enquiries, projects, events, projectMap };
}
export const eventLabels: Record<HubEvent['kind'], string> = {
  quote_sent: 'Quote version sent', quote_accepted: 'Quote version accepted', payment: 'Payment recorded',
  reversal: 'Payment reversed', adjustment: 'Ledger adjustment', invoice_paid: 'Invoice marked paid',
};
export const money = (cents: number) => new Intl.NumberFormat('en-NZ',{ style:'currency',currency:'NZD' }).format(cents/100);
