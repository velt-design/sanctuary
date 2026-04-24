import {
  act,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type {
  Point3,
  ViewerSceneHouseRoofMaterialObject,
  ViewerSceneModel,
  ViewerSceneObject,
} from "@sp/geometry";
import { getSanctuaryGeometryWorkbenchFixture } from "@/lib/drawings/sanctuaryWorkbenchFixtures";
import { buildWorkbenchGeometryPreview } from "@/lib/drawings/geometry/buildWorkbenchGeometryPreview";
import { buildEstimateDrawingDraftFromSnapshot } from "@/lib/estimates/drawingEdits";
import { applyGeometryEditIntent } from "@/lib/drawings/geometry/geometryEditAdapter";
import Geometry3DViewport, {
  buildClippedBoxGeometry,
  buildClippedProfileExtrusionGeometry,
  buildPolygonSlabGeometry,
  buildRenderMeshGeometry,
} from "./Geometry3DViewport";
import { renderIntoDocument } from "../../../../../test/reactHarness";

let mockThreeCamera: THREE.PerspectiveCamera | null = null;
let mockOrbitControls: { target: { x: number; y: number; z: number } } | null =
  null;
let mockRendererDispose: ReturnType<typeof vi.fn> | null = null;
let mockRendererResetState: ReturnType<typeof vi.fn> | null = null;
let mockRendererClearDepth: ReturnType<typeof vi.fn> | null = null;

vi.mock("@react-three/fiber", () => ({
  Canvas: ({
    children,
    className,
    "data-testid": testId,
    onCreated,
  }: {
    children?: unknown;
    className?: string;
    "data-testid"?: string;
    onCreated?: (payload: {
      camera: THREE.PerspectiveCamera;
      gl: {
        localClippingEnabled: boolean;
        domElement: HTMLDivElement | null;
        setScissorTest: ReturnType<typeof vi.fn>;
        clearDepth: ReturnType<typeof vi.fn>;
        resetState: ReturnType<typeof vi.fn>;
        dispose: ReturnType<typeof vi.fn>;
        renderLists: { dispose: ReturnType<typeof vi.fn> };
      };
    }) => void;
  }) => {
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const camera = useMemo(
      () => new THREE.PerspectiveCamera(40, 1, 1, 40000),
      [],
    );
    const gl = useMemo(
      () => ({
        localClippingEnabled: false,
        domElement: null as HTMLDivElement | null,
        setScissorTest: vi.fn(),
        clearDepth: vi.fn(),
        resetState: vi.fn(),
        dispose: vi.fn(),
        renderLists: { dispose: vi.fn() },
      }),
      [],
    );

    useEffect(() => {
      mockThreeCamera = camera;
      mockRendererDispose = gl.dispose;
      mockRendererResetState = gl.resetState;
      mockRendererClearDepth = gl.clearDepth;
      gl.domElement = canvasRef.current;
      onCreated?.({ camera, gl });
    }, [camera, gl, onCreated]);

    return (
      <div
        ref={canvasRef}
        className={className}
        data-testid={testId ?? "geometry-3d-canvas"}
        data-camera-position={`${camera.position.x},${camera.position.y},${camera.position.z}`}
      >
        {children as any}
      </div>
    );
  },
}));

vi.mock("@react-three/drei", () => ({
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
      target.set(
        props.target?.[0] ?? 0,
        props.target?.[1] ?? 0,
        props.target?.[2] ?? 0,
      );
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

    useImperativeHandle(ref, () => controls, [controls]);

    return (
      <div
        data-testid="orbit-controls"
        data-target={`${target.x},${target.y},${target.z}`}
        data-min-distance={String(props.minDistance ?? "")}
        data-max-distance={String(props.maxDistance ?? "")}
      >
        <button
          type="button"
          data-testid="mock-orbit-end-custom"
          onClick={() => {
            if (mockThreeCamera) {
              mockThreeCamera.position.set(
                target.x + 1800,
                target.y - 1100,
                target.z + 950,
              );
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
              mockThreeCamera.position.set(
                target.x + 1800,
                target.y - 1100,
                target.z + 950,
              );
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

function requireFixture(
  slug:
    | "mono-standard"
    | "gable-standard"
    | "box-standard"
    | "gable-u-hipped-screenshot"
    | "mono-join-screenshot",
) {
  const fixture = getSanctuaryGeometryWorkbenchFixture(slug);
  if (!fixture) {
    throw new Error(`Missing fixture ${slug}`);
  }
  return fixture;
}

function clickButtonByText(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((node) =>
    node.textContent?.includes(label),
  );
  if (!button) throw new Error(`Missing button: ${label}`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function toggleCheckboxByText(
  container: HTMLElement,
  label: string,
  checked: boolean,
) {
  const labelNode = Array.from(container.querySelectorAll("label")).find(
    (node) => node.textContent?.includes(label),
  );
  const input = labelNode?.querySelector(
    'input[type="checkbox"]',
  ) as HTMLInputElement | null;
  if (!input) throw new Error(`Missing checkbox: ${label}`);
  if (input.checked === checked) return;
  act(() => {
    input.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function clickSceneObject(container: HTMLElement, id: string) {
  const node = container.querySelector(`[data-testid="scene-object-${id}"]`);
  if (!node) throw new Error(`Missing scene object: ${id}`);
  act(() => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function setRangeValue(container: HTMLElement, label: string, value: string) {
  const input = container.querySelector(
    `[aria-label="${label}"]`,
  ) as HTMLInputElement | null;
  if (!input) throw new Error(`Missing range input: ${label}`);
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!valueSetter) {
    throw new Error("Missing input value setter");
  }
  act(() => {
    valueSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function clickByTestId(container: HTMLElement, testId: string) {
  const node = container.querySelector(`[data-testid="${testId}"]`);
  if (!node) throw new Error(`Missing node: ${testId}`);
  act(() => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function isFinitePoint(point: Point3 | null | undefined): point is Point3 {
  return Boolean(
    point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      Number.isFinite(point.z),
  );
}

function makeScreenshotStyleUHouseFootprint(): Point3[] {
  return [
    { x: -2800, y: 7200, z: 0 },
    { x: 8800, y: 7200, z: 0 },
    { x: 8800, y: 400, z: 0 },
    { x: 7000, y: 400, z: 0 },
    { x: 7000, y: 5400, z: 0 },
    { x: -1000, y: 5400, z: 0 },
    { x: -1000, y: 400, z: 0 },
    { x: -2800, y: 400, z: 0 },
  ];
}

function pointDistanceToSegment2D(
  candidate: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-6) return Math.hypot(candidate.x - start.x, candidate.y - start.y);
  const ratio = Math.min(
    Math.max(((candidate.x - start.x) * dx + (candidate.y - start.y) * dy) / lengthSq, 0),
    1,
  );
  const projectedX = start.x + dx * ratio;
  const projectedY = start.y + dy * ratio;
  return Math.hypot(candidate.x - projectedX, candidate.y - projectedY);
}

function sourceEdgeLineFromFootprint(sourceEdgeId: string) {
  const footprint = makeScreenshotStyleUHouseFootprint();
  const match = /^footprint-edge-(\d+)$/.exec(sourceEdgeId);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= footprint.length) return null;
  return {
    start: footprint[index]!,
    end: footprint[(index + 1) % footprint.length]!,
  };
}

function roofMaterialPoints(
  object: ViewerSceneHouseRoofMaterialObject,
): Point3[] {
  return object.lines.flatMap((line) =>
    [line.start, line.end].filter(isFinitePoint),
  );
}

function pointListsForObject(object: ViewerSceneObject): Point3[] {
  if (object.type === "member_prism")
    return [object.centerline.start, object.centerline.end].filter(
      isFinitePoint,
    );
  if (
    object.type === "roof_plane" ||
    object.type === "house_surface" ||
    object.type === "roof_cladding_panel"
  )
    return object.boundary.filter(isFinitePoint);
  if (object.type === "house_surface_solid")
    return (
      object.renderMesh?.vertices?.filter(isFinitePoint) ??
      object.boundary.filter(isFinitePoint)
    );
  if (object.type === "roof_flashing")
    return object.wings.flatMap((wing) => wing.boundary.filter(isFinitePoint));
  if (object.type === "house_roof_material") return roofMaterialPoints(object);
  if (object.type === "reference_line" || object.type === "house_line")
    return [object.line.start, object.line.end].filter(isFinitePoint);
  if (object.type === "house_linear_solid")
    return (
      object.renderMesh?.vertices?.filter(isFinitePoint) ??
      [object.centerline.start, object.centerline.end].filter(isFinitePoint)
    );
  if ("boundary" in object && Array.isArray(object.boundary)) {
    return object.boundary.filter(isFinitePoint);
  }
  return [];
}

function computeSceneCenter(scene: ViewerSceneModel): Point3 {
  const points = scene.layers.flatMap((layer) =>
    layer.objects.flatMap((object) => pointListsForObject(object)),
  );
  if (points.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
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
  if (points.length === 0) return { x: 0, y: 0, z: 0 };
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
  if (object.type === "member_prism") {
    return {
      x: (object.centerline.start.x + object.centerline.end.x) / 2,
      y: (object.centerline.start.y + object.centerline.end.y) / 2,
      z: (object.centerline.start.z + object.centerline.end.z) / 2,
    };
  }
  if (object.type === "reference_line" || object.type === "house_line") {
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
    distance3d: Math.round(
      Math.sqrt(delta.x * delta.x + delta.y * delta.y + delta.z * delta.z),
    ),
    distancePlan: Math.round(Math.sqrt(delta.x * delta.x + delta.y * delta.y)),
  };
}

function cameraPosition(container: HTMLElement): Point3 {
  void container;
  if (!mockThreeCamera) throw new Error("Missing mock camera");
  return {
    x: mockThreeCamera.position.x,
    y: mockThreeCamera.position.y,
    z: mockThreeCamera.position.z,
  };
}

function controlsTarget(container: HTMLElement): Point3 {
  void container;
  if (!mockOrbitControls) throw new Error("Missing mock orbit controls");
  return {
    x: mockOrbitControls.target.x,
    y: mockOrbitControls.target.y,
    z: mockOrbitControls.target.z,
  };
}

function normalizedDirection(from: Point3, to: Point3): Point3 {
  const vector = new THREE.Vector3(
    from.x - to.x,
    from.y - to.y,
    from.z - to.z,
  ).normalize();
  return { x: vector.x, y: vector.y, z: vector.z };
}

function expectDirectionsClose(actual: Point3, expected: Point3) {
  expect(actual.x).toBeCloseTo(expected.x, 5);
  expect(actual.y).toBeCloseTo(expected.y, 5);
  expect(actual.z).toBeCloseTo(expected.z, 5);
}

function viewportDiagnostics(container: HTMLElement) {
  const node = container.querySelector(
    '[data-testid="geometry-3d-viewport-diagnostics"]',
  ) as HTMLElement | null;
  if (!node) throw new Error("Missing viewport diagnostics.");
  return node.dataset;
}

function buildMovedHousePreview(input: {
  side: "front" | "left";
  strategy: "fascia_under_gutter" | "facade_ledger";
  widthM: string;
  offsetXM: string;
  setbackM: string;
}) {
  const fixture = requireFixture("mono-standard");
  let draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
  if (!draft?.inputs.modules[0]) {
    throw new Error("Expected draft geometry module.");
  }

  const intents = [
    { type: "attachment_side" as const, value: input.side },
    {
      type: "house_config" as const,
      key: "houseAttachmentStrategy" as const,
      value: input.strategy,
    },
    { type: "footprint_param" as const, key: "widthM" as const, value: input.widthM },
    { type: "footprint_param" as const, key: "offsetXM" as const, value: input.offsetXM },
    { type: "footprint_param" as const, key: "setbackM" as const, value: input.setbackM },
  ];

  for (const intent of intents) {
    const result = applyGeometryEditIntent({
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
      intent,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }
    draft = result.draft;
  }

  const geometryPreview = buildWorkbenchGeometryPreview({
    projectId: "proj_preview",
    estimateId: fixture.estimate.id,
    designRequestId: fixture.request.id,
    snapshot: fixture.snapshot,
    draft,
    moduleIndex: 0,
  });
  if (geometryPreview.kind !== "ready") {
    throw new Error("Expected ready geometry preview");
  }
  return geometryPreview;
}

function buildScreenshotStyleRoofPreview(
  slug: "gable-u-hipped-screenshot" | "mono-join-screenshot" = "gable-u-hipped-screenshot",
) {
  const fixture = requireFixture(slug);

  return buildWorkbenchGeometryPreview({
    projectId: "proj_preview",
    estimateId: fixture.estimate.id,
    designRequestId: fixture.request.id,
    snapshot: fixture.snapshot,
    draft: fixture.draft,
    moduleIndex: 0,
  });
}

function pointInPolygon2D(candidate: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean {
  if (
    polygon.some((start, index) => {
      const end = polygon[(index + 1) % polygon.length]!;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const cross = (candidate.x - start.x) * dy - (candidate.y - start.y) * dx;
      if (Math.abs(cross) > 1e-6) return false;
      const dot = (candidate.x - start.x) * dx + (candidate.y - start.y) * dy;
      return dot >= -1e-6 && dot <= dx * dx + dy * dy + 1e-6;
    })
  ) {
    return true;
  }

  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]!;
    const previous = polygon[previousIndex]!;
    const intersects =
      current.y > candidate.y !== previous.y > candidate.y &&
      candidate.x < ((previous.x - current.x) * (candidate.y - current.y)) / (previous.y - current.y || 1) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function triangleAreaXY(a: Point3, b: Point3, c: Point3): number {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
}

function geometryTriangle(positions: THREE.BufferAttribute, triangleIndex: number): [Point3, Point3, Point3] {
  const vertexIndex = triangleIndex * 3;
  return [0, 1, 2].map((offset) => ({
    x: positions.getX(vertexIndex + offset),
    y: positions.getY(vertexIndex + offset),
    z: positions.getZ(vertexIndex + offset),
  })) as [Point3, Point3, Point3];
}

describe("Geometry3DViewport", () => {
  it("triangulates concave house roof slabs without spanning recess voids", () => {
    const footprint: Point3[] = [
      { x: 0, y: 0, z: 0 },
      { x: 4000, y: 0, z: 0 },
      { x: 4000, y: 1000, z: 0 },
      { x: 2000, y: 1000, z: 0 },
      { x: 2000, y: 2500, z: 0 },
      { x: 0, y: 2500, z: 0 },
    ];
    const geometry = buildPolygonSlabGeometry(
      footprint,
      {
        origin: { x: 0, y: 0, z: 0 },
        xAxis: { x: 1, y: 0, z: 0 },
        yAxis: { x: 0, y: 1, z: 0 },
        normal: { x: 0, y: 0, z: 1 },
      },
      120,
    );
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    const frontTriangleCount = footprint.length - 2;
    let frontArea = 0;

    expect(positions.count).toBe((frontTriangleCount * 2 + footprint.length * 2) * 3);
    for (let triangleIndex = 0; triangleIndex < frontTriangleCount; triangleIndex += 1) {
      const [a, b, c] = geometryTriangle(positions, triangleIndex * 2);
      const centroid = {
        x: (a.x + b.x + c.x) / 3,
        y: (a.y + b.y + c.y) / 3,
      };
      expect(pointInPolygon2D(centroid, footprint), `triangle ${triangleIndex}`).toBe(true);
      frontArea += triangleAreaXY(a, b, c);
    }

    expect(frontArea).toBeCloseTo(7_000_000, 3);
    for (let index = 0; index < positions.count; index += 1) {
      expect(Number.isFinite(positions.getX(index))).toBe(true);
      expect(Number.isFinite(positions.getY(index))).toBe(true);
      expect(Number.isFinite(positions.getZ(index))).toBe(true);
    }
  });

  it("returns empty geometry for self-intersecting house roof slab polygons", () => {
    const geometry = buildPolygonSlabGeometry(
      [
        { x: 0, y: 0, z: 0 },
        { x: 2000, y: 2000, z: 0 },
        { x: 0, y: 2000, z: 0 },
        { x: 2000, y: 0, z: 0 },
      ],
      {
        origin: { x: 0, y: 0, z: 0 },
        xAxis: { x: 1, y: 0, z: 0 },
        yAxis: { x: 0, y: 1, z: 0 },
        normal: { x: 0, y: 0, z: 1 },
      },
      120,
    );

    expect(geometry.getAttribute("position").count).toBe(0);
  });

  it("clips rectangular gable rafter tail geometry at the gutter inside face", () => {
    const fixture = requireFixture("gable-standard");
    const geometryPreview = buildWorkbenchGeometryPreview({
      projectId: "proj_preview",
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      moduleIndex: 0,
    });
    if (geometryPreview.kind !== "ready") {
      throw new Error("Expected ready geometry preview");
    }

    const object = geometryPreview.scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (candidate) =>
          candidate.type === "member_prism" &&
          candidate.id === "outer-rafter-1",
      );
    if (!object || object.type !== "member_prism") {
      throw new Error("Expected outer rafter member prism");
    }
    const endCut = object.endCuts?.find((cut) => cut.end === "end");
    if (!endCut) {
      throw new Error("Expected outer rafter gutter-line end cut");
    }

    const midpoint = focusPointForObject(object);
    const geometry = buildClippedBoxGeometry(object, midpoint);
    if (!geometry) {
      throw new Error("Expected clipped box geometry");
    }

    const xAxis = new THREE.Vector3(
      object.centerline.end.x - object.centerline.start.x,
      object.centerline.end.y - object.centerline.start.y,
      object.centerline.end.z - object.centerline.start.z,
    ).normalize();
    const yAxis = new THREE.Vector3(
      object.localFrame.yAxis.x,
      object.localFrame.yAxis.y,
      object.localFrame.yAxis.z,
    ).normalize();
    const zAxis = new THREE.Vector3(
      object.localFrame.zAxis.x,
      object.localFrame.zAxis.y,
      object.localFrame.zAxis.z,
    ).normalize();
    const midpointVector = new THREE.Vector3(
      midpoint.x,
      midpoint.y,
      midpoint.z,
    );
    const cutNormal = new THREE.Vector3(
      endCut.plane.normal.x,
      endCut.plane.normal.y,
      endCut.plane.normal.z,
    ).normalize();
    const positions = geometry.getAttribute("position");
    let verticesOnCutPlane = 0;
    for (let index = 0; index < positions.count; index += 1) {
      const world = midpointVector
        .clone()
        .add(xAxis.clone().multiplyScalar(positions.getX(index)))
        .add(yAxis.clone().multiplyScalar(positions.getY(index)))
        .add(zAxis.clone().multiplyScalar(positions.getZ(index)));
      const signedDistance = cutNormal.dot(world) - endCut.plane.offsetMm;
      expect(signedDistance).toBeLessThanOrEqual(0.001);
      if (Math.abs(signedDistance) <= 0.001) {
        verticesOnCutPlane += 1;
      }
    }
    expect(verticesOnCutPlane).toBeGreaterThanOrEqual(3);
  });

  it("clips gable SP joiner outline extrusions at the ridge beam face", () => {
    const fixture = requireFixture("gable-standard");
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft?.inputs.modules[0]) {
      throw new Error("Expected draft geometry module.");
    }
    const acrylic = applyGeometryEditIntent({
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: "roof_material",
        value: "acrylic",
      },
    });
    expect(acrylic.ok).toBe(true);
    if (!acrylic.ok) {
      return;
    }

    const geometryPreview = buildWorkbenchGeometryPreview({
      projectId: "proj_preview",
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft: acrylic.draft,
      moduleIndex: 0,
    });
    if (geometryPreview.kind !== "ready") {
      throw new Error("Expected ready geometry preview");
    }

    const object = geometryPreview.scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (candidate) =>
          candidate.type === "member_prism" &&
          candidate.id === "outer-joiner-1",
      );
    if (!object || object.type !== "member_prism") {
      throw new Error("Expected outer joiner member prism");
    }
    const ridgeEndCut = object.endCuts?.find((cut) => cut.end === "end");
    if (!ridgeEndCut) {
      throw new Error("Expected outer joiner ridge end cut");
    }

    const midpoint = focusPointForObject(object);
    const geometry = buildClippedProfileExtrusionGeometry(object, midpoint);
    if (!geometry) {
      throw new Error("Expected clipped profile extrusion geometry");
    }

    const xAxis = new THREE.Vector3(
      object.centerline.end.x - object.centerline.start.x,
      object.centerline.end.y - object.centerline.start.y,
      object.centerline.end.z - object.centerline.start.z,
    ).normalize();
    const yAxis = new THREE.Vector3(
      object.localFrame.yAxis.x,
      object.localFrame.yAxis.y,
      object.localFrame.yAxis.z,
    ).normalize();
    const zAxis = new THREE.Vector3(
      object.localFrame.zAxis.x,
      object.localFrame.zAxis.y,
      object.localFrame.zAxis.z,
    ).normalize();
    const midpointVector = new THREE.Vector3(
      midpoint.x,
      midpoint.y,
      midpoint.z,
    );
    const cutNormal = new THREE.Vector3(
      ridgeEndCut.plane.normal.x,
      ridgeEndCut.plane.normal.y,
      ridgeEndCut.plane.normal.z,
    ).normalize();
    const positions = geometry.getAttribute("position");
    let verticesOnCutPlane = 0;
    for (let index = 0; index < positions.count; index += 1) {
      const world = midpointVector
        .clone()
        .add(xAxis.clone().multiplyScalar(positions.getX(index)))
        .add(yAxis.clone().multiplyScalar(positions.getY(index)))
        .add(zAxis.clone().multiplyScalar(positions.getZ(index)));
      const signedDistance =
        cutNormal.dot(world) - ridgeEndCut.plane.offsetMm;
      expect(signedDistance).toBeLessThanOrEqual(0.001);
      if (Math.abs(signedDistance) <= 0.001) {
        verticesOnCutPlane += 1;
      }
    }
    expect(verticesOnCutPlane).toBeGreaterThanOrEqual(3);
  });

  it("renders inspection controls, camera actions, and inspector updates for the 3D scene", async () => {
    const fixture = requireFixture("mono-standard");
    const geometryPreview = buildWorkbenchGeometryPreview({
      projectId: "proj_preview",
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      moduleIndex: 0,
    });
    if (geometryPreview.kind !== "ready") {
      throw new Error("Expected ready geometry preview");
    }

    const rendered = renderIntoDocument(
      <Geometry3DViewport geometryPreview={geometryPreview} />,
    );
    const sceneCenter = computeSceneCenter(geometryPreview.scene);

    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.textContent).not.toContain("3D Verification");
    expect(
      rendered.container.querySelector('[data-testid="workspace-panel"]'),
    ).toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="geometry-3d-canvas"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="geometry-3d-canvas-shell"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container
        .querySelector('[data-testid="geometry-3d-canvas-shell"]')
        ?.getAttribute("data-native-selection-suppressed"),
    ).toBe("true");
    expect(
      rendered.container.querySelector('[data-testid="geometry-3d-canvas"]')
        ?.className,
    ).toContain("canvas");
    expect(viewportDiagnostics(rendered.container).finiteBounds).toBe("true");
    expect(
      Number(viewportDiagnostics(rendered.container).sceneObjectCount),
    ).toBeGreaterThan(0);
    expect(viewportDiagnostics(rendered.container).canvasContained).toBe(
      "true",
    );
    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-outer-gutter"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-outer-beam"]',
      ),
    ).toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-acrylic-panel-1"]',
      ),
    ).not.toBeNull();

    clickButtonByText(rendered.container, "Workspace panel");
    expect(
      rendered.container.querySelector('[data-testid="workspace-panel"]'),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("Snapshot Validated");
    expect(rendered.container.textContent).toContain("3D Verification");
    expect(rendered.container.textContent).toContain("Inspection");
    expect(rendered.container.textContent).toContain("Section cut");
    expect(rendered.container.textContent).toContain("Datum axes");
    expect(rendered.container.textContent).toContain("Roof fall vectors");
    expect(rendered.container.textContent).toContain("Selected member axes");
    expect(rendered.container.textContent).toContain("Support Beams");
    expect(rendered.container.textContent).toContain("Measurement");
    expect(rendered.container.textContent).toContain("Enable measurement");
    expect(rendered.container.textContent).toContain("Focus");
    expect(rendered.container.textContent).toContain("Scene");
    expect(rendered.container.textContent).toContain("View");
    expect(rendered.container.textContent).toContain("Iso");

    clickButtonByText(rendered.container, "Front");
    expect(rendered.container.textContent).toContain("Front");

    clickButtonByText(rendered.container, "Right");
    expect(rendered.container.textContent).toContain("Right");

    clickButtonByText(rendered.container, "Top");
    expect(rendered.container.textContent).toContain("Top");

    clickButtonByText(rendered.container, "Iso");
    expect(rendered.container.textContent).toContain("Iso");

    clickButtonByText(rendered.container, "Top");
    expect(rendered.container.textContent).toContain("Top");
    clickByTestId(rendered.container, "mock-orbit-end-custom");
    expect(rendered.container.textContent).toContain("Custom");
    expect(rendered.container.textContent).toContain("Scene");

    toggleCheckboxByText(rendered.container, "Section cut", true);
    expect(
      rendered.container.querySelector('[data-testid="section-cut-plane"]'),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("Active at X = 3000 mm");

    setRangeValue(rendered.container, "Section position (mm)", "1800");
    expect(rendered.container.textContent).toContain("Cut X: 1800 mm");
    expect(rendered.container.textContent).toContain("Active at X = 1800 mm");

    clickButtonByText(rendered.container, "Center");
    expect(rendered.container.textContent).toContain("Cut X: 3000 mm");

    toggleCheckboxByText(rendered.container, "Datum axes", true);
    expect(
      rendered.container.querySelector('[data-testid="datum-axis-x"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="datum-axis-y"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="datum-axis-z"]'),
    ).not.toBeNull();

    toggleCheckboxByText(rendered.container, "Roof fall vectors", true);
    expect(
      rendered.container.querySelector(
        '[data-testid="roof-fall-vector-mono-roof"]',
      ),
    ).not.toBeNull();

    toggleCheckboxByText(rendered.container, "Enable measurement", true);
    expect(rendered.container.textContent).toContain("A source");
    expect(rendered.container.textContent).toContain("B source");

    clickSceneObject(rendered.container, "outer-gutter");
    const outerGutter = geometryPreview.scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.id === "outer-gutter");
    if (!outerGutter) {
      throw new Error("Expected outer gutter scene object");
    }
    if (outerGutter.type !== "member_prism") {
      throw new Error("Expected outer gutter member prism");
    }
    const gutterFocus = focusPointForObject(outerGutter);
    expect(
      rendered.container.querySelector('[data-testid="measurement-anchor-a"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="measurement-probe-line"]',
      ),
    ).toBeNull();
    expect(rendered.container.textContent).toContain("outer-gutter");
    expect(rendered.container.textContent).toContain("midpoint");

    clickButtonByText(rendered.container, "Start");
    expect(rendered.container.textContent).toContain(
      formatPoint(outerGutter.centerline.start),
    );
    expect(rendered.container.textContent).toContain("start");

    clickButtonByText(rendered.container, "Use datum origin");
    const gutterToDatumMeasurement = measurementBetween(
      outerGutter.centerline.start,
      geometryPreview.assembly.datum.origin,
    );
    expect(
      rendered.container.querySelector(
        '[data-testid="measurement-probe-line"]',
      ),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("datum-origin");
    expect(rendered.container.textContent).toContain(
      `${Math.round(gutterToDatumMeasurement.delta.x)} mm`,
    );
    expect(rendered.container.textContent).toContain(
      `${Math.round(gutterToDatumMeasurement.delta.y)} mm`,
    );
    expect(rendered.container.textContent).toContain(
      `${Math.round(gutterToDatumMeasurement.delta.z)} mm`,
    );
    expect(rendered.container.textContent).toContain(
      `${gutterToDatumMeasurement.distance3d} mm`,
    );
    expect(rendered.container.textContent).toContain(
      `${gutterToDatumMeasurement.distancePlan} mm`,
    );

    clickButtonByText(rendered.container, "Clear probe");
    expect(
      rendered.container.querySelector('[data-testid="measurement-anchor-a"]'),
    ).toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="measurement-probe-line"]',
      ),
    ).toBeNull();

    clickSceneObject(rendered.container, "outer-gutter");
    const beforeFocusDirection = normalizedDirection(
      cameraPosition(rendered.container),
      sceneCenter,
    );
    clickButtonByText(rendered.container, "Focus selection");
    expect(rendered.container.textContent).toContain("Selected");
    expect(rendered.container.textContent).toContain("Custom");
    expect(rendered.container.textContent).toContain(
      `${Math.round(gutterFocus.x)}, ${Math.round(gutterFocus.y)}, ${Math.round(gutterFocus.z)} mm`,
    );
    const afterFocusDirection = normalizedDirection(
      cameraPosition(rendered.container),
      gutterFocus,
    );
    expectDirectionsClose(afterFocusDirection, beforeFocusDirection);

    expect(rendered.container.textContent).toContain("outer-gutter");
    expect(rendered.container.textContent).toContain("Profile");
    expect(rendered.container.textContent).toContain("Profile key");
    expect(rendered.container.textContent).toContain("sp_gutter");
    expect(rendered.container.textContent).toContain("Render");
    expect(rendered.container.textContent).toContain("outline extrusion");
    expect(rendered.container.textContent).toContain("Outline");
    expect(rendered.container.textContent).toContain("Yes (12 points)");
    expect(rendered.container.textContent).toContain("Local X Axis");
    expect(rendered.container.textContent).toContain("endCapWidthMm: 100");
    expect(rendered.container.textContent).toContain("endCapDepthMm: 150");

    clickSceneObject(rendered.container, "joiner-1");
    expect(rendered.container.textContent).toContain("joiner-1");
    expect(rendered.container.textContent).toContain("sp_joiners");
    expect(rendered.container.textContent).toContain("outline extrusion");
    expect(rendered.container.textContent).toContain("Yes (20 points)");

    toggleCheckboxByText(rendered.container, "Selected member axes", true);
    expect(
      rendered.container.querySelector(
        '[data-testid="selected-member-axis-x"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="selected-member-axis-y"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="selected-member-axis-z"]',
      ),
    ).not.toBeNull();

    clickSceneObject(rendered.container, "acrylic-panel-1");
    const acrylicPanel = geometryPreview.scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.id === "acrylic-panel-1");
    if (!acrylicPanel) {
      throw new Error("Expected acrylic panel scene object");
    }
    const gutterToPanelMeasurement = measurementBetween(
      gutterFocus,
      focusPointForObject(acrylicPanel),
    );
    expect(
      rendered.container.querySelector('[data-testid="measurement-anchor-b"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="measurement-probe-line"]',
      ),
    ).not.toBeNull();
    expect(rendered.container.textContent).toContain("acrylic-panel-1");
    expect(rendered.container.textContent).toContain("Material");
    expect(rendered.container.textContent).toContain("acrylic");
    expect(rendered.container.textContent).toContain("Boundary");
    expect(rendered.container.textContent).toContain("4 points");
    expect(rendered.container.textContent).toContain("Thickness");
    expect(rendered.container.textContent).toContain("6 mm");
    expect(rendered.container.textContent).toContain("Gutter embed");
    expect(rendered.container.textContent).toContain("15 mm");
    expect(rendered.container.textContent).toContain("Panel area");
    expect(rendered.container.textContent).toContain(
      `${gutterToPanelMeasurement.distance3d} mm`,
    );
    expect(rendered.container.textContent).toContain(
      `${gutterToPanelMeasurement.distancePlan} mm`,
    );
    expect(
      rendered.container.querySelector(
        '[data-testid="selected-member-axis-x"]',
      ),
    ).toBeNull();

    toggleCheckboxByText(rendered.container, "Roof Planes", true);
    clickSceneObject(rendered.container, "mono-roof");
    clickButtonByText(rendered.container, "Focus selection");
    const roofPlane = geometryPreview.scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.id === "mono-roof");
    if (!roofPlane) {
      throw new Error("Expected mono roof plane");
    }
    const roofFocus = focusPointForObject(roofPlane);
    expect(rendered.container.textContent).toContain(
      `${Math.round(roofFocus.x)}, ${Math.round(roofFocus.y)}, ${Math.round(roofFocus.z)} mm`,
    );
    expect(rendered.container.textContent).toContain("Plane normal");
    expect(
      rendered.container.querySelector(
        '[data-testid="selected-member-axis-x"]',
      ),
    ).toBeNull();

    clickByTestId(rendered.container, "mock-orbit-end-manual");
    expect(rendered.container.textContent).toContain("Manual");
    expect(rendered.container.textContent).toContain("Custom");

    toggleCheckboxByText(rendered.container, "Gutters", false);
    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-outer-gutter"]',
      ),
    ).toBeNull();
    toggleCheckboxByText(rendered.container, "Support Beams", true);
    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-outer-beam"]',
      ),
    ).not.toBeNull();

    const canvasNode = rendered.container.querySelector(
      '[data-testid="geometry-3d-canvas"]',
    );
    const beforeFitDirection = normalizedDirection(
      cameraPosition(rendered.container),
      controlsTarget(rendered.container),
    );
    clickButtonByText(rendered.container, "Fit to scene");
    expect(rendered.container.textContent).toContain("Scene");
    expect(rendered.container.textContent).toContain("Custom");
    expect(rendered.container.textContent).toContain(
      `${Math.round(sceneCenter.x)}, ${Math.round(sceneCenter.y)}, ${Math.round(sceneCenter.z)} mm`,
    );
    const afterFitDirection = normalizedDirection(
      cameraPosition(rendered.container),
      sceneCenter,
    );
    expectDirectionsClose(afterFitDirection, beforeFitDirection);
    expect(
      rendered.container.querySelector('[data-testid="geometry-3d-canvas"]'),
    ).toBe(canvasNode);

    rendered.unmount();
  });

  it("suppresses native selection on the 3D canvas shell without blocking workspace panel controls", async () => {
    const fixture = requireFixture("mono-standard");
    const geometryPreview = buildWorkbenchGeometryPreview({
      projectId: "proj_preview",
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      moduleIndex: 0,
    });
    if (geometryPreview.kind !== "ready") {
      throw new Error("Expected ready geometry preview");
    }

    const rendered = renderIntoDocument(
      <Geometry3DViewport geometryPreview={geometryPreview} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const canvasShell = rendered.container.querySelector(
      '[data-testid="geometry-3d-canvas-shell"]',
    );
    if (!(canvasShell instanceof HTMLElement)) {
      throw new Error("Missing 3D canvas shell.");
    }

    const shellSelectionEvent = new Event("selectstart", {
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      canvasShell.dispatchEvent(shellSelectionEvent);
    });
    expect(shellSelectionEvent.defaultPrevented).toBe(true);

    clickButtonByText(rendered.container, "Workspace panel");
    const workspaceButton = rendered.container.querySelector(
      '[data-testid="workspace-panel"] button',
    );
    if (!(workspaceButton instanceof HTMLButtonElement)) {
      throw new Error("Missing workspace panel button.");
    }

    const panelSelectionEvent = new Event("selectstart", {
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      workspaceButton.dispatchEvent(panelSelectionEvent);
    });
    expect(panelSelectionEvent.defaultPrevented).toBe(false);

    rendered.unmount();
  });

  it("renders and inspects semantic house model scene objects", async () => {
    const fixture = requireFixture("mono-standard");
    const geometryPreview = buildWorkbenchGeometryPreview({
      projectId: "proj_preview",
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      moduleIndex: 0,
    });
    if (geometryPreview.kind !== "ready") {
      throw new Error("Expected ready geometry preview");
    }

    const houseLayer = geometryPreview.scene.layers.find(
      (layer) => layer.id === "house",
    );
    const sceneCenter = computeSceneCenter(geometryPreview.scene);
    expect(sceneCenter.y).toBeLessThan(1000);
    expect(
      houseLayer?.objects.some((object) => object.type === "house_surface_solid"),
    ).toBe(true);
    expect(
      houseLayer?.objects.some((object) => object.type === "house_line"),
    ).toBe(true);
    const attachmentTargetLine = houseLayer?.objects.find(
      (object): object is Extract<ViewerSceneObject, { type: "house_line" }> =>
        object.type === "house_line" && object.kind === "attachment_target",
    );
    const wallSolid = houseLayer?.objects.find(
      (object): object is Extract<ViewerSceneObject, { type: "house_surface_solid" }> =>
        object.type === "house_surface_solid" && object.kind === "wall",
    );
    const roofSolid = houseLayer?.objects.find(
      (object): object is Extract<ViewerSceneObject, { type: "house_surface_solid" }> =>
        object.type === "house_surface_solid" && object.kind === "roof",
    );
    const soffitSolid = houseLayer?.objects.find(
      (object): object is Extract<ViewerSceneObject, { type: "house_surface_solid" }> =>
        object.type === "house_surface_solid" && object.kind === "soffit",
    );
    const fasciaSolid = houseLayer?.objects.find(
      (object): object is Extract<ViewerSceneObject, { type: "house_surface_solid" }> =>
        object.type === "house_surface_solid" && object.kind === "fascia",
    );
    const gutterSolid = houseLayer?.objects.find(
      (object): object is Extract<ViewerSceneObject, { type: "house_linear_solid" }> =>
        object.type === "house_linear_solid" && object.kind === "gutter",
    );
    expect(
      wallSolid?.metadata?.hostEdgeSide === "rear" ||
        wallSolid?.metadata?.hostEdgeSide === "front" ||
        wallSolid?.metadata?.hostEdgeSide === "left" ||
        wallSolid?.metadata?.hostEdgeSide === "right",
    ).toBe(true);

    const rendered = renderIntoDocument(
      <Geometry3DViewport geometryPreview={geometryPreview} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      rendered.container.querySelector('[data-testid="scene-object-house-solid-house-wall-1"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        `[data-testid="scene-object-${roofSolid?.id ?? "missing-roof-solid"}"]`,
      ),
    ).not.toBeNull();
    if (soffitSolid) {
      expect(
        rendered.container.querySelector(
          `[data-testid="scene-object-${soffitSolid.id}"]`,
        ),
      ).not.toBeNull();
    }
    if (fasciaSolid) {
      expect(
        rendered.container.querySelector(
          `[data-testid="scene-object-${fasciaSolid.id}"]`,
        ),
      ).not.toBeNull();
    }
    expect(
      rendered.container.querySelector(
        `[data-testid="scene-object-${attachmentTargetLine?.id ?? "missing-attachment-target"}"]`,
      ),
    ).not.toBeNull();

    const wallGeometry = buildRenderMeshGeometry(wallSolid?.renderMesh);
    const roofGeometry = buildRenderMeshGeometry(roofSolid?.renderMesh);
    const gutterGeometry = buildRenderMeshGeometry(gutterSolid?.renderMesh);
    expect(wallGeometry?.getAttribute("position").count).toBeGreaterThan(0);
    expect(roofGeometry?.getAttribute("position").count).toBeGreaterThan(0);
    if (gutterSolid) {
      expect(gutterGeometry?.getAttribute("position").count).toBeGreaterThan(0);
    }

    clickButtonByText(rendered.container, "Workspace panel");
    if (!roofSolid) {
      throw new Error("Expected house roof solid.");
    }
    clickSceneObject(rendered.container, roofSolid.id);
    expect(rendered.container.textContent).toContain(roofSolid.id);
    expect(rendered.container.textContent).toContain("house solid roof");
    expect(rendered.container.textContent).toContain("Roof QA");
    expect(rendered.container.textContent).toContain("valid");
    expect(rendered.container.textContent).toContain("Thickness");
    expect(rendered.container.textContent).toContain("Plane normal");

    if (gutterSolid) {
      clickSceneObject(rendered.container, gutterSolid.id);
      expect(rendered.container.textContent).toContain(gutterSolid.id);
      expect(rendered.container.textContent).toContain("house solid gutter");
      expect(rendered.container.textContent).toContain("Profile");
      expect(rendered.container.textContent).toContain("Start");
      expect(rendered.container.textContent).toContain("End");
    }

    clickButtonByText(rendered.container, "Fit to scene");
    expect(rendered.container.textContent).toContain(
      `${Math.round(sceneCenter.x)}, ${Math.round(sceneCenter.y)}, ${Math.round(sceneCenter.z)} mm`,
    );

    rendered.unmount();
  });

  it("picks an attached deck host side from a house wall without selecting non-wall objects", async () => {
    const fixture = requireFixture("mono-standard");
    const geometryPreview = buildWorkbenchGeometryPreview({
      projectId: "proj_preview",
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      moduleIndex: 0,
    });
    if (geometryPreview.kind !== "ready") {
      throw new Error("Expected ready geometry preview");
    }

    const pickSpy = vi.fn();
    const wallSolid = geometryPreview.scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object): object is Extract<ViewerSceneObject, { type: "house_surface_solid" }> =>
          object.type === "house_surface_solid" &&
          object.kind === "wall" &&
          (object.metadata?.hostEdgeSide === "rear" ||
            object.metadata?.hostEdgeSide === "front" ||
            object.metadata?.hostEdgeSide === "left" ||
            object.metadata?.hostEdgeSide === "right"),
      );
    const roofSolid = geometryPreview.scene.layers
      .flatMap((layer) => layer.objects)
      .find(
        (object): object is Extract<ViewerSceneObject, { type: "house_surface_solid" }> =>
          object.type === "house_surface_solid" && object.kind === "roof",
      );
    if (!wallSolid) {
      throw new Error("Expected wall solid with host edge metadata.");
    }

    const rendered = renderIntoDocument(
      <Geometry3DViewport
        geometryPreview={geometryPreview}
        pendingAttachedDeckHostEdgePick
        onPickAttachedDeckHostEdge={pickSpy}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain("Pick house side for new deck");

    if (roofSolid) {
      clickSceneObject(rendered.container, roofSolid.id);
      expect(pickSpy).not.toHaveBeenCalled();
      expect(viewportDiagnostics(rendered.container).selectedObjectId).toBe("");
    }

    clickSceneObject(rendered.container, wallSolid.id);
    expect(pickSpy).toHaveBeenCalledWith(wallSolid.metadata?.hostEdgeSide);
    expect(viewportDiagnostics(rendered.container).selectedObjectId).toBe("");

    rendered.unmount();
  });

  it("renders deck-specific surface polish and selected deck outlines", async () => {
    const fixture = requireFixture("mono-standard");
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) {
      throw new Error("Expected drawing draft.");
    }
    draft.houseFirst = {
      decks: [
        {
          id: "deck-1",
          name: "Deck 1",
          kind: "deck",
          shape: "preset",
          presetType: "rect_attached",
          presetRect: {
            widthM: "4",
            depthM: "3",
            centerOffsetM: "0",
          },
          outline: [
            { alongM: "1.5", depthM: "-3" },
            { alongM: "5.5", depthM: "-3" },
            { alongM: "5.5", depthM: "0" },
            { alongM: "1.5", depthM: "0" },
          ],
          elevationMode: "aligned_to_threshold",
          levelOffsetMm: "0",
          hostEdgeId: "rear",
          isAttached: true,
          surfaceMaterial: "timber_decking",
        },
        {
          id: "deck-2",
          name: "Deck 2",
          kind: "deck",
          shape: "preset",
          presetType: "rect_detached",
          presetRect: {
            widthM: "3.6",
            depthM: "3",
            centerOffsetM: "0",
            detachedGapM: "0.8",
          },
          outline: [
            { alongM: "1.7", depthM: "-6.8" },
            { alongM: "5.3", depthM: "-6.8" },
            { alongM: "5.3", depthM: "-3.8" },
            { alongM: "1.7", depthM: "-3.8" },
          ],
          elevationMode: "ground",
          levelOffsetMm: "0",
          hostEdgeId: "rear",
          isAttached: false,
          surfaceMaterial: "composite",
        },
      ],
    };

    const geometryPreview = buildWorkbenchGeometryPreview({
      projectId: "proj_preview",
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
    });
    expect(geometryPreview.kind).toBe("ready");
    if (geometryPreview.kind !== "ready") return;

    const rendered = renderIntoDocument(
      <Geometry3DViewport geometryPreview={geometryPreview} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      rendered.container.querySelector('[data-testid="scene-object-house-solid-deck-1"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="scene-object-house-solid-deck-1-deck-outline"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="scene-object-house-solid-deck-1-deck-grooves"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="scene-object-house-solid-deck-1-deck-outline-selected"]'),
    ).toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="scene-object-house-solid-deck-2-deck-outline-selected"]'),
    ).toBeNull();

    clickSceneObject(rendered.container, "house-solid-deck-1");
    expect(viewportDiagnostics(rendered.container).selectedObjectId).toBe("house-solid-deck-1");
    expect(
      rendered.container.querySelector('[data-testid="scene-object-house-solid-deck-1-deck-outline-selected"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="scene-object-house-solid-deck-2-deck-outline-selected"]'),
    ).toBeNull();

    clickButtonByText(rendered.container, "Workspace panel");
    expect(rendered.container.textContent).toContain("deckSurfaceMaterial");
    expect(rendered.container.textContent).toContain("deckPresetRectWidthMm");

    rendered.unmount();

    const houseRendered = renderIntoDocument(
      <Geometry3DViewport geometryPreview={geometryPreview} displayMode="house" />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      houseRendered.container.querySelector('[data-testid="scene-object-house-solid-house-wall-1"]'),
    ).not.toBeNull();
    expect(
      houseRendered.container.querySelector('[data-testid="scene-object-house-solid-deck-1"]'),
    ).not.toBeNull();
    expect(
      houseRendered.container.querySelector('[data-testid="scene-object-outer-gutter"]'),
    ).toBeNull();
    expect(
      houseRendered.container.querySelector('[data-testid="scene-object-acrylic-panel-1"]'),
    ).toBeNull();
    expect(viewportDiagnostics(houseRendered.container).sceneObjectCount).toBe(
      String(
        geometryPreview.scene.layers
          .filter((layer) => layer.id === "house" || layer.id === "house_roof_materials")
          .flatMap((layer) => layer.objects).length,
      ),
    );

    clickButtonByText(houseRendered.container, "Workspace panel");
    expect(houseRendered.container.textContent).toContain("House");
    expect(houseRendered.container.textContent).not.toContain("Posts");
    expect(houseRendered.container.textContent).not.toContain("Rafters");

    houseRendered.unmount();
  });

  it("keeps moved semantic house context renderable and in focus bounds", async () => {
    const fixture = requireFixture("mono-standard");
    let draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft?.inputs.modules[0]) {
      throw new Error("Expected draft geometry module.");
    }

    for (const [key, value] of [
      ["widthM", "8"],
      ["offsetXM", "-1"],
      ["setbackM", "0.4"],
    ] as const) {
      const result = applyGeometryEditIntent({
        snapshot: fixture.snapshot,
        draft,
        moduleIndex: 0,
        intent: {
          type: "footprint_param",
          key,
          value,
        },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      draft = result.draft;
    }

    const geometryPreview = buildWorkbenchGeometryPreview({
      projectId: "proj_preview",
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
    });
    expect(geometryPreview.kind).toBe("ready");
    if (geometryPreview.kind !== "ready") return;

    const attachmentTarget = geometryPreview.scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.id === "house-attachment-target-line");
    expect(attachmentTarget).toMatchObject({
      type: "house_line",
      line: {
        start: { x: 0, y: -400 },
        end: { x: 6000, y: -400 },
      },
    });

    const rendered = renderIntoDocument(
      <Geometry3DViewport geometryPreview={geometryPreview} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      rendered.container.querySelector('[data-testid="scene-object-house-solid-house-wall-1"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-house-attachment-target-line"]',
      ),
    ).not.toBeNull();

    clickButtonByText(rendered.container, "Workspace panel");
    clickButtonByText(rendered.container, "Fit to scene");
    expect(rendered.container.textContent).toContain(
      `${Math.round(computeSceneCenter(geometryPreview.scene).x)}, ${Math.round(
        computeSceneCenter(geometryPreview.scene).y,
      )}, ${Math.round(computeSceneCenter(geometryPreview.scene).z)} mm`,
    );

    rendered.unmount();
  });

  it("keeps front and side moved house scenes contained and resets stale viewport state on preview changes", async () => {
    const frontPreview = buildMovedHousePreview({
      side: "front",
      strategy: "fascia_under_gutter",
      widthM: "8",
      offsetXM: "-1",
      setbackM: "0.4",
    });
    const sidePreview = buildMovedHousePreview({
      side: "left",
      strategy: "facade_ledger",
      widthM: "2",
      offsetXM: "0.5",
      setbackM: "0.3",
    });

    const frontTarget = frontPreview.scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.id === "house-attachment-target-line");
    expect(frontTarget).toMatchObject({
      type: "house_line",
      line: {
        start: { x: 0, y: 3400 },
        end: { x: 6000, y: 3400 },
      },
    });

    const sideTarget = sidePreview.scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.id === "house-attachment-target-line");
    expect(sideTarget).toMatchObject({
      type: "house_line",
      line: {
        start: { x: -300, y: 500 },
        end: { x: -300, y: 2500 },
      },
    });

    const rendered = renderIntoDocument(
      <Geometry3DViewport geometryPreview={frontPreview} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(viewportDiagnostics(rendered.container).finiteBounds).toBe("true");
    expect(viewportDiagnostics(rendered.container).canvasContained).toBe(
      "true",
    );
    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-house-attachment-target-line"]',
      ),
    ).not.toBeNull();

    clickButtonByText(rendered.container, "Workspace panel");
    toggleCheckboxByText(rendered.container, "Section cut", true);
    clickSceneObject(rendered.container, "house-attachment-target-line");
    expect(viewportDiagnostics(rendered.container).clippingEnabled).toBe("true");
    expect(viewportDiagnostics(rendered.container).selectedObjectId).toBe(
      "house-attachment-target-line",
    );

    mockRendererResetState?.mockClear();
    mockRendererClearDepth?.mockClear();
    rendered.rerender(<Geometry3DViewport geometryPreview={sidePreview} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRendererResetState).not.toBeNull();
    expect(mockRendererResetState?.mock.calls.length).toBeGreaterThan(0);
    expect(mockRendererClearDepth?.mock.calls.length).toBeGreaterThan(0);
    expect(viewportDiagnostics(rendered.container).finiteBounds).toBe("true");
    expect(viewportDiagnostics(rendered.container).canvasContained).toBe(
      "true",
    );
    expect(viewportDiagnostics(rendered.container).clippingEnabled).toBe(
      "false",
    );
    expect(viewportDiagnostics(rendered.container).selectedObjectId).toBe("");

    clickButtonByText(rendered.container, "Workspace panel");
    clickSceneObject(rendered.container, "house-attachment-target-line");
    expect(rendered.container.textContent).toContain("-300, 500, 2400 mm");
    expect(rendered.container.textContent).toContain("-300, 2500, 2400 mm");

    const dispose = mockRendererDispose;
    rendered.unmount();
    expect(dispose?.mock.calls.length).toBeGreaterThan(0);
  });

  it("keeps screenshot-style U roof QA diagnostics finite in the 3D viewport", async () => {
    const geometryPreview = buildScreenshotStyleRoofPreview();
    const houseObjects =
      geometryPreview.scene.layers.find((layer) => layer.id === "house")?.objects ?? [];
    const qaStatus = String(geometryPreview.scene.metadata?.houseRoofQaStatus ?? "");
    const roofSolids = houseObjects.filter(
      (object) => object.type === "house_surface_solid" && object.kind === "roof",
    );
    const soffitSolids = houseObjects.filter(
      (object) => object.type === "house_surface_solid" && object.kind === "soffit",
    );
    const roofOutlines = houseObjects.filter(
      (object) => object.type === "house_line" && object.kind === "roof_outline",
    );
    const roofFeatures = houseObjects.filter(
      (object) => object.type === "house_line" && object.kind === "roof_feature",
    );

    expect(qaStatus).toBe("valid");
    expect(Number(geometryPreview.scene.metadata?.houseRoofSolidExpectedCount ?? 0)).toBeGreaterThan(0);
    expect(geometryPreview.scene.metadata?.houseRoofTopologyValleyCount).toBe(2);
    expect(geometryPreview.scene.metadata?.houseRoofTopologyInternalEaveHeightSegmentCount).toBe(0);
    expect(roofFeatures.length).toBeGreaterThan(0);
    expect(roofSolids.length).toBeGreaterThan(0);
    expect(roofOutlines).toHaveLength(0);
    expect(
      houseObjects.some(
        (object) =>
          object.type === "house_surface_solid" && object.kind === "wall",
      ),
    ).toBe(true);
    expect(
      houseObjects.some(
        (object) =>
          object.type === "house_linear_solid" && object.kind === "gutter",
      ),
    ).toBe(true);

    const rendered = renderIntoDocument(
      <Geometry3DViewport geometryPreview={geometryPreview} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const diagnostics = viewportDiagnostics(rendered.container);
    expect(diagnostics.finiteBounds).toBe("true");
    expect(diagnostics.canvasContained).toBe("true");
    expect(diagnostics.houseRoofQaStatus).toBe(qaStatus);
    expect(Number(diagnostics.houseRoofTopologyValleyCount)).toBe(2);
    expect(Number(diagnostics.houseRoofTopologyInternalEaveHeightSegmentCount)).toBe(0);
    expect(Number(diagnostics.houseRoofSolidExpectedCount)).toBeGreaterThan(0);
    expect(Number(diagnostics.houseRoofSolidRenderedCount)).toBeGreaterThan(0);
    expect(Number(diagnostics.houseRoofSolidSkippedCount)).toBe(0);
    expect(rendered.container.textContent).not.toContain("NaN");
    expect(rendered.container.textContent).not.toContain("Infinity");

    rendered.unmount();
  });

  it("renders the screenshot-style mono join case through the ready 3D viewport path", async () => {
    const geometryPreview = buildScreenshotStyleRoofPreview("mono-join-screenshot");
    expect(geometryPreview.kind).toBe("ready");
    if (geometryPreview.kind !== "ready") return;

    const rendered = renderIntoDocument(
      <Geometry3DViewport geometryPreview={geometryPreview} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.textContent).not.toContain("3D Preview Unsupported");
    expect(rendered.container.textContent).not.toContain("unsupported_roof_topology");

    rendered.unmount();
  });

  it("skips invalid semantic house objects without corrupting scene focus", async () => {
    const fixture = requireFixture("mono-standard");
    const geometryPreview = buildWorkbenchGeometryPreview({
      projectId: "proj_preview",
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      moduleIndex: 0,
    });
    expect(geometryPreview.kind).toBe("ready");
    if (geometryPreview.kind !== "ready") return;

    const expectedCenter = computeSceneCenter(geometryPreview.scene);
    const invalidObjects: ViewerSceneObject[] = [
      {
        id: "invalid-house-surface",
        type: "house_surface",
        kind: "wall",
        boundary: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
        ],
        plane: {
          origin: { x: 0, y: 0, z: 0 },
          xAxis: { x: 1, y: 0, z: 0 },
          yAxis: { x: 0, y: 0, z: 1 },
          normal: { x: 0, y: -1, z: 0 },
        },
      },
      {
        id: "invalid-house-line",
        type: "house_line",
        kind: "attachment_target",
        line: {
          start: { x: Number.NaN, y: 0, z: 2400 },
          end: { x: Number.NaN, y: 0, z: 2400 },
        },
      },
      {
        id: "invalid-house-solid-surface",
        type: "house_surface_solid",
        kind: "roof",
        boundary: [
          { x: 0, y: 0, z: 2400 },
          { x: 0, y: 0, z: 2400 },
          { x: 0, y: 0, z: 2400 },
        ],
        plane: {
          origin: { x: 0, y: 0, z: 2400 },
          xAxis: { x: 1, y: 0, z: 0 },
          yAxis: { x: 0, y: 1, z: 0 },
          normal: { x: 0, y: 0, z: 1 },
        },
        thicknessMm: 120,
      },
      {
        id: "invalid-house-solid-gutter",
        type: "house_linear_solid",
        kind: "gutter",
        centerline: {
          start: { x: 0, y: 0, z: 2400 },
          end: { x: 1000, y: 0, z: 2400 },
        },
        localFrame: {
          origin: { x: 0, y: 0, z: 2400 },
          xAxis: { x: 1, y: 0, z: 0 },
          yAxis: { x: 1, y: 0, z: 0 },
          zAxis: { x: 1, y: 0, z: 0 },
        },
        profileWidthMm: 125,
        profileDepthMm: 90,
      },
    ];
    const invalidPreview = {
      ...geometryPreview,
      scene: {
        layers: geometryPreview.scene.layers.map((layer) =>
          layer.id === "house"
            ? { ...layer, objects: [...layer.objects, ...invalidObjects] }
            : layer,
        ),
      },
    };

    const rendered = renderIntoDocument(
      <Geometry3DViewport geometryPreview={invalidPreview} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-invalid-house-surface"]',
      ),
    ).toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-invalid-house-line"]',
      ),
    ).toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-invalid-house-solid-surface"]',
      ),
    ).toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-invalid-house-solid-gutter"]',
      ),
    ).toBeNull();
    expect(
      rendered.container.querySelector('[data-testid="scene-object-house-solid-house-wall-1"]'),
    ).not.toBeNull();

    clickButtonByText(rendered.container, "Workspace panel");
    clickButtonByText(rendered.container, "Fit to scene");
    expect(rendered.container.textContent).toContain(
      `${Math.round(expectedCenter.x)}, ${Math.round(expectedCenter.y)}, ${Math.round(
        expectedCenter.z,
      )} mm`,
    );
    expect(rendered.container.textContent).not.toContain("NaN");
    expect(rendered.container.textContent).not.toContain("Infinity");
    expect(viewportDiagnostics(rendered.container).finiteBounds).toBe("true");
    expect(viewportDiagnostics(rendered.container).canvasContained).toBe(
      "true",
    );

    rendered.unmount();
  });

  it("renders an unsupported diagnostic panel instead of a blank canvas", () => {
    const fixture = requireFixture("mono-standard");
    const snapshot = structuredClone(fixture.snapshot) as {
      inputs?: { modules?: Array<Record<string, unknown>> };
      outputs?: {
        pergolas?: Array<{ modules?: Array<Record<string, unknown>> }>;
      };
    };
    if (
      !snapshot.inputs?.modules?.[0] ||
      !snapshot.outputs?.pergolas?.[0]?.modules?.[0]
    ) {
      throw new Error("Expected fixture snapshot modules.");
    }
    snapshot.inputs.modules[0].pergolaStyle = "hip";
    snapshot.outputs.pergolas[0].modules[0].derived = {
      ...(snapshot.outputs.pergolas[0].modules[0].derived ?? {}),
      length_m: null,
      projection_m: null,
    };

    const geometryPreview = buildWorkbenchGeometryPreview({
      projectId: "proj_preview",
      estimateId: fixture.estimate.id,
      snapshot,
      moduleIndex: 0,
    });

    const rendered = renderIntoDocument(
      <Geometry3DViewport geometryPreview={geometryPreview} />,
    );

    expect(rendered.container.textContent).toContain("3D Preview Unsupported");
    expect(rendered.container.textContent).toContain(
      "not supported by Sanctuary geometry V1",
    );
    expect(rendered.container.textContent).not.toContain("Inspection");
    expect(rendered.container.textContent).not.toContain("Focus selection");
    expect(
      rendered.container.querySelector('[data-testid="geometry-3d-canvas"]'),
    ).toBeNull();

    rendered.unmount();
  });

  it("renders real gable acrylic slabs and joiners instead of the roof-plane fallback", async () => {
    const fixture = requireFixture("gable-standard");
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft?.inputs.modules[0]) {
      throw new Error("Expected draft geometry module.");
    }
    const acrylic = applyGeometryEditIntent({
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: "roof_material",
        value: "acrylic",
      },
    });
    expect(acrylic.ok).toBe(true);
    if (!acrylic.ok) {
      return;
    }

    const geometryPreview = buildWorkbenchGeometryPreview({
      projectId: "proj_preview",
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft: acrylic.draft,
      moduleIndex: 0,
    });

    expect(geometryPreview.kind).toBe("ready");
    if (geometryPreview.kind !== "ready") {
      return;
    }

    const rendered = renderIntoDocument(
      <Geometry3DViewport geometryPreview={geometryPreview} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-house-joiner-1"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-outer-joiner-1"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-house-acrylic-panel-1"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-outer-acrylic-panel-1"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-testid="scene-object-ridge-flashing"]',
      ),
    ).not.toBeNull();

    clickButtonByText(rendered.container, "Workspace panel");

    clickSceneObject(rendered.container, "house-joiner-1");
    expect(rendered.container.textContent).toContain("house-joiner-1");
    expect(rendered.container.textContent).toContain("sp_joiners");
    expect(rendered.container.textContent).toContain("outline extrusion");

    clickSceneObject(rendered.container, "outer-acrylic-panel-1");
    expect(rendered.container.textContent).toContain("outer-acrylic-panel-1");
    expect(rendered.container.textContent).toContain("Thickness");
    expect(rendered.container.textContent).toContain("6 mm");
    expect(rendered.container.textContent).toContain("Gutter embed");
    expect(rendered.container.textContent).toContain("15 mm");

    clickSceneObject(rendered.container, "ridge-flashing");
    expect(rendered.container.textContent).toContain("ridge-flashing");
    expect(rendered.container.textContent).toContain("roof flashing");
    expect(rendered.container.textContent).toContain("Girth");
    expect(rendered.container.textContent).toContain("300 mm");

    rendered.unmount();
  });
});
