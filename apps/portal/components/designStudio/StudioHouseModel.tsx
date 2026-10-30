"use client";
import { memo, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { SceneCanvas as Canvas } from "@sp/geometry-viewer/react/canvas";
import { computeSceneBoundsFromPoints } from "@sp/geometry-viewer";
import { Html, Line } from "@react-three/drei";
import { GridHelper } from "three";
import {
  PreviewCamera,
  PreviewLighting,
  PreviewProductNode,
  StudioTreatment,
  DayNightTransition,
} from "@sp/configurator/react";
import type { Point3 } from "@sp/geometry";
import type { ResolvedStudioScene } from "@/lib/designStudio/interaction/resolvedScene";
import { transformWebsitePoint } from "@/lib/designStudio/websiteComposition";
import { studioCompositionOverview } from "./studioCompositionOverview";
import StudioHouseNode from "./StudioHouseNode";
import StudioViewOrientation from "./StudioViewOrientation";
import StudioProductContext from "./StudioProductContext";
import StudioSelectionVisibility from "./StudioSelectionVisibility";
import WebsiteConnectionDetail from "./directDemo/WebsiteConnectionDetail";
import type { connectionView } from "./directDemo/connectionView";
import type { SelectionVisibility } from "./studioPlacementMeasurements";
import css from "./StudioWebsite.module.css";
import { useStudioModelSelectionIntent } from "./useStudioModelSelectionIntent";
type Props = {
  cad?: boolean;
  active: boolean;
  scene: ResolvedStudioScene;
  selected: string;
  onSelect: (id: string) => void;
  readOnly: boolean;
  section: string;
  refinedHouse: boolean;
  persistentViewport: boolean;
  cameraStorageKey?: string;
  zoomStep: number;
  fit: number;
  framingKey: string;
  focused: ReturnType<typeof connectionView> | null;
  points: Point3[];
  onVisibility: (visibility: SelectionVisibility) => void;
  isNight: boolean;
};
/** Persistent 3D presentation. Hidden props are deferred until reveal. The
 * public Canvas host also freezes bridged context values and gates the first
 * visible frame; memo alone cannot stop context-driven reconciler updates. */
function StudioHouseModel({
  cad = false,
  active,
  scene,
  selected,
  onSelect,
  readOnly,
  section,
  refinedHouse,
  persistentViewport,
  cameraStorageKey,
  zoomStep,
  fit,
  framingKey,
  focused,
  points,
  onVisibility,
  isNight,
}: Props) {
  const selectionIntent = useStudioModelSelectionIntent(active);
  // This editor-owned primitive needs no extension of the shared catalogue.
  // Fiber does not own primitive resources, so the model releases both buffers.
  const grid = useMemo(
    () => (cad ? new GridHelper(200000, 200, "#d6dad4", "#e1e5df") : null),
    [cad],
  );
  useEffect(() => () => grid?.dispose(), [grid]);
  const houses = scene.houses,
    products = scene.products,
    joined = scene.joins;
  const selectionPoints = useMemo(() => {
    const h = houses.find((h) => h.house.id === selected);
    if (h) return [...h.walls.flat(), ...h.roof.flat()];
    const p = products.find((p) => p.object.id === selected);
    return p?.geometry && p.position
      ? (
          p.physical?.points ??
          p.geometry.assembly.members.flatMap((m) => [
            m.centerline.start,
            m.centerline.end,
          ])
        ).map((v) => transformWebsitePoint(v, p.position!))
      : [];
  }, [houses, products, selected]);
  const selectionPivot = useMemo(
    () =>
      selectionPoints.length
        ? {
            id: selected,
            centre: computeSceneBoundsFromPoints(selectionPoints).center,
          }
        : undefined,
    [selected, selectionPoints],
  );
  const cameraHasContent = useRef(false);
  if (points.length) cameraHasContent.current = true;
  useLayoutEffect(() => {
    if (!cameraHasContent.current && cameraStorageKey)
      try {
        sessionStorage.removeItem(`${cameraStorageKey}:3d`);
      } catch {}
  }, [cameraStorageKey]);
  const bounds = useMemo(
    () => computeSceneBoundsFromPoints(focused?.points ?? points),
    [points, focused],
  );
  const overview = useMemo(
    () =>
      studioCompositionOverview(
        products.flatMap((p) => {
          if (!p.position || !p.geometry) return [];
          const outline = p.geometry.plan.outline.map((v) =>
            transformWebsitePoint(v, p.position!),
          );
          return [
            outline.reduce(
              (a, v) => ({
                x: a.x + v.x / outline.length,
                y: a.y + v.y / outline.length,
              }),
              { x: 0, y: 0 },
            ),
          ];
        }),
        houses.flatMap((h) => h.footprint),
        30,
      ),
    [products, houses],
  );
  const night = useRef({ current: 0, listeners: new Set<() => void>() });
  useEffect(() => {
    night.current.current = isNight ? 1 : 0;
    night.current.listeners.forEach((f) => f());
  }, [isNight]);
  return (
    <div
      {...selectionIntent}
      onContextMenu={cad ? (event) => event.preventDefault() : undefined}
      style={{
        position: "absolute",
        inset: 0,
        visibility: active ? "visible" : "hidden",
      }}
    >
      <Canvas
        active={active}
        shadows
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{
          position: [10000, 16000, 10000],
          up: [0, 0, 1],
          fov: 24,
          near: 10,
          far: 200000,
        }}
        aria-label="Studio house and pergola model"
      >
        <DayNightTransition presentation={night.current}>
          <StudioTreatment.Provider value={true}>
            {persistentViewport && <StudioViewOrientation />}
            {persistentViewport && (
              <StudioSelectionVisibility
                points={selectionPoints}
                onChange={onVisibility}
              />
            )}
            <PreviewLighting studio reducedDetail={false} review={false} />
            {cameraHasContent.current && (
              <PreviewCamera
                studioCad={cad}
                selectionPivot={cad ? selectionPivot : undefined}
                storageKey={
                  cameraStorageKey ? `${cameraStorageKey}:3d` : undefined
                }
                preserveUserCamera={persistentViewport}
                zoomStep={zoomStep}
                overviewDirection={focused?.direction ?? overview}
                bounds={bounds}
                fitPoints={focused?.points ?? points}
                framingKey={framingKey}
                fitPadding={0.76}
                studio
                enabled={active}
                fit={fit}
                reset={0}
                surroundings={!!houses.length}
              />
            )}
            <mesh receiveShadow position={[0, 0, -5]}>
              <planeGeometry args={[100000, 100000]} />
              <meshStandardMaterial
                color={cad ? "#eceeea" : "#d9d3c7"}
                roughness={1}
              />
            </mesh>
            {grid && (
              <primitive
                object={grid}
                dispose={null}
                rotation={[Math.PI / 2, 0, 0]}
                position={[0, 0, -4]}
              />
            )}
            {houses.map((g) => (
              <StudioHouseNode
                cad={cad}
                refined={refinedHouse}
                key={g.house.id}
                geometry={g}
                selected={selected === g.house.id}
                onSelect={() => onSelect(g.house.id)}
              />
            ))}
            {products.map((p) =>
              p.geometry && p.position ? (
                <StudioProductContext
                  key={p.object.id}
                  row={p}
                  active={selected === p.object.id && !readOnly}
                  night={isNight}
                >
                  <group
                    position={[p.position.x, p.position.y, 0]}
                    rotation={[0, 0, (p.position.rotation * Math.PI) / 180]}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(p.object.id);
                    }}
                  >
                    {refinedHouse &&
                      !p.error &&
                      scene.scene.attachments
                        .filter(
                          (a) =>
                            a.objectId === p.object.id &&
                            a.method === "soffit" &&
                            !!a.contactBasis,
                        )
                        .map((a) => {
                          const house = scene.scene.houses.find(
                            (h) => h.id === a.houseId,
                          );
                          return house ? (
                            <WebsiteConnectionDetail
                              key={a.objectId}
                              house={house}
                              side={a.edge}
                              assembly={p.geometry!.assembly}
                              pose={p.position!}
                              widthMm={p.design!.input.widthMm}
                            />
                          ) : null;
                        })}
                    <PreviewProductNode
                      onSelect={() => onSelect(p.object.id)}
                      interactiveChoices={selected === p.object.id && !readOnly}
                      scene={p.geometry.viewerScene}
                      covering={p.geometry.covering}
                      selected={selected === p.object.id}
                      choiceView={
                        selected === p.object.id
                          ? section === "Sides"
                            ? "sides"
                            : section === "Lighting"
                              ? "lighting"
                              : undefined
                          : undefined
                      }
                    />
                    {(selected === p.object.id || p.referenceDisplay) && (
                      <Line
                        points={[
                          ...p.geometry.plan.outline,
                          p.geometry.plan.outline[0],
                        ].map((v) => [v.x, v.y, 20])}
                        color={
                          p.referenceDisplay
                            ? "#a56422"
                            : cad
                              ? "#3e5b26"
                              : "#826344"
                        }
                        lineWidth={2}
                      />
                    )}
                    <Html
                      center
                      position={[
                        (p.geometry.plan.extents.minX +
                          p.geometry.plan.extents.maxX) /
                          2,
                        (p.geometry.plan.extents.minY +
                          p.geometry.plan.extents.maxY) /
                          2,
                        Math.max(
                          ...p.geometry.assembly.members.flatMap((m) => [
                            m.centerline.start.z,
                            m.centerline.end.z,
                          ]),
                        ) + 250,
                      ]}
                      style={{ pointerEvents: "none" }}
                    >
                      <span className={css.selectedObjectLabel}>
                        {p.object.label}
                        {p.referenceDisplay
                          ? " · Retained reference, not priced"
                          : ""}
                      </span>
                    </Html>
                  </group>
                </StudioProductContext>
              ) : null,
            )}
            {joined
              .filter((s) => s.witness)
              .map((s) => {
                const w = s.witness!,
                  n = w.normal,
                  t = { x: -n.y, y: n.x },
                  p = w.contact.map(
                    (v) =>
                      [
                        n.x * w.plane + t.x * v.x,
                        n.y * w.plane + t.y * v.x,
                        v.y,
                      ] as [number, number, number],
                  );
                return (
                  <Line
                    key={s.join.id}
                    points={[...p, p[0]]}
                    color="#826344"
                    lineWidth={3}
                  />
                );
              })}
          </StudioTreatment.Provider>
        </DayNightTransition>
      </Canvas>
    </div>
  );
}
const CurrentStudioHouseModel = memo(StudioHouseModel);
export default memo(
  CurrentStudioHouseModel,
  (previous, next) => !previous.active && !next.active,
);
