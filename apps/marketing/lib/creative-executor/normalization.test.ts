import {afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {randomUUID} from 'node:crypto';
import {sizedThumbnailFixture} from './donor-thumbnail.fixture';
import {creativeAssetHash,currentCapabilityReview,executionPlanSchema,type ExecutorState} from './contract';
import {serializeEffect} from './intent';
import {validateCreativeDispatch,validateCreativeIntent} from './authority';
import {writableVideoEnhancements} from './standard-enhancements';
import {verifyRetainedAd} from './retention-policy';
afterEach(()=>vi.unstubAllEnvs());
it('preserves unknown-field denial for an old retained plan without an ad-settings snapshot',()=>{
 const plan=sizedThumbnailFixture().plan,expected={ad:'999102',creative:'999101',status:'PAUSED' as const},row={id:expected.ad,account_id:plan.scope.account,campaign_id:plan.scope.campaign,adset_id:plan.scope.adset,status:'PAUSED',creative:{id:expected.creative},tracking_specs:plan.adTracking,ad_schedule_start_time:null,ad_schedule_end_time:null};
 expect(()=>verifyRetainedAd(plan,row,expected)).not.toThrow();expect(()=>verifyRetainedAd(plan,{...row,unknown:'private'},expected)).toThrow('Unknown');
});
function fixture(){
 const f=sizedThumbnailFixture(),control=structuredClone(f.control),now=Math.floor(Date.now()/1000);
 Object.assign(control.payload.degrees_of_freedom_spec,{creative_features_spec:{standard_enhancements:{enroll_status:'OPT_IN'},video_auto_crop:{enroll_status:'OPT_OUT'},text_optimizations:{enroll_status:'OPT_OUT'},inline_comment:{enroll_status:'OPT_IN'},unknown:{settings:['preserved',7]}}});
 const plan=executionPlanSchema.parse({...f.draft,control,approvedAssetHash:creativeAssetHash(control),start:now,end:now+3600,capabilityReview:{kind:'owner_directed_paused_normalization_v1',proposal:f.proposal}});
 const state:ExecutorState={enabled:true,cleanupEnabled:true,stopped:false,generation:1,plan,template:plan.landingTemplate,objects:[],effects:[],state:'prepared',measurementReady:false,activationReady:false,ownerProposal:{...f.envelope,plan:null,planHash:null}};
 const intent=serializeEffect(plan,state,'create_creative'),command=randomUUID();return{f,state,intent,command};
}
it('admits the existing large paused bounds only while the exact pending owner review remains current',()=>{
 const t=fixture();expect(Buffer.byteLength(JSON.stringify(t.intent))).toBeGreaterThan(8000);expect(currentCapabilityReview(t.state)).toBe(true);
 expect(validateCreativeIntent({generation:1,cleanup:false,intent:t.intent},t.state,t.state.template!).intent).toEqual(t.intent);
 const written=JSON.parse(t.intent.body.degrees_of_freedom_spec!);expect(written).toEqual(writableVideoEnhancements(t.state.plan!.control.format==='video_story'?t.state.plan!.control.payload.degrees_of_freedom_spec:undefined));
 expect(written.creative_features_spec).not.toHaveProperty('standard_enhancements');expect(written.creative_features_spec.video_auto_crop.enroll_status).toBe('OPT_OUT');expect(written.creative_features_spec.unknown).toEqual({settings:['preserved',7]});
});
it.each(['missing','expired','foreign'] as const)('denies %s pending authority both at admission and immediately before dispatch',kind=>{
 const t=fixture();t.state.effects=[{command:t.command,kind:'create_creative',intent:t.intent,requestHash:t.intent.requestHash,state:'prepared',object:null,evidenceHash:null}];
 if(kind==='missing')t.state.ownerProposal=null;
 if(kind==='expired')t.state.ownerProposal!.expiresAt=new Date(Date.now()-1000).toISOString();
 if(kind==='foreign')t.state.ownerProposal!.proposal={...t.state.ownerProposal!.proposal,instructionHash:'0'.repeat(64)};
 expect(()=>validateCreativeIntent({generation:1,cleanup:false,intent:t.intent},t.state,t.state.template!)).toThrow();
 expect(()=>validateCreativeDispatch(t.command,t.intent.requestHash,t.state,t.state.template!)).toThrow('pending');
});
it('keeps exact registered cleanup available after pending review withdrawal',()=>{
 const t=fixture();t.state.ownerProposal=null;t.state.enabled=false;t.state.objects=[{id:'999102',kind:'control',command:randomUUID(),requestHash:'b'.repeat(64)}];
 const intent=serializeEffect(t.state.plan!,t.state,'pause_control');expect(validateCreativeIntent({generation:1,cleanup:true,intent},t.state,t.state.template!).intent).toEqual(intent);
 t.state.effects=[{command:t.command,kind:'pause_control',intent,requestHash:intent.requestHash,state:'prepared',object:null,evidenceHash:null}];
 expect(()=>validateCreativeDispatch(t.command,intent.requestHash,t.state,t.state.template!)).not.toThrow();
});
