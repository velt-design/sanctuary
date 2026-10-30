import type { AccessoryReviewLine } from '@sp/costing';
import type { StudioQuoteView } from '@sp/quote-format';

function customerAccessoryDetail(line:AccessoryReviewLine){
  if(line.label==='Additional site scope')return 'Additional items and site allowances as specified in this quote.';
  if(line.label.includes('Rafter lighting'))return 'Selected rafter lights, including installation, startup and required drivers.';
  if(line.label.includes('Ceiling downlights'))return 'Supply and installation allowance for the selected 110 mm ceiling downlights.';
  if(line.label.includes('LED strips'))return 'Allowance for the selected LED strips, 16 × 16 channels, fitting and drivers.';
  return line.detail
    .replace(/^Published allowance\./, 'Allowance.')
    .replace('Portal manual-blind price including', 'Manual blinds including')
    .replace('Fabric-group mapping and pelmet kit scope remain provisional', 'Fabric selection and pelmet kit scope remain provisional')
    .replace('Portal takeoff prices internal supports separately.', 'Internal supports are listed separately.')
    .replace('Portal infill takeoff, sheet allowance,', 'Acrylic panels and infills, sheet allowance,')
    .replace('including one shared site setup and the published installation allowances', 'including setup and installation allowances');
}

/** Customer scope stays separate from the staff explanation of the pricing policy. */
export function studioCustomerQuoteLines(breakdown: AccessoryReviewLine[], pergolaCount: number, standaloneSelections: StudioQuoteView['selections'] = []) {
  const chargedStandaloneScope = standaloneSelections
    .filter(row => row.label.startsWith('Standalone aluminium') || row.label.startsWith('Standalone infill'))
    .map(row => `${row.label}: ${row.details.join('; ')}`).join('\n- ');
  return breakdown.map((line, sortOrder) => {
    const detail = line.label === 'Additional site scope' && chargedStandaloneScope
      ? chargedStandaloneScope
      : sortOrder === 0 && pergolaCount > 0
      ? `${pergolaCount} ${pergolaCount === 1 ? 'pergola' : 'pergolas'} with the selected roofs and ceilings where specified. Dimensions, finishes and accessories are shown in the saved design.`
      : customerAccessoryDetail(line);
    return { description: `${line.label}${line.provisional ? ' (allowance)' : ''}\n- ${detail}`,
      qty: 1, unitPriceIncGstCents: Math.round(line.amount * 100), lineTotalIncGstCents: Math.round(line.amount * 100), sortOrder };
  });
}
