import 'server-only';

import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import {
  makeHouseRoofDraftFixtureDraft,
  makeModule,
  makeResult,
  makeSnapshot,
} from './sanctuaryWorkbenchFixtureBuilders';
import { CAPTURED_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES } from './sanctuaryWorkbenchCapturedFixtures';
import { MULTI_OBJECT_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES } from './sanctuaryWorkbenchMultiObjectFixtures';
import type { SanctuaryGeometryWorkbenchFixture } from './sanctuaryWorkbenchFixtures.types';

function makeScreenshotStyleUSnapshot(): Record<string, unknown> {
  return makeSnapshot(
    makeModule({
      pergolaStyle: 'gable',
      roofMaterial: 'acrylic',
      lengthM: '5',
      projectionM: '5',
      roofPitchDeg: '20',
      postCutHeightM: '2.5',
      houseConnectionType: 'fascia',
      attachmentSide: 'front',
      houseAttachmentStrategy: 'fascia_under_gutter',
      houseFootprintMode: 'preset',
      houseFootprintPreset: 'u_shape',
      houseFootprintParams: {
        widthM: '8',
        offsetXM: '-1',
        setbackM: '0.4',
        bandDepthM: '1.8',
        returnRunM: '2.4',
        recessWidthM: '2.4',
        recessDepthM: '1.2',
        leftLegRunM: '5',
        rightLegRunM: '5',
        sideRunM: '2.4',
      },
      houseRoofPitchDeg: '20',
      houseFasciaHeightMm: '300',
      houseEaveOverhangMm: '1000',
      gableEndFramesMode: 'outer_end_only',
      gableHouseEdgeGutter: 'house',
      gableOuterEdgeGutter: 'our',
    }),
    makeResult({
      roofType: 'gable',
      lengthA: 5,
      spanA: 5,
      roofPitchDegUsed: 20,
      heightHouseSideM: 2.5,
      heightOuterSideM: 2.5,
      gutterType: 'SP Gutter',
      rafterCount: 10,
      rafterSpacingMm: 556,
      roofPlaneCount: 2,
      roofSurfaceAreaM2: 26.604,
      ridgeBeamProfileUsed: '50x150',
    }),
    'Gable U Hipped Screenshot',
  );
}

function makeGableUHippedScreenshotFixtureSource(): {
  snapshot: Record<string, unknown>;
  draft: EstimateDrawingDraft;
} {
  const snapshot = makeScreenshotStyleUSnapshot();
  return {
    snapshot,
    draft: makeHouseRoofDraftFixtureDraft({
      snapshot,
      roof: {
        form: 'hipped',
        primaryPitchDeg: '20',
      },
    }),
  };
}

function makeMonoJoinScreenshotFixtureSource(): {
  snapshot: Record<string, unknown>;
  draft: EstimateDrawingDraft;
} {
  const snapshot = makeScreenshotStyleUSnapshot();
  return {
    snapshot,
    draft: makeHouseRoofDraftFixtureDraft({
      snapshot,
      roof: {
        form: 'mono',
        material: 'trapezoidal_5_rib',
        primaryPitchDeg: '20',
        primaryFallDirection: 'positive_y',
      },
    }),
  };
}

const FIXTURES: SanctuaryGeometryWorkbenchFixture[] = [
  {
    slug: 'mono-standard',
    label: 'Mono Standard',
    qa: {
      source: 'baked_workbench_fixture',
      purpose: 'Baseline attached mono acrylic fixture for calculator/workbench parity.',
      parityCritical: true,
      shapeFamily: 'mono',
      houseRoofForm: 'hipped',
      expectedPergola: {
        lengthM: 6,
        projectionM: 3,
        roofMaterial: 'acrylic',
        attachmentSide: 'rear',
        roofPitchDeg: 5,
        roofType: 'pitched',
        roofPlaneCount: 1,
      },
    },
    snapshot: makeSnapshot(
      makeModule({
        pergolaStyle: 'pitched',
        roofMaterial: 'acrylic',
        lengthM: '6',
        projectionM: '3',
        roofPitchDeg: '5',
      }),
      makeResult({
        roofType: 'pitched',
        lengthA: 6,
        spanA: 3,
        roofPitchDegUsed: 5,
        heightHouseSideM: 2.4,
        heightOuterSideM: 2.1,
        gutterType: 'SP Gutter',
        rafterCount: 11,
        rafterSpacingMm: 600,
        effectiveRunM: 2.85,
        acrylicRequiredDownslopeM: 2.88088653699854,
        joinerPieceLengthM: 2.88088653699854,
        joinerRunsTotal: 11,
        roofPlaneCount: 1,
        roofSurfaceAreaM2: 18.06875707578025,
        rafterHouseAllowanceM: 0.05,
        rafterFarAllowanceM: 0.1,
        acrylicAreaM2: 18.06875707578025,
      }),
      'Mono Standard',
    ),
    sheetLabels: ['M1 - Mono Standard - 6m x 3m - Acrylic'],
    estimate: {
      id: 'est_00000000-0000-4000-8000-000000000101',
      versionLabel: 'V-FIX-M1',
      status: 'draft',
      createdAt: '2026-04-08T00:00:00.000Z',
    },
    request: {
      id: 'dpr_00000000-0000-4000-8000-000000000101',
      requestVersion: 1,
      status: 'OPEN',
      priorityTier: 'TIER_3',
    },
  },
  {
    slug: 'gable-standard',
    label: 'Gable Standard',
    qa: {
      source: 'baked_workbench_fixture',
      purpose: 'Baseline attached gable fixture with installed end-frame defaults.',
      parityCritical: true,
      shapeFamily: 'gable',
      houseRoofForm: 'hipped',
      expectedPergola: {
        lengthM: 6.5,
        projectionM: 4,
        roofMaterial: 'mixed',
        attachmentSide: 'rear',
        roofPitchDeg: 25,
        roofType: 'gable',
        roofPlaneCount: 2,
      },
    },
    snapshot: makeSnapshot(
      makeModule({
        pergolaStyle: 'gable',
        roofMaterial: 'mixed',
        lengthM: '6.5',
        projectionM: '4',
        roofPitchDeg: '25',
        postCutHeightM: '2.7',
        gableEndFramesMode: 'outer_end_only',
      }),
      makeResult({
        roofType: 'gable',
        lengthA: 6.5,
        spanA: 4,
        roofPitchDegUsed: 25,
        heightHouseSideM: 2.7,
        heightOuterSideM: 2.7,
        gutterType: 'SP Gutter',
        rafterCount: 12,
        rafterSpacingMm: 590,
        roofPlaneCount: 2,
        roofSurfaceAreaM2: 28.691,
        ridgeBeamProfileUsed: '50x150',
      }),
      'Gable Standard',
    ),
    sheetLabels: ['M1 - Gable Standard - 6.5m x 4m - Insulated'],
    estimate: {
      id: 'est_00000000-0000-4000-8000-000000000102',
      versionLabel: 'V-FIX-G1',
      status: 'draft',
      createdAt: '2026-04-08T00:00:00.000Z',
    },
    request: {
      id: 'dpr_00000000-0000-4000-8000-000000000102',
      requestVersion: 1,
      status: 'OPEN',
      priorityTier: 'TIER_2',
    },
  },
  {
    slug: 'box-standard',
    label: 'Box Standard',
    qa: {
      source: 'baked_workbench_fixture',
      purpose: 'Baseline attached box-perimeter fixture for geometry takeoff parity.',
      parityCritical: true,
      shapeFamily: 'box',
      houseRoofForm: 'hipped',
      expectedPergola: {
        lengthM: 5.5,
        projectionM: 3.5,
        roofMaterial: 'timber',
        attachmentSide: 'rear',
        roofPitchDeg: 3,
        roofType: 'pitched',
        roofPlaneCount: 1,
      },
    },
    snapshot: makeSnapshot(
      makeModule({
        pergolaStyle: 'pitched',
        boxPerimeterEnabled: true,
        internalRoofType: 'pitched',
        roofMaterial: 'timber',
        lengthM: '5.5',
        projectionM: '3.5',
        roofPitchDeg: '3',
        fallDistanceMm: '40',
      }),
      makeResult({
        roofType: 'pitched',
        lengthA: 5.5,
        spanA: 3.5,
        roofPitchDegUsed: 3,
        heightHouseSideM: 2.5,
        heightOuterSideM: 2.35,
        boxPitchDegUsed: 3,
        gutterType: 'box_gutter_100x100x3',
        rafterProfileAuto: '50x80',
        boxPerimeterBeamProfileUsed: '50x300',
        rafterCount: 10,
        rafterSpacingMm: 611,
        roofPlaneCount: 1,
        roofSurfaceAreaM2: 19.276,
        boxEffectiveRunM: 3.3,
        boxRiseMm: 173,
        boxMaxFallMm: 200,
      }),
      'Box Standard',
    ),
    sheetLabels: ['M1 - Box Standard - 5.5m x 3.5m - Timber'],
    estimate: {
      id: 'est_00000000-0000-4000-8000-000000000103',
      versionLabel: 'V-FIX-B1',
      status: 'draft',
      createdAt: '2026-04-08T00:00:00.000Z',
    },
    request: {
      id: 'dpr_00000000-0000-4000-8000-000000000103',
      requestVersion: 1,
      status: 'OPEN',
      priorityTier: 'TIER_3',
    },
  },
  {
    slug: 'gable-u-hipped-screenshot',
    label: 'Gable U Hipped Screenshot',
    qa: {
      source: 'baked_workbench_fixture',
      purpose: 'Screenshot-style U footprint with authored hipped house roof topology.',
      parityCritical: true,
      shapeFamily: 'gable',
      houseRoofForm: 'hipped',
      expectedPergola: {
        lengthM: 5,
        projectionM: 5,
        roofMaterial: 'acrylic',
        attachmentSide: 'front',
        roofPitchDeg: 20,
        roofType: 'gable',
        roofPlaneCount: 2,
      },
    },
    ...makeGableUHippedScreenshotFixtureSource(),
    sheetLabels: ['M1 - Gable U Hipped Screenshot - 5m x 5m - Acrylic'],
    estimate: {
      id: 'est_00000000-0000-4000-8000-000000000124',
      versionLabel: 'V-FIX-U1',
      status: 'draft',
      createdAt: '2026-04-13T00:00:00.000Z',
    },
    request: {
      id: 'dpr_00000000-0000-4000-8000-000000000124',
      requestVersion: 1,
      status: 'OPEN',
      priorityTier: 'TIER_2',
    },
  },
  {
    slug: 'mono-join-screenshot',
    label: 'Mono Join Screenshot',
    qa: {
      source: 'baked_workbench_fixture',
      purpose: 'Screenshot-style U footprint with mono house roof join cleanup coverage.',
      parityCritical: true,
      shapeFamily: 'gable',
      houseRoofForm: 'mono',
      expectedPergola: {
        lengthM: 5,
        projectionM: 5,
        roofMaterial: 'acrylic',
        attachmentSide: 'front',
        roofPitchDeg: 20,
        roofType: 'gable',
        roofPlaneCount: 2,
      },
    },
    ...makeMonoJoinScreenshotFixtureSource(),
    sheetLabels: ['M1 - Mono Join Screenshot - 5m x 5m - Trapezoidal 5 Rib'],
    estimate: {
      id: 'est_00000000-0000-4000-8000-000000000125',
      versionLabel: 'V-FIX-U2',
      status: 'draft',
      createdAt: '2026-04-22T00:00:00.000Z',
    },
    request: {
      id: 'dpr_00000000-0000-4000-8000-000000000125',
      requestVersion: 1,
      status: 'OPEN',
      priorityTier: 'TIER_2',
    },
  },
  ...MULTI_OBJECT_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES,
  ...CAPTURED_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES,
];

export function listSanctuaryGeometryWorkbenchFixtures(): SanctuaryGeometryWorkbenchFixture[] {
  return FIXTURES.slice();
}

export function listParityCriticalSanctuaryGeometryWorkbenchFixtures(): SanctuaryGeometryWorkbenchFixture[] {
  return FIXTURES.filter((fixture) => fixture.qa.parityCritical);
}

export function getSanctuaryGeometryWorkbenchFixture(slug: string): SanctuaryGeometryWorkbenchFixture | null {
  return FIXTURES.find((fixture) => fixture.slug === slug) ?? null;
}
