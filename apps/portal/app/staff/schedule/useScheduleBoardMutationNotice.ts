'use client';

import { useCallback, useState } from 'react';

export type ScheduleBoardMutationNotice = {
  id: number;
  projectId: string;
  tone: 'error' | 'warning';
  message: string;
  actionLabel: 'Retry' | 'Refresh';
  onAction: () => void;
};

export function useScheduleBoardMutationNotice() {
  const [notice, setNotice] = useState<ScheduleBoardMutationNotice | null>(null);

  const clear = useCallback((projectId?: string) => {
    setNotice((current) => (!projectId || current?.projectId === projectId ? null : current));
  }, []);

  const show = useCallback((next: Omit<ScheduleBoardMutationNotice, 'id'>) => {
    setNotice((current) => ({ ...next, id: (current?.id ?? 0) + 1 }));
  }, []);

  return { notice, clear, show };
}
