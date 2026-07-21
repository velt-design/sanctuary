'use client';

import { useCallback, useEffect } from 'react';

export function useUnsavedChangesGuard(isDirty: boolean, message = 'Discard unsaved changes?') {
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return useCallback((action: () => void) => {
    if (!isDirty || window.confirm(message)) action();
  }, [isDirty, message]);
}
