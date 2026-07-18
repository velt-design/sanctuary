'use client';

import { useEffect } from 'react';
import { startLocalFirstRuntime, stopLocalFirstRuntime } from '@/lib/localFirst/runtime';

export default function LocalFirstRuntime({ ownerId }: { ownerId: string }) {
  useEffect(() => {
    void startLocalFirstRuntime(ownerId);
    return () => stopLocalFirstRuntime({ clearOwner: true });
  }, [ownerId]);

  return null;
}
