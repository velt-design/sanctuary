import type { ComponentType } from 'react';
import type { PortalExactRouteFrameProps } from '@/components/page-state/PortalExactRouteFrame';

export type PortalExactRouteFrameComponent = ComponentType<PortalExactRouteFrameProps>;

type PortalExactRouteFrameModule = {
  default: PortalExactRouteFrameComponent;
};

type PortalExactRouteFrameImporter = () => Promise<PortalExactRouteFrameModule>;

let exactRouteFrame: PortalExactRouteFrameComponent | null = null;
const exactRouteFrameListeners = new Set<() => void>();

export function getPreloadedPortalExactRouteFrame(): PortalExactRouteFrameComponent | null {
  return exactRouteFrame;
}

export function getPortalExactRouteFrameServerSnapshot(): null {
  return null;
}

export function subscribeToPreloadedPortalExactRouteFrame(listener: () => void): () => void {
  exactRouteFrameListeners.add(listener);
  return () => exactRouteFrameListeners.delete(listener);
}

function cachePortalExactRouteFrameModule(
  loadedModule: PortalExactRouteFrameModule,
): void {
  if (typeof loadedModule.default !== 'function') {
    throw new TypeError('PortalExactRouteFrame must have a React component as its default export.');
  }
  if (exactRouteFrame === loadedModule.default) return;

  exactRouteFrame = loadedModule.default;
  exactRouteFrameListeners.forEach((listener) => listener());
}

export function createPortalExactRouteFrameModuleLoader(
  importModule: PortalExactRouteFrameImporter,
): PortalExactRouteFrameImporter {
  return async () => {
    const loadedModule = await importModule();
    cachePortalExactRouteFrameModule(loadedModule);
    return loadedModule;
  };
}

export const loadPortalExactRouteFrameModule = createPortalExactRouteFrameModuleLoader(
  () => import('@/components/page-state/PortalExactRouteFrame'),
);

export function resetPortalCoreShellModuleCacheForTests(): void {
  if (exactRouteFrame === null) return;
  exactRouteFrame = null;
  exactRouteFrameListeners.forEach((listener) => listener());
}
