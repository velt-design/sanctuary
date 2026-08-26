import { ENGINEERING_TASK_COMPLETION_SCHEMA_V1 } from "./engineering-completion";
import type {
  EngineeringTaskCompletionV1,
  EngineeringTaskManifestV1,
} from "./engineering-contracts";
import { ENGINEERING_TASK_MANIFEST_SCHEMA_V1 } from "./engineering-task";
import {
  addAiIssue,
  AiContractParseError,
  type AiContractParseIssue,
  type AiContractParseResult,
} from "./schema";

function engineeringPathPatternMatches(pattern: string, path: string): boolean {
  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        source += "(?:.*/)?";
        index += 2;
      } else {
        source += ".*";
        index += 1;
      }
      continue;
    }
    if (character === "*") {
      source += "[^/]*";
      continue;
    }
    if (character === "?") {
      source += "[^/]";
      continue;
    }
    source += character.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }
  return new RegExp(`${source}$`).test(path);
}

function requireExactManifestValue(
  actual: string,
  expected: string,
  path: string,
  label: string,
  issues: AiContractParseIssue[],
): void {
  if (actual !== expected) {
    addAiIssue(
      issues,
      "invariant",
      path,
      `Completion ${label} must match the validated task manifest.`,
    );
  }
}

function requireExactManifestEntries<T>(
  actual: readonly T[],
  expected: readonly string[],
  key: (entry: T) => string,
  path: string,
  keyName: string,
  label: string,
  issues: AiContractParseIssue[],
): void {
  const expectedSet = new Set(expected);
  const counts = new Map<string, number>();
  actual.forEach((entry, index) => {
    const value = key(entry);
    counts.set(value, (counts.get(value) ?? 0) + 1);
    if (!expectedSet.has(value)) {
      addAiIssue(
        issues,
        "invariant",
        `${path}[${index}].${keyName}`,
        `Completion ${label} must come from the validated task manifest.`,
      );
    }
  });
  expected.forEach((value) => {
    if (counts.get(value) !== 1) {
      addAiIssue(
        issues,
        "invariant",
        path,
        `Completion must contain exactly one result for every manifest ${label}.`,
      );
    }
  });
}

function requireChangedPathOwnership(
  manifest: EngineeringTaskManifestV1,
  completion: EngineeringTaskCompletionV1,
  issues: AiContractParseIssue[],
): void {
  completion.changedPaths.forEach((path, index) => {
    const issuePath = `$.changedPaths[${index}]`;
    if (
      manifest.excludedPaths.some((pattern) =>
        engineeringPathPatternMatches(pattern, path),
      )
    ) {
      addAiIssue(
        issues,
        "invariant",
        issuePath,
        "Changed path is excluded by the validated task manifest.",
      );
      return;
    }
    if (
      !manifest.ownedPaths.some((pattern) =>
        engineeringPathPatternMatches(pattern, path),
      )
    ) {
      addAiIssue(
        issues,
        "invariant",
        issuePath,
        "Changed path is outside the validated task manifest ownership lane.",
      );
    }
  });
}

function validateCompletionManifestBinding(
  manifest: EngineeringTaskManifestV1,
  expectedManifestHash: string,
  completion: EngineeringTaskCompletionV1,
): readonly AiContractParseIssue[] {
  const issues: AiContractParseIssue[] = [];
  requireExactManifestValue(
    completion.manifestHash,
    expectedManifestHash,
    "$.manifestHash",
    "manifest hash",
    issues,
  );
  requireExactManifestValue(
    completion.taskId,
    manifest.taskId,
    "$.taskId",
    "task id",
    issues,
  );
  requireExactManifestValue(
    completion.baseSha,
    manifest.base.sha,
    "$.baseSha",
    "base SHA",
    issues,
  );
  requireExactManifestValue(
    completion.branch,
    manifest.branch,
    "$.branch",
    "branch",
    issues,
  );
  requireExactManifestEntries(
    completion.acceptanceResults,
    manifest.acceptanceCriteria,
    (result) => result.criterion,
    "$.acceptanceResults",
    "criterion",
    "acceptance criterion",
    issues,
  );
  requireExactManifestEntries(
    completion.verificationResults,
    manifest.verification.focusedCommands,
    (result) => result.command,
    "$.verificationResults",
    "command",
    "focused verification command",
    issues,
  );
  requireExactManifestEntries(
    completion.ciChecks,
    manifest.verification.ciChecks,
    (result) => result.name,
    "$.ciChecks",
    "name",
    "CI check",
    issues,
  );
  requireChangedPathOwnership(manifest, completion, issues);
  if (completion.worker.attempts > manifest.limits.maxAttempts) {
    addAiIssue(
      issues,
      "out_of_range",
      "$.worker.attempts",
      "Worker attempts exceed the validated task manifest limit.",
    );
  }
  if (completion.worker.costCents > manifest.limits.maxCostCents) {
    addAiIssue(
      issues,
      "out_of_range",
      "$.worker.costCents",
      "Worker cost exceeds the validated task manifest limit.",
    );
  }
  return issues;
}

export function safeParseEngineeringTaskCompletionForManifestV1(
  manifestValue: unknown,
  expectedManifestHash: string,
  completionValue: unknown,
): AiContractParseResult<EngineeringTaskCompletionV1> {
  const manifestResult = ENGINEERING_TASK_MANIFEST_SCHEMA_V1.safeParse(
    manifestValue,
  );
  const completionResult =
    ENGINEERING_TASK_COMPLETION_SCHEMA_V1.safeParse(completionValue);
  if (!manifestResult.success || !completionResult.success) {
    return {
      success: false,
      issues: [
        ...(manifestResult.success ? [] : manifestResult.issues),
        ...(completionResult.success ? [] : completionResult.issues),
      ],
    };
  }
  const issues = validateCompletionManifestBinding(
    manifestResult.data,
    expectedManifestHash,
    completionResult.data,
  );
  return issues.length
    ? { success: false, issues }
    : { success: true, data: completionResult.data };
}

export function parseEngineeringTaskCompletionForManifestV1(
  manifestValue: unknown,
  expectedManifestHash: string,
  completionValue: unknown,
): EngineeringTaskCompletionV1 {
  const result = safeParseEngineeringTaskCompletionForManifestV1(
    manifestValue,
    expectedManifestHash,
    completionValue,
  );
  if (!result.success) throw new AiContractParseError(result.issues);
  return result.data;
}
