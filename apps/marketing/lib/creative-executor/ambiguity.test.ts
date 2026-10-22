import {describe,it,expect} from 'vitest';
import {ambiguityEnvelope,ambiguityQuality,evaluateAmbiguity,type SensitivityInput} from './ambiguity';
import {exactRateRatio} from './rate-ratio';
const input=(c=20,t=80,u=1):SensitivityInput=>({control:{enquiries:c,spend:100,assessable:c,unsuitable:Math.min(5,c),adverse:false},challenger:{enquiries:t,spend:100,assessable:t,unsuitable:0,adverse:false},sensitivity:{pool:u,joinConflicts:0,qualityEvidenceComplete:true,unassignedAdverse:0}});
describe('finite recorded ambiguity, without invented attribution',()=>{
 it('can retain only a robust interval with robust observed quality',()=>{
  expect(evaluateAmbiguity(input(),true)).toMatchObject({decision:'retain',quality:'passes',cpeMeaning:'consented_attributable_saved_enquiries_only'});
  const zeroConcerns=input();zeroConcerns.control.unsuitable=0;expect(evaluateAmbiguity(zeroConcerns,true).decision).toBe('inconclusive');
  zeroConcerns.sensitivity.pool=0;expect(evaluateAmbiguity(zeroConcerns,true).decision).toBe('retain');
 });
 it('permits a robust loss despite finite uncertainty and unavailable quality',()=>{const v=input(4,1,1);v.control.spend=1;v.challenger.spend=10000;v.sensitivity.qualityEvidenceComplete=false;expect(evaluateAmbiguity(v,true)).toMatchObject({decision:'revert',quality:'unknown_or_fails'});});
 it.each(['joinConflicts','unassignedAdverse','qualityEvidenceComplete','eligible'] as const)('withholds a winner on %s',field=>{const v=input();if(field==='qualityEvidenceComplete')v.sensitivity[field]=false;else if(field!=='eligible')v.sensitivity[field]=1;expect(evaluateAmbiguity(v,field!=='eligible').decision).toBe('inconclusive');});
 it('preserves known zero, missing spend, and no enquiries',()=>{
  const v=input(0,0,0);expect(evaluateAmbiguity(v,true).reason).toBe('no_enquiries');
  v.control.spend=0;expect(evaluateAmbiguity(v,true).reason).toBe('no_delivery');v.control.spend=null;expect(evaluateAmbiguity(v,true).reason).toBe('evidence_incomplete');
  v.control.spend=100;v.sensitivity.pool=1;expect(evaluateAmbiguity(v,true)).toMatchObject({decision:'inconclusive',interval:{lower:0,upper:null,upperUnbounded:true}});
 });
 it.each([null,undefined,-1,2001,Infinity,NaN])('rejects absent/unbounded pool %s',pool=>{const v=input();v.sensitivity.pool=pool as number;expect(()=>evaluateAmbiguity(v,true)).toThrow();});
 it('denies whole-cohort overflow and incomplete/conflicting quality',()=>{expect(()=>evaluateAmbiguity(input(1000,1000,1),true)).toThrow();const v=input();v.control.adverse=true;expect(ambiguityQuality(v)).toBe(false);v.control.adverse=false;v.challenger.assessable=4;expect(ambiguityQuality(v)).toBe(false);});
 it('envelopes all4200 small allocations including outcomes outside the test',()=>{let cases=0;
  for(let c=0;c<=4;c++)for(let t=0;t<=4;t++)for(let u=0;u<=5;u++)for(const [sc,st]of[[1,5],[10,2],[1,1]]){
   const v=input(c,t,u);v.control.spend=sc!;v.challenger.spend=st!;const bound=ambiguityEnvelope(v),lo=bound?.lower??0,hi=bound?.upper??Infinity;
   for(let a=0;a<=u;a++)for(let b=0;b<=u-a;b++){const r=exactRateRatio({enquiries:c+a,spend:sc!},{enquiries:t+b,spend:st!});expect(lo).toBeLessThanOrEqual((r?.lower??0)+1e-10);expect(hi+1e-10).toBeGreaterThanOrEqual(r?.upper??Infinity);cases++;}
  }expect(cases).toBe(4200);
 });
 it('O(U) quality checks match exhaustive allocations and unknown classifications',()=>{
  const pass=(ec:number,ac:number,bc:number,et:number,at:number,bt:number)=>ac/ec>=.5&&at/et>=.5&&Math.abs(ac/ec-at/et)<=.2+1e-12&&bt/at<=bc/ac+1e-12;
  for(const [ec,ac,bc,et,at,bt]of[[10,8,3,10,8,0],[10,5,1,10,5,0],[10,8,0,10,8,0],[6,6,3,8,6,1],[20,10,5,10,8,0]])for(let u=0;u<=4;u++){
   const v=input(ec,et,u);Object.assign(v.control,{assessable:ac,unsuitable:bc});Object.assign(v.challenger,{assessable:at,unsuitable:bt});
   let all=true;for(let a=0;a<=u;a++)for(let b=0;b<=u-a;b++)for(let x=0;x<=a;x++)for(let y=0;y<=b;y++)for(let badc=0;badc<=x;badc++)for(let badt=0;badt<=y;badt++)all&&=pass(ec!+a,ac!+x,bc!+badc,et!+b,at!+y,bt!+badt);
   expect(ambiguityQuality(v)).toBe(all);
  }
 });
 it('remains bounded at2000 recorded enquiries',()=>{const v=input(500,500,1000);expect(evaluateAmbiguity(v,true).decision).toBe('inconclusive');});
});
