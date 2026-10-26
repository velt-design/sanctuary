import {expect,it} from 'vitest';
import {inheritedWebsiteFor} from './website-destination';
import {executionPlanSchema,canonicalHash} from './contract';
import {ownerFixture} from './owner-fixture';

const fixture=()=>{const f=ownerFixture(),settings={id:f.plan.scope.adset,optimization_goal:'OFFSITE_CONVERSIONS',billing_event:'IMPRESSIONS',destination_type:'UNDEFINED',promoted_object:{pixel_id:'777',custom_event_type:'LEAD'}};
 return{...f,settings,binding:inheritedWebsiteFor(settings,f.plan.scope.adset,f.control)!};};
it('binds the literal inherited destination to the existing adset, website and pixel/Lead without normalization',()=>{
 const f=fixture(),before=structuredClone(f.settings),plan=executionPlanSchema.parse({...f.plan,inheritedWebsite:f.binding});
 expect(f.settings).toEqual(before);expect(plan.inheritedWebsite).toEqual(f.binding);expect(plan.inheritedWebsite?.destinationType).toBe('UNDEFINED');
 expect(canonicalHash(f.settings)).not.toBe(canonicalHash({...f.settings,destination_type:'WEBSITE'}));
 expect(inheritedWebsiteFor({...f.settings,destination_type:'WEBSITE'},f.plan.scope.adset,f.control)).toBeUndefined();
 expect(executionPlanSchema.safeParse(f.plan).success).toBe(true);
});
it.each(['OTHER','undefined','',' UNDEFINED','APP','ON_AD'])('rejects every unapproved destination literal %s',destination_type=>{
 const f=fixture();expect(()=>inheritedWebsiteFor({...f.settings,destination_type},f.plan.scope.adset,f.control)).toThrow();
});
it.each(['adset','pixel','event','goal','billing','path','url','format'])('does not infer an inherited website when %s differs',change=>{
 const f=fixture(),raw=structuredClone(f.settings),control=structuredClone(f.control);
 if(change==='adset')raw.id='999';if(change==='pixel')raw.promoted_object.pixel_id='';if(change==='event')raw.promoted_object.custom_event_type='PURCHASE';
 if(change==='goal')raw.optimization_goal='LEAD_GENERATION';if(change==='billing')raw.billing_event='CLICKS';
 if(change==='path')control.path='/auckland-outdoor-living' as never;if(change==='url')control.payload.object_story_spec.video_data.call_to_action.value.link='https://example.invalid/';
 if(change==='format')control.format='image' as never;
 expect(()=>inheritedWebsiteFor(raw,f.plan.scope.adset,control)).toThrow();
});
it.each(['adset','pixel','url','model','native_reference'])('keeps Source/Velt plan admission bound and cross-purpose strict: %s',change=>{
 const f=fixture(),plan=structuredClone({...f.plan,inheritedWebsite:f.binding});
 if(change==='adset')plan.inheritedWebsite.adset='999';if(change==='pixel')plan.inheritedWebsite.pixel='999';if(change==='url')plan.inheritedWebsite.url='https://example.invalid/' as never;
 if(change==='model'){delete (plan as Partial<typeof plan>).ownerReview;plan.generator='resp_author';plan.reviewer='resp_reviewer';}
 if(change==='native_reference')plan.control.format='native_reference' as never;
 expect(executionPlanSchema.safeParse(plan).success).toBe(false);
});
