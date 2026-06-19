import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { describe, expect, it } from "vitest";
import { applyRoofQa } from "./roofQa";
import { composeRoofFromComposition } from "./composition/composeRoofFromComposition";
import { composeFootprintFromComposition } from "./composition/composeFootprintFromComposition";
import type {
  HouseComposition,
  RectangleRoofIntent,
} from "./composition/types";

/**
 * PR-SS-1 (2026-06-19): canonical regression gauntlet for the
 * composition roof pipeline.
 *
 * This matrix IS the spec for the straight-skeleton replacement
 * (PR-SS-2 through PR-SS-6). Every shape designers can compose
 * with rectangles + Join is captured here as a fixture, with the
 * properties the FINAL solver must satisfy:
 *
 *   - composeRoofFromComposition + applyRoofQa produce
 *     `roofQaStatus: "valid"` (areas match, no rejected facets).
 *   - The result is NOT a stitched-per-rectangle fallback — i.e.
 *     `roofGeometry !== "composition_stitched"`. Stitched is the
 *     v1 placeholder; the skeleton-era solver must produce unified
 *     output for every fixture.
 *   - Roof plane count and valley count match the polygon's
 *     topology (one facet per polygon edge; one valley per reflex
 *     vertex for hipped composites).
 *
 * Fixtures that fail today carry a `knownFailure` block naming the
 * PR that will close the gap. Those tests use `it.fails` so the
 * suite flips red the moment a deeper fix lands and we know to
 * remove the quarantine flag. This is the same `it.fails`
 * quarantine pattern used in `partialOpenJoinedTopology.test.ts`
 * and `orthogonalRoofCoverageMatrix.test.ts`.
 *
 * Architectural rule: this file is the SPEC. The solver is correct
 * iff this matrix is all green. No fixture is removed without an
 * intentional design change recorded in `docs/decision-log.md`.
 */

type CompositionRegressionFixture = {
  schemaVersion: 1;
  name: string;
  description: string;
  composition: HouseComposition;
  compositeRoofIntent: RectangleRoofIntent;
  eaveHeightMm: number;
  expected: {
    qaStatus: "valid";
    facetCount: number;
    valleyCount: number;
    areaDeltaMaxAbsMm2: number;
    /**
     * If true, the result MUST NOT come from the stitched fallback
     * (`roofGeometry !== "composition_stitched"`). This is the
     * "unified topology required" assertion.
     */
    unifiedNotStitched: boolean;
  };
  /**
   * Quarantine flag for fixtures currently failing. When set, the
   * test uses `it.fails`: a passing test means we forgot to remove
   * the flag (the fix landed). Drop the flag when the closing PR
   * makes the assertions pass.
   */
  knownFailure?: { closesIn: string; reason: string };
};

const CORPUS_DIR = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "__fixtures__",
  "composition-corpus",
);

function loadCorpus(): Array<{
  filename: string;
  fixture: CompositionRegressionFixture;
}> {
  if (!fs.existsSync(CORPUS_DIR)) return [];
  return fs
    .readdirSync(CORPUS_DIR)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .sort()
    .map((filename) => {
      const raw = fs.readFileSync(path.join(CORPUS_DIR, filename), "utf8");
      const fixture = JSON.parse(raw) as CompositionRegressionFixture;
      if (fixture.schemaVersion !== 1) {
        throw new Error(
          `${filename}: unsupported schemaVersion ${fixture.schemaVersion} (expected 1)`,
        );
      }
      return { filename, fixture };
    });
}

function assertFixture(fixture: CompositionRegressionFixture): void {
  const composed = composeRoofFromComposition({
    composition: fixture.composition,
    eaveHeightMm: fixture.eaveHeightMm,
    compositeRoofIntent: fixture.compositeRoofIntent,
  });

  // Run QA against the integer-snapped union polygon (the same
  // polygon the solver should be using internally for unified
  // output). This mirrors what `swapRoofFromComposition` does in
  // production.
  const unionPolygon = composeFootprintFromComposition(fixture.composition);
  const eavePolygon = unionPolygon.map((p) => ({
    x: Math.round(p.x),
    y: Math.round(p.y),
    z: 0,
  }));
  const withQa = applyRoofQa({
    roof: {
      roofPlanes: composed.roofPlanes,
      roofFeatures: composed.roofFeatures,
      metadata: composed.metadata,
    },
    eavePolygon,
  });

  // Assertion 1: QA status matches expectation.
  expect(withQa.metadata.roofQaStatus, "roofQaStatus").toBe(
    fixture.expected.qaStatus,
  );

  // Assertion 2: area delta within tolerance (area conservation).
  const areaDelta = Math.abs(
    Number(withQa.metadata.roofQaAreaDeltaMm2 ?? 0),
  );
  expect(
    areaDelta,
    `roofQaAreaDeltaMm2 (got ${areaDelta}, max ${fixture.expected.areaDeltaMaxAbsMm2})`,
  ).toBeLessThanOrEqual(fixture.expected.areaDeltaMaxAbsMm2);

  // Assertion 3: facet count matches polygon topology.
  expect(withQa.roofPlanes.length, "facet count").toBe(
    fixture.expected.facetCount,
  );

  // Assertion 4: valley count matches reflex vertex count.
  const valleyCount = withQa.roofFeatures.filter(
    (f) => f.kind === "valley",
  ).length;
  expect(valleyCount, "valley count").toBe(fixture.expected.valleyCount);

  // Assertion 5: not a stitched fallback (when required).
  if (fixture.expected.unifiedNotStitched) {
    expect(withQa.metadata.roofGeometry, "roofGeometry").not.toBe(
      "composition_stitched",
    );
  }
}

describe("composition roof regression matrix (PR-SS-1) — the spec", () => {
  const corpus = loadCorpus();

  if (corpus.length === 0) {
    it("no fixtures present", () => {
      throw new Error(
        `No fixtures found in ${CORPUS_DIR}. The regression matrix is empty; the spec is undefined.`,
      );
    });
    return;
  }

  for (const { filename, fixture } of corpus) {
    const label = `${filename} :: ${fixture.name}`;
    if (fixture.knownFailure) {
      it.fails(
        `${label} [quarantined: closes in ${fixture.knownFailure.closesIn}]`,
        () => assertFixture(fixture),
      );
    } else {
      it(label, () => assertFixture(fixture));
    }
  }
});
