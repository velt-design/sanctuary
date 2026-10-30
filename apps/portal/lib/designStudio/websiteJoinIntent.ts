import type {PergolaInteractionEdgeId} from '@sp/geometry';
export type WebsiteJoin={id:string;a:{objectId:string;edge:PergolaInteractionEdgeId};b:{objectId:string;edge:PergolaInteractionEdgeId};alignment:'start'|'centre'|'end'};
export type WebsiteJoins={schemaVersion:'studio_website_joins.v1';joins:WebsiteJoin[]};
const edges=['front','rear','left','right'];
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)));
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=160&&v.trim()===v;
export function parseWebsiteJoins(value:unknown,membership?:ReadonlySet<string>):WebsiteJoins{
 if(!exact(value,['schemaVersion','joins'])||value.schemaVersion!=='studio_website_joins.v1'||!Array.isArray(value.joins)||value.joins.length>64)throw Error('Invalid pergola join collection.');
 const ids=new Set<string>(),pairs=new Set<string>();
 for(const row of value.joins){
  if(!exact(row,['id','a','b','alignment'])||!id(row.id)||ids.has(row.id)||typeof row.alignment!=='string'||!['start','centre','end'].includes(row.alignment))throw Error('Invalid pergola join identity.');
  for(const side of [row.a,row.b])if(!exact(side,['objectId','edge'])||!id(side.objectId)||typeof side.edge!=='string'||!edges.includes(side.edge)||(membership&&!membership.has(side.objectId)))throw Error('A join must name an existing website pergola and edge.');
  const a=row.a as WebsiteJoin['a'],b=row.b as WebsiteJoin['b'];if(a.objectId===b.objectId)throw Error('A pergola cannot join itself.');
  const key=JSON.stringify([a.objectId,b.objectId].sort());if(pairs.has(key))throw Error('These pergolas already have a join.');pairs.add(key);ids.add(row.id);
 }
 return structuredClone(value) as WebsiteJoins;
}
