import type { EmailReviewBatch, EmailReviewCounts, EmailReviewItem } from '@/lib/emailReview/contracts';
import { type EmailReviewApi, ReviewRequestError } from '@/components/emailReview/api';

export const fixtureStorageKey = 'sanctuary.synthetic-email-review.v1';
export function fixtureItems(): EmailReviewItem[] {
  return Array.from({ length: 30 }, (_, index) => {
    const number = index + 1;
    const context = { projectId: `example-project-${number}`, name: `Example project ${number}`, stage: 'CONTACTED', archivedAt: null, contactId: `example-contact-${number}`, contactName: `Example customer ${number}`, contactEmail: `customer${number}@example.invalid`, state: 'ACTIVE', stateVersion: 1 };
    return {
      id: `example-draft-${number}`, batchId: 'example-batch', sourceId: `example-source-${number}`, projectId: context.projectId,
      projectName: context.name, to: context.contactEmail, subject: `Re: Example pergola ${number}`,
      status: index === 1 ? 'approved' : index === 2 ? 'skipped' : 'draft', revision: 1, updatedAt: '2026-09-01T00:00:00Z',
      contextChanged: index === 3, body: `Hi there,\n\nWould you like to discuss the next step for your pergola?\n\nThanks,\nExample team`,
      prerequisites: ['Check the current conversation for newer replies.', 'Confirm the site and any recent phone notes.'],
      evidence: [{ label: 'Example evidence (synthetic)', url: 'https://example.invalid/evidence' }],
      context: 'Synthetic example: the customer asked about a pergola. Review the conversation before following up.',
      savedProjectContext: context, currentProjectContext: { ...context, stateVersion: index === 3 ? 2 : 1 }, currentContextHash: `example-context-${number}`,
      threads: index === 4 ? [] : [{ messageId: `example-message-${number}`, webLink: 'https://example.invalid/conversation', subject: `Example pergola ${number}`, matchedRecipient: context.contactEmail }],
      threadMessageId: index === 4 ? null : `example-message-${number}`, dispatchId: null,
      approvedAt: index === 1 ? '2026-09-01T00:00:00Z' : null, approvedBy: index === 1 ? 'example-reviewer' : null, approvalHash: null, events: [],
    };
  });
}
export function createFixtureApi(storage?: Pick<Storage, 'getItem' | 'setItem'>): EmailReviewApi & { conflictNext(): void; failNext(): void; reset(): void } {
  let rows = fixtureItems();
  let conflict = false;
  let failure = false;
  const existing = storage?.getItem(fixtureStorageKey);
  if (existing) { try { const saved = JSON.parse(existing); if (Array.isArray(saved) && saved.length === 30 && saved.every(row => typeof row.id === 'string' && row.id.startsWith('example-draft-'))) rows = saved; } catch { /* Invalid synthetic state starts fresh. */ } }
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  const persist = () => storage?.setItem(fixtureStorageKey, JSON.stringify(rows));
  const counts = (): EmailReviewCounts => ({ all: rows.length, draft: rows.filter(row => row.status === 'draft').length, approved: rows.filter(row => row.status === 'approved').length, skipped: rows.filter(row => row.status === 'skipped').length });
  const batch = (): EmailReviewBatch => ({ id: 'example-batch', sourceKey: 'synthetic-v1', title: 'Example review batch', reviewerId: 'example-reviewer', createdAt: '2026-09-01T00:00:00Z', counts: counts() });
  return {
    async session() { return { batches: [batch()], actorId: 'example-reviewer', isAdmin: false }; },
    async page(_batch, page, status, query) { const found = rows.filter(row => (status === 'all' || row.status === status) && `${row.projectName} ${row.to} ${row.subject}`.toLowerCase().includes(query.toLowerCase())); return clone({ batch: batch(), items: found.slice((page - 1) * 25, page * 25), page, limit: 25, total: found.length, counts: counts() }); },
    async item(_batch, id) { const row = rows.find(row => row.id === id); if (!row) throw new ReviewRequestError(404, 'Missing example'); return clone(row); },
    async command(_batch, id, command) {
      const row = rows.find(row => row.id === id);
      if (!row) throw new ReviewRequestError(404, 'Missing example');
      if (failure) { failure = false; throw new Error('Synthetic unavailable service'); }
      if (conflict) { conflict = false; row.revision++; row.body += '\n\nSynthetic edit from another reviewer.'; persist(); throw new ReviewRequestError(409, 'Synthetic conflict'); }
      if (row.revision !== command.expectedRevision || row.dispatchId) throw new ReviewRequestError(409, 'Revision changed');
      if (command.action === 'approve' && (!command.prerequisitesConfirmed || !command.threadConfirmed || !row.threadMessageId || row.contextChanged)) throw new ReviewRequestError(422, 'Checks required');
      if (command.action === 'skip' && !command.note?.trim()) throw new ReviewRequestError(422, 'Note required');
      if (command.action === 'save') {
        row.to = command.to ?? row.to; row.subject = command.subject ?? row.subject; row.body = command.body ?? row.body; row.threadMessageId = command.threadMessageId ?? null; row.status = 'draft';
        if (command.acknowledgeContextChange && command.expectedContextHash === row.currentContextHash) { row.contextChanged = false; row.savedProjectContext = clone(row.currentProjectContext); }
      } else row.status = command.action === 'approve' ? 'approved' : command.action === 'skip' ? 'skipped' : 'draft';
      row.revision++; row.updatedAt = new Date().toISOString(); row.approvedAt = row.status === 'approved' ? row.updatedAt : null;
      row.events.push({ id: command.commandId, actorId: 'example-reviewer', action: command.action, revision: row.revision, note: command.note ?? null, createdAt: row.updatedAt });
      persist(); return clone(row);
    },
    async reviewers() { return []; },
    async importBatch() { throw new Error('Import is unavailable in this synthetic fixture.'); },
    conflictNext() { conflict = true; }, failNext() { failure = true; }, reset() { rows = fixtureItems(); persist(); },
  };
}
