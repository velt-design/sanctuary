import 'server-only';
import {jsonError,jsonOk,type requireStaffContext} from '@/lib/api/staffApi';
import type {websiteComposition} from './websiteComposition';
import type {resolveStudioWebsiteDesign} from './websiteDesign';
import type {calculateStudioCommercialPricing,prepareStudioCommercialPricing} from './studioCommercialPricing.server';
import {isStudioObject} from './contracts';
import {verifyStudioTravelForProject} from './studioTravelReceipt.server';
import {studioInstallationEstimate} from './studioInstallationEstimate';
import {studioTravelTripPlanIssue} from './studioTravelPlan';

type Caller=Extract<Awaited<ReturnType<typeof requireStaffContext>>,{ok:true}>;
export type StudioWebsitePricePayload={designId:string;revision:number;requestKey:string;composition?:unknown;design?:unknown};
type Calculation={projectId?:string;body:StudioWebsitePricePayload;composition:ReturnType<typeof websiteComposition>|null;preparedPricing:ReturnType<typeof prepareStudioCommercialPricing>|null;resolved:ReturnType<typeof resolveStudioWebsiteDesign>|null;signal?:AbortSignal};

/** Canonical composition preparation stays deferred until the public DTO. */
export async function studioPriceComposition(outputs:Record<string,unknown>,edit:unknown){
 const [{mergeStudioAuthoringEdit,projectStudioAuthoringView,createStudioAuthoringEdit},{prepareStudioCommercialPricing}]=await Promise.all([import('./authoringView'),import('./studioCommercialPricing.server')]);
 const merged=mergeStudioAuthoringEdit({storedAuthored:outputs.studio_authored,storedSpatial:outputs.drawing_object_first,edit});
 if(!merged.ok)return{ok:false as const,message:merged.message,status:merged.code==='STUDIO_STALE'?409:422};
 const projected=projectStudioAuthoringView({authored:merged.value.authored,spatial:merged.value.spatial});
 if(!projected.ok)return{ok:false as const,message:projected.message,status:422};
 if(projected.value.spatial.decks.length||projected.value.spatial.openings.length)return{ok:false as const,message:'This design contains scope not supported by configured pricing.',status:422};
 const preparedPricing=prepareStudioCommercialPricing(createStudioAuthoringEdit(projected.value)),composition=preparedPricing.composition;
 if(composition.some(item=>item.error||!item.design))return{ok:false as const,message:composition.find(item=>item.error)?.error??'Add a valid pergola before calculating.',status:422};
 if(preparedPricing.eligibility)return{ok:false as const,message:preparedPricing.eligibility,status:422};
 return{ok:true as const,composition,preparedPricing};
}

async function readPublication(auth:Caller,signal?:AbortSignal){
 signal?.throwIfAborted();
 const query=auth.supabase.from('costing_configuration_publication').select('current_version_id,version:costing_configuration_versions(*)').eq('singleton',true);
 const publication=await(signal?query.abortSignal(signal):query).maybeSingle();
 signal?.throwIfAborted();return publication;
}

/** One request, one fresh caller-RLS read, one calculation. No supplied resolved
 * configuration or raw publication can enter the general calculation API. */
export function startStudioOpeningPricing(auth:Caller,requestSignal:AbortSignal,projectId?:string){
 const controller=new AbortController();let readComplete=false,retired=false,claimed=false;
 const cancel=()=>{if(retired)return;retired=true;if(!readComplete)controller.abort();requestSignal.removeEventListener('abort',cancel);};
 requestSignal.addEventListener('abort',cancel,{once:true});if(requestSignal.aborted)cancel();
 const pending=readPublication(auth,controller.signal).then(value=>{readComplete=true;return{ok:true as const,value};},error=>{readComplete=true;return{ok:false as const,error};});
 return{cancel,async calculate(args:Calculation){
  if(retired||claimed)throw Error('Opening pricing has retired.');claimed=true;
  const abort=()=>cancel();args.signal?.addEventListener('abort',abort,{once:true});if(args.signal?.aborted)cancel();
  try{const result=await pending;if(retired)throw Error('Opening pricing has retired.');if(!result.ok)throw result.error;return await calculateWithPublication({auth,projectId,...args},result.value);}
  finally{args.signal?.removeEventListener('abort',abort);cancel();}
 }};
}

/** Default POST retains its fresh late publication read and independent guard. */
export async function calculateStudioWebsitePrice(args:Calculation&{auth:Caller}){
 return calculateWithPublication(args,await readPublication(args.auth,args.signal));
}

async function calculateWithPublication(args:Calculation&{auth:Caller},publication:Awaited<ReturnType<typeof readPublication>>){
 const {auth,body,composition,preparedPricing,resolved}=args;args.signal?.throwIfAborted();
 const [{calculateConfiguratorPricing},{resolvePublishedCostingConfigurationRecordV1},{mapCostingConfigurationVersion},{quoteReviewDigest},{studioPriceAssumptions},{studioInternalCostSummary}]=await Promise.all([import('@sp/configurator/server'),import('@sp/costing/server'),import('@/lib/costing/configurationShared'),import('./quoteReviewDigest.server'),import('./studioPriceAssumptions'),import('./studioInternalCostSummary.server')]);
 args.signal?.throwIfAborted();
  if (publication.error || !publication.data?.current_version_id) return jsonError('Published pricing is unavailable. Your design is kept.', 503);
  if (!isStudioObject(publication.data.version) || publication.data.version.id !== publication.data.current_version_id)
    throw Error('The published pricing version could not be verified.');
  const version = mapCostingConfigurationVersion(publication.data.version);
  const published = resolvePublishedCostingConfigurationRecordV1(version);
  if (!published.config.accessoryRates || !published.config.installedSellingRates) return jsonError('The published accessory schedules are incomplete.', 503);
  let calculation, commercialCalculation:ReturnType<typeof calculateStudioCommercialPricing>|undefined;
  try {
    commercialCalculation = preparedPricing ? preparedPricing.calculate(published.config) : undefined;
    calculation = commercialCalculation ? { ...commercialCalculation, excluded: [] }
    : calculateConfiguratorPricing(resolved!.ok ? resolved!.value : (()=>{throw Error('Invalid design');})(), published.config).estimate; }
  catch(error) { return jsonError(error instanceof Error ? error.message : 'Check design and site selections.',422); }
  const identity = { requestKey: body.requestKey, designId: body.designId, revision: body.revision, ...(composition ? {} : {objectId:(body.design as Record<string,unknown>).objectId}),
    selectionDigest: quoteReviewDigest(composition ? body.composition : resolved!.ok ? resolved!.value : null), publicationId: publication.data.current_version_id, versionNumber: published.provenance.versionNumber,
    publicationContentHash: published.provenance.contentHash,
    pricingDigest: quoteReviewDigest({ selection:composition ? body.composition : resolved!.ok ? resolved!.value : null, publication:published.provenance }) };
  // Installation days belong to this fresh calculation. Return only the safe
  // operational estimate while travel catches up, never a price for an old plan.
  const installationEstimate=commercialCalculation ? studioInstallationEstimate(commercialCalculation.siteOutput) : null;
  const installation=installationEstimate ? {installationEstimate} : {};
  if(preparedPricing&&(preparedPricing.site.travelAllowance!==undefined||preparedPricing.site.siteAddressProof!==undefined)){
    try{
      if(!args.projectId)throw Error('The travel project could not be verified.');
      await verifyStudioTravelForProject(auth.supabase,args.projectId,preparedPricing.site,args.signal);
      const issue=studioTravelTripPlanIssue(preparedPricing.site.travelAllowance,installationEstimate?.siteDays??null);
      if(issue)throw Error(issue.message);
    }catch(error){return jsonOk({...identity,...installation,status:'unavailable',amount:null,reason:error instanceof Error?error.message:'Check the travel plan.'});}
  }
  if (calculation.status !== 'priced') return jsonOk({ ...identity, status: 'unavailable', amount: null, reason: calculation.status === 'custom' ? calculation.reason : 'This design cannot currently be priced.' });
  if (calculation.excluded.length) return jsonOk({ ...identity, status: 'unavailable', amount: null, reason: calculation.excluded.join(' ') });
  const internalCosts = commercialCalculation ? studioInternalCostSummary(auth.session.role, commercialCalculation) : undefined;
  return jsonOk({ ...identity,...installation, status: 'priced', amount: calculation.amount, breakdown: calculation.breakdown, basis: calculation.basis, ...(commercialCalculation ? {siteAssumptions:studioPriceAssumptions(commercialCalculation.siteInputs)} : {}), ...(internalCosts ? {internalCosts} : {}) });
}
