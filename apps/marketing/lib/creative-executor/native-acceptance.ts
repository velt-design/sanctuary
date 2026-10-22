import {z} from 'zod';
import type {ExecutionPlan} from './contract';
const id=z.string().regex(/^[1-9]\d{0,19}$/),hash=z.string().regex(/^[a-f0-9]{64}$/),stamp=z.iso.datetime({offset:true});
export const nativeAcceptanceSemantics=z.object({currency:z.literal('NZD'),timezone:z.literal('Pacific/Auckland'),budgetOwner:z.literal('campaign'),dailyMinor:z.literal(40000),studyDailyMinor:z.literal(8000),uiStudyDaily:z.literal(80),offset:z.literal(100),allocation:z.literal('existing_campaign_portion'),experimentalUnit:z.literal('SPLIT_TEST_V2_ad_cells'),topology:z.literal('same_original_adset'),objective:z.literal('CONVERSIONS'),event:z.literal('Lead'),isPrimary:z.literal(true)}).strict();
export const nativeAcceptanceSchema=z.object({version:z.literal(1),id:z.uuid(),scope:z.object({app:id,principal:id,business:id,account:id,page:id,campaign:id,adset:id}).strict(),originalAds:z.array(id).length(4).refine(v=>new Set(v).size===4),nativeContractHash:hash,pixel:id,semantics:nativeAcceptanceSemantics,exampleExperiment:z.uuid(),exampleStudy:id,exampleCells:z.array(z.object({id,ad:id,arm:z.enum(['control','challenger'])}).strict()).length(2).refine(v=>new Set(v.map(c=>c.id)).size===2&&new Set(v.map(c=>c.ad)).size===2&&new Set(v.map(c=>c.arm)).size===2),unitProofHash:hash,allocationProofHash:hash,originalsProofHash:hash,objectiveProofHash:hash,observedAt:stamp,recordedAt:stamp,provenance:z.literal('hosted_paused_study_and_native_ui'),evidenceHash:hash}).strict().refine(v=>Date.parse(v.observedAt)<=Date.parse(v.recordedAt));
/** Source-owned actual-account proof, not a caller/model readiness boolean.
 * Read from the authenticated source each time; a cached receipt cannot establish
 * that it is still unrevoked. Per-study readback remains a separate requirement. */
export function requireNativeAcceptance(plan:ExecutionPlan,input:unknown,now=Date.now()){
 const proof=nativeAcceptanceSchema.parse(input);
 if(plan.purpose!=='formal_experiment'||proof.nativeContractHash!==plan.nativeContractHash||
  Object.keys(proof.scope).some(k=>proof.scope[k as keyof typeof proof.scope]!==plan.scope[k as keyof typeof plan.scope])||
  proof.originalAds.some(ad=>!plan.originalAds.includes(ad))||proof.pixel!==plan.nativeObjective.adspixels[0]!.id||
  proof.semantics.dailyMinor!==plan.dailyMinor||proof.semantics.studyDailyMinor!==plan.studyDailyMinor||Date.parse(proof.recordedAt)>now||Date.parse(proof.observedAt)>now)throw new Error('Native account proof differs');
 return proof;
}
