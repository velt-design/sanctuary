import { Button } from '@/components/ui/foundation/FoundationControls';
import { Badge, Card } from '@/components/ui/foundation/FoundationSurfaces';
import type { reviewInvoicePayments } from '@/lib/xero/invoicePaymentReview';
import styles from './payments.module.css';
type Suggestion = Awaited<ReturnType<typeof reviewInvoicePayments>>['suggestions'][number];
const money = (cents: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(cents / 100);
export default function PaymentSuggestion({ item, disabled, confirmed, onConfirm, onApprove }: {
  item: Suggestion; disabled: boolean; confirmed: boolean; onConfirm: (value: boolean) => void; onApprove: () => void;
}) {
  const otherChecks = item.blockers.filter(reason => reason !== 'This payment is already recorded in the portal.');
  return <Card headingLevel={3} title={`${item.amountCents === null ? 'Amount needs review' : money(item.amountCents)} received ${item.payment.date || 'on an unverified date'}`}>
    <Badge tone={item.alreadyRecorded ? 'neutral' : item.blockers.length ? 'warning' : 'info'}>{item.alreadyRecorded ? 'Already recorded' : item.blockers.length ? 'Needs investigation' : 'Ready for your approval'}</Badge>
    <p>Customer: {item.payment.contact}. Reference: {item.payment.reference || 'Not supplied'}.</p>
    {item.alreadyRecorded ? <><p>This payment is already recorded against this invoice. Do not approve it again. See the recorded payment history below.</p>
      {otherChecks.length > 0 && <><p>Current checks to review with finance:</p><ul>{otherChecks.map(reason => <li key={reason}>{reason}</li>)}</ul></>}</>
      : item.blockers.length ? <><p>This payment cannot be approved yet:</p><ul>{item.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul></>
      : <>
        <dl className={styles.balance}>
          <div><dt>Still owing now</dt><dd>{money(item.remainingIfApprovedCents! + item.amountCents!)}</dd></div>
          <div><dt>Payment to record</dt><dd>{money(item.amountCents!)}</dd></div>
          <div><dt>Still owing after approval</dt><dd>{money(item.remainingIfApprovedCents!)}</dd></div>
        </dl>
        <p>Approval records this payment in the portal against this invoice. It does not move money, change Xero or email the customer.</p>
        <label className={styles.confirm}><input type="checkbox" disabled={disabled} checked={confirmed} onChange={event => onConfirm(event.target.checked)} /> I have checked this payment belongs to this invoice.</label>
        <Button disabled={disabled || !confirmed} onClick={onApprove}>Approve payment</Button>
      </>}
  </Card>;
}
