import {expect,it} from 'vitest';
import {ACCESSORY_REVIEW_RATES,getDefaultInstalledSellingRates,loadCostingConfigV1,calculateSiteCostV1} from '@sp/costing';
import {prepareStudioCreation} from './createPreparation';
import {createStudioAuthoringEdit,projectStudioAuthoringView,mergeStudioAuthoringEdit} from './authoringView';
import {addWebsitePergola} from './websiteComposition';
import type {StudioWebsiteDesign} from './websiteDesign';
import {calculateStudioCommercialPricing} from './studioCommercialPricing.server';
import {studioInstallationEstimate} from './studioInstallationEstimate';
import {parseStudioTravelAllowance,studioTravelTotalCents,type StudioTravelReceipt} from './studioTravelAllowance';
import {studioTravelPlanForReceipt,studioTravelTripPlanIssue,studioPendingTravelAllowance,studioTravelPlanWithNights} from './studioTravelPlan';

const receipt:StudioTravelReceipt={schemaVersion:'studio_travel_receipt.v1',policyVersion:'studio-travel-local.v1',base:'71G Montgomerie Rd, Mangere, Auckland',projectId:'proj_fixture',destinationCanonical:'12 Example Road, Auckland',placeId:'fixture',drivingCostPerRoundTripCents:5415,overnightEligible:false,proof:'a'.repeat(64)};
const config={...loadCostingConfigV1(),accessoryRates:ACCESSORY_REVIEW_RATES,installedSellingRates:getDefaultInstalledSellingRates()};
function design(){
 const made=prepareStudioCreation({mode:'blank',projectId:'proj_10000000-0000-4000-8000-000000000001',designId:'site-days-proof',commercialScopeId:null});if(!made.ok)throw Error(made.message);
 const outputs=made.prepared.row.outputs,view=projectStudioAuthoringView({authored:outputs.studio_authored,spatial:outputs.drawing_object_first});if(!view.ok)throw Error(view.message);
 const edit=addWebsitePergola(createStudioAuthoringEdit(view.value),'p');
 (edit.objectOptions[0].values.websiteDesign as unknown as StudioWebsiteDesign).rawDimensions={widthMm:'6000',projectionMm:'4000'};
 return{edit,outputs};
}
it('connects the canonical 6×4 pitched productive-site-day estimate to daily trips, money and saved authored data',()=>{
 const {edit,outputs}=design(),calculation=calculateStudioCommercialPricing(edit,config);
 const estimate=studioInstallationEstimate(calculation.siteOutput)!;
 expect(estimate).toEqual({siteDays:3});
 const plan=studioTravelPlanForReceipt({mode:'pending'},receipt,estimate.siteDays);
 expect(plan).toMatchObject({tripCountSource:'site_days',plannedRoundTrips:'3',plannedNights:'0'});
 expect(studioTravelTotalCents(plan)).toBe(16245);
 edit.site={travelAllowance:plan,travelExGst:(studioTravelTotalCents(plan)/100).toFixed(2)};
 const saved=mergeStudioAuthoringEdit({storedAuthored:outputs.studio_authored,storedSpatial:outputs.drawing_object_first,edit});if(!saved.ok)throw Error(saved.message);
 const reloaded=projectStudioAuthoringView({authored:saved.value.authored,spatial:saved.value.spatial});if(!reloaded.ok)throw Error(reloaded.message);
 const restored=createStudioAuthoringEdit(reloaded.value),repriced=calculateStudioCommercialPricing(restored,config);
 expect(restored.site).toEqual(edit.site);
 expect(studioTravelTripPlanIssue(restored.site.travelAllowance,studioInstallationEstimate(repriced.siteOutput)!.siteDays)).toBeNull();
 expect(repriced.siteOutput.add_ons.travel_ex_gst).toBe(162.45);
});
it('exposes one site duration, not the sum of repeated module site-day values',()=>{
 const {edit}=design(),two=addWebsitePergola(edit,'p2'),output=calculateStudioCommercialPricing(two,config).siteOutput;
 const days=studioInstallationEstimate(output)!.siteDays;
 const repeated=output.pergolas.flatMap(p=>p.modules.map(m=>m.derived.site_days!));
 expect(repeated.length).toBeGreaterThan(1);expect(repeated.every(n=>n===days)).toBe(true);
 expect(days).toBeLessThan(repeated.reduce((sum,n)=>sum+n,0));
 expect(studioTravelPlanForReceipt(undefined,receipt,days).plannedRoundTrips).toBe(String(days));
});
it('does not present absent, invalid or zero installation output as a verified one-day estimate',()=>{
 for(const site_days of [undefined,0,-1,1.2,Infinity,NaN])expect(studioInstallationEstimate({site_days})).toBeNull();
 expect(studioInstallationEstimate(calculateSiteCostV1({pergolas:[],travel_ex_gst:25},config))).toBeNull();
 expect(studioTravelTripPlanIssue(studioTravelPlanForReceipt(undefined,receipt,null),null)?.kind).toBe('unavailable');
 expect(studioTravelPlanForReceipt(undefined,receipt,null).plannedRoundTrips).toBe('');
});
it('keeps overnight journeys separate and redefaults both nights→daily and remote→local unless a trip override was actually made',()=>{
 const daily=studioTravelPlanForReceipt(undefined,receipt,3);
 const staying=studioTravelPlanWithNights(daily,'2',3);
 expect(staying).toMatchObject({tripCountSource:'overnight',plannedRoundTrips:'1',plannedNights:'2'});
 expect(studioTravelTotalCents(staying)).toBe(65415);
 expect(studioTravelPlanWithNights(staying,'0',4)).toMatchObject({tripCountSource:'site_days',plannedRoundTrips:'4',plannedNights:'0'});
 expect(studioTravelPlanWithNights(staying,'00',4)).toMatchObject({tripCountSource:'site_days',plannedRoundTrips:'4',plannedNights:'00'});
 const far={...receipt,destinationCanonical:'34 Example Road, Hamilton',overnightEligible:true};
 const remote=studioTravelPlanForReceipt(studioPendingTravelAllowance(daily),far,3);
 expect(remote).toMatchObject({tripCountSource:'overnight',plannedRoundTrips:'1',plannedNights:''});
 expect(studioTravelPlanForReceipt(studioPendingTravelAllowance({...remote,plannedNights:'2'}),receipt,4)).toMatchObject({tripCountSource:'site_days',plannedRoundTrips:'4',plannedNights:'0'});
 const manual={...staying,tripCountSource:'manual' as const,plannedRoundTrips:'2'};
 expect(studioTravelPlanWithNights(manual,'0',4).plannedRoundTrips).toBe('2');
 expect(studioTravelPlanForReceipt(studioPendingTravelAllowance(manual),receipt,4)).toMatchObject({tripCountSource:'manual',plannedRoundTrips:'2'});
});
it('preserves legacy unknown intent and explicit overrides across address recalculation without retaining old financial authority',()=>{
 const legacy={mode:'automatic' as const,receipt,plannedRoundTrips:'1',plannedNights:'0'};
 const snapshot=structuredClone(legacy),pending=studioPendingTravelAllowance(legacy);
 expect(pending).not.toHaveProperty('receipt');expect(parseStudioTravelAllowance(pending)).toEqual(pending);
 const restored=studioTravelPlanForReceipt(pending,{...receipt,destinationCanonical:'34 Example Road, Auckland'},3);
 expect(restored.plannedRoundTrips).toBe('1');expect(restored.tripCountSource).toBeUndefined();
 expect(studioTravelTripPlanIssue(restored,3)?.kind).toBe('confirm');expect(legacy).toEqual(snapshot);
 expect(()=>parseStudioTravelAllowance({...pending,previousPlan:{...pending.previousPlan,receipt}})).toThrow();
 expect(()=>parseStudioTravelAllowance({...legacy,tripCountSource:{toString:()=> 'manual'}})).toThrow();
});
