'use client';

import { useEffect, useState, type ReactNode } from 'react';
import LocalFirstPortalMutations from '@/components/sync/LocalFirstPortalMutations';
import { startLocalFirstRuntime, stopLocalFirstRuntime } from '@/lib/localFirst/runtime';
import { discardAllLocalFirstState } from '@/lib/localFirst/store';

const FIXTURE_OWNER_ID = 'qa-project-mutation-fixture';

export default function FixtureLocalFirstBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      await startLocalFirstRuntime(FIXTURE_OWNER_ID);
      await discardAllLocalFirstState();
      if (active) setReady(true);
    })();

    return () => {
      active = false;
      stopLocalFirstRuntime({ clearOwner: true });
    };
  }, []);

  if (!ready) return <p role="status">Preparing local save fixture...</p>;

  return (
    <>
      <LocalFirstPortalMutations />
      {children}
    </>
  );
}
