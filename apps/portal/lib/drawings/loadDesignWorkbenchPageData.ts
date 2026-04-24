import 'server-only';

import { loadProjectDesignPackageRows } from '@/lib/designPackages/server';
import type { DesignListRow, DesignRequestPriorityTier, DesignRequestStatus } from '@/lib/designPackages/types';
import { estimateFlowStateFor, loadProjectEstimateFlowMaps } from '@/lib/estimates/flow';
import { buildVersionLabelMap, mapEstimateDetail, mapEstimateMeta } from '@/lib/estimates/server';
import type { EstimateDetail, EstimateMeta, EstimateStatus } from '@/lib/estimates/types';
import { getProjectPageSnapshot } from '@/lib/projects/getProjectPageSnapshot';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';

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

export type DesignWorkbenchPageData =
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
      detail: EstimateDetail;
    };

type EstimateRow = {
  id: string;
  project_id: string;
  created_at: string | null;
  status: string | null;
  created_by: string | null;
  summary_json: unknown;
  summary: unknown;
  outputs: unknown;
  warnings: unknown;
  inputs: unknown;
  internal_notes: string | null;
  costing_manifest: string | null;
  costing_rules: string | null;
  total_true_cost_ex_gst: number | null;
  total_true_cost_inc_gst: number | null;
};

type LoadDesignWorkbenchPageDataInput = {
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

export async function loadDesignWorkbenchPageData({
  projectId,
  estimateId,
  requestId,
}: LoadDesignWorkbenchPageDataInput): Promise<DesignWorkbenchPageData> {
  const snapshot = await getProjectPageSnapshot(projectId);
  if (!snapshot) return { kind: 'project_unavailable' };

  let projectUuid: string;
  try {
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return { kind: 'project_unavailable' };
  }

  const project = toProjectSummary(snapshot.project);
  const supabase = await getSupabaseServerAuth();

  const [estimateRes, requests] = await Promise.all([
    supabase.from('estimates').select('*').eq('project_id', projectUuid).order('created_at', { ascending: false }),
    loadProjectDesignPackageRows(projectId),
  ]);

  if (estimateRes.error) throw estimateRes.error;

  const estimateRows = (Array.isArray(estimateRes.data) ? estimateRes.data : []) as EstimateRow[];
  if (!estimateRows.length) {
    return {
      kind: 'no_estimate',
      project,
      providedEstimateId: estimateId ?? null,
      providedRequestId: requestId ?? null,
    };
  }

  const flowMaps = await loadProjectEstimateFlowMaps(projectUuid, estimateRows, supabase);
  const versionLabels = buildVersionLabelMap(estimateRows);
  const estimates = estimateRows.map((row) =>
    mapEstimateMeta(
      {
        ...row,
        ...estimateFlowStateFor(flowMaps.flowByEstimateId, row.id),
      },
      versionLabels.get(row.id) ?? 'V-',
    ),
  );
  const estimateRowsById = new Map(estimates.map((estimate, index) => [estimate.id, estimateRows[index]]));

  const explicitEstimate = estimateId ? estimates.find((estimate) => estimate.id === estimateId) ?? null : null;
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

  const selectedEstimateRow = estimateRowsById.get(selectedEstimate.id);
  if (!selectedEstimateRow) return { kind: 'project_unavailable' };

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
  } else if (activeRequest && (!activeRequest.estimateId || activeRequest.estimateId === selectedEstimate.id)) {
    selectedRequest = toRequestSummary(activeRequest, 'active');
  }

  const flowState = estimateFlowStateFor(flowMaps.flowByEstimateId, selectedEstimateRow.id);
  const detail = mapEstimateDetail(
    selectedEstimateRow,
    versionLabels.get(selectedEstimateRow.id) ?? selectedEstimate.versionLabel,
    flowMaps.editabilityByEstimateId.get(selectedEstimateRow.id) ?? null,
    flowState,
  );

  return {
    kind: 'ready',
    project,
    estimate: selectedEstimate,
    request: selectedRequest,
    estimateWarning,
    requestWarning,
    providedEstimateId: estimateId ?? null,
    providedRequestId: requestId ?? null,
    detail,
  };
}
