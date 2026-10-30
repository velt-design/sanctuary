import 'server-only';
import type {calculateStudioCommercialPricing} from './studioCommercialPricing.server';

export type StudioInternalCostSummary = {materialsExGst:number;installExGst:number;overheadExGst:number;travelExGst:number;extrasExGst:number;engineCostExGst:number;crewHours:number};

/** A restricted reference to the current engine output, never a complete accessory cost or customer DTO. */
export function studioInternalCostSummary(role:string, calculation:ReturnType<typeof calculateStudioCommercialPricing>):StudioInternalCostSummary|undefined {
 if(role!=='admin')return undefined;
 const output=calculation.siteOutput;
 return {materialsExGst:output.materials.totals.materials_ex_gst,installExGst:output.install.totals.install_ex_gst,
  overheadExGst:output.overhead.total_ex_gst,travelExGst:calculation.siteInputs.travel_ex_gst??0,extrasExGst:calculation.siteInputs.extras_allowance_ex_gst??0,
  engineCostExGst:output.totals.cost_ex_gst,crewHours:output.install.totals.crew_hours};
}
