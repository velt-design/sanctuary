export function reviewQuery(kind: string, value: string) {
  const term = value.trim();
  if (!term || term.length > 240) throw new Error('INVALID_QUERY');
  // Values remain string literals; customer punctuation must never become query syntax.
  const literal = `"${term.replaceAll('"', '""')}"`;
  if (kind === 'invoice') return { resource: 'Invoices' as const, where: `Type=="ACCREC"&&InvoiceNumber==${literal}` };
  if (kind === 'receipt') return { resource: 'BankTransactions' as const, where: `Type=="RECEIVE"&&Contact.Name==${literal}` };
  throw new Error('INVALID_QUERY');
}
