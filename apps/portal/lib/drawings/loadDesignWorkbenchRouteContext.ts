import 'server-only';

import { loadProjectDesignPackageRows } from '@/lib/designPackages/server';
import type { DesignListRow, DesignRequestPriorityTier, DesignRequestStatus } from '@/lib/designPackages/types';
import { loadProjectEstimateMetas } from '@/lib/estimates/loadProjectEstimateMetas';
import type { EstimateMeta, EstimateStatus } from '@/lib/estimates/types';
import { getProjectPageSnapshot } from '@/lib/projects/getProjectPageSnapshot';

const ACTIVE_REQUEST_STATUSES = new Set<DesignRequestStatus>(['OPEN', 'IN_PROGRESS', 'BLOCKED']);

export type WorkbenchEstimateSelectionSource = 'query' | 'active_draft' | 'most_recent';
export type WorkbenchRequestSelectionSource = 'query' | 'active';

export type WorkbenchEstimateWarning = {
  reason: 'estimate_not_found';
  providedEstimateId: string;
};

export type WorkbenchRequestWarning = {
  reason: 'request_not_found' | 'estimate_request_mismatch';
  providedRequestId: string;
  requestEstimateId?: string | null;
};

export type DesignWorkbenchRouteProjectSummary = {
  id: string;
  name: string;
  siteAddress: string | null;
};

export type DesignWorkbenchRouteEstimateSummary = {
  id: string;
  versionLabel: string;
  status: EstimateStatus;
  createdAt: string;
  isActiveDraft: boolean;
  selectionSource: WorkbenchEstimateSelectionSource;
};

export type DesignWorkbenchRouteRequestSummary = {
  id: string;
  requestVersion: number;
  status: DesignRequestStatus;
  priorityTier: DesignRequestPriorityTier;
  estimateId: string | null;
  estimateVersionLabel: string | null;
  updatedAt: string;
  selectionSource: WorkbenchRequestSelectionSource;
};

export type DesignWorkbenchRouteContext =
  | { kind: 'project_unavailable' }
  | {
      kind: 'no_estimate';
      project: DesignWorkbenchRouteProjectSummary;
      providedEstimateId: string | null;
      providedRequestId: string | null;
    }
  | {
      kind: 'ready';
      project: DesignWorkbenchRouteProjectSummary;
      estimate: DesignWorkbenchRouteEstimateSummary;
      request: DesignWorkbenchRouteRequestSummary | null;
      estimateWarning: WorkbenchEstimateWarning | null;
      requestWarning: WorkbenchRequestWarning | null;
      providedEstimateId: string | null;
      providedRequestId: string | null;
    };

type RouteContextInput = {
  projectId: string;
  estimateId?: string | null;
  requestId?: string | null;
};

function toProjectSummary(input: { id: string; name: string; siteAddress?: string | null }): DesignWorkbenchRouteProjectSummary {
  return {
    id: input.id,
    name: input.name,
    siteAddress: input.siteAddress ?? null,
  };
}

function toEstimateSummary(
  estimate: EstimateMeta,
  selectionSource: WorkbenchEstimateSelectionSource,
): DesignWorkbenchRouteEstimateSummary {
  return {
    id: estimate.id,
    versionLabel: estimate.versionLabel,
    status: estimate.status,
    createdAt: estimate.createdAt,
    isActiveDraft: estimate.isActiveDraft,
    selectionSource,
  };
}

function toRequestSummary(
  request: DesignListRow,
  selectionSource: WorkbenchRequestSelectionSource,
): DesignWorkbenchRouteRequestSummary {
  return {
    id: request.requestId,
    requestVersion: request.requestVersion,
    status: request.status,
    priorityTier: request.priorityTier,
    estimateId: request.estimateId,
    estimateVersionLabel: request.estimateVersionLabel,
    updatedAt: request.updatedAt,
    selectionSource,
  };
}

function selectDefaultEstimate(estimates: EstimateMeta[]): {
  estimate: EstimateMeta | null;
  source: WorkbenchEstimateSelectionSource;
} {
  const activeDraft = estimates.find((estimate) => estimate.isActiveDraft) ?? null;
  if (activeDraft) return { estimate: activeDraft, source: 'active_draft' };
  return {
    estimate: estimates[0] ?? null,
    source: 'most_recent',
  };
}

function findActiveRequest(requests: DesignListRow[]): DesignListRow | null {
  return requests.find((request) => ACTIVE_REQUEST_STATUSES.has(request.status)) ?? null;
}

export async function loadDesignWorkbenchRouteContext({
  projectId,
  estimateId,
  requestId,
}: RouteContextInput): Promise<DesignWorkbenchRouteContext> {
  const snapshot = await getProjectPageSnapshot(projectId);
  if (!snapshot) return { kind: 'project_unavailable' };

  const project = toProjectSummary(snapshot.project);
  const [estimates, requests] = await Promise.all([loadProjectEstimateMetas(projectId), loadProjectDesignPackageRows(projectId)]);

  const explicitEstimate = estimateId ? estimates.find((estimate) => estimate.id === estimateId) ?? null : null;
  if (!estimates.length) {
    return {
      kind: 'no_estimate',
      project,
      providedEstimateId: estimateId ?? null,
      providedRequestId: requestId ?? null,
    };
  }

  const defaultEstimate = selectDefaultEstimate(estimates);
  const selectedEstimate = explicitEstimate
    ? toEstimateSummary(explicitEstimate, 'query')
    : defaultEstimate.estimate
      ? toEstimateSummary(defaultEstimate.estimate, defaultEstimate.source)
      : null;

  if (!selectedEstimate) {
    return {
      kind: 'no_estimate',
      project,
      providedEstimateId: estimateId ?? null,
      providedRequestId: requestId ?? null,
    };
  }

  const explicitRequest = requestId ? requests.find((request) => request.requestId === requestId) ?? null : null;
  const activeRequest = findActiveRequest(requests);

  const estimateWarning: WorkbenchEstimateWarning | null =
    estimateId && !explicitEstimate
      ? {
          reason: 'estimate_not_found',
          providedEstimateId: estimateId,
        }
      : null;

  let selectedRequest: DesignWorkbenchRouteRequestSummary | null = null;
  let requestWarning: WorkbenchRequestWarning | null = null;

  if (requestId) {
    if (!explicitRequest) {
      requestWarning = {
        reason: 'request_not_found',
        providedRequestId: requestId,
      };
    } else if (explicitRequest.estimateId && explicitRequest.estimateId !== selectedEstimate.id) {
      requestWarning = {
        reason: 'estimate_request_mismatch',
        providedRequestId: requestId,
        requestEstimateId: explicitRequest.estimateId,
      };
    } else {
      selectedRequest = toRequestSummary(explicitRequest, 'query');
    }
  } else if (!activeRequest) {
    selectedRequest = null;
  } else if (!activeRequest.estimateId || activeRequest.estimateId === selectedEstimate.id) {
    selectedRequest = toRequestSummary(activeRequest, 'active');
  }

  return {
    kind: 'ready',
    project,
    estimate: selectedEstimate,
    request: selectedRequest,
    estimateWarning,
    requestWarning,
    providedEstimateId: estimateId ?? null,
    providedRequestId: requestId ?? null,
  };
}
