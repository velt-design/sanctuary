import { hubDocumentWindow, marketingDocumentUrl } from './hubDocumentSelection';
import { financialsQuery, nzDay, selectionFromUrl, type FinancialPanelQuery } from '@/lib/xero/financials/contract';
export function overviewDocumentWindow(headers:Headers,now=new Date()) {
  const url=marketingDocumentUrl(headers);
  return url&&(url.searchParams.get('view')??'overview')==='overview'?hubDocumentWindow(headers,now):null;
}
export function financialDocumentQuery(headers:Headers,now=new Date()):FinancialPanelQuery|null {
  const url=marketingDocumentUrl(headers),params=url?.searchParams;
  if(!params||params.get('view')!=='financials'||params.getAll('view').length!==1)return null;
  if(['financeFrom','financeTo','financeBasis','financeSection'].some(key=>params.getAll(key).length>1))return null;
  if(params.has('financeSection')&&!['profit','bank','receivables','payables'].includes(params.get('financeSection')!))return null;
  if(['financeFrom','financeTo','financeBasis'].some(key=>params.has(key))&&!financialsQuery.safeParse({from:params.get('financeFrom'),to:params.get('financeTo'),basis:params.get('financeBasis')}).success)return null;
  if(params.has('financeTo')&&params.get('financeTo')!>nzDay(now))return null;
  const {from,to,basis,section}=selectionFromUrl(params,now);
  return {from,to,basis,section};
}