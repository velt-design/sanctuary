import Link from 'next/link';
import {TableRow,TableCell} from '@/components/ui/foundation/FoundationSurfaces';
import {ButtonLink} from '@/components/ui/foundation/FoundationControls';
import {DataStatePanel} from '@/components/ui/foundation/FoundationFeedback';
import {financeOutcome,paymentReviewGuidance,type FinanceView} from '@/lib/xero/financeReview';
import type {loadFinanceReview} from '@/lib/invoices/financeReviewRepository';
import CheckXero from './CheckXero';
import RecoverTransfer from './RecoverTransfer';
import styles from './finance.module.css';
type Read=Promise<Awaited<ReturnType<typeof loadFinanceReview>>|null>;
type Props={read:Read;search:string;offset:number;view:FinanceView;automaticPayments:boolean;href:(next:number,section?:FinanceView)=>string};
export async function FinanceReadStatus({read}:{read:Read}){
 const data=await read;
 return data?<p className={styles.checked}>Portal records checked {new Date(data.checkedAt).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'})}. Each linked invoice shows when Xero was last checked.</p>:null;
}
export async function FinanceReadRows({read,search,offset,view,automaticPayments,href}:Props){
 const data=await read;
 if(!data)return <TableRow><TableCell colSpan={5}><DataStatePanel state="error" title="Finance could not be loaded" description="Try again to check the current position. No records have changed."/><ButtonLink href={href(offset)} variant="secondary">Try again</ButtonLink></TableCell></TableRow>;
 if(!data.rows.length)return <TableRow><TableCell colSpan={5}>      <DataStatePanel state={search ? 'filtered-empty' : 'empty'}
        title={search ? 'No matching invoices in this view' : offset > 0 ? 'No more invoices in this view' : view === 'attention' ? 'No invoices need attention' : view === 'current' ? 'No automatic transfers yet' : 'No historical invoices'}
        description={search ? 'Try another search or check another view.' : offset > 0 ? 'Return to the first page to see the current list.' : view === 'attention' ? 'There are no invoice issues requiring review right now. Xero invoices and history remain available above.' : view === 'current' ? 'Your next newly issued portal invoice will appear here. Older invoices are in Invoice history.' : 'Invoices issued before automatic transfers are shown here when available.'} /></TableCell></TableRow>;
 return <>{data.rows.map(row => {
        const outcome = financeOutcome(row);
        const paymentGuidance = paymentReviewGuidance(row);
        const draftReview = Boolean(row.xeroInvoiceId && ((!row.observation && row.transferTargetStatus !== 'AUTHORISED') || (row.observation && ['draft', 'awaiting_approval'].includes(row.observation.state))) && !row.correctionRequired && !row.unassignedReceipts && row.recordedCents === 0 && row.status === 'OPEN');
        const stopped = !row.xeroInvoiceId && row.captured && ['needs_attention', 'permanent_failed'].includes(row.transferStatus ?? '');
        const projectReview = row.unassignedReceipts || row.recordedCents > row.totalCents || (row.status === 'PAID' && row.recordedCents !== row.totalCents) || (row.status === 'VOID' && row.recordedCents > 0);
        const paymentSyncIssue = Boolean(row.paymentSync && (['review', 'unavailable'].includes(row.paymentSync.state) || Date.now() - Date.parse(row.paymentSync.checkedAt) > 24 * 60 * 60 * 1000));
        const paymentReview = !projectReview && (paymentSyncIssue || !automaticPayments) && (paymentSyncIssue || (row.observation?.state === 'payment_recorded' && row.observation.amountPaidCents !== row.recordedCents)) && Boolean(row.xeroInvoiceId) && process.env.XERO_INVOICE_PAYMENTS_ENABLED === 'true';
        const setupReview = stopped && row.transferError === 'XERO_MAPPING_REQUIRED' && !projectReview;
        const money = (value: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: row.currency }).format(value / 100);
        return <TableRow key={row.invoiceId} role="row">
          <TableCell role="cell" data-label="Invoice / customer"><Link href={`/staff/projects/${row.projectId}?tab=invoices`}>{row.invoiceRef}</Link><br />{row.customerName}<br /><small>{row.projectName}</small></TableCell>
          <TableCell role="cell" data-label="Portal status">{row.status === 'VOID' ? 'Voided' : row.status === 'PAID' ? 'Recorded paid' : 'Open'}{row.dueDate && <><br /><small>Due {row.dueDate}</small></>}</TableCell>
          <TableCell role="cell" data-label="Invoice amount">{money(row.totalCents)}</TableCell><TableCell role="cell" data-label="Still owing">{row.status === 'VOID' ? 'Not payable' : outcome.remainingCents === null ? 'Needs review' : money(outcome.remainingCents)}</TableCell>
          <TableCell role="cell" data-label="Next action"><strong>{outcome.label}</strong>
            {draftReview && <p>Open the draft in Xero. Check the customer, amount and GST against the portal invoice. If correct, choose More approve options → Approve in Xero. Do not choose Approve &amp; email. Then return here.</p>}
            {stopped && <p>{row.transferError === 'XERO_MAPPING_REQUIRED' ? 'The transfer needs the correct Xero customer and accounting settings. Review Xero setup below, then resume the existing transfer.' : 'The automatic transfer has stopped. A developer needs to investigate before it can continue. Do not issue another invoice or create a replacement in Xero.'}</p>}
            {projectReview && <><p>The portal payment history needs checking before this balance can be trusted. Open the project and check which invoice each receipt belongs to.</p><ButtonLink variant="primary" size="small" href={`/staff/projects/${row.projectId}?tab=invoices`}>Review project payments</ButtonLink></>}
            {paymentReview && <><p>{automaticPayments ? paymentGuidance.explanation : 'Xero and the portal show different payment totals. The review shows the balance before and after approval.'}</p>{automaticPayments && paymentGuidance.inXero
              ? <ButtonLink variant="primary" size="small" href={`/staff/payments/xero-invoice?invoice=${row.invoiceId}`} target="_blank" rel="noopener noreferrer">Check reconciliation in Xero</ButtonLink>
              : <ButtonLink variant="primary" size="small" href={`/staff/payments/invoice?invoice=${row.invoiceId}`}>Review invoice payments</ButtonLink>}</>}
            {setupReview && <ButtonLink variant="primary" size="small" href={`/staff/payments/mapping?invoice=${row.invoiceId}`}>Review Xero setup</ButtonLink>}
            {!outcome.attention && <p>No action needed.</p>}
            {automaticPayments && !paymentSyncIssue && row.observation?.state === 'payment_recorded' && row.observation.amountPaidCents !== row.recordedCents && <p>The automatic payment check is pending. If it cannot confirm the payment, the reason will appear here.</p>}
            {row.xeroInvoiceId && outcome.attention && !projectReview && !paymentReview && <ButtonLink variant="primary" size="small" href={`/staff/payments/xero-invoice?invoice=${row.invoiceId}`} target="_blank" rel="noopener noreferrer">{draftReview ? 'Review draft in Xero' : 'Open in Xero'}</ButtonLink>}
            <details><summary>Checks and other options</summary>
            {row.lastVerifiedAt && <><br /><small>Transfer verified {new Date(row.lastVerifiedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}</small></>}
            {row.paymentSync && <p>Automatic payments checked {new Date(row.paymentSync.checkedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}</p>}
            {row.observation && <><br /><small>Xero checked {new Date(row.observation.checkedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}</small></>}
            {row.xeroInvoiceId && <><br /><CheckXero invoiceId={row.invoiceId} invoiceRef={row.invoiceRef} /></>}
            {!row.xeroInvoiceId && row.captured && row.status !== 'VOID' && ['needs_attention', 'permanent_failed'].includes(row.transferStatus ?? '')
              && <RecoverTransfer invoiceId={row.invoiceId} />}
            {row.xeroInvoiceId && process.env.XERO_INVOICE_PAYMENTS_ENABLED === 'true' && !paymentReview && <><br /><ButtonLink variant="tertiary" size="small" href={`/staff/payments/invoice?invoice=${row.invoiceId}`}>Review invoice payments</ButtonLink></>}
            {row.xeroInvoiceId && (projectReview || paymentReview || !outcome.attention) && <ButtonLink variant="tertiary" size="small" href={`/staff/payments/xero-invoice?invoice=${row.invoiceId}`} target="_blank" rel="noopener noreferrer">Open in Xero</ButtonLink>}
            {row.captured && !row.xeroInvoiceId && !projectReview && row.status !== 'VOID' && !setupReview && <><br /><ButtonLink variant="tertiary" size="small" href={`/staff/payments/mapping?invoice=${row.invoiceId}`}>Review Xero setup</ButtonLink></>}
            </details>
          </TableCell>
        </TableRow>;
      })}</>;
}
export async function FinanceReadPages({read,offset,href}:Pick<Props,'read'|'offset'|'href'>){
 const data=await read;if(!data)return null;
 return (      <nav aria-label="Finance pages">{offset > 0 && <Link href={href(Math.max(0, offset - 50))}>Previous page</Link>}{' '}{data.hasMore && offset < 10000 && <Link href={href(offset + 50)}>Next page</Link>}</nav>);
}
