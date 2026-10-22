import {z} from 'zod';
import {exactRateRatio} from './rate-ratio';

export const AMBIGUITY_POLICY='finite_allocation_envelope_v1' as const;
export const AMBIGUITY_PROTOCOL='native-saved-enquiry-per-dollar-v2' as const;
const count=z.number().int().min(0).max(2000);
const arm=z.object({enquiries:count,spend:z.number().finite().nonnegative().max(1000000).nullable(),assessable:count,unsuitable:count,adverse:z.boolean()}).strict()
 .refine(a=>a.unsuitable<=a.assessable&&a.assessable<=a.enquiries);
export const sensitivitySchema=z.object({pool:count,joinConflicts:count,qualityEvidenceComplete:z.boolean(),unassignedAdverse:count}).strict().refine(s=>s.unassignedAdverse<=s.pool);
export const sensitivityInputSchema=z.object({control:arm,challenger:arm,sensitivity:sensitivitySchema}).strict().refine(v=>v.control.enquiries+v.challenger.enquiries+v.sensitivity.pool<=2000);
export type SensitivityInput=z.infer<typeof sensitivityInputSchema>;

/** All unassigned records may be control, challenger, or outside. Endpoints
 * bound those allocations; no unknown record is actually assigned to an arm. */
export function ambiguityEnvelope(value:SensitivityInput){
 const {control:c,challenger:t,sensitivity:s}=sensitivityInputSchema.parse(value);
 if(c.spend===null||t.spend===null||c.spend===0||t.spend===0)return null;
 const low=exactRateRatio({enquiries:c.enquiries+s.pool,spend:c.spend},{enquiries:t.enquiries,spend:t.spend});
 const high=exactRateRatio({enquiries:c.enquiries,spend:c.spend},{enquiries:t.enquiries+s.pool,spend:t.spend});
 return low&&high?{lower:low.lower,upper:high.upper,upperUnbounded:high.upperUnbounded}:null;
}

/** O(U), at most2001 checks. Hypothetical assessment is never credited as
 * observed evidence. With zero control concerns and U>0 retention cannot pass. */
export function ambiguityQuality(value:SensitivityInput){
 const {control:c,challenger:t,sensitivity:s}=sensitivityInputSchema.parse(value);
 if(!s.qualityEvidenceComplete||s.unassignedAdverse||c.adverse||t.adverse||c.assessable<5||t.assessable<5)return false;
 for(let k=0;k<=s.pool;k++){
  const other=s.pool-k,dc=c.enquiries+k,dt=t.enquiries+other;
  // Integer cross-products give exactly the declared 1/2 coverage and 1/5
  // gap thresholds in both runtimes, without a floating-point boundary drift.
  if(2*c.assessable<dc||2*t.assessable<dt||
   5*((c.assessable+k)*dt-t.assessable*dc)>dc*dt||5*((t.assessable+other)*dc-c.assessable*dt)>dc*dt||
   (t.unsuitable+other)*(c.assessable+k)>c.unsuitable*(t.assessable+other))return false;
 }
 return true;
}

export function evaluateAmbiguity(value:SensitivityInput,eligible:boolean){
 const input=sensitivityInputSchema.parse(value),{control:c,challenger:t,sensitivity:s}=input;
 const quality=ambiguityQuality(input)?'passes' as const:'unknown_or_fails' as const;
 const base={policy:AMBIGUITY_PROTOCOL,controlCpe:c.enquiries&&c.spend!==null?c.spend/c.enquiries:null,challengerCpe:t.enquiries&&t.spend!==null?t.spend/t.enquiries:null,
  cpeMeaning:'consented_attributable_saved_enquiries_only' as const,quality};
 if(c.spend===0||t.spend===0)return{...base,decision:'inconclusive' as const,reason:'no_delivery' as const,interval:null};
 if(!eligible||s.joinConflicts||c.spend===null||t.spend===null)return{...base,decision:'inconclusive' as const,reason:'evidence_incomplete' as const,interval:null};
 const interval=ambiguityEnvelope(input);
 const decision=interval&&interval.upper!==null&&interval.upper<1?'revert' as const:interval&&interval.lower>1&&quality==='passes'?'retain' as const:'inconclusive' as const;
 return{...base,decision,reason:interval?'formal_interval' as const:'no_enquiries' as const,interval};
}
