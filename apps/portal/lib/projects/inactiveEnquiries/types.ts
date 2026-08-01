export type InactiveEnquiryCandidate = {
  projectId: string;
  projectName: string;
  pipelineStage: string;
  operationalState: string;
  waitingUntil: string | null;
  ownerKey: string | null;
  lastActivityAt: string;
  lastActivitySource: string;
  inactiveForDays: number;
  protectedByFutureWait: boolean;
  evidenceFingerprint: string;
};

export type InactiveEnquiryReport = {
  reportAsOf: string;
  inactiveDays: number;
  candidateCount: number;
  candidates: InactiveEnquiryCandidate[];
};

export type InactiveEnquiryCloseResult = {
  command: { id: string; committed: true; replayed: boolean };
  result: {
    reportAsOf: string;
    revalidatedAt: string;
    inactiveDays: number;
    closedCount: number;
    projects: Array<{
      projectId: string;
      commandId: string;
      rowVersion: number;
      cancelledCount: number;
    }>;
  };
};
