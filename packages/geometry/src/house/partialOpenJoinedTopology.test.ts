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
// PR-HR5 state (2026-06-18): **0 active quarantines**. The matrix
// runs 66 of 66 cases green.
//
// Historical context:
//   Phase 1 (2026-05-14, commit `d2f3615` + `1aef41a`): 16 of 18
//     baseline failures resolved via two surgical fixes:
//       Mode A (12 cases) -- fallback_features flag relaxed when
//         stationary edges exist. The fallback's synthesized
//         reflex-vertex valley is correct geometry for partial-open;
//         the flag was over-reporting. Fix in `roofJoinedHipped.ts`.
//       Mode B (4 cases) + Mode C-staircase + Mode B/C-recess --
//         `joinedRoofWavefrontSweptRegions` now explicitly skips
//         stationary edges. Adjacent edges with same-direction inward
//         normals (recess / staircase reflex corners) caused
//         stationary endpoints to slide in unison, giving the swept
//         quad real area despite the edge being conceptually
//         "stationary". Those phantom regions tripped the dissolve
//         pass's fragment-cancellation invariant. Fix in
//         `roofJoinedWavefront.ts`.
//   Phase 2 (2026-05-14, commit `56de9de`): the remaining 2 cases
//     (`custom-recess:y:house-gable-end-y-5`,
//     `custom-t:y:house-gable-end-y-1`) closed not by patching the
//     wavefront's numerical convergence but by narrowing the
//     terminal-end derivation itself. The bent-spine derivation now
//     surfaces only **real wing-tip edges** (degree-1 ridge-graph
//     nodes); y-5 (recess) and y-1 (t) were diagonal medial-axis
//     connectors that the legacy "all axis-perpendicular edges"
//     heuristic over-included as terminals. A user can no longer
//     open them because they aren't classified as wing tips, so the
//     fragile-wavefront cases are unreachable from the workbench.
//
// New failures (regressions on a working case) surface immediately
// because they won't be in this set and the matrix will turn red.
const KNOWN_FAILURES: ReadonlySet<string> = new Set<string>();

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
    houseId: 'test-house',
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

describe('Phase 2: bent-spine derives wing-tip terminals across both ridge axes', () => {
  // Phase 2 contract: for any orthogonal polygon (preset or custom),
  // the bent-spine terminal derivation surfaces the real wing-tip
  // edges -- the polygon edges where a gable wall would close off a
  // visible roof tip. Both ridge axes converge to the SAME wing-tip
  // edge set because each axis's bent-spine medial-axis traces the
  // same polygon topology. Previously (before relaxing the axis-
  // aligned guard) the function fell back to a legacy "all axis-
  // perpendicular edges are terminals" heuristic that returned a
  // DIFFERENT, over-included set per axis -- e.g. for a custom L
  // ridge=x returned 3 vertical edges, ridge=y returned 3 horizontal
  // edges, none of which matched the user's mental model of "click
  // the wing tip".
  type FixtureCase = {
    name: string;
    footprint: Polygon3;
    expectedSourceEdgeIds: ReadonlyArray<string>;
  };
  const PHASE_2_FIXTURES: ReadonlyArray<FixtureCase> = [
    {
      name: 'custom-L-symmetric',
      footprint: [
        { x: 0, y: 0, z: 0 }, { x: 6000, y: 0, z: 0 },
        { x: 6000, y: 2000, z: 0 }, { x: 3000, y: 2000, z: 0 },
        { x: 3000, y: 4000, z: 0 }, { x: 0, y: 4000, z: 0 },
      ],
      // Wing tips: edge 2 (x-arm right at x=6000) + edge 5 (y-arm
      // top at y=4000). Both axes derive the same pair.
      expectedSourceEdgeIds: ['footprint-edge-2', 'footprint-edge-5'],
    },
    {
      name: 'custom-T',
      footprint: [
        { x: 0, y: 0, z: 0 }, { x: 9000, y: 0, z: 0 },
        { x: 9000, y: 2000, z: 0 }, { x: 6000, y: 2000, z: 0 },
        { x: 6000, y: 5000, z: 0 }, { x: 3000, y: 5000, z: 0 },
        { x: 3000, y: 2000, z: 0 }, { x: 0, y: 2000, z: 0 },
      ],
      // Three arm tips: edge 2 (right), edge 5 (top of vertical
      // arm), edge 8 (left).
      expectedSourceEdgeIds: ['footprint-edge-2', 'footprint-edge-5', 'footprint-edge-8'],
    },
  ];

  for (const fixture of PHASE_2_FIXTURES) {
    for (const ridgeAxis of ['x', 'y'] as const) {
      it(`${fixture.name} (${ridgeAxis}-ridge) terminals match the wing-tip set`, () => {
        const terminals = deriveHouseGableTerminalEndsFromFootprint({
          footprint: fixture.footprint,
          ridgeAxis,
        });
        const actual = terminals.map((end) => end.sourceEdgeId).sort();
        const expected = [...fixture.expectedSourceEdgeIds].sort();
        expect(actual, `${fixture.name}/${ridgeAxis}`).toEqual(expected);
      });
    }
  }
});

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
