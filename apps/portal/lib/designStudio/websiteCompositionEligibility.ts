import { parseWebsiteJoins } from "./websiteJoinIntent";
import { websiteProductPhysical } from "./websiteProductPhysical";
import { contactWebsiteEdges } from "./websiteJoinGeometry";
import { solvePergolaPreview } from "@sp/configurator/geometry";
import {
  transformWebsitePoint,
  websiteComposition,
} from "./websiteComposition";

import {
  websiteEligibilityEnvelope,
  type WebsiteEligibilityEnvelope,
} from "./websiteEligibilityEnvelope";
import type { WebsitePhysicalProduct } from "./websiteProductPhysical";
type Row = ReturnType<typeof websiteComposition>[number];
export type WebsiteEligibilityArtifacts = {
  envelope: (row: Readonly<Row>) => WebsiteEligibilityEnvelope | null;
  physical: (row: Readonly<Row>) => WebsitePhysicalProduct;
};
/** Fresh canonical/server boundary. Artifact reuse does not alter this authority. */
export function websiteCompositionPriceEligibility(
  rows: ReadonlyArray<Row>,
  joinValue?: unknown,
): string | null {
  return evaluateWebsiteCompositionEligibility(rows, joinValue, {
    physical: websiteProductPhysical,
    envelope: (row) => {
      const geometry = solvePergolaPreview(
        row.design!.input,
        row.design!.roof,
        row.geometryOptions,
      ).geometry;
      return geometry
        ? websiteEligibilityEnvelope(row.design!, geometry, row.geometryOptions)
        : null;
    },
  });
}
/** Conservative temporary eligibility for separated products, never a collision or join certificate. */
export function evaluateWebsiteCompositionEligibility(
  rows: ReadonlyArray<ReturnType<typeof websiteComposition>[number]>,
  joinValue: unknown,
  artifacts: WebsiteEligibilityArtifacts,
): string | null {
  const validPairs = new Set<string>();
  try {
    for (const join of joinValue
      ? parseWebsiteJoins(joinValue, new Set(rows.map((r) => r.object.id)))
          .joins
      : []) {
      const a = rows.find((r) => r.object.id === join.a.objectId)!,
        b = rows.find((r) => r.object.id === join.b.objectId)!;
      try {
        if (!a.position || !b.position) throw Error("Placement unavailable.");
        contactWebsiteEdges(
          artifacts.physical(a),
          join.a.edge,
          a.position,
          artifacts.physical(b),
          join.b.edge,
          b.position,
        );
        validPairs.add(JSON.stringify([a.object.id, b.object.id].sort()));
      } catch (error) {
        return `${a.object.label} / ${b.object.label}: ${error instanceof Error ? error.message : "Join unavailable."}`;
      }
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid joins.";
  }
  const bounds = [];
  for (const row of rows) {
    if (row.error || !row.design || !row.position)
      return `${row.object.label}: ${row.error ?? "Design geometry unavailable."}`;
    const points = artifacts.envelope(row);
    if (!points) return `${row.object.label}: design geometry unavailable.`;
    const world = points.map((p) => transformWebsitePoint(p, row.position!));
    if (
      !world.length ||
      world.some((p) => ![p.x, p.y, p.z].every(Number.isFinite))
    )
      return `${row.object.label}: physical bounds unavailable.`;
    bounds.push(
      world.reduce(
        (b, p) => ({
          ...b,
          minX: Math.min(b.minX, p.x),
          maxX: Math.max(b.maxX, p.x),
          minY: Math.min(b.minY, p.y),
          maxY: Math.max(b.maxY, p.y),
        }),
        {
          id: row.object.id,
          name: row.object.label,
          minX: Infinity,
          maxX: -Infinity,
          minY: Infinity,
          maxY: -Infinity,
        },
      ),
    );
  }
  for (let i = 0; i < bounds.length; i++)
    for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i],
        b = bounds[j];
      if (validPairs.has(JSON.stringify([a.id, b.id].sort()))) continue;
      if (
        a.minX <= b.maxX &&
        b.minX <= a.maxX &&
        a.minY <= b.maxY &&
        b.minY <= a.maxY
      )
        return `Cannot price this arrangement yet: ${a.name} and ${b.name} have touching or overlapping conservative bounds. Separate them before calculating; their choices are kept.`;
    }
  return null;
}
