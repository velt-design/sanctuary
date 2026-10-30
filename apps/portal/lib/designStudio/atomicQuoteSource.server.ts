import 'server-only';
import type {CostingConfigV1} from '@sp/costing';
import {mergeStudioAuthoringEdit,type StudioAuthoringEdit} from './authoringView';
import type {StudioPendingCommand} from './saveTransport';
import {studioCanonicalJson} from './quoteSnapshot';
import {readStudioAuthoredOutputs} from './persistence';
import {calculateStudioCommercialPricing} from './studioCommercialPricing.server';
import {studioInstallationEstimate} from './studioInstallationEstimate';
import {studioTravelPlanWithNights,studioTravelTripPlanIssue} from './studioTravelPlan';
import {parseStudioTravelAllowance,studioTravelTotalCents} from './studioTravelAllowance';

/** Predict the canonical Save result; SQL verifies it against the actual Save
 * receipt and locked source before any snapshot or quote can be committed. */
export function prepareStudioAtomicSource(row:{outputs:any;updated_at:string},command:StudioPendingCommand){
 if(row.updated_at!==command.expectedUpdatedAt)throw Error('The saved design changed. Reload Review before creating the quote.');
 const existing=readStudioAuthoredOutputs(row.outputs??{});
 if(!existing.ok||existing.state!=='authored')throw Error('The saved design cannot be edited.');
 const merged=mergeStudioAuthoringEdit({storedAuthored:row.outputs.studio_authored,storedSpatial:row.outputs.drawing_object_first,edit:command.edit});
 if(!merged.ok)throw Error(merged.message);
 const changed=studioCanonicalJson(merged.value.authored)!==studioCanonicalJson(row.outputs.studio_authored)||studioCanonicalJson(merged.value.spatial)!==studioCanonicalJson(row.outputs.drawing_object_first);
 const revision=command.expectedRevision+(changed?1:0);
 if(!Number.isSafeInteger(revision))throw Error('The design revision is unavailable.');
 return {authored:{...merged.value.authored,revision},spatial:merged.value.spatial,
  save:{requestId:command.requestId,expectedUpdatedAt:command.expectedUpdatedAt,expectedRevision:command.expectedRevision,
    authored:merged.value.authored,spatial:merged.value.spatial,validatedStoredAuthored:existing.authored}};
}

/** Same approved derived-day policy as Review. Overrides and overnight plans
 * retain their authored quantities; missing/legacy/malformed authority is refused. */
export function normalizeStudioAtomicTravel(edit:StudioAuthoringEdit,config:CostingConfigV1){
 if(edit.site.travelAllowance===undefined)return {edit};
 const basis=parseStudioTravelAllowance(edit.site.travelAllowance);
 if(basis.mode!=='automatic'||basis.tripCountSource==='manual'||basis.tripCountSource===undefined)return {edit};
 const price=calculateStudioCommercialPricing(edit,config);
 const days=studioInstallationEstimate(price.siteOutput)?.siteDays??null;
 const issue=studioTravelTripPlanIssue(basis,days);
 if(issue?.kind!=='updating')return {edit,price};
 const travelAllowance=studioTravelPlanWithNights(basis,basis.plannedNights,days);
 return {edit:{...edit,site:{...edit.site,travelAllowance,travelExGst:(studioTravelTotalCents(travelAllowance)/100).toFixed(2)}}};
}
