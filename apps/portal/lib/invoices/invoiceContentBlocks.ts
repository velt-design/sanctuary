import type { DepositInvoiceArtifactInput } from './invoiceArtifactViewModel';

/** Flow blocks allow arbitrarily long descriptions to paginate with the PDF owner. */
export function invoiceContentBlocks(input: DepositInvoiceArtifactInput): Array<{ text: string; heading?: boolean }> {
  const content = input.contentSnapshot;
  if (!content) return [];
  const money = (cents: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(cents / 100);
  const linked = input.invoiceKind !== 'STANDALONE';
  return [
    { text: linked ? 'Quoted scope — reference' : 'Itemised invoice', heading: true },
    ...(linked ? [{ text: 'Full quoted scope shown for reference. Only the amount in the payment summary is due on this invoice.' }] : []),
    ...content.items.flatMap((item, index) => [
      { text: `${index + 1}. ${item.description}` },
      { text: `Quantity ${item.qty} · Unit price ${money(item.unitPriceIncGstCents)} · Line total ${money(item.lineTotalIncGstCents)} incl GST` },
    ]),
    ...(linked ? [{ text: `Quoted scope total: ${money(input.quoteTotalIncGstCents)} incl GST — reference only`, heading: true }] : []),
    ...(content.billingAddress ? [{ text: 'Billing address', heading: true }, { text: content.billingAddress }] : []),
    ...(content.notes ? [{ text: 'Invoice notes', heading: true }, { text: content.notes }] : []),
  ];
}
