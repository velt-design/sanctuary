import { useState } from 'react';
import { Button, Input, Select } from '@/components/ui/foundation/FoundationControls';
import { Drawer } from '@/components/ui/drawer/Drawer';
import { completedMonth, financialsQuery, nzDay, previousQuery, yearToDate, type Financials, type FinancialSelection } from '@/lib/xero/financials/contract';
import styles from './Financials.module.css';

export default function FinancialToolbar({ selection, apply, report, busy, retry }: { selection: FinancialSelection; apply: (next: FinancialSelection) => void; report: Financials | null; busy: boolean; retry: () => void }) {
  const [open,setOpen] = useState(false), [draft,setDraft] = useState(selection), [error,setError] = useState('');
  const month = completedMonth(), previous = previousQuery(month);
  const fy = report?.financialYearEnd ? yearToDate(report.financialYearEnd) : null;
  const preset = selection.from === month.from && selection.to === month.to ? 'last' : selection.from === previous.from && selection.to === previous.to ? 'previous' : fy && selection.from === fy.from && selection.to === fy.to ? 'fy' : 'custom';
  const edit = () => {setDraft(selection);setError('');setOpen(true);};
  return <>
    <div className={styles.toolbar}>
      <Select label="Financial period" value={preset} onChange={event => { const value = event.target.value; if(value === 'custom') edit(); else apply({...selection,...(value === 'fy' ? fy! : value === 'previous' ? previous : month),basis:selection.basis,detail:''}); }}>
        <option value="last">Last completed month</option><option value="previous">Previous month</option>{fy && <option value="fy">Financial year to date</option>}<option value="custom">Custom dates</option>
      </Select>
      <Select label="P&L basis" value={selection.basis} onChange={event => apply({...selection,basis:event.target.value as FinancialSelection['basis'],detail:''})}><option value="accrual">Accrual</option><option value="cash">Cash</option></Select>
      <div className={styles.toolbarActions}><Button variant="quiet" onClick={edit}>{selection.from} – {selection.to}</Button><Button variant="secondary" onClick={retry} disabled={busy}>{busy ? 'Reading Xero…' : 'Refresh Xero'}</Button></div>
    </div>
    <Drawer title="Financial period" open={open} onClose={() => setOpen(false)}><div className={styles.periodDrawer}>
      <Input type="date" label="From" value={draft.from} max={nzDay()} onChange={event => setDraft({...draft,from:event.target.value})}/><Input type="date" label="To" value={draft.to} max={nzDay()} onChange={event => setDraft({...draft,to:event.target.value})}/>
      <p className={styles.context}>Up to 366 accounting dates, through today in New Zealand. A partial month is compared with an equal-length previous period. Full calendar months compare with the previous calendar month.</p>
      {!fy && <p className={styles.context}>Financial-year-to-date becomes available when Xero supplies a valid year-end setting.</p>}{error && <p role="alert">{error}</p>}
      <div className={styles.periodActions}><Button onClick={() => {const parsed=financialsQuery.safeParse({from:draft.from,to:draft.to,basis:draft.basis});if(!parsed.success||draft.to>nzDay()){setError('Choose valid dates, up to 366 days through today.');return;}apply({...selection,...parsed.data,detail:''});setOpen(false);}}>Apply</Button><Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button></div>
    </div></Drawer>
  </>;
}
