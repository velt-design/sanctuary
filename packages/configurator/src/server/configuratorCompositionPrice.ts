import {applyConfiguratorCommercialOptions,type ConfiguratorCommercialOptions} from './configuratorCommercial';
import type { PreviewGeometryOptions } from '../geometry';
import 'server-only';
import { accessoryReviewPricer, calculateConfiguredCompositionPriceV1, priceCompositionInfillDelta,
  type AccessoryReviewLine, type CostingConfigV1, type SiteInputsV1 } from '@sp/costing';
import type { WebsiteSubmittedDesignV1 } from '../website/contracts';
import { buildReviewSiteInputs, calculateConfiguratorPricing, type ReviewPrice } from './configuratorReviewPrice';
import { configuratorAccessoryReview } from './configuratorAccessoryReview';

/** Studio-only approved offer. Inputs are complete validated product intents; spatial validation belongs to the caller. */
export function calculateConfiguratorCompositionPricing(objects: {
  objectId: string; name: string; design: WebsiteSubmittedDesignV1; geometryOptions?: PreviewGeometryOptions;
}[], config: CostingConfigV1, commercial?: ConfiguratorCommercialOptions) {
  if (!objects.length || objects.length > 50 || new Set(objects.map(o => o.objectId)).size !== objects.length) throw new Error('Invalid composition objects');
  // Exact singleton/public policy and presentation remain unchanged.
  if (objects.length === 1) return calculateConfiguratorPricing(objects[0].design, config, objects[0].geometryOptions, commercial);
  const standalone = objects.map(object => {
    if (object.design.roof.attachmentIntent === 'unsure') throw new Error(`${object.name}: choose a connection before pricing the whole design.`);
    const result = calculateConfiguratorPricing(object.design, config, object.geometryOptions, {...commercial,site:{...commercial?.site,travel_ex_gst:0,extras_allowance_ex_gst:0,additional_aluminium:undefined,standalone_infills:undefined}});
    if (result.estimate.status !== 'priced' || result.estimate.excluded.length || !result.siteInputs) throw new Error(`${object.name}: ${result.estimate.status === 'priced' ? result.estimate.excluded.join(' ') : 'This product needs pricing review.'}`);
    return { object, site: result.siteInputs };
  });
  const site: SiteInputsV1 = applyConfiguratorCommercialOptions({ ...standalone[0].site, pergolas: standalone.map(({ object, site: own }) => ({ ...own.pergolas[0], id: object.objectId, label: object.name })) },commercial);
  // A mixed composition uses the established bespoke productive-time classification once.
  if (!commercial?.site?.pricing_classification && standalone.some(item => item.site.pricing_classification === 'bespoke')) site.pricing_classification = 'bespoke';
  const base = calculateConfiguredCompositionPriceV1({ site, config, objects: objects.map(({ objectId, design }, index) => ({
    objectId, footprintM2: design.input.widthMm * design.input.projectionMm / 1e6, level: design.input.level,
    roofStyle: design.roof.family === 'mono' ? 'pitched' : design.roof.family === 'box' ? 'box_perimeter' : 'gable',
    pricingClassification: standalone[index].site.pricing_classification,
  })) });
  const accessories = standalone.map(({ object, site: own }) => ({ object,
    result: configuratorAccessoryReview(object.design, own, config, { deferSharedCharges: true, geometryOptions: object.geometryOptions }) }));
  const excluded = accessories.flatMap(({ object, result }) => result.excluded.map(reason => `${object.name}: ${reason}`));
  if (base.costingWarnings.length) excluded.push('Whole-design costing has unresolved calculation warnings.');
  const breakdown: AccessoryReviewLine[] = [{ label: 'Pergolas, roofs & ceilings · whole design', amount: base.price.incGst, provisional: false,
    detail: 'Full independent product scope, shared job operations once and protected installation. No shared-member savings.' },
    ...accessories.flatMap(({ object, result }) => result.lines.map(line => ({ ...line, label: `${object.name} · ${line.label}` })))];
  const infills = priceCompositionInfillDelta(site, accessories.filter(a => a.result.shared.infills.length).map(({ object, result }) => ({
    objectId: object.objectId, moduleIndex: 0, infills: result.shared.infills,
  })), config);
  if (infills) breakdown.push(infills);
  if (accessories.some(a => a.result.shared.needsElectricalConnection) && !accessories.some(a => a.result.shared.hasRafterStartup)) {
    if (!config.accessoryRates) throw new Error('Missing published accessory schedule');
    breakdown.push(accessoryReviewPricer(site, config).allowance('Lighting connection · whole design', config.accessoryRates.electricalConnection,
      'One electrical connection allowance. Existing suitable supply assumed; new circuits and difficult cable routes excluded.'));
  }
  const estimate: ReviewPrice = { status: 'priced', amount: Math.round(breakdown.reduce((sum, line) => sum + line.amount, 0)*100)/100, excluded, breakdown,
    basis: 'Published configured composition offer · shared job operations once · existing house excluded · travel and site-specific work excluded' };
  return { estimate, siteInputs: site, base };
}
