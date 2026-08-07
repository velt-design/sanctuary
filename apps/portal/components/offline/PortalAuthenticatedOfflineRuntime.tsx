'use client';

import { Fragment } from 'react';
import PortalStaticCacheRuntime from './PortalStaticCacheRuntime';
import { PORTAL_POST_AUTH_SHELL_BUNDLE_MARKER } from '@/lib/performance/portalPostAuthShellBundle';

export type PortalAuthenticatedOfflineRuntimeProps = {
  version: string;
  enabled: boolean;
};

/**
 * Authenticated, code-only warming is intentionally outside route entry
 * bundles. The keyed fragment keeps the bundle marker in emitted code without
 * adding a wrapper element to the portal DOM.
 */
export default function PortalAuthenticatedOfflineRuntime({
  version,
  enabled,
}: PortalAuthenticatedOfflineRuntimeProps) {
  return (
    <Fragment key={PORTAL_POST_AUTH_SHELL_BUNDLE_MARKER}>
      <PortalStaticCacheRuntime version={version} enabled={enabled} />
    </Fragment>
  );
}
