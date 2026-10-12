/** Disposable local SQL preview only. Run with: npx tsx scripts/invoice-restore-preview.ts */
import { createServer } from 'node:http';
import { createInvoiceRestoreDatabase } from '../test/support/invoiceDatabase';
const project = '10000000-0000-4000-8000-000000000001';
const invoice = '40000000-0000-4000-8000-000000000001';
const command = '50000000-0000-4000-8000-000000000001';
async function main() {
  const db = await createInvoiceRestoreDatabase();
  await db.query('insert into public.projects(id,name) values($1,$2)', [project, 'Sample outdoor living project']);
  await db.query("insert into public.project_operational_states(project_id,state) values($1,'ACTIVE')", [project]);
  const content = {
    version: 1,
    items: [
      {
        id: '60000000-0000-4000-8000-000000000001',
        description: 'Synthetic pergola work',
        qty: 1,
        unitPriceIncGstCents: 115000,
        lineTotalIncGstCents: 115000,
      },
    ],
    billingName: 'Sample customer',
    billingEmail: 'customer@example.invalid',
    billingAddress: '',
    notes: 'Synthetic review only',
  };
  await db.query('select public.commercial_invoice_save_draft($1,$2,0,null,$3,$4)', [
    invoice,
    project,
    JSON.stringify(content),
    JSON.stringify({ mode: 'custom', label: 'Pergola work', dueDate: '2026-10-30', amountIncGstCents: 115000 }),
  ]);
  await db.query('select public.commercial_invoice_issue_draft($1,1,$2,$3)', [
    invoice,
    command,
    'Synthetic bank details',
  ]);
  await db.query('select public.commercial_void_open_invoice($1,$2,$3)', [
    invoice,
    'synthetic-admin',
    'Voided by mistake',
  ]);
  async function readInvoice() {
    const i = (
      await db.query<any>('select *,voided_at::text as exact_voided_at from public.deposit_invoices where id=$1', [
        invoice,
      ])
    ).rows[0];
    return {
      id: `inv_${invoice}`,
      projectId: `proj_${project}`,
      quoteId: null,
      quoteVersionId: null,
      quoteRef: '',
      quoteVersionNumber: 0,
      invoiceRef: i.invoice_ref,
      status: i.status,
      invoiceKind: i.invoice_kind,
      paymentTermId: i.payment_term_id,
      paymentTermLabel: i.payment_term_label,
      paymentTermPosition: 1,
      paymentTermCount: 1,
      paymentTermCalculation: 'fixed',
      paymentTermPercentage: null,
      issueDate: String(i.issue_date),
      dueDate: String(i.due_date),
      reference: null,
      customerName: 'Sample customer',
      projectName: 'Sample project',
      projectAddress: null,
      depositPercent: 0,
      totalIncGstCents: i.total_inc_gst_cents,
      totalExGstCents: i.total_ex_gst_cents,
      gstCents: i.gst_cents,
      createdAt: new Date(i.created_at).toISOString(),
      sentAt: null,
      paidAt: null,
      paidBy: null,
      paymentReference: null,
      paymentMethod: null,
      paymentNote: null,
      voidedAt: i.exact_voided_at,
      voidedBy: i.voided_by,
      voidReason: i.void_reason,
      restoredAt: i.restored_at ? new Date(i.restored_at).toISOString() : null,
      lastDeliveryStatus: 'NOT_SENT',
      lastDeliveryError: null,
      lastDeliveryAttemptAt: null,
      nextRetryAt: null,
      finalFailure: false,
      recipients: [],
    };
  }
  createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3146');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.end();
      return;
    }
    const path = req.url ?? '';
    let result: unknown;
    try {
      if (path === '/api/reset' && req.method === 'POST') {
        const current = await readInvoice();
        if (current.status === 'OPEN')
          await db.query('select public.commercial_void_open_invoice($1,$2,$3)', [
            invoice,
            'synthetic-admin',
            'Reset synthetic sample',
          ]);
        result = { ok: true };
      } else if (path.endsWith('/restore') && req.method === 'POST') {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw);
        await db.query('select public.commercial_restore_invoice($1,$2,$3,$4,$5)', [
          invoice,
          body.expectedVoidedAt,
          body.commandId,
          body.reason,
          'synthetic-admin',
        ]);
        result = { invoice: await readInvoice() };
      } else if (path.endsWith('/invoice-schedule')) {
        const t = (await db.query<any>('select * from public.commercial_project_financial_truth($1)', [project]))
          .rows[0];
        result = {
          schedule: {
            acceptedQuoteVersionId: null,
            acceptedQuoteRef: null,
            acceptedQuoteVersionNumber: null,
            acceptedQuoteTotalIncGstCents: 0,
            billableTotalIncGstCents: t.accepted_total_inc_gst_cents,
            standaloneTotalIncGstCents: t.accepted_total_inc_gst_cents,
            invoicedIncGstCents: t.open_invoice_inc_gst_cents,
            paidIncGstCents: 0,
            outstandingIncGstCents: t.open_invoice_inc_gst_cents,
            remainingToInvoiceIncGstCents: t.remaining_to_invoice_inc_gst_cents,
            overCommittedIncGstCents: 0,
            unallocatedCreditIncGstCents: 0,
            terms: [],
            paymentEntries: [],
          },
        };
      } else if (path.endsWith('/invoices')) result = { invoices: [await readInvoice()] };
      else if (path.endsWith('/invoice-drafts')) result = { drafts: [], enabled: false };
      else {
        res.statusCode = 403;
        result = {
          error: 'This local preview only restores synthetic invoices. Sending and other actions are disabled.',
        };
      }
    } catch (error) {
      res.statusCode = 409;
      result = { error: error instanceof Error ? error.message : 'Preview request failed' };
    }
    res.end(JSON.stringify(result));
  }).listen(3147, '127.0.0.1', () => console.log('Synthetic SQL preview ready on 127.0.0.1:3147'));
}
void main();
