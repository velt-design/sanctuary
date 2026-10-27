import { z } from 'zod';
import { JOURNEY_COMPLETE_FROM } from './journey';
import { shiftDate, type Measure, type ReportQuery } from './report';

export const DIAGNOSTIC_VERSION = 'sanctuary-ga4-v3' as const;
export const MAX_ACQUISITION_COHORTS = 750;
export const STAGES = ['contact_form_interaction', 'contact_start', 'contact_success'] as const;
export const WITHHELD_LABEL = '(withheld for privacy)';
export const WITHHELD_PATH = '/[withheld for privacy]';
export const PRIVACY_WARNING = 'Private or unsafe dimension labels are grouped as withheld for privacy. Missing observations remain unknown.';
const count = z.number().int().nonnegative().safe().nullable();
const pair = z.object({ value: count, previous: count }).strict();
const stage = <T extends typeof STAGES[number]>(event: T) => z.object({ event: z.literal(event), count: pair }).strict();
const quality = z.object({ sampled: z.boolean(), thresholded: z.boolean(), otherRowLoss: z.boolean(), provisional: z.boolean(), comparisonsAllowed: z.boolean() }).strict()
  .refine(value => !(value.sampled || value.thresholded || value.otherRowLoss || value.provisional) || !value.comparisonsAllowed);
const label = (maximum: number) => z.string().min(1).max(maximum).refine(safeLabel);
const path = label(512).refine(safePath);
const cohort = z.object({ sourceMedium: label(128), landingPath: path, deviceCategory: label(32), sessions: pair, firstEdits: pair, submitAttempts: pair, acceptedSuccesses: pair }).strict();
const acquisitionBase = { dimensions: z.tuple([z.literal('sessionSourceMedium'), z.literal('landingPage'), z.literal('deviceCategory')]),
  sessionUnit: z.literal('sessions'), eventUnit: z.literal('event_occurrences'), quality,
  rows: z.array(cohort).max(MAX_ACQUISITION_COHORTS).refine(rows => new Set(rows.map(row => JSON.stringify([row.sourceMedium, row.landingPath, row.deviceCategory]))).size === rows.length) };
export const acquisitionSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('available'), ...acquisitionBase }).strict(),
  z.object({ status: z.literal('limited'), ...acquisitionBase }).strict(),
  z.object({ status: z.literal('unavailable'), reason: z.enum(['row_limit', 'compatibility_unproven']) }).strict(),
]).superRefine((value, context) => {
  if (value.status === 'unavailable') return;
  const limited = value.quality.sampled || value.quality.thresholded || value.quality.otherRowLoss;
  if ((value.status === 'limited') !== limited) context.addIssue({ code: 'custom', message: 'Acquisition quality differs.' });
  if (!value.quality.comparisonsAllowed && value.rows.some(row => [row.sessions, row.firstEdits, row.submitAttempts, row.acceptedSuccesses].some(cell => cell.previous !== null)))
    context.addIssue({ code: 'custom', message: 'Unsafe acquisition comparisons.' });
});
export const diagnosticsSchema = z.object({ version: z.literal(DIAGNOSTIC_VERSION), firstEditCompleteFrom: z.null(),
  stageUnit: z.literal('event_occurrences'), stagesQuality: quality,
  stages: z.tuple([stage('contact_form_interaction'), stage('contact_start'), stage('contact_success')]),
  acquisition: acquisitionSchema,
  orderedFunnel: z.object({ status: z.literal('unavailable'), reason: z.literal('source_capability_unproven'), unit: z.literal('active_users') }).strict(),
}).strict().superRefine((value, context) => {
  if ((!value.firstEditCompleteFrom && value.stages[0].count.previous !== null)
    || (!value.stagesQuality.comparisonsAllowed && value.stages.some(stage => stage.count.previous !== null))) context.addIssue({ code: 'custom', message: 'Unsafe stage comparisons.' });
  if (!value.firstEditCompleteFrom && value.acquisition.status !== 'unavailable' && value.acquisition.rows.some(row => row.firstEdits.previous !== null))
    context.addIssue({ code: 'custom', message: 'First-edit coverage is unknown.' });
});
export type Diagnostics = z.infer<typeof diagnosticsSchema>;
export type Acquisition = z.infer<typeof acquisitionSchema>;
export function validateDiagnosticComparisons(value: Diagnostics, query: { comparison: { start: string } | null }): void {
  const known = query.comparison && query.comparison.start >= '2026-09-17';
  const cells = [...value.stages.slice(1).map(stage => stage.count), ...(value.acquisition.status === 'unavailable' ? [] : value.acquisition.rows.flatMap(row => [row.submitAttempts, row.acceptedSuccesses]))];
  if ((!known && cells.some(cell => cell.previous !== null)) || (!query.comparison && value.acquisition.status !== 'unavailable' && value.acquisition.rows.some(row => row.sessions.previous !== null)))
    throw new Error('Diagnostic comparison coverage differs.');
}
type Quality = Diagnostics['stagesQuality'];
const acquisitionReasons = ['profile', 'dimension_count', 'unsafe_dimension', 'range', 'duplicate_row', 'invalid_metric', 'row_count', 'incomplete_rows'] as const;
class AcquisitionValidationFailure extends Error {
  constructor(readonly reason: typeof acquisitionReasons[number]) { super('Acquisition validation failed.'); }
}
/** Closed classifications only; never expose Zod issues or provider values. */
export function acquisitionValidationReason(error: unknown): string | null {
  if (error instanceof z.ZodError) return 'response_schema';
  return error instanceof AcquisitionValidationFailure && acquisitionReasons.includes(error.reason) ? error.reason : null;
}

export function safeLabel(value: string): boolean {
  return ![...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    && !/[^\s@]+@[^\s@]+\.[^\s@]+|:\/\/|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|\beyJ[A-Za-z0-9_-]{12,}/i.test(value);
}
export function safePath(value: string): boolean {
  let decoded: string; try { decoded = decodeURIComponent(value); } catch { return false; }
  return value === '(not set)' || (value.startsWith('/') && !value.startsWith('//') && decoded.startsWith('/') && !decoded.startsWith('//') && safeLabel(decoded)
    && !/[?#\\%]/.test(decoded) && !/^\/(api|staff|admin|auth|login|quote|quotes|invoice|invoices)(\/|$)/i.test(decoded));
}
const observed = (value: string) => { if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new AcquisitionValidationFailure('invalid_metric'); return Number(value); };
const metadata = z.object({ timeZone: z.string().min(1).max(80), subjectToThresholding: z.boolean().default(false), dataLossFromOtherRow: z.boolean().default(false),
  samplingMetadatas: z.array(z.object({ samplesReadCount: z.string().regex(/^\d+$/), samplingSpaceSize: z.string().regex(/^\d+$/) })).max(2).optional(),
  emptyReason: z.string().max(512).optional(), schemaRestrictionResponse: z.object({ activeMetricRestrictions: z.array(z.unknown()).max(10).optional() }).optional() });
type Metadata = z.infer<typeof metadata>;
function flags(data: Metadata, query: ReportQuery, now: Date): Quality {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: data.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const sampled = Boolean(data.samplingMetadatas?.length), thresholded = data.subjectToThresholding, otherRowLoss = data.dataLossFromOtherRow, provisional = query.period.end >= shiftDate(today, -3);
  return { sampled, thresholded, otherRowLoss, provisional, comparisonsAllowed: !(sampled || thresholded || otherRowLoss || provisional) };
}
export function coreDiagnostics(rows: Measure[], data: unknown, query: ReportQuery, now: Date): Diagnostics {
  const stagesQuality = flags(metadata.parse(data), query, now);
  return diagnosticsSchema.parse({ version: DIAGNOSTIC_VERSION, firstEditCompleteFrom: null, stageUnit: 'event_occurrences', stagesQuality,
    stages: STAGES.map(event => ({ event, count: { value: rows.find(row => row.label === event)?.value ?? null,
      previous: event !== STAGES[0] && stagesQuality.comparisonsAllowed && query.comparison && query.comparison.start >= JOURNEY_COMPLETE_FROM ? rows.find(row => row.label === event)?.previous ?? null : null } })),
    acquisition: { status: 'unavailable', reason: 'compatibility_unproven' }, orderedFunnel: { status: 'unavailable', reason: 'source_capability_unproven', unit: 'active_users' } });
}
export function acquisitionPlan(query: ReportQuery) {
  const dimensions = ['sessionSourceMedium', 'landingPage', 'deviceCategory'];
  const dateRanges = [{ startDate: query.period.start, endDate: query.period.end, name: 'selected' }, ...(query.comparison ? [{ startDate: query.comparison.start, endDate: query.comparison.end, name: 'prior' }] : [])];
  // Separate filtered metrics keep the ceiling on cohorts, not cohort × event.
  // Four profiles still fit in one batch and require no pagination or retries.
  return { requests: [null, ...STAGES].map(event => ({ dimensions: dimensions.map(name => ({ name })),
    metrics: [{ name: event ? 'eventCount' : 'sessions' }], dateRanges, keepEmptyRows: true, returnPropertyQuota: true, limit: String(MAX_ACQUISITION_COHORTS * (query.comparison ? 2 : 1) + 1), offset: '0',
    orderBys: dimensions.map(dimensionName => ({ dimension: { dimensionName } })),
    ...(event ? { dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: event, caseSensitive: true } } } } : {}) })) };
}
const response = z.object({ dimensionHeaders: z.array(z.object({ name: z.string() })).max(5), metricHeaders: z.array(z.object({ name: z.string(), type: z.literal('TYPE_INTEGER') })).length(1),
  rows: z.array(z.object({ dimensionValues: z.array(z.object({ value: z.string().max(512) })).max(5), metricValues: z.array(z.object({ value: z.string().max(32) })).length(1) })).max((MAX_ACQUISITION_COHORTS + 1) * 2).default([]),
  rowCount: z.number().int().nonnegative().safe().default(0), metadata });
/** Structural failure evidence only. Dimension values never leave this helper. */
export function acquisitionStructure(raw: unknown) {
  const batch = z.object({ reports: z.array(response).length(4) }).safeParse(raw);
  if (!batch.success) return undefined;
  return batch.data.reports.map((report, profile) => {
    const rangeIndex = report.dimensionHeaders.findIndex(header => header.name === 'dateRange');
    const groups = new Set<string>(), ranges = new Set<string>(), identities = new Set<string>();
    let duplicate = false;
    for (const row of report.rows) {
      groups.add(JSON.stringify(row.dimensionValues.filter((_, index) => index !== rangeIndex)));
      ranges.add(rangeIndex < 0 ? 'selected' : row.dimensionValues[rangeIndex]?.value ?? '');
      const identity = JSON.stringify(row.dimensionValues); if (identities.has(identity)) duplicate = true; identities.add(identity);
    }
    return { profile, reportedRows: report.rowCount, returnedRows: report.rows.length, groups: groups.size, ranges: ranges.size, duplicate };
  });
}
export function parseAcquisition(raw: unknown, query: ReportQuery, timezone: string, now: Date): Acquisition {
  const batch = z.object({ reports: z.array(response).length(4), kind: z.literal('analyticsData#batchRunReports').optional() }).parse(raw);
  if (batch.reports.some(report => report.metadata.timeZone !== timezone)) throw new AcquisitionValidationFailure('profile');
  const rows = new Map<string, z.infer<typeof cohort>>(); let overflow = false;
  const members = new Map<string, Set<string>>(), observations = new Map<string, number[]>();
  const qualities = batch.reports.map(report => flags(report.metadata, query, now));
  batch.reports.forEach((report, index) => {
    const dimensions = ['sessionSourceMedium', 'landingPage', 'deviceCategory', ...(query.comparison ? ['dateRange'] : [])];
    const headers = report.dimensionHeaders.map(header => header.name);
    if (JSON.stringify([...headers].sort()) !== JSON.stringify([...dimensions].sort()) || report.metricHeaders[0].name !== (index ? 'eventCount' : 'sessions')
      || report.metadata.timeZone !== timezone || report.metadata.emptyReason || report.metadata.schemaRestrictionResponse?.activeMetricRestrictions?.length) throw new AcquisitionValidationFailure('profile');
    const groups = new Set<string>(), pairs = new Set<string>();
    for (const row of report.rows) {
      if (row.dimensionValues.length !== dimensions.length) throw new AcquisitionValidationFailure('dimension_count');
      const cell = (name: string) => row.dimensionValues[headers.indexOf(name)]?.value;
      const source = cell('sessionSourceMedium')!, landing = cell('landingPage')!, device = cell('deviceCategory')!;
      if (!source.trim() || !landing.trim() || !device.trim()) throw new AcquisitionValidationFailure('unsafe_dimension');
      const sourceMedium = label(128).safeParse(source).success ? source : WITHHELD_LABEL;
      const landingPath = path.safeParse(landing).success ? landing : WITHHELD_PATH;
      const deviceCategory = label(32).safeParse(device).success ? device : WITHHELD_LABEL;
      const range = query.comparison ? cell('dateRange') : 'selected';
      if (range !== 'selected' && range !== 'prior') throw new AcquisitionValidationFailure('range');
      // Validate original identities before privacy grouping, so redaction cannot
      // hide a duplicate or make an incomplete provider response look complete.
      const group = JSON.stringify([source, landing, device]), identity = JSON.stringify([group, range]);
      if (pairs.has(identity)) throw new AcquisitionValidationFailure('duplicate_row'); pairs.add(identity); groups.add(group);
      const number = observed(row.metricValues[0].value), key = JSON.stringify([sourceMedium, landingPath, deviceCategory]);
      const identities = members.get(key) ?? new Set<string>(); identities.add(group); members.set(key, identities);
      const coverage = observations.get(key) ?? Array<number>(8).fill(0);
      coverage[index * 2 + (range === 'selected' ? 0 : 1)]++; observations.set(key, coverage);
      const empty = () => ({ value: null, previous: null });
      const result = rows.get(key) ?? { sourceMedium, landingPath, deviceCategory, sessions: empty(), firstEdits: empty(), submitAttempts: empty(), acceptedSuccesses: empty() };
      const measure = [result.sessions, result.firstEdits, result.submitAttempts, result.acceptedSuccesses][index];
      const rangeKey = range === 'selected' ? 'value' : 'previous';
      const sum = (measure[rangeKey] ?? 0) + number;
      if (!Number.isSafeInteger(sum)) throw new AcquisitionValidationFailure('invalid_metric');
      measure[rangeKey] = sum; rows.set(key, result);
    }
    if (groups.size > report.rowCount || (report.rowCount > 0 && !report.rows.length)) throw new AcquisitionValidationFailure('row_count');
    // Canonical rowCount counts returned rows, including sparse range cells.
    // Historical group-count responses need the complete range product to prove
    // completeness. keepEmptyRows does not invent unrecorded observations.
    const completeCount = report.rowCount === groups.size || report.rowCount === report.rows.length;
    if (groups.size > MAX_ACQUISITION_COHORTS || (!completeCount && report.rowCount > MAX_ACQUISITION_COHORTS)) { overflow = true; return; }
    if (!completeCount || (report.rowCount !== report.rows.length && report.rows.length !== groups.size * (query.comparison ? 2 : 1))) throw new AcquisitionValidationFailure('incomplete_rows');
  });
  if (overflow || rows.size > MAX_ACQUISITION_COHORTS) return { status: 'unavailable', reason: 'row_limit' };
  const quality = Object.fromEntries(['sampled', 'thresholded', 'otherRowLoss', 'provisional'].map(key => [key, qualities.some(value => value[key as keyof Quality])])) as Omit<Quality, 'comparisonsAllowed'>;
  const combined = { ...quality, comparisonsAllowed: qualities.every(value => value.comparisonsAllowed) };
  for (const [key, row] of rows) {
    // A privacy bucket is complete only when every underlying cohort supplied
    // that observation. Never turn a partly missing aggregate into a count.
    [row.sessions, row.firstEdits, row.submitAttempts, row.acceptedSuccesses].forEach((measure, index) => {
      if (observations.get(key)![index * 2] !== members.get(key)!.size) measure.value = null;
      if (observations.get(key)![index * 2 + 1] !== members.get(key)!.size) measure.previous = null;
    });
    row.firstEdits.previous = null;
    if (!combined.comparisonsAllowed) for (const measure of [row.sessions, row.firstEdits, row.submitAttempts, row.acceptedSuccesses]) measure.previous = null;
    else if (!query.comparison || query.comparison.start < JOURNEY_COMPLETE_FROM) { row.submitAttempts.previous = null; row.acceptedSuccesses.previous = null; }
  }
  return acquisitionSchema.parse({ status: quality.sampled || quality.thresholded || quality.otherRowLoss ? 'limited' : 'available', dimensions: ['sessionSourceMedium', 'landingPage', 'deviceCategory'],
    sessionUnit: 'sessions', eventUnit: 'event_occurrences', quality: combined, rows: [...rows.values()] });
}
