"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type {
  Point3,
  RenderMesh3D,
  ViewerSceneHouseLineObject,
  ViewerSceneHouseLinearSolidObject,
  ViewerSceneHouseRoofMaterialObject,
  ViewerSceneHouseSurfaceObject,
  ViewerSceneHouseSurfaceSolidObject,
  ViewerSceneMemberPrismObject,
  ViewerSceneModel,
  ViewerSceneObject,
  ViewerSceneReferenceLineObject,
  ViewerSceneReferencePlaneObject,
  ViewerSceneRoofCladdingPanelObject,
  ViewerSceneRoofFlashingObject,
  ViewerSceneRoofPlaneObject,
} from "@sp/geometry";
import type {
  GeometryPreviewMode,
  GeometryPreviewState,
} from "@/lib/drawings/geometry/buildWorkbenchGeometryPreview";
import type { DrawingWorkbenchVisibilityState } from "@/lib/drawings/state/drawingWorkbenchUiState";
import type { ObjectWorkbenchDisplayFamily } from "@/lib/drawings/state/objectWorkbenchViewportTypes";
import type { ProjectHouseProjectionHealth } from "@/lib/drawings/state/projectHouseProjectionHealth";
import { blockNativeSelectionEvent } from "../nativeSelection";
import styles from "./Geometry3DViewport.module.css";
import type { SceneBounds } from "./geometry/sceneBoundsTypes";
import { sceneForDisplayMode } from "./geometry/sceneFilters";
import {
  buildClosedLineGeometry,
  buildLineGeometry,
  emptyGeometry,
  vectorFromPoint,
} from "./geometry/lineBuilders";
import {
  buildClippedBoxGeometry,
  buildClippedProfileExtrusionGeometry,
  buildLinearSolidPlacement,
  buildPolygonGeometry,
  buildPolygonSlabGeometry,
  buildProfileExtrusionGeometry,
  buildRectangularCapGeometry,
  buildRenderMeshGeometry,
  isRenderableSlab,
  numericMetadataValue,
  offsetPolygon,
} from "./geometry/buildGeometries";
export {
  buildClippedBoxGeometry,
  buildClippedProfileExtrusionGeometry,
  buildPolygonSlabGeometry,
  buildRenderMeshGeometry,
} from "./geometry/buildGeometries";
import {
  buildDeckGrooveLines,
  resolveDeckMaterial,
  resolveDeckPalette,
  type DeckMaterialKey,
} from "./geometry/deckVisual";
import { ArrowOverlay } from "./overlays/ArrowOverlay";
import { MeasurementProbeOverlay } from "./overlays/MeasurementProbeOverlay";
import { SectionCutHint } from "./overlays/SectionCutHint";
import { SceneObjectNode } from "./renderers/SceneObjectNode";
import {
  MIN_RENDERABLE_POLYGON_AREA_MM2,
  allSceneBoundsFinite,
  boundingSize,
  centroid,
  isFinitePoint,
  isRenderableLine,
  isRenderablePolygon,
  isRenderableRenderMesh,
  linePoints,
  midpoint,
  polygonArea3D,
  renderMeshPoints,
  uniquePointCount,
} from "./geometry/scenePointHelpers";
import {
  buildPresetCameraState,
  cameraStatesEqual,
  clampCameraStateToScene,
  defaultCameraStateForScene,
  directionForPreset,
  directionFromCameraState,
  fitDistanceForSize,
  formatCameraFocusMode,
  formatCameraPreset,
  formatPoint,
  formatVector,
  offsetPoint,
  pointDistance,
  pointToVector,
  pointsRoughlyEqual,
  positionFromDirection,
  vectorToPoint,
  type Geometry3DViewportState,
  type GeometryCameraFocusMode,
  type GeometryCameraPreset,
  type GeometryCameraState,
  type GeometryViewportCamera,
} from "./interaction/cameraState";
export type { Geometry3DViewportState } from "./interaction/cameraState";
import {
  buildDatumOriginAnchor,
  buildMeasurementAnchor,
  defaultAnchorTypeForObject,
  focusPointForObject,
  formatAnchorType,
  formatDistanceMm,
  measurementDelta,
  measurementDistance,
  measurementPlanDistance,
  pointsForObject,
  resolveAnchorPoint,
  supportsEndpointAnchors,
  type MeasurementAnchor,
  type MeasurementAnchorType,
  type MeasurementState,
} from "./interaction/measurement";
import {
  collectHouseOpeningViewportDiagnostics,
  collectHouseRoofViewportDiagnostics,
  formatDiagnosticToken,
  formatMetadata,
  houseRoofQaSummary,
  metadataNumber,
  metadataText,
  objectSummary,
  previewModeLabel,
  rectContains,
  rectDiagnostics,
  sceneMetadataNumber,
  sceneMetadataString,
  type HouseOpeningViewportDiagnostics,
  type HouseRoofViewportDiagnostics,
  type ViewportRectDiagnostics,
} from "./interaction/diagnostics";

const ORBIT_MOUSE_DISABLED = -1 as THREE.MOUSE;
const ORBIT_ZOOM_SPEED = 2.85;

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
  house: "#b0b4b9",
  posts: "#7b6347",
  beams: "#4f5965",
  support_beams: "#7a838e",
  rafters: "#96979b",
  joiners: "#8d7b56",
  gutters: "#437da8",
  roof_cladding: "#d9c77b",
  roof_flashings: "#d8d2bd",
  house_roof_materials: "#f0f2f3",
  project_pergola_fallbacks: "#9b6a24",
  roof_planes: "#d4b35a",
  attachment_edge: "#bb4b4b",
};

function workbenchObjectIdForSceneObject(object: ViewerSceneObject): string | null {
  const sourceId =
    ("sourceId" in object && typeof object.sourceId === "string"
      ? object.sourceId
      : null) ??
    (typeof object.metadata?.sourceId === "string"
      ? object.metadata.sourceId
      : null);
  const pergolaId =
    typeof object.metadata?.pergolaId === "string"
      ? object.metadata.pergolaId
      : null;
  return pergolaId ?? sourceId;
}

function resetRendererState(renderer: THREE.WebGLRenderer | null): void {
  if (!renderer) return;
  renderer.localClippingEnabled = false;
  renderer.setScissorTest(false);
  renderer.clearDepth();
  renderer.resetState();
  (renderer as { renderLists?: { dispose?: () => void } }).renderLists?.dispose?.();
}

function disposeRenderer(renderer: THREE.WebGLRenderer | null): void {
  if (!renderer) return;
  resetRendererState(renderer);
  renderer.dispose();
}

function collectScenePoints(scene: ViewerSceneModel): Point3[] {
  return scene.layers.flatMap((layer) =>
    layer.objects.flatMap((object) => {
      if (object.type === "member_prism") return linePoints(object.centerline);
      if (object.type === "roof_plane" || object.type === "roof_cladding_panel")
        return object.boundary.filter(isFinitePoint);
      if (object.type === "roof_flashing")
        return object.wings.flatMap((wing) =>
          wing.boundary.filter(isFinitePoint),
        );
      if (object.type === "house_roof_material")
        return object.lines.flatMap((line) => linePoints(line)).filter(isFinitePoint);
      if (object.type === "reference_line") {
        return linePoints(object.line).filter(isFinitePoint);
      }
      if (object.type === "house_line") {
        return isRenderableLine(object.line) ? linePoints(object.line) : [];
      }
      if (object.type === "house_surface") {
        return isRenderablePolygon(object.boundary) ? object.boundary : [];
      }
      if (object.type === "house_surface_solid") {
        const meshPoints = renderMeshPoints(object.renderMesh);
        if (meshPoints.length) return meshPoints;
        return isRenderableSlab(
          object.boundary,
          object.plane,
          object.thicknessMm,
        )
          ? object.boundary
          : [];
      }
      if (object.type === "house_linear_solid") {
        const meshPoints = renderMeshPoints(object.renderMesh);
        if (meshPoints.length) return meshPoints;
        return buildLinearSolidPlacement(object)
          ? linePoints(object.centerline)
          : [];
      }
      return object.boundary.filter(isFinitePoint);
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


export default function Geometry3DViewport({
  geometryPreview,
  objectWorkbenchDisplayFamily = "pergolas",
  visibility,
  viewportKey = "geometry3d",
  viewportState,
  onViewportStateChange,
  lockedViewPreset,
  controlledSelectedObjectId,
  onSelectedObjectChange,
  controlledHoveredObjectId,
  onHoveredObjectChange,
  projectHouseProjectionHealth = [],
}: {
  geometryPreview?: GeometryPreviewState | null;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  viewportKey?: string;
  viewportState?: Geometry3DViewportState | null;
  onViewportStateChange?: (next: Geometry3DViewportState) => void;
  lockedViewPreset?: GeometryCameraPreset;
  controlledSelectedObjectId?: string | null;
  onSelectedObjectChange?: (objectId: string | null) => void;
  /**
   * Cross-viewport hover state input. When set (e.g. driven by PlanViewport
   * pointer-over), the 3D viewport SHOULD render a hover highlight on the
   * matching object. Phase 1 (milestone 16) wires the prop end-to-end but
   * does NOT yet apply per-object hover styling -- the per-renderer pass
   * adding `hovered: boolean` alongside `selected: boolean` is a follow-up
   * slice. Until then, the prop is exposed via a `data-hovered-object-id`
   * attribute on the canvas root for telemetry/test visibility, and the
   * downstream emit half lets PlanViewport receive 3D-driven hover.
   */
  controlledHoveredObjectId?: string | null;
  projectHouseProjectionHealth?: ReadonlyArray<ProjectHouseProjectionHealth>;
  /**
   * Cross-viewport hover state output. Phase 1 placeholder: the 3D viewport
   * does not yet emit hover events from raycaster/pointer-over (would require
   * adding pointer events to ~50 object renderers). Once the per-renderer
   * hover-render slice lands, this callback fires when the 3D pointer enters
   * an object and `null` when it leaves -- mirroring `onSelectedObjectChange`
   * but for hover. Plumbed now so consumers can adopt the contract early.
   */
  onHoveredObjectChange?: (objectId: string | null) => void;
}) {
  const displayMode = objectWorkbenchDisplayFamily === "house_forms" ? "house" : "pergolas";
  const [panelOpen, setPanelOpen] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<
    Record<string, boolean>
  >({});
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    controlledSelectedObjectId ?? null,
  );
  useEffect(() => {
    if (controlledSelectedObjectId === undefined) return;
    setSelectedObjectId((current) =>
      current === controlledSelectedObjectId ? current : controlledSelectedObjectId,
    );
  }, [controlledSelectedObjectId]);
  const controlledSelectedObjectIdRef = useRef(controlledSelectedObjectId);
  controlledSelectedObjectIdRef.current = controlledSelectedObjectId;
  useEffect(() => {
    if (!onSelectedObjectChange) return;
    onSelectedObjectChange(selectedObjectId);
  }, [onSelectedObjectChange, selectedObjectId]);

  // Cross-viewport hover (milestone 16). The parent owns the hover ref via
  // `controlledHoveredObjectId`; the 3D viewport publishes hover events from
  // its raycaster (via `onHoveredObjectChange`) and renders highlight on the
  // matching object. Unlike selection, hover has no local state -- the
  // controlled prop IS the source of truth, so `setControlledHover...`-style
  // reconciliation isn't needed.
  const onHoveredObjectChangeRef = useRef(onHoveredObjectChange);
  onHoveredObjectChangeRef.current = onHoveredObjectChange;
  const handleObjectHoverEnter = useCallback((id: string) => {
    onHoveredObjectChangeRef.current?.(id);
  }, []);
  const handleObjectHoverLeave = useCallback((id: string) => {
    // Only clear if the leaving object is the one currently hovered. This
    // matches `useHoveredShape`'s convention -- guards against stale leaves
    // arriving after the pointer has already moved to a sibling.
    onHoveredObjectChangeRef.current?.(null);
    void id;
  }, []);

  const [sectionCut, setSectionCut] = useState<SectionCutState>({
    enabled: false,
    positionMm: 0,
  });
  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>(
    {
      datumAxes: false,
      roofFallVectors: false,
      selectedMemberAxes: false,
    },
  );
  const [measurement, setMeasurement] = useState<MeasurementState>({
    enabled: false,
    firstAnchor: null,
    secondAnchor: null,
    snapMode: "selection",
    lastEditedSlot: "a",
  });
  const [cameraState, setCameraState] = useState<GeometryCameraState>(
    () =>
      viewportState?.cameraState ??
      buildPresetCameraState({
        target: { x: 0, y: 0, z: 500 },
        distanceMm: fitDistanceForSize(2000),
        viewPreset: lockedViewPreset && lockedViewPreset !== "custom" ? lockedViewPreset : "iso",
        focusMode: "scene",
      }),
  );
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<GeometryViewportCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const canvasShellRef = useRef<HTMLDivElement | null>(null);
  const viewportRestoreSignatureRef = useRef<string | null>(null);
  const [rectDiagnostic, setRectDiagnostic] = useState<ViewportRectDiagnostics>(
    {
      shellWidth: 0,
      shellHeight: 0,
      canvasWidth: 0,
      canvasHeight: 0,
      canvasContained: false,
    },
  );
  const handleNativeSelectionCapture = useCallback((event: Event) => {
    blockNativeSelectionEvent(event);
  }, []);
  useEffect(() => {
    const node = canvasShellRef.current;
    if (!node) return;
    const handleSelectStart = (event: Event) => handleNativeSelectionCapture(event);
    const handleDragStart = (event: Event) => handleNativeSelectionCapture(event);
    node.addEventListener("selectstart", handleSelectStart, true);
    node.addEventListener("dragstart", handleDragStart, true);
    return () => {
      node.removeEventListener("selectstart", handleSelectStart, true);
      node.removeEventListener("dragstart", handleDragStart, true);
    };
  }, [handleNativeSelectionCapture]);

  const rawScene =
    geometryPreview?.kind === "ready" ? geometryPreview.scene : null;
  const scene = useMemo(
    () => (rawScene ? sceneForDisplayMode(rawScene, displayMode, visibility) : null),
    [displayMode, rawScene, visibility],
  );
  const datumOrigin =
    geometryPreview?.kind === "ready"
      ? geometryPreview.assembly.datum.origin
      : null;
  const sceneBounds = useMemo(
    () => (scene ? computeSceneBounds(scene) : null),
    [scene],
  );
  const allObjects = useMemo(
    () => scene?.layers.flatMap((layer) => layer.objects) ?? [],
    [scene],
  );
  const sceneKey = useMemo(() => {
    if (geometryPreview?.kind !== "ready" || !scene) {
      return geometryPreview?.kind ?? "empty";
    }
    const layerSignature = scene.layers
      .map((layer) => `${layer.id}:${layer.objects.map((object) => object.id).join(",")}`)
      .join("|");
    const boundsSignature = sceneBounds
      ? [
          sceneBounds.min.x,
          sceneBounds.min.y,
          sceneBounds.min.z,
          sceneBounds.max.x,
          sceneBounds.max.y,
          sceneBounds.max.z,
        ]
          .map((value) => Math.round(value))
          .join(",")
      : "no-bounds";
    return [
      geometryPreview.resultSource,
      geometryPreview.config.projectId,
      geometryPreview.config.estimateId,
      geometryPreview.config.family,
      geometryPreview.config.connection.type,
      geometryPreview.config.connection.attachmentSide,
      displayMode,
      geometryPreview.config.dimensions.lengthMm,
      geometryPreview.config.dimensions.projectionMm,
      boundsSignature,
      layerSignature,
    ].join(":");
  }, [displayMode, geometryPreview, scene, sceneBounds]);
  const selectedObject = useMemo(
    () =>
      allObjects.find(
        (object) =>
          object.id === selectedObjectId ||
          workbenchObjectIdForSceneObject(object) === selectedObjectId,
      ) ?? null,
    [allObjects, selectedObjectId],
  );
  useEffect(() => {
    if (!selectedObjectId || selectedObject) return;

    setCameraState((current) =>
      current.focusMode === "selection"
        ? { ...current, focusMode: "scene" }
        : current,
    );
    setMeasurement((current) => {
      const firstAnchor =
        current.firstAnchor?.objectId === selectedObjectId ? null : current.firstAnchor;
      const secondAnchor =
        current.secondAnchor?.objectId === selectedObjectId ? null : current.secondAnchor;
      if (firstAnchor === current.firstAnchor && secondAnchor === current.secondAnchor) {
        return current;
      }
      return {
        ...current,
        firstAnchor,
        secondAnchor,
        snapMode: firstAnchor || secondAnchor ? current.snapMode : "selection",
      };
    });
  }, [selectedObject, selectedObjectId]);
  const finiteBounds = useMemo(() => allSceneBoundsFinite(sceneBounds), [sceneBounds]);
  const houseRoofDiagnostics = useMemo(
    () => collectHouseRoofViewportDiagnostics(scene),
    [scene],
  );
  const houseOpeningDiagnostics = useMemo(
    () => collectHouseOpeningViewportDiagnostics(scene),
    [scene],
  );
  const selectedMember =
    selectedObject?.type === "member_prism" ? selectedObject : null;
  const selectedObjectSupportsAnchorSwitch =
    supportsEndpointAnchors(selectedObject);
  const lengthMm =
    geometryPreview?.kind === "ready"
      ? geometryPreview.config.dimensions.lengthMm
      : 0;
  const sceneFitDistance = useMemo(
    () =>
      sceneBounds
        ? fitDistanceForSize(sceneBounds.size)
        : fitDistanceForSize(2000),
    [sceneBounds],
  );
  const persistCameraState = useCallback(
    (nextState: GeometryCameraState) => {
      setCameraState(nextState);
      onViewportStateChange?.({ cameraState: nextState });
    },
    [onViewportStateChange],
  );
  const useOrthographicTopCamera = cameraState.viewPreset === "top";
  const initialCamera = useMemo(() => {
    const cameraBase = useOrthographicTopCamera
      ? {
          near: 1,
          far: 40000,
          zoom: 1,
        }
      : {
          near: 1,
          far: 40000,
          fov: 40,
        };
    if (!sceneBounds) {
      return {
        position: [1800, -1800, 1400] as [number, number, number],
        ...cameraBase,
      };
    }

    const seedState = buildPresetCameraState({
      target: sceneBounds.center,
      distanceMm: sceneFitDistance,
      viewPreset: "iso",
      focusMode: "scene",
    });
    const cameraPosition = seedState.position;
    return {
      ...cameraBase,
      position: [cameraPosition.x, cameraPosition.y, cameraPosition.z] as [
        number,
        number,
        number,
      ],
      far: Math.max(sceneBounds.size * 10, 40000),
    };
  }, [sceneBounds, sceneFitDistance, useOrthographicTopCamera]);

  const applyCameraPose = useCallback(
    (nextState: GeometryCameraState) => {
      if (!sceneBounds || !cameraRef.current || !controlsRef.current) return;

      const camera = cameraRef.current;
      const controls = controlsRef.current;

      camera.up.set(0, nextState.viewPreset === "top" ? -1 : 0, nextState.viewPreset === "top" ? 0 : 1);
      camera.position.set(
        nextState.position.x,
        nextState.position.y,
        nextState.position.z,
      );
      camera.near = 1;
      camera.far = Math.max(sceneBounds.size * 12, 40000);
      if (camera instanceof THREE.OrthographicCamera) {
        const halfSpan = Math.max(sceneBounds.size * 0.65, 1000);
        camera.left = -halfSpan;
        camera.right = halfSpan;
        camera.top = halfSpan;
        camera.bottom = -halfSpan;
        camera.zoom = 1;
      }
      camera.lookAt(nextState.target.x, nextState.target.y, nextState.target.z);
      camera.updateProjectionMatrix();

      controls.target.set(
        nextState.target.x,
        nextState.target.y,
        nextState.target.z,
      );
      controls.enableDamping = true;
      controls.dampingFactor = 0.12;
      controls.screenSpacePanning = true;
      controls.zoomToCursor = true;
      controls.rotateSpeed = 0.72;
      controls.panSpeed = 0.9;
      controls.zoomSpeed = ORBIT_ZOOM_SPEED;
      controls.minDistance = Math.max(sceneBounds.size * 0.18, 250);
      controls.maxDistance = Math.max(sceneBounds.size * 14, 14000);
      controls.minPolarAngle = 0.04;
      controls.maxPolarAngle = Math.PI - 0.08;
      controls.update();
      controls.saveState();
    },
    [sceneBounds],
  );

  const syncViewportBindings = useCallback(() => {
    applyCameraPose(cameraState);
  }, [applyCameraPose, cameraState]);

  const fitScene = useCallback(() => {
    if (!sceneBounds) return;
    const direction = directionFromCameraState(cameraState);
    persistCameraState({
      position: positionFromDirection(
        sceneBounds.center,
        direction,
        sceneFitDistance,
      ),
      target: sceneBounds.center,
      distanceMm: sceneFitDistance,
      viewPreset: cameraState.viewPreset,
      focusMode: "scene",
    });
  }, [cameraState, persistCameraState, sceneBounds, sceneFitDistance]);

  const focusSelection = useCallback((object: ViewerSceneObject | null) => {
    if (!object) return;
    const target = focusPointForObject(object);
    const objectDistance = fitDistanceForSize(
      boundingSize(pointsForObject(object)),
    );
    setSelectedObjectId(object.id);
    persistCameraState({
      position: positionFromDirection(
        target,
        directionFromCameraState(cameraState),
        objectDistance,
      ),
      target,
      distanceMm: objectDistance,
      viewPreset: cameraState.viewPreset,
      focusMode: "selection",
    });
  }, [cameraState, persistCameraState]);

  const focusObjectById = useCallback(
    (id: string) => {
      const object = allObjects.find((entry) => entry.id === id) ?? null;
      focusSelection(object);
    },
    [allObjects, focusSelection],
  );
  const selectedFocusPoint = useMemo(
    () => (selectedObject ? focusPointForObject(selectedObject) : null),
    [selectedObject],
  );
  const measurementA = measurement.firstAnchor;
  const measurementB = measurement.secondAnchor;
  const measurementDeltaPoint = useMemo(
    () =>
      measurementDelta(
        measurementA?.point ?? null,
        measurementB?.point ?? null,
      ),
    [measurementA?.point, measurementB?.point],
  );
  const measurementDistanceMm = useMemo(
    () =>
      measurementDistance(
        measurementA?.point ?? null,
        measurementB?.point ?? null,
      ),
    [measurementA?.point, measurementB?.point],
  );
  const measurementPlanDistanceMm = useMemo(
    () =>
      measurementPlanDistance(
        measurementA?.point ?? null,
        measurementB?.point ?? null,
      ),
    [measurementA?.point, measurementB?.point],
  );
  const measurementMarkerRadiusMm = useMemo(
    () =>
      sceneBounds ? Math.min(Math.max(sceneBounds.size * 0.012, 26), 72) : 36,
    [sceneBounds],
  );
  const focusToleranceMm = useMemo(
    () => (sceneBounds ? Math.max(sceneBounds.size * 0.001, 5) : 5),
    [sceneBounds],
  );

  const handleControlsRef = useCallback(
    (controls: OrbitControlsImpl | null) => {
      if (controlsRef.current === controls) return;
      controlsRef.current = controls;
      if (controls) {
        syncViewportBindings();
      }
    },
    [syncViewportBindings],
  );

  const handleCanvasCreated = useCallback(
    ({ gl, camera }: { gl: THREE.WebGLRenderer; camera: THREE.Camera }) => {
      rendererRef.current = gl;
      resetRendererState(gl);
      cameraRef.current = camera as GeometryViewportCamera;
      cameraRef.current.up.set(0, cameraState.viewPreset === "top" ? -1 : 0, cameraState.viewPreset === "top" ? 0 : 1);
      syncViewportBindings();
    },
    [syncViewportBindings],
  );

  const assignMeasurementAnchor = useCallback(
    (anchor: MeasurementAnchor, snapMode: MeasurementState["snapMode"]) => {
      setMeasurement((current) => {
        if (!current.firstAnchor) {
          return {
            ...current,
            firstAnchor: anchor,
            snapMode,
            lastEditedSlot: "a",
          };
        }
        if (!current.secondAnchor) {
          return {
            ...current,
            secondAnchor: anchor,
            snapMode,
            lastEditedSlot: "b",
          };
        }
        return {
          ...current,
          secondAnchor: anchor,
          snapMode,
          lastEditedSlot: "b",
        };
      });
    },
    [],
  );

  const handleObjectSelect = useCallback(
    (id: string) => {
      const object = allObjects.find((entry) => entry.id === id) ?? null;
      setSelectedObjectId(id);
      if (!measurement.enabled) return;
      if (!object) return;
      assignMeasurementAnchor(buildMeasurementAnchor(object), "selection");
    },
    [allObjects, assignMeasurementAnchor, measurement.enabled],
  );

  const useDatumOriginAnchor = useCallback(() => {
    if (!datumOrigin) return;
    assignMeasurementAnchor(buildDatumOriginAnchor(datumOrigin), "datum");
  }, [assignMeasurementAnchor, datumOrigin]);

  const switchSelectedAnchorType = useCallback(
    (anchorType: "start" | "midpoint" | "end") => {
      if (!selectedObject || !supportsEndpointAnchors(selectedObject)) return;

      setMeasurement((current) => {
        const replaceSlot =
          current.lastEditedSlot === "a" &&
          current.firstAnchor?.objectId === selectedObject.id
            ? "a"
            : current.lastEditedSlot === "b" &&
                current.secondAnchor?.objectId === selectedObject.id
              ? "b"
              : current.secondAnchor?.objectId === selectedObject.id
                ? "b"
                : current.firstAnchor?.objectId === selectedObject.id
                  ? "a"
                  : null;

        if (!replaceSlot) return current;

        const nextAnchor = buildMeasurementAnchor(selectedObject, anchorType);
        return replaceSlot === "a"
          ? {
              ...current,
              firstAnchor: nextAnchor,
              snapMode: "selection",
              lastEditedSlot: "a",
            }
          : {
              ...current,
              secondAnchor: nextAnchor,
              snapMode: "selection",
              lastEditedSlot: "b",
            };
      });
    },
    [selectedObject],
  );

  const selectedAnchorType = useMemo(() => {
    if (!selectedObject) return null;
    if (
      measurement.lastEditedSlot === "a" &&
      measurement.firstAnchor?.objectId === selectedObject.id
    ) {
      return measurement.firstAnchor.anchorType;
    }
    if (
      measurement.lastEditedSlot === "b" &&
      measurement.secondAnchor?.objectId === selectedObject.id
    ) {
      return measurement.secondAnchor.anchorType;
    }
    if (measurement.secondAnchor?.objectId === selectedObject.id) {
      return measurement.secondAnchor.anchorType;
    }
    if (measurement.firstAnchor?.objectId === selectedObject.id) {
      return measurement.firstAnchor.anchorType;
    }
    return null;
  }, [
    measurement.firstAnchor,
    measurement.lastEditedSlot,
    measurement.secondAnchor,
    selectedObject,
  ]);

  useEffect(() => {
    if (!scene) {
      resetRendererState(rendererRef.current);
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
        snapMode: "selection",
        lastEditedSlot: "a",
      });
      return;
    }
    resetRendererState(rendererRef.current);
    setPanelOpen(false);
    setLayerVisibility(
      Object.fromEntries(
        scene.layers.map((layer) => [layer.id, layer.visibleByDefault]),
      ),
    );
    setSelectedObjectId(controlledSelectedObjectIdRef.current ?? null);
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
      snapMode: "selection",
      lastEditedSlot: "a",
    });
  }, [lengthMm, scene]);

  const viewportRestoreSignature = `${viewportKey}:${
    viewportState?.cameraState ? "saved" : sceneBounds ? "ready" : "empty"
  }`;

  useEffect(() => {
    if (viewportRestoreSignatureRef.current === viewportRestoreSignature) return;
    if (!viewportState?.cameraState && !sceneBounds) {
      viewportRestoreSignatureRef.current = viewportRestoreSignature;
      return;
    }
    viewportRestoreSignatureRef.current = viewportRestoreSignature;
    setCameraState((current) => {
      const nextState = clampCameraStateToScene({
        state:
          viewportState?.cameraState ??
          defaultCameraStateForScene({
            sceneBounds,
            sceneFitDistance,
          }),
        sceneBounds,
      });
      return cameraStatesEqual(current, nextState) ? current : nextState;
    });
  }, [sceneBounds, sceneFitDistance, viewportRestoreSignature, viewportState]);

  useEffect(() => {
    setCameraState((current) =>
      clampCameraStateToScene({
        state: current,
        sceneBounds,
      }),
    );
  }, [sceneBounds]);

  useEffect(() => {
    setRectDiagnostic(
      rectDiagnostics(
        canvasShellRef.current,
        rendererRef.current?.domElement,
      ),
    );
  }, [sceneKey, sectionCut.enabled, allObjects.length]);

  useEffect(() => {
    return () => {
      disposeRenderer(rendererRef.current);
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.localClippingEnabled = sectionCut.enabled;
    }
  }, [sectionCut.enabled]);

  useEffect(() => {
    applyCameraPose(cameraState);
  }, [applyCameraPose, cameraState]);

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
    () =>
      sceneBounds
        ? Math.min(Math.max(sceneBounds.size * 0.18, 450), 1400)
        : 800,
    [sceneBounds],
  );
  const roofFallVectorLength = useMemo(
    () =>
      sceneBounds ? Math.min(Math.max(sceneBounds.size * 0.12, 280), 900) : 450,
    [sceneBounds],
  );
  const selectedAxisLength = useMemo(
    () =>
      sceneBounds ? Math.min(Math.max(sceneBounds.size * 0.08, 220), 700) : 320,
    [sceneBounds],
  );

  if (!geometryPreview) {
    return (
      <section
        className={styles.state}
        aria-label="3D geometry viewport unavailable"
      >
        <h3 className={styles.stateTitle}>3D Unavailable</h3>
        <p className={styles.stateText}>
          This workbench context did not provide a geometry preview.
        </p>
      </section>
    );
  }

  if (geometryPreview.kind === "error") {
    return (
      <section className={styles.state} aria-label="3D geometry viewport error">
        <h3 className={styles.stateTitle}>3D Preview Error</h3>
        <p className={styles.stateText}>{geometryPreview.message}</p>
      </section>
    );
  }

  if (geometryPreview.kind === "unsupported") {
    return (
      <section
        className={styles.state}
        aria-label="3D geometry viewport unsupported"
      >
        <h3 className={styles.stateTitle}>3D Preview Unsupported</h3>
        <p className={styles.stateText}>{geometryPreview.message}</p>
        <p className={styles.stateMeta}>
          Preview mode: {previewModeLabel(geometryPreview.previewMode)}
        </p>
        {geometryPreview.validation ? (
          <p className={styles.stateMeta}>
            Validation: {geometryPreview.validation.status}
            {geometryPreview.validation.unsupportedReasons.length
              ? ` · ${geometryPreview.validation.unsupportedReasons.join(" | ")}`
              : ""}
          </p>
        ) : null}
      </section>
    );
  }

  if (!scene) {
    return (
      <section
        className={styles.state}
        aria-label="3D geometry viewport unavailable"
      >
        <h3 className={styles.stateTitle}>3D Unavailable</h3>
        <p className={styles.stateText}>
          This workbench context did not provide a renderable geometry scene.
        </p>
      </section>
    );
  }

  return (
    <section
      className={styles.viewport}
      aria-label="3D geometry verification viewport"
    >
      <div
        ref={canvasShellRef}
        className={styles.canvasShell}
        data-testid="geometry-3d-canvas-shell"
        data-native-selection-suppressed="true"
        onContextMenu={(event) => event.preventDefault()}
        onClick={() => {
          setSelectedObjectId(null);
        }}
      >
        <div
          className={styles.canvasToolbar}
          data-allow-native-selection="true"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <div className={styles.toolbarGroup}>
            <button
              type="button"
              className={
                panelOpen ? styles.activeToolbarButton : styles.resetButton
              }
              onClick={() => setPanelOpen((current) => !current)}
            >
              Workspace panel
            </button>
          </div>
          <div className={styles.toolbarSpacer} />
          <div className={styles.toolbarGroup}>
            <button
              type="button"
              className={styles.resetButton}
              onClick={fitScene}
            >
              Fit to scene
            </button>
          </div>
        </div>

        {panelOpen ? (
          <aside
            className={styles.workspacePanel}
            data-testid="workspace-panel"
            data-allow-native-selection="true"
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <div className={styles.workspacePanelContent}>
              <div className={styles.workspacePanelHeader}>
                <p className={styles.workspacePanelTitle}>Workspace Panel</p>
                <button
                  type="button"
                  className={styles.resetButton}
                  onClick={() => setPanelOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className={styles.panel}>
                <p className={styles.eyebrow}>3D Verification</p>
                <h3 className={styles.heading}>
                  {previewModeLabel(geometryPreview.previewMode)}
                </h3>
                <p className={styles.meta}>
                  Kernel validation: {geometryPreview.validation.status}
                </p>
                <p className={styles.meta}>
                  Family: {geometryPreview.config.family}
                </p>
              </div>

              <div className={styles.panel}>
                <p className={styles.eyebrow}>Layers</p>
                <div className={styles.layerList}>
                  {scene.layers.map((layer) => (
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
                    <span className={styles.sliderLabel}>
                      Section position (mm)
                    </span>
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
                    <p className={styles.meta}>
                      Cut X: {Math.round(sectionCut.positionMm)} mm
                    </p>
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

                <div
                  className={styles.sectionBlock}
                  data-testid="measurement-panel"
                >
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
                          snapMode: "selection",
                          lastEditedSlot: "a",
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
                      <dd>{measurementA?.objectId ?? "Not set"}</dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>A anchor</dt>
                      <dd>
                        {measurementA
                          ? formatAnchorType(measurementA.anchorType)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>A point</dt>
                      <dd>
                        {measurementA
                          ? formatPoint(measurementA.point)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>B source</dt>
                      <dd>{measurementB?.objectId ?? "Not set"}</dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>B anchor</dt>
                      <dd>
                        {measurementB
                          ? formatAnchorType(measurementB.anchorType)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>B point</dt>
                      <dd>
                        {measurementB
                          ? formatPoint(measurementB.point)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>ΔX</dt>
                      <dd>
                        {measurementDeltaPoint
                          ? formatDistanceMm(measurementDeltaPoint.x)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>ΔY</dt>
                      <dd>
                        {measurementDeltaPoint
                          ? formatDistanceMm(measurementDeltaPoint.y)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>ΔZ</dt>
                      <dd>
                        {measurementDeltaPoint
                          ? formatDistanceMm(measurementDeltaPoint.z)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>3D distance</dt>
                      <dd>
                        {measurementDistanceMm != null
                          ? formatDistanceMm(measurementDistanceMm)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>Plan distance</dt>
                      <dd>
                        {measurementPlanDistanceMm != null
                          ? formatDistanceMm(measurementPlanDistanceMm)
                          : "Not set"}
                      </dd>
                    </div>
                    <div className={styles.inspectorRow}>
                      <dt>Rise/fall</dt>
                      <dd>
                        {measurementDeltaPoint
                          ? formatDistanceMm(Math.abs(measurementDeltaPoint.z))
                          : "Not set"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className={styles.panel}>
                <p className={styles.eyebrow}>Inspector</p>
                {measurement.enabled && selectedObjectSupportsAnchorSwitch ? (
                  <div className={styles.anchorSwitchRow}>
                    {(
                      [
                        ["start", "Start"],
                        ["midpoint", "Mid"],
                        ["end", "End"],
                      ] as const
                    ).map(([anchorType, label]) => (
                      <button
                        key={anchorType}
                        type="button"
                        className={
                          selectedAnchorType === anchorType
                            ? styles.activeToolbarButton
                            : styles.resetButton
                        }
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
                      <dd>
                        Active at X = {Math.round(sectionCut.positionMm)} mm
                      </dd>
                    </div>
                  ) : null}
                  {measurement.enabled ? (
                    <>
                      <div className={styles.inspectorRow}>
                        <dt>Probe A</dt>
                        <dd>
                          {measurementA
                            ? formatPoint(measurementA.point)
                            : "Not set"}
                        </dd>
                      </div>
                      <div className={styles.inspectorRow}>
                        <dt>Probe B</dt>
                        <dd>
                          {measurementB
                            ? formatPoint(measurementB.point)
                            : "Not set"}
                        </dd>
                      </div>
                      <div className={styles.inspectorRow}>
                        <dt>Probe ΔX</dt>
                        <dd>
                          {measurementDeltaPoint
                            ? formatDistanceMm(measurementDeltaPoint.x)
                            : "Not set"}
                        </dd>
                      </div>
                      <div className={styles.inspectorRow}>
                        <dt>Probe ΔY</dt>
                        <dd>
                          {measurementDeltaPoint
                            ? formatDistanceMm(measurementDeltaPoint.y)
                            : "Not set"}
                        </dd>
                      </div>
                      <div className={styles.inspectorRow}>
                        <dt>Probe ΔZ</dt>
                        <dd>
                          {measurementDeltaPoint
                            ? formatDistanceMm(measurementDeltaPoint.z)
                            : "Not set"}
                        </dd>
                      </div>
                      <div className={styles.inspectorRow}>
                        <dt>Probe 3D</dt>
                        <dd>
                          {measurementDistanceMm != null
                            ? formatDistanceMm(measurementDistanceMm)
                            : "Not set"}
                        </dd>
                      </div>
                      <div className={styles.inspectorRow}>
                        <dt>Probe plan</dt>
                        <dd>
                          {measurementPlanDistanceMm != null
                            ? formatDistanceMm(measurementPlanDistanceMm)
                            : "Not set"}
                        </dd>
                      </div>
                    </>
                  ) : null}
                  {selectedObject
                    ? objectSummary(selectedObject).map((entry) => (
                        <div key={entry.label} className={styles.inspectorRow}>
                          <dt>{entry.label}</dt>
                          <dd>{entry.value}</dd>
                        </div>
                      ))
                    : null}
                </dl>
              </div>
            </div>
          </aside>
        ) : null}
        <div
          aria-hidden="true"
          className={styles.viewportDiagnostics}
          data-testid="geometry-3d-viewport-diagnostics"
          data-scene-key={sceneKey}
          data-scene-object-count={String(allObjects.length)}
          data-layer-count={String(scene?.layers.length ?? 0)}
          data-finite-bounds={String(finiteBounds)}
          data-finite-bounds-min={sceneBounds && finiteBounds ? formatVector(sceneBounds.min) : ""}
          data-finite-bounds-max={sceneBounds && finiteBounds ? formatVector(sceneBounds.max) : ""}
          data-finite-bounds-size={sceneBounds && finiteBounds ? String(Number(sceneBounds.size.toFixed(3))) : ""}
          data-house-roof-qa-status={houseRoofDiagnostics.qaStatus}
          data-house-roof-qa-failure-reason={houseRoofDiagnostics.qaFailureReason}
          data-house-roof-topology-solver={houseRoofDiagnostics.topologySolver}
          data-house-roof-topology-failure-reason={houseRoofDiagnostics.topologyFailureReason}
          data-house-roof-topology-failure-edge-id={houseRoofDiagnostics.topologyFailureEdgeId}
          data-house-roof-topology-final-face-count={String(houseRoofDiagnostics.topologyFinalFaceCount)}
          data-house-roof-topology-closed-face-count={String(houseRoofDiagnostics.topologyClosedFaceCount)}
          data-house-roof-topology-expected-face-count={String(houseRoofDiagnostics.topologyExpectedFaceCount)}
          data-house-roof-topology-valley-count={String(houseRoofDiagnostics.topologyValleyCount)}
          data-house-roof-topology-disconnected-source-face-count={String(houseRoofDiagnostics.topologyDisconnectedSourceFaceCount)}
          data-house-roof-topology-internal-eave-height-segment-count={String(houseRoofDiagnostics.topologyInternalEaveHeightSegmentCount)}
          data-house-roof-solid-expected-count={String(houseRoofDiagnostics.expectedSolidCount)}
          data-house-roof-solid-rendered-count={String(houseRoofDiagnostics.renderedSolidCount)}
          data-house-roof-solid-skipped-count={String(houseRoofDiagnostics.skippedSolidCount)}
          data-house-opening-count={String(houseOpeningDiagnostics.totalCount)}
          data-house-opening-valid-count={String(houseOpeningDiagnostics.validCount)}
          data-house-opening-host-edge-resolved-count={String(houseOpeningDiagnostics.hostEdgeResolvedCount)}
          data-house-opening-host-edge-unresolved-count={String(houseOpeningDiagnostics.hostEdgeUnresolvedCount)}
          data-house-opening-rendered-marker-count={String(houseOpeningDiagnostics.renderedMarkerCount)}
          data-house-opening-skipped-invalid-count={String(houseOpeningDiagnostics.skippedInvalidCount)}
          data-house-opening-unresolved-valid-count={String(houseOpeningDiagnostics.unresolvedValidCount)}
          data-project-house-projection-health={JSON.stringify(projectHouseProjectionHealth)}
          data-project-house-projection-health-count={String(projectHouseProjectionHealth.length)}
          data-project-pergola-render-health={String(scene?.metadata?.projectPergolaRenderHealth ?? "[]")}
          data-project-pergola-fallback-ids={String(scene?.metadata?.projectPergolaFallbackIds ?? "")}
          data-project-preview-source={String(scene?.metadata?.projectPreviewSource ?? "")}
          data-top-view-screen-axis={cameraState.viewPreset === "top" ? "world_x_left_world_y_down" : ""}
          data-clipping-enabled={String(sectionCut.enabled)}
          data-selected-object-id={selectedObjectId ?? ""}
          data-hovered-object-id={controlledHoveredObjectId ?? ""}
          data-shell-width={String(rectDiagnostic.shellWidth)}
          data-shell-height={String(rectDiagnostic.shellHeight)}
          data-canvas-width={String(rectDiagnostic.canvasWidth)}
          data-canvas-height={String(rectDiagnostic.canvasHeight)}
          data-canvas-contained={String(rectDiagnostic.canvasContained)}
        />

        <Canvas
          key={useOrthographicTopCamera ? "top-orthographic" : "perspective"}
          className={styles.canvas}
          orthographic={useOrthographicTopCamera}
          camera={initialCamera}
          data-testid="geometry-3d-canvas"
          onCreated={handleCanvasCreated}
        >
          <color attach="background" args={["#f4f1ea"]} />
          <ambientLight intensity={0.85} />
          <directionalLight position={[1, -1, 1.5]} intensity={1.1} />
          {sectionCutBoundary ? (
            <SectionCutHint boundary={sectionCutBoundary} />
          ) : null}
          {overlayVisibility.datumAxes ? (
            <group data-testid="datum-axes">
              <ArrowOverlay
                testId="datum-axis-x"
                start={geometryPreview.assembly.datum.origin}
                end={offsetPoint(
                  geometryPreview.assembly.datum.origin,
                  geometryPreview.assembly.datum.xAxis,
                  datumAxisLength,
                )}
                color="#c44141"
              />
              <ArrowOverlay
                testId="datum-axis-y"
                start={geometryPreview.assembly.datum.origin}
                end={offsetPoint(
                  geometryPreview.assembly.datum.origin,
                  geometryPreview.assembly.datum.yAxis,
                  datumAxisLength,
                )}
                color="#2e8f4f"
              />
              <ArrowOverlay
                testId="datum-axis-z"
                start={geometryPreview.assembly.datum.origin}
                end={offsetPoint(
                  geometryPreview.assembly.datum.origin,
                  geometryPreview.assembly.datum.zAxis,
                  datumAxisLength,
                )}
                color="#3d67ba"
              />
            </group>
          ) : null}
          {displayMode === "pergolas" && overlayVisibility.roofFallVectors
            ? geometryPreview.assembly.roofPlanes.map((roofPlane) => {
                const start = centroid(roofPlane.boundary);
                const normalizedFall = pointToVector({
                  x: roofPlane.fallVector.x,
                  y: roofPlane.fallVector.y,
                  z: roofPlane.fallVector.z,
                }).normalize();
                const end = vectorToPoint(
                  pointToVector(start).add(
                    normalizedFall.multiplyScalar(roofFallVectorLength),
                  ),
                );
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
                end={offsetPoint(
                  selectedMember.localFrame.origin,
                  selectedMember.localFrame.xAxis,
                  selectedAxisLength,
                )}
                color="#c44141"
              />
              <ArrowOverlay
                testId="selected-member-axis-y"
                start={selectedMember.localFrame.origin}
                end={offsetPoint(
                  selectedMember.localFrame.origin,
                  selectedMember.localFrame.yAxis,
                  selectedAxisLength,
                )}
                color="#2e8f4f"
              />
              <ArrowOverlay
                testId="selected-member-axis-z"
                start={selectedMember.localFrame.origin}
                end={offsetPoint(
                  selectedMember.localFrame.origin,
                  selectedMember.localFrame.zAxis,
                  selectedAxisLength,
                )}
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
          {scene.layers.flatMap((layer) =>
            layerVisibility[layer.id] !== false
              ? layer.objects.map((object) => {
                  // Cross-viewport hover matching: scene objects carry both
                  // a 3D-scene `id` ("house-solid-deck-1") and an optional
                  // workbench-level source id ("deck-1") that lives EITHER
                  // at `object.sourceId` (set on surfaces) OR
                  // `object.metadata.sourceId` (set on solids built via
                  // `house/envelopeSolids.ts`). PlanViewport emits the
                  // workbench-level id (via `topProjectionShapeClassifier`);
                  // the 3D side matches against either form so a plan hover
                  // on "deck-1" highlights the matching scene prism without
                  // the parent needing to know the prism naming scheme.
                  // Selection accepts either raw 3D ids or workbench ids so
                  // project-wide scenes can highlight every object belonging
                  // to the selected pergola.
                  const workbenchId = workbenchObjectIdForSceneObject(object);
                  const hovered =
                    controlledHoveredObjectId != null &&
                    (controlledHoveredObjectId === object.id ||
                      controlledHoveredObjectId === workbenchId);
                  const selected =
                    selectedObjectId === object.id ||
                    (workbenchId != null && selectedObjectId === workbenchId);
                  return (
                    <SceneObjectNode
                      key={object.id}
                      object={object}
                      color={LAYER_COLORS[layer.id] ?? "#6c7a86"}
                      selected={selected}
                      hovered={hovered}
                      onSelect={handleObjectSelect}
                      onHoverEnter={() =>
                        handleObjectHoverEnter(workbenchId ?? object.id)
                      }
                      onHoverLeave={() =>
                        handleObjectHoverLeave(workbenchId ?? object.id)
                      }
                      onFocus={focusObjectById}
                      clippingPlanes={clippingPlanes}
                    />
                  );
                })
              : [],
          )}
          <OrbitControls
            ref={handleControlsRef}
            makeDefault
            enablePan
            enableRotate={lockedViewPreset !== "top"}
            enableZoom
            target={[
              cameraState.target.x,
              cameraState.target.y,
              cameraState.target.z,
            ]}
            enableDamping
            dampingFactor={0.12}
            screenSpacePanning
            zoomToCursor
            rotateSpeed={0.72}
            panSpeed={0.9}
            zoomSpeed={ORBIT_ZOOM_SPEED}
            minDistance={
              sceneBounds ? Math.max(sceneBounds.size * 0.18, 250) : 250
            }
            maxDistance={
              sceneBounds ? Math.max(sceneBounds.size * 14, 14000) : 14000
            }
            minPolarAngle={0.04}
            maxPolarAngle={Math.PI - 0.08}
            mouseButtons={{
              // Mirror the touch bindings: left-button drag rotates in 3D
              // and pans in Plan view. This makes one-finger trackpad drag
              // do the natural thing on laptops, while desktop mice get the
              // standard left-drag-to-rotate convention. Right-button drag
              // stays bound to the same action as a fallback for users who
              // prefer right-click navigation.
              LEFT:
                lockedViewPreset === "top"
                  ? THREE.MOUSE.PAN
                  : THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT:
                lockedViewPreset === "top"
                  ? THREE.MOUSE.PAN
                  : THREE.MOUSE.ROTATE,
            }}
            touches={{
              ONE:
                lockedViewPreset === "top"
                  ? THREE.TOUCH.PAN
                  : THREE.TOUCH.ROTATE,
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
              const nextFocusMode: GeometryCameraFocusMode = pointsRoughlyEqual(
                nextTarget,
                sceneCenter,
                focusToleranceMm,
              )
                ? "scene"
                : selectedFocusPoint &&
                    pointsRoughlyEqual(
                      nextTarget,
                      selectedFocusPoint,
                      focusToleranceMm,
                    )
                  ? "selection"
                  : "manual";

              persistCameraState({
                position: nextPosition,
                target: nextTarget,
                distanceMm: camera.position.distanceTo(controls.target),
                viewPreset:
                  lockedViewPreset && lockedViewPreset !== "custom"
                    ? lockedViewPreset
                    : "custom",
                focusMode: nextFocusMode,
              });
            }}
          />
        </Canvas>
      </div>
    </section>
  );
}
