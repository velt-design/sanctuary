import type {
  ProjectClosedOutcome,
  ProjectOperationalState,
  ProjectWorkResponsibilityArea,
} from '../types';

export const LEGACY_CONTACTED_RECOMMENDATIONS = [
  'ACTIVE_EVIDENCE',
  'WAITING_CANDIDATE',
  'LOST_NO_RESPONSE_CANDIDATE',
  'MANUAL_CLASSIFICATION',
] as const;
export type LegacyContactedRecommendation =
  (typeof LEGACY_CONTACTED_RECOMMENDATIONS)[number];

export const LEGACY_CONTACTED_DISPOSITIONS = [
  'ACTIVE_WORK',
  'ACTIVE_TRIAGE',
  'WAITING',
  'CLOSED',
] as const;
export type LegacyContactedDisposition =
  (typeof LEGACY_CONTACTED_DISPOSITIONS)[number];

export const LEGACY_CONTACTED_CLOSED_OUTCOMES = [
  'LOST_NO_RESPONSE',
  'LOST_BUDGET_PRICE',
  'LOST_OTHER_SUPPLIER',
  'LOST_TIMING_DEFERRED',
  'LOST_NOT_SUITABLE',
  'CANCELLED',
] as const satisfies readonly ProjectClosedOutcome[];
export type LegacyContactedClosedOutcome =
  (typeof LEGACY_CONTACTED_CLOSED_OUTCOMES)[number];

export type LegacyContactedReasonCode =
  | 'CURRENT_QUOTE'
  | 'CURRENT_INVOICE'
  | 'CURRENT_DESIGN'
  | 'CURRENT_SCHEDULE'
  | 'RUNNING_JOB'
  | 'OPEN_OBLIGATION'
  | 'SENT_EMAIL_EVIDENCE'
  | 'FOLLOW_UP_DUE'
  | 'FUTURE_FOLLOW_UP_DATE'
  | 'FOLLOW_UP_DATE_MISSING'
  | 'INSUFFICIENT_EVIDENCE';

export type LegacyContactedEvidence = {
  currentQuote: boolean;
  currentInvoice: boolean;
  currentDesign: boolean;
  currentSchedule: boolean;
  runningJob: boolean;
  openObligation: boolean;
  sentEmail: boolean;
};

export type LegacyContactedProject = {
  projectId: string;
  projectName: string;
  pipelineStage: string;
  updatedAt: string;
  evidenceFingerprint: string;
  followUpDate: string | null;
  recommendation: LegacyContactedRecommendation;
  reasonCodes: LegacyContactedReasonCode[];
  evidence: LegacyContactedEvidence;
};

type LegacyContactedSummary = {
  total: number;
  due: number;
  archived: number;
  byRecommendation: Record<LegacyContactedRecommendation, number>;
};

export type LegacyContactedCursor = {
  dueRank: number;
  followUpDate: string | null;
  updatedAt: string;
  projectId: string;
  scope: LegacyContactedScope;
};

export type LegacyContactedScope = 'due' | 'all';

export type LegacyContactedReview = {
  projects: LegacyContactedProject[];
  summary: LegacyContactedSummary;
  generatedAt: string;
  nextCursor: LegacyContactedCursor | null;
};

export type LegacyContactedMigrationInput = {
  commandId: string;
  expectedUpdatedAt: string;
  expectedEvidenceFingerprint: string;
  disposition: LegacyContactedDisposition;
  reason: string;
  title?: string | null;
  responsibilityArea?: ProjectWorkResponsibilityArea | null;
  dueAt?: string | null;
  waitingUntil?: string | null;
  closedOutcome?: LegacyContactedClosedOutcome | null;
};

export type LegacyContactedMigrationResult = {
  projectId: string;
  disposition: LegacyContactedDisposition;
  operationalState: ProjectOperationalState;
  stateRowVersion: number;
  workItemId: string | null;
  projectUpdatedAt: string;
  replayed: boolean;
  refreshRequired: boolean;
};

export type ConfirmationCorrectionInput = {
  projectId: string;
  commandId: string;
  confirmationEventId: string;
  reason: string;
};

export type ConfirmationCorrectionResult = {
  projectId: string;
  confirmationEventId: string;
  retractionEventId: string;
  repairSignalId: string;
  reviewRequired: true;
  replayed: boolean;
  refreshRequired: boolean;
};

export type ConfirmationCorrectionReviewInput = {
  projectId: string;
  repairSignalId: string;
  expectedSignalRowVersion: number;
  commandId: string;
  reason: string;
};

export type ConfirmationCorrectionReviewResult = {
  projectId: string;
  repairSignalId: string;
  signalRowVersion: number;
  resolvedCount: number;
  reviewRequired: false;
  replayed: boolean;
  refreshRequired: boolean;
};

export type AdminProjectWorkCommandResponse<T> = {
  command: {
    id: string;
    committed: true;
    replayed: boolean;
  };
  result: T;
};
