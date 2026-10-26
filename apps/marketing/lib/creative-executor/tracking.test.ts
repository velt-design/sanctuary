import {expect,it} from 'vitest';
import {canonicalHash,executionPlanSchema,storyVideoCreativeSchema,videoCreativeSchema,trackingDottedKeys} from './contract';
const tracking=executionPlanSchema.shape.adTracking,generic=videoCreativeSchema.shape.payload.shape.asset_feed_spec;
const valid=[{'action.type':['SYNTHETIC_ACTION'],fb_pixel:['777']}];
const depth=(n:number)=>{let v:unknown=null;for(let i=0;i<n;i++)v={safe:v};return v;};
const nodes=(n:number)=>[...Array.from({length:16},()=>Array(30).fill(null)),Array(n).fill(null)];
it('accepts only the literal protocol key on direct object clauses of a root tracking array without changing data',()=>{
 const before=structuredClone(valid),parsed=tracking.parse(valid);expect(parsed).toEqual(before);expect(valid).toEqual(before);
 expect(canonicalHash(parsed)).toBe(canonicalHash(before));expect(canonicalHash(parsed)).not.toBe(canonicalHash([{action_type:['SYNTHETIC_ACTION'],fb_pixel:['777']}]));
 for(const value of [null,[],{},[{action_type:['SYNTHETIC_ACTION']}],depth(8),nodes(2),'😀'.repeat(1000),['a'.repeat(1998),'b'.repeat(1996),'c'.repeat(1996)]])expect(tracking.safeParse(value).success).toBe(generic.safeParse(value).success);
});
it.each(['action.other','Action.type','action.Type','action.type.extra',' action.type','action.type ','action.\u200btype','event.unknown','page.unknown'])('rejects every unapproved dotted/case/modified key %s',key=>{
 expect(tracking.safeParse([{[key]:['SYNTHETIC_ACTION']}]).success).toBe(false);
});
it.each([{'action.type':[]},{safe:{'action.type':[]}},[{safe:{'action.type':[]}}],[[{'action.type':[]}]],{'0':{'action.type':[]}}])('does not permit the key outside a direct tracking clause %#',value=>{
 expect(tracking.safeParse(value).success).toBe(false);
});
it.each(['__proto__','constructor','prototype','access_token','appsecret_proof'])('retains reserved-key denial beside or below the permitted protocol key %s',key=>{
 const bad=JSON.parse('{"'+key+'":"synthetic-secret"}');expect(tracking.safeParse([{'action.type':[],...bad}]).success).toBe(false);expect(tracking.safeParse([{'action.type':[bad]}]).success).toBe(false);
});
it.each([depth(9),nodes(3),Array(31).fill(null),Object.fromEntries(Array.from({length:41},(_,i)=>['k'+i,null])),{['k'.repeat(81)]:1},'a'.repeat(2001),'😀'.repeat(1001),'字'.repeat(2000),['a'.repeat(1999),'b'.repeat(1996),'c'.repeat(1996)],'bad\u0000text',Infinity,NaN,undefined])('preserves every old bound/non-JSON rejection %#',value=>{
 expect(tracking.safeParse(value).success).toBe(false);expect(generic.safeParse(value).success).toBe(false);
});
it.each([depth(7),Array(31).fill(null),Object.fromEntries(Array.from({length:41},(_,i)=>['k'+i,null])),{['k'.repeat(81)]:1},'a'.repeat(2001),'bad\u0000text',Infinity])('still validates the protocol key child with every old bound %#',value=>{
 expect(tracking.safeParse([{'action.type':value}]).success).toBe(false);
});
it('keeps every generic creative JSON field strict, including nested source-media JSON',()=>{
 for(const field of Object.values(videoCreativeSchema.shape.payload.shape))expect(field.safeParse(valid).success).toBe(false);
 expect(generic.safeParse({'action.type':[]}).success).toBe(false);
 const story=storyVideoCreativeSchema.shape.payload.shape,video=story.object_story_spec.shape.video_data.shape;
 for(const field of [video.customization_rules_spec,video.collection_thumbnails,story.creative_sourcing_spec,story.degrees_of_freedom_spec,story.interactive_components_spec,story.platform_customizations,story.contextual_multi_ads])expect(field.safeParse(valid).success).toBe(false);
 for(const key of ['images','bodies','titles','descriptions','destinations','posts','related_media','push_metadata_ids'])expect(story.media_sourcing_spec.safeParse({videos:[{video_id:'901'},{video_id:'902'}],[key]:valid}).success).toBe(false);
});

it.each(trackingDottedKeys)('preserves only a direct-clause official dotted literal with exact original bytes: %s',key=>{
 const value=[{[key]:['SYNTHETIC_ACTION'],fb_pixel:['777']}],bytes=JSON.stringify(value),hash=canonicalHash(value);
 expect(JSON.stringify(tracking.parse(value))).toBe(bytes);expect(canonicalHash(tracking.parse(value))).toBe(hash);expect(JSON.stringify(value)).toBe(bytes);
 for(const bad of [{[key]:[]},[{nested:{[key]:[]}}],[[{[key]:[]}]],{nested:{[key]:[]}},[{[key.toUpperCase()]:[]}],[{[key+'.extra']:[]}]])expect(tracking.safeParse(bad).success).toBe(false);
 expect(generic.safeParse(value).success).toBe(false);
});
