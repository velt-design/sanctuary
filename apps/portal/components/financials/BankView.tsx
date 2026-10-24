import {bankMetrics,money,type ReportLine} from '@/lib/xero/financials/model';
import type {FinancialReport,FinancialSelection} from '@/lib/xero/financials/contract';
import ReportTable from './ReportTable';
import styles from './Financials.module.css';
export default function BankView({report,selection,pending,onDetail}:{report:FinancialReport|null;selection:FinancialSelection;pending:boolean;onDetail:(row:ReportLine)=>void}){
 const metrics=report?bankMetrics(report):['Opening balance','Cash received','Cash spent','Closing balance'].map(label=>({label,value:null}));
 return <>
  <div className={`${styles.metrics} ${styles.bankMetrics}`}>{metrics.map(metric=><div key={metric.label}><h3>{metric.label}</h3><p className={styles.metricValue}>{report?money(metric.value,report.currency,true):pending?'Reading…':'Unavailable'}</p></div>)}</div>
  <p className={styles.context}>Recorded accounting balances and movements. Cash received/spent may include transfers, loans, tax and capital purchases; these are not sales and operating costs. Bank-statement reconciliation and unentered activity are outside this report.</p>
  <ReportTable pending={pending} selection={selection} report={report} onDetail={onDetail}/>
 </>;
}
