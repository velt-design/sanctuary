'use client';

import { useCallback, useRef, useState } from 'react';

export type ScheduleBoardMutationNotice = {
  id: number;
  projectId: string;
  tone: 'error' | 'warning';
  message: string;
  actionLabel: 'Retry' | 'Refresh';
  onAction: () => void;
};

export function useScheduleBoardMutationNotice() {
  const [notices, setNotices] = useState<ScheduleBoardMutationNotice[]>([]);
  const sequenceRef = useRef(0);

  const clear = useCallback((projectId?: string) => {
    setNotices((current) => projectId ? current.filter((notice) => notice.projectId !== projectId) : []);
  }, []);

  const show = useCallback((next: Omit<ScheduleBoardMutationNotice, 'id'>) => {
    sequenceRef.current += 1;
    const notice = { ...next, id: sequenceRef.current };
    setNotices((current) => [...current.filter((item) => item.projectId !== next.projectId), notice]);
  }, []);

  return { notices, notice: notices.at(-1) ?? null, clear, show };
}
