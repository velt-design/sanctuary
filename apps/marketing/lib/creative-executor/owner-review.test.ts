import {expect,it} from 'vitest';
import {executionPlanSchema,ownerProposalSchema,type ExecutionPlan,type ExecutorState} from './contract';
import {applyReviewedMedia} from './owner-review';
import {creativeWithPrimary} from './creative-copy';
import {serializeEffect} from './intent';
import {ownerFixture} from './owner-fixture';


function state(plan:ExecutionPlan):ExecutorState{return{enabled:true,cleanupEnabled:true,stopped:false,generation:1,plan,objects:[],effects:[],state:'prepared',measurementReady:false,activationReady:false};}

it('changes only the exact reviewed two-video, primary, headline and thumbnail paths',()=>{
 const f=ownerFixture(),before=structuredClone(f.control),changed=creativeWithPrimary(f.control,'999001',f.plan.challengerPrimary,f.edit);
 expect(f.control).toEqual(before);expect(changed.format).toBe('video_story');if(changed.format!=='video_story')throw Error('Synthetic format');
 expect(changed.payload.object_story_spec.video_data).toMatchObject({video_id:'92001',message:f.plan.challengerPrimary,title:f.edit.headline,image_hash:'b'.repeat(32),link_description:'Preserved description',call_to_action:before.payload.object_story_spec.video_data.call_to_action});
 expect(changed.payload.object_story_spec.video_data.image_url).toBeUndefined();
 expect(changed.payload.media_sourcing_spec.videos).toEqual([{video_id:'92001',adlabels:[{name:'square'}]},{video_id:'92002',adlabels:[{name:'portrait'}]}]);
 const expected=applyReviewedMedia(before,f.plan.challengerPrimary,f.edit);expected.id='999001';expect(changed).toEqual(expected);
 expect(changed.payload.degrees_of_freedom_spec).toEqual(before.payload.degrees_of_freedom_spec);expect(changed.payload.creative_sourcing_spec).toEqual(before.payload.creative_sourcing_spec);
 expect(changed.urlTags).toBe(before.urlTags);
});
it('serializes the complete reviewed payload and preserves the original-creative control and exact tracking',()=>{
 const {plan}=ownerFixture(),s=state(plan),wire=serializeEffect(plan,s,'create_creative');
 expect(JSON.parse(wire.body.object_story_spec!).video_data).toMatchObject({video_id:'92001',title:'Synthetic reviewed title',message:plan.challengerPrimary});
 expect(JSON.parse(wire.body.media_sourcing_spec!).videos.map((v:{video_id:string})=>v.video_id)).toEqual(['92001','92002']);
 const control=serializeEffect(plan,s,'create_control');expect(JSON.parse(control.body.creative!)).toEqual({creative_id:plan.control.id});expect(JSON.parse(control.body.tracking_specs!)).toEqual(plan.adTracking);
 s.creativeReference='999001';const challenger=serializeEffect(plan,s,'create_challenger');expect(JSON.parse(challenger.body.creative!)).toEqual({creative_id:'999001'});expect(challenger.body.status).toBe('PAUSED');
 expect([control,challenger].every(w=>w.body.adset_id===plan.scope.adset&&w.target===null)).toBe(true);
});
it.each(['model','paused','payload','approval','native','unknown-edit','scope','media','headline'])(
 'rejects cross-purpose or changed owner-plan input: %s',kind=>{
  const f=ownerFixture(),p=structuredClone(f.plan);
  if(kind==='model'){p.generator='resp_fake_author';p.reviewer='resp_fake_review';}
  if(kind==='paused')p.purpose='paused_capability';
  if(kind==='payload')p.ownerReview!.payloadHash='0'.repeat(64);
  if(kind==='approval')p.approvalHash='0'.repeat(64);
  if(kind==='native')p.control={format:'native_reference',id:p.control.id,page:p.scope.page,primary:p.control.primary,path:p.control.path,urlTags:p.control.urlTags,sourceAd:p.controlAd,snapshotHash:'a'.repeat(64)};
  if(kind==='unknown-edit')Object.assign(p.ownerReview!.edit,{arbitrary:'field'});
  if(kind==='scope')p.scope.page='999';
  if(kind==='media')p.ownerReview!.edit.media[0]!.video=p.ownerReview!.edit.media[1]!.video;
  if(kind==='headline')p.ownerReview!.edit.headline='Synthetic original title';
  expect(executionPlanSchema.safeParse(p).success).toBe(false);
 });
it.each(['source','duplicate-role','old-reference','null-reference','forbidden-thumbnail'])(
 'rejects unregistered or unsupported media mapping: %s',kind=>{
  const f=ownerFixture(),edit=structuredClone(f.edit),control=structuredClone(f.control);
  if(kind==='source')edit.media[0]!.sourceVideo='999';
  if(kind==='duplicate-role')edit.media[0]!.role='portrait';
  if(kind==='old-reference')Object.assign(control.payload.creative_sourcing_spec,{unhandled_video:'91001'});
  if(kind==='null-reference')Object.assign(edit.media[0]!,{video:null});
  if(kind==='forbidden-thumbnail')Object.assign(edit.thumbnail,{kind:'image_url',value:'https://example.test/unapproved.jpg'});
  expect(()=>applyReviewedMedia(control,f.plan.challengerPrimary,edit)).toThrow();
 });
it('requires exact complete root-envelope equality and retains pending unknown references as read-only',()=>{
 const f=ownerFixture();expect(ownerProposalSchema.parse(f.envelope)).toEqual(f.envelope);
 for(const field of ['headline','primary','reviewArtifactHash']as const){const e=structuredClone(f.envelope);e.proposal[field]=field==='reviewArtifactHash'?'0'.repeat(64):'Changed';expect(ownerProposalSchema.safeParse(e).success).toBe(false);}
 const pending={...f.envelope,plan:null,planHash:null,proposal:{...f.proposal,media:f.proposal.media.map(m=>({...m,sourceVideo:null,video:null,evidenceHash:null})),thumbnail:null}};
 expect(ownerProposalSchema.safeParse(pending).success).toBe(true);
 expect(executionPlanSchema.safeParse({...f.draft,purpose:'formal_experiment',challengerPrimary:'Changed',generator:null,reviewer:null}).success).toBe(false);
});

it('updates the exact single media body/title mirrors together while preserving descriptions and other metadata',()=>{
 const f=ownerFixture(),media=f.control.payload.media_sourcing_spec;
 Object.assign(media,{bodies:[{text:f.control.primary}],titles:[{text:f.control.payload.object_story_spec.video_data.title}],descriptions:[{text:'Preserved description'}]});
 const before=structuredClone(f.control),changed=applyReviewedMedia(f.control,f.proposal.primary,f.edit);
 expect(changed.payload.media_sourcing_spec).toMatchObject({bodies:[{text:f.proposal.primary}],titles:[{text:f.edit.headline}],descriptions:[{text:'Preserved description'}]});
 expect(f.control).toEqual(before);expect(changed.payload.object_story_spec.video_data.message).toBe(f.proposal.primary);
 expect(changed.payload.object_story_spec.video_data.title).toBe(f.edit.headline);
});
it.each(['multiple','mismatch','unknown','null','object'] as const)('abstains on ambiguous or unsupported media copy mirrors: %s',kind=>{
 for(const key of ['bodies','titles'] as const){const f=ownerFixture(),text=key==='bodies'?f.control.primary:f.control.payload.object_story_spec.video_data.title;
 const value=kind==='multiple'?[{text},{text}]:kind==='mismatch'?[{text:'Different source'}]:kind==='unknown'?[{text,unclassified:'synthetic'}]:kind==='null'?null:{text};
 Object.assign(f.control.payload.media_sourcing_spec,{[key]:value});expect(()=>applyReviewedMedia(f.control,f.proposal.primary,f.edit)).toThrow();}
});
