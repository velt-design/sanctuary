import { act, forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { Point3, ViewerSceneModel, ViewerSceneObject } from '@sp/geometry';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildWorkbenchGeometryPreview } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import Geometry3DViewport from './Geometry3DViewport';
import { renderIntoDocument } from '../../../../../test/reactHarness';

let mockThreeCamera: THREE.PerspectiveCamera | null = null;
let mockOrbitControls: { target: { x: number; y: number; z: number } } | null = null;

vi.mock('@react-three/fiber', () => ({
  Canvas: ({
    children,
    onCreated,
  }: {
    children?: unknown;
    onCreated?: (payload: { camera: THREE.PerspectiveCamera; gl: { localClippingEnabled: boolean } }) => void;
  }) => {
    const camera = useMemo(() => new THREE.PerspectiveCamera(40, 1, 1, 40000), []);
    const gl = useMemo(() => ({ localClippingEnabled: false }), []);

    useEffect(() => {
      mockThreeCamera = camera;
      onCreated?.({ camera, gl });
    }, [camera, gl, onCreated]);

    return (
      <div
        data-testid="geometry-3d-canvas"
        data-camera-position={`${camera.position.x},${camera.position.y},${camera.position.z}`}
      >
        {children as any}
      </div>
    );
  },
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: forwardRef(function MockOrbitControls(
    props: {
      target?: [number, number, number];
      minDistance?: number;
      maxDistance?: number;
      minPolarAngle?: number;
      maxPolarAngle?: number;
      enableDamping?: boolean;
      zoomToCursor?: boolean;
      screenSpacePanning?: boolean;
      rotateSpeed?: number;
      panSpeed?: number;
      zoomSpeed?: number;
      onEnd?: () => void;
    },
    ref,
  ) {
    const target = useMemo(
      () => ({
        x: props.target?.[0] ?? 0,
        y: props.target?.[1] ?? 0,
        z: props.target?.[2] ?? 0,
        set(nextX: number, nextY: number, nextZ: number) {
          this.x = nextX;
          this.y = nextY;
          this.z = nextZ;
        },
      }),
      [],
    );

    useEffect(() => {
      target.set(props.target?.[0] ?? 0, props.target?.[1] ?? 0, props.target?.[2] ?? 0);
    }, [props.target, target]);

    const controls = useMemo(
      () => ({
        target,
        update: vi.fn(),
        saveState: vi.fn(),
        minDistance: 0,
        maxDistance: 0,
        minPolarAngle: 0,
        maxPolarAngle: 0,
        enableDamping: false,
        zoomToCursor: false,
        screenSpacePanning: false,
        rotateSpeed: 1,
        panSpeed: 1,
        zoomSpeed: 1,
      }),
      [target],
    );

    controls.minDistance = props.minDistance ?? 0;
    controls.maxDistance = props.maxDistance ?? 0;
    controls.minPolarAngle = props.minPolarAngle ?? 0;
    controls.maxPolarAngle = props.maxPolarAngle ?? 0;
    controls.enableDamping = props.enableDamping ?? false;
    controls.zoomToCursor = props.zoomToCursor ?? false;
    controls.screenSpacePanning = props.screenSpacePanning ?? false;
    controls.rotateSpeed = props.rotateSpeed ?? 1;
    controls.panSpeed = props.panSpeed ?? 1;
    controls.zoomSpeed = props.zoomSpeed ?? 1;
    mockOrbitControls = controls;

    useImperativeHandle(
      ref,
      () => controls,
      [controls],
    );

    return (
      <div
        data-testid="orbit-controls"
        data-target={`${target.x},${target.y},${target.z}`}
        data-min-distance={String(props.minDistance ?? '')}
        data-max-distance={String(props.maxDistance ?? '')}
      >
        <button
          type="button"
          data-testid="mock-orbit-end-custom"
          onClick={() => {
            if (mockThreeCamera) {
              mockThreeCamera.position.set(target.x + 1800, target.y - 1100, target.z + 950);
            }
            props.onEnd?.();
          }}
        >
          orbit-custom
        </button>
        <button
          type="button"
          data-testid="mock-orbit-end-manual"
          onClick={() => {
            target.set(target.x + 420, target.y + 280, target.z);
            if (mockThreeCamera) {
              mockThreeCamera.position.set(target.x + 1800, target.y - 1100, target.z + 950);
            }
            props.onEnd?.();
          }}
        >
          orbit-manual
        </button>
      </div>
    );
  }),
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

function clickByTestId(container: HTMLElement, testId: string) {
  const node = container.querySelector(`[data-testid="${testId}"]`);
  if (!node) throw new Error(`Missing node: ${testId}`);
  act(() => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function pointListsForObject(object: ViewerSceneObject): Point3[] {
  if (object.type === 'member_prism') return [object.centerline.start, object.centerline.end];
  if (object.type === 'roof_plane') return object.boundary;
  if (object.type === 'reference_line') return [object.line.start, object.line.end];
  return object.boundary;
}

function computeSceneCenter(scene: ViewerSceneModel): Point3 {
  const points = scene.layers.flatMap((layer) => layer.objects.flatMap((object) => pointListsForObject(object)));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const zs = points.map((point) => point.z);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
    z: (Math.min(...zs) + Math.max(...zs)) / 2,
  };
}

function centroid(points: Point3[]): Point3 {
  const total = points.reduce(
    (current, point) => ({
      x: current.x + point.x,
      y: current.y + point.y,
      z: current.z + point.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
  };
}

function focusPointForObject(object: ViewerSceneObject): Point3 {
  if (object.type === 'member_prism') {
    return {
      x: (object.centerline.start.x + object.centerline.end.x) / 2,
      y: (object.centerline.start.y + object.centerline.end.y) / 2,
      z: (object.centerline.start.z + object.centerline.end.z) / 2,
    };
  }
  if (object.type === 'reference_line') {
    return {
      x: (object.line.start.x + object.line.end.x) / 2,
      y: (object.line.start.y + object.line.end.y) / 2,
      z: (object.line.start.z + object.line.end.z) / 2,
    };
  }
  return centroid(pointListsForObject(object));
}

function formatPoint(point: Point3): string {
  return `${Math.round(point.x)}, ${Math.round(point.y)}, ${Math.round(point.z)} mm`;
}

function measurementBetween(a: Point3, b: Point3) {
  const delta = {
    x: b.x - a.x,
    y: b.y - a.y,
    z: b.z - a.z,
  };
  return {
    delta,
    distance3d: Math.round(Math.sqrt(delta.x * delta.x + delta.y * delta.y + delta.z * delta.z)),
    distancePlan: Math.round(Math.sqrt(delta.x * delta.x + delta.y * delta.y)),
  };
}

function cameraPosition(container: HTMLElement): Point3 {
  void container;
  if (!mockThreeCamera) throw new Error('Missing mock camera');
  return {
    x: mockThreeCamera.position.x,
    y: mockThreeCamera.position.y,
    z: mockThreeCamera.position.z,
  };
}

function controlsTarget(container: HTMLElement): Point3 {
  void container;
  if (!mockOrbitControls) throw new Error('Missing mock orbit controls');
  return {
    x: mockOrbitControls.target.x,
    y: mockOrbitControls.target.y,
    z: mockOrbitControls.target.z,
  };
}

function normalizedDirection(from: Point3, to: Point3): Point3 {
  const vector = new THREE.Vector3(from.x - to.x, from.y - to.y, from.z - to.z).normalize();
  return { x: vector.x, y: vector.y, z: vector.z };
}

function expectDirectionsClose(actual: Point3, expected: Point3) {
  expect(actual.x).toBeCloseTo(expected.x, 5);
  expect(actual.y).toBeCloseTo(expected.y, 5);
  expect(actual.z).toBeCloseTo(expected.z, 5);
}

describe('Geometry3DViewport', () => {
  it('renders inspection controls, camera actions, and inspector updates for the 3D scene', async () => {
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
    const sceneCenter = computeSceneCenter(geometryPreview.scene);

    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain('3D Verification');
    expect(rendered.container.textContent).toContain('Snapshot Validated');
    expect(rendered.container.textContent).toContain('Inspection');
    expect(rendered.container.textContent).toContain('Section cut');
    expect(rendered.container.textContent).toContain('Datum axes');
    expect(rendered.container.textContent).toContain('Roof fall vectors');
    expect(rendered.container.textContent).toContain('Selected member axes');
    expect(rendered.container.textContent).toContain('Measurement');
    expect(rendered.container.textContent).toContain('Enable measurement');
    expect(rendered.container.textContent).toContain('Focus');
    expect(rendered.container.textContent).toContain('Scene');
    expect(rendered.container.textContent).toContain('View');
    expect(rendered.container.textContent).toContain('Iso');
    expect(rendered.container.querySelector('[data-testid="geometry-3d-canvas"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="scene-object-outer-gutter"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="scene-object-acrylic-panel-1"]')).not.toBeNull();

    clickButtonByText(rendered.container, 'Front');
    expect(rendered.container.textContent).toContain('Front');

    clickButtonByText(rendered.container, 'Right');
    expect(rendered.container.textContent).toContain('Right');

    clickButtonByText(rendered.container, 'Top');
    expect(rendered.container.textContent).toContain('Top');

    clickButtonByText(rendered.container, 'Iso');
    expect(rendered.container.textContent).toContain('Iso');

    clickButtonByText(rendered.container, 'Top');
    expect(rendered.container.textContent).toContain('Top');
    clickByTestId(rendered.container, 'mock-orbit-end-custom');
    expect(rendered.container.textContent).toContain('Custom');
    expect(rendered.container.textContent).toContain('Scene');

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

    toggleCheckboxByText(rendered.container, 'Enable measurement', true);
    expect(rendered.container.textContent).toContain('A source');
    expect(rendered.container.textContent).toContain('B source');

    clickSceneObject(rendered.container, 'outer-gutter');
    const outerGutter = geometryPreview.scene.layers.flatMap((layer) => layer.objects).find((object) => object.id === 'outer-gutter');
    if (!outerGutter) {
      throw new Error('Expected outer gutter scene object');
    }
    if (outerGutter.type !== 'member_prism') {
      throw new Error('Expected outer gutter member prism');
    }
    const gutterFocus = focusPointForObject(outerGutter);
    expect(rendered.container.querySelector('[data-testid="measurement-anchor-a"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="measurement-probe-line"]')).toBeNull();
    expect(rendered.container.textContent).toContain('outer-gutter');
    expect(rendered.container.textContent).toContain('midpoint');

    clickButtonByText(rendered.container, 'Start');
    expect(rendered.container.textContent).toContain(formatPoint(outerGutter.centerline.start));
    expect(rendered.container.textContent).toContain('start');

    clickButtonByText(rendered.container, 'Use datum origin');
    const gutterToDatumMeasurement = measurementBetween(outerGutter.centerline.start, geometryPreview.assembly.datum.origin);
    expect(rendered.container.querySelector('[data-testid="measurement-probe-line"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('datum-origin');
    expect(rendered.container.textContent).toContain(`${Math.round(gutterToDatumMeasurement.delta.x)} mm`);
    expect(rendered.container.textContent).toContain(`${Math.round(gutterToDatumMeasurement.delta.y)} mm`);
    expect(rendered.container.textContent).toContain(`${Math.round(gutterToDatumMeasurement.delta.z)} mm`);
    expect(rendered.container.textContent).toContain(`${gutterToDatumMeasurement.distance3d} mm`);
    expect(rendered.container.textContent).toContain(`${gutterToDatumMeasurement.distancePlan} mm`);

    clickButtonByText(rendered.container, 'Clear probe');
    expect(rendered.container.querySelector('[data-testid="measurement-anchor-a"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="measurement-probe-line"]')).toBeNull();

    clickSceneObject(rendered.container, 'outer-gutter');
    const beforeFocusDirection = normalizedDirection(cameraPosition(rendered.container), sceneCenter);
    clickButtonByText(rendered.container, 'Focus selection');
    expect(rendered.container.textContent).toContain('Selected');
    expect(rendered.container.textContent).toContain('Custom');
    expect(rendered.container.textContent).toContain(
      `${Math.round(gutterFocus.x)}, ${Math.round(gutterFocus.y)}, ${Math.round(gutterFocus.z)} mm`,
    );
    const afterFocusDirection = normalizedDirection(cameraPosition(rendered.container), gutterFocus);
    expectDirectionsClose(afterFocusDirection, beforeFocusDirection);

    expect(rendered.container.textContent).toContain('outer-gutter');
    expect(rendered.container.textContent).toContain('Profile');
    expect(rendered.container.textContent).toContain('Local X Axis');

    toggleCheckboxByText(rendered.container, 'Selected member axes', true);
    expect(rendered.container.querySelector('[data-testid="selected-member-axis-x"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="selected-member-axis-y"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="selected-member-axis-z"]')).not.toBeNull();

    clickSceneObject(rendered.container, 'acrylic-panel-1');
    const acrylicPanel = geometryPreview.scene.layers.flatMap((layer) => layer.objects).find((object) => object.id === 'acrylic-panel-1');
    if (!acrylicPanel) {
      throw new Error('Expected acrylic panel scene object');
    }
    const gutterToPanelMeasurement = measurementBetween(gutterFocus, focusPointForObject(acrylicPanel));
    expect(rendered.container.querySelector('[data-testid="measurement-anchor-b"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="measurement-probe-line"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('acrylic-panel-1');
    expect(rendered.container.textContent).toContain('Material');
    expect(rendered.container.textContent).toContain('acrylic');
    expect(rendered.container.textContent).toContain('Boundary');
    expect(rendered.container.textContent).toContain('4 points');
    expect(rendered.container.textContent).toContain('Panel area');
    expect(rendered.container.textContent).toContain(`${gutterToPanelMeasurement.distance3d} mm`);
    expect(rendered.container.textContent).toContain(`${gutterToPanelMeasurement.distancePlan} mm`);
    expect(rendered.container.querySelector('[data-testid="selected-member-axis-x"]')).toBeNull();

    toggleCheckboxByText(rendered.container, 'Roof Planes', true);
    clickSceneObject(rendered.container, 'mono-roof');
    clickButtonByText(rendered.container, 'Focus selection');
    const roofPlane = geometryPreview.scene.layers.flatMap((layer) => layer.objects).find((object) => object.id === 'mono-roof');
    if (!roofPlane) {
      throw new Error('Expected mono roof plane');
    }
    const roofFocus = focusPointForObject(roofPlane);
    expect(rendered.container.textContent).toContain(
      `${Math.round(roofFocus.x)}, ${Math.round(roofFocus.y)}, ${Math.round(roofFocus.z)} mm`,
    );
    expect(rendered.container.textContent).toContain('Plane normal');
    expect(rendered.container.querySelector('[data-testid="selected-member-axis-x"]')).toBeNull();

    clickByTestId(rendered.container, 'mock-orbit-end-manual');
    expect(rendered.container.textContent).toContain('Manual');
    expect(rendered.container.textContent).toContain('Custom');

    toggleCheckboxByText(rendered.container, 'Gutters', false);
    expect(rendered.container.querySelector('[data-testid="scene-object-outer-gutter"]')).toBeNull();

    const canvasNode = rendered.container.querySelector('[data-testid="geometry-3d-canvas"]');
    const beforeFitDirection = normalizedDirection(cameraPosition(rendered.container), controlsTarget(rendered.container));
    clickButtonByText(rendered.container, 'Fit to scene');
    expect(rendered.container.textContent).toContain('Scene');
    expect(rendered.container.textContent).toContain('Custom');
    expect(rendered.container.textContent).toContain(
      `${Math.round(sceneCenter.x)}, ${Math.round(sceneCenter.y)}, ${Math.round(sceneCenter.z)} mm`,
    );
    const afterFitDirection = normalizedDirection(cameraPosition(rendered.container), sceneCenter);
    expectDirectionsClose(afterFitDirection, beforeFitDirection);
    expect(rendered.container.querySelector('[data-testid="geometry-3d-canvas"]')).toBe(canvasNode);

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
    expect(rendered.container.textContent).not.toContain('Focus selection');
    expect(rendered.container.querySelector('[data-testid="geometry-3d-canvas"]')).toBeNull();

    rendered.unmount();
  });
});
