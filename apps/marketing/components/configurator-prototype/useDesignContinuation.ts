'use client';
import { useEffect, useState } from 'react';
import { DESIGN_CONTINUATION_EVENT, readDesignContinuation, type DesignContinuation } from './designContinuation';

export function useDesignContinuation() {
  const [state, setState] = useState<DesignContinuation>({ started: false, dismissed: false, section: 'structure' });
  useEffect(() => {
    const sync = () => setState({ ...readDesignContinuation() });
    sync();
    window.addEventListener(DESIGN_CONTINUATION_EVENT, sync);
    return () => window.removeEventListener(DESIGN_CONTINUATION_EVENT, sync);
  }, []);
  return state;
}
