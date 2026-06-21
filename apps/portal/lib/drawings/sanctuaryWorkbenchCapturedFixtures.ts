import 'server-only';

import type { HouseComposition } from '@sp/geometry';
import {
  makeHouseRoofDraftFixtureDraft,
  makeModule,
  makeSnapshot,
} from './sanctuaryWorkbenchFixtureBuilders';
import type { SanctuaryGeometryWorkbenchFixture } from './sanctuaryWorkbenchFixtures.types';

// PR-SS-5 (2026-06-21): Jess-Oratia H composite, captured live from
// the workbench (composition corpus 08-h-3rect-jess-oratia.json). The
// legacy wavefront solver fails on this 3-rect dumbbell; the
// orthogonal straight skeleton produces a unified 12-facet hipped
// roof. Registered here so the `?fixture=jess-oratia-h` QA route can
// render it in the real 3D viewport for visual verification of the
// composition roof → 3D scene path.
const JESS_ORATIA_COMPOSITION: HouseComposition = {
  primitives: [
    {
      kind: 'axisAlignedRectangle',
      originXMm: -1.2531927495729178e-7,
      originYMm: -9219.380999731318,
      widthMm: 6000,
      depthMm: 16795.066093,
      roofIntent: {
        form: 'hipped',
        pitchDeg: 20,
        ridgeAxis: 'y',
        startCap: 'hipped',
        endCap: 'hipped',
      },
    },
    {
      kind: 'axisAlignedRectangle',
      originXMm: 6000.000000316788,
      originYMm: -6470.786490754859,
      widthMm: 19365.688000000002,
      depthMm: 8367.979982427838,
      roofIntent: {
        form: 'hipped',
        pitchDeg: 20,
        ridgeAxis: 'y',
        startCap: 'hipped',
        endCap: 'hipped',
      },
    },
    {
      kind: 'axisAlignedRectangle',
      originXMm: 25365.688,
      originYMm: -12516.668245327017,
      widthMm: 9362.201000316789,
      depthMm: 21453.862999999998,
      roofIntent: {
        form: 'hipped',
        pitchDeg: 20,
        ridgeAxis: 'y',
        startCap: 'hipped',
        endCap: 'hipped',
      },
    },
  ],
  joins: [
    { fromPrimitiveIndex: 0, fromEdge: 'east', toPrimitiveIndex: 1, toEdge: 'west' },
    { fromPrimitiveIndex: 1, fromEdge: 'east', toPrimitiveIndex: 2, toEdge: 'west' },
  ],
};

function makeJessOratiaHFixture(): SanctuaryGeometryWorkbenchFixture {
  const module = makeModule({
    houseConnectionType: 'none',
    houseRoofPitchDeg: '20',
  });
  const snapshot = makeSnapshot(module, {}, 'Jess - Oratia H composite');
  const draft = makeHouseRoofDraftFixtureDraft({
    snapshot,
    roof: {
      form: 'hipped',
      primaryPitchDeg: '20',
      ridgeAxis: 'y',
    },
  });
  // Inject the captured H composition over the default single-rect
  // house produced by the fixture builder.
  const houseForm = draft.objectFirst?.houseAssembly?.houseForms?.[0];
  if (houseForm) {
    houseForm.composition = JESS_ORATIA_COMPOSITION;
    houseForm.roofIntentAuthored = true;
    houseForm.eaveHeightM = '2.4';
  }

  return {
    slug: 'jess-oratia-h',
    label: 'Jess - Oratia H composite',
    qa: {
      source: 'baked_workbench_fixture',
      purpose:
        'Multi-rect H composite (legacy solver fails). Verifies the orthogonal straight-skeleton roof renders as a unified hipped roof in 3D.',
      parityCritical: false,
      shapeFamily: 'box',
      houseRoofForm: 'hipped',
      expectedPergola: {
        lengthM: 6,
        projectionM: 3,
        roofMaterial: 'acrylic',
        attachmentSide: 'rear',
        roofPitchDeg: 20,
        roofType: 'hip',
        roofPlaneCount: 12,
      },
    },
    snapshot,
    draft,
    sheetLabels: ['M1 - Jess Oratia H composite'],
    estimate: {
      id: 'est_00000000-0000-4000-8000-0000000000ce',
      versionLabel: 'V-SS-H1',
      status: 'draft',
      createdAt: '2026-06-21T00:00:00.000Z',
    },
    request: {
      id: 'dpr_00000000-0000-4000-8000-0000000000ce',
      requestVersion: 1,
      status: 'OPEN',
      priorityTier: 'TIER_3',
    },
  };
}

export const CAPTURED_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES: SanctuaryGeometryWorkbenchFixture[] =
  [makeJessOratiaHFixture()];
