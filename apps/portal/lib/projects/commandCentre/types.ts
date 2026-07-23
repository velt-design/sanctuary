export type CommandCentreQuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED';

export type CommandCentreSource =
  | 'accepted_quote'
  | 'sent_quote'
  | 'draft_quote'
  | 'estimate'
  | 'none';

export type CommandCentreStatusTone = 'accepted' | 'sent' | 'draft' | 'declined' | 'neutral';

export type CommandCentreCostingState = 'current' | 'stored' | 'may_be_stale' | 'unavailable';

type CommandCentreDesignState = 'available' | 'source_unavailable' | 'none';

export type CommandCentreDeliveryState = 'accepted' | 'sent' | 'failed' | 'draft' | 'not_applicable';

export type CommandCentreDesignSummary = {
  size: string;
  shape: string;
  roofing: string;
  additionalModuleCount: number;
};

type CommandCentreEstimateSummary = {
  id: string;
  versionLabel: string;
  savedAt: string | null;
  isActiveDraft: boolean;
  isLocked: boolean;
  isQuoteSource: boolean;
  costingState: CommandCentreCostingState;
};

type CommandCentreQuoteSummary = {
  id: string;
  quoteRef: string | null;
  versionNumber: number | null;
  status: CommandCentreQuoteStatus;
  createdAt: string | null;
  sentAt: string | null;
  deliveryState: CommandCentreDeliveryState;
};

type CommandCentrePrice = {
  source: 'quote' | 'estimate' | 'none';
  totalIncGstCents: number | null;
};

type CommandCentreEstimateReference = {
  id: string;
  versionLabel: string;
  savedAt: string | null;
};

type CommandCentreDeclinedOutcome = {
  quoteVersionId: string;
  quoteRef: string | null;
  versionNumber: number | null;
  createdAt: string | null;
};

export type ProjectCommandCentreCurrentDesign = {
  source: CommandCentreSource;
  statusLabel: string;
  statusTone: CommandCentreStatusTone;
  designState: CommandCentreDesignState;
  design: CommandCentreDesignSummary | null;
  price: CommandCentrePrice;
  estimate: CommandCentreEstimateSummary | null;
  quote: CommandCentreQuoteSummary | null;
  newerEstimate: CommandCentreEstimateReference | null;
  latestDeclinedQuote: CommandCentreDeclinedOutcome | null;
  warnings: Array<
    'multiple_accepted_quotes' | 'source_design_unavailable' | 'quote_price_unavailable' | 'estimate_price_unavailable'
  >;
  links: {
    designs: string;
    quotes: string;
    estimate: string | null;
    quote: string | null;
  };
};

export type ProjectOwnerKey = 'jordan' | 'jp' | 'joe' | 'bruce';

export type ProjectOwnerOption = {
  key: ProjectOwnerKey;
  displayName: string;
};

export type ProjectCommandActionSourceKind = 'automation_task' | 'quote_followup' | 'manual';

export type ProjectCommandActionCategory =
  | 'Call'
  | 'Site visit'
  | 'Design'
  | 'Estimate'
  | 'Quote'
  | 'Follow-up'
  | 'Other';

export type ProjectCommandStaffSummary = {
  userId: string;
  displayName: string;
  email: string | null;
  accessRole: 'admin' | 'staff';
};

export type ProjectCommandOwnerSummary = {
  owner: ProjectOwnerOption | null;
  required: boolean;
  missing: boolean;
  version: string | null;
  permissions: {
    canManage: boolean;
  };
};

type ProjectCommandActionOwnerSummary = {
  userId: string | null;
  displayName: string;
};

type ProjectCommandActionReference = {
  sourceKind: ProjectCommandActionSourceKind;
  sourceId: string;
};

export type ProjectCommandActionSummary = ProjectCommandActionReference & {
  title: string;
  category: ProjectCommandActionCategory;
  sourceLabel: string;
  sourceType: string | null;
  owner: ProjectCommandActionOwnerSummary | null;
  ownerSource: 'source_assignee' | 'project_owner' | 'unassigned';
  dueAt: string | null;
  dueState: 'overdue' | 'today' | 'tomorrow' | 'future' | 'needs_due_date';
  dueLabel: string;
  isCustomerFacing: boolean;
  isCritical: boolean;
  criticalReason: string | null;
  rescheduleCount: number;
  createdAt: string;
  updatedAt: string;
  requiresDueDate: boolean;
  isExplicitlySelected: boolean;
  selectionBaselineHash: string;
};

export type ProjectCommandSelectionConflict = {
  current: ProjectCommandActionSummary;
  challenger: ProjectCommandActionSummary;
  outrankingCandidates: ProjectCommandActionSummary[];
  challengerCount: number;
  candidateRevision: string;
};

export type ProjectCommandAuditEntry = {
  id: string;
  eventType: string;
  actor: ProjectCommandStaffSummary | null;
  reason: string | null;
  createdAt: string;
  source: ProjectCommandActionReference | null;
};

export type ProjectCommandActionPermissions = {
  canCreate: boolean;
  canSelect: boolean;
  canComplete: boolean;
  canReschedule: boolean;
  canReassign: boolean;
  canSetCritical: boolean;
  canResolveConflict: boolean;
};

export type ProjectCommandCentreOperations = {
  owner: ProjectCommandOwnerSummary;
  primaryAction: ProjectCommandActionSummary | null;
  candidates: ProjectCommandActionSummary[];
  candidateCount: number;
  candidateRevision: string;
  manualSelectionBaselineHash: string;
  selectionConflict: ProjectCommandSelectionConflict | null;
  permissions: ProjectCommandActionPermissions;
  audit: ProjectCommandAuditEntry[];
  exceptions: {
    missingOwner: boolean;
    noPrimaryAction: boolean;
    selectionConflict: boolean;
  };
};

export type ProjectCommandCentreResponse = {
  projectId: string;
  currentDesign: ProjectCommandCentreCurrentDesign;
  operations: ProjectCommandCentreOperations;
  generatedAt: string;
};

export type ProjectCommandException = {
  projectId: string;
  projectName: string;
  stage: string;
  reasons: Array<'selection_conflict' | 'no_action' | 'missing_owner'>;
  href: string;
};

export type ProjectCommandExceptionsResponse = {
  counts: Record<ProjectCommandException['reasons'][number], number>;
  projects: ProjectCommandException[];
  totalProjects: number;
  generatedAt: string;
};

export type CommandCentreEstimateCandidate = {
  id: string;
  sourceId: string;
  createdAt: string | null;
  status: 'draft' | 'archived' | 'unknown';
  versionLabel: string;
  isLocked: boolean;
};

export type CommandCentreQuoteCandidate = {
  id: string;
  sourceId: string;
  quoteRef: string | null;
  versionNumber: number | null;
  status: CommandCentreQuoteStatus;
  sourceEstimateId: string | null;
  createdAt: string | null;
  sentAt: string | null;
  totalIncGstCents: number | null;
  sendLogs: Array<{
    status: 'SENT' | 'FAILED';
    createdAt: string | null;
    sentAt: string | null;
  }>;
};

export type CommandCentreSelection = {
  source: CommandCentreSource;
  quote: CommandCentreQuoteCandidate | null;
  estimate: CommandCentreEstimateCandidate | null;
  newerEstimate: CommandCentreEstimateCandidate | null;
  latestDeclinedQuote: CommandCentreQuoteCandidate | null;
  acceptedQuoteCount: number;
  sourceEstimateMissing: boolean;
};
