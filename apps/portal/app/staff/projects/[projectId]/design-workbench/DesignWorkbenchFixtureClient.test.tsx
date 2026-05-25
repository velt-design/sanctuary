import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DesignWorkbenchFixtureClient from './DesignWorkbenchFixtureClient';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { installDomGeometryMock, renderIntoDocument } from '../../../../../../../test/reactHarness';

vi.mock('@react-three/fiber', () => ({
  Canvas: () => <div data-testid="geometry-3d-canvas" />,
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
}));

function clickButtonByText(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes(label));
  if (!button) throw new Error(`Missing button: ${label}`);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('DesignWorkbenchFixtureClient', () => {
  let restoreGeometry: (() => void) | null = null;

  beforeEach(() => {
    restoreGeometry = installDomGeometryMock();
  });

  afterEach(() => {
    restoreGeometry?.();
    restoreGeometry = null;
    document.body.innerHTML = '';
  });

  it('renders the read-only workbench shell from fixture data and supports local view toggles', async () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Expected mono fixture');

    const rendered = renderIntoDocument(
      <DesignWorkbenchFixtureClient
        fixture={fixture}
        projectName="Deck Build"
        siteAddress="1 Test Street"
        backHref="/staff/projects/proj_1"
      />,
    );

    expect(rendered.container.textContent).toContain('Sheet Output');
    expect(rendered.container.textContent).toContain('Plan Editor');
    expect(rendered.container.textContent).toContain('3D Review');
    expect(rendered.container.textContent).toContain('Back to Project');
    expect(rendered.container.textContent).not.toContain('Model Space');
    expect(rendered.container.textContent).not.toContain('3D View');
    expect(rendered.container.textContent).toContain('Fixture Preview');
    expect(rendered.container.textContent).not.toContain('Rotate +90');

    expect(rendered.container.textContent).toContain('Workspace panel');
    expect(rendered.container.textContent).not.toContain('Inspection');
    expect(rendered.container.querySelector('[data-testid="geometry-3d-canvas"]')).not.toBeNull();
    clickButtonByText(rendered.container, 'Workspace panel');
    expect(rendered.container.textContent).toContain('Snapshot Validated');
    expect(rendered.container.textContent).toContain('Inspection');
    expect(rendered.container.textContent).toContain('Section cut');
    expect(rendered.container.textContent).toContain('Datum axes');
    expect(rendered.container.textContent).toContain('Measurement');
    expect(rendered.container.textContent).toContain('Enable measurement');

    clickButtonByText(rendered.container, 'Plan');
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-plan-viewport="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Plan editor"]')).not.toBeNull();
    expect(rendered.container.textContent).not.toContain('Rotate +90');

    rendered.unmount();
  });
});
