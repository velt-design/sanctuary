'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { CommercialProjectNotice, ProjectCommercialProvider } from '@/components/projects/ProjectPage/ProjectCommercialContext';
import { projectCommandCentreQueryOptions } from '@/lib/queries/projects';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

/** Reuses the Project's presentation acknowledgement, not a new command permission. */
export default function StudioCommercialPolicy({ actorId, projectId, children,quietChecking=false }: {
  actorId: string; projectId: string; children: ReactNode;quietChecking?:boolean;
}) {
  const session = usePortalSession();
  const eligible = session.status === 'authenticated' && session.user?.id === actorId
    && (session.role === 'staff' || session.role === 'admin');
  return <CurrentProjectPolicy key={`${actorId}:${projectId}:${session.user?.id}:${eligible}`} actorId={actorId} projectId={projectId} eligible={eligible} quietChecking={quietChecking}>
    {children}
  </CurrentProjectPolicy>;
}

function CurrentProjectPolicy({ actorId, projectId, eligible, children,quietChecking }: {
  actorId: string; projectId: string; eligible: boolean; children: ReactNode;quietChecking:boolean;
}) {
  const host = supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';
  // An actor-scoped fresh read cannot reuse another actor's acknowledgement context.
  const options = projectCommandCentreQueryOptions(host, projectId, actorId);
  const query = useQuery({
    ...options,
    enabled: eligible,
  });
  const data = query.data;
  const matching = data?.projectId === projectId && (data.workModel === 'legacy'
    || (data.workModel === 'v2' && data.projectWork?.projectId === projectId));
  const ready = eligible && query.isSuccess && query.isFetchedAfterMount && !query.isFetching && matching;
  return <ProjectCommercialProvider projectId={projectId} work={matching && data?.workModel === 'v2' ? data.projectWork : undefined} ready={Boolean(ready)}>
    {ready ? <CommercialProjectNotice projectId={projectId} view="studio" /> : quietChecking&&query.isFetching&&!query.isError?null:<section aria-label="Studio commercial availability">
      <p role={query.isError ? 'alert' : 'status'}>{query.isFetching
        ? 'Checking the current project state. Saved designs remain available.'
        : 'Commercial actions are paused until the current project state can be confirmed. Saved designs remain available.'}</p>
      {eligible && !query.isFetching && <button type="button" onClick={() => { void query.refetch(); }}>Retry project state</button>}
    </section>}
    {children}
  </ProjectCommercialProvider>;
}
