// Synthetic cross-runtime receipts only. Called by the disposable PG harness.
import {readFileSync} from 'node:fs';
import {evaluateAmbiguity,type SensitivityInput} from '../apps/marketing/lib/creative-executor/ambiguity';
import {nativeAnalysisSchema} from '../apps/marketing/lib/creative-executor/analysis-contract';
const cases:unknown[]=[];
function add(c:number,t:number,u:number,sc:number|null,st:number|null,change:Partial<SensitivityInput['sensitivity']>={},eligible=true,ac=c,at=t,bc=Math.min(c,5),bt=0){
 const input={control:{enquiries:c,spend:sc,assessable:ac,unsuitable:bc,adverse:false},challenger:{enquiries:t,spend:st,assessable:at,unsuitable:bt,adverse:false},sensitivity:{pool:u,joinConflicts:0,qualityEvidenceComplete:true,unassignedAdverse:0,...change}},r=evaluateAmbiguity(input,eligible);
 const a=nativeAnalysisSchema.parse({version:2,experiment:'e6000000-0000-4000-8000-000000000001',planHash:'a'.repeat(64),policy:r.policy,observedAt:'2026-10-20T00:00:00Z',cohortHash:'b'.repeat(64),spendHash:'c'.repeat(64),deliveryHash:'d'.repeat(64),qualityHash:'e'.repeat(64),sourceDates:{cohort:'2026-10-20T00:00:00Z',spend:'2026-10-20T00:00:00Z',delivery:'2026-10-01T00:00:00Z'},allSavedCoverage:u?'unknown':'complete',coverageCounts:{websiteGenuine:c+t+u,nativeMatched:c+t,knownOtherRegistered:0,unknownAttribution:u,unlinkedNative:0},unresolvedLate:0,arms:[{arm:'control',ad:'8201',enquiries:c,spend:sc,canonical:ac,correspondence:0,intake:0,assessed:ac,concerns:bc,conflicting:0,unknown:c-ac},{arm:'challenger',ad:'8202',enquiries:t,spend:st,canonical:at,correspondence:0,intake:0,assessed:at,concerns:bt,conflicting:0,unknown:t-at}],decision:r.decision,reason:r.reason,interval:r.interval,quality:r.quality,sensitivity:input.sensitivity});cases.push(a);
}
for(let c=0;c<=4;c++)for(let t=0;t<=4;t++)for(let u=0;u<=5;u++)for(const[sc,st]of[[1,5],[10,2],[1,1]])add(c,t,u,sc,st);
for(let u=0;u<=4;u++)for(const[ec,ac,bc,et,at,bt]of[[10,8,3,10,8,0],[10,5,1,10,5,0],[10,8,0,10,8,0],[6,6,3,8,6,1],[20,10,5,10,8,0]])add(ec,et,u,100,100,{},true,ac,at,bc,bt);
add(20,80,1,100,100);add(20,80,1,100,100,{unassignedAdverse:1});add(20,80,1,100,100,{joinConflicts:1});add(20,80,1,100,100,{qualityEvidenceComplete:false});add(20,80,1,100,100,{},false);add(4,1,1,1,10000);add(4,1,1,null,100);add(4,1,1,0,100);add(500,500,1000,100,100);add(1999,1,0,1,1000000);
const data=JSON.parse(readFileSync(0,'utf8')||'{}');if(Object.keys(data).length!==6)throw Error('Native cohort fixtures missing');
process.stdout.write(JSON.stringify(cases));
