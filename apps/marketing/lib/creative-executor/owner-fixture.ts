import {randomUUID} from 'node:crypto';
import {canonicalHash,creativeAssetHash,executionPlanSchema,ownerProposalSchema} from './contract';
import {applyReviewedMedia,reviewedMediaSchema} from './owner-review';
import {nativeWindow} from './window';

// Synthetic only. These IDs/hashes never represent actual media/account proof.
export function ownerFixture(startDay?:string){
 const now=Date.now(),scope={app:'11',principal:'12',business:'13',account:'14',page:'15',campaign:'16',adset:'17'},originalAds=['21','22','23','24'];
 const control={format:'video_story' as const,id:'888001',page:scope.page,primary:'Synthetic original copy.',path:'/acrylic-roof-pergolas-auckland' as const,
  urlTags:'utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}',payload:{
   object_story_spec:{page_id:scope.page,video_data:{video_id:'91001',message:'Synthetic original copy.',title:'Synthetic original title',image_url:'https://scontent.fbcdn.net/synthetic-old.jpg',
    link_description:'Preserved description',call_to_action:{type:'SEE_DETAILS' as const,value:{link:'https://www.sanctuarypergolas.co.nz/acrylic-roof-pergolas-auckland'}}}},
   media_sourcing_spec:{videos:[{video_id:'91001',adlabels:[{name:'square'}]},{video_id:'91002',adlabels:[{name:'portrait'}]}],related_media:{placements:['feed','story','reels']}},
   creative_sourcing_spec:{enroll_status:'OPT_IN'},degrees_of_freedom_spec:{creative_features_spec:{standard_enhancements:{enroll_status:'OPT_OUT'}}},contextual_multi_ads:{enroll_status:'OPT_OUT'}}};
 const draft=executionPlanSchema.parse({version:1,landingTemplate:'e'.repeat(64),purpose:'paused_capability',experiment:randomUUID(),scope,originalAds,controlAd:'24',control,
  adTracking:[{'action.type':['SYNTHETIC_ACTION'],fb_pixel:['777']}],nativeObjective:{type:'CONVERSIONS',is_primary:true,name:'Website Lead',adspixels:[{id:'777',event_names:['Lead']}]},
  challengerPrimary:control.primary,approvedAssetHash:creativeAssetHash(control),approvedCopyHash:canonicalHash({control:control.primary,challenger:control.primary}),approvalHash:'a'.repeat(64),evidenceHash:'b'.repeat(64),
  generator:null,reviewer:null,approvedAt:new Date(now).toISOString(),approvalUntil:new Date(now+12*3600000).toISOString(),start:Math.floor(now/1000),end:Math.floor(now/1000)+3600,
  dailyMinor:40000,weeklyMinor:280000,studyDailyMinor:8000,currency:'NZD',timezone:'Pacific/Auckland',nativeContractHash:'d'.repeat(64),preStateHash:'f'.repeat(64),
  evaluation:{primary:'genuine_saved_enquiries_per_actual_NZD',interval:'exact_conditional_poisson_rate_ratio_95',providerEvent:'website_lead',durationDays:14,maturationHours:72,formalAnalyses:1,qualityMinimumEach:5,qualityCoverageMinimum:.5,maximumCoverageGap:.2,unknownMeans:'inconclusive'}});
 const edit=reviewedMediaSchema.parse({headline:'Synthetic reviewed title',media:[{role:'square',sourceVideo:'91001',video:'92001',sourceAssetHash:'1'.repeat(64),assetHash:'2'.repeat(64),evidenceHash:'3'.repeat(64)},
  {role:'portrait',sourceVideo:'91002',video:'92002',sourceAssetHash:'4'.repeat(64),assetHash:'5'.repeat(64),evidenceHash:'6'.repeat(64)}],thumbnail:{kind:'image_hash',value:'b'.repeat(32),evidenceHash:'7'.repeat(64)}});
 const window=nativeWindow(startDay??new Date(now+3*86400000).toISOString().slice(0,10));
 const proposal={version:1 as const,instructionHash:'8'.repeat(64),reviewArtifactHash:'9'.repeat(64),mediaManifestHash:'a'.repeat(64),reviewedAt:new Date(now-1000).toISOString(),
  scope,originalAds,controlAd:draft.controlAd,controlCreative:control.id,path:control.path,primary:'Synthetic reviewed complete copy.',...edit,...window};
 const review={kind:'owner_directed_independent_review_v1' as const,instructionHash:proposal.instructionHash,reviewArtifactHash:proposal.reviewArtifactHash,mediaManifestHash:proposal.mediaManifestHash,
  reviewedAt:proposal.reviewedAt,bundleHash:canonicalHash(proposal),payloadHash:canonicalHash(applyReviewedMedia(control,proposal.primary,edit)),edit};
 const plan=executionPlanSchema.parse({...draft,purpose:'formal_experiment',ownerReview:review,challengerPrimary:proposal.primary,approvedCopyHash:canonicalHash({control:control.primary,challenger:proposal.primary}),
  approvalHash:canonicalHash(review),evaluation:{...draft.evaluation,lossLimit:{policy:'matured_zero_genuine_v1',spendNzd:300,maturationHours:72},ambiguity:'finite_allocation_envelope_v1',unknownMeans:'finite_pool_sensitivity_else_inconclusive'},...window,approvalUntil:new Date((window.end+72*3600)*1000).toISOString()});
 const envelope=ownerProposalSchema.parse({version:1,proposal,plan,planHash:canonicalHash(plan),expiresAt:plan.approvalUntil});
 return{draft,control,edit,proposal,plan,envelope};
}
