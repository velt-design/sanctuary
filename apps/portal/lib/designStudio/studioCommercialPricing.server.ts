import 'server-only';
import { calculateConfiguratorCompositionPricing, type ConfiguratorCommercialOptions } from '@sp/configurator/server';
import { calculateCustomerPriceFromCostEx, calculateSiteCostV1, calculateInfillsTakeoffV1, MAX_CUSTOMER_PRICE_DISCOUNT_PCT, priceAllBlinds,
  type AccessoryReviewLine, type BlindLineItemInput, type CostingConfigV1, type SiteInputsV1 } from '@sp/costing';
import type { StudioAuthoringEdit } from './authoringView';
import { isStudioObject } from './contracts';
import { studioHouseScene } from './studioHouseScene';
import { solveStudioHouse } from './studioHouseGeometry';
import { websiteComposition } from './websiteComposition';
import { websiteCompositionPriceEligibility } from './websiteCompositionEligibility';
import { resolveStudioStandaloneInfillSelections } from './standaloneInfillSelections';
import { studioStandaloneSelections } from './quoteStandaloneSelections';

function number(value: unknown, label: string, optional = true): number {
  if (optional && (value === undefined || value === '')) return 0;
  if (typeof value !== 'string' || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) || !Number.isFinite(Number(value))) throw Error(`Enter a valid ${label}.`);
  return Number(value);
}

/** Site inputs remain separate from geometry. Missing fields retain the website's
 * published assumptions; explicit choices use the existing staff costing owners. */
export function studioCommercialOptions(site: StudioAuthoringEdit['site']): ConfiguratorCommercialOptions {
  const result: ConfiguratorCommercialOptions = { site: {} };
  for (const [key, target, choices] of [
    ['jobType', 'job_type', ['residential', 'commercial']],
    ['pricingClassification', 'pricing_classification', ['simple', 'bespoke']],
    ['approvalRequirement', 'approval_requirement', ['neither', 'engineering_required', 'full_building_consent']],
  ] as const) {
    const raw = site[key];
    if (raw !== undefined) {
      if (typeof raw !== 'string' || !(choices as readonly string[]).includes(raw)) throw Error(`Select a valid ${key}.`);
      Object.assign(result.site!, { [target]: raw });
    }
  }
  if (site.access !== undefined) {
    if (!['easy', 'normal', 'hard'].includes(String(site.access))) throw Error('Select site access.');
    result.access = site.access as ConfiguratorCommercialOptions['access'];
  }
  if (site.height !== undefined) {
    if (!['single_storey', 'two_storey'].includes(String(site.height))) throw Error('Select building height.');
    result.height = site.height as ConfiguratorCommercialOptions['height'];
  }
  result.site!.travel_ex_gst = number(site.travelExGst, 'travel cost');
  result.site!.extras_allowance_ex_gst = number(site.extrasAllowanceExGst, 'extra cost allowance');
  return result;
}

function validateHouses(edit: StudioAuthoringEdit) {
  const houseScene = studioHouseScene(edit.site, edit.spatial);
  for (const house of houseScene?.houses ?? []) solveStudioHouse(house);
}

function prepareComposition(edit: StudioAuthoringEdit) {
  const objects = websiteComposition(edit);
  const invalid = objects.find(object => object.error || !object.design);
  const eligibility = !invalid && objects.length ? websiteCompositionPriceEligibility(objects, edit.site.websiteJoins) : null;
  return { objects, eligibility };
}

/** Request-local preparation owns its snapshot and validation. Inspection rows
 * and returned calculations cannot mutate the private next calculation. Rates
 * are supplied afresh, never captured in this capability. */
export function prepareStudioCommercialPricing(edit: StudioAuthoringEdit) {
  const snapshot = structuredClone(edit), prepared = prepareComposition(snapshot);
  return Object.freeze({
    site: structuredClone(snapshot.site),
    composition: structuredClone(prepared.objects),
    eligibility: prepared.eligibility,
    calculate(config: CostingConfigV1) {
      validateHouses(snapshot);
      return calculatePreparedCommercialPricing(structuredClone(snapshot), structuredClone(prepared.objects), prepared.eligibility, config);
    },
  });
}

/** Ordinary quote callers retain house-first refusal ordering and prepare their
 * own current edit. Only the website request reuses its earlier preparation. */
export function calculateStudioCommercialPricing(edit: StudioAuthoringEdit, config: CostingConfigV1) {
  validateHouses(edit);
  const prepared = prepareComposition(edit);
  return calculatePreparedCommercialPricing(edit, prepared.objects, prepared.eligibility, config);
}

function calculatePreparedCommercialPricing(edit: StudioAuthoringEdit, objects: ReturnType<typeof websiteComposition>, eligibility: string | null, config: CostingConfigV1) {
  const invalid = objects.find(object => object.error || !object.design);
  if (invalid) throw Error(invalid.error ?? 'Complete the pergola selections.');
  if (eligibility) throw Error(eligibility);
  if (edit.spatial.decks.length || edit.spatial.openings.length) throw Error('This design contains unsupported scope. Its original values are retained.');
  const options = studioCommercialOptions(edit.site);
  const discount = number(edit.site.quoteDiscountPct, 'quote discount');
  if (discount > MAX_CUSTOMER_PRICE_DISCOUNT_PCT) throw Error(`Discount must be between 0 and ${MAX_CUSTOMER_PRICE_DISCOUNT_PCT}%.`);
  const result = objects.length ? calculateConfiguratorCompositionPricing(objects.map(object => ({
    objectId: object.object.id, name: object.object.label, design: object.design!, geometryOptions: object.geometryOptions,
  })), config, options) : null;
  if (result && (result.estimate.status !== 'priced' || result.estimate.excluded.length)) throw Error(result.estimate.status === 'priced'
    ? result.estimate.excluded.join(' ') : result.estimate.status === 'custom' ? result.estimate.reason : 'Pricing unavailable.');
  const site: SiteInputsV1 = result?.siteInputs ?? { ...options.site, pergolas: [] };
  const lines: AccessoryReviewLine[] = result?.estimate.status === 'priced' ? [...result.estimate.breakdown ?? []] : [];
  const extraSite = structuredClone(site);
  const infills = resolveStudioStandaloneInfillSelections(edit.site);
  if (infills) {
    const takeoff = calculateInfillsTakeoffV1(infills.infills, { scope_id: 'standalone', extrusion_colour: infills.finish.extrusion_colour }, config);
    if (takeoff.status === 'blocked') throw Error(takeoff.warnings.filter(w => w.level === 'critical').map(w => w.message).join(' '));
    extraSite.standalone_infills = { infills: infills.infills.map(input => {
      const resolved = takeoff.items.find(item => item.infill_id === input.id);
      if (!resolved) throw Error('The standalone infill could not be resolved.');
      return { ...input, acrylic_source: resolved.resolved_acrylic_source, panel_orientation: resolved.resolved_orientation };
    }), ...infills.finish, ...infills.site };
  }
  const aluminium = edit.site.additionalAluminium;
  if (aluminium !== undefined) {
    if (!isStudioObject(aluminium) || !Array.isArray(aluminium.rows)) throw Error('Check additional aluminium.');
    const rows = aluminium.rows.map(row => {
      if (!isStudioObject(row) || typeof row.id !== 'string' || typeof row.profile !== 'string') throw Error('Check additional aluminium rows.');
      const stock_length_m = number(row.stockLengthM, 'stock length', false), quantity = number(row.quantity, 'stock quantity', false);
      if (stock_length_m <= 0 || !Number.isInteger(quantity) || quantity < 1) throw Error('Enter a positive stock length and whole bar quantity.');
      return { id: row.id, profile: row.profile, stock_length_m, quantity };
    });
    if (rows.length) {
      if (!['Black', 'White', 'Mill'].includes(String(aluminium.extrusionColour))) throw Error('Select the aluminium finish.');
      extraSite.additional_aluminium = { rows, extrusion_colour: aluminium.extrusionColour as 'Black' | 'White' | 'Mill',
        powdercoat_standard_colour: String(aluminium.powdercoatStandardColour ?? ''), powdercoat_is_custom: aluminium.powdercoatIsCustom === true,
        powdercoat_custom_colour: String(aluminium.powdercoatCustomColour ?? '') };
    }
  }
  const output = calculateSiteCostV1(extraSite, config);
  if (output.totals.warnings.length || output.infill_takeoff?.status === 'blocked') throw Error('The site costing has unresolved items. Check the selections before quoting.');
  if (extraSite.additional_aluminium || extraSite.standalone_infills || !objects.length) {
    const baseline = objects.length ? calculateSiteCostV1(site, config) : null;
    const cost = output.totals.cost_ex_gst - (baseline?.totals.cost_ex_gst ?? 0)
      - (output.overhead.sales_ex_gst - (baseline?.overhead.sales_ex_gst ?? 0));
    if (cost > 0) {
      const price = calculateCustomerPriceFromCostEx(cost, 0, output.pricing_policy?.customer_price_uplift_pct, output.pricing_policy?.customer_price_multiplier);
      if (!price) throw Error('Additional scope pricing unavailable.');
      lines.push({ label: 'Additional site scope', amount: price.incGst, provisional: false, detail: 'Selected standalone infills, aluminium and site allowances.' });
    }
  }
  // Existing staff discount sequence, applied to the configured selling amount.
  // Fixed supplier-installed blind prices and approval allowances keep their existing exclusions.
  const discounted = lines.map(line => ({ ...line, amount: discount ? calculateCustomerPriceFromCostEx(line.amount / 1.15, discount, 0, 1)!.incGst : line.amount }));
  const blinds = isStudioObject(edit.site.blinds) && Array.isArray(edit.site.blinds.items) ? edit.site.blinds.items : [];
  const blindInputs = blinds.map(row => {
    if (!isStudioObject(row)) throw Error('Check the standalone blinds.');
    return { ...row, widthMm: number(row.widthMm, 'blind width', false), coverLengthMm: number(row.coverLengthMm, 'blind drop', false), motorised: row.motorised === 'YES' } as BlindLineItemInput;
  });
  if (blindInputs.length) {
    if (!config.installedSellingRates?.blinds) throw Error('Published blind pricing is unavailable.');
    for (const blind of priceAllBlinds(blindInputs, config.installedSellingRates.blinds).items) {
      if (blind.errors.length) throw Error(`${blind.label || 'Blind'}: ${blind.errors.join(' ')}`);
      discounted.push({ label: blind.label || 'Standalone blind', amount: blind.blindSellIncCents / 100, provisional: false,
        detail: `${blind.system} · ${blind.widthMm} × ${blind.coverLengthMm} mm` });
    }
  }
  const approval = output.customer_add_ons?.approval;
  if (approval) discounted.push({ label: approval.requirement === 'engineering_required' ? 'Engineering allowance' : 'Building consent allowance',
    amount: approval.sell_inc_gst, provisional: true, detail: 'Published allowance. Final requirements remain subject to assessment.' });
  const amount = Math.round(discounted.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
  if (amount <= 0) throw Error('Add a priced design or site item before preparing a quote.');
  return { status: 'priced' as const, amount, breakdown: discounted, basis: 'Published configured offer and selected staff site inputs. Existing house excluded.',
    approvalRequirement: site.approval_requirement ?? 'neither', approvalIncGstCents: Math.round((approval?.sell_inc_gst ?? 0) * 100),
    siteInputs: extraSite, siteOutput: output, resolvedObjects: objects,
    customerStandaloneSelections: studioStandaloneSelections(extraSite, blindInputs) };
}
