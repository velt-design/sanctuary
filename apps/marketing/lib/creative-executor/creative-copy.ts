import {creativeSchema,type Creative} from './contract';

/** Exact reviewed copy substitution. Media and delivery settings remain byte-
 * equivalent; source-media copy mapping is separately required before formal use. */
export function creativeWithPrimary(input:Creative,creativeId:string,primary:string):Creative{
 if(input.format==='native_reference')throw new Error('Reference-only creative cannot be edited');
 const copy=structuredClone(input);copy.id=creativeId;copy.primary=primary;
 if(copy.format==='video_assets'){
  const feed=copy.payload.asset_feed_spec as {bodies?:{text?:string}[]};
  const story=copy.payload.object_story_spec as {video_data?:{message?:string}};
  if(feed.bodies?.length!==1||feed.bodies[0]!.text!==input.primary||story.video_data?.message!==undefined&&story.video_data.message!==input.primary)throw new Error('Creative copy mapping differs');
  feed.bodies[0]!.text=primary;if(story.video_data?.message!==undefined)story.video_data.message=primary;
 }
 if(copy.format==='video_story')copy.payload.object_story_spec.video_data.message=primary;
 if(copy.format!=='image'&&copy.payload.media_sourcing_spec!==undefined&&primary!==input.primary)throw new Error('Source media copy mapping unavailable');
 return creativeSchema.parse(copy);
}
