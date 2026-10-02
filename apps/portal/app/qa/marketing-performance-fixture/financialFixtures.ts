import { financialsSchema, previousQuery, yearAgoQuery, trendQueries, type FinancialsQuery, type FinancialReport } from '@/lib/xero/financials/contract';
import type { FinanceReportRow } from '@/lib/xero/financePositionContract';
import type { FinancialsLoader } from '@/components/financials/useFinancials';

const id = (n:number) => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const cell = (value:string) => ({value,attributes:[]});
const decimal = (cents:number) => (cents/100).toFixed(2);
const row = (label:string,amount:number,type:FinanceReportRow['type']='Row',account?:number):FinanceReportRow => ({type,title:null,rows:[],cells:[{value:label,attributes:account?[{id:'account',value:id(account)}]:[]},cell(decimal(amount))]});
const section = (title:string,rows:FinanceReportRow[]):FinanceReportRow => ({type:'Section',title,rows,cells:[]});
const checkedAt='2026-10-02T00:00:00.000Z';
const dayMs=86400000;
// One synthetic daily ledger, in integer cents, shared by every overlapping date range.
function dailyAccounts(day:Date,basis:FinancialsQuery['basis']) {
  const month=day.getUTCMonth()+1,weekday=day.getUTCDay(),year=day.getUTCFullYear()%7;
  return [430000+month*9000+weekday*8500+year*2500,112000+month*1200+weekday*1700,
    220000+month*4400+weekday*4500,112000+month*2500+weekday*2500,
    74000+month*500,41000+month*300,23000+month*800+weekday*300]
    .map(value=>basis==='cash'?Math.round(value*91/100):value);
}
function periodAccounts(query:FinancialsQuery) {
  const totals=Array<number>(7).fill(0);
  for(let time=Date.parse(query.from);time<=Date.parse(query.to);time+=dayMs)
    dailyAccounts(new Date(time),query.basis).forEach((value,index)=>{totals[index]+=value;});
  return totals;
}
export function sampleProfit(query:FinancialsQuery):FinancialReport {
  const accounts=periodAccounts(query),revenue=accounts[0]+accounts[1],direct=accounts[2]+accounts[3],expense=accounts[4]+accounts[5]+accounts[6],gross=revenue-direct,net=gross-expense;
  return {id:'ProfitAndLoss',name:'Profit and Loss',titles:['Profit and Loss','Fictional demonstration company'],reportDate:query.to,updatedAt:checkedAt,...query,currency:'NZD',interpretation:'standard_profit_and_loss',rows:[
    {type:'Header',title:null,rows:[],cells:[cell(''),cell(query.to)]},
    section('Income',[row('Pergola sales',accounts[0],'Row',1),row('Installation services',accounts[1],'Row',2),row('Total Income',revenue,'SummaryRow')]),
    section('Less Cost of Sales',[row('Materials',accounts[2],'Row',3),row('Subcontracted installation',accounts[3],'Row',4),row('Total Cost of Sales',direct,'SummaryRow')]),
    section('',[row('Gross Profit',gross)]),
    section('Less Operating Expenses',[row('Team and administration',accounts[4],'Row',5),row('Premises and vehicle costs',accounts[5],'Row',6),row('Advertising',accounts[6],'Row',7),row('Total Operating Expenses',expense,'SummaryRow')]),
    section('',[row('Net Profit',net)]),
  ]};
}
function sampleBank(query:FinancialsQuery):FinancialReport {
  const bankRow=(label:string,values:number[],type:FinanceReportRow['type']='Row'):FinanceReportRow=>({type,title:null,rows:[],cells:[cell(label),...values.map(value=>cell(decimal(value)))]});
  // Constant daily bank flows make adjacent closings/openings exact, independently of P&L basis.
  const days=(Date.parse(query.to)-Date.parse(query.from))/dayMs+1,elapsed=(Date.parse(query.from)-Date.parse('2026-01-01'))/dayMs;
  const balances=(initial:number,received:number,spent:number)=>{const opening=initial+elapsed*(received-spent);return [opening,days*received,days*spent,opening+days*(received-spent)];};
  const operating=balances(6200000,730000,620000),savings=balances(4000000,23000,3000),totals=operating.map((value,index)=>value+savings[index]);
  return {id:'BankSummary',name:'Bank Summary',titles:['Bank Summary','Fictional demonstration company'],reportDate:query.to,updatedAt:checkedAt,...query,basis:'bank_movements',currency:'NZD',interpretation:'accounting_bank_balances_not_spendable_cash',rows:[
    {type:'Header',title:null,rows:[],cells:['Bank Accounts','Opening Balance','Cash Received','Cash Spent','Closing Balance'].map(cell)},
    section('',[bankRow('Operating account',operating),bankRow('Savings account',savings),bankRow('Total',totals,'SummaryRow')]),
  ]};
}
export function sampleFinancials(query:FinancialsQuery,mode='complete') {
  const available=<T,>(data:T)=>({status:'available' as const,complete:true as const,checkedAt,data});
  const invoice=(n:number,payable:boolean)=>{
    const total=220000+n*63000,paid=50000+n*5000,credited=n===3?10000:0,tax=Math.round(total*15/115);
    const dueDate=n===5?null:['2026-10-14','2026-09-20','2026-08-20','2026-07-20','2026-06-01'][n%5];
    const date=dueDate?new Date(Date.parse(dueDate)-30*dayMs).toISOString().slice(0,10):'2026-09-01';
    return {id:id(100+n),number:`${payable?'BILL':'INV'}-${String(n+101)}`,type:payable?'ACCPAY' as const:'ACCREC' as const,contactId:id(200+n),contactName:`${payable?'Sample supplier':'Sample customer'} ${n+1}`,status:'AUTHORISED' as const,date,dueDate,currency:n===6?'AUD':'NZD',total:decimal(total),amountDue:decimal(total-paid-credited),amountPaid:decimal(paid),amountCredited:decimal(credited),updatedAt:'2026-10-01T20:00:00.000Z',lineItems:[{description:payable?'Fictional materials purchase':'Fictional pergola installation',accountCode:'200',lineAmount:decimal(total-tax),taxAmount:decimal(tax)}]};
  };
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
