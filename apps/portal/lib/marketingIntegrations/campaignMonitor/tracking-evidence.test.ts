import {expect,it} from 'vitest';
import {executionPlanSchema,trackingDottedKeys} from '../../../../marketing/lib/creative-executor/contract';
import {trackingEvidenceSchema} from './contract';
import {projectTrackingEvidence} from './tracking-evidence';
const depth=(n:number)=>{let value:unknown=null;for(let i=0;i<n;i++)value={a:value};return value;};
const nodes=(last:number)=>[...Array.from({length:16},()=>Array.from({length:30},()=>null)),Array.from({length:last},()=>null)];
const keys=(n:number)=>Object.fromEntries(Array.from({length:n},(_,i)=>['k'+i,null]));
const byteBoundary=['a'.repeat(1998),'b'.repeat(1996),'c'.repeat(1996)];
const vectors:unknown[]=[...trackingDottedKeys.flatMap(key=>[[{[key]:['synthetic']}],{[key]:['synthetic']},[{nested:{[key]:['synthetic']}}],[{[key.toUpperCase()]:['synthetic']}]]),null,true,false,0,12,'',[],{},[{fb_pixel:['123456'],action_type:['offsite_conversion']}],
 depth(8),depth(9),nodes(2),nodes(3),keys(40),keys(41),Array(30).fill(null),Array(31).fill(null),
 'a'.repeat(2000),'a'.repeat(2001),'😀'.repeat(1000),'😀'.repeat(1001),'µ'.repeat(2000),'字'.repeat(2000),byteBoundary,[...byteBoundary.slice(0,2),byteBoundary[2]+'c'],
 {['k'.repeat(80)]:1},{['k'.repeat(81)]:1},[{['action.type']:['offsite_conversion']}],{'action.type':['offsite_conversion']},[{nested:{'action.type':['offsite_conversion']}}],[[{'action.type':['offsite_conversion']}]],[{'private-secret-key':'private-secret-value'}],JSON.parse('{"__proto__":{"private":"private-secret-value"}}'),{constructor:1},{prototype:1},{access_token:'private-secret-value'},{appsecret_proof:'private-secret-value'},'before\u0000after','allowed\nnewline',undefined,NaN,Infinity];

it.each(vectors.map((value,index)=>({value,index})))('matches the actual Source adTracking validator for synthetic vector $index',({value})=>{
 const report=projectTrackingEvidence(value,true),valid=executionPlanSchema.shape.adTracking.safeParse(value).success;
 expect(report.status==='observed'&&report.scanComplete&&report.violations.length===0).toBe(valid);
 expect(trackingEvidenceSchema.safeParse(report).success).toBe(true);
 expect(JSON.stringify(report)).not.toMatch(/private|offsite_conversion|fb_pixel|action\.type|access_token|appsecret_proof/);
});
it('keeps exact UTF-8 JSON byte, UTF-16 string, root-zero depth and value-node units',()=>{
 expect(Buffer.byteLength(JSON.stringify(byteBoundary))).toBe(6000);
 expect(projectTrackingEvidence(byteBoundary,true)).toMatchObject({utf8Bytes:6000,violations:[],scanComplete:true});
 expect(projectTrackingEvidence('😀'.repeat(1000),true)).toMatchObject({utf8Bytes:4002,violations:[]});
 expect(projectTrackingEvidence('😀'.repeat(1001),true)).toMatchObject({violations:['string_length']});
 expect(projectTrackingEvidence(nodes(2),true)).toMatchObject({nodes:500,depth:2,scanComplete:true,violations:[]});
 expect(projectTrackingEvidence(nodes(3),true)).toMatchObject({nodes:501,depth:2,scanComplete:false,violations:['nodes'],actionTypeKey:null});
 expect(projectTrackingEvidence(depth(8),true)).toMatchObject({depth:8,violations:[]});
 expect(projectTrackingEvidence(depth(9),true)).toMatchObject({depth:9,scanComplete:false,violations:['depth']});
 expect(projectTrackingEvidence('字'.repeat(2000),true)).toMatchObject({utf8Bytes:6001,violations:['bytes']});
});
it('records only a compiled known-key presence and never claims unseen keys absent after a cap',()=>{
 expect(projectTrackingEvidence([{'action.type':['offsite_conversion']}],true)).toMatchObject({actionTypeKey:true,violations:[]});
 expect(projectTrackingEvidence(Array(31).fill({'action.type':['offsite_conversion']}),true)).toMatchObject({actionTypeKey:null,scanComplete:false,violations:['array_length']});
 expect(projectTrackingEvidence([{}],true)).toMatchObject({actionTypeKey:false});
});
it('keeps missing/unavailable distinct from empty or zero and never exposes local failure text',()=>{
 expect(projectTrackingEvidence(undefined,false)).toEqual({version:1,status:'missing'});
 const cyclic:Record<string,unknown>={};cyclic.self=cyclic;
 expect(projectTrackingEvidence(cyclic,true)).toEqual({version:1,status:'unavailable'});
 expect(projectTrackingEvidence(new Proxy({},{ownKeys(){throw Error('private-secret-value');}}),true)).toEqual({version:1,status:'unavailable'});
 expect(projectTrackingEvidence([],true)).toMatchObject({status:'observed',type:'array',nodes:1,depth:0,utf8Bytes:2,violations:[]});
 expect(trackingEvidenceSchema.safeParse({...projectTrackingEvidence([],true),private:'secret'}).success).toBe(false);
});

it('observes without changing the original tracking value',()=>{
 const original=[{'action.type':['offsite_conversion'],fb_pixel:['123456']}],before=JSON.stringify(original);
 Object.freeze(original[0]!['action.type']);Object.freeze(original[0]!.fb_pixel);Object.freeze(original[0]);Object.freeze(original);
 expect(projectTrackingEvidence(original,true)).toMatchObject({violations:[]});expect(JSON.stringify(original)).toBe(before);
});
