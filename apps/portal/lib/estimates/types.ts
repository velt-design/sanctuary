export type EstimateStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'superseded' | 'archived';

export type EstimateSummary = {
  total?: number | null;
  cost?: number | null;
  marginPct?: number | null;
  marginValue?: number | null;
  deposit?: number | null;
  validityDate?: string | null;
  leadTime?: string | null;
};

export type EstimateMeta = {
  id: string;
  projectId: string;
  createdAt: string;
  status: EstimateStatus;
  summary: EstimateSummary;
  createdBy?: string | null;
  versionLabel: string;
};

export type EstimateDetail = EstimateMeta & {
  calculatorSnapshot: Record<string, unknown> | null;
  internalNotes?: string | null;
  approvalRequestedAt?: string | null;
  approvalRequestedBy?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  approvalComment?: string | null;
};
