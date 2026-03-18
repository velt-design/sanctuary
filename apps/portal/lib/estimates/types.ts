export type EstimateStatus = 'draft' | 'archived';

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

export type EstimateEditability = {
  isLocked: boolean;
  lockReason: 'quote_sent' | null;
  lockedAt: string | null;
  lockedByQuoteVersionId: string | null;
  lockedByQuoteRef: string | null;
  lockedByQuoteVersionNumber: number | null;
  hasDraftQuotes: boolean;
  draftQuoteCount: number;
};

export type EstimateDetail = EstimateMeta & {
  calculatorSnapshot: Record<string, unknown> | null;
  internalNotes?: string | null;
  editability: EstimateEditability;
};
