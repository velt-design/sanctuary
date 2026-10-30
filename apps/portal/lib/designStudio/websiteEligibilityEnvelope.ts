import type { solvePergolaPreview, PreviewGeometryOptions } from "@sp/configurator/geometry";
import { sidePanelSupports } from "@sp/configurator/website";
import {
  buildRepresentativeBlind,
  buildRepresentativeSidePanel,
  representativeBlindOpenings,
} from "@sp/geometry";
import type { websiteComposition } from "./websiteComposition";
type Design = NonNullable<
  ReturnType<typeof websiteComposition>[number]["design"]
>;
type Geometry = NonNullable<ReturnType<typeof solvePergolaPreview>["geometry"]>;
export type WebsiteEligibilityEnvelope = { x: number; y: number; z: number }[];
/** Exact existing conservative envelope. It is intentionally distinct from
 * rendered physical points and from a local axis-aligned bounding box. */
export function websiteEligibilityEnvelope(
  design: Design,
  geometry: Geometry,
  options?: PreviewGeometryOptions,
): WebsiteEligibilityEnvelope {
  const points: { x: number; y: number; z: number }[] = [];
  function meshPositions(values: unknown[]) {
    if (
      values.length % 3 ||
      values.some((v) => typeof v !== "number" || !Number.isFinite(v))
    ) {
      points.push({ x: NaN, y: NaN, z: NaN });
      return;
    }
    for (let i = 0; i < values.length; i += 3)
      points.push({
        x: values[i] as number,
        y: values[i + 1] as number,
        z: values[i + 2] as number,
      });
  }
  for (const m of geometry.assembly.members) {
    const radius = Math.hypot(m.profile.widthMm, m.profile.depthMm) / 2;
    for (const p of [m.centerline.start, m.centerline.end])
      for (const dx of [-radius, radius])
        for (const dy of [-radius, radius])
          points.push({ ...p, x: p.x + dx, y: p.y + dy });
  }
  // Covering contains actual roof/batten/ceiling boundaries. Including its local
  // vectors is conservative; no point can shrink the physical envelope.
  function collect(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (!value || typeof value !== "object") return;
    const p = value as Record<string, unknown>;
    if (
      typeof p.x === "number" &&
      typeof p.y === "number" &&
      typeof p.z === "number"
    )
      points.push({ x: p.x, y: p.y, z: p.z });
    else {
      if (Array.isArray(p.positions)) meshPositions(p.positions);
      Object.entries(p)
        .filter(([key]) => key !== "positions")
        .forEach(([, child]) => collect(child));
    }
  }
  collect(geometry.covering);
  collect(geometry.assembly.roofPlanes);
  collect(geometry.assembly.roofCladdingPanels);
  collect(geometry.assembly.roofFlashings);
  const openings = representativeBlindOpenings(geometry.assembly, options);
  const meshes = [
    ...(design.roof.blinds ?? []).flatMap((b) => {
      const o = openings.find((o) => o.id === b.opening);
      return o ? buildRepresentativeBlind(o, b) : [];
    }),
    ...(design.roof.sidePanels ?? []).flatMap((p) => {
      const o = openings.find((o) => o.id === p.opening);
      return o
        ? buildRepresentativeSidePanel(o, p, sidePanelSupports(o, p))
        : [];
    }),
  ];
  for (const mesh of meshes) meshPositions(mesh.positions);
  return points;
}
