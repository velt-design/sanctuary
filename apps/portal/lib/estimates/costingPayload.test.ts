import { describe, expect, it } from 'vitest';
import { calculateSiteCostV1 } from '@sp/costing';
import type { CalculatorInputs } from '@/lib/types/calculator';
import { ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY } from './drawingEdits';
import {
  ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY,
  ESTIMATE_PRICING_PRESERVE_REASON_OUTPUT_KEY,
  buildModuleCostInputsFromCalculatorInputs,
  buildEstimatePayloadPreservingCurrentPricing,
  buildEstimatePayloadFromSiteCosting,
  buildSiteInputsFromCalculatorInputs,
  deriveSiteResultWarnings,
  hasPricingAffectingCalculatorInputChanges,
} from './costingPayload';

function makeInputs(): CalculatorInputs {
  return {
    schemaVersion: 'v2',
    projectName: 'Millwater',
    quoteRef: 'Q-1000',
    access: 'normal',
    height: 'single_storey',
    jobType: 'residential',
    travelExGst: '12',
    extrasAllowanceExGst: '45',
    quoteDiscountPct: '5',
    pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
    modules: [
      {
        pergolaId: 'pergola-1',
        pergolaStyle: 'gable',
        roofMaterial: 'acrylic',
        extrusionColour: 'White',
        boxPerimeterEnabled: false,
        internalRoofType: 'pitched',
        fallDistanceMm: '0',
        roofPitchDeg: '25',
        gableEndFramesMode: 'outer_end_only',
        gableHouseEdgeGutter: 'house',
        gableOuterEdgeGutter: 'our',
        boxGutterHouseEdge: 'house',
        boxGutterFarEdge: 'our',
        downpipeCount: '0',
        downpipeJoinCount: '0',
        downpipeElbowCount: '0',
        separateGutterEnabled: false,
        overhangEnabled: false,
        overhangAmountM: '0',
        overhangSupportBeamProfile: '150x50',
        invertedEnabled: false,
        invertedHouseGutter: false,
        mixedSkylightStripCount: '0',
        mixedSkylightStripWidthM: '0',
        mixedAcrylicBaysMain: '0',
        mixedAcrylicBaysA: '0',
        mixedAcrylicBaysB: '0',
        timberRoofAboveType: 'insulated_panels',
        timberInsulatedPanelThicknessMm: '50',
        timberTrayWidthMm: '500',
        postCount: '2',
        houseConnectionType: 'fascia',
        postConnectionType: 'slab_anchors',
        ground: 'easy',
        lengthM: '7',
        projectionM: '7',
        hipCornerLengthBM: '0',
        hipCornerProjectionBM: '0',
        postCutHeightM: '2.7',
        timberRoofAllowanceExGst: '0',
        flashings: { rows: [] },
        overrides: {},
        infills: { items: [] },
      },
    ],
  };
}

describe('costingPayload', () => {
  it('builds a site costing request from calculator inputs', () => {
    const payload = buildSiteInputsFromCalculatorInputs(makeInputs());

    expect(payload.job_type).toBe('residential');
    expect(payload.travel_ex_gst).toBe(12);
    expect(payload.extras_allowance_ex_gst).toBe(45);
    expect(payload.quote_discount_pct).toBe(5);
    expect(payload.pergolas).toHaveLength(1);
    expect(payload.pergolas[0]?.modules[0]?.roof_span_m).toBe(7);
    expect(payload.pergolas[0]?.modules[0]?.post_cut_height_m).toBe(2.7);
    expect(payload.pergolas[0]?.modules[0]?.attachment_length_mm).toBe(7000);
  });

  it('derives attachment_length_mm from attachment side (length vs projection) and nulls freestanding modules', () => {
    const inputs = makeInputs();
    inputs.modules = [
      { ...inputs.modules[0]!, lengthM: '6', projectionM: '3', attachmentSide: 'left' },
      {
        ...inputs.modules[0]!,
        pergolaId: 'pergola-1',
        houseConnectionType: 'none',
        attachmentSide: 'right',
      },
    ];

    const payload = buildSiteInputsFromCalculatorInputs(inputs);

    expect(payload.pergolas[0]?.modules[0]?.attachment_length_mm).toBe(3000);
    expect(payload.pergolas[0]?.modules[1]?.attachment_length_mm).toBeNull();
  });

  it('builds module costing inputs for a selected calculator module', () => {
    const inputs = makeInputs();
    inputs.modules = [
      { ...inputs.modules[0]!, lengthM: '4.5', projectionM: '3.2' },
      { ...inputs.modules[0]!, pergolaId: 'pergola-1', lengthM: '6.1', projectionM: '4.4', houseConnectionType: 'none' },
    ];

    const moduleInputs = buildModuleCostInputsFromCalculatorInputs(inputs, 1);

    expect(moduleInputs?.length_m).toBe(6.1);
    expect(moduleInputs?.roof_span_m).toBe(4.4);
    expect(moduleInputs?.attachment_length_mm).toBeNull();
  });

  it('canonicalizes an eligible open pergola and requests Simple pricing', () => {
    const inputs = makeInputs();
    inputs.pricingClassification = 'simple';
    inputs.modules = [{
      ...inputs.modules[0]!,
      pergolaStyle: 'gable',
      roofMaterial: 'none',
      extrusionColour: 'Black',
      postConnectionType: 'deck_bracket',
      lengthM: '6',
      projectionM: '3',
      rafterSpacingMm: '725',
      roofPitchDeg: '25',
      boxPerimeterEnabled: true,
      downpipeCount: '3',
      downpipeJoinCount: '2',
      downpipeElbowCount: '4',
      separateGutterEnabled: true,
      overhangEnabled: true,
      invertedEnabled: true,
      flashings: {
        rows: [{ id: 'extra-1', kind: 'extra', band: '301-400', lengthM: '2' }],
      },
      overrides: {
        ledgerProfile: '100x50',
        rafterProfile: '80x50',
        frontBeamProfile: '200x50',
        postProfile: '150x150',
      },
    }];

    const payload = buildSiteInputsFromCalculatorInputs(inputs);
    const module = payload.pergolas[0]?.modules[0];

    expect(payload.pricing_classification).toBe('simple');
    expect(module).toMatchObject({
      pergola_style: 'pitched',
      roof_material: 'none',
      roof_pitch_deg: 0,
      rafter_spacing_mm: 725,
      box_perimeter_enabled: false,
      downpipe_count: 0,
      downpipe_join_count: 0,
      downpipe_elbow_count: 0,
      separate_gutter_enabled: false,
      overhang_enabled: false,
      inverted_enabled: false,
      overrides: {
        ledger_profile: '100x50',
        rafter_profile: '80x50',
        front_beam_profile: '200x50',
        post_profile: '150x150',
      },
    });
    expect(module?.flashings).toBeUndefined();

    const result = calculateSiteCostV1(payload);
    expect(result.pricing_policy?.resolved_classification).toBe('simple');
    expect(result.pricing_policy?.customer_price_uplift_pct).toBe(21);
    expect(result.overhead.method).toBe('simple_progressive');
    expect(result.pergolas[0]?.modules[0]?.derived).toMatchObject({
      ledger_profile_used: '100x50',
      front_beam_profile_used: '200x50',
    });
    expect(result.pergolas[0]?.modules[0]?.inputs_normalized.rafter_profile).toBe('80x50');
    expect(result.pergolas[0]?.modules[0]?.derived.rafter_spacing_mm).toBeLessThanOrEqual(725);
  });

  it('preserves non-cost outputs such as drawing overrides when rebuilding an estimate payload', () => {
    const inputs = makeInputs();
    const siteResult = {
      pergolas: [{ id: 'pergola-1', modules: [{ derived: { length_m: 7, projection_m: 7 } }] }],
      materials: { totals: { materials_ex_gst: 100 } },
      install: { totals: { install_ex_gst: 50 } },
      overhead: { total_ex_gst: 25 },
      totals: { cost_ex_gst: 175, cost_inc_gst: 201.25, warnings: [{ level: 'review', message: 'Check span' }] },
      shared: { crew: 1 },
    } as any;

    const payload = buildEstimatePayloadFromSiteCosting({
      basePayload: {
        status: 'draft',
        inputs: inputs as unknown as Record<string, unknown>,
        derived: {},
        projectSnapshot: { id: 'project-1' },
        snapshot: { project: { projectName: 'Millwater' } },
        outputs: {
          [ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY]: {
            noteOverride: 'Custom note',
          },
        },
        configVersions: { manifest: 'abc' },
      },
      inputs,
      siteResult,
      moduleIndex: 0,
    });

    expect(payload.outputs[ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY]).toEqual({ noteOverride: 'Custom note' });
    expect(payload.outputs.materials).toEqual(siteResult.materials);
    expect(payload.outputs.totals).toEqual(siteResult.totals);
    expect(payload.derived).toEqual({ length_m: 7, projection_m: 7 });
    expect(payload.outputs[ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY]).toBe('current');
  });

  it('persists the live calculateSiteCostV1 result without commercial rollout fields', () => {
    const inputs = makeInputs();
    const siteInputs = buildSiteInputsFromCalculatorInputs(inputs);
    const siteResult = calculateSiteCostV1(siteInputs);

    const payload = buildEstimatePayloadFromSiteCosting({
      basePayload: {
        status: 'draft',
        inputs: inputs as unknown as Record<string, unknown>,
        derived: { preserved: true },
        projectSnapshot: { id: 'project-1' },
        snapshot: { project: { projectName: 'Millwater' } },
        outputs: {
          [ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY]: { noteOverride: 'Keep drawing note' },
        },
        configVersions: { manifest: 'abc' },
      },
      inputs,
      siteResult,
      moduleIndex: 0,
    });

    expect(payload.outputs.materials).toEqual(siteResult.materials);
    expect(payload.outputs.install).toEqual(siteResult.install);
    expect(payload.outputs.overhead).toEqual(siteResult.overhead);
    expect(payload.outputs.totals).toEqual(siteResult.totals);
    expect(payload.outputs.pergolas).toEqual(siteResult.pergolas);
    expect(payload.outputs.siteShared).toEqual(siteResult.shared);
    expect(payload.outputs.shared).toEqual(siteResult.shared);
    expect(payload.outputs[ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY]).toEqual({ noteOverride: 'Keep drawing note' });
    expect(payload.outputs[ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY]).toBe('current');
    expect(payload.outputs).not.toHaveProperty('pricingSource');
    expect(payload.outputs).not.toHaveProperty('commercialDesignInput');
    expect(JSON.stringify(payload)).not.toContain('workbench_solved');
    expect(JSON.stringify(payload)).not.toContain('calculator_compat');
  });

  it('normalises site warnings into a saveable warning array', () => {
    expect(
      deriveSiteResultWarnings({
        totals: { notes_and_warnings: ['Heads up'] },
      } as any),
    ).toEqual([{ level: 'info', message: 'Heads up' }]);
  });

  it('preserves existing outputs and config versions for non-repricing saves', () => {
    const inputs = makeInputs();
    const payload = buildEstimatePayloadPreservingCurrentPricing({
      basePayload: {
        status: 'draft',
        inputs: inputs as unknown as Record<string, unknown>,
        derived: { length_m: 7 },
        projectSnapshot: { id: 'project-1' },
        snapshot: { project: { projectName: 'Millwater' } },
        outputs: {
          totals: { cost_ex_gst: 175, cost_inc_gst: 201.25 },
          materials: { totals: { materials_ex_gst: 100 } },
          [ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY]: { noteOverride: 'Custom note' },
        },
        configVersions: { manifest: 'm1', rules: 'r1' },
      },
      inputs: {
        ...inputs,
        modules: [{ ...inputs.modules[0]!, projectionM: '8' }],
      },
      pricingChanged: true,
      preserveReason: 'Customer-approved historical price.',
    });

    expect((payload.inputs as any).modules[0].projectionM).toBe('8');
    expect(payload.outputs.totals).toEqual({ cost_ex_gst: 175, cost_inc_gst: 201.25 });
    expect(payload.outputs[ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY]).toEqual({ noteOverride: 'Custom note' });
    expect(payload.outputs[ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY]).toBe('stale');
    expect(payload.outputs[ESTIMATE_PRICING_PRESERVE_REASON_OUTPUT_KEY]).toBe('Customer-approved historical price.');
    expect(payload.configVersions).toEqual({ manifest: 'm1', rules: 'r1' });
  });

  it('detects pricing-affecting changes using normalized site inputs', () => {
    const inputs = makeInputs();

    expect(
      hasPricingAffectingCalculatorInputChanges(inputs, {
        ...inputs,
        projectName: 'Different project name',
        quoteRef: 'Q-2000',
        pergolas: [{ id: 'pergola-1', label: 'Renamed pergola' }],
      }),
    ).toBe(false);

    expect(
      hasPricingAffectingCalculatorInputChanges(inputs, {
        ...inputs,
        modules: [{ ...inputs.modules[0]!, projectionM: '8' }],
      }),
    ).toBe(true);

    expect(
      hasPricingAffectingCalculatorInputChanges(inputs, {
        ...inputs,
        pergolas: [{
          ...(inputs.pergolas?.[0] ?? { id: 'pergola-1', label: 'Pergola 1' }),
          lighting: { lightCount: '8', dimmer: true },
        }],
      }),
    ).toBe(true);
  });
});
