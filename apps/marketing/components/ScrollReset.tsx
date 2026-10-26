'use client';

import { useLayoutEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { createPageContinuity } from '../lib/pageContinuity';

export default function ScrollReset() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const continuity = useRef<ReturnType<typeof createPageContinuity> | null>(null);
  useLayoutEffect(() => {
    continuity.current = createPageContinuity();
    return () => { continuity.current?.dispose(); continuity.current = null; };
  }, []);
  useLayoutEffect(() => { continuity.current?.commit(); }, [pathname, search]);
  return null;
}
