import {z} from 'zod';
import {AMBIGUITY_PROTOCOL,evaluateAmbiguity,sensitivitySchema} from './ambiguity';
const hash=z.string().regex(/^[a-f0-9]{64}$/),stamp=z.string().datetime({offset:true}),count=z.number().int().min(0).max(2000);
const arm=z.object({arm:z.enum(['control','challenger']),ad:z.string().regex(/^[1-9]\d{0,19}$/),enquiries:count,spend:z.number().finite().nonnegative().max(1000000).nullable(),canonical:count,correspondence:count,intake:count,assessed:count,concerns:count,conflicting:count,unknown:count}).strict().refine(a=>a.assessed===a.canonical+a.correspondence+a.intake&&a.unknown===a.enquiries-a.assessed&&a.concerns<=a.assessed&&a.conflicting<=a.unknown);
export const nativeAnalysisV1Schema=z.object({version:z.literal(1),experiment:z.string().uuid(),planHash:hash,policy:z.literal('native-saved-enquiry-per-dollar-v1'),observedAt:stamp,
 cohortHash:hash,spendHash:hash,deliveryHash:hash,sourceDates:z.object({cohort:stamp,spend:stamp,delivery:stamp}).strict(),allSavedCoverage:z.enum(['complete','unknown']),
 coverageCounts:z.object({websiteGenuine:count,nativeMatched:count,knownOtherRegistered:count,unknownAttribution:count,unlinkedNative:count}).strict(),unresolvedLate:count,
 arms:z.array(arm).length(2),decision:z.enum(['retain','revert','inconclusive']),reason:z.enum(['formal_interval','no_enquiries','no_delivery','evidence_incomplete']),
 interval:z.object({lower:z.number().finite().nonnegative(),upper:z.number().finite().nonnegative().nullable(),upperUnbounded:z.boolean()}).strict().nullable(),quality:z.enum(['passes','unknown_or_fails']),
}).strict().superRefine((a,c)=>{
 const control=a.arms.find(v=>v.arm==='control'),challenger=a.arms.find(v=>v.arm==='challenger');
 if(!control||!challenger||control.ad===challenger.ad||a.coverageCounts.nativeMatched!==a.arms.reduce((n,v)=>n+v.enquiries,0)||a.coverageCounts.websiteGenuine!==a.coverageCounts.nativeMatched+a.coverageCounts.knownOtherRegistered+a.coverageCounts.unknownAttribution+a.unresolvedLate||a.allSavedCoverage!==(a.coverageCounts.unknownAttribution===0&&a.unresolvedLate===0?'complete':'unknown')){c.addIssue({code:'custom',message:'Native analysis coverage differs'});return;}
 if(a.interval&&(a.interval.upperUnbounded!==(a.interval.upper===null)||a.interval.upper!==null&&a.interval.upper<a.interval.lower))c.addIssue({code:'custom',message:'Native interval differs'});
 if(a.decision!=='inconclusive'&&(a.reason!=='formal_interval'||a.allSavedCoverage!=='complete'||!control.spend||!challenger.spend||!a.interval))c.addIssue({code:'custom',message:'Native decision lacks evidence'});
 if(a.decision==='retain'&&(a.quality!=='passes'||!(a.interval&&a.interval.lower>1)||a.arms.some(v=>v.assessed<5||v.assessed/v.enquiries<.5)||Math.abs(control.assessed/control.enquiries-challenger.assessed/challenger.enquiries)>.2+Number.EPSILON||challenger.concerns/challenger.assessed>control.concerns/control.assessed||challenger.conflicting>0))c.addIssue({code:'custom',message:'Native retention guard differs'});
 if(a.decision==='revert'&&!(a.interval&&a.interval.upper!==null&&a.interval.upper<1))c.addIssue({code:'custom',message:'Native harm interval differs'});
});
export const nativeAnalysisV2Schema=z.object({...nativeAnalysisV1Schema.shape,version:z.literal(2),policy:z.literal(AMBIGUITY_PROTOCOL),qualityHash:hash,sensitivity:sensitivitySchema}).strict().superRefine((a,c)=>{
 const {sensitivity,qualityHash:_,...legacy}=a;void _;
 if(!nativeAnalysisV1Schema.safeParse({...legacy,version:1,policy:'native-saved-enquiry-per-dollar-v1',decision:'inconclusive'}).success||
  sensitivity.pool!==a.coverageCounts.unknownAttribution+a.unresolvedLate){c.addIssue({code:'custom',message:'Sensitivity coverage differs'});return;}
 const control=a.arms.find(v=>v.arm==='control')!,challenger=a.arms.find(v=>v.arm==='challenger')!;
 const convert=(v:typeof control)=>({enquiries:v.enquiries,spend:v.spend,assessable:v.assessed,unsuitable:v.concerns,adverse:v.conflicting>0});
 const expected=evaluateAmbiguity({control:convert(control),challenger:convert(challenger),sensitivity},a.reason!=='evidence_incomplete');
 // PostgreSQL and JS use the same inversion but may differ at the final ulp.
 // Decision direction still comes from our computed endpoints, never rounded input.
 const close=(x:number,y:number)=>Math.abs(x-y)<=1e-9*Math.max(1,x);
 const intervalMatches=expected.interval&&a.interval?expected.interval.upperUnbounded===a.interval.upperUnbounded&&close(expected.interval.lower,a.interval.lower)&&
  (expected.interval.upper===null?a.interval.upper===null:a.interval.upper!==null&&close(expected.interval.upper,a.interval.upper)):expected.interval===a.interval;
 if(expected.decision!==a.decision||expected.reason!==a.reason||expected.quality!==a.quality||!intervalMatches)c.addIssue({code:'custom',message:'Sensitivity result differs'});
});
// Historical receipts retain their declared policy. New writes are additionally
// bound to the immutable plan and frozen source cohort at source admission.
export const nativeAnalysisSchema=z.union([nativeAnalysisV1Schema,nativeAnalysisV2Schema]);
export type NativeAnalysis=z.infer<typeof nativeAnalysisSchema>;

export const nativeDeliverySchema=z.object({windowComplete:z.boolean(),experiment:z.string().uuid(),planHash:hash,study:z.string().regex(/^[1-9]\d{0,19}$/),objectiveProof:hash,allocationProof:hash,verifiedAt:stamp,startsAt:stamp,endsAt:stamp,arms:z.array(z.object({arm:z.enum(['control','challenger']),ad:z.string().regex(/^[1-9]\d{0,19}$/),scheduledStart:stamp,scheduledEnd:stamp}).strict()).length(2)}).strict().refine(v=>new Set(v.arms.map(a=>a.arm)).size===2&&new Set(v.arms.map(a=>a.ad)).size===2);
