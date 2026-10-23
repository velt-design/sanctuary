'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ProjectWorkProjection } from '@/lib/projects/workItems/types';
import { projectOperationalStatusLabel } from '@/lib/projects/projectCurrentStatus';
import { AlertBanner, Button, ButtonLink } from '@/components/ui/foundation';

type CommercialContext = {
  closed: boolean;
  paused: boolean;
  status: string | null;
  actionsAvailable: boolean;
  ready: boolean;
  reviewActions: () => void;
};
const Context = createContext<CommercialContext>({
  closed: false, paused: false, status: null, actionsAvailable: true, ready: true, reviewActions: () => undefined,
});
export const useProjectCommercialContext = () => useContext(Context);

/** Published private nodes keep their originating guarded value; this owns no state. */
export function ProjectCommercialScope({ value, children }: { value: CommercialContext; children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function ProjectCommercialProvider({ projectId, work, ready, children }: {
  projectId: string; work?: ProjectWorkProjection; ready: boolean; children: ReactNode;
}) {
  const closed = work?.effectiveState === 'CLOSED' || work?.effectiveState === 'ARCHIVED';
  const paused = closed || work?.effectiveState === 'WAITING';
  const identity = `${projectId}:${work?.effectiveState}:${work?.stateRowVersion}`;
  const [reviewed, setReviewed] = useState<string | null>(null);
  return <Context.Provider value={{
    closed, paused, ready,
    status: projectOperationalStatusLabel(work?.effectiveState ?? null, work?.closedOutcome),
    actionsAvailable: ready && (!paused || reviewed === identity),
    reviewActions: () => setReviewed(identity),
  }}>{children}</Context.Provider>;
}

/** Presentation acknowledgement only. Existing command permissions and safeguards still apply. */
export function CommercialProjectNotice({ projectId, view }: { projectId: string; view: string }) {
  const context = useProjectCommercialContext();
  if (!context.ready) return <AlertBanner tone="info" title="Commercial actions paused">Record actions require a verified current project state. Retry any failed project reads above.</AlertBanner>;
  if (!context.paused) return null;
  return <AlertBanner tone="info" title={context.status ?? 'Project on hold'}>
    <p>{context.closed
      ? 'Review the agreement, invoices and payment history to finish the commercial record. Closing the project does not cancel an invoice or change money recorded.'
      : 'Project work is on hold. Check the reason and agreed next step before sending, billing or preparing delivery.'}</p>
    {view !== 'invoices' && <ButtonLink variant="secondary" size="small" href={`/staff/projects/${encodeURIComponent(projectId)}?tab=invoices`}>Review invoices & payments</ButtonLink>}
    {context.actionsAvailable
      ? <p>Commercial actions are available for this review. Check the scope and customer agreement before making a change.</p>
      : <Button variant="quiet" size="small" onClick={context.reviewActions}>Review commercial actions</Button>}
  </AlertBanner>;
}
