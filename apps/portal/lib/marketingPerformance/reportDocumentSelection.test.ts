// @vitest-environment node
import {expect,it} from 'vitest';
import {prepareRegionalDocumentAccess,DOCUMENT_CALLBACK_HEADER} from '@/lib/regionalDocumentAccess';
import {financialDocumentQuery,overviewDocumentWindow} from './reportDocumentSelection';
import {completedMonth} from '@/lib/xero/financials/contract';
const now=new Date('2026-10-31T11:00:00Z');
function headers(query='',extra:Record<string,string>={},method='GET',path='/staff/marketing-performance'){
 return prepareRegionalDocumentAccess(new Request(`https://portal.example.test${path}${query}`,{method,headers:{accept:'text/html','sec-fetch-dest':'document',...extra}})).headers??new Headers();
}
it('selects exact Financial family/dates/basis and Auckland month defaults without changing client defaults',()=>{
 expect(financialDocumentQuery(headers('?view=financials'),now)).toEqual({...completedMonth(now),section:'profit'});
 for(const section of ['profit','bank','receivables','payables'])expect(financialDocumentQuery(headers(`?view=financials&financeSection=${section}&financeFrom=2026-09-01&financeTo=2026-09-30&financeBasis=cash`),now)).toEqual({from:'2026-09-01',to:'2026-09-30',basis:'cash',section});
 expect(overviewDocumentWindow(headers('?view=financials'),now)).toBeNull();expect(overviewDocumentWindow(headers('?view=sales'),now)).toBeNull();expect(overviewDocumentWindow(headers(),now)).not.toBeNull();
});
it('rejects invalid, future and duplicate selections, RSC, prefetch, actions and spoofed callbacks',()=>{
 for(const suffix of ['&financeFrom=2026-02-30','&financeFrom=2026-09-01','&financeFrom=2026-09-01&financeTo=2099-09-30&financeBasis=cash','&financeSection=unknown','&financeSection=profit&financeSection=bank','&view=overview','&_rsc=id'])expect(financialDocumentQuery(headers('?view=financials'+suffix),now)).toBeNull();
 for(const extra of [{rsc:'1'},{'next-router-prefetch':'1'},{'next-action':'id'},{'next-router-state-tree':'[]'},{'x-nextjs-data':'1'}] as Array<Record<string,string>>)expect(financialDocumentQuery(headers('?view=financials',extra),now)).toBeNull();
 expect(financialDocumentQuery(headers('?view=financials',{},'POST'),now)).toBeNull();
 expect(financialDocumentQuery(headers('?view=financials',{[DOCUMENT_CALLBACK_HEADER]:'/staff/marketing-performance?view=financials'},'GET','/api/staff/v1/marketing-performance/financials'),now)).toBeNull();
});
