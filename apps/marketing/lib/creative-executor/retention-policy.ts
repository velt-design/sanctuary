import {z} from 'zod';
import {canonicalHash,hash,id,stamp,retainedAdSchema,type ExecutionPlan} from './contract';
import {nativeAnalysisSchema} from './analysis-contract';
import {creativeWithPrimary} from './creative-copy';

export const retentionKinds=['create_retained','pause_previous','activate_retained','pause_retained','restore_previous'] as const;
export const retentionKindSchema=z.enum(retentionKinds);
export type RetentionKind=z.infer<typeof retentionKindSchema>;
export const retentionWireSchema=z.object({kind:retentionKindSchema,path:z.string().regex(/^[A-Za-z0-9_/]{1,80}$/),
 body:z.record(z.string(),z.string().max(6000)),target:id.nullable(),requestHash:hash,at:z.number().int().positive()}).strict();
export const retentionStateSchema=z.object({version:z.literal(1),experiment:z.uuid(),planHash:hash,analysisCommand:z.uuid(),donor:id,
 generation:z.number().int().positive(),enabled:z.boolean(),cleanupEnabled:z.boolean(),stopped:z.boolean(),
 study:id,creative:id,ad:id.nullable(),previous:z.object({experiment:z.uuid(),ad:id,creative:id,planHash:hash,donor:id}).strict().nullable(),
 testCleanupComplete:z.boolean(),testAds:z.array(z.object({arm:z.enum(['control','challenger']),ad:id}).strict()).length(2),otherBaselines:z.array(retainedAdSchema).max(3),
 aborting:z.boolean(),finalized:z.enum(['retained','reverted']).nullable(),
 effects:z.array(z.object({command:z.uuid(),kind:retentionKindSchema,state:z.enum(['prepared','uncertain','confirmed','no_effect']),
  intent:retentionWireSchema,object:id.nullable(),evidenceHash:hash.nullable()}).strict()).max(5),
}).strict().superRefine((s,c)=>{
 if(new Set(s.effects.map(e=>e.kind)).size!==s.effects.length||new Set(s.effects.map(e=>e.command)).size!==s.effects.length||
  s.effects.some(e=>e.kind!==e.intent.kind)||s.effects.filter(e=>e.state==='prepared'||e.state==='uncertain').length>1||
  s.previous?.ad===s.ad||s.previous&&s.previous.donor!==s.donor||new Set(s.testAds.map(a=>a.arm)).size!==2||new Set(s.testAds.map(a=>a.ad)).size!==2||s.otherBaselines.some(b=>b.donor===s.donor)||new Set(s.otherBaselines.map(b=>b.donor)).size!==s.otherBaselines.length)c.addIssue({code:'custom',message:'Retention ledger differs'});
});
export type RetentionState=z.infer<typeof retentionStateSchema>;
export type RetentionNext=RetentionKind|'reconcile'|'recovery_required'|'finish_retained'|'finish_reverted'|'observe'|'closed'|'stopped';

/** The source ledger, not elapsed time or a missing provider response, decides
 * whether an effect has happened. A new command never retries a consumed kind. */
export function nextRetentionEffect(input:RetentionState):RetentionNext{
 const s=retentionStateSchema.parse(input),done=(kind:RetentionKind)=>s.effects.some(e=>e.kind===kind&&e.state==='confirmed');
 if(s.stopped)return 'stopped';
 if(s.effects.some(e=>e.state==='prepared'||e.state==='uncertain'))return 'reconcile';
 if(s.finalized==='reverted')return 'closed';
 const abort=s.aborting||!s.enabled||s.effects.some(e=>e.state==='no_effect');
 if(abort){
  if(!s.cleanupEnabled)return 'stopped';
  if(s.ad&&!done('pause_retained'))return s.effects.some(e=>e.kind==='pause_retained')?'recovery_required':'pause_retained';
  if(s.previous&&done('pause_previous')&&!done('restore_previous')){
   if(!s.enabled)return 'recovery_required'; // Stop cannot authorize reactivation.
   return s.effects.some(e=>e.kind==='restore_previous')?'recovery_required':'restore_previous';
  }
  return 'finish_reverted';
 }
 if(s.finalized==='retained')return 'observe';
 if(!s.ad){if(done('create_retained'))throw new Error('Missing retained registry');return 'create_retained';}
 if(!done('create_retained'))throw new Error('Unproved retained registry');
 if(s.previous&&!done('pause_previous'))return 'pause_previous';
 if(!done('activate_retained'))return 'activate_retained';
 return 'finish_retained';
}

/** Only the winning creative is reused. No existing ad's expired schedule is
 * modified, no original is a target, and no budget/audience parameter exists. */
export function serializeRetentionEffect(plan:ExecutionPlan,input:RetentionState,kind:RetentionKind,now=Date.now()){
 const s=retentionStateSchema.parse(input);
 if(s.experiment!==plan.experiment||s.planHash!==canonicalHash(plan)||s.donor!==plan.controlAd||nextRetentionEffect(s)!==kind)throw new Error('Retention transition differs');
 if(plan.purpose!=='formal_experiment'||[s.ad,s.previous?.ad].some(ad=>ad&&plan.originalAds.includes(ad))||
  s.creative===plan.control.id||s.previous?.experiment===plan.experiment)throw new Error('Retention ownership differs');
 let path:string,target:string|null=null,body:Record<string,string>;
 if(kind==='create_retained'){
  path=`act_${plan.scope.account}/ads`;
  body={name:`velt-${plan.experiment}-retained`,adset_id:plan.scope.adset,creative:JSON.stringify({creative_id:s.creative}),tracking_specs:JSON.stringify(plan.adTracking),status:'PAUSED'};
 }else{
  target=(kind==='pause_previous'||kind==='restore_previous'?s.previous?.ad:s.ad)??null;
  if(!target)throw new Error('Retention target unavailable');path=target;
  body={status:kind==='activate_retained'||kind==='restore_previous'?'ACTIVE':'PAUSED'};
 }
 return retentionWireSchema.parse({kind,path,body,target,at:now,requestHash:canonicalHash({experiment:plan.experiment,kind,path,body})});
}

/** Must be the already-frozen mature result, never a new evaluation. */
export function requireRetainedAnalysis(plan:ExecutionPlan,state:RetentionState,value:unknown,now=Date.now()){
 const analysis=nativeAnalysisSchema.parse(value);
 if(analysis.decision!=='retain'||analysis.experiment!==plan.experiment||analysis.planHash!==canonicalHash(plan)||
  state.experiment!==plan.experiment||state.planHash!==canonicalHash(plan)||!state.testCleanupComplete||Date.parse(analysis.observedAt)>now||
  analysis.arms.some(a=>!state.testAds.some(t=>t.ad===a.ad&&t.arm===a.arm))||
  Date.parse(analysis.observedAt)<(plan.end+72*3600)*1000)throw new Error('Retention decision differs');
 return analysis;
}

export const retentionReadbackSchema=z.object({id,account_id:id,campaign_id:id,adset_id:id,status:z.enum(['ACTIVE','PAUSED']),
 creative:z.object({id}).strict(),tracking_specs:z.unknown(),
 // Require an explicit returned absence. An omitted field is unknown; a future
 // provider mapping requires real evidence, not a fixture-driven relaxation.
 ad_schedule_start_time:z.null(),ad_schedule_end_time:z.null(),
}).strict();
export function verifyRetainedAd(plan:ExecutionPlan,value:unknown,expected:{ad:string;creative:string;status:'ACTIVE'|'PAUSED'}){
 const row=retentionReadbackSchema.parse(value);
 if(row.id!==expected.ad||row.creative.id!==expected.creative||row.status!==expected.status||plan.originalAds.includes(row.id)||
  row.account_id!==plan.scope.account||row.campaign_id!==plan.scope.campaign||row.adset_id!==plan.scope.adset||
  canonicalHash(row.tracking_specs)!==canonicalHash(plan.adTracking))throw new Error('Retained ad differs');
 return canonicalHash(row);
}

export const retentionProofSchema=z.object({version:z.literal(1),planHash:hash,analysisCommand:z.uuid(),observedAt:stamp,
 study:id,studyEnd:z.number().int().positive(),studyObservationEnd:z.number().int().positive(),studyProof:hash,
 acceptance:z.uuid(),originalsHash:hash,budgetHash:hash,settingsHash:hash,creativeHash:hash,
 testAds:z.array(z.object({arm:z.enum(['control','challenger']),ad:id,creative:id,status:z.literal('PAUSED'),proof:hash}).strict()).length(2),otherBaselines:z.array(retainedAdSchema.extend({proof:hash})).max(3),
 candidate:z.object({ad:id,proof:hash}).strict().nullable(),previous:z.object({ad:id,status:z.enum(['ACTIVE','PAUSED']),proof:hash}).strict().nullable(),
}).strict();

export function requireRetentionProof(plan:ExecutionPlan,state:RetentionState,value:unknown,acceptance:string,now=Date.now()){
 const proof=retentionProofSchema.parse(value),age=now-Date.parse(proof.observedAt);
 const originals=canonicalHash([...plan.originalAds].sort().map(id=>({id,status:'ACTIVE',page:plan.scope.page})));
 const budget=canonicalHash({account:plan.scope.account,campaign:plan.scope.campaign,adset:plan.scope.adset,currency:plan.currency,
  timezone:plan.timezone,campaignDailyMinor:plan.dailyMinor,adsetDailyMinor:0,lifetimeMinor:0,bid:'LOWEST_COST_WITHOUT_CAP'});
 if(age<0||age>60000||proof.planHash!==state.planHash||proof.planHash!==canonicalHash(plan)||proof.analysisCommand!==state.analysisCommand||
  proof.study!==state.study||proof.studyEnd!==plan.end||proof.studyObservationEnd!==plan.end||proof.studyEnd*1000>now||
  proof.acceptance!==acceptance||proof.originalsHash!==originals||proof.budgetHash!==budget||proof.settingsHash!==plan.preStateHash||
  proof.creativeHash!==canonicalHash(creativeWithPrimary(plan.control,state.creative,plan.challengerPrimary,plan.ownerReview?.edit))||
  (proof.candidate?.ad??null)!==state.ad||(proof.previous?.ad??null)!==(state.previous?.ad??null))throw new Error('Retention proof differs');
 const previousPaused=state.effects.some(e=>e.kind==='pause_previous'&&e.state==='confirmed')&&!state.effects.some(e=>e.kind==='restore_previous'&&e.state==='confirmed');
 if(!state.testCleanupComplete||new Set(proof.testAds.map(a=>a.arm)).size!==2||proof.testAds.some(a=>!state.testAds.some(t=>t.arm===a.arm&&t.ad===a.ad)||a.creative!==(a.arm==='control'?plan.control.id:state.creative))||
  canonicalHash(proof.otherBaselines.map(({proof:_,...ref})=>{void _;return ref;}).sort((a,b)=>a.donor.localeCompare(b.donor)))!==canonicalHash([...state.otherBaselines].sort((a,b)=>a.donor.localeCompare(b.donor))))throw new Error('Retained serving inventory differs');
 if(proof.previous&&proof.previous.status!==(previousPaused?'PAUSED':'ACTIVE'))throw new Error('Previous retained status differs');
 return proof;
}
