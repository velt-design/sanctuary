/** Local disposable SQL preview; no credentials, customer data or provider calls. */
import { createServer } from 'node:http';
import { createRevisedQuoteDatabase } from '../test/support/revisedQuoteDatabase';
import { revisedQuoteIds as ids, seedRevisedQuoteScenario } from '../test/support/revisedQuoteScenario';
import { projectInvoiceSchedule } from '../apps/portal/lib/invoices/paymentScheduleProjection';
import type { DepositInvoiceSummary } from '../apps/portal/lib/invoices/types';

async function main() {
  const db = await createRevisedQuoteDatabase();
  const appId = (prefix: string, id: string) => `${prefix}_${id}`;
  const uuid = (id: string) => id.split('_').at(-1)!;
  async function reset() {
    await db.exec('rollback');
    await db.exec('begin');
    await seedRevisedQuoteScenario(db);
    const fingerprint = (await db.query<any>('select public.commercial_invoice_scope_fingerprint($1) value', [ids.topup])).rows[0].value;
    await db.query("select public.commercial_reconcile_invoice_scope($1,'QUOTE_PAYMENT',$2,20000,'PAID',0,$3,$4,'Deposit top-up for existing scope','synthetic-operator')", [ids.topup, ids.quote, fingerprint, crypto.randomUUID()]);
  }
  await reset();
  function summary(i: any): DepositInvoiceSummary {
    return { id: appId('inv', i.id), projectId: appId('proj', i.project_id), quoteId: i.quote_id ? appId('quote', i.quote_id) : null,
      quoteVersionId: i.quote_version_id ? appId('qv', i.quote_version_id) : null, quoteRef: i.quote_ref ?? '', quoteVersionNumber: i.quote_version_number ?? 0,
      invoiceRef: i.invoice_ref, status: i.status, invoiceKind: i.invoice_kind,
      ...(i.treatment && i.treatment !== 'NATIVE' ? { scopeAssignment: { treatment: i.treatment, quoteId: i.assigned_quote ? appId('quote', i.assigned_quote) : null, quoteRef: i.assigned_quote ? 'Q-SYNTHETIC' : null } } : {}),
      paymentTermId: i.payment_term_id, paymentTermLabel: i.payment_term_label, paymentTermPosition: i.payment_term_position,
      paymentTermCount: i.payment_term_count, paymentTermCalculation: i.payment_term_calculation, paymentTermPercentage: i.payment_term_percentage,
      issueDate: String(i.issue_date), dueDate: String(i.due_date), reference: i.reference, customerName: 'Synthetic customer', projectName: 'Synthetic revised project',
      projectAddress: null, depositPercent: i.deposit_percent, totalIncGstCents: i.total_inc_gst_cents, totalExGstCents: i.total_ex_gst_cents, gstCents: i.gst_cents,
      createdAt: new Date(i.created_at).toISOString(), sentAt: null, paidAt: i.paid_at ? new Date(i.paid_at).toISOString() : null, paidBy: i.paid_by,
      paymentReference: i.payment_reference, paymentMethod: i.payment_method, paymentNote: i.payment_note, voidedAt: null, voidedBy: null, voidReason: null,
      lastDeliveryStatus: 'NOT_SENT', lastDeliveryError: null, lastDeliveryAttemptAt: null, nextRetryAt: null, finalFailure: false, recipients: [] };
  }
  async function invoices() {
    return (await db.query<any>(`select i.*,a.treatment,a.quote_id assigned_quote from public.deposit_invoices i left join public.commercial_invoice_scope_assignments a on a.invoice_id=i.id where i.project_id=$1 and i.status <> 'DRAFT' order by i.created_at desc`, [ids.project])).rows.map(summary);
  }
  function draft(i: any) {
    return { id: appId('inv', i.id), projectId: appId('proj', i.project_id), quoteVersionId: i.quote_version_id ? appId('qv', i.quote_version_id) : null,
      revision: Number(i.draft_revision), content: i.content_snapshot, options: i.draft_options, scopeTotalIncGstCents: i.quote_total_inc_gst_cents, amountIncGstCents: i.total_inc_gst_cents };
  }
  async function schedule() {
    const accepted = (await db.query<any>('select * from public.commercial_current_accepted_quote_versions($1)', [ids.project])).rows;
    const current = accepted[0];
    const funding = current ? (await db.query<any>('select * from public.commercial_quote_scope_funding($1)', [current.quote_version_id])).rows[0] : null;
    const t = (await db.query<any>('select * from public.commercial_project_financial_truth($1)', [ids.project])).rows[0];
    const entries = (await db.query<any>('select * from public.project_payment_entries where project_id=$1', [ids.project])).rows;
    const allocations = (await db.query<any>('select * from public.project_payment_allocations where project_id=$1 and reversed_at is null', [ids.project])).rows;
    const allInvoices = await invoices();
    return projectInvoiceSchedule({ acceptedQuoteVersionId: current ? appId('qv', current.quote_version_id) : null,
      acceptedQuoteRef: current ? 'Q-SYNTHETIC' : null, acceptedQuoteVersionNumber: current ? 3 : null,
      acceptedQuoteTotalIncGstCents: current?.total_inc_gst_cents ?? 0,
      acceptedQuotes: current ? [{ quoteVersionId: appId('qv', current.quote_version_id), quoteRef: 'Q-SYNTHETIC', quoteVersionNumber: 3, commercialScopeKind: 'base',
        totalIncGstCents: current.total_inc_gst_cents, terms: [{ id: 'payment-1', label: 'Payment', amountIncGstCents: 160000 }],
        funding: { paidIncGstCents: funding.paid_inc_gst_cents, openIncGstCents: funding.open_inc_gst_cents, carriedPaidIncGstCents: funding.carried_paid_inc_gst_cents } }] : [],
      quoteTerms: [], planItems: [], invoices: allInvoices,
      paymentEntries: entries.map(e => ({ id: appId('pmt', e.id), entryType: e.entry_type, amountIncGstCents: e.amount_inc_gst_cents, occurredAt: new Date(e.occurred_at).toISOString(),
        paymentMethod: e.payment_method, reference: e.reference, note: e.note, reason: e.reason,
        sourceInvoiceId: e.source_invoice_id ? appId('inv', e.source_invoice_id) : null, sourceInvoiceRef: allInvoices.find(i => i.id === appId('inv', e.source_invoice_id))?.invoiceRef ?? null, reversed: false })),
      allocations: allocations.map(a => ({ id: appId('pma', a.id), paymentEntryId: appId('pmt', a.payment_entry_id), quoteVersionId: a.quote_version_id ? appId('qv', a.quote_version_id) : '',
        standaloneInvoiceId: a.standalone_invoice_id ? appId('inv', a.standalone_invoice_id) : null, paymentTermId: a.payment_term_id, amountIncGstCents: a.amount_inc_gst_cents })),
      includePaymentEntries: true,
      authoritativeTotals: { acceptedTotalIncGstCents: t.accepted_total_inc_gst_cents, paidIncGstCents: t.paid_inc_gst_cents, outstandingIncGstCents: t.open_invoice_inc_gst_cents,
        remainingToInvoiceIncGstCents: t.remaining_to_invoice_inc_gst_cents, overCommittedIncGstCents: t.over_committed_inc_gst_cents } });
  }
  // Serialize this single in-memory PostgreSQL session so simultaneous reads do
  // not interleave with a reset or command across browser tabs.
  let work = Promise.resolve();
  createServer((request, response) => {
    work = work.then(async () => {
      response.setHeader('content-type', 'application/json'); response.setHeader('cache-control', 'no-store');
      const path = new URL(request.url!, 'http://localhost').pathname;
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      let checkpoint = false;
      try {
        if (path !== '/api/reset') { await db.exec('savepoint preview_request'); checkpoint = true; }
        let result: unknown;
        if (path === '/api/reset' && request.method === 'POST') { await reset(); result = { ok: true }; }
        else if (path === '/api/status') result = { status: (await db.query<any>('select status from public.quote_versions where id=$1', [ids.version])).rows[0].status };
        else if (path === '/api/accept' && request.method === 'POST') {
          const acceptance = (await db.query<any>('select * from public.commercial_accept_quote_with_project_lock_v2($1,$2)', [ids.version, 'synthetic-staff'])).rows[0];
          if (acceptance.invoice_id) throw new Error('Funded revision unexpectedly produced an invoice');
          result = { accepted: true, invoice: null, alreadyAccepted: acceptance.already_accepted };
        } else if (path.endsWith('/invoice-schedule')) result = { schedule: await schedule() };
        else if (path.endsWith('/invoices')) result = { invoices: await invoices() };
        else if (path.endsWith('/invoice-drafts')) {
          if (request.method === 'GET') result = { enabled: true, drafts: (await db.query<any>("select * from public.deposit_invoices where project_id=$1 and status='DRAFT' order by created_at", [ids.project])).rows.map(draft) };
          else if (body.action === 'save') {
            const saved = (await db.query<any>('select * from public.commercial_invoice_save_draft($1,$2,$3,$4,$5,$6)', [uuid(body.invoiceId), ids.project, body.expectedRevision, body.quoteVersionId ? uuid(body.quoteVersionId) : null, body.content ? JSON.stringify(body.content) : null, JSON.stringify(body.options)])).rows[0];
            result = { draft: draft(saved) };
          } else if (body.action === 'issue' && body.send !== true) {
            const issued = (await db.query<any>('select * from public.commercial_invoice_issue_draft($1,$2,$3,$4)', [uuid(body.invoiceId), body.expectedRevision, body.commandId, 'Synthetic payment details'])).rows[0];
            result = { issued: true, invoiceId: appId('inv',issued.id), invoiceRef: issued.invoice_ref, sendError: null };
          } else if (body.action === 'delete') { await db.query('select public.commercial_invoice_delete_draft($1,$2)', [uuid(body.invoiceId), body.expectedRevision]); result = { deleted: true }; }
          else throw new Error('This local preview supports save, issue without sending and delete only.');
        } else throw new Error('This synthetic preview does not send email, contact Xero or execute unrelated commands.');
        if (checkpoint) await db.exec('release savepoint preview_request');
        response.end(JSON.stringify(result));
      } catch (error) { if (checkpoint) await db.exec('rollback to savepoint preview_request; release savepoint preview_request'); response.statusCode = 409; response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Preview failed' })); }
    }).catch(error => { response.statusCode = 500; response.end(JSON.stringify({ error: String(error) })); });
  }).listen(3155, '127.0.0.1', () => console.log('Revised quote SQL preview ready at 127.0.0.1:3155'));
}
void main();
