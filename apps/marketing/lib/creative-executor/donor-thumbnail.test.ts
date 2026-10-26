import {sizedThumbnailFixture} from './donor-thumbnail.fixture';
import {expect,it} from 'vitest';
import {canonicalHash,creativeWireLimit,ownerPayloadLimits,creativeAssetHash,executionPlanSchema,ownerProposalSchema,storyVideoCreativeSchema} from './contract';
import {applyReviewedMedia,reviewedMediaSchema} from './owner-review';
import {ownerFixture} from './owner-fixture';

// Synthetic URL/query only, never reconstructed actual provider values.
const prefix='https://www.facebook.com/synthetic-donor-thumbnail?synthetic_unclassified=';
const url=prefix+'x'.repeat(190-prefix.length);
function donor(){const f=ownerFixture(),control=structuredClone(f.control);
 const video=Object.assign(control.payload.object_story_spec.video_data,{image_url:url,image_hash:'a'.repeat(32)});
 return{...f,control,video};}
it('preserves both bounded Facebook donor thumbnail fields and all other settings exactly',()=>{
 const f=donor(),before=structuredClone(f.control),parsed=storyVideoCreativeSchema.parse(f.control);
 expect(Buffer.byteLength(url)).toBe(190);expect(parsed).toEqual(before);expect(f.control).toEqual(before);
 expect(parsed.payload.object_story_spec.video_data).toMatchObject({image_url:url,image_hash:'a'.repeat(32),call_to_action:{type:'SEE_DETAILS'}});
 for(const edit of [(v:typeof f.video)=>{v.image_url+='&synthetic_more=1';},(v:typeof f.video)=>{v.image_hash='b'.repeat(32);}]){
  const changed=structuredClone(f.control);edit(changed.payload.object_story_spec.video_data as typeof f.video);
  expect(canonicalHash(changed)).not.toBe(canonicalHash(parsed));expect(creativeAssetHash(changed)).not.toBe(creativeAssetHash(parsed));
 }
});
it.each(['missing_hash','bad_hash','http','credentials','port','fragment','foreign','suffix','invalid','long','unknown_field'])(
 'rejects unsafe or incomplete donor thumbnail %s',kind=>{
 const f=donor();
 if(kind==='missing_hash')Object.assign(f.video,{image_hash:undefined});if(kind==='bad_hash')f.video.image_hash='invalid';
 if(kind==='http')f.video.image_url=url.replace('https:','http:');if(kind==='credentials')f.video.image_url=url.replace('https://','https://user:pass@');
 if(kind==='port')f.video.image_url=url.replace('facebook.com/','facebook.com:8443/');if(kind==='fragment')f.video.image_url+='#fragment';
 if(kind==='foreign')f.video.image_url=url.replace('www.facebook.com','example.test');if(kind==='suffix')f.video.image_url=url.replace('www.facebook.com','facebook.com.example.test');
 if(kind==='invalid')f.video.image_url='not a URL';if(kind==='long')f.video.image_url+='x'.repeat(2000);if(kind==='unknown_field')Object.assign(f.video,{private_unknown:'synthetic'});
 expect(storyVideoCreativeSchema.safeParse(f.control).success).toBe(false);
});
it('retains legacy fbcdn-only and hash-only donor handling',()=>{
 const f=ownerFixture();expect(storyVideoCreativeSchema.parse(f.control)).toEqual(f.control);
 const hashOnly=donor();Object.assign(hashOnly.video,{image_url:undefined});expect(storyVideoCreativeSchema.safeParse(hashOnly.control).success).toBe(true);
});
it('keeps replacement thumbnail policy strict and changes only the independently reviewed fields',()=>{
 const f=donor(),changed=applyReviewedMedia(f.control,f.proposal.primary,f.edit);
 expect((changed.payload.object_story_spec.video_data as {image_hash?:string}).image_hash).toBe(f.edit.thumbnail.value);
 expect(changed.payload.object_story_spec.video_data.image_url).toBeUndefined();expect(f.video.image_url).toBe(url);
 expect(reviewedMediaSchema.safeParse({...f.edit,thumbnail:{kind:'image_url',value:url,evidenceHash:'c'.repeat(64)}}).success).toBe(false);
});
it('retains the full donor in the exact root-bound formal plan and Source envelope',()=>{
 const f=donor(),ownerReview={...f.plan.ownerReview!,payloadHash:canonicalHash(applyReviewedMedia(f.control,f.proposal.primary,f.edit))};
 const plan=executionPlanSchema.parse({...f.plan,control:f.control,approvedAssetHash:creativeAssetHash(f.control),ownerReview});
 const envelope={...f.envelope,plan,planHash:canonicalHash(plan)};
 expect(ownerProposalSchema.parse(envelope)).toEqual(envelope);expect(plan.control).toEqual(f.control);
 expect(executionPlanSchema.safeParse({...plan,ownerReview:undefined,generator:'resp_author',reviewer:'resp_reviewer'}).success).toBe(false);
});

it('keeps exact finite owner capacities distinct from generic wire and context meaning',()=>{
 const f=sizedThumbnailFixture();expect(ownerPayloadLimits).toEqual({planJsonb:16000,intentJsonb:16000,envelopeJsonb:20000,wireUtf8:24000});
 expect(f.wrappers).toEqual({object_story_spec:810,media_sourcing_spec:1751,creative_sourcing_spec:3965,degrees_of_freedom_spec:1058,contextual_multi_ads:27});
 expect(f.draft.ownerReview).toBeUndefined();expect(Buffer.byteLength(JSON.stringify(f.draft))).toBeGreaterThan(8000);
 expect(creativeWireLimit('prepare',{plan:f.plan})).toBe(24000);expect(creativeWireLimit('prepare',{plan:f.draft})).toBe(16000);
 expect(creativeWireLimit('read',{})).toBe(16000);expect(creativeWireLimit('admit',{intent:{kind:'create_control'}})).toBe(16000);
 expect(creativeWireLimit('admit',{intent:{kind:'create_creative'}})).toBe(24000);
});
