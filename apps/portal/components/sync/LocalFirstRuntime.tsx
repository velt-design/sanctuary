'use client';

import { useEffect } from 'react';
import { startLocalFirstRuntime, stopLocalFirstRuntime } from '@/lib/localFirst/runtime';
import {bindLocalFirstStoreOwner,clearLocalFirstStoreOwner,ensureLocalFirstStoreReady} from '@/lib/localFirst/store';

export type LocalFirstRuntimeMode = 'sync' | 'storage-only';

export default function LocalFirstRuntime({ ownerId,mode='sync' }: { ownerId: string;mode?:LocalFirstRuntimeMode }) {
  useEffect(() => {
    if(mode==='storage-only'){
      // A native Studio document owns its atomic commands. Retained ordinary
      // Portal mutations are storage evidence, never outbound work here.
      bindLocalFirstStoreOwner(ownerId);
      void ensureLocalFirstStoreReady().catch(()=>{/* The editor retains its own storage recovery surface. */});
      return()=>clearLocalFirstStoreOwner();
    }
    void startLocalFirstRuntime(ownerId);
    return () => stopLocalFirstRuntime({ clearOwner: true });
  }, [ownerId,mode]);

  return null;
}
