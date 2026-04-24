import type { DesignRequestPriorityTier, DesignRequestStatus } from '@/lib/designPackages/types';
import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type { EstimateStatus } from '@/lib/estimates/types';

export type SanctuaryGeometryWorkbenchFixtureEstimate = {
  id: string;
  versionLabel: string;
  status: EstimateStatus;
  createdAt: string;
};

export type SanctuaryGeometryWorkbenchFixtureRequest = {
  id: string;
  requestVersion: number;
  status: DesignRequestStatus;
  priorityTier: DesignRequestPriorityTier;
};

export type SanctuaryGeometryWorkbenchFixture = {
  slug: string;
  label: string;
  snapshot: Record<string, unknown>;
  draft?: EstimateDrawingDraft;
  moduleLabels?: string[];
  estimate: SanctuaryGeometryWorkbenchFixtureEstimate;
  request: SanctuaryGeometryWorkbenchFixtureRequest;
};
