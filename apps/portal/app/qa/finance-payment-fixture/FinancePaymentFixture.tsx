'use client';
import { useState, type ComponentProps } from 'react';
import PaymentSuggestion from '@/app/staff/payments/invoice/PaymentSuggestion';
import { Button } from '@/components/ui/foundation/FoundationControls';

const example: ComponentProps<typeof PaymentSuggestion>['item'] = {
  payment: { sourceKind: 'INVOICE_PAYMENT', providerInvoiceId: 'example-invoice', id: 'example-payment', contactId: 'example-contact',
    contact: 'Example customer', reference: 'EXAMPLE-001', transactionType: 'ACCRECPAYMENT', status: 'AUTHORISED',
    date: '2026-09-15', total: 40, currency: 'NZD', reconciled: true, updatedAt: '2026-09-15T00:00:00Z', currencyRate: 1 },
  alreadyRecorded: false, amountCents: 4000, remainingIfApprovedCents: 7500, blockers: [], approvalToken: null, approvalId: null,
};

// Local state only: this fixture has no API or financial command handlers.
export default function FinancePaymentFixture() {
  const [confirmed, setConfirmed] = useState(false);
  const [recorded, setRecorded] = useState(false);
  return <main style={{ maxWidth: 900, margin: '32px auto', padding: 24 }}>
    <h1>Payment approval example</h1>
    <p>Synthetic example only. Nothing here changes portal or Xero records.</p>
    <h2>EXAMPLE-001 — Example customer</h2>
    <p>Invoice total: $115.00. Example reconciled payment: $40.00.</p>
    <PaymentSuggestion item={recorded ? { ...example, alreadyRecorded: true, blockers: ['This payment is already recorded in the portal.'] } : example}
      disabled={false} confirmed={confirmed} onConfirm={setConfirmed} onApprove={() => { if (confirmed) setRecorded(true); }} />
    {recorded && <p role="status">Example approval complete: $40.00 recorded, $75.00 still owing. No real payment was recorded.</p>}
    {recorded && <Button variant="secondary" onClick={() => { setRecorded(false); setConfirmed(false); }}>Reset example</Button>}
  </main>;
}
