'use client';
import {useState} from 'react';
import {useSearchParams} from 'next/navigation';
import CostingControlCentre from '@/app/admin/costing/CostingControlCentre';
import MappingReview from '@/app/staff/payments/mapping/MappingReview';
import InstallerPayoutPage from '@/components/installerPayouts/InstallerPayoutPage';
import {fictionalCosting,fictionalMapping,fictionalPayout,type OperationalReads} from './operationalData';
function wait(signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,1200);signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});}
export default function OperationalJourney({reads}: {reads:OperationalReads}){
 const params=useSearchParams(),mode=params.get('view'),failure=params.get('operationalFailure')==='1';
 const [loaders]=useState(()=>{let mappingFailure=failure,payoutFailure=failure;
  return {overview:async()=>{await wait();return fictionalCosting();},inspect:async(_body:object,signal?:AbortSignal)=>{await wait(signal);if(mappingFailure){mappingFailure=false;throw new Error('Fictional mapping read failed.');}return fictionalMapping();},payout:async(_input:RequestInfo|URL,init?:RequestInit)=>{if(init?.method&&init.method!=='GET')throw new Error('Fictional lane rejects every command.');await wait(init?.signal??undefined);if(payoutFailure){payoutFailure=false;return Response.json({error:'Fictional payout read failed.'},{status:503});}return Response.json({events:fictionalPayout(),canEdit:false});}};
 });
 return mode==='costing'?<CostingControlCentre initialOverviewRead={reads.costing} overviewLoader={loaders.overview} readOnlyMode/>:mode==='mapping'?<MappingReview invoiceId="99999999-0000-4000-8000-000000000901" contextRead={reads.mapping} inspectLoader={loaders.inspect} readOnly/>:<InstallerPayoutPage projectId="fictional-project" transport={loaders.payout}/>;
}
