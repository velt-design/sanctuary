import { useState } from 'react';
import type { FinancialReport } from '@/lib/xero/financials/contract';
import { cents, matchingLine, money, reportLines, variance, type ReportLine } from '@/lib/xero/financials/model';
import styles from './Financials.module.css';

export default function ReportTable({ report, comparison, comparisonLabel, onDetail }: { report: FinancialReport; comparison?: FinancialReport | null; comparisonLabel?: string; onDetail: (line: ReportLine) => void }) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const lines = reportLines(report), previous = comparison ? reportLines(comparison) : [];
  const bank = report.basis === 'bank_movements', headers = lines.find(row => row.type === 'Header')?.values ?? [];
  const visible = lines.filter(row => row.type !== 'Header' && !(row.type === 'Section' && !row.label) && !collapsed.some(key => row.parent === key || row.parent.startsWith(`${key}/`)));
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={bank ? 'Bank account balances' : 'Profit and loss accounts'}>
    <table className={styles.table}>
      <caption>{report.name} · {report.from} to {report.to}{bank ? ' · recorded accounting balances' : ` · ${report.basis} · excluding GST`} · {report.currency}</caption>
      <thead><tr><th scope="col">{bank ? 'Bank account' : 'Account / report row'}</th>{bank ? headers.map((header, index) => <th key={index} scope="col">{header}</th>) : <><th scope="col">Selected period</th><th scope="col">{comparisonLabel}</th><th scope="col">Change</th><th scope="col">Change %</th></>}</tr></thead>
      <tbody>{visible.map((row, index) => {
        const prior = matchingLine(previous, row), delta = variance(row.cents, prior?.cents ?? null);
        if (row.type === 'Section') return <tr key={`${row.key}-${index}`} className={styles.sectionRow}><td colSpan={bank ? headers.length + 1 : 5}><button onClick={() => setCollapsed(value => value.includes(row.key) ? value.filter(key => key !== row.key) : [...value, row.key])} aria-expanded={!collapsed.includes(row.key)}>{collapsed.includes(row.key) ? '+ ' : '− '}{row.label}</button></td></tr>;
        return <tr key={`${row.key}-${index}`} className={row.type === 'SummaryRow' ? styles.summaryRow : undefined}>
          <td><button onClick={() => onDetail(row)}>{row.label || 'Unnamed source row'}</button></td>
          {bank ? row.values.map((value, index) => <td key={index}>{cents(value) === null ? value || 'Unavailable' : money(cents(value),report.currency)}</td>) : <><td>{money(row.cents, report.currency)}</td><td>{money(prior?.cents ?? null, report.currency)}</td><td>{money(delta.amount, report.currency)}</td><td>{delta.percentage === null ? '—' : `${delta.percentage > 0 ? '+' : ''}${delta.percentage.toFixed(1)}%`}</td></>}
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
