import type { DesignRequestPriorityTier, DesignRequestStatus } from '@/lib/designPackages/types';
import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type { EstimateStatus } from '@/lib/estimates/types';

type WorkbenchFixtureRoofType = 'pitched' | 'low_gable' | 'gable' | 'hip' | 'hip_corner';

type SanctuaryGeometryWorkbenchFixtureEstimate = {
  id: string;
  versionLabel: string;
  status: EstimateStatus;
  createdAt: string;
};

type SanctuaryGeometryWorkbenchFixtureRequest = {
  id: string;
  requestVersion: number;
  status: DesignRequestStatus;
  priorityTier: DesignRequestPriorityTier;
};

type SanctuaryGeometryWorkbenchFixtureQaMetadata = {
  source: 'baked_workbench_fixture' | 'saved_estimate_snapshot';
  purpose: string;
  parityCritical: boolean;
  shapeFamily: 'mono' | 'gable' | 'box';
  houseRoofForm: 'flat' | 'mono' | 'gable' | 'hipped';
  expectedPergola: {
    lengthM: number;
    projectionM: number;
    roofMaterial: 'acrylic' | 'timber' | 'mixed';
    attachmentSide: 'rear' | 'front' | 'left' | 'right';
    roofPitchDeg: number;
    roofType: WorkbenchFixtureRoofType;
    roofPlaneCount: number;
  };
};

export type SanctuaryGeometryWorkbenchFixture = {
  slug: string;
  label: string;
  qa: SanctuaryGeometryWorkbenchFixtureQaMetadata;
  snapshot: Record<string, unknown>;
  draft?: EstimateDrawingDraft;
  sheetLabels?: string[];
  estimate: SanctuaryGeometryWorkbenchFixtureEstimate;
  request: SanctuaryGeometryWorkbenchFixtureRequest;
};
