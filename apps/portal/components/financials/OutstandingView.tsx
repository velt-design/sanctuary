import { useState } from 'react';
import { Button, Input } from '@/components/ui/foundation/FoundationControls';
import type { FinancePosition } from '@/lib/xero/financePositionContract';
import { nzDay } from '@/lib/xero/financials/contract';
import { ageBand, invoiceTotals, money, cents, type Invoice } from '@/lib/xero/financials/model';
import styles from './Financials.module.css';

export default function OutstandingView({ family, payable, onDetail, baseCurrency }: { family: Extract<FinancePosition['receivables'], {status:'available'}>; payable: boolean; onDetail: (invoice: Invoice) => void; baseCurrency?:string }) {
  const [search, setSearch] = useState(''), [band, setBand] = useState(''), [bandCurrency,setBandCurrency] = useState(''), [page, setPage] = useState(0);
  const day = nzDay(new Date(family.checkedAt)), totals = invoiceTotals(family.data.items, day).sort((a,b)=>a.currency===baseCurrency?-1:b.currency===baseCurrency?1:a.currency.localeCompare(b.currency));
  const items = family.data.items.filter(item => (!band || (ageBand(item, day) === band && item.currency === bandCurrency)) && `${item.contactName} ${item.number}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.number.localeCompare(b.number));
  const pages = Math.max(1, Math.ceil(items.length / 25)), currentPage = Math.min(page, pages - 1);
  return <>
    <p className={styles.context}>Current authorised {payable ? 'bills' : 'sales invoices'} with a balance owing · checked {new Date(family.checkedAt).toLocaleString('en-NZ',{timeZone:'Pacific/Auckland',dateStyle:'medium',timeStyle:'short'})} NZ. These balances do not describe the selected historical period. Document balances include GST where charged.</p>
    {!totals.length ? <div className={styles.empty}><h2>No outstanding {payable ? 'bills' : 'sales invoices'} recorded</h2><p>{payable ? 'This covers authorised bills entered in Xero. Future wages, tax, orders and unentered bills are outside this report.' : 'No authorised sales invoice has an outstanding balance in this complete read.'}</p></div> : totals.map(total => <section key={total.currency} className={styles.section} aria-label={`${total.currency} balances`}>
      <div className={styles.metrics}><div><h3>{payable ? 'Bills to pay' : 'Money owed'} · {total.currency}</h3><p className={styles.metricValue}>{money(total.total,total.currency,true)}</p><p className={styles.metricNote}>{total.count} outstanding {payable ? 'bills' : 'invoices'}</p></div><div><h3>Overdue</h3><p className={styles.metricValue}>{money(total.overdue,total.currency,true)}</p><p className={styles.metricNote}>Due before {day}</p></div><div><h3>Due today or later / undated</h3><p className={styles.metricValue}>{money(total.total === null || total.overdue === null ? null : total.total - total.overdue,total.currency,true)}</p><p className={styles.metricNote}>Booked balances, not a forecast</p></div></div>
      <div className={styles.ageing}>{total.bands.map(item => <button key={item.label} aria-pressed={band === item.label && bandCurrency === total.currency} onClick={() => {setBand(band === item.label && bandCurrency === total.currency ? '' : item.label);setBandCurrency(total.currency);setPage(0);}}><span>{item.label}</span><strong>{money(item.amount,total.currency,true)}</strong><span className={styles.context}>{item.count} {payable ? item.count===1?'bill':'bills' : item.count===1?'invoice':'invoices'}</span></button>)}</div>
    </section>)}
    <div className={styles.controls}><Input label={payable ? 'Find a bill or supplier' : 'Find an invoice or customer'} value={search} onChange={event => {setSearch(event.target.value);setPage(0);}}/>{band && <Button variant="quiet" onClick={() => setBand('')}>Clear ageing filter: {bandCurrency} · {band}</Button>}</div>
    <div className={styles.tableScroll} role="region" tabIndex={0} aria-label={payable ? 'Outstanding bills' : 'Outstanding sales invoices'}><table className={styles.table}>
      <thead><tr><th>{payable ? 'Supplier / bill' : 'Customer / invoice'}</th><th>Issued</th><th>Due</th><th>Age</th><th>Outstanding</th></tr></thead>
      <tbody>{items.slice(currentPage * 25, currentPage * 25 + 25).map(item => <tr key={item.id}><td><button onClick={() => onDetail(item)}>{item.contactName}<br/>{item.number || 'View document'}</button></td><td>{item.date}</td><td>{item.dueDate ?? 'Not recorded'}</td><td>{ageBand(item,day)}</td><td>{money(cents(item.amountDue),item.currency)} {item.currency}</td></tr>)}</tbody>
    </table></div>
    {items.length === 0 && totals.length > 0 && <p>No records match this search and ageing filter.</p>}
    {pages > 1 && <div className={styles.pagination}><Button variant="quiet" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>Page {currentPage + 1} of {pages}</span><Button variant="quiet" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Next</Button></div>}
    <p className={styles.context}>{payable ? 'Only booked, authorised bills are included. This is not a full cash forecast.' : 'Payments and credits already applied are reflected in the outstanding balance. They are not counted as additional cash.'} Currencies are kept separate.</p>
  </>;
}
