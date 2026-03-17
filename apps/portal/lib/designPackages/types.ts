export type DesignRequestStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'BLOCKED';
export type DesignRequestPriorityTier = 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4' | 'UNPRICED';
export type DesignRequestSource = 'calculator_generate' | 'estimates_tab' | 'legacy_backfill';
export type DesignListCellKey = 'date' | 'quote_name' | 'site_visit_rep' | 'design_ready' | 'priority' | 'sent' | 'visited' | 'notes';
export type DesignListEditableCellKey = 'design_ready' | 'priority' | 'notes';

export type DesignRequestPreview = {
  projectId: string;
  estimateId: string;
  canSubmit: boolean;
  mode: 'initial' | 'revision';
  nextVersion: number;
  priorityTier: DesignRequestPriorityTier;
  priceTotalIncGstCents: number | null;
  activeRequest:
    | {
        id: string;
        requestVersion: number;
        status: DesignRequestStatus;
        priorityTier: DesignRequestPriorityTier;
      }
    | null;
};

export type DesignPackageDesignerLookup = {
  id: string;
  label: string;
};

export type DesignListRow = {
  requestId: string;
  projectId: string;
  estimateId: string | null;
  estimateVersionLabel: string | null;
  requestVersion: number;
  status: DesignRequestStatus;
  priorityTier: DesignRequestPriorityTier;
  priceTotalIncGstCents: number | null;
  requestSource: DesignRequestSource;
  requestedAt: string;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  rowVersion: string;
  quoteName: string;
  projectName: string | null;
  clientName: string | null;
  siteAddress: string | null;
  siteVisitRep: string | null;
  sentAt: string | null;
  sentQuoteRef: string | null;
  visitStatus: string | null;
  visitCompletedAt: string | null;
  notes: string;
  requestNote: string | null;
  designerNote: string | null;
  assignedDesignerId: string | null;
};

export type DesignPackagesResponse = {
  generatedAt: string;
  lookups: {
    designers: DesignPackageDesignerLookup[];
  };
  rows: DesignListRow[];
};

export type DesignRequestMutationResponse = {
  ok: true;
  requestId: string;
};

export type DesignListCellMutationRequest = {
  requestId: string;
  rowVersion: string;
  key: DesignListEditableCellKey;
  value: unknown;
};

export type DesignListCellMutationResponse = {
  ok: true;
  updatedRow: DesignListRow;
};
