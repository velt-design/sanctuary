type CsvValue = string | number | boolean | null | undefined;

function escapeCsv(value: CsvValue): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

export type CsvColumn<Row extends Record<string, CsvValue>> = {
  key: keyof Row;
  header: string;
};

export function downloadCsv<Row extends Record<string, CsvValue>>(
  filename: string,
  rows: Row[],
  columns: Array<CsvColumn<Row>>,
) {
  const header = columns.map((c) => escapeCsv(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCsv(row[c.key])).join(','));
  const csv = [header, ...lines].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

