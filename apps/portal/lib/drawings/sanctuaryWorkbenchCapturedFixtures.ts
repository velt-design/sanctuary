import 'server-only';

import {
  buildEstimateDrawingDraftFromSnapshot,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import { CAPTURED_HOUSE_ROOF_FAILURE_20260602_PAYLOAD } from './sanctuaryWorkbenchCapturedHouseRoofFailure20260602';
import type { WorkbenchDebugFixtureExport } from './workbenchDebugExport';
import type { SanctuaryGeometryWorkbenchFixture } from './sanctuaryWorkbenchFixtures.types';

type FixtureQa = SanctuaryGeometryWorkbenchFixture['qa'];

export type CapturedWorkbenchFixtureInput = {
  slug: string;
  label: string;
  payload: WorkbenchDebugFixtureExport;
  expectedModule: FixtureQa['expectedModule'];
  moduleLabels?: string[];
  qa?: Partial<Omit<FixtureQa, 'source' | 'expectedModule'>>;
  estimate?: Partial<SanctuaryGeometryWorkbenchFixture['estimate']>;
  request?: Partial<SanctuaryGeometryWorkbenchFixture['request']>;
};

function buildDraftFromCapturedPayload(payload: WorkbenchDebugFixtureExport): EstimateDrawingDraft {
  const draft = buildEstimateDrawingDraftFromSnapshot(payload.snapshot);
  if (!draft) {
    throw new Error('Captured workbench fixture payload is missing a calculator snapshot.');
  }
  return {
    ...draft,
    objectFirst: payload.objectFirst ?? undefined,
  };
}

export function buildCapturedSanctuaryGeometryWorkbenchFixture(
  input: CapturedWorkbenchFixtureInput,
): SanctuaryGeometryWorkbenchFixture {
  const snapshot = input.payload.snapshot ?? {};

  return {
    slug: input.slug,
    label: input.label,
    qa: {
      source: 'baked_workbench_fixture',
      purpose:
        input.qa?.purpose ??
        'Captured live design-workbench state for object-owned house roof diagnostics.',
      parityCritical: input.qa?.parityCritical ?? false,
      shapeFamily: input.qa?.shapeFamily ?? 'mono',
      houseRoofForm: input.qa?.houseRoofForm ?? 'hipped',
      expectedModule: input.expectedModule,
    },
    snapshot,
    draft: buildDraftFromCapturedPayload(input.payload),
    moduleLabels: input.moduleLabels,
    estimate: {
      id: input.estimate?.id ?? `est_${input.slug}`,
      versionLabel: input.estimate?.versionLabel ?? `V-CAP-${input.slug}`,
      status: input.estimate?.status ?? 'draft',
      createdAt: input.estimate?.createdAt ?? '2026-06-02T00:00:00.000Z',
    },
    request: {
      id: input.request?.id ?? `dpr_${input.slug}`,
      requestVersion: input.request?.requestVersion ?? 1,
      status: input.request?.status ?? 'OPEN',
      priorityTier: input.request?.priorityTier ?? 'TIER_2',
    },
  };
}

export const CAPTURED_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES: SanctuaryGeometryWorkbenchFixture[] = [
  buildCapturedSanctuaryGeometryWorkbenchFixture({
    slug: 'captured-house-roof-failure-2026-06-02',
    label: 'Captured House Roof Failure 2026-06-02',
    payload: CAPTURED_HOUSE_ROOF_FAILURE_20260602_PAYLOAD,
    expectedModule: {
      lengthM: 3.95,
      projectionM: 4.75,
      roofMaterial: 'acrylic',
      attachmentSide: 'rear',
      roofPitchDeg: 10,
      roofType: 'pitched',
      roofPlaneCount: 1,
    },
    moduleLabels: ['M1 - Captured Mono - 3.95m x 4.75m - Acrylic'],
    qa: {
      purpose:
        'Exact captured staff workbench payload for house roof-stage diagnostics.',
      shapeFamily: 'mono',
      houseRoofForm: 'mono',
    },
    estimate: {
      id: 'est_captured_house_roof_failure_20260602',
      versionLabel: 'V-CAP-HOUSE-ROOF-20260602',
      createdAt: '2026-06-02T00:00:00.000Z',
    },
    request: {
      id: 'dpr_captured_house_roof_failure_20260602',
    },
  }),
];
