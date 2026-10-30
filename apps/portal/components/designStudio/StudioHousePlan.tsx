"use client";
import { PreviewPlanProduct } from "@sp/configurator/react";
import type { ResolvedStudioScene } from "@/lib/designStudio/interaction/resolvedScene";
import type { StudioHouseTarget } from "@/lib/designStudio/studioHouseGeometry";
import type { StudioDirectDrag } from "@/lib/designStudio/interaction/contracts";
import type { AlignmentGuide } from "@/lib/designStudio/interaction/finiteAlignment";
import { transformWebsitePoint } from "@/lib/designStudio/websiteComposition";
import type { StudioJoinCanvasProjection, StudioJoinEdge } from "./studioJoinPresentation";
import StudioProductContext from "./StudioProductContext";
import { JoinPlanTarget } from "./StudioJoinPlanTarget";
import type { useStudioPlanViewport } from "./useStudioPlanViewport";
import css from "./StudioWebsite.module.css";
type Point = { x: number; y: number };
export type StudioPlanFootprint = {
  points: Point[];
  original: Point[];
  target?: { start: Point; end: Point };
  guides?: AlignmentGuide[];
};
type Props = {
  viewport: ReturnType<typeof useStudioPlanViewport>;
  persistentViewport: boolean;
  sceneGeneration?: number;
  gesturePhase?: string;
  houses: ResolvedStudioScene["houses"];
  products: ResolvedStudioScene["products"];
  resolvedScene?: ResolvedStudioScene;
  selected: string;
  onSelect: (id: string) => void;
  readOnly: boolean;
  preview: boolean;
  directDrag?: StudioDirectDrag;
  section: string;
  placement: boolean;
  repairTarget?: { start: Point; end: Point };
  targets: StudioHouseTarget[];
  pickedTarget?: string;
  onTarget?: (target: StudioHouseTarget) => void;
  joinTargets: StudioJoinCanvasProjection["targets"];
  onJoinTarget?: (id: string, edge: StudioJoinEdge) => void;
  directFootprint?: StudioPlanFootprint;
  proposed: { label: string; points: Point[] } | null;
  joined: ResolvedStudioScene["joins"];
};
/** SVG presentation and hit ordering. Pointer/camera mechanics are owned by the
 * Plan viewport adapter; authored placement remains in its domain controller. */
export default function StudioHousePlan({
  viewport,
  persistentViewport,
  sceneGeneration,
  gesturePhase,
  houses,
  products,
  resolvedScene,
  selected,
  onSelect,
  readOnly,
  preview,
  directDrag,
  section,
  placement,
  repairTarget,
  targets,
  pickedTarget,
  onTarget,
  joinTargets,
  onJoinTarget,
  directFootprint,
  proposed,
  joined,
}: Props) {
  const accessoryInput =
    !readOnly && !placement && (section === "Sides" || section === "Lighting");
  const selectedGrab =
    directDrag &&
    products
      .filter((p) => p.object.id === selected && p.geometry && p.position)
      .map((p) => (
        <polygon
          key={`grab-${p.object.id}`}
          data-selected-product-grab={p.object.id}
          aria-hidden="true"
          points={p
            .geometry!.plan.outline.map((v) => {
              const q = transformWebsitePoint(v, p.position!);
              return `${q.x},${q.y}`;
            })
            .join(" ")}
          fill="transparent"
          stroke="none"
          pointerEvents="fill"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            viewport.startDrag(e, p.object.id);
          }}
        />
      ));
  return (
    <div className={css.housePlanViewport}>
      <svg
        ref={viewport.svg}
        className={css.housePlan}
        viewBox={viewport.planFrame}
        aria-label="Studio design Plan"
        data-scene-generation={sceneGeneration}
        data-gesture-phase={gesturePhase}
        {...viewport.handlers}
      >
        <g transform="scale(1 -1)" className={css.worldPlan}>
          {persistentViewport && (
            <g pointerEvents="none" aria-label="World origin, X zero Y zero">
              <path
                d={`M ${-10 * viewport.unitsPerPixel} 0 H ${10 * viewport.unitsPerPixel} M 0 ${-10 * viewport.unitsPerPixel} V ${10 * viewport.unitsPerPixel}`}
                stroke="#46534a"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={12 * viewport.unitsPerPixel}
                y={-12 * viewport.unitsPerPixel}
                fontSize={11 * viewport.unitsPerPixel}
                fill="#46534a"
                stroke="var(--ui-canvas)"
                strokeWidth={3 * viewport.unitsPerPixel}
                paintOrder="stroke"
              >
                0, 0
              </text>
            </g>
          )}
          {houses.map((g) => {
            return (
              <g key={g.house.id}>
                <polygon
                  points={g.footprint.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="#ddd8cc"
                  stroke={selected === g.house.id ? "#826344" : "#777"}
                  strokeWidth={18}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${g.house.label}`}
                  onClick={() => onSelect(g.house.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSelect(g.house.id);
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    onSelect(g.house.id);
                    viewport.startDrag(e, g.house.id);
                  }}
                />
                {g.roof.map((r, i) => (
                  <polygon
                    key={i}
                    points={r.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="#999"
                    strokeWidth={8}
                    pointerEvents="none"
                  />
                ))}
              </g>
            );
          })}
          {directDrag &&
            preview &&
            (resolvedScene?.products ?? products)
              .filter(
                (p) => p.object.id === selected && p.geometry && p.position,
              )
              .map((p) => (
                <polygon
                  key={`original-${p.object.id}`}
                  points={p
                    .geometry!.plan.outline.map((v) => {
                      const q = transformWebsitePoint(v, p.position!);
                      return `${q.x},${q.y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#6b736a"
                  strokeWidth={1.5}
                  strokeDasharray="6 5"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                >
                  <title>Previous placement</title>
                </polygon>
              ))}
          {accessoryInput && selectedGrab}
          {products.map((p, i) => {
            if (!p.geometry || !p.position || !p.design) return null;
            const pose = p.position;
            return (
              <StudioProductContext
                key={p.object.id}
                row={p}
                active={selected === p.object.id && !readOnly}
                night={false}
              >
                <g
                  transform={`translate(${pose.x} ${pose.y}) rotate(${p.position.rotation})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${p.object.label}`}
                  onClick={() => onSelect(p.object.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.target === e.currentTarget)
                      onSelect(p.object.id);
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    // Opening/light controls own their click. Capturing here
                    // would retarget pointer-up before that click can complete.
                    if (
                      (e.target as Element).closest(
                        '[role="button"],button,input,select',
                      ) !== e.currentTarget
                    )
                      return;
                    onSelect(p.object.id);
                    viewport.startDrag(e, p.object.id);
                  }}
                >
                  <PreviewPlanProduct
                    plan={p.geometry.plan}
                    covering={p.geometry.covering}
                    roofPlanes={p.geometry.assembly.roofPlanes}
                    flashings={p.geometry.assembly.roofFlashings}
                    profile={p.design.roof.finish?.profile}
                    trayWidth={p.design.roof.finish?.trayWidth}
                    scale={0.065}
                    idPrefix={`studio-${i}`}
                    inlineDefs
                    showRoofFallLabel={false}
                    readOnly={
                      readOnly ||
                      placement ||
                      (section !== "Sides" && section !== "Lighting") ||
                      selected !== p.object.id
                    }
                  />
                  <polygon
                    points={p.geometry.plan.outline
                      .map((v) => `${v.x},${v.y}`)
                      .join(" ")}
                    fill="none"
                    stroke={
                      p.referenceDisplay
                        ? "#a56422"
                        : directDrag && preview && selected === p.object.id
                          ? "#356445"
                          : selected === p.object.id
                            ? "#826344"
                            : "#787e74"
                    }
                    strokeWidth={selected === p.object.id ? 22 : 8}
                    pointerEvents="none"
                  />
                </g>
              </StudioProductContext>
            );
          })}
          {products.map((p) => {
            if (!p.geometry || !p.position) return null;
            const pose = p.position;
            const pts = p.geometry.plan.outline.map((v) =>
              transformWebsitePoint(v, pose),
            );
            const x = pts.reduce((n, p) => n + p.x / pts.length, 0),
              y =
                Math.min(...pts.map((p) => p.y)) + 20 * viewport.unitsPerPixel;
            return (
              <text
                key={p.object.id}
                x={x}
                y={y}
                textAnchor="middle"
                fontSize={13 * viewport.unitsPerPixel}
                fontWeight={selected === p.object.id ? 600 : 400}
                stroke="var(--ui-canvas)"
                strokeWidth={4 * viewport.unitsPerPixel}
                paintOrder="stroke"
                pointerEvents="none"
              >
                {p.object.label}
                {p.referenceDisplay ? " · Reference" : ""}
              </text>
            );
          })}
          {section !== "Lighting" &&
            section !== "Sides" &&
            products.flatMap((p) => {
              if (!p.geometry || !p.position) return [];
              const pose = p.position;
              return p.geometry.assembly.roofPlanes.flatMap((plane) => {
                if (
                  !plane.boundary.length ||
                  !Math.hypot(plane.fallVector.x, plane.fallVector.y)
                )
                  return [];
                const local = plane.boundary.reduce(
                  (a, v) => ({
                    x: a.x + v.x / plane.boundary.length,
                    y: a.y + v.y / plane.boundary.length,
                    z: 0,
                  }),
                  { x: 0, y: 0, z: 0 },
                );
                const world = transformWebsitePoint(local, pose);
                return (
                  <text
                    key={`${p.object.id}:${plane.id}`}
                    data-roof-fall-label
                    x={world.x + 12 * viewport.unitsPerPixel}
                    y={world.y + 16 * viewport.unitsPerPixel}
                    fontSize={12 * viewport.unitsPerPixel}
                    stroke="var(--ui-canvas)"
                    strokeWidth={3 * viewport.unitsPerPixel}
                    paintOrder="stroke"
                    pointerEvents="none"
                  >
                    Roof fall
                  </text>
                );
              });
            })}
          {repairTarget && (
            <g pointerEvents="none" aria-label="Affected house edge">
              <line
                x1={repairTarget.start.x}
                y1={repairTarget.start.y}
                x2={repairTarget.end.x}
                y2={repairTarget.end.y}
                stroke="#a56422"
                strokeWidth={5}
                strokeDasharray="8 4"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={(repairTarget.start.x + repairTarget.end.x) / 2}
                y={
                  (repairTarget.start.y + repairTarget.end.y) / 2 -
                  20 * viewport.unitsPerPixel
                }
                fontSize={13 * viewport.unitsPerPixel}
              >
                Affected house edge
              </text>
            </g>
          )}
          {targets
            .filter((t) => directDrag || !t.error)
            .map((t) => (
              <g
                key={`${t.houseId}:${t.side}`}
                role="button"
                tabIndex={0}
                aria-label={`Preview ${t.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTarget?.(t);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onTarget?.(t);
                  }
                }}
              >
                <line
                  x1={t.start.x}
                  y1={t.start.y}
                  x2={t.end.x}
                  y2={t.end.y}
                  stroke="transparent"
                  strokeWidth={24}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="stroke"
                />
                <line
                  x1={t.start.x}
                  y1={t.start.y}
                  x2={t.end.x}
                  y2={t.end.y}
                  stroke={
                    pickedTarget === `${t.houseId}:${t.side}`
                      ? "#356445"
                      : "#826344"
                  }
                  strokeWidth={
                    pickedTarget === `${t.houseId}:${t.side}` ? 4 : 1.5
                  }
                  strokeDasharray={
                    pickedTarget === `${t.houseId}:${t.side}`
                      ? undefined
                      : "5 4"
                  }
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                <text
                  x={(t.start.x + t.end.x) / 2}
                  y={(t.start.y + t.end.y) / 2 - 16 * viewport.unitsPerPixel}
                  fontSize={13 * viewport.unitsPerPixel}
                >
                  {t.side}
                  {t.error ? " · unavailable" : ""}
                </text>
              </g>
            ))}
          {joinTargets.map((t) => (
            <JoinPlanTarget
              unitsPerPixel={viewport.unitsPerPixel}
              key={`${t.id}:${t.edge}`}
              target={t}
              onChoose={() => onJoinTarget?.(t.id, t.edge)}
            />
          ))}
          {/* Ordinary placement keeps the selected body above generous house targets. */}
          {!accessoryInput && selectedGrab}
          {directFootprint && (
            <g pointerEvents="none" data-direct-footprint>
              <polygon
                points={directFootprint.original
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill="none"
                stroke="#46524a"
                strokeWidth={2}
                strokeDasharray="7 5"
                vectorEffect="non-scaling-stroke"
              />
              <polygon
                points={directFootprint.points
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill="#87aa89"
                fillOpacity={0.55}
                stroke="#245838"
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
              />
              {!directFootprint.guides?.length && directFootprint.target && (
                <line
                  x1={directFootprint.target.start.x}
                  y1={directFootprint.target.start.y}
                  x2={directFootprint.target.end.x}
                  y2={directFootprint.target.end.y}
                  stroke="#1b7139"
                  strokeWidth={5}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {directFootprint.guides?.map((g) => (
                <g
                  key={g.key}
                  data-axis-guide={g.axis ?? "normal"}
                  data-moving-edge={
                    g.witness.kind === "edge" ? g.witness.index : -1
                  }
                  data-witness-kind={g.witness.kind}
                  data-witness-index={g.witness.index}
                  data-target-key={g.key}
                >
                  <line
                    x1={g.target.start.x}
                    y1={g.target.start.y}
                    x2={g.target.end.x}
                    y2={g.target.end.y}
                    stroke="#1b7139"
                    strokeWidth={4}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={(g.target.start.x + g.target.end.x) / 2}
                    y={
                      (g.target.start.y + g.target.end.y) / 2 -
                      18 * viewport.unitsPerPixel
                    }
                    fontSize={13 * viewport.unitsPerPixel}
                    fill="#1b7139"
                  >
                    {g.witness.kind === "vertex"
                      ? "Corner aligned"
                      : g.axis
                        ? g.axis.toUpperCase() + " · Align"
                        : "Edge aligned"}
                  </text>
                </g>
              ))}
            </g>
          )}
          {proposed && (
            <g pointerEvents="none">
              <polygon
                points={proposed.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="#8c9d81"
                fillOpacity={0.22}
                stroke="#506743"
                strokeWidth={35}
                strokeDasharray="90 45"
              />
              <text
                textAnchor="middle"
                x={
                  (Math.min(...proposed.points.map((p) => p.x)) +
                    Math.max(...proposed.points.map((p) => p.x))) /
                  2
                }
                y={
                  (Math.min(...proposed.points.map((p) => p.y)) +
                    Math.max(...proposed.points.map((p) => p.y))) /
                  2
                }
                fontSize={13 * viewport.unitsPerPixel}
              >
                Proposed {proposed.label}
              </text>
            </g>
          )}
          {joined
            .filter((s) => s.witness)
            .map((s) => {
              const w = s.witness!,
                n = w.normal,
                t = { x: -n.y, y: n.x },
                a = Math.min(...w.contact.map((p) => p.x)),
                b = Math.max(...w.contact.map((p) => p.x));
              return (
                <line
                  key={s.join.id}
                  x1={n.x * w.plane + t.x * a}
                  y1={n.y * w.plane + t.y * a}
                  x2={n.x * w.plane + t.x * b}
                  y2={n.y * w.plane + t.y * b}
                  stroke="#826344"
                  strokeWidth={45}
                >
                  <title>{s.label}</title>
                </line>
              );
            })}
        </g>
      </svg>
    </div>
  );
}
