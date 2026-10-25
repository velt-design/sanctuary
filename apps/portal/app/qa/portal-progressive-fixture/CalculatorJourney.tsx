"use client";
import {useState} from 'react';
import {useSearchParams} from 'next/navigation';
import CalculatorGridClient from '@/app/staff/calculator/CalculatorGridClient';
import {makeDefaultCalculatorInputs} from '@/app/staff/calculator/calculatorInputs';
import type {EstimateDetail} from '@/lib/estimates/types';
import type {CalculatorDraftPersistence} from '@/app/staff/calculator/calculatorDraftPersistence';

export default function CalculatorJourney(){
  const params=useSearchParams();
  const [reads]=useState(()=>{
    let failed=false;
    const persistence:CalculatorDraftPersistence={restore:async()=>{await new Promise(resolve=>setTimeout(resolve,500));return null;},persist:async()=>({sessionStored:true,workingCopyStored:false})};
    return {draftPersistence:persistence,estimateLoader:async(id:string):Promise<EstimateDetail>=>{
      await new Promise(resolve=>setTimeout(resolve,1600));
      if(params.get('calculatorFailure')==='1'&&!failed){failed=true;throw new Error('Fictional draft read failed. Retry reads the same saved design.');}
      const inputs=makeDefaultCalculatorInputs();inputs.modules[0].lengthM='8.4';
      return {id,projectId:'fictional-project',createdAt:new Date().toISOString(),status:'draft',summary:{},versionLabel:'Fictional V1',isActiveDraft:true,hasSentQuote:false,jobPackEligible:false,jobPackGeneratedAt:null,jobPackQuoteVersionId:null,calculatorSnapshot:{inputs},editability:{isLocked:false,lockReason:null,lockedAt:null,lockedByQuoteVersionId:null,lockedByQuoteRef:null,lockedByQuoteVersionNumber:null,hasDraftQuotes:false,draftQuoteCount:0}};
    }};
  });
  return <><p>Actual Calculator and draft session. Controlled 500 ms local restore, then 1600 ms saved-design read. Save is disabled, persistence stays fictional, and the costing provider is deliberately unavailable.</p><CalculatorGridClient email="fictional@example.invalid" role="staff" sessionReads={reads} readOnly costingRequest={async()=>{throw new Error('Costing is unavailable in this read-only fictional journey.');}}/></>;
}
