import { financialsSchema, previousQuery, yearAgoQuery, trendQueries, type FinancialsQuery, type FinancialReport } from '@/lib/xero/financials/contract';
import type { FinanceReportRow } from '@/lib/xero/financePositionContract';
import type { FinancialsLoader } from '@/components/financials/useFinancials';

const id = (n:number) => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const cell = (value:string) => ({value,attributes:[]});
const row = (label:string,amount:number,type:FinanceReportRow['type']='Row',account?:number):FinanceReportRow => ({type,title:null,rows:[],cells:[{value:label,attributes:account?[{id:'account',value:id(account)}]:[]},cell(amount.toFixed(2))]});
const section = (title:string,rows:FinanceReportRow[]):FinanceReportRow => ({type:'Section',title,rows,cells:[]});
const checkedAt='2026-10-02T00:00:00.000Z';
export function sampleProfit(query:FinancialsQuery):FinancialReport {
  const month=Number(query.to.slice(5,7)),year=Number(query.to.slice(0,4)),factor=(0.82+month*0.025+(year-2026)*0.06)*(query.basis==='cash'?0.91:1);
  const revenue=190000*factor,direct=95000*factor,expense=47000*factor,gross=revenue-direct,net=gross-expense;
  return {id:'ProfitAndLoss',name:'Profit and Loss',titles:['Profit and Loss','Fictional demonstration company'],reportDate:query.to,updatedAt:checkedAt,...query,currency:'NZD',interpretation:'standard_profit_and_loss',rows:[
    {type:'Header',title:null,rows:[],cells:[cell(''),cell(query.to)]},
    section('Income',[row('Pergola sales',revenue*0.82,'Row',1),row('Installation services',revenue*0.18,'Row',2),row('Total Income',revenue,'SummaryRow')]),
    section('Less Cost of Sales',[row('Materials',direct*0.64,'Row',3),row('Subcontracted installation',direct*0.36,'Row',4),row('Total Cost of Sales',direct,'SummaryRow')]),
    section('',[row('Gross Profit',gross)]),
    section('Less Operating Expenses',[row('Team and administration',expense*0.5,'Row',5),row('Premises and vehicle costs',expense*0.32,'Row',6),row('Advertising',expense*0.18,'Row',7),row('Total Operating Expenses',expense,'SummaryRow')]),
    section('',[row('Net Profit',net)]),
  ]};
}
function sampleBank(query:FinancialsQuery):FinancialReport {
  const bankRow=(label:string,values:number[],type:FinanceReportRow['type']='Row'):FinanceReportRow=>({type,title:null,rows:[],cells:[cell(label),...values.map(value=>cell(value.toFixed(2)))]});
  return {id:'BankSummary',name:'Bank Summary',titles:['Bank Summary','Fictional demonstration company'],reportDate:query.to,updatedAt:checkedAt,...query,basis:'bank_movements',currency:'NZD',interpretation:'accounting_bank_balances_not_spendable_cash',rows:[
    {type:'Header',title:null,rows:[],cells:['Bank Accounts','Opening Balance','Cash Received','Cash Spent','Closing Balance'].map(cell)},
    section('',[bankRow('Operating account',[62000,219000,186000,95000]),bankRow('Savings account',[40000,7000,1000,46000]),bankRow('Total',[102000,226000,187000,141000],'SummaryRow')]),
  ]};
}
export function sampleFinancials(query:FinancialsQuery,mode='complete') {
  const available=<T,>(data:T)=>({status:'available' as const,complete:true as const,checkedAt,data});
  const invoice=(n:number,payable:boolean)=>({id:id(100+n),number:`${payable?'BILL':'INV'}-${String(n+101)}`,type:payable?'ACCPAY' as const:'ACCREC' as const,contactId:id(200+n),contactName:`${payable?'Sample supplier':'Sample customer'} ${n+1}`,status:'AUTHORISED' as const,date:'2026-08-01',dueDate:n===5?null:['2026-10-14','2026-09-20','2026-08-20','2026-07-20','2026-06-01'][n%5],currency:n===6?'AUD':'NZD',total:String(2200+n*630),amountDue:String(1700+n*580),amountPaid:String(500+n*50),amountCredited:'0',updatedAt:'2026-10-01T20:00:00.000Z',lineItems:[{description:payable?'Fictional materials purchase':'Fictional pergola installation',accountCode:'200',lineAmount:String(1900+n*500),taxAmount:'285'}]});
  const population=(payable:boolean)=>({coverage:'current_authorised_outstanding_invoices' as const,count:mode==='empty'?0:8,items:mode==='empty'?[]:Array.from({length:8},(_,n)=>invoice(n,payable))});
  const dated=(query:FinancialsQuery)=>({query,report:available(sampleProfit(query))});
  const result=financialsSchema.parse({schemaVersion:'sanctuary.financials.v1',checkedAt,financialYearEnd:{month:3,day:31},
    position:{schemaVersion:'sanctuary.praxis.finance-position.v1',query,startedAt:'2026-10-01T23:59:50.000Z',checkedAt,consistency:'sequential_read_window',identity:{tenantId:id(999),scope:'organisation'},organisation:available({name:'Fictional demonstration company',baseCurrency:'NZD',timezone:'NEWZEALANDSTANDARDTIME'}),bankSummary:available(sampleBank(query)),profitAndLoss:available(sampleProfit(query)),receivables:available(population(false)),payables:available(population(true)),limitations:['Synthetic demonstration only. No customer or accounting system was contacted.','Current outstanding invoices are separate from selected-period reports.']},previous:dated(previousQuery(query)),yearAgo:dated(yearAgoQuery(query)),months:trendQueries(query).map(dated)});
  if(mode==='partial') {result.position.payables={status:'unavailable',reason:'missing_scope',requiredScopes:['accounting.invoices.read']};result.previous.report={status:'unavailable',reason:'provider_unavailable',requiredScopes:[]};result.months[2].report={status:'unavailable',reason:'provider_unavailable',requiredScopes:[]};}
  if(mode==='bank-failure')result.position.bankSummary={status:'unavailable',reason:'provider_unavailable',requiredScopes:[]};
  return result;
}
export const financialsLoader:FinancialsLoader=async(query,signal)=>{
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,500);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Cancelled'));},{once:true});});
  const mode=new URLSearchParams(window.location.search).get('financeScenario')??'complete';
  if(mode==='failure')throw new Error('Synthetic source failure. Retry after choosing a working scenario.');
  return sampleFinancials(query,mode);
};
