import {z} from 'zod';
import {canonicalHash,executionPlanSchema,hash,retainedAdSchema} from './contract';
import {nativeAnalysisSchema} from './analysis-contract';
import {nativeAcceptanceSchema,requireNativeAcceptance} from './native-acceptance';
import {nextRetentionEffect,requireRetainedAnalysis,requireRetentionProof,retentionProofSchema,retentionStateSchema,retentionWireSchema,serializeRetentionEffect} from './retention-policy';
export const retentionSnapshotSchema=z.object({state:retentionStateSchema,plan:executionPlanSchema,analysis:nativeAnalysisSchema,acceptance:nativeAcceptanceSchema.nullable(),retainedAds:z.array(retainedAdSchema).max(4)}).strict().superRefine((v,c)=>{
 if(v.state.planHash!==canonicalHash(v.plan)||v.state.experiment!==v.plan.experiment||v.state.donor!==v.plan.controlAd||canonicalHash(v.state.previous)!==canonicalHash(v.plan.retainedBaseline??null)||v.analysis.experiment!==v.plan.experiment||v.analysis.planHash!==v.state.planHash||v.analysis.decision!=='retain')c.addIssue({code:'custom',message:'Retention snapshot differs'});
});
export const retentionAdmitSchema=z.object({generation:z.number().int().positive(),intent:retentionWireSchema,proof:retentionProofSchema.nullable()}).strict();
export const retentionFinishSchema=z.object({generation:z.number().int().positive(),outcome:z.enum(['retained','reverted']),evidenceHash:hash,proof:retentionProofSchema.nullable()}).strict();
export function validateRetentionIntent(payload:unknown,snapshot:unknown,template:string,now=Date.now()){
 const input=retentionAdmitSchema.parse(payload),{state,plan,analysis,acceptance}=retentionSnapshotSchema.parse(snapshot),cleanup=input.intent.kind==='pause_retained';
 if(state.stopped||input.generation!==state.generation||input.intent.at>now+1000||now-input.intent.at>60000)throw new Error('Retention authority changed');
 if(cleanup){if(!state.cleanupEnabled||input.proof!==null)throw new Error('Retention cleanup unavailable');}
 else{
  if(!state.enabled||plan.landingTemplate!==template||process.env.SANCTUARY_META_CREATIVE_DELIVERY_ENABLED!=='true')throw new Error('Retention delivery unavailable');
  requireRetainedAnalysis(plan,state,analysis,now);requireNativeAcceptance(plan,acceptance,now);requireRetentionProof(plan,state,input.proof,acceptance!.id,now);
 }
 if(canonicalHash(serializeRetentionEffect(plan,state,input.intent.kind,input.intent.at))!==canonicalHash(input.intent))throw new Error('Retention intent differs');
 return input;
}
export function validateRetentionDispatch(command:string,requestHash:string,snapshot:unknown,template:string){
 const value=retentionSnapshotSchema.parse(snapshot),effect=value.state.effects.find(e=>e.command===command&&e.intent.requestHash===requestHash);
 if(!effect||effect.state!=='prepared'||value.state.stopped)throw new Error('Retention dispatch unavailable');
 const cleanup=effect.kind==='pause_retained';
 if(cleanup?!value.state.cleanupEnabled:!value.state.enabled||value.plan.landingTemplate!==template||!value.acceptance||process.env.SANCTUARY_META_CREATIVE_DELIVERY_ENABLED!=='true')throw new Error('Retention dispatch stopped');
}
export function validateRetentionFinish(payload:unknown,snapshot:unknown,template:string){
 const input=retentionFinishSchema.parse(payload),value=retentionSnapshotSchema.parse(snapshot),next=nextRetentionEffect(value.state);
 // Exact immutable receipt replay is checked in SQL; it dispatches no effect.
 if(value.state.finalized===input.outcome)return input;
 if(value.state.stopped||input.generation!==value.state.generation||next!==(input.outcome==='retained'?'finish_retained':'finish_reverted'))throw new Error('Retention finish differs');
 if(input.outcome==='retained'){
  if(process.env.SANCTUARY_META_CREATIVE_DELIVERY_ENABLED!=='true'||value.plan.landingTemplate!==template)throw new Error('Retention delivery unavailable');
  requireRetentionProof(value.plan,value.state,input.proof,value.acceptance!.id);
 }else if(!value.state.cleanupEnabled||input.proof!==null)throw new Error('Retention cleanup unavailable');
 return input;
}
