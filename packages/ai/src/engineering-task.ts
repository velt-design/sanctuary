import {
  ENGINEERING_TASK_RISKS,
  ENGINEERING_TASK_SCHEMA_V1,
  type EngineeringTaskManifestV1,
} from "./engineering-contracts";
import {
  ENGINEERING_BRANCH_PATTERN,
  ENGINEERING_COMMIT_PATTERN,
  ENGINEERING_GOAL_ID_PATTERN,
  ENGINEERING_TASK_ID_PATTERN,
  readEngineeringLiteral,
  readEngineeringPattern,
  readEngineeringRepoPaths,
  readEngineeringUniqueStrings,
} from "./engineering-schema";
import {
  addAiIssue,
  createAiContractSchema,
  readAiBoolean,
  readAiEnum,
  readAiInteger,
  readAiRecord,
  readAiString,
  type AiContractParseIssue,
} from "./schema";

function parseBase(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskManifestV1["base"] {
  const record = readAiRecord(value, path, ["ref", "sha"], issues);
  return {
    ref: readAiString(record.ref, `${path}.ref`, issues, { maximum: 200 }),
    sha: readEngineeringPattern(
      record.sha,
      ENGINEERING_COMMIT_PATTERN,
      "a 40-character lowercase Git SHA",
      `${path}.sha`,
      issues,
    ),
  };
}

function parseRoles(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskManifestV1["roles"] {
  const record = readAiRecord(
    value,
    path,
    ["supervisor", "worker", "reviewer"],
    issues,
  );
  return {
    supervisor: readEngineeringLiteral(
      record.supervisor,
      "engineering_lead",
      `${path}.supervisor`,
      issues,
    ),
    worker: readEngineeringLiteral(
      record.worker,
      "coding_worker",
      `${path}.worker`,
      issues,
    ),
    reviewer: readEngineeringLiteral(
      record.reviewer,
      "code_reviewer",
      `${path}.reviewer`,
      issues,
    ),
  };
}

function parseVisualEvidence(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskManifestV1["verification"]["visualEvidence"] {
  const record = readAiRecord(value, path, ["required", "scenarios"], issues);
  const required = readAiBoolean(record.required, `${path}.required`, issues);
  const scenarios = readEngineeringUniqueStrings(
    record.scenarios,
    `${path}.scenarios`,
    issues,
    { maximum: 50 },
  );
  if (required && scenarios.length === 0) {
    addAiIssue(
      issues,
      "invariant",
      `${path}.scenarios`,
      "Required visual evidence needs a scenario.",
    );
  }
  return { required, scenarios };
}

function parseVerification(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskManifestV1["verification"] {
  const record = readAiRecord(
    value,
    path,
    ["focusedCommands", "ciChecks", "visualEvidence"],
    issues,
  );
  return {
    focusedCommands: readEngineeringUniqueStrings(
      record.focusedCommands,
      `${path}.focusedCommands`,
      issues,
      { minimum: 1, maximum: 50 },
    ),
    ciChecks: readEngineeringUniqueStrings(
      record.ciChecks,
      `${path}.ciChecks`,
      issues,
      { minimum: 1, maximum: 50 },
    ),
    visualEvidence: parseVisualEvidence(
      record.visualEvidence,
      `${path}.visualEvidence`,
      issues,
    ),
  };
}

function parseLimits(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskManifestV1["limits"] {
  const record = readAiRecord(
    value,
    path,
    ["maxWorkers", "maxAttempts", "workerTimeoutMinutes", "maxCostCents"],
    issues,
  );
  return {
    maxWorkers: readAiInteger(record.maxWorkers, `${path}.maxWorkers`, issues, {
      minimum: 1,
      maximum: 3,
    }),
    maxAttempts: readAiInteger(
      record.maxAttempts,
      `${path}.maxAttempts`,
      issues,
      { minimum: 1, maximum: 5 },
    ),
    workerTimeoutMinutes: readAiInteger(
      record.workerTimeoutMinutes,
      `${path}.workerTimeoutMinutes`,
      issues,
      { minimum: 5, maximum: 240 },
    ),
    maxCostCents: readAiInteger(
      record.maxCostCents,
      `${path}.maxCostCents`,
      issues,
      { minimum: 0, maximum: 100_000 },
    ),
  };
}

function parseApprovals(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskManifestV1["approvals"] {
  const record = readAiRecord(
    value,
    path,
    ["planning", "merge", "scopeExpansion", "production"],
    issues,
  );
  return {
    planning: readEngineeringLiteral(
      record.planning,
      "approved",
      `${path}.planning`,
      issues,
    ),
    merge: readEngineeringLiteral(
      record.merge,
      "human_required",
      `${path}.merge`,
      issues,
    ),
    scopeExpansion: readEngineeringLiteral(
      record.scopeExpansion,
      "human_required",
      `${path}.scopeExpansion`,
      issues,
    ),
    production: readEngineeringLiteral(
      record.production,
      "prohibited",
      `${path}.production`,
      issues,
    ),
  };
}

function parseOutputs(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskManifestV1["outputs"] {
  const record = readAiRecord(
    value,
    path,
    ["draftPullRequest", "completionReport"],
    issues,
  );
  const draftPullRequest = readAiBoolean(
    record.draftPullRequest,
    `${path}.draftPullRequest`,
    issues,
  );
  const completionReport = readAiBoolean(
    record.completionReport,
    `${path}.completionReport`,
    issues,
  );
  if (!draftPullRequest) {
    addAiIssue(
      issues,
      "invariant",
      `${path}.draftPullRequest`,
      "AI engineering work must stop at a draft PR.",
    );
  }
  if (!completionReport) {
    addAiIssue(
      issues,
      "invariant",
      `${path}.completionReport`,
      "A structured completion report is required.",
    );
  }
  return { draftPullRequest: true, completionReport: true };
}

function parseEngineeringTaskManifestV1(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): EngineeringTaskManifestV1 {
  const record = readAiRecord(
    value,
    path,
    [
      "schema",
      "taskId",
      "goalId",
      "objective",
      "requestedBy",
      "base",
      "branch",
      "risk",
      "ownerLane",
      "roles",
      "readFirst",
      "ownedPaths",
      "excludedPaths",
      "dependencies",
      "acceptanceCriteria",
      "verification",
      "limits",
      "approvals",
      "outputs",
      "stopConditions",
    ],
    issues,
  );
  const taskId = readEngineeringPattern(
    record.taskId,
    ENGINEERING_TASK_ID_PATTERN,
    "an eng_YYYYMMDD_name task id",
    `${path}.taskId`,
    issues,
  );
  const dependencies = readEngineeringUniqueStrings(
    record.dependencies,
    `${path}.dependencies`,
    issues,
    { maximum: 50 },
  );
  dependencies.forEach((dependency, index) => {
    if (!ENGINEERING_TASK_ID_PATTERN.test(dependency)) {
      addAiIssue(
        issues,
        "invalid_value",
        `${path}.dependencies[${index}]`,
        "Expected an eng_YYYYMMDD_name task id.",
      );
    }
  });
  if (dependencies.includes(taskId)) {
    addAiIssue(
      issues,
      "invariant",
      `${path}.dependencies`,
      "A task cannot depend on itself.",
    );
  }
  const branch = readEngineeringPattern(
    record.branch,
    ENGINEERING_BRANCH_PATTERN,
    "a valid feature branch name",
    `${path}.branch`,
    issues,
  );
  if (branch === "main" || branch === "master") {
    addAiIssue(
      issues,
      "invariant",
      `${path}.branch`,
      "AI engineering work must use a feature branch.",
    );
  }

  return {
    schema: readEngineeringLiteral(
      record.schema,
      ENGINEERING_TASK_SCHEMA_V1,
      `${path}.schema`,
      issues,
    ),
    taskId,
    goalId: readEngineeringPattern(
      record.goalId,
      ENGINEERING_GOAL_ID_PATTERN,
      "a goal_YYYYMMDD_name goal id",
      `${path}.goalId`,
      issues,
    ),
    objective: readAiString(record.objective, `${path}.objective`, issues, {
      maximum: 2_000,
    }),
    requestedBy: readAiString(
      record.requestedBy,
      `${path}.requestedBy`,
      issues,
      { maximum: 200 },
    ),
    base: parseBase(record.base, `${path}.base`, issues),
    branch,
    risk: readAiEnum(
      record.risk,
      ENGINEERING_TASK_RISKS,
      `${path}.risk`,
      issues,
    ),
    ownerLane: readAiString(record.ownerLane, `${path}.ownerLane`, issues, {
      maximum: 200,
    }),
    roles: parseRoles(record.roles, `${path}.roles`, issues),
    readFirst: readEngineeringRepoPaths(
      record.readFirst,
      `${path}.readFirst`,
      issues,
      { minimum: 1 },
    ),
    ownedPaths: readEngineeringRepoPaths(
      record.ownedPaths,
      `${path}.ownedPaths`,
      issues,
      { minimum: 1 },
    ),
    excludedPaths: readEngineeringRepoPaths(
      record.excludedPaths,
      `${path}.excludedPaths`,
      issues,
    ),
    dependencies,
    acceptanceCriteria: readEngineeringUniqueStrings(
      record.acceptanceCriteria,
      `${path}.acceptanceCriteria`,
      issues,
      { minimum: 1, maximum: 100 },
    ),
    verification: parseVerification(
      record.verification,
      `${path}.verification`,
      issues,
    ),
    limits: parseLimits(record.limits, `${path}.limits`, issues),
    approvals: parseApprovals(record.approvals, `${path}.approvals`, issues),
    outputs: parseOutputs(record.outputs, `${path}.outputs`, issues),
    stopConditions: readEngineeringUniqueStrings(
      record.stopConditions,
      `${path}.stopConditions`,
      issues,
      { minimum: 1, maximum: 100 },
    ),
  };
}

export const ENGINEERING_TASK_MANIFEST_SCHEMA_V1 = createAiContractSchema(
  parseEngineeringTaskManifestV1,
);
