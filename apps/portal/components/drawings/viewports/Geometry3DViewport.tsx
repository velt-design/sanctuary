'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type {
  Point3,
  ViewerSceneMemberPrismObject,
  ViewerSceneModel,
  ViewerSceneObject,
  ViewerSceneReferenceLineObject,
  ViewerSceneReferencePlaneObject,
  ViewerSceneRoofCladdingPanelObject,
  ViewerSceneRoofPlaneObject,
} from '@sp/geometry';
import type { GeometryPreviewMode, GeometryPreviewState } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
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

type MeasurementAnchorType = 'start' | 'midpoint' | 'end' | 'centroid' | 'datum_origin';

type MeasurementAnchor = {
  id: string;
  objectId: string | 'datum-origin';
  anchorType: MeasurementAnchorType;
  point: Point3;
};

type MeasurementState = {
  enabled: boolean;
  firstAnchor: MeasurementAnchor | null;
  secondAnchor: MeasurementAnchor | null;
  snapMode: 'selection' | 'datum';
  lastEditedSlot: 'a' | 'b';
};

type GeometryCameraPreset = 'iso' | 'front' | 'right' | 'top' | 'custom';

type GeometryCameraFocusMode = 'scene' | 'selection' | 'manual';

type GeometryCameraState = {
  position: Point3;
  target: Point3;
  distanceMm: number;
  viewPreset: GeometryCameraPreset;
  focusMode: GeometryCameraFocusMode;
};

const LAYER_COLORS: Record<string, string> = {
  house: '#b0b4b9',
  posts: '#7b6347',
  beams: '#4f5965',
  rafters: '#96979b',
  joiners: '#8d7b56',
  gutters: '#437da8',
  roof_cladding: '#d9c77b',
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
      if (object.type === 'roof_plane' || object.type === 'roof_cladding_panel') return object.boundary;
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

function formatCameraFocusMode(focusMode: GeometryCameraFocusMode): string {
  if (focusMode === 'scene') return 'Scene';
  if (focusMode === 'selection') return 'Selected';
  return 'Manual';
}

function formatCameraPreset(viewPreset: GeometryCameraPreset): string {
  if (viewPreset === 'iso') return 'Iso';
  if (viewPreset === 'front') return 'Front';
  if (viewPreset === 'right') return 'Right';
  if (viewPreset === 'custom') return 'Custom';
  return 'Top';
}

function midpoint(start: Point3, end: Point3): Point3 {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    z: (start.z + end.z) / 2,
  };
}

function formatAnchorType(anchorType: MeasurementAnchorType): string {
  return anchorType === 'datum_origin' ? 'datum origin' : anchorType;
}

function boundingSize(points: Point3[]): number {
  if (points.length === 0) return 1000;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const zs = points.map((point) => point.z);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), Math.max(...zs) - Math.min(...zs), 1000);
}

function pointsForObject(object: ViewerSceneObject): Point3[] {
  if (object.type === 'member_prism') return linePoints(object.centerline);
  if (object.type === 'roof_plane' || object.type === 'roof_cladding_panel') return object.boundary;
  if (object.type === 'reference_line') return linePoints(object.line);
  return object.boundary;
}

function focusPointForObject(object: ViewerSceneObject): Point3 {
  if (object.type === 'member_prism') return midpoint(object.centerline.start, object.centerline.end);
  if (object.type === 'reference_line') return midpoint(object.line.start, object.line.end);
  return centroid(pointsForObject(object));
}

function supportsEndpointAnchors(object: ViewerSceneObject | null): object is ViewerSceneMemberPrismObject | ViewerSceneReferenceLineObject {
  return object?.type === 'member_prism' || object?.type === 'reference_line';
}

function resolveAnchorPoint(object: ViewerSceneObject, anchorType: MeasurementAnchorType): Point3 {
  if (object.type === 'member_prism') {
    if (anchorType === 'start') return object.centerline.start;
    if (anchorType === 'end') return object.centerline.end;
    return midpoint(object.centerline.start, object.centerline.end);
  }

  if (object.type === 'reference_line') {
    if (anchorType === 'start') return object.line.start;
    if (anchorType === 'end') return object.line.end;
    return midpoint(object.line.start, object.line.end);
  }

  return centroid(pointsForObject(object));
}

function defaultAnchorTypeForObject(object: ViewerSceneObject): MeasurementAnchorType {
  if (object.type === 'member_prism' || object.type === 'reference_line') return 'midpoint';
  return 'centroid';
}

function buildMeasurementAnchor(object: ViewerSceneObject, anchorType = defaultAnchorTypeForObject(object)): MeasurementAnchor {
  return {
    id: `${object.id}:${anchorType}`,
    objectId: object.id,
    anchorType,
    point: resolveAnchorPoint(object, anchorType),
  };
}

function buildDatumOriginAnchor(point: Point3): MeasurementAnchor {
  return {
    id: 'datum-origin',
    objectId: 'datum-origin',
    anchorType: 'datum_origin',
    point,
  };
}

function formatDistanceMm(distanceMm: number): string {
  return `${Math.round(distanceMm)} mm`;
}

function measurementDelta(a: Point3 | null, b: Point3 | null): Point3 | null {
  if (!a || !b) return null;
  return {
    x: b.x - a.x,
    y: b.y - a.y,
    z: b.z - a.z,
  };
}

function measurementDistance(a: Point3 | null, b: Point3 | null): number | null {
  if (!a || !b) return null;
  return pointDistance(a, b);
}

function measurementPlanDistance(a: Point3 | null, b: Point3 | null): number | null {
  const delta = measurementDelta(a, b);
  if (!delta) return null;
  return Math.sqrt(delta.x * delta.x + delta.y * delta.y);
}

function fitDistanceForSize(size: number, fovDeg = 40): number {
  const radius = Math.max(size, 1000) / 2;
  const fovRadians = THREE.MathUtils.degToRad(fovDeg / 2);
  return Math.max((radius / Math.tan(fovRadians)) * 1.25, 1200);
}

function directionForPreset(viewPreset: GeometryCameraPreset): THREE.Vector3 {
  if (viewPreset === 'front') return new THREE.Vector3(0, -1, 0.28).normalize();
  if (viewPreset === 'right') return new THREE.Vector3(1, 0, 0.28).normalize();
  if (viewPreset === 'top') return new THREE.Vector3(0.06, -0.06, 1).normalize();
  return new THREE.Vector3(1, -1.15, 0.82).normalize();
}

function pointDistance(a: Point3, b: Point3): number {
  return pointToVector(a).distanceTo(pointToVector(b));
}

function pointsRoughlyEqual(a: Point3, b: Point3, toleranceMm: number): boolean {
  return pointDistance(a, b) <= toleranceMm;
}

function positionFromDirection(target: Point3, direction: THREE.Vector3, distanceMm: number): Point3 {
  const next = pointToVector(target).add(direction.clone().multiplyScalar(distanceMm));
  return vectorToPoint(next);
}

function directionFromCameraState(state: GeometryCameraState): THREE.Vector3 {
  const direction = pointToVector(state.position).sub(pointToVector(state.target));
  if (direction.lengthSq() < 1e-6) {
    const fallbackPreset = state.viewPreset === 'custom' ? 'iso' : state.viewPreset;
    return directionForPreset(fallbackPreset);
  }
  return direction.normalize();
}

function buildPresetCameraState({
  target,
  distanceMm,
  viewPreset,
  focusMode,
}: {
  target: Point3;
  distanceMm: number;
  viewPreset: Exclude<GeometryCameraPreset, 'custom'>;
  focusMode: GeometryCameraFocusMode;
}): GeometryCameraState {
  const direction = directionForPreset(viewPreset);
  return {
    position: positionFromDirection(target, direction, distanceMm),
    target,
    distanceMm,
    viewPreset,
    focusMode,
  };
}

function formatMetadata(metadata: ViewerSceneObject['metadata']): string {
  if (!metadata) return 'None';
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}

function previewModeLabel(previewMode: GeometryPreviewMode): string {
  return previewMode === 'snapshot_validated' ? 'Snapshot Validated' : 'Draft Resolved Locally';
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

  if (object.type === 'roof_cladding_panel') {
    return [
      { label: 'Object', value: object.id },
      { label: 'Type', value: 'roof cladding panel' },
      { label: 'Material', value: object.material },
      { label: 'Boundary', value: `${object.boundary.length} points` },
      {
        label: 'Panel area',
        value: `${Math.round(Number(object.metadata?.areaMm2 ?? 0)).toLocaleString()} mm²`,
      },
      { label: 'Plane origin', value: formatPoint(object.plane.origin) },
      { label: 'Plane normal', value: formatVector(object.plane.normal) },
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
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneMemberPrismObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
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
        onDoubleClick={(event) => {
          event.stopPropagation();
          onFocus(object.id);
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
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
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
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneRoofPlaneObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
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
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
    >
      <primitive attach="geometry" object={geometry} />
      <meshStandardMaterial color={color} transparent opacity={0.45} side={THREE.DoubleSide} clippingPlanes={clippingPlanes} />
    </mesh>
  );
}

function RoofCladdingPanelObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneRoofCladdingPanelObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
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
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
      }}
    >
      <primitive attach="geometry" object={geometry} />
      <meshStandardMaterial color={color} transparent opacity={0.52} side={THREE.DoubleSide} clippingPlanes={clippingPlanes} />
    </mesh>
  );
}

function ReferenceLineObject({
  object,
  color,
  onSelect,
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneReferenceLineObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
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
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
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
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneReferencePlaneObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
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
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocus(object.id);
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
  onFocus,
  clippingPlanes,
}: {
  object: ViewerSceneObject;
  color: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  clippingPlanes: THREE.Plane[];
}) {
  if (object.type === 'member_prism') {
    return <MemberObject object={object} color={color} onSelect={onSelect} onFocus={onFocus} clippingPlanes={clippingPlanes} />;
  }
  if (object.type === 'roof_plane') {
    return <RoofPlaneObject object={object} color={color} onSelect={onSelect} onFocus={onFocus} clippingPlanes={clippingPlanes} />;
  }
  if (object.type === 'roof_cladding_panel') {
    return <RoofCladdingPanelObject object={object} color={color} onSelect={onSelect} onFocus={onFocus} clippingPlanes={clippingPlanes} />;
  }
  if (object.type === 'reference_line') {
    return <ReferenceLineObject object={object} color={color} onSelect={onSelect} onFocus={onFocus} clippingPlanes={clippingPlanes} />;
  }
  return <ReferencePlaneObject object={object} color={color} onSelect={onSelect} onFocus={onFocus} clippingPlanes={clippingPlanes} />;
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

function MeasurementProbeOverlay({
  firstAnchor,
  secondAnchor,
  clippingPlanes,
  markerRadiusMm,
}: {
  firstAnchor: MeasurementAnchor | null;
  secondAnchor: MeasurementAnchor | null;
  clippingPlanes: THREE.Plane[];
  markerRadiusMm: number;
}) {
  const lineGeometry = useMemo(() => {
    if (!firstAnchor || !secondAnchor) return null;
    return buildLineGeometry([firstAnchor.point, secondAnchor.point]);
  }, [firstAnchor, secondAnchor]);

  const tickGeometries = useMemo(() => {
    if (!firstAnchor || !secondAnchor) return null;

    const start = pointToVector(firstAnchor.point);
    const end = pointToVector(secondAnchor.point);
    const direction = end.clone().sub(start);
    if (direction.lengthSq() < 1e-6) return null;

    const normalizedDirection = direction.normalize();
    const reference = Math.abs(normalizedDirection.z) < 0.9
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 1, 0);
    const tickDirection = new THREE.Vector3().crossVectors(normalizedDirection, reference).normalize();
    const tickHalfLength = Math.max(markerRadiusMm * 0.9, 22);

    const buildTick = (point: THREE.Vector3) =>
      buildLineGeometry([
        vectorToPoint(point.clone().add(tickDirection.clone().multiplyScalar(-tickHalfLength))),
        vectorToPoint(point.clone().add(tickDirection.clone().multiplyScalar(tickHalfLength))),
      ]);

    return {
      first: buildTick(start),
      second: buildTick(end),
    };
  }, [firstAnchor, secondAnchor, markerRadiusMm]);

  return (
    <group data-testid="measurement-probe-overlay">
      {firstAnchor ? (
        <mesh position={[firstAnchor.point.x, firstAnchor.point.y, firstAnchor.point.z]} data-testid="measurement-anchor-a">
          <sphereGeometry args={[markerRadiusMm, 18, 18]} />
          <meshStandardMaterial color="#c75656" clippingPlanes={clippingPlanes} />
        </mesh>
      ) : null}
      {secondAnchor ? (
        <mesh position={[secondAnchor.point.x, secondAnchor.point.y, secondAnchor.point.z]} data-testid="measurement-anchor-b">
          <sphereGeometry args={[markerRadiusMm, 18, 18]} />
          <meshStandardMaterial color="#3f7ec3" clippingPlanes={clippingPlanes} />
        </mesh>
      ) : null}
      {lineGeometry ? (
        <line data-testid="measurement-probe-line">
          <primitive attach="geometry" object={lineGeometry} />
          <lineBasicMaterial color="#2d302f" clippingPlanes={clippingPlanes} />
        </line>
      ) : null}
      {tickGeometries ? (
        <>
          <line data-testid="measurement-probe-tick-a">
            <primitive attach="geometry" object={tickGeometries.first} />
            <lineBasicMaterial color="#2d302f" clippingPlanes={clippingPlanes} />
          </line>
          <line data-testid="measurement-probe-tick-b">
            <primitive attach="geometry" object={tickGeometries.second} />
            <lineBasicMaterial color="#2d302f" clippingPlanes={clippingPlanes} />
          </line>
        </>
      ) : null}
    </group>
  );
}

export default function Geometry3DViewport({
  geometryPreview,
}: {
  geometryPreview?: GeometryPreviewState | null;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [sectionCut, setSectionCut] = useState<SectionCutState>({ enabled: false, positionMm: 0 });
  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>({
    datumAxes: false,
    roofFallVectors: false,
    selectedMemberAxes: false,
  });
  const [measurement, setMeasurement] = useState<MeasurementState>({
    enabled: false,
    firstAnchor: null,
    secondAnchor: null,
    snapMode: 'selection',
    lastEditedSlot: 'a',
  });
  const [cameraState, setCameraState] = useState<GeometryCameraState>(() =>
    buildPresetCameraState({
      target: { x: 0, y: 0, z: 500 },
      distanceMm: fitDistanceForSize(2000),
      viewPreset: 'iso',
      focusMode: 'scene',
    }),
  );
  const [cameraBindingVersion, setCameraBindingVersion] = useState(0);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const scene = geometryPreview?.kind === 'ready' ? geometryPreview.scene : null;
  const datumOrigin = geometryPreview?.kind === 'ready' ? geometryPreview.assembly.datum.origin : null;
  const sceneBounds = useMemo(() => (scene ? computeSceneBounds(scene) : null), [scene]);
  const allObjects = useMemo(() => scene?.layers.flatMap((layer) => layer.objects) ?? [], [scene]);
  const selectedObject = useMemo(
    () => allObjects.find((object) => object.id === selectedObjectId) ?? null,
    [allObjects, selectedObjectId],
  );
  const selectedMember = selectedObject?.type === 'member_prism' ? selectedObject : null;
  const selectedObjectSupportsAnchorSwitch = supportsEndpointAnchors(selectedObject);
  const lengthMm = geometryPreview?.kind === 'ready' ? geometryPreview.config.dimensions.lengthMm : 0;
  const sceneFitDistance = useMemo(() => (sceneBounds ? fitDistanceForSize(sceneBounds.size) : fitDistanceForSize(2000)), [sceneBounds]);
  const initialCamera = useMemo(() => {
    if (!sceneBounds) {
      return { position: [1800, -1800, 1400] as [number, number, number], near: 1, far: 40000, fov: 40 };
    }

    const seedState = buildPresetCameraState({
      target: sceneBounds.center,
      distanceMm: sceneFitDistance,
      viewPreset: 'iso',
      focusMode: 'scene',
    });
    const cameraPosition = seedState.position;
    return {
      position: [cameraPosition.x, cameraPosition.y, cameraPosition.z] as [number, number, number],
      near: 1,
      far: Math.max(sceneBounds.size * 10, 40000),
      fov: 40,
    };
  }, [sceneBounds, sceneFitDistance]);

  const applyCameraPose = useCallback(
    (nextState: GeometryCameraState) => {
      if (!sceneBounds || !cameraRef.current || !controlsRef.current) return;

      const camera = cameraRef.current;
      const controls = controlsRef.current;

      camera.up.set(0, 0, 1);
      camera.position.set(nextState.position.x, nextState.position.y, nextState.position.z);
      camera.near = 1;
      camera.far = Math.max(sceneBounds.size * 12, 40000);
      camera.lookAt(nextState.target.x, nextState.target.y, nextState.target.z);
      camera.updateProjectionMatrix();

      controls.target.set(nextState.target.x, nextState.target.y, nextState.target.z);
      controls.enableDamping = true;
      controls.dampingFactor = 0.12;
      controls.screenSpacePanning = true;
      controls.zoomToCursor = true;
      controls.rotateSpeed = 0.72;
      controls.panSpeed = 0.9;
      controls.zoomSpeed = 0.95;
      controls.minDistance = Math.max(sceneBounds.size * 0.18, 250);
      controls.maxDistance = Math.max(sceneBounds.size * 14, 14000);
      controls.minPolarAngle = 0.04;
      controls.maxPolarAngle = Math.PI - 0.08;
      controls.update();
      controls.saveState();
    },
    [sceneBounds],
  );

  const fitScene = useCallback(() => {
    if (!sceneBounds) return;
    setCameraState((current) => {
      const direction = directionFromCameraState(current);
      return {
        position: positionFromDirection(sceneBounds.center, direction, sceneFitDistance),
        target: sceneBounds.center,
        distanceMm: sceneFitDistance,
        viewPreset: current.viewPreset,
        focusMode: 'scene',
      };
    });
  }, [sceneBounds, sceneFitDistance]);

  const focusSelection = useCallback(
    (object: ViewerSceneObject | null) => {
      if (!object) return;
      const target = focusPointForObject(object);
      const objectDistance = fitDistanceForSize(boundingSize(pointsForObject(object)));
      setSelectedObjectId(object.id);
      setCameraState((current) => ({
        position: positionFromDirection(target, directionFromCameraState(current), objectDistance),
        target,
        distanceMm: objectDistance,
        viewPreset: current.viewPreset,
        focusMode: 'selection',
      }));
    },
    [],
  );

  const setViewPreset = useCallback((viewPreset: Exclude<GeometryCameraPreset, 'custom'>) => {
    setCameraState((current) => ({
      ...current,
      position: positionFromDirection(current.target, directionForPreset(viewPreset), current.distanceMm),
      viewPreset,
    }));
  }, []);

  const focusObjectById = useCallback(
    (id: string) => {
      const object = allObjects.find((entry) => entry.id === id) ?? null;
      focusSelection(object);
    },
    [allObjects, focusSelection],
  );
  const selectedFocusPoint = useMemo(() => (selectedObject ? focusPointForObject(selectedObject) : null), [selectedObject]);
  const measurementA = measurement.firstAnchor;
  const measurementB = measurement.secondAnchor;
  const measurementDeltaPoint = useMemo(() => measurementDelta(measurementA?.point ?? null, measurementB?.point ?? null), [measurementA?.point, measurementB?.point]);
  const measurementDistanceMm = useMemo(() => measurementDistance(measurementA?.point ?? null, measurementB?.point ?? null), [measurementA?.point, measurementB?.point]);
  const measurementPlanDistanceMm = useMemo(() => measurementPlanDistance(measurementA?.point ?? null, measurementB?.point ?? null), [measurementA?.point, measurementB?.point]);
  const measurementMarkerRadiusMm = useMemo(
    () => (sceneBounds ? Math.min(Math.max(sceneBounds.size * 0.012, 26), 72) : 36),
    [sceneBounds],
  );
  const focusToleranceMm = useMemo(
    () => (sceneBounds ? Math.max(sceneBounds.size * 0.001, 5) : 5),
    [sceneBounds],
  );

  const handleControlsRef = useCallback((controls: OrbitControlsImpl | null) => {
    if (controlsRef.current === controls) return;
    controlsRef.current = controls;
    setCameraBindingVersion((current) => current + 1);
  }, []);

  const handleCanvasCreated = useCallback(({ gl, camera }: { gl: THREE.WebGLRenderer; camera: THREE.Camera }) => {
    rendererRef.current = gl;
    cameraRef.current = camera as THREE.PerspectiveCamera;
    cameraRef.current.up.set(0, 0, 1);
    setCameraBindingVersion((current) => current + 1);
  }, []);

  const assignMeasurementAnchor = useCallback((anchor: MeasurementAnchor, snapMode: MeasurementState['snapMode']) => {
    setMeasurement((current) => {
      if (!current.firstAnchor) {
        return {
          ...current,
          firstAnchor: anchor,
          snapMode,
          lastEditedSlot: 'a',
        };
      }
      if (!current.secondAnchor) {
        return {
          ...current,
          secondAnchor: anchor,
          snapMode,
          lastEditedSlot: 'b',
        };
      }
      return {
        ...current,
        secondAnchor: anchor,
        snapMode,
        lastEditedSlot: 'b',
      };
    });
  }, []);

  const handleObjectSelect = useCallback(
    (id: string) => {
      setSelectedObjectId(id);
      if (!measurement.enabled) return;
      const object = allObjects.find((entry) => entry.id === id);
      if (!object) return;
      assignMeasurementAnchor(buildMeasurementAnchor(object), 'selection');
    },
    [allObjects, assignMeasurementAnchor, measurement.enabled],
  );

  const useDatumOriginAnchor = useCallback(() => {
    if (!datumOrigin) return;
    assignMeasurementAnchor(buildDatumOriginAnchor(datumOrigin), 'datum');
  }, [assignMeasurementAnchor, datumOrigin]);

  const switchSelectedAnchorType = useCallback(
    (anchorType: 'start' | 'midpoint' | 'end') => {
      if (!selectedObject || !supportsEndpointAnchors(selectedObject)) return;

      setMeasurement((current) => {
        const replaceSlot =
          current.lastEditedSlot === 'a' && current.firstAnchor?.objectId === selectedObject.id
            ? 'a'
            : current.lastEditedSlot === 'b' && current.secondAnchor?.objectId === selectedObject.id
              ? 'b'
              : current.secondAnchor?.objectId === selectedObject.id
                ? 'b'
                : current.firstAnchor?.objectId === selectedObject.id
                  ? 'a'
                  : null;

        if (!replaceSlot) return current;

        const nextAnchor = buildMeasurementAnchor(selectedObject, anchorType);
        return replaceSlot === 'a'
          ? {
              ...current,
              firstAnchor: nextAnchor,
              snapMode: 'selection',
              lastEditedSlot: 'a',
            }
          : {
              ...current,
              secondAnchor: nextAnchor,
              snapMode: 'selection',
              lastEditedSlot: 'b',
            };
      });
    },
    [selectedObject],
  );

  const selectedAnchorType = useMemo(() => {
    if (!selectedObject) return null;
    if (measurement.lastEditedSlot === 'a' && measurement.firstAnchor?.objectId === selectedObject.id) {
      return measurement.firstAnchor.anchorType;
    }
    if (measurement.lastEditedSlot === 'b' && measurement.secondAnchor?.objectId === selectedObject.id) {
      return measurement.secondAnchor.anchorType;
    }
    if (measurement.secondAnchor?.objectId === selectedObject.id) {
      return measurement.secondAnchor.anchorType;
    }
    if (measurement.firstAnchor?.objectId === selectedObject.id) {
      return measurement.firstAnchor.anchorType;
    }
    return null;
  }, [measurement.firstAnchor, measurement.lastEditedSlot, measurement.secondAnchor, selectedObject]);

  useEffect(() => {
    if (!scene) {
      setPanelOpen(false);
      setLayerVisibility({});
      setSelectedObjectId(null);
      setSectionCut({ enabled: false, positionMm: 0 });
      setOverlayVisibility({
        datumAxes: false,
        roofFallVectors: false,
        selectedMemberAxes: false,
      });
      setMeasurement({
        enabled: false,
        firstAnchor: null,
        secondAnchor: null,
        snapMode: 'selection',
        lastEditedSlot: 'a',
      });
      setCameraState(
        buildPresetCameraState({
          target: { x: 0, y: 0, z: 500 },
          distanceMm: fitDistanceForSize(2000),
          viewPreset: 'iso',
          focusMode: 'scene',
        }),
      );
      return;
    }
    setPanelOpen(false);
    setLayerVisibility(Object.fromEntries(scene.layers.map((layer) => [layer.id, layer.visibleByDefault])));
    setSelectedObjectId(null);
    setSectionCut({ enabled: false, positionMm: Math.round(lengthMm / 2) });
    setOverlayVisibility({
      datumAxes: false,
      roofFallVectors: false,
      selectedMemberAxes: false,
    });
    setMeasurement({
      enabled: false,
      firstAnchor: null,
      secondAnchor: null,
      snapMode: 'selection',
      lastEditedSlot: 'a',
    });
    setCameraState(
      buildPresetCameraState({
        target: sceneBounds?.center ?? { x: 0, y: 0, z: 500 },
        distanceMm: sceneFitDistance,
        viewPreset: 'iso',
        focusMode: 'scene',
      }),
    );
  }, [lengthMm, scene, sceneBounds, sceneFitDistance]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.localClippingEnabled = sectionCut.enabled;
    }
  }, [sectionCut.enabled]);

  useEffect(() => {
    applyCameraPose(cameraState);
  }, [applyCameraPose, cameraBindingVersion, cameraState]);

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
        <p className={styles.stateMeta}>Preview mode: {previewModeLabel(geometryPreview.previewMode)}</p>
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
      <div className={styles.canvasShell} onClick={() => setSelectedObjectId(null)}>
        <div
          className={styles.canvasToolbar}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <div className={styles.toolbarGroup}>
            <button
              type="button"
              className={panelOpen ? styles.activeToolbarButton : styles.resetButton}
              onClick={() => setPanelOpen((current) => !current)}
            >
              Workspace panel
            </button>
          </div>
          <div className={styles.toolbarSpacer} />
          <div className={styles.toolbarGroup}>
            <button type="button" className={styles.resetButton} onClick={fitScene}>
              Fit to scene
            </button>
            <button
              type="button"
              className={styles.resetButton}
              onClick={() => focusSelection(selectedObject)}
              disabled={!selectedObject}
            >
              Focus selection
            </button>
          </div>
          <div className={styles.toolbarGroup}>
            {cameraState.viewPreset === 'custom' ? (
              <span className={styles.activeToolbarButton}>Custom</span>
            ) : null}
            {(['iso', 'front', 'right', 'top'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                className={cameraState.viewPreset === preset ? styles.activeToolbarButton : styles.resetButton}
                onClick={() => setViewPreset(preset)}
              >
                {formatCameraPreset(preset)}
              </button>
            ))}
          </div>
        </div>

        {panelOpen ? (
          <aside
            className={styles.workspacePanel}
            data-testid="workspace-panel"
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <div className={styles.workspacePanelContent}>
              <div className={styles.workspacePanelHeader}>
                <p className={styles.workspacePanelTitle}>Workspace Panel</p>
                <button type="button" className={styles.resetButton} onClick={() => setPanelOpen(false)}>
                  Close
                </button>
              </div>

              <div className={styles.panel}>
          <p className={styles.eyebrow}>3D Verification</p>
          <h3 className={styles.heading}>{previewModeLabel(geometryPreview.previewMode)}</h3>
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

          <div className={styles.sectionBlock} data-testid="measurement-panel">
            <p className={styles.eyebrow}>Measurement</p>
            <label className={styles.layerItem}>
              <input
                type="checkbox"
                checked={measurement.enabled}
                onChange={(event) =>
                  setMeasurement((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
              />
              <span>Enable measurement</span>
            </label>
            <div className={styles.buttonRow}>
              <button
                type="button"
                className={styles.resetButton}
                onClick={() =>
                  setMeasurement((current) => ({
                    ...current,
                    firstAnchor: null,
                    secondAnchor: null,
                    snapMode: 'selection',
                    lastEditedSlot: 'a',
                  }))
                }
              >
                Clear probe
              </button>
              <button
                type="button"
                className={styles.resetButton}
                disabled={!measurement.enabled}
                onClick={useDatumOriginAnchor}
              >
                Use datum origin
              </button>
            </div>
            <dl className={styles.measurementList}>
              <div className={styles.inspectorRow}>
                <dt>A source</dt>
                <dd>{measurementA?.objectId ?? 'Not set'}</dd>
              </div>
              <div className={styles.inspectorRow}>
                <dt>A anchor</dt>
                <dd>{measurementA ? formatAnchorType(measurementA.anchorType) : 'Not set'}</dd>
              </div>
              <div className={styles.inspectorRow}>
                <dt>A point</dt>
                <dd>{measurementA ? formatPoint(measurementA.point) : 'Not set'}</dd>
              </div>
              <div className={styles.inspectorRow}>
                <dt>B source</dt>
                <dd>{measurementB?.objectId ?? 'Not set'}</dd>
              </div>
              <div className={styles.inspectorRow}>
                <dt>B anchor</dt>
                <dd>{measurementB ? formatAnchorType(measurementB.anchorType) : 'Not set'}</dd>
              </div>
              <div className={styles.inspectorRow}>
                <dt>B point</dt>
                <dd>{measurementB ? formatPoint(measurementB.point) : 'Not set'}</dd>
              </div>
              <div className={styles.inspectorRow}>
                <dt>ΔX</dt>
                <dd>{measurementDeltaPoint ? formatDistanceMm(measurementDeltaPoint.x) : 'Not set'}</dd>
              </div>
              <div className={styles.inspectorRow}>
                <dt>ΔY</dt>
                <dd>{measurementDeltaPoint ? formatDistanceMm(measurementDeltaPoint.y) : 'Not set'}</dd>
              </div>
              <div className={styles.inspectorRow}>
                <dt>ΔZ</dt>
                <dd>{measurementDeltaPoint ? formatDistanceMm(measurementDeltaPoint.z) : 'Not set'}</dd>
              </div>
              <div className={styles.inspectorRow}>
                <dt>3D distance</dt>
                <dd>{measurementDistanceMm != null ? formatDistanceMm(measurementDistanceMm) : 'Not set'}</dd>
              </div>
              <div className={styles.inspectorRow}>
                <dt>Plan distance</dt>
                <dd>{measurementPlanDistanceMm != null ? formatDistanceMm(measurementPlanDistanceMm) : 'Not set'}</dd>
              </div>
              <div className={styles.inspectorRow}>
                <dt>Rise/fall</dt>
                <dd>{measurementDeltaPoint ? formatDistanceMm(Math.abs(measurementDeltaPoint.z)) : 'Not set'}</dd>
              </div>
            </dl>
          </div>
        </div>

              <div className={styles.panel}>
          <p className={styles.eyebrow}>Inspector</p>
          {measurement.enabled && selectedObjectSupportsAnchorSwitch ? (
            <div className={styles.anchorSwitchRow}>
              {([
                ['start', 'Start'],
                ['midpoint', 'Mid'],
                ['end', 'End'],
              ] as const).map(([anchorType, label]) => (
                <button
                  key={anchorType}
                  type="button"
                  className={selectedAnchorType === anchorType ? styles.activeToolbarButton : styles.resetButton}
                  onClick={() => switchSelectedAnchorType(anchorType)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <dl className={styles.inspectorList}>
            <div className={styles.inspectorRow}>
              <dt>Focus</dt>
              <dd>{formatCameraFocusMode(cameraState.focusMode)}</dd>
            </div>
            <div className={styles.inspectorRow}>
              <dt>Target</dt>
              <dd>{formatPoint(cameraState.target)}</dd>
            </div>
            <div className={styles.inspectorRow}>
              <dt>View</dt>
              <dd>{formatCameraPreset(cameraState.viewPreset)}</dd>
            </div>
            {sectionCut.enabled ? (
              <div className={styles.inspectorRow}>
                <dt>Section cut</dt>
                <dd>Active at X = {Math.round(sectionCut.positionMm)} mm</dd>
              </div>
            ) : null}
            {measurement.enabled ? (
              <>
                <div className={styles.inspectorRow}>
                  <dt>Probe A</dt>
                  <dd>{measurementA ? formatPoint(measurementA.point) : 'Not set'}</dd>
                </div>
                <div className={styles.inspectorRow}>
                  <dt>Probe B</dt>
                  <dd>{measurementB ? formatPoint(measurementB.point) : 'Not set'}</dd>
                </div>
                <div className={styles.inspectorRow}>
                  <dt>Probe ΔX</dt>
                  <dd>{measurementDeltaPoint ? formatDistanceMm(measurementDeltaPoint.x) : 'Not set'}</dd>
                </div>
                <div className={styles.inspectorRow}>
                  <dt>Probe ΔY</dt>
                  <dd>{measurementDeltaPoint ? formatDistanceMm(measurementDeltaPoint.y) : 'Not set'}</dd>
                </div>
                <div className={styles.inspectorRow}>
                  <dt>Probe ΔZ</dt>
                  <dd>{measurementDeltaPoint ? formatDistanceMm(measurementDeltaPoint.z) : 'Not set'}</dd>
                </div>
                <div className={styles.inspectorRow}>
                  <dt>Probe 3D</dt>
                  <dd>{measurementDistanceMm != null ? formatDistanceMm(measurementDistanceMm) : 'Not set'}</dd>
                </div>
                <div className={styles.inspectorRow}>
                  <dt>Probe plan</dt>
                  <dd>{measurementPlanDistanceMm != null ? formatDistanceMm(measurementPlanDistanceMm) : 'Not set'}</dd>
                </div>
              </>
            ) : null}
            {objectSummary(selectedObject).map((entry) => (
              <div key={entry.label} className={styles.inspectorRow}>
                <dt>{entry.label}</dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </dl>
        </div>
            </div>
          </aside>
        ) : null}

        <Canvas
          camera={initialCamera}
          data-testid="geometry-3d-canvas"
          onCreated={handleCanvasCreated}
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
          {measurement.enabled ? (
            <MeasurementProbeOverlay
              firstAnchor={measurementA}
              secondAnchor={measurementB}
              clippingPlanes={clippingPlanes}
              markerRadiusMm={measurementMarkerRadiusMm}
            />
          ) : null}
          {geometryPreview.scene.layers.flatMap((layer) =>
            layerVisibility[layer.id] !== false
              ? layer.objects.map((object) => (
                  <SceneObjectNode
                    key={object.id}
                    object={object}
                    color={LAYER_COLORS[layer.id] ?? '#6c7a86'}
                    onSelect={handleObjectSelect}
                    onFocus={focusObjectById}
                    clippingPlanes={clippingPlanes}
                  />
                ))
              : [],
          )}
          <OrbitControls
            ref={handleControlsRef}
            makeDefault
            enablePan
            enableRotate
            enableZoom
            target={[cameraState.target.x, cameraState.target.y, cameraState.target.z]}
            enableDamping
            dampingFactor={0.12}
            screenSpacePanning
            zoomToCursor
            rotateSpeed={0.72}
            panSpeed={0.9}
            zoomSpeed={0.95}
            minDistance={sceneBounds ? Math.max(sceneBounds.size * 0.18, 250) : 250}
            maxDistance={sceneBounds ? Math.max(sceneBounds.size * 14, 14000) : 14000}
            minPolarAngle={0.04}
            maxPolarAngle={Math.PI - 0.08}
            mouseButtons={{
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN,
            }}
            touches={{
              ONE: THREE.TOUCH.ROTATE,
              TWO: THREE.TOUCH.DOLLY_PAN,
            }}
            onEnd={() => {
              const controls = controlsRef.current;
              const camera = cameraRef.current;
              const sceneCenter = sceneBounds?.center;
              if (!controls || !camera || !sceneCenter) return;

              const nextTarget = {
                x: controls.target.x,
                y: controls.target.y,
                z: controls.target.z,
              };
              const nextPosition = {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z,
              };
              const nextFocusMode: GeometryCameraFocusMode = pointsRoughlyEqual(nextTarget, sceneCenter, focusToleranceMm)
                ? 'scene'
                : selectedFocusPoint && pointsRoughlyEqual(nextTarget, selectedFocusPoint, focusToleranceMm)
                  ? 'selection'
                  : 'manual';

              setCameraState({
                position: nextPosition,
                target: nextTarget,
                distanceMm: camera.position.distanceTo(controls.target),
                viewPreset: 'custom',
                focusMode: nextFocusMode,
              });
            }}
          />
        </Canvas>
      </div>
    </section>
  );
}
