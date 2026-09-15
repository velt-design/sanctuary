import type { FormEvent } from 'react';
import { Button, Select } from '@/components/ui/foundation/FoundationControls';
import type { XeroRevenueAccount, XeroRevenueTax } from '@/lib/xero/financeMappingProvider';
export type AccountingDefaultsValue = { accountCode: string; taxType: string; effectiveRate: number } | null;
export default function AccountingDefaults({ value, accounts, taxes, pending, onSubmit }: {
 value: AccountingDefaultsValue; accounts: XeroRevenueAccount[]; taxes: XeroRevenueTax[]; pending: boolean;
 onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
 const account = accounts.find(item => item.code === value?.accountCode);
 const tax = taxes.find(item => item.type === value?.taxType);
 return <section style={{ marginTop: 24 }}>
  <h3>Company accounting defaults</h3>
  <p>These settings apply to future portal invoice transfers for all customers. Linking a customer does not change them.</p>
  <p>{value ? `${account ? `${account.code} — ${account.name}` : value.accountCode} · ${tax?.name ?? value.taxType} (${value.effectiveRate}%)` : 'No accounting defaults have been confirmed yet.'}</p>
  {value && (!account || !tax || tax.effectiveRate !== value.effectiveRate) && <p role="alert">The saved defaults need checking against the current Xero settings.</p>}
  <details open={!value}><summary>Review or change company defaults</summary>
   <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16, marginTop: 16 }} key={`${value?.accountCode}:${value?.taxType}`}>
    <label>Sales account<Select name="accountCode" required defaultValue={account?.code ?? ''}><option value="" disabled>Select sales account</option>{accounts.map(item => <option key={item.id} value={item.code}>{item.code} — {item.name}</option>)}</Select></label>
    <label>Sales tax<Select name="taxType" required defaultValue={tax?.type ?? ''}><option value="" disabled>Select tax</option>{taxes.map(item => <option key={item.type} value={item.type}>{item.name} — {item.effectiveRate}%</option>)}</Select></label>
    <label><input type="checkbox" name="confirmed" required /> I approve these accounting defaults for future portal invoice transfers across the business.</label>
    <Button type="submit" variant="secondary" disabled={pending}>Save company defaults</Button>
   </form>
  </details>
 </section>;
}
