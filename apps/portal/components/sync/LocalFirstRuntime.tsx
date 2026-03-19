'use client';

import { useEffect } from 'react';
import { startLocalFirstRuntime } from '@/lib/localFirst/runtime';

export default function LocalFirstRuntime() {
  useEffect(() => {
    void startLocalFirstRuntime();
  }, []);

  return null;
}
