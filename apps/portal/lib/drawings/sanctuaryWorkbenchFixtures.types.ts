import type { DesignRequestPriorityTier, DesignRequestStatus } from '@/lib/designPackages/types';
import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type { EstimateStatus } from '@/lib/estimates/types';
import type { RoofType } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';

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
  expectedModule: {
    lengthM: number;
    projectionM: number;
    roofMaterial: CalculatorModuleInputs['roofMaterial'];
    attachmentSide: CalculatorModuleInputs['attachmentSide'];
    roofPitchDeg: number;
    roofType: RoofType;
    roofPlaneCount: number;
  };
};

export type SanctuaryGeometryWorkbenchFixture = {
  slug: string;
  label: string;
  qa: SanctuaryGeometryWorkbenchFixtureQaMetadata;
  snapshot: Record<string, unknown>;
  draft?: EstimateDrawingDraft;
  moduleLabels?: string[];
  estimate: SanctuaryGeometryWorkbenchFixtureEstimate;
  request: SanctuaryGeometryWorkbenchFixtureRequest;
};
