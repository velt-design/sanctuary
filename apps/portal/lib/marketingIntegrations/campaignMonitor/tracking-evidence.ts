import {trackingEvidenceSchema,trackingRules,type TrackingEvidence} from './contract';

/** Observe the then-current adTracking rules without accepting/editing tracking.
 * Raw provider data stays in this call. Work stops at501values/root-depth9; skipped
 * descendants make the scan incomplete, never evidence that an unseen key is absent. */
const trackingDottedKeys=['action.type','event.creator','object.domain','offer.creator','page.parent','post.object','post.object.wall','post.wall','question.creator'] as const;
export function projectTrackingEvidence(value:unknown,present:boolean):TrackingEvidence {
 if(!present)return {version:1,status:'missing'};
 try {
  const violations=new Set<typeof trackingRules[number]>();let nodes=0,depth=0,scanComplete=true,actionTypeKey=false;
  const visit=(item:unknown,level:number):void=>{
   if(nodes>=501){scanComplete=false;return;}nodes++;depth=Math.max(depth,Math.min(level,9));
   if(nodes>500){violations.add('nodes');scanComplete=false;return;}
   if(level>8){violations.add('depth');scanComplete=false;return;}
   if(item===null||typeof item==='boolean')return;
   if(typeof item==='number'){if(!Number.isFinite(item))violations.add('non_json');return;}
   if(typeof item==='string'){
    if(item.length>2000)violations.add('string_length');
    if(Array.from(item).some(char=>char.charCodeAt(0)<=8))violations.add('control_character');return;
   }
   if(Array.isArray(item)){
    if(item.length>30){violations.add('array_length');scanComplete=false;return;}
    item.forEach(child=>visit(child,level+1));return;
   }
   if(!item||typeof item!=='object'){violations.add('non_json');return;}
   const entries=Object.entries(item);
   if(entries.length>40){violations.add('object_keys');scanComplete=false;return;}
   for(const [key,child] of entries){
    if(key==='action.type')actionTypeKey=true;
    if(!/^[a-zA-Z0-9_]{1,80}$/.test(key)&&!(Array.isArray(value)&&level===1&&trackingDottedKeys.includes(key as typeof trackingDottedKeys[number])))violations.add('key_syntax');
    if(['__proto__','constructor','prototype','access_token','appsecret_proof'].includes(key))violations.add('reserved_key');
    visit(child,level+1);
   }
  };
  visit(value,0);
  const serialized=JSON.stringify(value);if(typeof serialized!=='string')return {version:1,status:'unavailable'};
  const bytes=Buffer.byteLength(serialized);if(bytes>6000)violations.add('bytes');
  const type=value===null?'null':Array.isArray(value)?'array':typeof value;
  return trackingEvidenceSchema.parse({version:1,status:'observed',type:['boolean','number','string','array','object','null'].includes(type)?type:'unsupported',
   utf8Bytes:Math.min(bytes,6001),nodes,depth,scanComplete,violations:trackingRules.filter(rule=>violations.has(rule)),actionTypeKey:actionTypeKey?true:scanComplete?false:null});
 }catch{return {version:1,status:'unavailable'};}
}
