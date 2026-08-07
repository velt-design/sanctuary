'use client';

import { useEffect } from 'react';
import {
  PORTAL_CORE_SHELL_KEYS,
  preloadPortalCoreShellCode,
  type PortalCoreShellKey,
  type PortalCoreShellPreloadResult,
} from '@/lib/offline/portalCoreShellPreload';

type PortalCoreShellPreloaderProps = {
  enabled?: boolean;
  keys?: readonly PortalCoreShellKey[];
  onComplete?: (result: PortalCoreShellPreloadResult) => void;
};

// Mount this only inside the authenticated portal boundary. It preloads code, never data or RSC.
export default function PortalCoreShellPreloader({
  enabled = true,
  keys = PORTAL_CORE_SHELL_KEYS,
  onComplete,
}: PortalCoreShellPreloaderProps) {
  useEffect(() => {
    if (!enabled) return;
    let active = true;

    void (async () => {
      const result = await preloadPortalCoreShellCode(keys);
      if (active) onComplete?.(result);
    })();

    return () => {
      active = false;
    };
  }, [enabled, keys, onComplete]);

  return null;
}
