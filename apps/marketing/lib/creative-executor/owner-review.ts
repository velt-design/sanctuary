import {z} from 'zod';

const id=z.string().regex(/^[1-9]\d{0,19}$/),hash=z.string().regex(/^[a-f0-9]{64}$/),stamp=z.iso.datetime({offset:true});
const thumbnail=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('image_hash'),value:z.string().regex(/^[a-f0-9]{32}$/),evidenceHash:hash}).strict(),
 z.object({kind:z.literal('image_url'),value:z.string().url().max(2000).refine(value=>{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='fbcdn.net'||u.hostname.endsWith('.fbcdn.net'));}),evidenceHash:hash}).strict(),
]);
const mediaFields={role:z.enum(['square','portrait']),sourceAssetHash:hash,assetHash:hash};
const registeredMedia=z.object({...mediaFields,sourceVideo:id,video:id,evidenceHash:hash}).strict();
export const reviewedMediaSchema=z.object({headline:z.string().min(1).max(120),media:z.array(registeredMedia).length(2),thumbnail}).strict().refine(v=>
 new Set(v.media.map(m=>m.role)).size===2&&new Set(v.media.map(m=>m.sourceVideo)).size===2&&new Set(v.media.map(m=>m.video)).size===2&&
 v.media.every(m=>m.assetHash!==m.sourceAssetHash&&!v.media.some(old=>old.sourceVideo===m.video)));
export type ReviewedMedia=z.infer<typeof reviewedMediaSchema>;
export const ownerReviewSchema=z.object({kind:z.literal('owner_directed_independent_review_v1'),instructionHash:hash,reviewArtifactHash:hash,
 mediaManifestHash:hash,reviewedAt:stamp,bundleHash:hash,payloadHash:hash,edit:reviewedMediaSchema}).strict();
export const ownerBundleSchema=z.object({version:z.literal(1),instructionHash:hash,reviewArtifactHash:hash,mediaManifestHash:hash,reviewedAt:stamp,
 scope:z.object({app:id,principal:id,business:id,account:id,page:id,campaign:id,adset:id}).strict(),originalAds:z.array(id).length(4).refine(v=>new Set(v).size===4),
 controlAd:id,controlCreative:id,path:z.literal('/acrylic-roof-pergolas-auckland'),primary:z.string().min(1).max(1000),headline:z.string().min(1).max(120),
 media:z.array(z.object({...mediaFields,sourceVideo:id.nullable(),video:id.nullable(),evidenceHash:hash.nullable()}).strict()).length(2).refine(v=>new Set(v.map(m=>m.role)).size===2),
 thumbnail:thumbnail.nullable(),start:z.number().int().positive().safe(),end:z.number().int().positive().safe(),
}).strict();
export type OwnerBundle=z.infer<typeof ownerBundleSchema>;

type Story={id:string;primary:string;payload:{object_story_spec:{video_data:{video_id:string;message:string;title:string;image_url?:string;image_hash?:string}};
 media_sourcing_spec:{videos:{video_id:string}[];bodies?:unknown;titles?:unknown}}};
/** Only these reviewed media/title/thumbnail paths change. Unknown references to
 * old video IDs abstain; neither a global string replacement nor omission is safe. */
export function applyReviewedMedia<T extends Story>(input:T,primary:string,editInput:ReviewedMedia):T{
 const edit=reviewedMediaSchema.parse(editInput),copy=structuredClone(input),story=copy.payload.object_story_spec.video_data;
 const videos=copy.payload.media_sourcing_spec.videos,old=videos.map(v=>v.video_id);
 if(old.length!==2||new Set(old).size!==2||edit.media.some(m=>!old.includes(m.sourceVideo))||!old.includes(story.video_id))throw new Error('Reviewed source media differs');
 const replacement=(source:string)=>edit.media.find(m=>m.sourceVideo===source)!.video;
 const mirror=(key:'bodies'|'titles',original:string,replacement:string)=>{
  const media=copy.payload.media_sourcing_spec;
  if(media[key]===undefined)return;
  const entries=z.array(z.object({text:z.string()}).strict()).length(1).parse(media[key]);
  if(entries[0]!.text!==original)throw new Error('Reviewed source copy mirror differs');
  media[key]=[{text:replacement}];
 };
 mirror('bodies',story.message,primary);mirror('titles',story.title,edit.headline);
 copy.primary=primary;story.message=primary;story.title=edit.headline;story.video_id=replacement(story.video_id);
 for(const video of videos)video.video_id=replacement(video.video_id);
 delete story.image_url;delete story.image_hash;
 if(edit.thumbnail.kind==='image_hash')story.image_hash=edit.thumbnail.value;else story.image_url=edit.thumbnail.value;
 const containsOld=(v:unknown):boolean=>typeof v==='string'?old.includes(v):Array.isArray(v)?v.some(containsOld):!!v&&typeof v==='object'&&Object.values(v).some(containsOld);
 if(containsOld(copy.payload))throw new Error('Unsupported source media reference');
 return copy;
}
