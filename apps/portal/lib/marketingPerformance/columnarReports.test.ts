import { expect, it } from 'vitest';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { fixtureFilters } from '@/app/qa/marketing-performance-fixture/fixtures';
import { commercialFixture } from '@/app/qa/marketing-performance-fixture/commercialFixtures';
import { designerFixture } from '@/app/qa/marketing-performance-fixture/designerFixtures';
import { columnarRead, columnarReport, expandReport, type ColumnarKind, type ColumnarReport } from './columnarReports';
import { selectHub, hubDefaults } from './hub';
import { contributions } from './commercial';
import { designerPerformance } from './designer';
import { designerSales } from './designerSales';

const commercial = commercialFixture(hubFixture, fixtureFilters), designer = designerFixture('accepted');
it.each([['hub', hubFixture], ['commercial', commercial], ['designer', designer]] as const)('restores every %s field and ordered row without mutating its authoritative report', (kind, report) => {
  const before = structuredClone(report), packed = columnarReport(kind, report);
  expect(packed).not.toBe(report); expect((packed as ColumnarReport).format).toBe('marketing-columns-v1');
  expect(expandReport(kind, packed)).toStrictEqual(before); expect(report).toStrictEqual(before);
  expect(expandReport(kind, JSON.parse(JSON.stringify(packed)))).toStrictEqual(before);
  expect(expandReport(kind, report)).toBe(report);
});
it('keeps filtering, source aliases, commercial contributions and Designer populations identical', () => {
  const hub = expandReport('hub', columnarReport('hub', hubFixture)) as typeof hubFixture;
  for (const source of ['', 'fb', 'facebook', 'google']) expect(selectHub(hub, { ...hubDefaults(fixtureFilters), source })).toStrictEqual(selectHub(hubFixture, { ...hubDefaults(fixtureFilters), source }));
  const c = expandReport('commercial', columnarReport('commercial', commercial)) as typeof commercial;
  expect(contributions(c, c.rows)).toStrictEqual(contributions(commercial, commercial.rows));
  const d = expandReport('designer', columnarReport('designer', designer)) as typeof designer;
  expect(designerPerformance(d)).toStrictEqual(designerPerformance(designer));
  expect(designerSales(d)).toStrictEqual(designerSales(designer));
});
it('retains new fields, explicit undefined, null, false, zero, exact timestamps and nested values', () => {
  const report = { rows: [{ id: 'fictional', present: undefined, nullable: null, enabled: false, cents: 0, at: '2026-09-26T23:59:59+12:00', future: { name: '$value', date: new Date('2026-09-22T00:00:00Z'), notANumber: NaN, nested: [null, undefined, '雪<&'] } }] };
  const packed = columnarReport('commercial', report), restored = expandReport('commercial', packed) as typeof report;
  expect(packed).not.toBe(report); expect(restored).toStrictEqual(report); expect(Object.hasOwn(restored.rows[0], 'present')).toBe(true);
  expect(Object.keys(restored.rows[0])).toEqual(Object.keys(report.rows[0]));
});
it.each([
  { rows: [{ id: 'a', optional: undefined }, { id: 'b' }] },
  { rows: [{ id: 'a', one: 1 }, { one: 1, id: 'b' }] },
  { rows: [{ id: 'a' }, { id: 'b', addedLater: 'retained' }] },
  { rows: [Object.assign(Object.create(null), { id: 'a' })] },
  { rows: [{ id: 'a', [Symbol.for('future')]: 'retained' }] },
])('falls back to the same complete report when rows cannot be represented homogeneously', report => {
  expect(columnarReport('commercial', report)).toBe(report);
});
it('retains empty populations and unchanged public error unions', () => {
  const report = { rows: [] };
  expect(expandReport('commercial', columnarReport('commercial', report))).toStrictEqual(report);
  for (const status of [400, 403, 422, 503]) { const failure = { ok: false as const, status, error: 'Safe unavailable evidence' }; expect(columnarRead('hub', failure)).toBe(failure); }
  const success = { ok: true as const, report: commercial, futureMetadata: { coverage: 'retained' } };
  expect(columnarRead('commercial', success)).toStrictEqual({ ...success, report: columnarReport('commercial', commercial) });
  const sparse = Array<{ id: string }>(2); sparse[0] = { id: 'a' };
  const unsupported = { rows: sparse }; expect(columnarReport('commercial', unsupported)).toBe(unsupported);
  const longField = { rows: [{ ['x'.repeat(101)]: 'retained' }] }; expect(columnarReport('commercial', longField)).toBe(longField);
  const evolving = { ...hubFixture, events: [{ ...hubFixture.events[0] }, { ...hubFixture.events[0], futureField: undefined }] };
  expect(columnarReport('hub', evolving)).toBe(evolving);
});
const good = () => columnarReport('commercial', { rows: [{ id: 'a', value: null }, { id: 'b', value: 0 }] }) as ColumnarReport;
const columns = (wire: ColumnarReport) => (wire.report as { rows: { fields: unknown[]; count: number; columns: unknown[][] } }).rows;
it.each(['version', 'kind', 'duplicate fields', 'missing column', 'short column', 'sparse column', 'negative count', 'oversized count', 'unknown metadata'])(
  'fails closed for malformed %s without returning a partial population', scenario => {
    const wire = good(), rows = columns(wire);
    if (scenario === 'version') Object.assign(wire, { format: 'marketing-columns-v99' });
    if (scenario === 'kind') wire.kind = 'hub';
    if (scenario === 'duplicate fields') rows.fields[1] = rows.fields[0];
    if (scenario === 'missing column') rows.columns.pop();
    if (scenario === 'short column') rows.columns[0].pop();
    if (scenario === 'sparse column') delete rows.columns[0][0];
    if (scenario === 'negative count') rows.count = -1;
    if (scenario === 'oversized count') rows.count = 10_001;
    if (scenario === 'unknown metadata') Object.assign(rows, { extra: true });
    expect(() => expandReport('commercial', wire)).toThrow('No partial totals');
  },
);
it('rejects a different report family before consumer validation', () => {
  for (const kind of ['hub', 'designer'] satisfies ColumnarKind[]) expect(() => expandReport(kind, good())).toThrow('No partial totals');
});
