import {canonicalHash,creativeAssetHash,executionPlanSchema,ownerProposalSchema,storyVideoCreativeSchema} from './contract';
import {applyReviewedMedia} from './owner-review';
import {ownerFixture} from './owner-fixture';

/** Synthetic values at the five observed compact wrapper sizes. These are not
 * recovered provider contents or proof that an actual full plan fits. */
export function sizedThumbnailFixture(){
 const f=ownerFixture(),control=structuredClone(f.control),video=Object.assign(control.payload.object_story_spec.video_data,{image_hash:'a'.repeat(32)});
 const bytes=(v:unknown)=>Buffer.byteLength(JSON.stringify(v));
 const pad=(v:Record<string,unknown>,key:string,target:number,root:unknown=v)=>{v[key]='';const n=target-bytes(root);if(n<0||n>2000)throw Error('Synthetic size fixture differs '+target+':'+n);v[key]='x'.repeat(n);};
 const prefix='https://www.facebook.com/synthetic-thumbnail?unclassified=';
 video.image_url=prefix+'x'.repeat(190-prefix.length);video.message='M'.repeat(300);control.primary=video.message;video.title='T'.repeat(29);
 delete (video as {link_description?:string}).link_description;
 Object.assign(video,{link_description:''});pad(video,'link_description',810,control.payload.object_story_spec);
 const media=control.payload.media_sourcing_spec;Object.assign(media,{bodies:[{text:video.message}],titles:[{text:video.title}]});pad(media.related_media,'synthetic_padding',1751,media);
 Object.assign(control.payload,{creative_sourcing_spec:{enroll_status:'OPT_IN',synthetic_features:Array.from({length:30},(_,i)=>({key:'synthetic_'+i,value:'OPT_OUT',kind:'synthetic'})),synthetic_a:'x'.repeat(1400),synthetic_b:''}});pad(control.payload.creative_sourcing_spec,'synthetic_b',3965);
 Object.assign(control.payload,{degrees_of_freedom_spec:{synthetic_padding:''}});pad(control.payload.degrees_of_freedom_spec,'synthetic_padding',1058);
 storyVideoCreativeSchema.parse(control);
 const draft=executionPlanSchema.parse({...f.draft,control,approvedAssetHash:creativeAssetHash(control),challengerPrimary:control.primary,approvedCopyHash:canonicalHash({control:control.primary,challenger:control.primary})});
 const ownerReview={...f.plan.ownerReview!,payloadHash:canonicalHash(applyReviewedMedia(control,f.proposal.primary,f.edit))};
 const plan=executionPlanSchema.parse({...f.plan,control,approvedAssetHash:creativeAssetHash(control),approvedCopyHash:canonicalHash({control:control.primary,challenger:f.proposal.primary}),approvalHash:canonicalHash(ownerReview),ownerReview});
 const envelope=ownerProposalSchema.parse({...f.envelope,plan,planHash:canonicalHash(plan)});
 const wrappers=Object.fromEntries(['object_story_spec','media_sourcing_spec','creative_sourcing_spec','degrees_of_freedom_spec','contextual_multi_ads'].map(key=>[key,bytes(control.payload[key as keyof typeof control.payload])]));
 return{...f,control,draft,plan,envelope,wrappers,expected:applyReviewedMedia(control,plan.challengerPrimary,f.edit)};
}
