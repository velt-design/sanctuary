import { z } from 'zod';

export const invoiceViews = [['outstanding', 'Outstanding'], ['overdue', 'Overdue'], ['drafts', 'Drafts'], ['paid', 'Paid'], ['all', 'All']] as const;
export const quoteViews = [['awaiting', 'Awaiting acceptance'], ['accepted', 'Accepted'], ['drafts', 'Drafts'], ['declined', 'Declined'], ['expired', 'Expired'], ['history', 'History'], ['all', 'All']] as const;
export type RegisterQuery = { tab: 'invoices' | 'quotes'; view: string; search: string; sent: 'all' | 'sent' | 'needs' | 'pending'; offset: number };
export function parseRegisterQuery(params: URLSearchParams): RegisterQuery {
  const tab = params.get('tab') === 'quotes' ? 'quotes' : 'invoices';
  const views = tab === 'quotes' ? quoteViews : invoiceViews;
  const raw = Number(params.get('offset') ?? 0);
  return { tab, view: views.some(([key]) => key === params.get('view')) ? params.get('view')! : views[0][0],
    search: (params.get('search') ?? '').trim().slice(0, 120),
    sent: params.get('sent') === 'sent' ? 'sent' : params.get('sent') === 'needs' ? 'needs' : params.get('sent') === 'pending' ? 'pending' : 'all',
    offset: Number.isSafeInteger(raw) && raw >= 0 && raw <= 1000000 ? Math.floor(raw / 50) * 50 : 0 };
}
export function registerParams(query: RegisterQuery) {
  return new URLSearchParams({ tab: query.tab, view: query.view, search: query.search, sent: query.sent, offset: String(query.offset) });
}
export function registerHref(query: RegisterQuery, basePath = '/staff/payments') { return `${basePath}?${registerParams(query)}`; }
const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const date = z.string().nullable();
const history = z.object({ id: z.string().uuid(), version: z.number().int(), status: z.string(), expired: z.boolean(), totalCents: cents });
const registerRowSchema = z.object({
  id: z.string().uuid(), projectId: z.string().uuid(), reference: z.string(), customer: z.string(), project: z.string(),
  status: z.string(), expired: z.boolean(), currency: z.string().regex(/^[A-Z]{3}$/), totalCents: cents,
  paidCents: cents.nullable(), balanceCents: cents.nullable(), issueDate: date, dueDate: date,
  sentAt: date, sendState: z.enum(['sent', 'needs', 'failed', 'pending', 'prepared', 'review']), sendNote: z.string().nullable(),
  deliveryState: z.enum(['prepared', 'dispatching', 'provider_accepted', 'failed', 'needs_attention']).nullable(),
  lastAttemptAt: date, nextRetryAt: date, checkReason: z.string().nullable(), providerNote: z.string().nullable(), providerCheckedAt: date,
  quoteId: z.string().uuid().nullable(), version: z.number().int().nullable(),
  pendingDraftVersion: z.number().int().nullable(), acceptedVersion: z.number().int().nullable(),
  historyCount: z.number().int().nonnegative(), history: z.array(history).max(5),
});
export const registerSchema = z.object({ checkedAt: z.string(), count: z.number().int().nonnegative(),
  rows: z.array(registerRowSchema).max(50), hasMore: z.boolean(), draftsAllowed: z.boolean(),
  totals: z.array(z.object({ currency: z.string(), totalCents: cents, paidCents: cents, balanceCents: cents,
    unconfirmedCount: z.number().int().nonnegative() })).max(100) });
export type RegisterRow = z.infer<typeof registerRowSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export const money = (value: number, currency: string) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency, currencyDisplay: 'code' }).format(value / 100);
export function registerProjectHref(row: RegisterRow, tab: RegisterQuery['tab']) {
  const params = new URLSearchParams({ tab });
  if (tab === 'quotes') params.set('quoteId', `qv_${row.id}`);
  return `/staff/projects/proj_${row.projectId}?${params}`;
}
