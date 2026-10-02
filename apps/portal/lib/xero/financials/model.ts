import type { FinanceReportRow, FinancePosition } from '../financePositionContract';
import type { FinancialReport } from './contract';

/** Xero numeric cells are decimals. Empty, text, ambiguous formatting and unsafe amounts stay missing. */
export function cents(value: string): number | null {
  let text = value.trim();
  if (/^\([\d,.]+\)$/.test(text)) text = `-${text.slice(1, -1)}`;
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.replaceAll(',', '').replace('-', '').split('.');
  const amount = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
  const signed = text.startsWith('-') ? -amount : amount;
  return signed <= BigInt(Number.MAX_SAFE_INTEGER) && signed >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(signed) : null;
}
export function money(value: number | null, currency = 'NZD', compact = false): string {
  if (value === null) return 'Unavailable';
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency, maximumFractionDigits: compact ? 0 : 2, minimumFractionDigits: compact ? 0 : 2 }).format(value / 100);
}
export type ReportLine = { key: string; label: string; depth: number; type: FinanceReportRow['type']; values: string[]; cents: number | null; attributes: FinanceReportRow['cells'][number]['attributes']; parent: string };
export function reportLines(report: FinancialReport): ReportLine[] {
  const result: ReportLine[] = [];
  const visit = (rows: FinanceReportRow[], parent: string, depth: number) => {
    for (const row of rows) {
      const label = row.title || row.cells[0]?.value || '';
      const attributes = row.cells.flatMap(cell => cell.attributes);
      const account = attributes.find(attr => attr.id.toLowerCase() === 'account')?.value;
      const key = account ? `account:${account}` : `${parent}/${row.type}:${label}`;
      result.push({ key, parent, label, depth, type: row.type, values: row.cells.slice(1).map(cell => cell.value), cents: row.cells.length === 2 ? cents(row.cells[1].value) : null, attributes });
      visit(row.rows, key, depth + 1);
    }
  };
  visit(report.rows, '', 0); return result;
}
export function findTotal(report: FinancialReport, labels: string[]): ReportLine | null {
  const matches = reportLines(report).filter(row => (row.type === 'SummaryRow' || row.type === 'Row') && labels.includes(row.label.trim().toLowerCase()));
  return matches.length === 1 ? matches[0] : null;
}
export function profitMetrics(report: FinancialReport) {
  const revenue = findTotal(report, ['total income', 'total trading income', 'total revenue']);
  const gross = findTotal(report, ['gross profit', 'gross profit (loss)']);
  const net = findTotal(report, ['net profit', 'net profit (loss)']);
  return { revenue, gross, net };
}
export function matchingLine(lines: ReportLine[], row: ReportLine): ReportLine | null {
  const matches = lines.filter(candidate => candidate.key === row.key);
  return matches.length === 1 ? matches[0] : null;
}
export function variance(current: number | null, previous: number | null) {
  if (current === null || previous === null) return { amount: null, percentage: null };
  const amount = current - previous;
  if(!Number.isSafeInteger(amount))return {amount:null,percentage:null};
  return { amount, percentage: previous === 0 ? null : amount / Math.abs(previous) * 100 };
}
export function bankMetrics(report: FinancialReport) {
  const lines = reportLines(report), header = lines.find(line => line.type === 'Header');
  const totals = lines.filter(line => line.type === 'SummaryRow' && line.label.toLowerCase() === 'total');
  if (!header || totals.length !== 1) return [];
  return header.values.map((label, i) => ({ label, value: cents(totals[0].values[i] ?? '') }));
}
const ageingBands = ['Not due', '1–30 days overdue', '31–60 days overdue', '61–90 days overdue', 'Over 90 days overdue', 'No due date'] as const;
export type Invoice = Extract<FinancePosition['receivables'], {status:'available'}>['data']['items'][number];
export function ageBand(invoice: Invoice, day: string): typeof ageingBands[number] {
  if (!invoice.dueDate) return 'No due date';
  const age = (Date.parse(day) - Date.parse(invoice.dueDate)) / 86400000;
  return age <= 0 ? 'Not due' : age <= 30 ? '1–30 days overdue' : age <= 60 ? '31–60 days overdue' : age <= 90 ? '61–90 days overdue' : 'Over 90 days overdue';
}
export function invoiceTotals(items: Invoice[], day: string) {
  const currencies = [...new Set(items.map(item => item.currency))].sort();
  return currencies.map(currency => {
    const group = items.filter(item => item.currency === currency);
    const sum = (records: Invoice[]): number | null => {
      let total = 0;
      for (const item of records) { const value = cents(item.amountDue); if (value === null || !Number.isSafeInteger(total + value)) return null; total += value; }
      return total;
    };
    return { currency, count: group.length, total: sum(group), overdue: sum(group.filter(item => item.dueDate && item.dueDate < day)),
      bands: ageingBands.map(label => ({ label, count: group.filter(item => ageBand(item, day) === label).length, amount: sum(group.filter(item => ageBand(item, day) === label)) })) };
  });
}
export function invoiceLink(invoice: Invoice) {
  return `https://go.xero.com/Accounts${invoice.type === 'ACCREC' ? 'Receivable' : 'Payable'}/View.aspx?InvoiceID=${encodeURIComponent(invoice.id)}`;
}
