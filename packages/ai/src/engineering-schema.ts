import {
  addAiIssue,
  readAiArray,
  readAiString,
  requireAiUniqueStrings,
  type AiContractParseIssue,
} from "./schema";

export const ENGINEERING_TASK_ID_PATTERN =
  /^eng_[0-9]{8}_[a-z0-9][a-z0-9_-]{2,63}$/;
export const ENGINEERING_GOAL_ID_PATTERN =
  /^goal_[0-9]{8}_[a-z0-9][a-z0-9_-]{2,63}$/;
export const ENGINEERING_COMMIT_PATTERN = /^[0-9a-f]{40}$/;
export const ENGINEERING_BRANCH_PATTERN = /^[a-z0-9][a-zA-Z0-9._/-]{1,199}$/;

export function readEngineeringLiteral<T extends string>(
  value: unknown,
  expected: T,
  path: string,
  issues: AiContractParseIssue[],
): T {
  const result = readAiString(value, path, issues, { maximum: 100 });
  if (result !== expected) {
    addAiIssue(issues, "invalid_value", path, `Expected ${expected}.`);
  }
  return expected;
}

export function readEngineeringPattern(
  value: unknown,
  pattern: RegExp,
  label: string,
  path: string,
  issues: AiContractParseIssue[],
): string {
  const result = readAiString(value, path, issues, { maximum: 200 });
  if (result && !pattern.test(result)) {
    addAiIssue(issues, "invalid_value", path, `Expected ${label}.`);
  }
  return result;
}

function readStringItem(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): string {
  return readAiString(value, path, issues, { maximum: 1_000 });
}

export function readEngineeringUniqueStrings(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
  options: Readonly<{ minimum?: number; maximum?: number }> = {},
): readonly string[] {
  const values = readAiArray(value, path, issues, readStringItem, options);
  requireAiUniqueStrings(values, path, issues);
  return values;
}

function readRepoPath(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): string {
  const result = readAiString(value, path, issues, { maximum: 300 });
  if (
    result.startsWith("/") ||
    /^[a-zA-Z]:/.test(result) ||
    result.includes("\\") ||
    result.split("/").includes("..")
  ) {
    addAiIssue(
      issues,
      "invalid_value",
      path,
      "Expected a repository-relative path or glob.",
    );
  }
  return result;
}

function readChangedRepoPath(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): string {
  const result = readRepoPath(value, path, issues);
  if (/[*?\[\]{}]/.test(result) || result.endsWith("/")) {
    addAiIssue(
      issues,
      "invalid_value",
      path,
      "Expected an exact repository-relative file path, not a glob or directory.",
    );
  }
  return result;
}

export function readEngineeringRepoPaths(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
  options: Readonly<{ minimum?: number }> = {},
): readonly string[] {
  const values = readAiArray(value, path, issues, readRepoPath, {
    minimum: options.minimum ?? 0,
    maximum: 200,
  });
  requireAiUniqueStrings(values, path, issues);
  return values;
}

export function readEngineeringChangedPaths(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): readonly string[] {
  const values = readAiArray(value, path, issues, readChangedRepoPath, {
    maximum: 500,
  });
  requireAiUniqueStrings(values, path, issues);
  return values;
}
