'use client';

import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type {
  Point3,
  ViewerSceneMemberPrismObject,
  ViewerSceneModel,
  ViewerSceneObject,
  ViewerSceneReferenceLineObject,
  ViewerSceneReferencePlaneObject,
  ViewerSceneRoofPlaneObject,
} from '@sp/geometry';
import type { GeometryPreviewState } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import styles from './Geometry3DViewport.module.css';

type SceneBounds = {
  min: Point3;
  max: Point3;
  center: Point3;
  size: number;
};

type SectionCutState = {
  enabled: boolean;
  positionMm: number;
};

type OverlayVisibility = {
  datumAxes: boolean;
  roofFallVectors: boolean;
  selectedMemberAxes: boolean;
};

const LAYER_COLORS: Record<string, string> = {
  house: '#b0b4b9',
  posts: '#7b6347',
  beams: '#4f5965',
  rafters: '#96979b',
  gutters: '#437da8',
  roof_planes: '#d4b35a',
  attachment_edge: '#bb4b4b',
};

function linePoints(line: { start: Point3; end: Point3 }): Point3[] {
  return [line.start, line.end];
}

function collectScenePoints(scene: ViewerSceneModel): Point3[] {
  return scene.layers.flatMap((layer) =>
    layer.objects.flatMap((object) => {
      if (object.type === 'member_prism') return linePoints(object.centerline);
      if (object.type === 'roof_plane') return object.boundary;
      if (object.type === 'reference_line') return linePoints(object.line);
      return object.boundary;
    }),
  );
}

function computeSceneBounds(scene: ViewerSceneModel): SceneBounds {
  const points = collectScenePoints(scene);
  if (points.length === 0) {
    return {
      min: { x: -500, y: -500, z: 0 },
      max: { x: 500, y: 500, z: 1000 },
      center: { x: 0, y: 0, z: 500 },
      size: 2000,
    };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const zs = points.map((point) => point.z);
  const min = { x: Math.min(...xs), y: Math.min(...ys), z: Math.min(...zs) };
  const max = { x: Math.max(...xs), y: Math.max(...ys), z: Math.max(...zs) };
  const center = {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  };

  return {
    min,
    max,
    center,
    size: Math.max(max.x - min.x, max.y - min.y, max.z - min.z, 1000),
  };
}

function buildLineGeometry(points: Point3[]): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(point.x, point.y, point.z)));
}

function buildPolygonGeometry(points: Point3[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  if (points.length < 3) {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    return geometry;
  }

  const positions: number[] = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = points[0]!;
    const b = points[index]!;
    const c = points[index + 1]!;
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildClosedLineGeometry(points: Point3[]): THREE.BufferGeometry {
  if (points.length === 0) {
    return new THREE.BufferGeometry();
  }
  return buildLineGeometry([...points, points[0]!]);
}

function pointToVector(point: Point3): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function vectorToPoint(vector: THREE.Vector3): Point3 {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

function formatVector(vector: { x: number; y: number; z: number }): string {
  return `${vector.x.toFixed(3)}, ${vector.y.toFixed(3)}, ${vector.z.toFixed(3)}`;
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

function offsetPoint(origin: Point3, direction: { x: number; y: number; z: number }, distance: number): Point3 {
  const vector = pointToVector(origin).add(new THREE.Vector3(direction.x, direction.y, direction.z).multiplyScalar(distance));
  return vectorToPoint(vector);
}

function formatPoint(point: Point3): string {
  return `${Math.round(point.x)}, ${Math.round(point.y)}, ${Math.round(point.z)} mm`;
}

function formatMetadata(metadata: ViewerSceneObject['metadata']): string {
  if (!metadata) return 'None';
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}

function objectSummary(object: ViewerSceneObject | null): Array<{ label: string; value: string }> {
  if (!object) {
    return [{ label: 'Selection', value: 'None' }];
  }

  if (object.type === 'member_prism') {
    return [
      { label: 'Object', value: object.id },
      { label: 'Role', value: object.role },
      { label: 'Length', value: `${object.lengthMm} mm` },
      { label: 'Profile', value: `${object.profile.widthMm} x ${object.profile.depthMm} mm` },
      { label: 'Start', value: formatPoint(object.centerline.start) },
      { label: 'End', value: formatPoint(object.centerline.end) },
      { label: 'Local X Axis', value: formatVector(object.localFrame.xAxis) },
      { label: 'Local Y Axis', value: formatVector(object.localFrame.yAxis) },
      { label: 'Local Z Axis', value: formatVector(object.localFrame.zAxis) },
      { label: 'Metadata', value: formatMetadata(object.metadata) },
    ];
  }

  if (object.type === 'roof_plane') {
    return [
      { label: 'Object', value: object.id },
      { label: 'Type', value: 'roof plane' },
      { label: 'Boundary', value: `${object.boundary.length} points` },
      { label: 'Plane origin', value: formatPoint(object.plane.origin) },
      { label: 'Plane normal', value: formatVector(object.plane.normal) },
      { label: 'Fall vector', value: `${object.fallVector.x.toFixed(3)}, ${object.fallVector.y.toFixed(3)}, ${object.fallVector.z.toFixed(3)}` },
      { label: 'Metadata', value: formatMetadata(object.metadata) },
    ];
  }

  if (object.type === 'reference_line') {
    return [
      { label: 'Object', value: object.id },
      { label: 'Type', value: object.kind.replace(/_/g, ' ') },
      { label: 'Start', value: formatPoint(object.line.start) },
      { label: 'End', value: formatPoint(object.line.end) },
      { label: 'Metadata', value: formatMetadata(object.metadata) },
    ];
  }

  return [
    { label: 'Object', value: object.id },
    { label: 'Type', value: object.kind.replace(/_/g, ' ') },
    { label: 'Boundary', value: `${object.boundary.length} points` },
    { label: 'Metadata', value: formatMetadata(object.metadata) },
  ];
}

function MemberObject({
  object,
  color,
  onSelect,
  clippingPlanes,
}: {
  object: ViewerSceneMemberPrismObject;
  color: string;
  onSelect: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const midpoint = useMemo(
    () => ({
      x: (object.centerline.start.x + object.centerline.end.x) / 2,
      y: (object.centerline.start.y + object.centerline.end.y) / 2,
      z: (object.centerline.start.z + object.centerline.end.z) / 2,
    }),
    [object.centerline.end.x, object.centerline.end.y, object.centerline.end.z, object.centerline.start.x, object.centerline.start.y, object.centerline.start.z],
  );
  const matrix = useMemo(() => {
    const xAxis = new THREE.Vector3(
      object.centerline.end.x - object.centerline.start.x,
      object.centerline.end.y - object.centerline.start.y,
      object.centerline.end.z - object.centerline.start.z,
    ).normalize();
    const yAxis = new THREE.Vector3(object.localFrame.yAxis.x, object.localFrame.yAxis.y, object.localFrame.yAxis.z).normalize();
    const zAxis = new THREE.Vector3(object.localFrame.zAxis.x, object.localFrame.zAxis.y, object.localFrame.zAxis.z).normalize();
    const next = new THREE.Matrix4();
    next.makeBasis(xAxis, yAxis, zAxis);
    next.setPosition(midpoint.x, midpoint.y, midpoint.z);
    return next;
  }, [
    midpoint.x,
    midpoint.y,
    midpoint.z,
    object.centerline.end.x,
    object.centerline.end.y,
    object.centerline.end.z,
    object.centerline.start.x,
    object.centerline.start.y,
    object.centerline.start.z,
    object.localFrame.yAxis.x,
    object.localFrame.yAxis.y,
    object.localFrame.yAxis.z,
    object.localFrame.zAxis.x,
    object.localFrame.zAxis.y,
    object.localFrame.zAxis.z,
  ]);
  const lineGeometry = useMemo(() => buildLineGeometry(linePoints(object.centerline)), [object.centerline]);

  if (object.renderMode === 'line_fallback') {
    return (
      <line
        data-testid={`scene-object-${object.id}`}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(object.id);
        }}
      >
        <primitive attach="geometry" object={lineGeometry} />
        <lineBasicMaterial color={color} clippingPlanes={clippingPlanes} />
      </line>
    );
  }

  return (
    <mesh
      data-testid={`scene-object-${object.id}`}
      matrixAutoUpdate={false}
      matrix={matrix}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
    >
      <boxGeometry args={[Math.max(object.lengthMm, 1), object.profile.widthMm, object.profile.depthMm]} />
      <meshStandardMaterial color={color} clippingPlanes={clippingPlanes} />
    </mesh>
  );
}

function RoofPlaneObject({
  object,
  color,
  onSelect,
  clippingPlanes,
}: {
  object: ViewerSceneRoofPlaneObject;
  color: string;
  onSelect: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(() => buildPolygonGeometry(object.boundary), [object.boundary]);
  return (
    <mesh
      data-testid={`scene-object-${object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
    >
      <primitive attach="geometry" object={geometry} />
      <meshStandardMaterial color={color} transparent opacity={0.45} side={THREE.DoubleSide} clippingPlanes={clippingPlanes} />
    </mesh>
  );
}

function ReferenceLineObject({
  object,
  color,
  onSelect,
  clippingPlanes,
}: {
  object: ViewerSceneReferenceLineObject;
  color: string;
  onSelect: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(() => buildLineGeometry(linePoints(object.line)), [object.line]);
  return (
    <line
      data-testid={`scene-object-${object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
    >
      <primitive attach="geometry" object={geometry} />
      <lineBasicMaterial color={color} clippingPlanes={clippingPlanes} />
    </line>
  );
}

function ReferencePlaneObject({
  object,
  color,
  onSelect,
  clippingPlanes,
}: {
  object: ViewerSceneReferencePlaneObject;
  color: string;
  onSelect: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  const geometry = useMemo(() => buildPolygonGeometry(object.boundary), [object.boundary]);
  return (
    <mesh
      data-testid={`scene-object-${object.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(object.id);
      }}
    >
      <primitive attach="geometry" object={geometry} />
      <meshStandardMaterial color={color} transparent opacity={0.12} side={THREE.DoubleSide} clippingPlanes={clippingPlanes} />
    </mesh>
  );
}

function SceneObjectNode({
  object,
  color,
  onSelect,
  clippingPlanes,
}: {
  object: ViewerSceneObject;
  color: string;
  onSelect: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  if (object.type === 'member_prism') {
    return <MemberObject object={object} color={color} onSelect={onSelect} clippingPlanes={clippingPlanes} />;
  }
  if (object.type === 'roof_plane') {
    return <RoofPlaneObject object={object} color={color} onSelect={onSelect} clippingPlanes={clippingPlanes} />;
  }
  if (object.type === 'reference_line') {
    return <ReferenceLineObject object={object} color={color} onSelect={onSelect} clippingPlanes={clippingPlanes} />;
  }
  return <ReferencePlaneObject object={object} color={color} onSelect={onSelect} clippingPlanes={clippingPlanes} />;
}

function ArrowOverlay({
  testId,
  start,
  end,
  color,
}: {
  testId: string;
  start: Point3;
  end: Point3;
  color: string;
}) {
  const geometries = useMemo(() => {
    const startVector = pointToVector(start);
    const endVector = pointToVector(end);
    const direction = endVector.clone().sub(startVector);
    const length = direction.length();
    if (length === 0) {
      return {
        shaft: buildLineGeometry([start, end]),
        headA: buildLineGeometry([end, end]),
        headB: buildLineGeometry([end, end]),
      };
    }

    const normalizedDirection = direction.clone().normalize();
    const reference = Math.abs(normalizedDirection.z) < 0.9
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(normalizedDirection, reference).normalize();
    const headLength = Math.min(Math.max(length * 0.18, 80), 180);
    const headWidth = Math.min(Math.max(length * 0.08, 50), 120);
    const back = normalizedDirection.clone().multiplyScalar(-headLength);
    const left = endVector.clone().add(back).add(side.clone().multiplyScalar(headWidth));
    const right = endVector.clone().add(back).add(side.clone().multiplyScalar(-headWidth));

    return {
      shaft: buildLineGeometry([start, end]),
      headA: buildLineGeometry([vectorToPoint(left), end]),
      headB: buildLineGeometry([vectorToPoint(right), end]),
    };
  }, [end, start]);

  return (
    <group data-testid={testId}>
      <line>
        <primitive attach="geometry" object={geometries.shaft} />
        <lineBasicMaterial color={color} />
      </line>
      <line>
        <primitive attach="geometry" object={geometries.headA} />
        <lineBasicMaterial color={color} />
      </line>
      <line>
        <primitive attach="geometry" object={geometries.headB} />
        <lineBasicMaterial color={color} />
      </line>
    </group>
  );
}

function SectionCutHint({
  boundary,
}: {
  boundary: Point3[];
}) {
  const planeGeometry = useMemo(() => buildPolygonGeometry(boundary), [boundary]);
  const outlineGeometry = useMemo(() => buildClosedLineGeometry(boundary), [boundary]);

  return (
    <group data-testid="section-cut-hint">
      <mesh data-testid="section-cut-plane">
        <primitive attach="geometry" object={planeGeometry} />
        <meshStandardMaterial color="#7da3d1" transparent opacity={0.14} side={THREE.DoubleSide} />
      </mesh>
      <line data-testid="section-cut-outline">
        <primitive attach="geometry" object={outlineGeometry} />
        <lineBasicMaterial color="#4673b5" />
      </line>
    </group>
  );
}

export default function Geometry3DViewport({
  geometryPreview,
}: {
  geometryPreview?: GeometryPreviewState | null;
}) {
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const [sectionCut, setSectionCut] = useState<SectionCutState>({ enabled: false, positionMm: 0 });
  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>({
    datumAxes: false,
    roofFallVectors: false,
    selectedMemberAxes: false,
  });

  const scene = geometryPreview?.kind === 'ready' ? geometryPreview.scene : null;
  const sceneBounds = useMemo(() => (scene ? computeSceneBounds(scene) : null), [scene]);
  const allObjects = useMemo(() => scene?.layers.flatMap((layer) => layer.objects) ?? [], [scene]);
  const selectedObject = useMemo(
    () => allObjects.find((object) => object.id === selectedObjectId) ?? null,
    [allObjects, selectedObjectId],
  );
  const selectedMember = selectedObject?.type === 'member_prism' ? selectedObject : null;
  const lengthMm = geometryPreview?.kind === 'ready' ? geometryPreview.config.dimensions.lengthMm : 0;
  const camera = useMemo(() => {
    if (!sceneBounds) {
      return { position: [1800, -1800, 1400] as [number, number, number], near: 1, far: 40000, fov: 40 };
    }

    return {
      position: [
        sceneBounds.center.x + sceneBounds.size * 1.3,
        sceneBounds.center.y - sceneBounds.size * 1.5,
        sceneBounds.center.z + sceneBounds.size * 1.1,
      ] as [number, number, number],
      near: 1,
      far: Math.max(sceneBounds.size * 10, 40000),
      fov: 40,
    };
  }, [sceneBounds]);

  useEffect(() => {
    if (!scene) {
      setLayerVisibility({});
      setSelectedObjectId(null);
      setSectionCut({ enabled: false, positionMm: 0 });
      setOverlayVisibility({
        datumAxes: false,
        roofFallVectors: false,
        selectedMemberAxes: false,
      });
      return;
    }
    setLayerVisibility(Object.fromEntries(scene.layers.map((layer) => [layer.id, layer.visibleByDefault])));
    setSelectedObjectId(null);
    setSectionCut({ enabled: false, positionMm: Math.round(lengthMm / 2) });
    setOverlayVisibility({
      datumAxes: false,
      roofFallVectors: false,
      selectedMemberAxes: false,
    });
    setCanvasKey((current) => current + 1);
  }, [lengthMm, scene]);

  const clippingPlanes = useMemo(
    () =>
      sectionCut.enabled
        ? [new THREE.Plane(new THREE.Vector3(-1, 0, 0), sectionCut.positionMm)]
        : [],
    [sectionCut.enabled, sectionCut.positionMm],
  );
  const sectionCutBoundary = useMemo(() => {
    if (!sceneBounds || !sectionCut.enabled) return null;
    const padding = Math.max(sceneBounds.size * 0.06, 200);
    const yMin = sceneBounds.min.y - padding;
    const yMax = sceneBounds.max.y + padding;
    const zMin = sceneBounds.min.z - padding;
    const zMax = sceneBounds.max.z + padding;
    const x = sectionCut.positionMm;
    return [
      { x, y: yMin, z: zMin },
      { x, y: yMax, z: zMin },
      { x, y: yMax, z: zMax },
      { x, y: yMin, z: zMax },
    ];
  }, [sceneBounds, sectionCut.enabled, sectionCut.positionMm]);
  const datumAxisLength = useMemo(
    () => (sceneBounds ? Math.min(Math.max(sceneBounds.size * 0.18, 450), 1400) : 800),
    [sceneBounds],
  );
  const roofFallVectorLength = useMemo(
    () => (sceneBounds ? Math.min(Math.max(sceneBounds.size * 0.12, 280), 900) : 450),
    [sceneBounds],
  );
  const selectedAxisLength = useMemo(
    () => (sceneBounds ? Math.min(Math.max(sceneBounds.size * 0.08, 220), 700) : 320),
    [sceneBounds],
  );

  if (!geometryPreview) {
    return (
      <section className={styles.state} aria-label="3D geometry viewport unavailable">
        <h3 className={styles.stateTitle}>3D View Unavailable</h3>
        <p className={styles.stateText}>This workbench context did not provide a geometry preview.</p>
      </section>
    );
  }

  if (geometryPreview.kind === 'error') {
    return (
      <section className={styles.state} aria-label="3D geometry viewport error">
        <h3 className={styles.stateTitle}>3D Preview Error</h3>
        <p className={styles.stateText}>{geometryPreview.message}</p>
      </section>
    );
  }

  if (geometryPreview.kind === 'unsupported') {
    return (
      <section className={styles.state} aria-label="3D geometry viewport unsupported">
        <h3 className={styles.stateTitle}>3D Preview Unsupported</h3>
        <p className={styles.stateText}>{geometryPreview.message}</p>
        <p className={styles.stateMeta}>Preview mode: {geometryPreview.previewMode === 'snapshot_validated' ? 'Snapshot validated' : 'Best-effort draft'}</p>
        {geometryPreview.validation ? (
          <p className={styles.stateMeta}>
            Validation: {geometryPreview.validation.status}
            {geometryPreview.validation.unsupportedReasons.length ? ` · ${geometryPreview.validation.unsupportedReasons.join(' | ')}` : ''}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className={styles.viewport} aria-label="3D geometry verification viewport">
      <aside className={styles.sidebar}>
        <div className={styles.panel}>
          <p className={styles.eyebrow}>3D Verification</p>
          <h3 className={styles.heading}>
            {geometryPreview.previewMode === 'snapshot_validated' ? 'Snapshot Validated' : 'Best-Effort Draft Preview'}
          </h3>
          <p className={styles.meta}>Kernel validation: {geometryPreview.validation.status}</p>
          <p className={styles.meta}>Family: {geometryPreview.config.family}</p>
        </div>

        <div className={styles.panel}>
          <p className={styles.eyebrow}>Layers</p>
          <div className={styles.layerList}>
            {geometryPreview.scene.layers.map((layer) => (
              <label key={layer.id} className={styles.layerItem}>
                <input
                  type="checkbox"
                  checked={Boolean(layerVisibility[layer.id])}
                  onChange={(event) =>
                    setLayerVisibility((current) => ({
                      ...current,
                      [layer.id]: event.target.checked,
                    }))
                  }
                />
                <span>{layer.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.panel} data-testid="inspection-panel">
          <p className={styles.eyebrow}>Inspection</p>
          <div className={styles.sectionBlock}>
            <label className={styles.layerItem}>
              <input
                type="checkbox"
                checked={sectionCut.enabled}
                onChange={(event) =>
                  setSectionCut((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
              />
              <span>Section cut</span>
            </label>
            <label className={styles.sliderField}>
              <span className={styles.sliderLabel}>Section position (mm)</span>
              <input
                data-testid="section-cut-slider"
                aria-label="Section position (mm)"
                type="range"
                min="0"
                max={String(lengthMm)}
                step="10"
                value={String(sectionCut.positionMm)}
                onChange={(event) =>
                  setSectionCut((current) => ({
                    ...current,
                    positionMm: Number(event.target.value),
                  }))
                }
              />
            </label>
            <div className={styles.sectionMetaRow}>
              <p className={styles.meta}>Cut X: {Math.round(sectionCut.positionMm)} mm</p>
              <button
                type="button"
                className={styles.resetButton}
                onClick={() =>
                  setSectionCut((current) => ({
                    ...current,
                    positionMm: Math.round(lengthMm / 2),
                  }))
                }
              >
                Center
              </button>
            </div>
          </div>

          <div className={styles.sectionBlock}>
            <p className={styles.eyebrow}>Debug Overlays</p>
            <div className={styles.layerList}>
              <label className={styles.layerItem}>
                <input
                  type="checkbox"
                  checked={overlayVisibility.datumAxes}
                  onChange={(event) =>
                    setOverlayVisibility((current) => ({
                      ...current,
                      datumAxes: event.target.checked,
                    }))
                  }
                />
                <span>Datum axes</span>
              </label>
              <label className={styles.layerItem}>
                <input
                  type="checkbox"
                  checked={overlayVisibility.roofFallVectors}
                  onChange={(event) =>
                    setOverlayVisibility((current) => ({
                      ...current,
                      roofFallVectors: event.target.checked,
                    }))
                  }
                />
                <span>Roof fall vectors</span>
              </label>
              <label className={styles.layerItem}>
                <input
                  type="checkbox"
                  checked={overlayVisibility.selectedMemberAxes}
                  onChange={(event) =>
                    setOverlayVisibility((current) => ({
                      ...current,
                      selectedMemberAxes: event.target.checked,
                    }))
                  }
                />
                <span>Selected member axes</span>
              </label>
            </div>
          </div>
        </div>

        <div className={styles.panel}>
          <p className={styles.eyebrow}>Inspector</p>
          <dl className={styles.inspectorList}>
            {sectionCut.enabled ? (
              <div className={styles.inspectorRow}>
                <dt>Section cut</dt>
                <dd>Active at X = {Math.round(sectionCut.positionMm)} mm</dd>
              </div>
            ) : null}
            {objectSummary(selectedObject).map((entry) => (
              <div key={entry.label} className={styles.inspectorRow}>
                <dt>{entry.label}</dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>

      <div className={styles.canvasShell} onClick={() => setSelectedObjectId(null)}>
        <div className={styles.canvasToolbar}>
          <button type="button" className={styles.resetButton} onClick={() => setCanvasKey((current) => current + 1)}>
            Fit to scene
          </button>
        </div>
        <Canvas
          key={`${canvasKey}-${sectionCut.enabled ? 'clip' : 'noclip'}`}
          camera={camera}
          data-testid="geometry-3d-canvas"
          onCreated={({ gl }) => {
            gl.localClippingEnabled = sectionCut.enabled;
          }}
        >
          <color attach="background" args={['#f4f1ea']} />
          <ambientLight intensity={0.85} />
          <directionalLight position={[1, -1, 1.5]} intensity={1.1} />
          {sectionCutBoundary ? <SectionCutHint boundary={sectionCutBoundary} /> : null}
          {overlayVisibility.datumAxes ? (
            <group data-testid="datum-axes">
              <ArrowOverlay
                testId="datum-axis-x"
                start={geometryPreview.assembly.datum.origin}
                end={offsetPoint(geometryPreview.assembly.datum.origin, geometryPreview.assembly.datum.xAxis, datumAxisLength)}
                color="#c44141"
              />
              <ArrowOverlay
                testId="datum-axis-y"
                start={geometryPreview.assembly.datum.origin}
                end={offsetPoint(geometryPreview.assembly.datum.origin, geometryPreview.assembly.datum.yAxis, datumAxisLength)}
                color="#2e8f4f"
              />
              <ArrowOverlay
                testId="datum-axis-z"
                start={geometryPreview.assembly.datum.origin}
                end={offsetPoint(geometryPreview.assembly.datum.origin, geometryPreview.assembly.datum.zAxis, datumAxisLength)}
                color="#3d67ba"
              />
            </group>
          ) : null}
          {overlayVisibility.roofFallVectors
            ? geometryPreview.assembly.roofPlanes.map((roofPlane) => {
                const start = centroid(roofPlane.boundary);
                const normalizedFall = pointToVector({
                  x: roofPlane.fallVector.x,
                  y: roofPlane.fallVector.y,
                  z: roofPlane.fallVector.z,
                }).normalize();
                const end = vectorToPoint(pointToVector(start).add(normalizedFall.multiplyScalar(roofFallVectorLength)));
                return (
                  <ArrowOverlay
                    key={roofPlane.id}
                    testId={`roof-fall-vector-${roofPlane.id}`}
                    start={start}
                    end={end}
                    color="#c28a1e"
                  />
                );
              })
            : null}
          {overlayVisibility.selectedMemberAxes && selectedMember ? (
            <group data-testid="selected-member-axes">
              <ArrowOverlay
                testId="selected-member-axis-x"
                start={selectedMember.localFrame.origin}
                end={offsetPoint(selectedMember.localFrame.origin, selectedMember.localFrame.xAxis, selectedAxisLength)}
                color="#c44141"
              />
              <ArrowOverlay
                testId="selected-member-axis-y"
                start={selectedMember.localFrame.origin}
                end={offsetPoint(selectedMember.localFrame.origin, selectedMember.localFrame.yAxis, selectedAxisLength)}
                color="#2e8f4f"
              />
              <ArrowOverlay
                testId="selected-member-axis-z"
                start={selectedMember.localFrame.origin}
                end={offsetPoint(selectedMember.localFrame.origin, selectedMember.localFrame.zAxis, selectedAxisLength)}
                color="#3d67ba"
              />
            </group>
          ) : null}
          {geometryPreview.scene.layers.flatMap((layer) =>
            layerVisibility[layer.id] !== false
              ? layer.objects.map((object) => (
                  <SceneObjectNode
                    key={object.id}
                    object={object}
                    color={LAYER_COLORS[layer.id] ?? '#6c7a86'}
                    onSelect={setSelectedObjectId}
                    clippingPlanes={clippingPlanes}
                  />
                ))
              : [],
          )}
          <OrbitControls makeDefault enablePan enableRotate enableZoom />
        </Canvas>
      </div>
    </section>
  );
}
