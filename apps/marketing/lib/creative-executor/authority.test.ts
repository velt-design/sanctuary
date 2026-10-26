import {sizedThumbnailFixture} from './donor-thumbnail.fixture';
import {createHmac,randomUUID} from 'node:crypto';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {canonicalHash,creativeAssetHash,executionPlanSchema,type ExecutorState} from './contract';
import {nativeWindow} from './window';
import {verifyCreativeCommand,validateCreativeIntent} from './authority';
import {serializeEffect} from './intent';
const creativeScope={app:'11',business:'13',account:'14',page:'15'},scope={campaign:'16',adset:'17',ads:['21','22','23','24'].map(id=>({id}))};
const config=()=>({enrollment:{systemUser:'12'}}),settings=()=>({id:'17'});
function planFixture() {
  const control = { format: 'image' as const, id: '888001', page: creativeScope.page, imageHash: 'a'.repeat(32), primary: 'Approved existing hook.', headline: 'Approved heading', description: '',
    action: 'LEARN_MORE' as const, path: '/acrylic-roof-pergolas-auckland' as const,
    urlTags: 'utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}' as const };
  const principal = config().enrollment.systemUser;
  const planScope = { app: creativeScope.app, business: creativeScope.business, account: creativeScope.account, page: creativeScope.page, principal, campaign: scope.campaign, adset: scope.adset };
  const preStateHash = canonicalHash({ scope: planScope, dailyMinor: 40000, adset: settings(),
    originals: scope.ads.map(row => ({ id: row.id, status: 'ACTIVE', pageMatches: true })), creative: control });
  const {start,end} = nativeWindow(new Date(Date.now()+2*86400000).toISOString().slice(0,10));
  return executionPlanSchema.parse({ version: 1, landingTemplate: 'e'.repeat(64), purpose: 'formal_experiment', experiment: randomUUID(), scope: planScope, originalAds: scope.ads.map(row => row.id), controlAd: scope.ads[3]!.id, control, adTracking: [], nativeObjective: { type: 'CONVERSIONS', is_primary: true, name: 'Website Lead', adspixels: [{ id: '777', event_names: ['Lead'] }] },
    challengerPrimary: 'Approved alternative hook.', approvedAssetHash: creativeAssetHash(control),
    approvedCopyHash: canonicalHash({ control: control.primary, challenger: 'Approved alternative hook.' }), approvalHash: 'b'.repeat(64), evidenceHash: 'c'.repeat(64),
    generator: 'resp_fixture_author', reviewer: 'resp_fixture_reviewer', approvedAt: new Date(Date.now() - 60000).toISOString(), approvalUntil: new Date(Date.now() + 20 * 86400_000).toISOString(),
    start, end, dailyMinor: 40000, weeklyMinor: 280000, studyDailyMinor: 8000, currency: 'NZD', timezone: 'Pacific/Auckland', nativeContractHash: 'd'.repeat(64), preStateHash,
    evaluation: { primary: 'genuine_saved_enquiries_per_actual_NZD', interval: 'exact_conditional_poisson_rate_ratio_95', providerEvent: 'website_lead', durationDays: 14, maturationHours: 72, formalAnalyses: 1, qualityMinimumEach: 5, qualityCoverageMinimum: 0.5, maximumCoverageGap: 0.2, unknownMeans: 'inconclusive' } });
}

afterEach(()=>vi.unstubAllEnvs());
function request(plan:ReturnType<typeof planFixture>){const raw={version:1,command:randomUUID(),experiment:plan.experiment,stage:'prepare',payload:{plan,planHash:canonicalHash(plan)},at:Date.now()};const key='synthetic-authority-key-'.repeat(3);vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_KEY',key);return {raw,signature:createHmac('sha256',key).update('creative-command\n'+JSON.stringify(raw)).digest('base64url')};}
it('refuses signed formal preparation and admits only unchanged paused capability',()=>{const plan=planFixture(),formal=request(plan);expect(()=>verifyCreativeCommand(formal.raw,formal.signature)).toThrow('Formal');const now=Math.floor(Date.now()/1000);const paused=executionPlanSchema.parse({...plan,purpose:'paused_capability',generator:null,reviewer:null,challengerPrimary:plan.control.primary,approvedCopyHash:canonicalHash({control:plan.control.primary,challenger:plan.control.primary}),start:now,end:now+3600});const valid=request(paused);expect(verifyCreativeCommand(valid.raw,valid.signature).stage).toBe('prepare');expect(()=>verifyCreativeCommand(valid.raw,'forged')).toThrow();expect(()=>verifyCreativeCommand(valid.raw,valid.signature,Date.now()+31000)).toThrow();});
it('refuses formal effect admission even with a valid current signed plan',()=>{const plan=planFixture();const state:ExecutorState={template:'e'.repeat(64),enabled:true,cleanupEnabled:true,stopped:false,generation:1,plan,objects:[],effects:[],state:'prepared',measurementReady:false,activationReady:false};const intent=serializeEffect(plan,state,'create_creative',Date.now());expect(()=>validateCreativeIntent({generation:1,cleanup:false,intent},state,'e'.repeat(64))).toThrow('Formal');});

it('fences compiled template at effect admission while preserving exact owned cleanup',()=>{const base=planFixture(),now=Math.floor(Date.now()/1000);const plan=executionPlanSchema.parse({...base,purpose:'paused_capability',generator:null,reviewer:null,challengerPrimary:base.control.primary,approvedCopyHash:canonicalHash({control:base.control.primary,challenger:base.control.primary}),start:now,end:now+3600});const state:ExecutorState={template:plan.landingTemplate,enabled:true,cleanupEnabled:true,stopped:false,generation:1,plan,objects:[],effects:[],state:'prepared',measurementReady:false,activationReady:false};const intent=serializeEffect(plan,state,'create_creative',Date.now());expect(validateCreativeIntent({generation:1,cleanup:false,intent},state,plan.landingTemplate).intent.kind).toBe('create_creative');expect(()=>validateCreativeIntent({generation:1,cleanup:false,intent},state,'f'.repeat(64))).toThrow('template');state.objects=[{kind:'control',id:'999',command:randomUUID(),requestHash:'a'.repeat(64)}];state.enabled=false;const cleanup=serializeEffect(plan,state,'pause_control',Date.now());expect(validateCreativeIntent({generation:1,cleanup:true,intent:cleanup},state,'f'.repeat(64)).intent.kind).toBe('pause_control');});

it('separate default-off preparation flag admits future reviewed PAUSED mechanics, not activation',()=>{
 vi.stubEnv('SANCTUARY_META_CREATIVE_PREPARATION_ENABLED','true');const plan=planFixture(),signed=request(plan);
 expect(verifyCreativeCommand(signed.raw,signed.signature).stage).toBe('prepare');
 const state:ExecutorState={template:plan.landingTemplate,enabled:true,cleanupEnabled:true,stopped:false,generation:1,plan,objects:[],effects:[],state:'prepared',measurementReady:false,activationReady:false};
 const intent=serializeEffect(plan,state,'create_creative',Date.now());expect(validateCreativeIntent({generation:1,cleanup:false,intent},state,plan.landingTemplate).intent.kind).toBe('create_creative');
 expect(()=>validateCreativeIntent({generation:1,cleanup:false,intent:{...intent,kind:'activate_control'}},state,plan.landingTemplate)).toThrow();
 expect(()=>validateCreativeIntent({generation:2,cleanup:false,intent},state,plan.landingTemplate)).toThrow();
 state.stopped=true;expect(()=>validateCreativeIntent({generation:1,cleanup:false,intent},state,plan.landingTemplate)).toThrow();
});
it('formal preparation does not extend an old or future-dated review',()=>{
 vi.stubEnv('SANCTUARY_META_CREATIVE_PREPARATION_ENABLED','true');for(const age of [-60000,31*3600000]){const plan=planFixture();plan.approvedAt=new Date(Date.now()-age).toISOString();const signed=request(plan);expect(()=>verifyCreativeCommand(signed.raw,signed.signature)).toThrow();}
});

it('validates signed unchanged video-story preparation and exact source-media intent without widening effects',()=>{
 const old=planFixture(),now=Math.floor(Date.now()/1000),payload={object_story_spec:{page_id:old.scope.page,video_data:{video_id:'91001',message:old.control.primary,title:'Approved title',image_hash:'a'.repeat(32),call_to_action:{type:'GET_DETAILS' as const,value:{link:`https://www.sanctuarypergolas.co.nz${old.control.path}`}}}},media_sourcing_spec:{videos:[{video_id:'91001'},{video_id:'91002'}],bodies:[{text:old.control.primary}]},creative_sourcing_spec:{selected_video_id:'91001'},contextual_multi_ads:{enroll_status:'OPT_OUT'}};
 const control={id:old.control.id,page:old.scope.page,primary:old.control.primary,path:old.control.path,urlTags:old.control.urlTags+'&utm_id={{campaign.id}}',format:'video_story' as const,payload};
 const plan=executionPlanSchema.parse({...old,control,purpose:'paused_capability',generator:null,reviewer:null,start:now,end:now+3600,challengerPrimary:control.primary,approvedCopyHash:canonicalHash({control:control.primary,challenger:control.primary}),approvedAssetHash:creativeAssetHash(control)});
 const signed=request(plan);expect(verifyCreativeCommand(signed.raw,signed.signature).stage).toBe('prepare');
 const state:ExecutorState={template:plan.landingTemplate,enabled:true,cleanupEnabled:true,stopped:false,generation:1,plan,objects:[],effects:[],state:'prepared',measurementReady:false,activationReady:false};
 const intent=serializeEffect(plan,state,'create_creative',Date.now());validateCreativeIntent({generation:1,cleanup:false,intent},state,plan.landingTemplate);
 for(const [key,value] of Object.entries(payload))expect(JSON.parse(intent.body[key]!)).toEqual(value);expect(intent.body.url_tags).toBe(control.urlTags);
 const altered=structuredClone(intent);altered.body.media_sourcing_spec=JSON.stringify({videos:[{video_id:'91001'}]});expect(()=>validateCreativeIntent({generation:1,cleanup:false,intent:altered},state,plan.landingTemplate)).toThrow();
});

function nativePlan(){const base=planFixture(),now=Math.floor(Date.now()/1000);const control={format:'native_reference' as const,id:base.control.id,page:base.control.page,primary:base.control.primary,path:base.control.path,urlTags:base.control.urlTags,sourceAd:base.controlAd,snapshotHash:'f'.repeat(64)};return executionPlanSchema.parse({...base,control,adTracking:[{'action.type':['SYNTHETIC_ACTION'],fb_pixel:['777']}],purpose:'paused_capability',generator:null,reviewer:null,challengerPrimary:control.primary,approvedCopyHash:canonicalHash({control:control.primary,challenger:control.primary}),approvedAssetHash:creativeAssetHash(control),start:now,end:now+3600});}
it('admits only exact native PAUSED copy and owned pause, without creative reconstruction or a name write',()=>{
 const plan=nativePlan(),state:ExecutorState={template:plan.landingTemplate,enabled:true,cleanupEnabled:true,stopped:false,generation:1,plan,objects:[],effects:[],state:'prepared',measurementReady:false,activationReady:false};
 const signed=request(plan),verified=verifyCreativeCommand(signed.raw,signed.signature);expect(verified.stage).toBe('prepare');expect(executionPlanSchema.parse('plan' in verified.payload?verified.payload.plan:null).adTracking).toEqual(plan.adTracking);
 const effect=serializeEffect(plan,state,'create_control');
 expect(effect.path).toBe(`${plan.controlAd}/copies`);expect(effect.body).toEqual({adset_id:plan.scope.adset,status_option:'PAUSED'});expect(effect.target).toBeNull();
 validateCreativeIntent({generation:1,cleanup:false,intent:effect},state,plan.landingTemplate);
 for(const body of [{...effect.body,status_option:'ACTIVE'},{...effect.body,creative_parameters:'{}'},{...effect.body,name:'rename'}])expect(()=>validateCreativeIntent({generation:1,cleanup:false,intent:{...effect,body}},state,plan.landingTemplate)).toThrow();
 for(const kind of ['create_creative','create_challenger','create_study','activate_control','activate_challenger','end_study','pause_challenger']as const)expect(()=>serializeEffect(plan,state,kind)).toThrow();
 state.objects=[{kind:'control',id:'999777',command:randomUUID(),requestHash:effect.requestHash}];state.enabled=false;
 expect(serializeEffect(plan,state,'pause_control').body).toEqual({status:'PAUSED'});
 expect(()=>serializeEffect(plan,state,'create_control')).toThrow();
});
it('never converts native references to formal approval even when preparation and delivery flags are enabled',()=>{
 vi.stubEnv('SANCTUARY_META_CREATIVE_PREPARATION_ENABLED','true');vi.stubEnv('SANCTUARY_META_CREATIVE_DELIVERY_ENABLED','true');
 const plan=nativePlan();expect(executionPlanSchema.safeParse({...plan,purpose:'formal_experiment',generator:'resp_author',reviewer:'resp_reviewer',challengerPrimary:'Different'}).success).toBe(false);
 expect(executionPlanSchema.safeParse({...plan,control:{...plan.control,sourceAd:'99'}}).success).toBe(false);
 const signed=request(plan);expect(verifyCreativeCommand(signed.raw,signed.signature).stage).toBe('prepare');
});

it('validates the complete larger owner plan and intent while denying generic, tampered and stopped equivalents',()=>{
 vi.stubEnv('SANCTUARY_META_CREATIVE_PREPARATION_ENABLED','true');const f=sizedThumbnailFixture(),signed=request(f.plan);
 expect(verifyCreativeCommand(signed.raw,signed.signature).stage).toBe('prepare');
 const state:ExecutorState={template:f.plan.landingTemplate,enabled:true,cleanupEnabled:true,stopped:false,generation:1,plan:f.plan,objects:[],effects:[],state:'prepared',measurementReady:false,activationReady:false};
 const intent=serializeEffect(f.plan,state,'create_creative');expect(intent.body.media_sourcing_spec).toBeDefined();
 expect(validateCreativeIntent({generation:1,cleanup:false,intent},state,state.template!)).toMatchObject({intent});
 expect(()=>validateCreativeIntent({generation:1,cleanup:false,intent:{...intent,body:{...intent.body,name:'Changed'}}},state,state.template!)).toThrow();
 expect(()=>validateCreativeIntent({generation:1,cleanup:false,intent},{...state,stopped:true},state.template!)).toThrow();
 expect(()=>validateCreativeIntent({generation:1,cleanup:false,intent},{...state,plan:planFixture()},state.template!)).toThrow();
 const overflow={...signed.raw,payload:{...signed.raw.payload,plan:{...f.plan,synthetic_overflow:'x'.repeat(24000)}}};
 const key=process.env.SANCTUARY_LANDING_EXPERIMENT_KEY!;const sig=createHmac('sha256',key).update('creative-command\n'+JSON.stringify(overflow)).digest('base64url');expect(()=>verifyCreativeCommand(overflow,sig)).toThrow();
});
it('requires exact current root owner equality when generic preparation remains off',()=>{
 vi.stubEnv('SANCTUARY_META_CREATIVE_PREPARATION_ENABLED','false');const f=sizedThumbnailFixture();
 const state:ExecutorState={template:f.plan.landingTemplate,enabled:true,cleanupEnabled:true,stopped:false,generation:1,plan:f.plan,ownerProposal:f.envelope,objects:[],effects:[],state:'prepared',measurementReady:false,activationReady:false};
 const intent=serializeEffect(f.plan,state,'create_creative'),payload={generation:1,cleanup:false,intent};
 expect(validateCreativeIntent(payload,state,state.template!).intent).toEqual(intent);
 for(const envelope of [null,{...f.envelope,planHash:'0'.repeat(64)},{...f.envelope,expiresAt:new Date(Date.now()-1).toISOString()}])expect(()=>validateCreativeIntent(payload,{...state,ownerProposal:envelope},state.template!)).toThrow();
});
