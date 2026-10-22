import {randomUUID} from 'node:crypto';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {planFixture} from './retention-fixtures';
import {canonicalHash} from './contract';
import {retentionSnapshotSchema,validateRetentionIntent,validateRetentionDispatch,validateRetentionFinish} from './retention-authority';
import {creativeWithPrimary} from './creative-copy';
import {serializeRetentionEffect} from './retention-policy';
function fixture(){
 const plan=planFixture(),now=(plan.end+73*3600)*1000;plan.approvalUntil=new Date((plan.end+72*3600)*1000).toISOString();const planHash=canonicalHash(plan),stamp=new Date(now).toISOString(),h='a'.repeat(64);
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now);vi.stubEnv('SANCTUARY_META_CREATIVE_DELIVERY_ENABLED','true');
 const testAds=[{arm:'control',ad:'9911'},{arm:'challenger',ad:'9912'}],analysisCommand=randomUUID(),state={version:1,experiment:plan.experiment,planHash,analysisCommand,donor:plan.controlAd,generation:1,enabled:true,cleanupEnabled:true,stopped:false,study:'9920',creative:'9921',ad:null,previous:null,testCleanupComplete:true,testAds,otherBaselines:[],aborting:false,finalized:null,effects:[]};
 const analysis={version:1,experiment:plan.experiment,planHash,policy:'native-saved-enquiry-per-dollar-v1',observedAt:stamp,cohortHash:h,spendHash:h,deliveryHash:h,sourceDates:{cohort:stamp,spend:stamp,delivery:stamp},allSavedCoverage:'complete',coverageCounts:{websiteGenuine:60,nativeMatched:60,knownOtherRegistered:0,unknownAttribution:0,unlinkedNative:0},unresolvedLate:0,arms:testAds.map((a,i)=>({...a,enquiries:20+i*20,spend:100,canonical:20+i*20,correspondence:0,intake:0,assessed:20+i*20,concerns:0,conflicting:0,unknown:0})),decision:'retain',reason:'formal_interval',interval:{lower:1.2,upper:3,upperUnbounded:false},quality:'passes'};
 const acceptance={version:1,id:randomUUID(),scope:plan.scope,originalAds:plan.originalAds,nativeContractHash:plan.nativeContractHash,pixel:'777',semantics:{currency:'NZD',timezone:'Pacific/Auckland',budgetOwner:'campaign',dailyMinor:40000,studyDailyMinor:8000,uiStudyDaily:80,offset:100,allocation:'existing_campaign_portion',experimentalUnit:'SPLIT_TEST_V2_ad_cells',topology:'same_original_adset',objective:'CONVERSIONS',event:'Lead',isPrimary:true},exampleExperiment:randomUUID(),exampleStudy:'9920',exampleCells:[{id:'41',arm:'control',ad:'9911'},{id:'42',arm:'challenger',ad:'9912'}],unitProofHash:h,allocationProofHash:h,originalsProofHash:h,objectiveProofHash:h,observedAt:stamp,recordedAt:stamp,provenance:'hosted_paused_study_and_native_ui',evidenceHash:h};
 const snapshot=retentionSnapshotSchema.parse({plan,state,analysis,acceptance,retainedAds:[]});
 const proof={version:1,planHash,analysisCommand,observedAt:stamp,study:state.study,studyEnd:plan.end,studyObservationEnd:plan.end,studyProof:h,acceptance:acceptance.id,originalsHash:canonicalHash([...plan.originalAds].sort().map(id=>({id,status:'ACTIVE',page:plan.scope.page}))),budgetHash:canonicalHash({account:plan.scope.account,campaign:plan.scope.campaign,adset:plan.scope.adset,currency:plan.currency,timezone:plan.timezone,campaignDailyMinor:plan.dailyMinor,adsetDailyMinor:0,lifetimeMinor:0,bid:'LOWEST_COST_WITHOUT_CAP'}),settingsHash:plan.preStateHash,creativeHash:canonicalHash(creativeWithPrimary(plan.control,state.creative,plan.challengerPrimary)),testAds:testAds.map(a=>({...a,creative:a.arm==='control'?plan.control.id:state.creative,status:'PAUSED',proof:h})),otherBaselines:[],candidate:null,previous:null};
 const intent=serializeRetentionEffect(plan,snapshot.state,'create_retained');return{snapshot,payload:{generation:1,intent,proof}};
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
it('accepts only exact mature winner create and retains independent Source delivery/template guards',()=>{
 const f=fixture();expect(validateRetentionIntent(f.payload,f.snapshot,f.snapshot.plan.landingTemplate).intent.kind).toBe('create_retained');
 expect(()=>validateRetentionIntent(f.payload,f.snapshot,'f'.repeat(64))).toThrow();vi.stubEnv('SANCTUARY_META_CREATIVE_DELIVERY_ENABLED','false');expect(()=>validateRetentionIntent(f.payload,f.snapshot,f.snapshot.plan.landingTemplate)).toThrow();
});
it.each(['generation','stop','cleanup','analysis','proof_age','proof_analysis','test_active','budget','create_status','target','raw_field'] as const)('denies %s before native dispatch',kind=>{
 const f=fixture();
 if(kind==='generation')f.payload.generation++;
 if(kind==='stop')f.snapshot.state.stopped=true;
 if(kind==='cleanup')f.snapshot.state.testCleanupComplete=false;
 if(kind==='analysis')f.snapshot.analysis.decision='inconclusive';
 if(kind==='proof_age')f.payload.proof.observedAt=new Date(Date.now()-61000).toISOString();
 if(kind==='proof_analysis')f.payload.proof.analysisCommand=randomUUID();
 if(kind==='test_active')f.payload.proof.testAds[0]!.status='ACTIVE';
 if(kind==='budget')f.payload.intent.body.daily_budget='1';
 if(kind==='create_status')f.payload.intent.body.status='ACTIVE';
 if(kind==='target')f.payload.intent.target=f.snapshot.plan.originalAds[0]!;
 if(kind==='raw_field')Object.assign(f.payload.proof,{message:'private-canary'});
 expect(()=>validateRetentionIntent(f.payload,f.snapshot,f.snapshot.plan.landingTemplate)).toThrow();
});
it('dispatches only the exact prepared command and never an uncertain one',()=>{
 const f=fixture(),command=randomUUID();f.snapshot.state.effects.push({command,kind:'create_retained',state:'prepared',intent:f.payload.intent,object:null,evidenceHash:null});
 expect(()=>validateRetentionDispatch(command,f.payload.intent.requestHash,f.snapshot,f.snapshot.plan.landingTemplate)).not.toThrow();
 f.snapshot.state.effects[0]!.state='uncertain';expect(()=>validateRetentionDispatch(command,f.payload.intent.requestHash,f.snapshot,f.snapshot.plan.landingTemplate)).toThrow();
});
it('leaves exact final receipt replay to SQL without permitting an unsettled new finalization',()=>{
 const f=fixture(),payload={generation:1,outcome:'retained',evidenceHash:'a'.repeat(64),proof:f.payload.proof};
 expect(()=>validateRetentionFinish(payload,f.snapshot,f.snapshot.plan.landingTemplate)).toThrow();
 f.snapshot.state.finalized='retained';expect(validateRetentionFinish(payload,f.snapshot,f.snapshot.plan.landingTemplate).outcome).toBe('retained');
});
