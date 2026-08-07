import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import {
  createPortalExactRouteFrameModuleLoader,
  getPreloadedPortalExactRouteFrame,
  resetPortalCoreShellModuleCacheForTests,
  type PortalExactRouteFrameComponent,
} from '@/lib/offline/portalCoreShellModuleCache';
import { createPortalCoreShellPreloader } from '@/lib/offline/portalCoreShellPreload';
import PortalInstantRouteFrame from './PortalInstantRouteFrame';

function ExactFrame() {
  return <main data-portal-page-shell="projects" data-portal-page-shell-ready="true" />;
}

describe('PortalInstantRouteFrame preload handoff', () => {
  beforeEach(() => {
    resetPortalCoreShellModuleCacheForTests();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    resetPortalCoreShellModuleCacheForTests();
  });

  it('retains the generic route frame until the exact-frame preload has completed', () => {
    const rendered = renderIntoDocument(<PortalInstantRouteFrame route="projects-index" />);

    expect(rendered.container.querySelector('[data-portal-instant-shell="projects-index"]'))
      .not.toBeNull();
    rendered.unmount();
  });

  it('renders the exact frame synchronously without a generic-frame flash after preload', async () => {
    const loadModule = createPortalExactRouteFrameModuleLoader(async () => ({
      default: ExactFrame as PortalExactRouteFrameComponent,
    }));
    const preload = createPortalCoreShellPreloader({
      'all-route-frames': loadModule,
    });

    await expect(preload()).resolves.toEqual({
      loaded: ['all-route-frames'],
      failed: [],
    });

    const rendered = renderIntoDocument(<PortalInstantRouteFrame route="projects-index" />);

    expect(rendered.container.querySelector('[data-portal-page-shell="projects"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-portal-instant-shell]')).toBeNull();
    rendered.unmount();
  });

  it('does not publish failed imports and succeeds on the next preload attempt', async () => {
    let attempts = 0;
    const importer = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('chunk unavailable');
      return { default: ExactFrame as PortalExactRouteFrameComponent };
    });
    const preload = createPortalCoreShellPreloader({
      'all-route-frames': createPortalExactRouteFrameModuleLoader(importer),
    });

    await expect(preload()).resolves.toEqual({
      loaded: [],
      failed: ['all-route-frames'],
    });
    expect(getPreloadedPortalExactRouteFrame()).toBeNull();

    await act(async () => {
      await expect(preload()).resolves.toEqual({
        loaded: ['all-route-frames'],
        failed: [],
      });
    });
    expect(importer).toHaveBeenCalledTimes(2);
    expect(getPreloadedPortalExactRouteFrame()).toBe(ExactFrame);
  });
});
