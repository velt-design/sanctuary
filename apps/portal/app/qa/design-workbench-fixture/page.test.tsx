import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DesignWorkbenchFixturePage from './page';

const getProjectPageSnapshotMock = vi.fn();
const notFoundMock = vi.fn();
const originalEnableFixtureFlag = process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES;

vi.mock('@/lib/projects/getProjectPageSnapshot', () => ({
  getProjectPageSnapshot: (...args: unknown[]) => getProjectPageSnapshotMock(...args),
}));

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

vi.mock('@/components/drawings/viewports/Geometry3DViewport', () => ({
  default: () => <div data-testid="geometry-3d-viewport" />,
}));

describe('DesignWorkbenchFixturePage', () => {
  beforeEach(() => {
    getProjectPageSnapshotMock.mockReset();
    notFoundMock.mockReset();
    delete process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES;
    notFoundMock.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
  });

  afterEach(() => {
    if (originalEnableFixtureFlag === undefined) {
      delete process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES;
    } else {
      process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES = originalEnableFixtureFlag;
    }
  });

  it('calls notFound when the fixture flag is disabled', async () => {
    await expect(
      DesignWorkbenchFixturePage({
        searchParams: Promise.resolve({ fixture: 'mono-standard' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getProjectPageSnapshotMock).not.toHaveBeenCalled();
  });

  it('renders the fixture workbench shell without loading a project snapshot', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES = '1';

    const ui = (await DesignWorkbenchFixturePage({
      searchParams: Promise.resolve({ fixture: 'mono-standard' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Sanctuary Fixture Project');
    expect(markup).toContain('Drawing workbench');
    expect(markup).toContain('Sheet Output');
    expect(markup).toContain('Back to Project');
    expect(markup).toContain('data-project-id="fixture-roof"');
    expect(markup).toContain('data-workbench-context="fixture_ready"');
    expect(markup).toContain('data-workbench-fixture="mono-standard"');
    expect(markup).not.toContain('data-workbench-pricing-source');
    expect(markup).not.toContain('data-workbench-pricing-readiness');
    expect(getProjectPageSnapshotMock).not.toHaveBeenCalled();
  });

  it('renders an invalid-fixture state for unknown fixture slugs', async () => {
    process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES = '1';

    const ui = (await DesignWorkbenchFixturePage({
      searchParams: Promise.resolve({ fixture: 'not-real' }),
    })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(markup).toContain('Route state: Invalid Fixture');
    expect(markup).toContain('Unknown fixture slug: not-real');
    expect(markup).toContain('data-workbench-context="invalid_fixture"');
    expect(markup).not.toContain('Drawing workbench');
    expect(markup).not.toContain('data-workbench-pricing-source');
    expect(markup).not.toContain('data-workbench-pricing-readiness');
    expect(getProjectPageSnapshotMock).not.toHaveBeenCalled();
  });
});
