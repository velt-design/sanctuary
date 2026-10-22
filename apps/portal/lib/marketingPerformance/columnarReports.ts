/** Initial-document transport only. Readers, APIs and consumer report schemas stay authoritative. */
const format = 'marketing-columns-v1' as const;
const arrays = {
  hub: [['projects'], ['events'], ['enquiries', 'rows']],
  commercial: [['rows']],
  designer: [['visits'], ['scopes'], ['assignments'], ['salesOutcomes'], ['salesProjects']],
} as const;
export type ColumnarKind = keyof typeof arrays;
export type ColumnarReport = { format: typeof format; kind: ColumnarKind; report: unknown };
type Columns = { fields: string[]; count: number; columns: unknown[][] };
type RecordValue = Record<string, unknown>;
const maxRows = 10_000, maxFields = 64;
const own = (value: object, key: string) => Object.hasOwn(value, key);
function record(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}
function at(value: unknown, path: readonly string[]): unknown {
  for (const key of path) { if (!record(value) || !own(value, key)) throw Error('Missing report rows'); value = value[key]; }
  return value;
}
function replace(value: unknown, path: readonly string[], next: unknown): RecordValue {
  if (!record(value)) throw Error('Invalid report object');
  const [key, ...rest] = path;
  return { ...value, [key]: rest.length ? replace(value[key], rest, next) : next };
}
function pack(value: unknown): Columns {
  if (!Array.isArray(value) || value.length > maxRows) throw Error('Unsupported report rows');
  const fields = value.length && record(value[0]) ? Object.keys(value[0]) : [];
  if (fields.length > maxFields || fields.some(key => !key.length || key.length > 100) || (value.length && !fields.length)) throw Error('Unsupported report fields');
  for (const row of value) {
    if (!record(row) || Reflect.ownKeys(row).length !== fields.length
      || Object.keys(row).some((key, index) => key !== fields[index])
      || fields.some(key => !Object.getOwnPropertyDescriptor(row, key)?.enumerable || !own(Object.getOwnPropertyDescriptor(row, key)!, 'value')))
      throw Error('Heterogeneous report rows');
  }
  return { fields, count: value.length, columns: fields.map(key => value.map(row => row[key])) };
}
function unpack(value: unknown): RecordValue[] {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'columns,count,fields'
    || !Array.isArray(value.fields) || value.fields.length > maxFields
    || Array.from(value.fields).some(key => typeof key !== 'string' || !key.length || key.length > 100)
    || new Set(value.fields).size !== value.fields.length
    || !Number.isInteger(value.count) || (value.count as number) < 0 || (value.count as number) > maxRows
    || ((value.count as number) > 0 && !value.fields.length)
    || !Array.isArray(value.columns) || value.columns.length !== value.fields.length) throw Error('Invalid report columns');
  const fields = value.fields as string[], columns = value.columns as unknown[][];
  for (const column of columns) {
    if (!Array.isArray(column) || column.length !== value.count) throw Error('Invalid report column');
    for (let index = 0; index < column.length; index++) if (!Object.hasOwn(column, index)) throw Error('Missing report value');
  }
  return Array.from({ length: value.count as number }, (_, index) => Object.fromEntries(fields.map((key, column) => [key, columns[column][index]])));
}
export function columnarReport<T>(kind: ColumnarKind, report: T): T | ColumnarReport {
  try {
    let next: unknown = report;
    for (const path of arrays[kind]) next = replace(next, path, pack(at(report, path)));
    return { format, kind, report: next };
  } catch {
    // New/heterogeneous shapes retain the complete authoritative report instead
    // of dropping optional/new fields or making valid evidence unavailable.
    return report;
  }
}
export function expandReport(kind: ColumnarKind, input: unknown): unknown {
  if (!record(input) || !own(input, 'format')) return input;
  try {
    if (input.format !== format || input.kind !== kind || Object.keys(input).sort().join(',') !== 'format,kind,report') throw Error('Unknown report wire format');
    let next = input.report;
    for (const path of arrays[kind]) next = replace(next, path, unpack(at(next, path)));
    return next;
  } catch { throw Error('The evidence could not be verified. No partial totals are shown.'); }
}
type EncodedRead<Result> = Result extends { ok: true; report: infer Report } ? Omit<Result, 'report'> & { report: Report | ColumnarReport } : Result;
export function columnarRead<Result extends { ok: true; report: unknown } | { ok: false }>(kind: ColumnarKind, result: Result): EncodedRead<Result> {
  return (result.ok ? { ...result, report: columnarReport(kind, result.report) } : result) as EncodedRead<Result>;
}
