import 'server-only';

import { updateEstimateDrawingObjectFirstWorkbenchDraft, type EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import {
  addHouseFormToObjectFirstDraft,
} from './state/objectFirstWorkbenchAdapter';
import type { SanctuaryGeometryWorkbenchFixture } from './sanctuaryWorkbenchFixtures.types';
import {
  makeHouseRoofDraftFixtureDraft,
  makeModule,
  makeResult,
  makeSnapshot,
} from './sanctuaryWorkbenchFixtureBuilders';

function makeMultiHouseUTwoPergolaFixtureSource(): {
  snapshot: Record<string, unknown>;
  draft: EstimateDrawingDraft;
} {
  const snapshot = makeSnapshot(
    makeModule({
      pergolaStyle: 'pitched',
      roofMaterial: 'acrylic',
      lengthM: '5.8',
      projectionM: '2.6',
      roofPitchDeg: '5',
      postCutHeightM: '2.4',
      houseConnectionType: 'soffit',
      houseAttachmentStrategy: 'soffit_brackets',
      attachmentSide: 'rear',
      houseRoofPitchDeg: '20',
      houseFasciaHeightMm: '300',
      houseEaveOverhangMm: '1000',
    }),
    makeResult({
      roofType: 'pitched',
      lengthA: 5.8,
      spanA: 2.6,
      roofPitchDegUsed: 5,
      heightHouseSideM: 2.4,
      heightOuterSideM: 2.1,
      gutterType: 'SP Gutter',
      rafterCount: 10,
      rafterSpacingMm: 644,
      effectiveRunM: 2.45,
      acrylicRequiredDownslopeM: 2.45936,
      joinerPieceLengthM: 2.45936,
      joinerRunsTotal: 10,
      roofPlaneCount: 1,
      roofSurfaceAreaM2: 15.12,
      acrylicAreaM2: 15.12,
    }),
    'Multi House U Two Pergola',
  );
  const draft = makeHouseRoofDraftFixtureDraft({
    snapshot,
    roof: {
      form: 'hipped',
      primaryPitchDeg: '20',
    },
  });
  const objectFirst = draft.objectFirst;
  if (!objectFirst?.houseAssembly?.houseForms[0]) {
    throw new Error('Expected object-first house form for multi-house fixture.');
  }

  objectFirst.houseAssembly.houseForms[0].label = 'House';
  const withSecondHouse = addHouseFormToObjectFirstDraft({
    draft: objectFirst,
    label: 'House 2',
    transformOverride: { offsetXM: 10, offsetYM: 0, rotationQuarterTurns: 0 },
  });
  const firstPergola = withSecondHouse.pergolas[0];
  if (!firstPergola) {
    throw new Error('Expected primary pergola for multi-house fixture.');
  }
  firstPergola.label = 'Pergola 1';
  firstPergola.family = 'mono';
  firstPergola.geometry = {
    ...(firstPergola.geometry ?? {}),
    dimensions: { lengthM: '5.8', projectionM: '2.6' },
    roof: { ...(firstPergola.geometry?.roof ?? {}), material: 'acrylic', pitchDeg: '5' },
    supports: {
      ...(firstPergola.geometry?.supports ?? {}),
      postCount: '4',
      postCutHeightM: '2.4',
      postConnectionType: 'deck_bracket',
      ground: 'easy',
    },
  };
  withSecondHouse.pergolas.push({
    id: 'pergola-2',
    label: 'Pergola 2',
    family: 'gable',
    connectionKind: 'fascia',
    attachmentEdgeId: 'footprint-edge-99',
    attachmentZoneId: null,
    side: 'rear',
    strategy: 'fascia_under_gutter',
    geometry: {
      dimensions: { lengthM: '5.1', projectionM: '2.4' },
      roof: { material: 'acrylic', pitchDeg: '25' },
      gable: {
        endFramesMode: 'outer_end_only',
        houseEaveGutterMode: 'house',
        outerEaveGutterMode: 'our',
      },
      supports: {
        postCount: '4',
        postCutHeightM: '2.4',
        postConnectionType: 'slab_anchors',
        ground: 'easy',
      },
    },
    position: { originXMm: '11000', originYMm: '0', rotationDeg: '0' },
    attachment: null,
  });
  return {
    snapshot,
    draft: updateEstimateDrawingObjectFirstWorkbenchDraft({
      draft,
      objectFirst: withSecondHouse,
    }),
  };
}

function makeMultiHouseCustomProjectionFixtureSource(): {
  snapshot: Record<string, unknown>;
  draft: EstimateDrawingDraft;
} {
  const base = makeMultiHouseUTwoPergolaFixtureSource();
  const objectFirst = base.draft.objectFirst;
  if (!objectFirst?.houseAssembly?.houseForms[0]) {
    throw new Error('Expected object-first house forms for custom projection fixture.');
  }

  let nextDraft = addHouseFormToObjectFirstDraft({
    draft: objectFirst,
    label: 'House 3',
    transformOverride: { offsetXM: 6, offsetYM: -8, rotationQuarterTurns: 0 },
  });
  nextDraft = addHouseFormToObjectFirstDraft({
    draft: nextDraft,
    label: 'House 4',
    transformOverride: { offsetXM: 16, offsetYM: -8, rotationQuarterTurns: 0 },
  });
  const houseForms = nextDraft.houseAssembly?.houseForms;
  if (!houseForms || houseForms.length < 4) {
    throw new Error('Expected four house forms for custom projection fixture.');
  }

  // PR-WB-COMPOSITION-ONLY (2026-06-19): the legacy fixture
  // overrode each house form's `footprint` sub-object with hand-
  // authored polygons (U, wrap, L, recess shapes). That field is
  // gone; expressing the same shapes as compositions is a
  // followup task. For now, the fixture's house forms keep their
  // default 6m × 4m single-rectangle composition + the labels +
  // transforms below.
  houseForms[0] = {
    ...houseForms[0],
    label: 'House 1',
    transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
  };
  houseForms[1] = {
    ...houseForms[1],
    label: 'House 2',
    transform: { offsetXM: 10, offsetYM: 2, rotationQuarterTurns: 0 },
  };
  houseForms[2] = {
    ...houseForms[2],
    label: 'House 3',
    transform: { offsetXM: 0, offsetYM: -9, rotationQuarterTurns: 0 },
  };
  houseForms[3] = {
    ...houseForms[3],
    label: 'House 4',
    transform: { offsetXM: 16, offsetYM: -8, rotationQuarterTurns: 0 },
    roofIntent: {
      ...houseForms[3].roofIntent,
      form: 'hipped',
      primaryPitchDeg: '5',
      ridgeAxis: 'x',
      openGableEndIds: [],
    },
    roofIntentAuthored: true,
  };

  nextDraft = {
    ...nextDraft,
    houseAssembly: {
      ...nextDraft.houseAssembly!,
      houseForms,
    },
  };

  return {
    snapshot: base.snapshot,
    draft: updateEstimateDrawingObjectFirstWorkbenchDraft({
      draft: base.draft,
      objectFirst: nextDraft,
    }),
  };
}

export const MULTI_OBJECT_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES: SanctuaryGeometryWorkbenchFixture[] = [
  {
    slug: 'multi-house-u-two-pergola',
    label: 'Multi House U Two Pergola',
    qa: {
      source: 'baked_workbench_fixture',
      purpose: 'Production-aligned multi-object fixture for two U-shape houses and two pergolas.',
      parityCritical: false,
      shapeFamily: 'mono',
      houseRoofForm: 'hipped',
      expectedPergola: {
        lengthM: 5.8,
        projectionM: 2.6,
        roofMaterial: 'acrylic',
        attachmentSide: 'rear',
        roofPitchDeg: 5,
        roofType: 'pitched',
        roofPlaneCount: 1,
      },
    },
    ...makeMultiHouseUTwoPergolaFixtureSource(),
    sheetLabels: ['M1 - Multi House U Pergola 1 - 5.8m x 2.6m - Acrylic'],
    estimate: {
      id: 'est_00000000-0000-4000-8000-000000000126',
      versionLabel: 'V-FIX-MULTI-U',
      status: 'draft',
      createdAt: '2026-05-30T00:00:00.000Z',
    },
    request: {
      id: 'dpr_00000000-0000-4000-8000-000000000126',
      requestVersion: 1,
      status: 'OPEN',
      priorityTier: 'TIER_2',
    },
  },
  {
    slug: 'multi-house-custom-projection',
    label: 'Multi House Custom Projection',
    qa: {
      source: 'baked_workbench_fixture',
      purpose: 'Multi-house custom-footprint projection fixture for per-house render-health diagnostics.',
      parityCritical: false,
      shapeFamily: 'mono',
      houseRoofForm: 'hipped',
      expectedPergola: {
        lengthM: 5.8,
        projectionM: 2.6,
        roofMaterial: 'acrylic',
        attachmentSide: 'rear',
        roofPitchDeg: 5,
        roofType: 'pitched',
        roofPlaneCount: 1,
      },
    },
    ...makeMultiHouseCustomProjectionFixtureSource(),
    sheetLabels: ['M1 - Multi House Custom Projection - 5.8m x 2.6m - Acrylic'],
    estimate: {
      id: 'est_00000000-0000-4000-8000-000000000127',
      versionLabel: 'V-FIX-MULTI-CUSTOM',
      status: 'draft',
      createdAt: '2026-06-01T00:00:00.000Z',
    },
    request: {
      id: 'dpr_00000000-0000-4000-8000-000000000127',
      requestVersion: 1,
      status: 'OPEN',
      priorityTier: 'TIER_2',
    },
  },
];
