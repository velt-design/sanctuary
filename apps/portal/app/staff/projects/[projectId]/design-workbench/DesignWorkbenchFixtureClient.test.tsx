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

function committedHouseShapeIds(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<SVGPolygonElement>(
      '[data-plan-layer="committedBodies"] [data-plan-shape-family="house"][data-plan-shape-id]',
    ),
  ).map((shape) => shape.getAttribute('data-plan-shape-id') ?? '');
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
    expect(rendered.container.textContent).toContain('Deck Build');
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

    const initialHouseShapes = committedHouseShapeIds(rendered.container).sort();
    expect(initialHouseShapes.some((id) => id.includes('house_roof_material:house-main'))).toBe(true);
    expect(initialHouseShapes.some((id) => id.includes('house_roof_material:house-form-2'))).toBe(true);

    clickObjectButton(rendered.container, 'pergolas', 'pergola-1');
    await act(async () => {
      await Promise.resolve();
    });
    const pergolaOneHouseShapes = committedHouseShapeIds(rendered.container).sort();
    expect(rendered.container.querySelector('[data-active-workbench-object="pergolas:pergola-1"]')).not.toBeNull();

    clickObjectButton(rendered.container, 'pergolas', 'pergola-2');
    await act(async () => {
      await Promise.resolve();
    });
    const pergolaTwoHouseShapes = committedHouseShapeIds(rendered.container).sort();

    expect(rendered.container.querySelector('[data-active-workbench-object="pergolas:pergola-2"]')).not.toBeNull();
    expect(pergolaTwoHouseShapes).toEqual(pergolaOneHouseShapes);
    expect(pergolaTwoHouseShapes).toEqual(initialHouseShapes);

    rendered.unmount();
  });
});
