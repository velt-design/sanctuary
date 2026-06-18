import { apiJson } from '@/lib/repo/apiClient';
import type {
  DesignListCellMutationRequest,
  DesignListCellMutationResponse,
  DesignPackagesResponse,
  DesignRequestMutationResponse,
  DesignRequestPreview,
  DesignRequestPriorityTier,
  DesignRequestSource,
} from '@/lib/designPackages/types';

export async function fetchDesignPackages(): Promise<DesignPackagesResponse> {
  return apiJson<DesignPackagesResponse>('/api/staff/v1/design-packages', { method: 'GET' });
}

export async function fetchDesignRequestPreview(projectId: string, estimateId: string): Promise<DesignRequestPreview> {
  const res = await apiJson<{ preview: DesignRequestPreview }>(
    `/api/staff/v1/projects/${encodeURIComponent(projectId)}/design-request-preview?estimateId=${encodeURIComponent(estimateId)}`,
    { method: 'GET' },
  );
  return res.preview;
}

export async function createDesignRequest(input: {
  projectId: string;
  estimateId: string;
  requestSource: Exclude<DesignRequestSource, 'legacy_backfill'>;
  requestNote?: string | null;
  priorityTier?: DesignRequestPriorityTier | null;
}): Promise<DesignRequestMutationResponse> {
  return apiJson<DesignRequestMutationResponse>('/api/staff/v1/design-packages/request', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function mutateDesignListCell(input: DesignListCellMutationRequest): Promise<DesignListCellMutationResponse> {
  return apiJson<DesignListCellMutationResponse>('/api/staff/v1/design-packages/cell', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
