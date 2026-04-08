import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildWorkbenchGeometryPreview } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import Geometry3DViewport from './Geometry3DViewport';
import { renderIntoDocument } from '../../../../../test/reactHarness';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: unknown }) => <div data-testid="geometry-3d-canvas">{children as any}</div>,
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
}));

function requireFixture(slug: 'mono-standard' | 'gable-standard' | 'box-standard') {
  const fixture = getSanctuaryGeometryWorkbenchFixture(slug);
  if (!fixture) {
    throw new Error(`Missing fixture ${slug}`);
  }
  return fixture;
}

function clickButtonByText(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes(label));
  if (!button) throw new Error(`Missing button: ${label}`);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function toggleCheckboxByText(container: HTMLElement, label: string, checked: boolean) {
  const labelNode = Array.from(container.querySelectorAll('label')).find((node) => node.textContent?.includes(label));
  const input = labelNode?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
  if (!input) throw new Error(`Missing checkbox: ${label}`);
  if (input.checked === checked) return;
  act(() => {
    input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function clickSceneObject(container: HTMLElement, id: string) {
  const node = container.querySelector(`[data-testid="scene-object-${id}"]`);
  if (!node) throw new Error(`Missing scene object: ${id}`);
  act(() => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function setRangeValue(container: HTMLElement, label: string, value: string) {
  const input = container.querySelector(`[aria-label="${label}"]`) as HTMLInputElement | null;
  if (!input) throw new Error(`Missing range input: ${label}`);
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!valueSetter) {
    throw new Error('Missing input value setter');
  }
  act(() => {
    valueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('Geometry3DViewport', () => {
  it('renders inspection controls, section cut, overlays, and inspector updates for the 3D scene', () => {
    const fixture = requireFixture('mono-standard');
    const geometryPreview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      moduleIndex: 0,
    });
    if (geometryPreview.kind !== 'ready') {
      throw new Error('Expected ready geometry preview');
    }

    const rendered = renderIntoDocument(<Geometry3DViewport geometryPreview={geometryPreview} />);

    expect(rendered.container.textContent).toContain('3D Verification');
    expect(rendered.container.textContent).toContain('Snapshot Validated');
    expect(rendered.container.textContent).toContain('Inspection');
    expect(rendered.container.textContent).toContain('Section cut');
    expect(rendered.container.textContent).toContain('Datum axes');
    expect(rendered.container.textContent).toContain('Roof fall vectors');
    expect(rendered.container.textContent).toContain('Selected member axes');
    expect(rendered.container.querySelector('[data-testid="geometry-3d-canvas"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="scene-object-outer-gutter"]')).not.toBeNull();

    toggleCheckboxByText(rendered.container, 'Section cut', true);
    expect(rendered.container.querySelector('[data-testid="section-cut-plane"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Active at X = 3000 mm');

    setRangeValue(rendered.container, 'Section position (mm)', '1800');
    expect(rendered.container.textContent).toContain('Cut X: 1800 mm');
    expect(rendered.container.textContent).toContain('Active at X = 1800 mm');

    clickButtonByText(rendered.container, 'Center');
    expect(rendered.container.textContent).toContain('Cut X: 3000 mm');

    toggleCheckboxByText(rendered.container, 'Datum axes', true);
    expect(rendered.container.querySelector('[data-testid="datum-axis-x"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="datum-axis-y"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="datum-axis-z"]')).not.toBeNull();

    toggleCheckboxByText(rendered.container, 'Roof fall vectors', true);
    expect(rendered.container.querySelector('[data-testid="roof-fall-vector-mono-roof"]')).not.toBeNull();

    clickSceneObject(rendered.container, 'outer-gutter');

    expect(rendered.container.textContent).toContain('outer-gutter');
    expect(rendered.container.textContent).toContain('Profile');
    expect(rendered.container.textContent).toContain('Local X Axis');

    toggleCheckboxByText(rendered.container, 'Selected member axes', true);
    expect(rendered.container.querySelector('[data-testid="selected-member-axis-x"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="selected-member-axis-y"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="selected-member-axis-z"]')).not.toBeNull();

    clickSceneObject(rendered.container, 'mono-roof');
    expect(rendered.container.textContent).toContain('Plane normal');
    expect(rendered.container.querySelector('[data-testid="selected-member-axis-x"]')).toBeNull();

    toggleCheckboxByText(rendered.container, 'Gutters', false);
    expect(rendered.container.querySelector('[data-testid="scene-object-outer-gutter"]')).toBeNull();

    clickButtonByText(rendered.container, 'Fit to scene');
    expect(rendered.container.querySelector('[data-testid="geometry-3d-canvas"]')).not.toBeNull();

    rendered.unmount();
  });

  it('renders an unsupported diagnostic panel instead of a blank canvas', () => {
    const fixture = requireFixture('mono-standard');
    const snapshot = structuredClone(fixture.snapshot) as {
      inputs?: { modules?: Array<Record<string, unknown>> };
      outputs?: { pergolas?: Array<{ modules?: Array<Record<string, unknown>> }> };
    };
    if (!snapshot.inputs?.modules?.[0] || !snapshot.outputs?.pergolas?.[0]?.modules?.[0]) {
      throw new Error('Expected fixture snapshot modules.');
    }
    snapshot.inputs.modules[0].pergolaStyle = 'hip';
    snapshot.outputs.pergolas[0].modules[0].derived = {
      ...(snapshot.outputs.pergolas[0].modules[0].derived ?? {}),
      length_m: null,
      projection_m: null,
    };

    const geometryPreview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      snapshot,
      moduleIndex: 0,
    });

    const rendered = renderIntoDocument(<Geometry3DViewport geometryPreview={geometryPreview} />);

    expect(rendered.container.textContent).toContain('3D Preview Unsupported');
    expect(rendered.container.textContent).toContain('not supported by Sanctuary geometry V1');
    expect(rendered.container.textContent).not.toContain('Inspection');
    expect(rendered.container.querySelector('[data-testid="geometry-3d-canvas"]')).toBeNull();

    rendered.unmount();
  });
});
