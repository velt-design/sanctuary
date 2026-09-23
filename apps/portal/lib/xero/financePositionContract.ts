import { z } from 'zod';
import { accountingDate } from './financeSummaryContract';

export const FINANCE_POSITION_MAX_BYTES = 2 * 1024 * 1024;
export const FINANCE_POSITION_MAX_INVOICES = 5000;
export const financePositionQuery = z.object({ from: accountingDate, to: accountingDate, basis: z.enum(['accrual', 'cash']) }).strict()
  .refine(value => value.from <= value.to && (Date.parse(value.to) - Date.parse(value.from)) / 86400000 < 366, 'Choose 1–366 accounting dates.');
export type FinancePositionQuery = z.infer<typeof financePositionQuery>;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestamp = z.string().datetime();
const text = z.string().max(1024);
const money = z.string().regex(/^-?\d+(?:\.\d+)?$/).max(40);
export const financeOrganisationBinding = z.object({ tenantId: z.string().uuid(), scope: z.literal('organisation') }).strict();
export type FinanceOrganisationBinding = z.infer<typeof financeOrganisationBinding>;
export type FinanceReportRow = { type: 'Header' | 'Section' | 'Row' | 'SummaryRow'; title: string | null;
  cells: { value: string; attributes: { id: string; value: string }[] }[]; rows: FinanceReportRow[] };
const reportRow: z.ZodType<FinanceReportRow> = z.lazy(() => z.object({
  type: z.enum(['Header', 'Section', 'Row', 'SummaryRow']), title: text.nullable(),
  cells: z.array(z.object({ value: text, attributes: z.array(z.object({ id: text, value: text }).strict()).max(20) }).strict()).max(100),
  rows: z.array(reportRow).max(2000),
}).strict());
// Check work/depth iteratively before Zod's recursive traversal of untrusted wire.
const reportRows = z.unknown().superRefine((value, ctx) => {
  if (!Array.isArray(value)) { ctx.addIssue({ code: 'custom', message: 'Invalid report rows' }); return; }
  const stack = value.map(row => ({ row, depth: 0 })); let count = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++count > 2000 || item.depth > 8) { ctx.addIssue({ code: 'custom', message: 'Report rows exceed bounds' }); return; }
    if (item.row && typeof item.row === 'object' && Array.isArray(item.row.rows)) {
      if (item.row.rows.length + stack.length > 2000) { ctx.addIssue({ code: 'custom', message: 'Report rows exceed bounds' }); return; }
      stack.push(...item.row.rows.map((row: unknown) => ({ row, depth: item.depth + 1 })));
    }
  }
}).pipe(z.array(reportRow).max(2000));
export const financeReport = z.object({ id: z.string().min(1).max(100), name: text, titles: z.array(text).max(20),
  reportDate: text.nullable(), updatedAt: timestamp.nullable(), from: date, to: date,
  basis: z.enum(['accrual', 'cash', 'bank_movements']), currency: z.string().regex(/^[A-Z]{3}$/),
  rows: reportRows, interpretation: z.enum(['accounting_bank_balances_not_spendable_cash', 'standard_profit_and_loss']),
}).strict();
export const financePositionInvoice = z.object({ id: z.string().uuid(), number: text, type: z.enum(['ACCREC', 'ACCPAY']),
  contactId: z.string().uuid(), contactName: text, status: z.literal('AUTHORISED'), date, dueDate: date.nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/), total: money, amountDue: money, amountPaid: money, amountCredited: money,
  updatedAt: timestamp, lineItems: z.array(z.object({ description: text, accountCode: z.string().max(100).nullable(),
    lineAmount: money.nullable(), taxAmount: money.nullable() }).strict()).max(1000),
}).strict();
export const financeUnavailable = z.object({ status: z.literal('unavailable'),
  reason: z.enum(['missing_scope', 'provider_denied', 'provider_unavailable', 'invalid_response', 'limit_exceeded', 'metadata_unavailable']),
  requiredScopes: z.array(z.string().max(100)).max(3),
}).strict();
const available = <T extends z.ZodTypeAny>(data: T) => z.object({ status: z.literal('available'), complete: z.literal(true),
  checkedAt: timestamp, data }).strict();
export const financePositionSchema = z.object({ schemaVersion: z.literal('sanctuary.praxis.finance-position.v1'),
  query: financePositionQuery, startedAt: timestamp, checkedAt: timestamp, consistency: z.literal('sequential_read_window'),
  identity: financeOrganisationBinding,
  organisation: z.union([available(z.object({ name: text, baseCurrency: z.string().regex(/^[A-Z]{3}$/), timezone: text }).strict()), financeUnavailable]),
  bankSummary: z.union([available(financeReport), financeUnavailable]),
  profitAndLoss: z.union([available(financeReport), financeUnavailable]),
  receivables: z.union([available(z.object({ coverage: z.literal('current_authorised_outstanding_invoices'), count: z.number().int().min(0).max(FINANCE_POSITION_MAX_INVOICES), items: z.array(financePositionInvoice).max(FINANCE_POSITION_MAX_INVOICES) }).strict()), financeUnavailable]),
  payables: z.union([available(z.object({ coverage: z.literal('current_authorised_outstanding_invoices'), count: z.number().int().min(0).max(FINANCE_POSITION_MAX_INVOICES), items: z.array(financePositionInvoice).max(FINANCE_POSITION_MAX_INVOICES) }).strict()), financeUnavailable]),
  limitations: z.array(z.string().max(1000)).max(20),
}).strict();
export type FinancePosition = z.infer<typeof financePositionSchema>;
export const financePositionResponseSchema = financePositionSchema.extend({ requestId: z.string().uuid(), source: z.object({
  sourceKey: z.string().min(1).max(128), connectionId: z.string().uuid(), environment: z.string().min(1).max(128),
  authority: z.literal('canonical'), retrievedAt: timestamp,
}).strict() }).strict();
export type FinancePositionResponse = z.infer<typeof financePositionResponseSchema>;
