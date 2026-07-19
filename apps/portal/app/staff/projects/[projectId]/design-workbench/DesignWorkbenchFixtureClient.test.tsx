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

function clickObjectButton(container: HTMLElement, family: string, id: string) {
  const button = container.querySelector(`[data-workbench-object-button="${family}:${id}"]`);
  if (!(button instanceof HTMLElement)) throw new Error(`Missing object button: ${family}:${id}`);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function planHitTargetCount(container: HTMLElement): number {
  const canvas = container.querySelector('[data-plan-viewport="true"]');
  if (!(canvas instanceof HTMLElement)) return 0;
  return Number(canvas.dataset.planHitTargetCount ?? 0);
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

  it('renders a snapshot-only fixture as unsupported object-first workbench state', async () => {
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
    expect(rendered.container.textContent).toContain('Deck Build');
    expect(rendered.container.textContent).not.toContain('Rotate +90');

    await act(async () => {
      await vi.waitFor(() => {
        expect(rendered.container.textContent).toContain('3D Preview Error');
      });
    });
    expect(rendered.container.textContent).toContain('No object-first workbench geometry is available.');
    expect(rendered.container.textContent).toContain('No house forms');
    expect(rendered.container.textContent).toContain('No pergolas');
    expect(rendered.container.querySelector('[data-testid="geometry-3d-canvas"]')).toBeNull();

    clickButtonByText(rendered.container, 'Plan');
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain('Plan view unavailable: no solved geometry artifact.');
    expect(rendered.container.textContent).not.toContain('Rotate +90');

    rendered.unmount();
  });

  it('passes project-level plan props through the fixture route workbench path', async () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('multi-house-u-two-pergola');
    if (!fixture) throw new Error('Expected multi-house fixture');

    const rendered = renderIntoDocument(
      <DesignWorkbenchFixtureClient
        fixture={fixture}
        projectName="Fixture Project"
        siteAddress="1 Test Street"
        backHref="/staff/projects/proj_1"
      />,
    );

    clickButtonByText(rendered.container, 'Plan');
    await act(async () => {
      await Promise.resolve();
    });

    const initialHitTargetCount = planHitTargetCount(rendered.container);
    expect(initialHitTargetCount).toBeGreaterThan(0);

    clickObjectButton(rendered.container, 'pergolas', 'pergola-1');
    await act(async () => {
      await Promise.resolve();
    });
    const pergolaOneHitTargetCount = planHitTargetCount(rendered.container);
    expect(rendered.container.querySelector('[data-active-workbench-object="pergolas:pergola-1"]')).not.toBeNull();

    clickObjectButton(rendered.container, 'pergolas', 'pergola-2');
    await act(async () => {
      await Promise.resolve();
    });
    const pergolaTwoHitTargetCount = planHitTargetCount(rendered.container);

    expect(rendered.container.querySelector('[data-active-workbench-object="pergolas:pergola-2"]')).not.toBeNull();
    expect(pergolaTwoHitTargetCount).toBe(pergolaOneHitTargetCount);
    expect(pergolaTwoHitTargetCount).toBe(initialHitTargetCount);

    rendered.unmount();
  });
});
