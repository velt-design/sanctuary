'use client';
import CalculatorActualCostReview from '@/app/staff/calculator/CalculatorActualCostReview';
import type {StudioInternalCostSummary} from '@/lib/designStudio/studioInternalCostSummary.server';
const money=(n:number)=>new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(n);
export default function StudioAdminReview({estimateId,costs}:{estimateId:string;costs?:StudioInternalCostSummary}){
 return <section aria-label="Admin cost review">{costs&&<details><summary>Current engine cost reference</summary><p>Internal amounts excluding GST for the pergolas and selected site scope. Website accessory allowances and supplier-installed extras are excluded. This reference is not the complete job cost or quoted selling price.</p><dl>{([['Materials',costs.materialsExGst],['Installation',costs.installExGst],['Overhead',costs.overheadExGst],['Travel',costs.travelExGst],['Extras',costs.extrasExGst],['Engine total',costs.engineCostExGst]] as const).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}<div><dt>Crew hours</dt><dd>{costs.crewHours.toFixed(2)}</dd></div></dl></details>}<p>Post-job actual costs are saved separately. Unavailable estimated comparisons stay blank; recording actual costs does not change the quote.</p><CalculatorActualCostReview estimateId={estimateId}/></section>;
}
