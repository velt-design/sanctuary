import {notFound} from 'next/navigation';
import Fixture from './Fixture';
import {fictionalCosting,fictionalInvoice,type OperationalReads} from './operationalData';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  if(process.env.ENABLE_PORTAL_QA_FIXTURES?.trim()!=='1'||(process.env.NODE_ENV==='production'&&process.env.VERCEL_ENV!=='preview'))notFound();
  const query=await searchParams;
  const reads:OperationalReads={};const failure=query.operationalFailure==='1';
  if(query.view==='costing')reads.costing=new Promise(resolve=>setTimeout(()=>resolve(failure?null:fictionalCosting()),1800));
  if(query.view==='mapping')reads.mapping=new Promise(resolve=>setTimeout(()=>resolve(fictionalInvoice),700));
  return <Fixture operationalReads={reads} dashboardFailure={query.dashboardFailure==='1'} sheetFailure={query.sheetFailure==='1'} visitsFailure={query.visitsFailure==='1'}/>;
}
