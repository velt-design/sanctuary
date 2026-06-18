import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  GeometryConfig,
  HouseFootprintPreset,
  Polygon3,
} from '../contracts';
import { buildHouseFootprintPolygon } from '../footprints';
import { buildHouseModel3D } from '../houseModel';
import { deriveHouseGableTerminalEndsFromFootprint } from './roofJoined';

/**
 * PR-HR4 (2026-06-18): property-based regression matrix for the full
 * orthogonal hipped-roof space.
 *
 * Complements two existing test surfaces:
 *   - `roofPresetCoverage.test.ts` exercises presets with NO opens
 *     (fully hipped baseline).
 *   - `partialOpenJoinedTopology.test.ts` exercises one terminal open
 *     at a time across presets + a custom-topology gallery.
 *
 * This file fills the remaining gap: MULTI-open configurations
 * (none, all, every pair) and a captured-fixture loader that reads
 * any `.json` file dropped into `__fixtures__/captured/` by the
 * designer-facing "Save bug report" button (PR-HR1) and exercises
 * the full geometry pipeline against it.
 *
 * Quarantine contract: `it.fails` for known-broken cases. When a
 * deeper fix lands and a case starts passing, vitest flips the
 * marker red so we know to drop it. Newly-failing cases (regressions
 * on a previously-passing case) surface immediately because they
 * won't be in `KNOWN_MULTI_OPEN_FAILURES` and the matrix turns red.
 *
 * Initial baseline (when this file lands): TBD — first CI run
 * populates the quarantine.
 */

const ALL_PRESETS: readonly HouseFootprintPreset[] = [
  'straight',
  'l_left',
  'l_right',
  'recess_left',
  'recess_right',
  'u_shape',
  'wrap_left',
  'wrap_right',
];

type TopologyFixture = {
  name: string;
  footprint: Polygon3;
};

const CUSTOM_FIXTURES: readonly TopologyFixture[] = [
  {
    name: 'custom-rectangle',
    footprint: [
      { x: 0, y: 0, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 6000, y: 4000, z: 0 },
      { x: 0, y: 4000, z: 0 },
    ],
  },
  {
    name: 'custom-l',
    footprint: [
      { x: 0, y: 0, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 6000, y: 2000, z: 0 },
      { x: 3000, y: 2000, z: 0 },
      { x: 3000, y: 4000, z: 0 },
      { x: 0, y: 4000, z: 0 },
    ],
  },
  {
    name: 'custom-t',
    footprint: [
      { x: 0, y: 0, z: 0 },
      { x: 9000, y: 0, z: 0 },
      { x: 9000, y: 2000, z: 0 },
      { x: 6000, y: 2000, z: 0 },
      { x: 6000, y: 5000, z: 0 },
      { x: 3000, y: 5000, z: 0 },
      { x: 3000, y: 2000, z: 0 },
      { x: 0, y: 2000, z: 0 },
    ],
  },
];

/**
 * Known multi-open failure quarantine. Populate after the first CI run
 * shows which cases need attention; PR-HR5 burns this down.
 */
const KNOWN_MULTI_OPEN_FAILURES: ReadonlySet<string> = new Set<string>([]);

function presetFootprint(preset: HouseFootprintPreset): Polygon3 {
  return buildHouseFootprintPolygon({
    pergolaWidthMm: 6000,
    pergolaDepthMm: 1800,
    preset,
    attachmentSide: 'rear',
  });
}

function buildMultiOpenConfig(input: {
  footprint: Polygon3;
  ridgeAxis: 'x' | 'y';
  openGableEndIds: string[];
}): GeometryConfig {
  const { footprint } = input;
  return {
    projectId: 'project_multi_open',
    estimateId: 'estimate_multi_open',
    designRequestId: null,
    family: 'mono',
    datum: {
      origin: { x: 0, y: 0, z: 0 },
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 1, z: 0 },
      zAxis: { x: 0, y: 0, z: 1 },
      attachmentEdgeStart: { x: 0, y: 0, z: 0 },
      attachmentEdgeEnd: { x: 6000, y: 0, z: 0 },
    },
    dimensions: { lengthMm: 6000, projectionMm: 3000, roofPitchDeg: 5 },
    roof: {
      material: 'acrylic',
      mode: null,
      fallDirection: 'positiveY',
      boxPerimeterEnabled: false,
      overhangMm: 0,
    },
    roofCovering: {
      kind: null,
      effectiveRunMm: null,
      acrylicRequiredDownslopeMm: null,
      joinerPieceLengthMm: null,
      joinerRunsTotal: null,
      houseAllowanceMm: null,
      farAllowanceMm: null,
      acrylicAreaMm2: null,
    },
    gable: {
      ridgePositionMm: null,
      endFramesMode: null,
      houseEaveGutterMode: null,
      outerEaveGutterMode: null,
    },
    box: {
      houseEdgeGutterMode: null,
      farEdgeGutterMode: null,
      houseSetbackMm: null,
      outerSetbackMm: null,
      effectiveRunMm: null,
      riseMm: null,
      maxFallMm: null,
    },
    connection: { type: 'soffit', attachmentSide: 'rear' },
    supports: {
      postMode: 'standard',
      postCount: 2,
      postCutHeightMm: 2400,
      footingType: 'slab',
      postConnectionType: 'slab_anchors',
      groundCondition: 'easy',
      groundLevelMm: 0,
    },
    structural: {
      heights: {
        houseUndersideMm: 2400,
        outerUndersideMm: 2137,
        referenceUndersideMm: 2400,
      },
      profiles: {
        post: { shape: 'rectangular', widthMm: 90, depthMm: 90 },
        rafter: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
        ledger: { shape: 'rectangular', widthMm: 50, depthMm: 100 },
        supportBeam: { shape: 'rectangular', widthMm: 50, depthMm: 150 },
        gutter: { shape: 'rectangular', widthMm: 100, depthMm: 100 },
        ridge: null,
        boxPerimeter: null,
      },
      framing: { rafterCount: 11, rafterSpacingMm: 600 },
      drainage: {
        gutterType: 'sp_gutter',
        gutterAssemblyMode: 'integrated',
        integratedGutterBeam: true,
        hasOurGutter: true,
      },
    },
    houseContext: {
      wallLine: null,
      fasciaLine: null,
      roofEdgeLine: null,
      soffitDepthMm: 450,
      footprint,
      attachmentStrategy: 'soffit_brackets',
      model: {
        footprint,
        storeyMode: 'single_storey',
        wallConstruction: 'timber_frame',
        roofForm: 'hipped',
        eaveHeightMm: 2400,
        wallHeightMm: 2400,
        roofPitchDeg: 25,
        roofPrimaryFallDirection: 'positive_y',
        roofRidgeAxis: input.ridgeAxis,
        openGableEndIds: input.openGableEndIds,
        attachmentStrategy: 'soffit_brackets',
        eave: {
          soffitDepthMm: 450,
          fasciaHeightMm: 180,
          gutterWidthMm: 125,
          gutterDepthMm: 90,
          gutterProjectionMm: 125,
          eaveOverhangMm: 450,
        },
      },
    },
  };
}

function makeAttachmentEdge() {
  return { start: { x: 0, y: 0, z: 2400 }, end: { x: 6000, y: 0, z: 2400 } };
}

function exerciseMultiOpen(input: {
  footprint: Polygon3;
  ridgeAxis: 'x' | 'y';
  openGableEndIds: string[];
  label: string;
}): void {
  const model = buildHouseModel3D({
    config: buildMultiOpenConfig({
      footprint: input.footprint,
      ridgeAxis: input.ridgeAxis,
      openGableEndIds: input.openGableEndIds,
    }),
    attachmentEdge: makeAttachmentEdge(),
  });
  expect(model, `${input.label} produced no model`).not.toBeNull();
  expect(
    model?.metadata?.roofQaStatus,
    `${input.label} roofQaStatus`,
  ).toBe('valid');
  expect(
    model?.metadata?.roofQaFailureReason,
    `${input.label} roofQaFailureReason`,
  ).toBeNull();
}

/**
 * Enumerate the multi-open cases worth testing without exploding the
 * matrix to a full power set. For N terminal ends we exercise:
 *   - empty subset (fully hipped — baseline control)
 *   - full subset (fully gabled)
 *   - every adjacent pair (the most common designer configuration)
 *
 * Total per (fixture × ridgeAxis): 2 + N cases (down from 2^N).
 */
function* enumerateMultiOpenSubsets(
  terminalEndIds: readonly string[],
): Iterable<{ label: string; openGableEndIds: string[] }> {
  yield { label: 'none-open', openGableEndIds: [] };
  if (terminalEndIds.length > 0) {
    yield { label: 'all-open', openGableEndIds: [...terminalEndIds] };
  }
  for (let i = 0; i < terminalEndIds.length - 1; i += 1) {
    yield {
      label: `adjacent-pair[${terminalEndIds[i]}+${terminalEndIds[i + 1]}]`,
      openGableEndIds: [terminalEndIds[i]!, terminalEndIds[i + 1]!],
    };
  }
}

function runMultiOpenMatrix(input: {
  fixtureName: string;
  footprint: Polygon3;
  ridgeAxis: 'x' | 'y';
}): void {
  const terminalEnds = deriveHouseGableTerminalEndsFromFootprint({
    footprint: input.footprint,
    ridgeAxis: input.ridgeAxis,
  });
  if (terminalEnds.length === 0) {
    it(`${input.fixtureName} (${input.ridgeAxis}-ridge) has no terminal ends`, () => {
      expect(terminalEnds.length).toBe(0);
    });
    return;
  }
  const ids = terminalEnds.map((end) => end.id);
  for (const subset of enumerateMultiOpenSubsets(ids)) {
    const key = `${input.fixtureName}:${input.ridgeAxis}:${subset.label}`;
    const test = KNOWN_MULTI_OPEN_FAILURES.has(key) ? it.fails : it;
    test(`${input.fixtureName} (${input.ridgeAxis}-ridge) multi-open ${subset.label}`, () => {
      exerciseMultiOpen({
        footprint: input.footprint,
        ridgeAxis: input.ridgeAxis,
        openGableEndIds: subset.openGableEndIds,
        label: key,
      });
    });
  }
}

describe('orthogonal roof coverage matrix (PR-HR4) — multi-open subsets', () => {
  describe('preset footprints', () => {
    for (const preset of ALL_PRESETS) {
      const footprint = presetFootprint(preset);
      for (const ridgeAxis of ['x', 'y'] as const) {
        runMultiOpenMatrix({ fixtureName: `preset-${preset}`, footprint, ridgeAxis });
      }
    }
  });

  describe('custom (non-preset) footprints', () => {
    for (const fixture of CUSTOM_FIXTURES) {
      for (const ridgeAxis of ['x', 'y'] as const) {
        runMultiOpenMatrix({
          fixtureName: fixture.name,
          footprint: fixture.footprint,
          ridgeAxis,
        });
      }
    }
  });
});

/**
 * PR-HR4 (2026-06-18): captured-fixture loader.
 *
 * Reads every `.json` file under `__fixtures__/captured/` and
 * exercises the geometry pipeline against the captured footprint +
 * roof intent. The JSON shape is the `RoofFailureRepro` payload that
 * the portal's "Save bug report" button (PR-HR1) produces.
 *
 * Cross-package dependency note: this loader uses a *structural*
 * subset of the portal's `RoofFailureRepro` type — only the fields
 * needed to reconstruct a `buildHouseModel3D` input. The geometry
 * package intentionally does not import from `apps/portal/`.
 */
type CapturedRoofFailureFixture = {
  schemaVersion: number;
  validationStatus: 'invalid' | 'approximate';
  validationCode: string | null;
  failingStage: { id: string; label: string; code: string } | null;
  footprint: {
    polygonLocalM: Array<{ alongM: string; depthM: string }>;
  };
  roofIntent: {
    form: string;
    primaryPitchDeg: string;
    ridgeAxis: 'x' | 'y';
    openGableEndIds: string[];
  };
};

const CAPTURED_FIXTURE_DIR = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '__fixtures__',
  'captured',
);

const CAPTURED_KNOWN_FAILURES: ReadonlySet<string> = new Set<string>([]);

function metresStringToMm(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed * 1000 : 0;
}

function buildPolygonFromCaptured(
  polygonLocalM: CapturedRoofFailureFixture['footprint']['polygonLocalM'],
): Polygon3 {
  return polygonLocalM.map((point) => ({
    x: metresStringToMm(point.alongM),
    y: metresStringToMm(point.depthM),
    z: 0,
  }));
}

function loadCapturedFixtures(): Array<{
  filename: string;
  payload: CapturedRoofFailureFixture;
}> {
  if (!fs.existsSync(CAPTURED_FIXTURE_DIR)) return [];
  const entries: Array<{ filename: string; payload: CapturedRoofFailureFixture }> = [];
  for (const filename of fs.readdirSync(CAPTURED_FIXTURE_DIR)) {
    if (!filename.toLowerCase().endsWith('.json')) continue;
    const raw = fs.readFileSync(path.join(CAPTURED_FIXTURE_DIR, filename), 'utf8');
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `Captured fixture ${filename} is not valid JSON: ${(err as Error).message}`,
      );
    }
    // Schema version gate: PR-HR1 ships v1; bump rejects when the
    // schema changes so stale fixtures don't silently misbehave.
    const schemaVersion = (payload as { schemaVersion?: unknown })?.schemaVersion;
    if (schemaVersion !== 1) {
      throw new Error(
        `Captured fixture ${filename} has unsupported schemaVersion=${String(
          schemaVersion,
        )} (expected 1).`,
      );
    }
    entries.push({ filename, payload: payload as CapturedRoofFailureFixture });
  }
  return entries;
}

describe('orthogonal roof coverage matrix (PR-HR4) — captured fixtures', () => {
  const captured = loadCapturedFixtures();
  if (captured.length === 0) {
    it('no captured fixtures present (drop designer-saved bug reports into __fixtures__/captured/ to extend coverage)', () => {
      expect(captured.length).toBe(0);
    });
    return;
  }
  for (const { filename, payload } of captured) {
    const key = `captured:${filename}`;
    const test = CAPTURED_KNOWN_FAILURES.has(key) ? it.fails : it;
    test(`captured fixture ${filename} re-solves to valid QA`, () => {
      const footprint = buildPolygonFromCaptured(payload.footprint.polygonLocalM);
      exerciseMultiOpen({
        footprint,
        ridgeAxis: payload.roofIntent.ridgeAxis,
        openGableEndIds: payload.roofIntent.openGableEndIds,
        label: key,
      });
    });
  }
});
