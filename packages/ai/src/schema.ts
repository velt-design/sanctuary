export type AiContractParseIssueCode =
  | 'invalid_type'
  | 'invalid_value'
  | 'invariant'
  | 'out_of_range'
  | 'unknown_key';

export type AiContractParseIssue = Readonly<{
  code: AiContractParseIssueCode;
  message: string;
  path: string;
}>;

export type AiContractParseResult<T> =
  | Readonly<{ success: true; data: T }>
  | Readonly<{ success: false; issues: readonly AiContractParseIssue[] }>;

export type AiContractSchema<T> = Readonly<{
  parse(value: unknown): T;
  safeParse(value: unknown): AiContractParseResult<T>;
}>;

export class AiContractParseError extends Error {
  readonly issues: readonly AiContractParseIssue[];

  constructor(issues: readonly AiContractParseIssue[]) {
    super(`Invalid Sanctuary AI contract (${issues.length} issue${issues.length === 1 ? '' : 's'})`);
    this.name = 'AiContractParseError';
    this.issues = issues;
  }
}

type AiUnknownRecord = Record<string, unknown>;
type AiParser<T> = (
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
) => T;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const KEY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const VERSION_PATTERN = /^[a-z0-9][a-z0-9.+_-]*$/i;

export function createAiContractSchema<T>(parser: AiParser<T>): AiContractSchema<T> {
  function safeParse(value: unknown): AiContractParseResult<T> {
    const issues: AiContractParseIssue[] = [];
    const data = parser(value, '$', issues);
    return issues.length ? { success: false, issues } : { success: true, data };
  }

  return Object.freeze({
    parse(value: unknown): T {
      const result = safeParse(value);
      if (!result.success) throw new AiContractParseError(result.issues);
      return result.data;
    },
    safeParse,
  });
}

export function addAiIssue(
  issues: AiContractParseIssue[],
  code: AiContractParseIssueCode,
  path: string,
  message: string,
): void {
  issues.push({ code, message, path });
}

export function readAiRecord(
  value: unknown,
  path: string,
  allowedKeys: readonly string[],
  issues: AiContractParseIssue[],
): AiUnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    addAiIssue(issues, 'invalid_type', path, 'Expected an object.');
    return {};
  }

  const record = value as AiUnknownRecord;
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) {
      addAiIssue(issues, 'unknown_key', `${path}.${key}`, `Unknown key "${key}".`);
    }
  }
  return record;
}

export function readAiString(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
  options: Readonly<{ minimum?: number; maximum?: number }> = {},
): string {
  if (typeof value !== 'string') {
    addAiIssue(issues, 'invalid_type', path, 'Expected a string.');
    return '';
  }

  const minimum = options.minimum ?? 1;
  const maximum = options.maximum ?? 1_000;
  if (value.length < minimum || value.length > maximum || value.trim().length < minimum) {
    addAiIssue(issues, 'out_of_range', path, `Expected ${minimum} to ${maximum} characters.`);
  }
  return value;
}

export function readAiNullable<T>(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
  parser: AiParser<T>,
): T | null {
  return value === null ? null : parser(value, path, issues);
}

export function readAiBoolean(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): boolean {
  if (typeof value !== 'boolean') {
    addAiIssue(issues, 'invalid_type', path, 'Expected a boolean.');
    return false;
  }
  return value;
}

export function readAiInteger(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
  options: Readonly<{ minimum?: number; maximum?: number }> = {},
): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    addAiIssue(issues, 'invalid_type', path, 'Expected a safe integer.');
    return 0;
  }
  if (options.minimum !== undefined && value < options.minimum) {
    addAiIssue(issues, 'out_of_range', path, `Expected at least ${options.minimum}.`);
  }
  if (options.maximum !== undefined && value > options.maximum) {
    addAiIssue(issues, 'out_of_range', path, `Expected at most ${options.maximum}.`);
  }
  return value;
}

export function readAiNumber(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
  options: Readonly<{ minimum?: number; maximum?: number }> = {},
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    addAiIssue(issues, 'invalid_type', path, 'Expected a finite number.');
    return 0;
  }
  if (options.minimum !== undefined && value < options.minimum) {
    addAiIssue(issues, 'out_of_range', path, `Expected at least ${options.minimum}.`);
  }
  if (options.maximum !== undefined && value > options.maximum) {
    addAiIssue(issues, 'out_of_range', path, `Expected at most ${options.maximum}.`);
  }
  return value;
}

export function readAiEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  issues: AiContractParseIssue[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    addAiIssue(issues, 'invalid_value', path, `Expected one of: ${allowed.join(', ')}.`);
    return allowed[0];
  }
  return value as T;
}

export function readAiArray<T>(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
  parser: AiParser<T>,
  options: Readonly<{ minimum?: number; maximum?: number }> = {},
): readonly T[] {
  if (!Array.isArray(value)) {
    addAiIssue(issues, 'invalid_type', path, 'Expected an array.');
    return [];
  }

  const minimum = options.minimum ?? 0;
  const maximum = options.maximum ?? 100;
  if (value.length < minimum || value.length > maximum) {
    addAiIssue(issues, 'out_of_range', path, `Expected ${minimum} to ${maximum} items.`);
  }
  return value.map((item, index) => parser(item, `${path}[${index}]`, issues));
}

export function readAiUuid(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): string {
  const result = readAiString(value, path, issues, { maximum: 36 });
  if (result && !UUID_PATTERN.test(result)) {
    addAiIssue(issues, 'invalid_value', path, 'Expected a UUID.');
  }
  return result;
}

export function readAiSha256(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): string {
  const result = readAiString(value, path, issues, { maximum: 71 });
  if (result && !SHA256_PATTERN.test(result)) {
    addAiIssue(issues, 'invalid_value', path, 'Expected a lowercase sha256:<hex> digest.');
  }
  return result;
}

export function readAiKey(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): string {
  const result = readAiString(value, path, issues, { maximum: 120 });
  if (result && !KEY_PATTERN.test(result)) {
    addAiIssue(issues, 'invalid_value', path, 'Expected a lowercase namespaced key.');
  }
  return result;
}

export function readAiVersion(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): string {
  const result = readAiString(value, path, issues, { maximum: 64 });
  if (result && !VERSION_PATTERN.test(result)) {
    addAiIssue(issues, 'invalid_value', path, 'Expected an opaque version identifier.');
  }
  return result;
}

export function readAiTimestamp(
  value: unknown,
  path: string,
  issues: AiContractParseIssue[],
): string {
  const result = readAiString(value, path, issues, { maximum: 40 });
  if (
    result
    && (!/^\d{4}-\d{2}-\d{2}T/.test(result)
      || !Number.isFinite(Date.parse(result))
      || new Date(result).toISOString() !== result)
  ) {
    addAiIssue(issues, 'invalid_value', path, 'Expected a canonical ISO timestamp.');
  }
  return result;
}

export function readAiContractVersion(
  value: unknown,
  expected: number,
  path: string,
  issues: AiContractParseIssue[],
): number {
  const result = readAiInteger(value, path, issues, { minimum: 1 });
  if (result !== expected) {
    addAiIssue(issues, 'invalid_value', path, `Expected contract version ${expected}.`);
  }
  return result;
}

export function requireAiUniqueStrings(
  values: readonly string[],
  path: string,
  issues: AiContractParseIssue[],
): void {
  if (new Set(values).size !== values.length) {
    addAiIssue(issues, 'invariant', path, 'Expected unique values.');
  }
}

export function requireAiTimestampOrder(
  earlier: string | null,
  later: string | null,
  path: string,
  issues: AiContractParseIssue[],
): void {
  if (earlier && later && Date.parse(later) < Date.parse(earlier)) {
    addAiIssue(issues, 'invariant', path, 'Expected timestamp order to be non-decreasing.');
  }
}
