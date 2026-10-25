'use client';

import dynamic from 'next/dynamic';
import { useLayoutEffect, useMemo } from 'react';
import { useOptionalGlobalPortalSearchState } from './GlobalPortalSearchState';

// This producer is delivered by guarded leaves, never imported by the shared public frame.
const Reader = dynamic(() => import('./GlobalPortalSearchRead'), { loading: () => null });

export default function GuardedGlobalPortalSearch() {
  const publish = useOptionalGlobalPortalSearchState()?.publishReader;
  const registration = useMemo(() => ({ component: Reader }), [publish]);
  useLayoutEffect(() => { publish?.(registration); return () => publish?.(null); }, [publish, registration]);
  return null;
}
