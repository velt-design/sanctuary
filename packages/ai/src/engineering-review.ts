import {
  ENGINEERING_REVIEW_SCHEMA_V1,
  ENGINEERING_REVIEW_VERDICTS,
  type EngineeringTaskReviewV1,
} from "./engineering-contracts";
import {
  ENGINEERING_BRANCH_PATTERN,
  ENGINEERING_COMMIT_PATTERN,
  ENGINEERING_TASK_ID_PATTERN,
  readEngineeringLiteral,
  readEngineeringPattern,
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
): EngineeringTaskReviewV1["pullRequest"] {
  const record = readAiRecord(value, path, ["number", "url"], issues);
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
  };
}

function parseAcceptanceResult(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskReviewV1["acceptanceResults"][number] {
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
      ["passed", "failed"] as const,
      `${path}.status`,
      issues,
    ),
    evidence: readAiString(record.evidence, `${path}.evidence`, issues, {
      maximum: 2_000,
    }),
  };
}

function parseFinding(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskReviewV1["findings"][number] {
  const record = readAiRecord(
    value,
    path,
    ["id", "severity", "summary", "evidence", "path", "line"],
    issues,
  );
  const findingPath = readAiNullable(
    record.path,
    `${path}.path`,
    issues,
    (entry, entryPath, entryIssues) => {
      const result = readAiString(entry, entryPath, entryIssues, {
        maximum: 300,
      });
      if (
        result.startsWith("/") ||
        /^[a-zA-Z]:/.test(result) ||
        result.includes("\\") ||
        result.split("/").includes("..")
      ) {
        addAiIssue(
          entryIssues,
          "invalid_value",
          entryPath,
          "Expected a repository-relative path.",
        );
      }
      return result;
    },
  );
  return {
    id: readAiString(record.id, `${path}.id`, issues, { maximum: 100 }),
    severity: readAiEnum(
      record.severity,
      ["blocking", "advisory"] as const,
      `${path}.severity`,
      issues,
    ),
    summary: readAiString(record.summary, `${path}.summary`, issues, {
      maximum: 1_000,
    }),
    evidence: readAiString(record.evidence, `${path}.evidence`, issues, {
      maximum: 2_000,
    }),
    path: findingPath,
    line: readAiNullable(
      record.line,
      `${path}.line`,
      issues,
      (entry, entryPath, entryIssues) =>
        readAiInteger(entry, entryPath, entryIssues, { minimum: 1 }),
    ),
  };
}

function parseReviewer(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskReviewV1["reviewer"] {
  const record = readAiRecord(
    value,
    path,
    ["agent", "model", "sessionId", "costCents", "startedAt", "completedAt"],
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
    sessionId: readAiString(record.sessionId, `${path}.sessionId`, issues, {
      maximum: 500,
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
): EngineeringTaskReviewV1["safety"] {
  const record = readAiRecord(
    value,
    path,
    ["readOnly", "merged", "productionEffects"],
    issues,
  );
  const readOnly = readAiBoolean(record.readOnly, `${path}.readOnly`, issues);
  const merged = readAiBoolean(record.merged, `${path}.merged`, issues);
  const productionEffects = readAiBoolean(
    record.productionEffects,
    `${path}.productionEffects`,
    issues,
  );
  if (!readOnly || merged || productionEffects) {
    addAiIssue(
      issues,
      "invariant",
      path,
      "Review evidence must be read-only and may not merge or cause production effects.",
    );
  }
  return { readOnly: true, merged: false, productionEffects: false };
}

function parseEngineeringTaskReviewV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskReviewV1 {
  const record = readAiRecord(
    value,
    path,
    [
      "schema",
      "taskId",
      "manifestHash",
      "verdict",
      "branch",
      "baseSha",
      "headSha",
      "pullRequest",
      "ciEvidenceHash",
      "acceptanceResults",
      "findings",
      "reviewer",
      "safety",
      "nextAction",
    ],
    issues,
  );
  const verdict = readAiEnum(
    record.verdict,
    ENGINEERING_REVIEW_VERDICTS,
    `${path}.verdict`,
    issues,
  );
  const acceptanceResults = readAiArray(
    record.acceptanceResults,
    `${path}.acceptanceResults`,
    issues,
    parseAcceptanceResult,
    { minimum: 1, maximum: 100 },
  );
  const findings = readAiArray(
    record.findings,
    `${path}.findings`,
    issues,
    parseFinding,
    {
      maximum: 100,
    },
  );
  if (
    verdict === "approved" &&
    (acceptanceResults.some((result) => result.status !== "passed") ||
      findings.some((finding) => finding.severity === "blocking"))
  ) {
    addAiIssue(
      issues,
      "invariant",
      path,
      "Approval requires every acceptance criterion to pass and no blocking finding.",
    );
  }
  if (
    verdict === "changes_requested" &&
    !findings.some((finding) => finding.severity === "blocking")
  ) {
    addAiIssue(
      issues,
      "invariant",
      `${path}.findings`,
      "Changes requested requires at least one blocking finding.",
    );
  }
  return {
    schema: readEngineeringLiteral(
      record.schema,
      ENGINEERING_REVIEW_SCHEMA_V1,
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
    verdict,
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
    headSha: readEngineeringPattern(
      record.headSha,
      ENGINEERING_COMMIT_PATTERN,
      "a 40-character lowercase Git SHA",
      `${path}.headSha`,
      issues,
    ),
    pullRequest: parsePullRequest(
      record.pullRequest,
      `${path}.pullRequest`,
      issues,
    ),
    ciEvidenceHash: readAiSha256(
      record.ciEvidenceHash,
      `${path}.ciEvidenceHash`,
      issues,
    ),
    acceptanceResults,
    findings,
    reviewer: parseReviewer(record.reviewer, `${path}.reviewer`, issues),
    safety: parseSafety(record.safety, `${path}.safety`, issues),
    nextAction: readAiString(record.nextAction, `${path}.nextAction`, issues, {
      maximum: 1_000,
    }),
  };
}

export const ENGINEERING_TASK_REVIEW_SCHEMA_V1 = createAiContractSchema(
  parseEngineeringTaskReviewV1,
);
