"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiJson, ApiError } from '@/lib/repo/apiClient';
import { correspondenceContextSchema, CORRESPONDENCE_MAX_AGE_MS, type ProjectCorrespondenceContext } from '@/lib/projects/correspondence/contract';
import ProjectCorrespondenceCard from './ProjectCorrespondenceCard';

type ReadState = { state: 'not_connected' | 'available' | 'loading' | 'ready' | 'stale' | 'error'; context?: ProjectCorrespondenceContext };
function evidenceState(context: ProjectCorrespondenceContext): 'ready' | 'stale' {
  const oldest = Math.min(Date.parse(context.observedAt), ...context.sources.map(source => Date.parse(source.observedAt)));
  return Date.now() - oldest >= CORRESPONDENCE_MAX_AGE_MS ? 'stale' : 'ready';
}

export default function ProjectCorrespondenceQuery({ projectId, onAccessEnding }: {
  projectId: string; onAccessEnding?: (status: number) => void;
}) {
  // Remounting by project prevents even a one-frame display of another job's mail.
  return <CorrespondenceRead key={projectId} projectId={projectId} onAccessEnding={onAccessEnding} />;
}

function CorrespondenceRead({ projectId, onAccessEnding }: { projectId: string; onAccessEnding?: (status: number) => void }) {
  const [read, setRead] = useState<ReadState>({ state: 'loading' });
  const active = useRef<AbortController | null>(null);
  const earlier = useRef<ProjectCorrespondenceContext | undefined>(undefined);
  const accessCallback = useRef(onAccessEnding);
  accessCallback.current = onAccessEnding;
  const path = `/api/staff/v1/projects/${encodeURIComponent(projectId)}/correspondence`;

  const load = useCallback(async (check: boolean) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    if (check) earlier.current = undefined;
    setRead({ state: 'loading' });
    try {
      const reply = await apiJson<{ state: string; context?: unknown }>(path, {
        method: check ? 'POST' : 'GET', signal: controller.signal, cache: 'no-store', skipSaveTracking: true,
      });
      if (controller.signal.aborted) return;
      if (reply.state === 'not_connected') { earlier.current = undefined; setRead({ state: 'not_connected' }); }
      else if (reply.state === 'available') setRead(earlier.current ? { state: evidenceState(earlier.current), context: earlier.current } : { state: 'available' });
      else if (reply.state === 'ready' && check) {
        const context = correspondenceContextSchema.parse(reply.context);
        if (Math.abs(Date.now() - Date.parse(context.observedAt)) > CORRESPONDENCE_MAX_AGE_MS) throw new Error('Expired correspondence');
        earlier.current = context;
        setRead({ state: 'ready', context });
      } else throw new Error('Invalid correspondence response');
    } catch (error) {
      if (controller.signal.aborted) return;
      earlier.current = undefined;
      setRead({ state: 'error' });
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) accessCallback.current?.(error.status);
    }
  }, [path]);

  useEffect(() => {
    void load(false);
    // Evidence stays only in this mounted project. On return, recheck staff and
    // project access before redisplaying it; never start a background model read.
    const clearPrivateEvidence = () => {
      if (document.visibilityState === 'hidden') {
        active.current?.abort();
        setRead({ state: 'loading' });
      } else void load(false);
    };
    document.addEventListener('visibilitychange', clearPrivateEvidence);
    return () => { active.current?.abort(); document.removeEventListener('visibilitychange', clearPrivateEvidence); };
  }, [load]);

  useEffect(() => {
    if (!read.context || read.state !== 'ready') return;
    const oldest = Math.min(Date.parse(read.context.observedAt), ...read.context.sources.map(source => Date.parse(source.observedAt)));
    const timer = setTimeout(() => { void load(false); }, Math.max(0, oldest + CORRESPONDENCE_MAX_AGE_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [read.context, read.state, load]);

  return <ProjectCorrespondenceCard {...read} onRefresh={read.state === 'not_connected' ? undefined : () => void load(true)} />;
}
