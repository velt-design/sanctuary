import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';

const preloadMock = vi.fn();

vi.mock('@/lib/offline/portalCoreShellPreload', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/offline/portalCoreShellPreload')>();
  return {
    ...original,
    preloadPortalCoreShellCode: (...args: unknown[]) => preloadMock(...args),
  };
});

import PortalCoreShellPreloader from './PortalCoreShellPreloader';

describe('PortalCoreShellPreloader', () => {
  beforeEach(() => {
    preloadMock.mockReset();
    preloadMock.mockResolvedValue({ loaded: ['all-route-frames'], failed: [] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('starts importing shell code immediately without waiting for service-worker readiness', async () => {
    const onComplete = vi.fn();
    const rendered = renderIntoDocument(
      <PortalCoreShellPreloader
        keys={['all-route-frames']}
        onComplete={onComplete}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(preloadMock).toHaveBeenCalledWith(['all-route-frames']);
    expect(onComplete).toHaveBeenCalledWith({ loaded: ['all-route-frames'], failed: [] });
    rendered.unmount();
  });

  it('does nothing when disabled', async () => {
    const rendered = renderIntoDocument(
      <PortalCoreShellPreloader enabled={false} />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(preloadMock).not.toHaveBeenCalled();
    rendered.unmount();
  });
});
