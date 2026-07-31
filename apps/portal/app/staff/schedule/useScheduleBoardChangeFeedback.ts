'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ScheduleBoardChangePhase =
  | 'checking'
  | 'reviewing'
  | 'saving'
  | 'reconciling'
  | 'saved'
  | 'restored'
  | 'verified';

export type ScheduleBoardChangeFeedback = {
  id: number;
  projectId: string;
  action: string;
  destination: string;
  phase: ScheduleBoardChangePhase;
};

type ScheduleTrustStatus = 'saved' | 'saving' | 'refreshing' | 'failed' | 'stale';

const TERMINAL_PHASES = new Set<ScheduleBoardChangePhase>(['saved', 'restored', 'verified']);

export function scheduleBoardChangeLabel(change: ScheduleBoardChangeFeedback): string {
  if (change.phase === 'checking') return `Checking ${change.action.toLowerCase()}…`;
  if (change.phase === 'reviewing') return 'Review required';
  if (change.phase === 'saving') return `Saving ${change.action.toLowerCase()}…`;
  if (change.phase === 'reconciling') return 'Checking saved schedule…';
  if (change.phase === 'saved') return `${change.action} saved`;
  if (change.phase === 'verified') return 'Schedule verified';
  return `${change.action} not saved · restored`;
}

export function useScheduleBoardChangeFeedback(trustStatus: ScheduleTrustStatus) {
  const nextIdRef = useRef(0);
  const [change, setChange] = useState<ScheduleBoardChangeFeedback | null>(null);

  const begin = useCallback((input: Omit<ScheduleBoardChangeFeedback, 'id' | 'phase'>): number => {
    const id = nextIdRef.current + 1;
    nextIdRef.current = id;
    setChange({ ...input, id, phase: 'checking' });
    return id;
  }, []);

  const setPhase = useCallback((id: number, phase: ScheduleBoardChangePhase) => {
    setChange((current) => (current?.id === id ? { ...current, phase } : current));
  }, []);

  useEffect(() => {
    if (!change || change.phase !== 'reconciling') return;
    if (trustStatus === 'saved') setPhase(change.id, 'verified');
    if (trustStatus === 'failed') setPhase(change.id, 'restored');
  }, [change, setPhase, trustStatus]);

  useEffect(() => {
    if (!change || !TERMINAL_PHASES.has(change.phase)) return;
    const timeout = window.setTimeout(() => {
      setChange((current) => (current?.id === change.id ? null : current));
    }, 3200);
    return () => window.clearTimeout(timeout);
  }, [change]);

  return { change, begin, setPhase };
}
