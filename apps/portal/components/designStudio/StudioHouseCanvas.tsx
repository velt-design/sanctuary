"use client";
import type { StudioSceneView } from "./studioHouseContext";
import StudioHousePlan, { type StudioPlanFootprint } from "./StudioHousePlan";
import { useStudioPlanViewport } from "./useStudioPlanViewport";
import { useMemo, useState, useRef, useEffect } from "react";
import StudioHouseModel from "./StudioHouseModel";
import { useLighting } from "@sp/configurator/react/controls";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import { transformWebsitePoint } from "@/lib/designStudio/websiteComposition";
import { type StudioHouseTarget } from "@/lib/designStudio/studioHouseGeometry";
import {
  studioJoinCanvasProjection,
  type StudioJoinCanvasProjection,
  type StudioJoinEdge,
} from "./studioJoinPresentation";
import type { WebsiteJoin } from "@/lib/designStudio/websiteJoinIntent";
import { connectionView } from "./directDemo/connectionView";
import css from "./StudioWebsite.module.css";
import StudioPlacementReadout, {
  type StudioPlacementSelection,
} from "./StudioPlacementReadout";
import {
  planFrameVisibility,
  type SelectionVisibility,
} from "./studioPlacementMeasurements";
import type { StudioDirectDrag } from "@/lib/designStudio/interaction/contracts";
import {
  createStudioSceneResolver,
  type ResolvedStudioScene,
} from "@/lib/designStudio/interaction/resolvedScene";
export type { StudioDirectDrag } from "@/lib/designStudio/interaction/contracts";
type Props = {
  cad?: boolean;
  showMeasurements?: boolean;
  resolvedScene?: ResolvedStudioScene;
  previewScene?: ResolvedStudioScene | null;
  sceneGeneration?: number;
  gesturePhase?: string;
  repairTarget?: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  };
  cameraStorageKey?: string;
  persistentViewport?: boolean;
  directFramePoints?: ReadonlyArray<{ x: number; y: number }>;
  refinedHouse?: boolean;
  directFootprint?: StudioPlanFootprint;
  directDrag?: StudioDirectDrag;
  pickedTarget?: string;
  movementLocked?: boolean;
  previewLabel?: string;
  edit: StudioAuthoringEdit;
  selected: string;
  onSelect: (id: string) => void;
  preview?: StudioAuthoringEdit | null;
  targets?: StudioHouseTarget[];
  onTarget?: (t: StudioHouseTarget) => void;
  readOnly?: boolean;
  view?: StudioSceneView;
  onView?: (view: StudioSceneView) => void;
  section?: string;
  placement?: boolean;
  joinProjection?: StudioJoinCanvasProjection;
  /** Standalone callers may supply a draft instead of a task projection. */
  joinDraft?: WebsiteJoin | null;
  onJoinTarget?: (id: string, edge: StudioJoinEdge) => void;
  onDimension?: (axis: "width" | "projection") => void;
};
export default function StudioHouseCanvas({
  cad = false,
  showMeasurements = true,
  resolvedScene,
  previewScene,
  sceneGeneration,
  gesturePhase,
  repairTarget,
  cameraStorageKey,
  persistentViewport = false,
  directFramePoints,
  refinedHouse = false,
  directFootprint,
  directDrag,
  edit,
  selected,
  onSelect,
  preview,
  targets = [],
  onTarget,
  readOnly = false,
  view: controlledView,
  onView,
  section = "Shape",
  placement = false,
  joinDraft,
  joinProjection,
  onJoinTarget,
  onDimension,
  previewLabel,
  movementLocked = false,
  pickedTarget,
}: Props) {
  const joinActive = joinProjection?.active ?? !!joinDraft;
  const lighting = useLighting(),
    [fallbackView, setView] = useState<StudioSceneView>("3D"),
    [fit, setFit] = useState(0),
    [detailView, setDetailView] = useState(false),
    [zoomStep, setZoomStep] = useState(0);
  // CAD layout and the selected lighting preview are independent presentation choices.
  // The legacy provider view setter intentionally enables Night for its consumers.
  const view =
    controlledView ?? (!cad && lighting ? lighting.view : fallbackView);
  const lastLightingView = useRef(lighting?.view);
  useEffect(() => {
    if (
      !cad &&
      controlledView &&
      lighting &&
      lighting.view !== (controlledView === "Plan" ? "Plan" : "3D")
    )
      lighting.setView(controlledView === "Plan" ? "Plan" : "3D");
  }, [controlledView, cad]);
  useEffect(() => {
    if (lighting?.view !== lastLightingView.current) {
      lastLightingView.current = lighting?.view;
      if (!cad && lighting && controlledView !== "Split")
        onView?.(lighting.view);
    }
  }, [lighting?.view]);
  const changeView = (v: StudioSceneView) => {
    if (onView) onView(v);
    else if (cad || !lighting) setView(v);
    if (!cad && lighting) lighting.setView(v === "Plan" ? "Plan" : "3D");
  };
  useEffect(() => {
    if (targets.length || joinActive) {
      if (view !== "Split") changeView("Plan");
    }
  }, [targets.length, joinActive]);
  const renderedEdit = joinActive ? edit : (preview ?? edit);
  const fallbackResolver = useMemo(
    () => createStudioSceneResolver(),
    [edit.designId],
  );
  const readScene = useMemo(
    () =>
      (preview && !joinActive ? previewScene : resolvedScene) ??
      fallbackResolver.resolve(renderedEdit),
    [renderedEdit, resolvedScene, previewScene, joinActive],
  );
  const houses = readScene.houses,
    products = readScene.products;
  const joinView = useMemo(
    () =>
      joinProjection ?? studioJoinCanvasProjection(edit, joinDraft, preview),
    [joinProjection, edit, joinDraft, preview],
  );
  const { targets: joinTargets, proposed } = joinView;
  const joined = readScene.joins;
  const points = useMemo(
    () => [
      ...houses.flatMap((h) => h.walls.flat()),
      ...houses.flatMap((h) => h.roof.flat()),
      ...products.flatMap((p) => {
        if (!p.geometry || !p.position) return [];
        const local =
          p.physical?.points ??
          p.geometry.assembly.members.flatMap((m) => [
            m.centerline.start,
            m.centerline.end,
          ]);
        const bound = local.reduce(
          (a, v) => ({
            minX: Math.min(a.minX, v.x),
            minY: Math.min(a.minY, v.y),
            minZ: Math.min(a.minZ, v.z),
            maxX: Math.max(a.maxX, v.x),
            maxY: Math.max(a.maxY, v.y),
            maxZ: Math.max(a.maxZ, v.z),
          }),
          {
            minX: Infinity,
            minY: Infinity,
            minZ: Infinity,
            maxX: -Infinity,
            maxY: -Infinity,
            maxZ: -Infinity,
          },
        );
        return [bound.minX, bound.maxX].flatMap((x) =>
          [bound.minY, bound.maxY].flatMap((y) =>
            [bound.minZ, bound.maxZ].map((z) =>
              transformWebsitePoint({ x, y, z }, p.position!),
            ),
          ),
        );
      }),
    ],
    [houses, products],
  );
  const selection = useMemo<StudioPlacementSelection | null>(() => {
    const p = products.find((p) => p.object.id === selected);
    if (p?.geometry && p.position)
      return {
        label: p.object.label,
        kind: "pergola",
        local: p.geometry.plan.outline,
        world: p.geometry.plan.outline.map((v) =>
          transformWebsitePoint(v, p.position!),
        ),
        origin: p.position,
        rotation: p.position.rotation,
        along: p.studioAttachment
          ? (p.studioAttachment.alongEdgeMm ?? 0)
          : undefined,
        reference: p.referenceDisplay,
      };
    const h = houses.find((h) => h.house.id === selected);
    if (!h) return null;
    const origin = {
        x: Number(h.house.position.xMm),
        y: Number(h.house.position.yMm),
      },
      rotation = Number(h.house.position.rotationDeg);
    return {
      label: h.house.label,
      kind: "house",
      origin,
      rotation,
      world: h.footprint,
      local: h.footprint.map((v) =>
        transformWebsitePoint(
          { x: v.x - origin.x, y: v.y - origin.y },
          { x: 0, y: 0, rotation: -rotation },
        ),
      ),
    };
  }, [products, houses, selected]);
  const otherOutlines = useMemo(
    () => [
      ...houses
        .filter((h) => h.house.id !== selected)
        .map((h) => ({
          label: h.house.label + " wall footprint",
          points: h.footprint,
        })),
      ...products
        .filter((p) => p.object.id !== selected && p.position && p.geometry)
        .map((p) => ({
          label: p.object.label + " roof outline",
          points: p.geometry!.plan.outline.map((v) =>
            transformWebsitePoint(v, p.position!),
          ),
        })),
    ],
    [houses, products, selected],
  );
  const [visibility3D, setVisibility3D] =
    useState<SelectionVisibility>("inside");
  const detail = useMemo(() => {
    if (!refinedHouse || persistentViewport) return null;
    const p = products.find((p) => p.object.id === selected);
    if (
      !p?.geometry ||
      !p.position ||
      !(
        p.studioAttachment?.method === "soffit" &&
        p.studioAttachment.contactBasis
      )
    )
      return null;
    const h = houses.find((h) => h.house.id === p.studioAttachment!.houseId);
    return h
      ? connectionView(
          h.house,
          p.studioAttachment.edge,
          p.geometry.assembly,
          p.position,
          p.design!.input.widthMm,
        )
      : null;
  }, [refinedHouse, products, houses, selected]);
  useEffect(() => {
    if (detailView && !detail) {
      setDetailView(false);
      setFit((n) => n + 1);
    }
  }, [detailView, detail]);
  const focused = detailView ? detail : null;
  const plan = useStudioPlanViewport({
    view,
    points,
    directFramePoints,
    cameraStorageKey,
    persistentViewport,
    directDrag,
    movementLocked,
    joinDraft: joinActive,
    hasFootprint: !!directFootprint,
  });
  const zoom = (step: number) =>
    view !== "3D" ? plan.zoom(step) : setZoomStep((n) => n + step);
  return (
    <div
      className={`${css.canvas} ${css.compositionCanvas} ${css.houseCanvas} ${cad ? css.cadCanvas : ""} ${view === "Split" ? css.splitCanvas : ""}`}
    >
      <div className={css.modelPane}>
        <StudioHouseModel
          cad={cad}
          active={view !== "Plan"}
          scene={readScene}
          selected={selected}
          onSelect={onSelect}
          readOnly={readOnly}
          section={section}
          refinedHouse={refinedHouse}
          persistentViewport={persistentViewport}
          cameraStorageKey={cameraStorageKey}
          zoomStep={zoomStep}
          fit={fit}
          framingKey={edit.designId}
          focused={focused}
          points={points}
          onVisibility={setVisibility3D}
          isNight={!!lighting?.night}
        />
      </div>
      {view !== "3D" && (
        <div className={css.planPane}>
          <StudioHousePlan
            viewport={plan}
            persistentViewport={persistentViewport}
            sceneGeneration={sceneGeneration}
            gesturePhase={gesturePhase}
            houses={houses}
            products={products}
            resolvedScene={resolvedScene}
            selected={selected}
            onSelect={onSelect}
            readOnly={readOnly}
            preview={!!preview}
            directDrag={directDrag}
            section={section}
            placement={placement}
            repairTarget={repairTarget}
            targets={targets}
            pickedTarget={pickedTarget}
            onTarget={onTarget}
            joinTargets={joinTargets}
            onJoinTarget={onJoinTarget}
            directFootprint={directFootprint}
            proposed={proposed}
            joined={joined}
          />
        </div>
      )}
      {!cad && persistentViewport && showMeasurements && (
        <StudioPlacementReadout
          selection={selection}
          others={otherOutlines}
          preview={Boolean(preview && !joinActive)}
          moving={!!directFootprint}
          visibility={
            view !== "3D"
              ? planFrameVisibility(selection?.world ?? [], plan.planFrame)
              : visibility3D
          }
          gestureHint={
            cad
              ? view === "3D"
                ? "Right-drag to orbit; scroll or use the zoom buttons to zoom."
                : "Plan: drag to move, right-drag to pan, scroll or use the zoom buttons to zoom."
              : undefined
          }
          view={view === "Split" ? "Plan" : view}
        />
      )}
      <div className={css.viewTools}>
        {(["3D", "Plan", "Split"] as const).map((v) => (
          <button
            key={v}
            aria-pressed={view === v}
            onClick={() => changeView(v)}
          >
            {v}
          </button>
        ))}
        {!persistentViewport && refinedHouse && detail && view === "3D" && (
          <button
            onClick={() => {
              setDetailView(true);
              setFit((n) => n + 1);
            }}
          >
            View connection
          </button>
        )}
        {
          <button
            onClick={() => {
              setDetailView(false);
              if (view !== "3D")
                plan.fitToFrame([
                  ...points,
                  ...(proposed?.points ?? []),
                  ...(directFramePoints ?? []),
                  ...(directFootprint?.points ?? []),
                ]);
              if (view !== "Plan") setFit((n) => n + 1);
            }}
            aria-label="Fit design"
          >
            Fit
          </button>
        }
        {persistentViewport && (
          <>
            <button
              aria-label={view === "Split" ? "Zoom Plan out" : "Zoom out"}
              onClick={() => zoom(-1)}
            >
              −
            </button>
            <button
              aria-label={view === "Split" ? "Zoom Plan in" : "Zoom in"}
              onClick={() => zoom(1)}
            >
              +
            </button>
            {(!cad || showMeasurements) && (
              <span aria-label="Plan orientation">
                {view !== "3D"
                  ? "Plan: ↑ +Y · → +X"
                  : cad
                    ? "3D · right-drag orbit"
                    : "3D · orbit view"}
              </span>
            )}
          </>
        )}
        {!cad && view === "3D" && lighting && (
          <button onClick={() => lighting.setNight(!lighting.night)}>
            {lighting.night ? "Day" : "Night"}
          </button>
        )}
      </div>
      {previewLabel && (
        <p className={css.scenePreviewLabel} role="status">
          {previewLabel}
        </p>
      )}
      {!cad &&
        !readOnly &&
        !placement &&
        !targets.length &&
        !joinActive &&
        products.some((p) => p.object.id === selected) && (
          <div className={css.dimensionTools}>
            <button onClick={() => onDimension?.("width")}>
              Edit selected width
            </button>
            <button onClick={() => onDimension?.("projection")}>
              Edit selected projection
            </button>
          </div>
        )}
    </div>
  );
}
