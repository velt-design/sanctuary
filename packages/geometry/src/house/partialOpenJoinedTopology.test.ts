import { describe, expect, it } from 'vitest';
import type {
  GeometryConfig,
  HouseFootprintPreset,
  Polygon3,
} from '../contracts';
import { buildHouseFootprintPolygon } from '../footprints';
import { buildHouseModel3D } from '../houseModel';
import { deriveHouseGableTerminalEndsFromFootprint } from './roofJoined';

// Regression matrix for partial-open joined topology (one terminal
// end opened on a non-rectangular hipped roof). The wavefront-based
// `buildJoinedRectilinearHippedRoof` is the workbench's primary path
// for custom polygons (95% of jobs per product); this matrix pins
// per-(topology x terminal) outcomes so deeper geometry fixes have a
// stable verification surface.
//
// `it.fails` is the contract for known failures: it passes ONLY if
// the inner expectations throw. When a deeper wavefront fix lands
// and the assertion starts passing, vitest flips the test red so we
// know to drop the marker -- the matrix surfaces newly working cases
// the moment they appear, rather than silently regressing into
// `.skip` rot.

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
  // Both ridge axes are exercised for every fixture -- terminal-end
  // sets differ per axis and we want the matrix to cover both.
  ridgeAxes?: ReadonlyArray<'x' | 'y'>;
};

function presetFootprint(preset: HouseFootprintPreset): Polygon3 {
  return buildHouseFootprintPolygon({
    pergolaWidthMm: 6000,
    pergolaDepthMm: 1800,
    preset,
    attachmentSide: 'rear',
  });
}

// Custom topology gallery: each fixture is a CCW orthogonal polygon
// that exercises a specific reflex-corner pattern. Naming is
// deliberate -- the topology name shows up in test output so a
// future agent can pattern-match a new failure against a known
// shape.
const CUSTOM_FIXTURES: readonly TopologyFixture[] = [
  {
    // Pure rectangle. Baseline control -- every terminal must work.
    // If this ever fails, the rectangular path regressed.
    name: 'custom-rectangle',
    footprint: [
      { x: 0, y: 0, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 6000, y: 4000, z: 0 },
      { x: 0, y: 4000, z: 0 },
    ],
  },
  {
    // Simple L: one reflex corner. Same topology as preset l_left
    // but with custom dimensions.
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
    // Recess (notch cut into one edge): two reflex corners flanking
    // an interior edge. The notch edge is a terminal end whose
    // immediate neighbours are reflex corners -- a key failure
    // pattern.
    name: 'custom-recess',
    footprint: [
      { x: 0, y: 0, z: 0 },
      { x: 9000, y: 0, z: 0 },
      { x: 9000, y: 3000, z: 0 },
      { x: 6000, y: 3000, z: 0 },
      { x: 6000, y: 1500, z: 0 },
      { x: 3000, y: 1500, z: 0 },
      { x: 3000, y: 3000, z: 0 },
      { x: 0, y: 3000, z: 0 },
    ],
  },
  {
    // T-shape: long horizontal bar with a vertical arm. Three
    // reflex corners. Custom-only (no T preset).
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
  {
    // Plus / cross: maximum reflex corners (4). Stress test.
    name: 'custom-plus',
    footprint: [
      { x: 3000, y: 0, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 6000, y: 3000, z: 0 },
      { x: 9000, y: 3000, z: 0 },
      { x: 9000, y: 6000, z: 0 },
      { x: 6000, y: 6000, z: 0 },
      { x: 6000, y: 9000, z: 0 },
      { x: 3000, y: 9000, z: 0 },
      { x: 3000, y: 6000, z: 0 },
      { x: 0, y: 6000, z: 0 },
      { x: 0, y: 3000, z: 0 },
      { x: 3000, y: 3000, z: 0 },
    ],
  },
  {
    // Asymmetric staircase: reflex corners that don't pair
    // symmetrically. Exercises the wavefront's response to
    // non-mirror topology.
    name: 'custom-staircase',
    footprint: [
      { x: 0, y: 0, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 6000, y: 2000, z: 0 },
      { x: 4000, y: 2000, z: 0 },
      { x: 4000, y: 4000, z: 0 },
      { x: 2000, y: 4000, z: 0 },
      { x: 2000, y: 6000, z: 0 },
      { x: 0, y: 6000, z: 0 },
    ],
  },
];

// Known failures: terminal ends that produce invalid geometry today.
// Format: `${fixtureName}:${ridgeAxis}:${terminalEndId}`. Drop an
// entry when the corresponding case starts producing valid geometry
// (it.fails will turn red and tell you to update this set).
//
// Each entry should ideally cite the underlying failure mode (the
// Phase 1 diagnostic populates the comment for each). Initial set
// reflects the geometry-side state immediately after the session A
// validator-strictness fix.
// Phase 0 baseline: 18 known failures across 3 distinct failure
// modes (captured 2026-05-14). Each entry is annotated with its
// roofQaFailureReason so Phase 1's diagnostic can group fixes by
// root cause. The matrix is GREEN at this baseline.
//
// Failure mode summary:
//
//   A. `roof_topology_fallback_features` (12 cases)
//      Feature derivation hit the re-entrant fallback path. The
//      wavefront produced regions but the topology classifier
//      couldn't place a feature (ridge/valley/hip) without
//      synthesizing one. Most common; clustered around
//      reflex-corner-adjacent terminal ends.
//
//   B. `overlapping_boundary_fragments` (4 cases, all y-ridge)
//      Two facets share a boundary fragment that overlaps in 2D.
//      Surfaced by the eave-validator on the joined output. Mostly
//      symmetric (preset-recess) -- the matrix's y-axis variant
//      exposes a different wavefront pass than the x-axis variant
//      on the same footprint.
//
//   C. `roof_topology_face_count_mismatch:8:7` (1 case: custom-recess y-5)
//      One MORE facet than expected. The session A fix (subtract
//      stationary edges from expected count) addressed the under-
//      count case; this is the inverse. Likely a spurious region
//      split near a reflex corner.
//
//   D. `roof_wavefront_missing_next_event` (1 case: custom-t y-1)
//      Event scheduler returned null when there were still active
//      loop segments. Numerical edge case; likely a degenerate
//      collapse-distance calculation near a reflex vertex.
//
// Drop an entry the moment its underlying fix lands -- vitest will
// flip the test red and tell you to update this set. New failures
// (regressions on a working case) ALSO surface immediately because
// they won't be in this set and the matrix will turn red.
const KNOWN_FAILURES: ReadonlySet<string> = new Set([
  // Mode A: roof_topology_fallback_features
  'preset-recess_left:x:house-gable-end-x-4',
  'preset-recess_right:x:house-gable-end-x-4',
  'custom-l:x:house-gable-end-x-4',
  'custom-l:y:house-gable-end-y-3',
  'custom-recess:x:house-gable-end-x-6',
  'custom-recess:x:house-gable-end-x-4',
  'custom-t:x:house-gable-end-x-6',
  'custom-t:x:house-gable-end-x-4',
  'custom-t:y:house-gable-end-y-7',
  'custom-t:y:house-gable-end-y-3',
  'custom-staircase:x:house-gable-end-x-4',
  'custom-staircase:y:house-gable-end-y-5',

  // Mode B: overlapping_boundary_fragments
  'preset-recess_left:y:house-gable-end-y-5',
  'preset-recess_right:y:house-gable-end-y-3',
  'custom-staircase:x:house-gable-end-x-6',
  'custom-staircase:y:house-gable-end-y-3',

  // Mode C: roof_topology_face_count_mismatch:8:7 (over-count)
  'custom-recess:y:house-gable-end-y-5',

  // Mode D: roof_wavefront_missing_next_event
  'custom-t:y:house-gable-end-y-1',
]);

function buildPartialOpenConfig(input: {
  footprint: Polygon3;
  ridgeAxis: 'x' | 'y';
  openGableEndIds: string[];
}): GeometryConfig {
  const { footprint } = input;
  return {
    projectId: 'project_partial_open',
    estimateId: 'estimate_partial_open',
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
        roofAppendage: null,
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

function exerciseTerminalEnd(input: {
  footprint: Polygon3;
  ridgeAxis: 'x' | 'y';
  terminalEndId: string;
}): void {
  const model = buildHouseModel3D({
    config: buildPartialOpenConfig({
      footprint: input.footprint,
      ridgeAxis: input.ridgeAxis,
      openGableEndIds: [input.terminalEndId],
    }),
    attachmentEdge: makeAttachmentEdge(),
  });
  expect(model, `${input.terminalEndId} produced no model`).not.toBeNull();
  expect(
    model?.metadata?.roofQaStatus,
    `${input.terminalEndId} roofQaStatus`,
  ).toBe('valid');
  expect(
    model?.metadata?.roofQaFailureReason,
    `${input.terminalEndId} roofQaFailureReason`,
  ).toBeNull();
  // The opened terminal should produce an open_gable_frame wall.
  // If the geometry is "technically valid" but the wall metadata is
  // wrong, the user still sees broken UX.
  const openWall = model?.wallSegments.find(
    (segment) => segment.metadata?.gableEndId === input.terminalEndId,
  );
  expect(
    openWall?.metadata?.houseWallMode,
    `${input.terminalEndId} houseWallMode`,
  ).toBe('open_gable_frame');
}

function runMatrix(input: {
  fixtureName: string;
  footprint: Polygon3;
  ridgeAxis: 'x' | 'y';
}): void {
  const terminalEnds = deriveHouseGableTerminalEndsFromFootprint({
    footprint: input.footprint,
    ridgeAxis: input.ridgeAxis,
  });
  if (terminalEnds.length === 0) {
    it(`${input.fixtureName} (${input.ridgeAxis}-ridge) has no terminal ends to exercise`, () => {
      // Empty topology -- skip but record so we know it was considered.
      expect(terminalEnds.length).toBe(0);
    });
    return;
  }
  for (const terminal of terminalEnds) {
    const key = `${input.fixtureName}:${input.ridgeAxis}:${terminal.id}`;
    const test = KNOWN_FAILURES.has(key) ? it.fails : it;
    test(`${input.fixtureName} (${input.ridgeAxis}-ridge) opens ${terminal.id}`, () => {
      exerciseTerminalEnd({
        footprint: input.footprint,
        ridgeAxis: input.ridgeAxis,
        terminalEndId: terminal.id,
      });
    });
  }
}

describe('partial-open joined topology regression matrix', () => {
  describe('preset footprints', () => {
    for (const preset of ALL_PRESETS) {
      const footprint = presetFootprint(preset);
      for (const ridgeAxis of ['x', 'y'] as const) {
        runMatrix({ fixtureName: `preset-${preset}`, footprint, ridgeAxis });
      }
    }
  });

  describe('custom (non-preset) footprints -- 95% of production jobs', () => {
    for (const fixture of CUSTOM_FIXTURES) {
      const axes = fixture.ridgeAxes ?? (['x', 'y'] as const);
      for (const ridgeAxis of axes) {
        runMatrix({
          fixtureName: fixture.name,
          footprint: fixture.footprint,
          ridgeAxis,
        });
      }
    }
  });
});
