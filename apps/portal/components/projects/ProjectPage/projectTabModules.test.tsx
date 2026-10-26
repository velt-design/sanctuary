import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { preloadNestedProjectTab } from './projectTabModules';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectTabBody from './ProjectTabBody';
import ProjectOverviewSurface, { useOverviewControls } from './tabs/ProjectOverviewSurface';

const { dynamicMock } = vi.hoisted(() => ({
  dynamicMock: vi.fn((
    _loader: unknown,
    _options?: { loading?: () => ReactElement<Record<string, unknown>> | null },
  ) => function HeldModule() { return _options?.loading?.() ?? null; }),
}));

vi.mock('next/dynamic', () => ({
  default: dynamicMock,
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

function ManagedOverview() {
  const controls = useOverviewControls('fixture');
  return <>
    <ProjectOverviewSurface evidence={null} controls={controls} onFiles={() => {}} />
    <ProjectTabBody snapshot={null} projectId="fixture" host="fictional" tab="activity" overview={{ controls, publish: () => {} }} />
  </>;
}

describe('project tab module preload', () => {
  it('keeps the actual managed Overview without a second loading page while preserving standalone feedback', () => {
    const managed = renderIntoDocument(<ManagedOverview />);
    expect(managed.container.querySelector('[data-project-overview="true"]')).not.toBeNull();
    expect(managed.container.querySelector('[data-project-tab-loading="activity"]')).toBeNull();
    managed.unmount();

    const standalone = renderIntoDocument(<ProjectTabBody snapshot={null} projectId="fixture" host="fictional" tab="activity" />);
    expect(standalone.container.querySelector('[data-project-tab-loading="activity"]')?.textContent).toContain('Loading overview in the background');
    standalone.unmount();
  });
  it('labels the shared lazy shell as Commercial rather than a nested route', () => {
    const labels = dynamicMock.mock.calls.map(call => call[1]?.loading?.()?.props['data-project-tab-loading']).filter(label => label !== undefined);
    expect(labels).toEqual(['activity', 'files', 'commercial', 'job-packs']);
  });

  it('preloads the nested Estimates module for Commercial intent', async () => {
    const preloadCommercialView = vi.fn().mockResolvedValue(undefined);

    await preloadNestedProjectTab('estimates', preloadCommercialView);

    expect(preloadCommercialView).toHaveBeenCalledWith('estimates');
  });

  it('does not request a Commercial subview for another project tab', async () => {
    const preloadCommercialView = vi.fn().mockResolvedValue(undefined);

    await preloadNestedProjectTab('activity', preloadCommercialView);

    expect(preloadCommercialView).not.toHaveBeenCalled();
  });
  it('prepares the real Estimates list module without requesting calculator editor code', async () => {
    const before = dynamicMock.mock.calls.length;
    await preloadNestedProjectTab('estimates');
    const nested = dynamicMock.mock.calls.slice(before);
    expect(nested).toHaveLength(2); // Quotes and Invoices retain their own lazy bodies.
    expect(nested.map(call => String(call[0])).join(' ')).not.toContain('CalculatorGridClient');
  });

});
