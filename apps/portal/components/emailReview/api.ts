import type { EmailReviewBatch, EmailReviewBatchPage, EmailReviewCommand, EmailReviewImport, EmailReviewImportResult, EmailReviewItem, EmailReviewStatus } from '@/lib/emailReview/contracts';

export type Reviewer = { id: string; name: string; email: string; role: string };
export type ReviewSession = { batches: EmailReviewBatch[]; actorId: string; isAdmin: boolean };
export interface EmailReviewApi {
  session(): Promise<ReviewSession>;
  page(batchId: string, page: number, status: 'all' | EmailReviewStatus, query: string): Promise<EmailReviewBatchPage>;
  item(batchId: string, itemId: string): Promise<EmailReviewItem>;
  command(batchId: string, itemId: string, command: EmailReviewCommand): Promise<EmailReviewItem>;
  reviewers(): Promise<Reviewer[]>;
  importBatch(input: EmailReviewImport): Promise<EmailReviewImportResult>;
}
export class ReviewRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(path, { ...init, signal: controller.signal, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...init?.headers } });
    if (!response.ok) throw new ReviewRequestError(response.status, response.status === 409 ? 'This draft changed since you opened it.' : response.status === 403 ? 'You do not have access to this review.' : 'The request could not be confirmed.');
    return await response.json() as T;
  } finally { clearTimeout(timeout); }
}
const base = '/api/staff/v1/email-review';
export const emailReviewApi: EmailReviewApi = {
  session: () => request(base),
  page: (id, page, status, query) => request(`${base}/${encodeURIComponent(id)}?${new URLSearchParams({ page: String(page), limit: '25', status, q: query })}`),
  item: async (batch, id) => (await request<{ item: EmailReviewItem }>(`${base}/${encodeURIComponent(batch)}/items/${encodeURIComponent(id)}`)).item,
  command: async (batch, id, command) => (await request<{ item: EmailReviewItem }>(`${base}/${encodeURIComponent(batch)}/items/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(command) })).item,
  reviewers: async () => (await request<{ reviewers: Reviewer[] }>('/api/admin/email-review/reviewers')).reviewers,
  importBatch: input => request('/api/admin/email-review/import', { method: 'POST', body: JSON.stringify(input) }),
};
export function safeEvidenceUrl(value: string): string | undefined {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; }
}
