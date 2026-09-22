export const sources = ['Google', 'Meta', 'Unknown'] as const;
export type Source = typeof sources[number];
export type ExampleFilters = { days: '7' | '30'; source: Source | '' };
export type ExampleState = 'ready' | 'loading' | 'empty' | 'unavailable';
export const initialFilters: ExampleFilters = { days: '30', source: '' };
export const exampleRecords = Array.from({ length: 12 }, (_, index) => ({
  id: `DEMO-${String(index + 1).padStart(2, '0')}`,
  name: `Example enquiry ${String(index + 1).padStart(2, '0')}`,
  source: sources[index % 4 === 3 ? 0 : index % 4],
  daysAgo: index * 2,
  linked: index % 4 !== 0,
}));
export type ExampleRecord = typeof exampleRecords[number];
export function selectExample(filters: ExampleFilters, state: ExampleState) {
  const period = state === 'empty' ? [] : exampleRecords.filter(row => row.daysAgo < Number(filters.days));
  const rows = period.filter(row => !filters.source || row.source === filters.source);
  return { rows, sources: sources.map(source => ({ source, count: period.filter(row => row.source === source).length })),
    linked: rows.filter(row => row.linked).length, known: rows.filter(row => row.source !== 'Unknown').length };
}
export function readSavedExample(value: string | null): ExampleFilters | null {
  try {
    const parsed = JSON.parse(value ?? 'null');
    return parsed && ['7', '30'].includes(parsed.days) && ['', ...sources].includes(parsed.source)
      ? { days: parsed.days, source: parsed.source } : null;
  } catch { return null; }
}
