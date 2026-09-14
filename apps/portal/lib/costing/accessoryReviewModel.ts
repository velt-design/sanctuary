import { ACCESSORY_REVIEW_RATES as rates, reviewSlatCost, reviewAccessoryAssemblyCost, calculateCustomerPriceFromCostEx } from '@sp/costing';

export type ReviewItem = {
  id: string; title: string; status: 'Rate conflict' | 'Needs supplier quote' | 'Check scope';
  supply: string; installation: string; evidence: string; next: string;
  example?: { scope: string; cost: number };
};

// Evidence transcribed from supplier documents; dates refer to those documents, not live quotes.
// This review deliberately contains no customer identifiers or invoice attachments.
export function accessoryReviewItems(): ReviewItem[] {
  return [
    {
      id: 'cedar', title: 'Cedar battens', status: 'Rate conflict',
      supply: `39 × 39: $${rates.timberSupplyPerM['39x39']}/m; 65 × 39: $${rates.timberSupplyPerM['65x39']}/m; 90 × 39: $${rates.timberSupplyPerM['90x39']}/m. Before selected lengths, waste and coating.`,
      installation: timberInstallation(),
      evidence: 'Mitre 10 invoice 99649843, 23 July 2026: clear-coated J111 65 × 39, 329.4 m at $36.08/m excluding GST. This exceeds the current allowance, even after its length, waste and coating additions. Other sections are not verified.',
      next: 'Confirm repeat-order pricing for each section. Use a coated supply rate without adding coating again; confirm whether selected lengths are already included.',
      example: timberExample('cedar'),
    },
    {
      id: 'thermopine', title: 'ThermoPine battens', status: 'Needs supplier quote',
      supply: `39 × 39: $${rates.thermopineSupplyPerM['39x39']}/m; 65 × 39: $${rates.thermopineSupplyPerM['65x39']}/m; 90 × 39: $${rates.thermopineSupplyPerM['90x39']}/m. Provisional allowances.`,
      installation: timberInstallation(),
      evidence: 'These allowances were estimated from the relationship between JSC ceiling prices. The ceiling price list does not quote these batten sections or establish availability.',
      next: 'Obtain a coated, selected-length quote and confirm available batten profiles before approving customer prices.',
      example: timberExample('thermopine'),
    },
    {
      id: 'aluminium', title: 'Aluminium side slats', status: 'Needs supplier quote',
      supply: `50 × 10: $${rates.aluminiumSupplyPerM['50x10']}/m; 65 × 16: $${rates.aluminiumSupplyPerM['65x16']}/m, plus 10% waste.`,
      installation: `$${rates.aluminiumFitPerM}/m fitting, $${rates.panelSetup} panel setup; support frame $${rates.frameSupplyAndFitPerM}/m supplied and fitted.`,
      evidence: 'Profile drawings establish dimensions. Matching extrusion and powder-coating invoices have not been verified for these allowances.',
      next: 'Confirm finished extrusion cost and time to assemble a representative panel. Check support quantities against the opening.',
      example: { scope: 'Illustrative panel: 50 m of 65 × 16 slats, 10 m support frame, one setup.', cost: reviewSlatCost({ material: 'aluminium', profile: '65x16', lengthM: 50, frameM: 10 }) },
    },
    {
      id: 'ceiling', title: 'Ceiling downlights', status: 'Needs supplier quote',
      supply: `$${rates.cedarLightSupplyAndFitEach} per light, combined supply and fitting allowance. Applies to either timber ceiling.`,
      installation: 'Fitting is already in the unit allowance. Electrical connection is separate and must not be duplicated across lighting types.',
      evidence: 'No matching fitting or electrical quote verified. Supply and labour cannot yet be separated reliably.',
      next: 'Confirm the 110 mm fitting, driver requirements and electrician scope.',
      example: { scope: 'Four ceiling downlights; excludes shared electrical connection.', cost: reviewAccessoryAssemblyCost({ cedarLights: 4 }) },
    },
    {
      id: 'led', title: 'LED strips', status: 'Needs supplier quote',
      supply: `$${rates.ledSupplyChannelAndFitPerM}/m including channel and fitting; $${rates.ledDriverPerRun} per run.`,
      installation: `Shared electrical connection allowance: $${rates.electricalConnection}. Supply and fitting within the strip rate are not separately evidenced.`,
      evidence: '16 × 16 mm channel and full-member warm-white strips are specified. Matching supplier and electrical costs remain unverified.',
      next: 'Confirm strip, channel, driver capacity, wiring and connection scope; check whether each run actually needs a separate driver.',
      example: { scope: '12 m strip across three runs; excludes shared electrical connection.', cost: reviewAccessoryAssemblyCost({ ledM: 12, ledRuns: 3 }) },
    },
    {
      id: 'installed', title: 'Ziptrak and rafter lights', status: 'Check scope',
      supply: 'Use the portal’s installed selling schedules. These are not raw supplier costs.',
      installation: 'Installation is included. Do not add a second blind or rafter-light installation charge.',
      evidence: 'Shade Elements INV-SE026151, July 2026: 3745 × 2100 Urban manual blind with front flashing, $1,672.24 excluding GST after supplier discount. Fabric and cover mapping still need checking. Rafter-light supplier costs are not verified.',
      next: 'Reconcile exact fabric, roll cover and dimensions. Separate the installer payout internally before judging remaining margin; do not infer supplier cost by reversing a markup.',
    },
  ];
}

function timberInstallation() {
  return `${rates.timberCutMinutes} minutes/cut, ${rates.timberFixMinutes} minutes/fixing at $${rates.timberLabourPerHour}/hour; ${rates.timberSetupHours} hour setup, $${rates.timberFixingsPerPoint}/fixing. Length allowance ×${rates.selectedTimberLengthFactor}, waste ×${rates.wasteFactor}, coating $${rates.timberCoatingPerM}/m.`;
}

function timberExample(species: 'cedar' | 'thermopine') {
  return { scope: 'Illustrative panel: 50 m of 65 × 39, 20 cut pieces, 60 fixings, 10 m support frame, one setup.',
    cost: reviewSlatCost({ material: 'timber', species, profile: '65x39', lengthM: 50, cutPieces: 20, fixingPoints: 60, frameM: 10 }) };
}

export function reviewExamplePrice(cost: number) {
  // Explicit comparison scenario, not a resolved published pricebook policy.
  const price = calculateCustomerPriceFromCostEx(cost, 0, 0, 1.3)!;
  return { ...price, remainingEx: price.exGst - cost };
}
