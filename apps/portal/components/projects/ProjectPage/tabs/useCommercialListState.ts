'use client';

import { useEffect, useState } from 'react';
import { useOptionalPortalQueryClient } from '@/lib/react-query/PortalQueryClientContext';

/** In-session view choices follow a project through detail and back.
 * The staff query client is discarded at the existing access-ending boundary. */
export function useCommercialListState<T>(projectId: string, section: string, initial: T): [T, (value: T) => void] {
  const client = useOptionalPortalQueryClient();
  const key = ['commercialListView', projectId, section];
  const identity = `${projectId}:${section}`;
  const [state, setState] = useState(() => ({ identity, client, value: client?.getQueryData<T>(key) ?? initial }));
  const value = state.identity === identity && state.client === client ? state.value : client?.getQueryData<T>(key) ?? initial;
  return [value, (next) => {
    setState({ identity, client, value: next });
    client?.setQueryData(key, next);
  }];
}

export function useCommercialListScroll(projectId: string, section: string, ready: boolean) {
  const client = useOptionalPortalQueryClient();
  useEffect(() => {
    if (!ready || !client) return;
    const key = ['commercialListView', projectId, `${section}-scroll`];
    const saved = client.getQueryData<number>(key);
    const activeKey = ['commercialListView', projectId, 'active-section'];
    const returningToList = client.getQueryData<string>(activeKey) === section;
    client.setQueryData(activeKey, section);
    // A detail return keeps its list position. A different tab must not yank
    // the current viewport to that tab's old position after its read completes.
    const frame = !returningToList || saved === undefined ? null : requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: 'instant' }));
    let position = window.scrollY;
    const remember = () => { position = window.scrollY; };
    window.addEventListener('scroll', remember, { passive: true });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', remember);
      client.setQueryData(key, position);
    };
  }, [client, projectId, ready, section]);
}
