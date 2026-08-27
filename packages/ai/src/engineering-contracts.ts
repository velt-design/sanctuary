export const ENGINEERING_TASK_SCHEMA_V1 =
  "sanctuary-engineering-task-v1" as const;
export const ENGINEERING_COMPLETION_SCHEMA_V1 =
  "sanctuary-engineering-completion-v1" as const;
export const ENGINEERING_REVIEW_SCHEMA_V1 =
  "sanctuary-engineering-review-v1" as const;

export const ENGINEERING_TASK_RISKS = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type EngineeringTaskRisk = (typeof ENGINEERING_TASK_RISKS)[number];

export const ENGINEERING_COMPLETION_OUTCOMES = [
  "succeeded",
  "blocked",
  "failed",
] as const;
export type EngineeringCompletionOutcome =
  (typeof ENGINEERING_COMPLETION_OUTCOMES)[number];

export const ENGINEERING_REVIEW_VERDICTS = [
  "approved",
  "changes_requested",
  "blocked",
] as const;
export type EngineeringReviewVerdict =
  (typeof ENGINEERING_REVIEW_VERDICTS)[number];

export const ENGINEERING_CHECK_STATUSES = [
  "passed",
  "failed",
  "baseline_failure",
  "pending",
  "not_run",
] as const;
export type EngineeringCheckStatus =
  (typeof ENGINEERING_CHECK_STATUSES)[number];

export type EngineeringTaskManifestV1 = Readonly<{
  schema: typeof ENGINEERING_TASK_SCHEMA_V1;
  taskId: string;
  goalId: string;
  objective: string;
  requestedBy: string;
  base: Readonly<{ ref: string; sha: string }>;
  branch: string;
  risk: EngineeringTaskRisk;
  ownerLane: string;
  roles: Readonly<{
    supervisor: "engineering_lead";
    worker: "coding_worker";
    reviewer: "code_reviewer";
  }>;
  readFirst: readonly string[];
  ownedPaths: readonly string[];
  excludedPaths: readonly string[];
  dependencies: readonly string[];
  acceptanceCriteria: readonly string[];
  verification: Readonly<{
    focusedCommands: readonly string[];
    ciChecks: readonly string[];
    visualEvidence: Readonly<{
      required: boolean;
      scenarios: readonly string[];
    }>;
  }>;
  limits: Readonly<{
    maxWorkers: number;
    maxAttempts: number;
    workerTimeoutMinutes: number;
    maxCostCents: number;
  }>;
  approvals: Readonly<{
    planning: "approved";
    merge: "human_required";
    scopeExpansion: "human_required";
    production: "prohibited";
  }>;
  outputs: Readonly<{
    draftPullRequest: true;
    completionReport: true;
  }>;
  stopConditions: readonly string[];
}>;

export type EngineeringTaskCompletionV1 = Readonly<{
  schema: typeof ENGINEERING_COMPLETION_SCHEMA_V1;
  taskId: string;
  manifestHash: string;
  outcome: EngineeringCompletionOutcome;
  branch: string;
  baseSha: string;
  headSha: string | null;
  pullRequest: Readonly<{
    number: number;
    url: string;
    draft: boolean;
  }> | null;
  changedPaths: readonly string[];
  acceptanceResults: readonly Readonly<{
    criterion: string;
    status: "passed" | "failed" | "not_run";
    evidence: string;
  }>[];
  verificationResults: readonly Readonly<{
    name: string;
    command: string;
    status: EngineeringCheckStatus;
    summary: string;
  }>[];
  ciChecks: readonly Readonly<{
    name: string;
    status: EngineeringCheckStatus;
    url: string | null;
  }>[];
  worker: Readonly<{
    agent: string;
    model: string;
    sessionIds: readonly string[];
    attempts: number;
    costCents: number;
    startedAt: string;
    completedAt: string;
  }>;
  safety: Readonly<{
    worktreeClean: boolean;
    branchPushed: boolean;
    merged: boolean;
    productionEffects: boolean;
    secretScan: "passed" | "failed";
  }>;
  limitations: readonly string[];
  nextAction: string;
}>;

export type EngineeringTaskReviewV1 = Readonly<{
  schema: typeof ENGINEERING_REVIEW_SCHEMA_V1;
  taskId: string;
  manifestHash: string;
  verdict: EngineeringReviewVerdict;
  branch: string;
  baseSha: string;
  headSha: string;
  pullRequest: Readonly<{
    number: number;
    url: string;
  }>;
  ciEvidenceHash: string;
  acceptanceResults: readonly Readonly<{
    criterion: string;
    status: "passed" | "failed";
    evidence: string;
  }>[];
  findings: readonly Readonly<{
    id: string;
    severity: "blocking" | "advisory";
    summary: string;
    evidence: string;
    path: string | null;
    line: number | null;
  }>[];
  reviewer: Readonly<{
    agent: string;
    model: string;
    sessionId: string;
    costCents: number;
    startedAt: string;
    completedAt: string;
  }>;
  safety: Readonly<{
    readOnly: true;
    merged: false;
    productionEffects: false;
  }>;
  nextAction: string;
}>;
