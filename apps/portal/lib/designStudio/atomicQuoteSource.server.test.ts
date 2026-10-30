import {expect,it} from 'vitest';
import {ACCESSORY_REVIEW_RATES,getDefaultInstalledSellingRates,loadCostingConfigV1} from '@sp/costing';
import {prepareStudioAtomicSource,normalizeStudioAtomicTravel} from './atomicQuoteSource.server';
import {prepareStudioCreation} from './createPreparation';
import {addWebsitePergola} from './websiteComposition';
import {createStudioAuthoringEdit,projectStudioAuthoringView} from './authoringView';
import {calculateStudioCommercialPricing} from './studioCommercialPricing.server';
import {studioInstallationEstimate} from './studioInstallationEstimate';
import {studioTravelPlanForReceipt,studioTravelTripPlanIssue} from './studioTravelPlan';
import {studioTravelTotalCents,type StudioTravelReceipt} from './studioTravelAllowance';
const config={...loadCostingConfigV1(),accessoryRates:ACCESSORY_REVIEW_RATES,installedSellingRates:getDefaultInstalledSellingRates()};
const made=prepareStudioCreation({mode:'blank',projectId:'proj_10000000-0000-4000-8000-000000000001',designId:'atomic-days',commercialScopeId:null});if(!made.ok)throw Error(made.message);
const row={outputs:made.prepared.row.outputs,updated_at:'2026-10-28T00:00:00Z'};
const projected=projectStudioAuthoringView({authored:row.outputs.studio_authored,spatial:row.outputs.drawing_object_first});if(!projected.ok)throw Error(projected.message);
function edit(){const value=addWebsitePergola(createStudioAuthoringEdit(projected.ok?projected.value:never()),'p');const design=value.objectOptions[0].values.websiteDesign as any;design.rawDimensions={widthMm:'6000',projectionMm:'4000'};return value;}
function never():never{throw Error('fixture');}
const unit:StudioTravelReceipt={schemaVersion:'studio_travel_receipt.v1',policyVersion:'studio-travel-local.v1',base:'71G Montgomerie Rd, Mangere, Auckland',projectId:'proj_10000000-0000-4000-8000-000000000001',destinationCanonical:'12 Example Road, Auckland',placeId:'synthetic',drivingCostPerRoundTripCents:5415,overnightEligible:false,proof:'a'.repeat(64)};
it('derives current 6x4 site days and the financial travel amount from the canonical calculation before the atomic Save prediction',()=>{
 const original=edit(),plan=studioTravelPlanForReceipt(undefined,unit,9);original.site={...original.site,travelAllowance:plan,travelExGst:(studioTravelTotalCents(plan)/100).toFixed(2)};
 const days=studioInstallationEstimate(calculateStudioCommercialPricing(original,config).siteOutput)!.siteDays;
 const normalized=normalizeStudioAtomicTravel(original,config);expect(normalized.edit.site.travelAllowance).toMatchObject({plannedRoundTrips:String(days),tripCountSource:'site_days'});expect(Number(normalized.edit.site.travelExGst)).toBe(days*54.15);
 const command={requestId:'10000000-0000-4000-8000-000000000002',expectedRevision:original.revision,expectedUpdatedAt:row.updated_at,edit:normalized.edit};
 const saved=prepareStudioAtomicSource(row,command);expect(saved.save.authored.revision).toBe(original.revision);expect(saved.authored.revision).toBe(original.revision+1);expect(saved.authored.site.values.travelAllowance).toMatchObject({plannedRoundTrips:String(days)});
 expect(studioTravelTripPlanIssue(normalized.edit.site.travelAllowance,days)).toBeNull();
 const current=normalizeStudioAtomicTravel(normalized.edit,config);expect(current.edit).toBe(normalized.edit);expect(current.price?.siteOutput).toBeDefined();
});
it('retains explicit trip overrides and overnight actual journeys instead of deriving daily trips',()=>{
 for(const plan of [{tripCountSource:'manual' as const,plannedRoundTrips:'2',plannedNights:'0'},{tripCountSource:'overnight' as const,plannedRoundTrips:'1',plannedNights:'2'}]){
  const original=edit();const allowance={mode:'automatic' as const,receipt:unit,...plan};original.site={...original.site,travelAllowance:allowance,travelExGst:(studioTravelTotalCents(allowance)/100).toFixed(2)};
  expect(normalizeStudioAtomicTravel(original,config).edit).toBe(original);
 }
});
it('refuses a stale CAS and keeps retained unsupported travel invalid',()=>{
 const value=edit();expect(()=>prepareStudioAtomicSource(row,{requestId:'10000000-0000-4000-8000-000000000002',expectedRevision:value.revision,expectedUpdatedAt:'2026-10-27T00:00:00Z',edit:value})).toThrow('saved design changed');
 value.site.travelAllowance={mode:'automatic',broken:true};expect(()=>normalizeStudioAtomicTravel(value,config)).toThrow('Travel details');
});
