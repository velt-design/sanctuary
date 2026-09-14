export function reviewQuery(kind: string, value: string) {
  const term = value.trim();
  if (term.length < 3 || term.length > 100 || !/^[\p{L}\p{N} .@'&_-]+$/u.test(term)) throw new Error('INVALID_QUERY');
  if (kind === 'invoice') return { resource: 'Invoices' as const, where: `Type=="ACCREC"&&InvoiceNumber=="${term}"` };
  if (kind === 'receipt') return { resource: 'BankTransactions' as const, where: `Type=="RECEIVE"&&Contact.Name=="${term}"` };
  throw new Error('INVALID_QUERY');
}
