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
    'multiple_accepted_quotes' | 'source_design_unavailable' | 'quote_price_unavailable'
  >;
  links: {
    designs: string;
    quotes: string;
    estimate: string | null;
    quote: string | null;
  };
};

export type ProjectCommandCentreResponse = {
  projectId: string;
  currentDesign: ProjectCommandCentreCurrentDesign;
  generatedAt: string;
};

export type CommandCentreEstimateCandidate = {
  id: string;
  sourceId: string;
  createdAt: string | null;
  status: 'draft' | 'archived' | 'unknown';
  versionLabel: string;
  totalIncGstCents: number | null;
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
