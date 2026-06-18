type PaymentDetailsDocumentKind = 'quote' | 'invoice';

const PAYMENT_DETAILS_INTRO = 'Please make payment directly to our bank account:';
const PAYMENT_DETAILS_ACCOUNT_NAME = 'Sanctuary Pergolas Ltd.';
const PAYMENT_DETAILS_ACCOUNT_NUMBER = '06-0185-0845164-00';

export function paymentDetailsLines(kind: PaymentDetailsDocumentKind): string[] {
  return [
    PAYMENT_DETAILS_INTRO,
    PAYMENT_DETAILS_ACCOUNT_NAME,
    `Bank details: ${PAYMENT_DETAILS_ACCOUNT_NUMBER}`,
    kind === 'quote' ? 'Please include quote number' : 'Please include invoice number',
  ];
}

export function paymentDetailsText(kind: PaymentDetailsDocumentKind): string {
  return paymentDetailsLines(kind).join('\n');
}
