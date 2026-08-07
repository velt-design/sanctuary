'use client';

import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';
import {
  getPortalExactRouteFrameServerSnapshot,
  getPreloadedPortalExactRouteFrame,
  loadPortalExactRouteFrameModule,
  subscribeToPreloadedPortalExactRouteFrame,
} from '@/lib/offline/portalCoreShellModuleCache';
import PortalRoutePendingFrame from './PortalRoutePendingFrame';
import type { PortalExactRouteFrameProps } from './PortalExactRouteFrame';
import styles from './PortalInstantRouteFrame.module.css';

const DynamicPortalExactRouteFrame = dynamic(loadPortalExactRouteFrameModule, {
  loading: () => null,
});

export default function PortalInstantRouteFrame(props: PortalExactRouteFrameProps) {
  const PreloadedPortalExactRouteFrame = useSyncExternalStore(
    subscribeToPreloadedPortalExactRouteFrame,
    getPreloadedPortalExactRouteFrame,
    getPortalExactRouteFrameServerSnapshot,
  );

  if (PreloadedPortalExactRouteFrame) {
    return (
      <div className={styles.host} data-portal-exact-frame-host={props.route}>
        <PreloadedPortalExactRouteFrame {...props} />
      </div>
    );
  }

  return (
    <div className={styles.host} data-portal-exact-frame-host={props.route}>
      <div className={styles.fallback}>
        <PortalRoutePendingFrame route={props.route} label={props.label} />
      </div>
      <DynamicPortalExactRouteFrame {...props} />
    </div>
  );
}
