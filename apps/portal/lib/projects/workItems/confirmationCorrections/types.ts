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
