import { commercialSchema, inPeriod, type CommercialReport } from '@/lib/marketingPerformance/commercial';
import { previousPeriod } from '@/lib/marketingPerformance/trends';
import type { Filters } from '@/lib/marketingPerformance/contract';
import type { HubReport } from '@/lib/marketingPerformance/hub';
import type { CommercialLoader } from '@/components/marketingPerformance/useCommercial';
import { hubFixture } from './hubFixtures';
import { representativeFixture } from './representativeFixture';

const id = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;
// The same synthetic event inventory drives the existing sales charts and the
// commercial fixture. Amounts are invented; a later sent version replaces value.
export function commercialFixture(hub: HubReport, filters: Filters): CommercialReport {
  const prior = previousPeriod(filters.start, filters.end);
  const rows = hub.projects.flatMap((project, i) => {
    const events = hub.events.filter(e => e.projectId === project.id), sent = events.filter(e => e.kind === 'quote_sent').sort((a, b) => a.day.localeCompare(b.day));
    const accepted = events.filter(e => e.kind === 'quote_accepted').sort((a, b) => b.day.localeCompare(a.day))[0];
    if (!sent.length && !accepted) return [];
    const amountCents = 1200000 + i % 8 * 350000;
    const sentValue = (start: string, end: string) => {
      const event = [...sent].reverse().find(e => inPeriod(`${e.day}T03:00:00Z`, start, end));
      return event ? { versionId: id(i * 10 + sent.indexOf(event) + 1), versionNumber: sent.indexOf(event) + 1, sentAt: `${event.day}T03:00:00Z`, amountCents } : null;
    };
    return [{ quoteId: id(i + 1), projectId: project.id, quoteRef: `DEMO-${String(i + 1).padStart(3, '0')}`, scopeKind: 'base' as const,
      undatedSendCount: 0, originAt: project.originAt, firstSentAt: sent[0] ? `${sent[0].day}T03:00:00Z` : null,
      currentSent: sentValue(filters.start, filters.end), priorSent: sentValue(prior.start, prior.end),
      accepted: accepted?.status === 'ACCEPTED' ? { versionId: id(i * 10 + Math.max(1, sent.length)), versionNumber: Math.max(1, sent.length), acceptedAt: `${accepted.day}T03:00:00Z`, amountCents } : null }];
  });
  const earliestSentAt = rows.flatMap(r => r.firstSentAt ? [r.firstSentAt] : []).sort()[0] ?? null;
  return commercialSchema.parse({ schemaVersion: 2, asOf: hub.asOf, ...filters, priorStart: prior.start, priorEnd: prior.end,
    currency: 'NZD', taxBasis: 'including_gst', earliestSentAt, rows });
}
const failedOnce = new Set<string>();
export const commercialLoader: CommercialLoader = async (filters, signal) => {
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(resolve, 300); signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Aborted')); }, { once: true }); });
  const query = new URLSearchParams(window.location.search);
  const failure = query.get('commercialFailure'), failureKey = `${filters.start}:${filters.end}`;
  const shouldFail = failure === '1' || (failure === 'once' && !failedOnce.has(failureKey));
  if (failure === 'once') failedOnce.add(failureKey);
  if (shouldFail) throw new Error('Synthetic commercial source failure. No business system was contacted.');
  const hub = query.get('representative') === '1' ? representativeFixture : hubFixture;
  return query.get('commercialCoverage') === '1' ? commercialCoverageScenario(hub, filters).commercial : commercialFixture(hub, filters);
};

// One explicit synthetic coverage scenario; the same adjusted event inventory is
// returned to the hub so event charts do not invent a dated undated acceptance.
export function commercialCoverageScenario(hub: HubReport, filters: Filters) {
  const commercial = commercialFixture(hub, filters);
  const undated = commercial.rows.find(r => r.accepted);
  const missing = commercial.rows.find(r => inPeriod(r.firstSentAt,filters.start,filters.end) && r.quoteId !== undated?.quoteId);
  if (undated?.accepted) undated.accepted.acceptedAt = null;
  if (missing) missing.originAt = null;
  // A historical undated sent version precedes these dated revisions; no date is invented.
  const uncertain = commercial.rows.find(r => !r.accepted && inPeriod(r.firstSentAt, '2026-08-01', '2026-09-20'));
  const addedAcceptance = uncertain ? { id:'demo-uncertain-first-send-accepted', projectId:uncertain.projectId, kind:'quote_accepted' as const, day:'2026-09-22',status:'ACCEPTED',amountCents:null } : null;
  if (uncertain) {
    const projectIndex = hub.projects.findIndex(p => p.id === uncertain.projectId);
    const versionNumber = hub.events.filter(e => e.projectId === uncertain.projectId && e.kind === 'quote_sent').length;
    uncertain.accepted = {versionId:id(projectIndex * 10 + versionNumber),versionNumber,amountCents:1200000 + projectIndex % 8 * 350000,acceptedAt:'2026-09-22T03:00:00Z'};
  }
  if (uncertain) {
    uncertain.undatedSendCount = 1;
    for (const version of [uncertain.currentSent, uncertain.priorSent, uncertain.accepted]) if (version) version.versionNumber += 1;
  }
  commercial.rows.push({ quoteId:id(9000003),projectId:hub.projects[0].id,quoteRef:'DEMO-UNDATED-SEND',scopeKind:'base',
    originAt:hub.projects[0].originAt,firstSentAt:null,undatedSendCount:1,currentSent:null,priorSent:null,accepted:null });
  const project = hub.projects[0], sentAt = '2026-09-05T03:00:00Z', acceptedAt = '2026-09-10T03:00:00Z';
  const version = {versionId:id(9000002),versionNumber:1,amountCents:450000};
  const addon = {quoteId:id(9000001),projectId:project.id,quoteRef:'DEMO-ADDON-01',scopeKind:'add_on' as const,
    undatedSendCount:0,originAt:project.originAt,firstSentAt:sentAt,currentSent:inPeriod(sentAt,filters.start,filters.end)?{...version,sentAt}:null,
    priorSent:inPeriod(sentAt,commercial.priorStart,commercial.priorEnd)?{...version,sentAt}:null,accepted:{...version,acceptedAt}};
  commercial.rows.push(addon);
  const adjusted: HubReport = {...hub,projects:hub.projects.map(p=>p.id===missing?.projectId?{...p,originAt:null}:p),
    events:[...(addedAcceptance ? [addedAcceptance] : []),...hub.events.filter(e=>!(e.projectId===undated?.projectId&&e.kind==='quote_accepted')),
      {id:'demo-commercial-addon-sent',projectId:project.id,kind:'quote_sent',day:'2026-09-05',status:'ACCEPTED',amountCents:null},
      {id:'demo-commercial-addon-accepted',projectId:project.id,kind:'quote_accepted',day:'2026-09-10',status:'ACCEPTED',amountCents:null}]};
  return {hub:adjusted,commercial:commercialSchema.parse(commercial)};
}
