import 'server-only';
import { calculateConfiguredCustomerPriceV1, loadCostingConfigV1, type CostingConfigV1, type SiteInputsV1 } from '@sp/costing';
import { buildSimpleCoverSiteInputs, getSimpleCoverCustomResult } from './simpleCoverCalculator';
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';
import { getRoofFinish } from '../components/configurator-prototype/roofFinish';
import { solvePergolaPreview } from '../components/configurator-prototype/solvePreview';
import { hasLighting } from '../components/configurator-prototype/lightingSelection';
import { configuratorAccessoryReview } from './configuratorAccessoryReview';
import type { AccessoryReviewLine } from '@sp/costing';

export type ReviewPrice = { status: 'priced'; amount: number; excluded: string[]; basis: string; breakdown?: AccessoryReviewLine[] }
  | { status: 'custom'; reason: string } | { status: 'unavailable' };

/** Owner review adapter. Repository pricebook only; never a frozen customer quote. */
export function buildReviewSiteInputs({ input, roof }: PreviewDraft): SiteInputsV1 {
  const site = buildSimpleCoverSiteInputs(input);
  const module = site.pergolas[0].modules[0];
  const finish = getRoofFinish(roof);
  const away = roof.family === 'gable' && roof.orientation === 'away';
  module.length_m = (away ? input.projectionMm : input.widthMm) / 1000;
  module.roof_span_m = (away ? input.widthMm : input.projectionMm) / 1000;
  module.pergola_style = roof.family === 'mono' ? 'pitched' : roof.family === 'box' ? 'box_perimeter' : 'gable';
  module.roof_pitch_deg = roof.family === 'gable' ? 25 : 3;
  module.roof_material = finish.material === 'acrylic' ? 'acrylic' : finish.material === 'solid' ? 'timber' : 'mixed';
  module.box_perimeter_enabled = roof.family === 'box';
  // Let the shared calculator derive structure-specific post layout and flashings.
  if (roof.family !== 'mono') { delete module.post_count; delete module.flashings; }
  if (finish.material !== 'acrylic') {
    module.ceiling = { option: finish.ceiling ?? 'cedar-100' };
    module.timber_roof_above_type = finish.profile === 'tray' ? 'steel_tray' : 'steel_corrugated';
    module.timber_tray_width_mm = finish.trayWidth;
    delete module.flashings;
    if (finish.material === 'combination') {
      const geometry = solvePergolaPreview(input, roof).geometry;
      if (!geometry?.covering) throw new Error('Missing mixed roof regions');
      const counts = geometry.assembly.roofPlanes.map((_, index) =>
        geometry.assembly.roofCladdingPanels.filter(panel => panel.id.startsWith(`finish-acrylic-${index}-`)).length);
      if (!counts.length || counts.some(count => count < 1)) throw new Error('Missing mixed roof acrylic bays');
      if (counts.length > 2) throw new Error('Unsupported mixed roof plane count');
      module.mixed_roof = { mode: 'acrylic_bays', acrylic_bays_by_plane: counts.length === 1
        ? { main: counts[0] } : { A: counts[0], B: counts[1] } };
    }
  }
  if (roof.family === 'box') {
    const solved = solvePergolaPreview(input, roof).geometry;
    if (!solved) throw new Error('Invalid box geometry');
    module.internal_roof_type = solved.assembly.roofPlanes.length > 1 ? 'gable' : 'pitched';
    const normal = solved.assembly.roofPlanes[0].plane.normal;
    module.roof_pitch_deg = Math.atan2(Math.hypot(normal.x, normal.y), Math.abs(normal.z)) * 180 / Math.PI;
  }
  if (roof.attachmentIntent === 'freestanding') {
    module.house_connection_type = 'none';
    module.post_connection_type = 'pile_1_5m';
    module.attachment_length_mm = 0;
    const geometry = solvePergolaPreview(input, roof).geometry;
    if (!geometry) throw new Error('Missing freestanding geometry');
    module.post_count = geometry.assembly.members.filter(member => member.role === 'post').length;
    delete module.flashings;
  }
  site.pricing_classification = roof.family === 'mono' && finish.material === 'acrylic' ? 'simple' : 'bespoke';
  return site;
}

/** One calculation path for owner review and explicitly approved published configuration. */
export function calculateConfiguratorPricing(draft: PreviewDraft, config: CostingConfigV1): {
  estimate: ReviewPrice; siteInputs?: SiteInputsV1; base?: ReturnType<typeof calculateConfiguredCustomerPriceV1>;
} {
  if (draft.roof.attachmentIntent === 'unsure') {
    const connections = draft.roof.family === 'gable' && draft.roof.orientation === 'away'
      ? ['fascia'] as const
      : (['facade','fascia','soffit'] as const).filter(connection =>
        !(draft.roof.family === 'box' && connection === 'fascia') && !(connection === 'soffit' && draft.input.projectionMm > 4000));
    const options = connections.map(connection => calculateConfiguratorPricing({ ...draft,
      input: { ...draft.input, connection }, roof: { ...draft.roof, attachmentIntent: undefined } }, config));
    const priced = options.filter(option => option.estimate.status === 'priced' && !option.estimate.excluded.length);
    return priced.sort((a,b) => (a.estimate.status === 'priced' ? a.estimate.amount : Infinity) - (b.estimate.status === 'priced' ? b.estimate.amount : Infinity))[0]
      ?? options[0] ?? { estimate: { status: 'unavailable' } };
  }
  // Check the unrounded footprint, including exact boundary equality.
  const limit = draft.input.level === 'ground' ? 30 : 20;
  if (draft.input.widthMm * draft.input.projectionMm > limit * 1_000_000) {
    return { estimate: { status: 'custom', reason: getSimpleCoverCustomResult(draft.input)?.reason ?? 'Your design needs a tailored quote.' } };
  }
  const site=buildReviewSiteInputs(draft);
  const base = calculateConfiguredCustomerPriceV1({
    site, config,
    footprintM2: draft.input.widthMm * draft.input.projectionMm / 1_000_000,
    level: draft.input.level,
    roofStyle: draft.roof.family === 'mono' ? 'pitched' : draft.roof.family === 'box' ? 'box_perimeter' : 'gable',
  });
  const { price, costingWarnings } = base;
  if (!price || !Number.isFinite(price.incGst) || price.incGst <= 0) throw new Error('Invalid review price');
  const roof = draft.roof;
  const accessories = roof.blinds?.length || roof.sidePanels?.length || roof.roofBattens || hasLighting(roof.lighting) || roof.infills
    ? configuratorAccessoryReview(draft,site,config) : {lines:[],excluded:[]};
  const breakdown: AccessoryReviewLine[] = [{label:'Pergola, roof & ceiling',amount:Math.round(price.incGst),provisional:false,
    detail:'Current draft pricebook and configured-job policy, including protected base installation.'},...accessories.lines];
  const excluded = [...accessories.excluded];
  if (costingWarnings.length) excluded.push('Base roof costing has unresolved calculation warnings; staff review required before quoting.');
  return { siteInputs: site, base, estimate: { status: 'priced', amount: breakdown.reduce((sum,line)=>sum+line.amount,0), excluded, breakdown,
    basis: 'Draft pricing · Standard calculator allowances · Travel and site-specific work excluded' + (getRoofFinish(roof).material !== 'acrylic' && getRoofFinish(roof).profile === 'trapezoidal' ? ' · Trapezoidal uses the approved corrugated allowance' : '') } };
}

export function calculateReviewPrice(draft: PreviewDraft): ReviewPrice {
  return calculateConfiguratorPricing(draft, loadCostingConfigV1()).estimate;
}
