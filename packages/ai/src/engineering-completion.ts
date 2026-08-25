import {
  ENGINEERING_CHECK_STATUSES,
  ENGINEERING_COMPLETION_OUTCOMES,
  ENGINEERING_COMPLETION_SCHEMA_V1,
  type EngineeringTaskCompletionV1,
} from "./engineering-contracts";
import {
  ENGINEERING_BRANCH_PATTERN,
  ENGINEERING_COMMIT_PATTERN,
  ENGINEERING_TASK_ID_PATTERN,
  readEngineeringLiteral,
  readEngineeringPattern,
  readEngineeringRepoPaths,
  readEngineeringUniqueStrings,
} from "./engineering-schema";
import {
  addAiIssue,
  createAiContractSchema,
  readAiArray,
  readAiBoolean,
  readAiEnum,
  readAiInteger,
  readAiNullable,
  readAiRecord,
  readAiSha256,
  readAiString,
  readAiTimestamp,
  requireAiTimestampOrder,
  type AiContractParseIssue,
} from "./schema";

function parsePullRequest(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): NonNullable<EngineeringTaskCompletionV1["pullRequest"]> {
  const record = readAiRecord(value, path, ["number", "url", "draft"], issues);
  const url = readAiString(record.url, `${path}.url`, issues, { maximum: 500 });
  if (
    url &&
    !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9][0-9]*$/.test(
      url,
    )
  ) {
    addAiIssue(
      issues,
      "invalid_value",
      `${path}.url`,
      "Expected a GitHub pull request URL.",
    );
  }
  return {
    number: readAiInteger(record.number, `${path}.number`, issues, {
      minimum: 1,
    }),
    url,
    draft: readAiBoolean(record.draft, `${path}.draft`, issues),
  };
}

function parseAcceptanceResult(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskCompletionV1["acceptanceResults"][number] {
  const record = readAiRecord(
    value,
    path,
    ["criterion", "status", "evidence"],
    issues,
  );
  return {
    criterion: readAiString(record.criterion, `${path}.criterion`, issues, {
      maximum: 1_000,
    }),
    status: readAiEnum(
      record.status,
      ["passed", "failed", "not_run"] as const,
      `${path}.status`,
      issues,
    ),
    evidence: readAiString(record.evidence, `${path}.evidence`, issues, {
      maximum: 2_000,
    }),
  };
}

function parseVerificationResult(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskCompletionV1["verificationResults"][number] {
  const record = readAiRecord(
    value,
    path,
    ["name", "command", "status", "summary"],
    issues,
  );
  return {
    name: readAiString(record.name, `${path}.name`, issues, { maximum: 200 }),
    command: readAiString(record.command, `${path}.command`, issues, {
      maximum: 1_000,
    }),
    status: readAiEnum(
      record.status,
      ENGINEERING_CHECK_STATUSES,
      `${path}.status`,
      issues,
    ),
    summary: readAiString(record.summary, `${path}.summary`, issues, {
      maximum: 2_000,
    }),
  };
}

function parseCiCheck(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskCompletionV1["ciChecks"][number] {
  const record = readAiRecord(value, path, ["name", "status", "url"], issues);
  return {
    name: readAiString(record.name, `${path}.name`, issues, { maximum: 200 }),
    status: readAiEnum(
      record.status,
      ENGINEERING_CHECK_STATUSES,
      `${path}.status`,
      issues,
    ),
    url: readAiNullable(
      record.url,
      `${path}.url`,
      issues,
      (entry, entryPath, entryIssues) =>
        readAiString(entry, entryPath, entryIssues, { maximum: 500 }),
    ),
  };
}

function parseWorker(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskCompletionV1["worker"] {
  const record = readAiRecord(
    value,
    path,
    [
      "agent",
      "model",
      "sessionIds",
      "attempts",
      "costCents",
      "startedAt",
      "completedAt",
    ],
    issues,
  );
  const startedAt = readAiTimestamp(
    record.startedAt,
    `${path}.startedAt`,
    issues,
  );
  const completedAt = readAiTimestamp(
    record.completedAt,
    `${path}.completedAt`,
    issues,
  );
  requireAiTimestampOrder(
    startedAt,
    completedAt,
    `${path}.completedAt`,
    issues,
  );
  return {
    agent: readAiString(record.agent, `${path}.agent`, issues, {
      maximum: 200,
    }),
    model: readAiString(record.model, `${path}.model`, issues, {
      maximum: 200,
    }),
    sessionIds: readEngineeringUniqueStrings(
      record.sessionIds,
      `${path}.sessionIds`,
      issues,
      { minimum: 1, maximum: 10 },
    ),
    attempts: readAiInteger(record.attempts, `${path}.attempts`, issues, {
      minimum: 1,
      maximum: 20,
    }),
    costCents: readAiInteger(record.costCents, `${path}.costCents`, issues, {
      minimum: 0,
      maximum: 10_000_000,
    }),
    startedAt,
    completedAt,
  };
}

function parseSafety(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskCompletionV1["safety"] {
  const record = readAiRecord(
    value,
    path,
    [
      "worktreeClean",
      "branchPushed",
      "merged",
      "productionEffects",
      "secretScan",
    ],
    issues,
  );
  const merged = readAiBoolean(record.merged, `${path}.merged`, issues);
  const productionEffects = readAiBoolean(
    record.productionEffects,
    `${path}.productionEffects`,
    issues,
  );
  if (merged) {
    addAiIssue(
      issues,
      "invariant",
      `${path}.merged`,
      "The autonomous workflow must stop before merge.",
    );
  }
  if (productionEffects) {
    addAiIssue(
      issues,
      "invariant",
      `${path}.productionEffects`,
      "The engineering workflow may not perform production effects.",
    );
  }
  return {
    worktreeClean: readAiBoolean(
      record.worktreeClean,
      `${path}.worktreeClean`,
      issues,
    ),
    branchPushed: readAiBoolean(
      record.branchPushed,
      `${path}.branchPushed`,
      issues,
    ),
    merged,
    productionEffects,
    secretScan: readAiEnum(
      record.secretScan,
      ["passed", "failed"] as const,
      `${path}.secretScan`,
      issues,
    ),
  };
}

function requireSuccessfulEvidence(
  outcome: EngineeringTaskCompletionV1["outcome"],
  pullRequest: EngineeringTaskCompletionV1["pullRequest"],
  headSha: string | null,
  acceptanceResults: EngineeringTaskCompletionV1["acceptanceResults"],
  safety: EngineeringTaskCompletionV1["safety"],
  path: string,
  issues: AiContractParseIssue[],
): void {
  if (outcome !== "succeeded") return;

  if (!pullRequest?.draft) {
    addAiIssue(
      issues,
      "invariant",
      `${path}.pullRequest`,
      "Success requires an open draft pull request.",
    );
  }
  if (!headSha) {
    addAiIssue(
      issues,
      "invariant",
      `${path}.headSha`,
      "Success requires the pushed head SHA.",
    );
  }
  acceptanceResults.forEach((result, index) => {
    if (result.status !== "passed") {
      addAiIssue(
        issues,
        "invariant",
        `${path}.acceptanceResults[${index}].status`,
        "Every acceptance criterion must pass before success.",
      );
    }
  });
  if (
    !safety.worktreeClean ||
    !safety.branchPushed ||
    safety.secretScan !== "passed"
  ) {
    addAiIssue(
      issues,
      "invariant",
      `${path}.safety`,
      "Success requires a clean worktree, pushed branch, and passed secret scan.",
    );
  }
}

function parseEngineeringTaskCompletionV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskCompletionV1 {
  const record = readAiRecord(
    value,
    path,
    [
      "schema",
      "taskId",
      "manifestHash",
      "outcome",
      "branch",
      "baseSha",
      "headSha",
      "pullRequest",
      "changedPaths",
      "acceptanceResults",
      "verificationResults",
      "ciChecks",
      "worker",
      "safety",
      "limitations",
      "nextAction",
    ],
    issues,
  );
  const outcome = readAiEnum(
    record.outcome,
    ENGINEERING_COMPLETION_OUTCOMES,
    `${path}.outcome`,
    issues,
  );
  const pullRequest = readAiNullable(
    record.pullRequest,
    `${path}.pullRequest`,
    issues,
    parsePullRequest,
  );
  const acceptanceResults = readAiArray(
    record.acceptanceResults,
    `${path}.acceptanceResults`,
    issues,
    parseAcceptanceResult,
    { minimum: 1, maximum: 100 },
  );
  const safety = parseSafety(record.safety, `${path}.safety`, issues);
  const headSha = readAiNullable(
    record.headSha,
    `${path}.headSha`,
    issues,
    (entry, entryPath, entryIssues) =>
      readEngineeringPattern(
        entry,
        ENGINEERING_COMMIT_PATTERN,
        "a 40-character lowercase Git SHA",
        entryPath,
        entryIssues,
      ),
  );

  requireSuccessfulEvidence(
    outcome,
    pullRequest,
    headSha,
    acceptanceResults,
    safety,
    path,
    issues,
  );

  return {
    schema: readEngineeringLiteral(
      record.schema,
      ENGINEERING_COMPLETION_SCHEMA_V1,
      `${path}.schema`,
      issues,
    ),
    taskId: readEngineeringPattern(
      record.taskId,
      ENGINEERING_TASK_ID_PATTERN,
      "an eng_YYYYMMDD_name task id",
      `${path}.taskId`,
      issues,
    ),
    manifestHash: readAiSha256(
      record.manifestHash,
      `${path}.manifestHash`,
      issues,
    ),
    outcome,
    branch: readEngineeringPattern(
      record.branch,
      ENGINEERING_BRANCH_PATTERN,
      "a valid feature branch name",
      `${path}.branch`,
      issues,
    ),
    baseSha: readEngineeringPattern(
      record.baseSha,
      ENGINEERING_COMMIT_PATTERN,
      "a 40-character lowercase Git SHA",
      `${path}.baseSha`,
      issues,
    ),
    headSha,
    pullRequest,
    changedPaths: readEngineeringRepoPaths(
      record.changedPaths,
      `${path}.changedPaths`,
      issues,
    ),
    acceptanceResults,
    verificationResults: readAiArray(
      record.verificationResults,
      `${path}.verificationResults`,
      issues,
      parseVerificationResult,
      { minimum: 1, maximum: 100 },
    ),
    ciChecks: readAiArray(
      record.ciChecks,
      `${path}.ciChecks`,
      issues,
      parseCiCheck,
      { maximum: 100 },
    ),
    worker: parseWorker(record.worker, `${path}.worker`, issues),
    safety,
    limitations: readEngineeringUniqueStrings(
      record.limitations,
      `${path}.limitations`,
      issues,
      { maximum: 100 },
    ),
    nextAction: readAiString(record.nextAction, `${path}.nextAction`, issues, {
      maximum: 1_000,
    }),
  };
}

export const ENGINEERING_TASK_COMPLETION_SCHEMA_V1 = createAiContractSchema(
  parseEngineeringTaskCompletionV1,
);
