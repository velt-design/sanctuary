import { calculateSiteCostV1, priceAllBlinds } from '@sp/costing';
import { describe, expect, it } from 'vitest';

import {
  buildEstimatePayloadFromSiteCosting,
  buildSiteInputsFromCalculatorInputs,
} from '@/lib/estimates/costingPayload';
import {
  buildOptimisticEstimateDetail,
  buildQuoteHandoffPreviewFromEstimateDetail,
  type PortalEstimatePayload,
} from '@/lib/localFirst/portalEntities';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import { buildBlindInputs } from './calculatorBlindUi';
import { makeDefaultCalculatorInputs, makeDefaultInfillItem } from './calculatorInputs';
import { buildCalculatorPricingPreview } from './calculatorPricingPreview';
import { buildCalculatorSaveOutcomeUi } from './calculatorSaveOutcome';

type TrustReviewScenario = {
  id: 'simple' | 'complex';
  inputs: CalculatorInputs;
  preservedOutputs?: Record<string, unknown>;
};

function cloneModule(
  source: CalculatorModuleInputs,
  overrides: Partial<CalculatorModuleInputs>,
): CalculatorModuleInputs {
  return {
    ...structuredClone(source),
    ...overrides,
  };
}

function simpleScenario(): TrustReviewScenario {
  const inputs = makeDefaultCalculatorInputs();
  inputs.projectName = 'Simple trust review';
  inputs.pergolas = [{ id: 'pergola-1', label: 'Front patio' }];
  inputs.modules[0]!.infills = {
    items: [makeDefaultInfillItem({
      id: 'simple-infill',
      label: 'Front infill',
      location: 'front',
    })],
  };
  return { id: 'simple', inputs };
}

function complexScenario(): TrustReviewScenario {
  const inputs = makeDefaultCalculatorInputs();
  const source = inputs.modules[0]!;
  inputs.projectName = 'Complex trust review';
  inputs.access = 'hard';
  inputs.height = 'two_storey';
  inputs.travelExGst = '425';
  inputs.extrasAllowanceExGst = '275';
  inputs.quoteDiscountPct = '7.5';
  inputs.pergolas = [
    { id: 'pergola-1', label: 'Front patio' },
    { id: 'pergola-2', label: 'Pool cover' },
  ];
  inputs.modules = [
    cloneModule(source, {
      pergolaId: 'pergola-1',
      pergolaStyle: 'pitched',
      lengthM: '6',
      projectionM: '3',
      infills: {
        items: [makeDefaultInfillItem({
          id: 'complex-infill',
          label: 'Courtyard infill',
          location: 'side',
        })],
      },
    }),
    cloneModule(source, {
      pergolaId: 'pergola-1',
      pergolaStyle: 'gable',
      lengthM: '4.8',
      projectionM: '3.2',
    }),
    cloneModule(source, {
      pergolaId: 'pergola-2',
      pergolaStyle: 'hip',
      lengthM: '5.4',
      projectionM: '3.6',
    }),
  ];
  inputs.blinds = {
    items: [
      {
        id: 'review-blind-1',
        label: 'Pool blind',
        system: 'OMNI',
        widthMm: '2400',
        coverLengthMm: '2100',
        fabric: 'MESH',
        motorised: 'YES',
        rollCover: 'PELMET',
      },
    ],
  };
  return {
    id: 'complex',
    inputs,
    preservedOutputs: { lighting_total_inc_gst: 375 },
  };
}

function validateScenario(scenario: TrustReviewScenario) {
  const siteResult = calculateSiteCostV1(buildSiteInputsFromCalculatorInputs(scenario.inputs));
  const blindPricing = priceAllBlinds(buildBlindInputs(scenario.inputs.blinds?.items ?? []));
  const livePreview = buildCalculatorPricingPreview({
    result: siteResult,
    inputs: scenario.inputs,
    blindPricing,
    estimateSnapshot: {
      inputs: scenario.inputs,
      outputs: scenario.preservedOutputs ?? {},
    },
  });
  const basePayload: PortalEstimatePayload = {
    status: 'draft',
    inputs: {},
    outputs: scenario.preservedOutputs ?? {},
    configVersions: {},
  };
  const savedPayload = buildEstimatePayloadFromSiteCosting({
    basePayload,
    inputs: scenario.inputs,
    siteResult,
    moduleIndex: 0,
  });
  const savedEstimate = buildOptimisticEstimateDetail({
    estimateId: `estimate-${scenario.id}`,
    projectId: `project-${scenario.id}`,
    estimatePayload: savedPayload,
    versionLabel: 'V1',
    createdAt: '2026-07-27T00:00:00.000Z',
  });
  const quoteHandoff = buildQuoteHandoffPreviewFromEstimateDetail(savedEstimate);
  const pricedPreviewRows = livePreview.rows.filter((row) => row.status === 'priced');
  const saveOutcomeUi = buildCalculatorSaveOutcomeUi(
    {
      estimateId: savedEstimate.id,
      projectId: savedEstimate.projectId,
      versionLabel: savedEstimate.versionLabel,
      operation: 'updated',
      saveMode: 'reprice_latest',
      pricingChanged: false,
      quotePreview: quoteHandoff,
    },
    { status: 'synced' },
    livePreview.totalIncGstCents,
  );

  return {
    livePreview,
    pricedPreviewRows,
    quoteHandoff,
    saveOutcomeUi,
    savedEstimate,
  };
}

describe('Calculator trust validation scenarios', () => {
  it.each([
    ['simple', simpleScenario],
    ['complex', complexScenario],
  ] as const)(
    'reconciles the %s Live Calculator, saved estimate and proposed quote to exact cents',
    (_name, buildScenario) => {
      const scenario = buildScenario();
      const result = validateScenario(scenario);

      expect(result.quoteHandoff.blockingIssues).toEqual([]);
      expect(
        result.quoteHandoff.lineItems
          .map((item) => item.lineTotalIncGstCents)
          .toSorted((left, right) => left - right),
      ).toEqual(
        result.pricedPreviewRows
          .map((row) => row.priceIncGstCents)
          .toSorted((left, right) => (left ?? 0) - (right ?? 0)),
      );
      expect(result.quoteHandoff.totalIncGstCents).toBe(result.livePreview.totalIncGstCents);
      expect(result.saveOutcomeUi.reconciliationStatus).toBe('matched');
      expect(result.saveOutcomeUi.quoteDisabled).toBe(false);
      expect(result.savedEstimate.calculatorSnapshot?.inputs).toEqual(scenario.inputs);
      const savedOutputs = result.savedEstimate.calculatorSnapshot?.outputs as {
        pergolas?: Array<{ infill_cost_breakdown?: { status?: string } }>;
      };
      expect(savedOutputs.pergolas?.some(
        (pergola) => pergola.infill_cost_breakdown?.status === 'ready',
      )).toBe(true);
    },
  );

  it('keeps complex quote inclusions and discount scope visible in both projections', () => {
    const result = validateScenario(complexScenario());

    expect(result.pricedPreviewRows.map((row) => row.kind)).toEqual([
      'pergola',
      'pergola',
      'shared',
      'blind',
      'lighting',
    ]);
    expect(result.livePreview.discountPct).toBe(7.5);
    expect(result.livePreview.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'infill',
        label: 'Courtyard infill',
        status: 'included',
        priceIncGstCents: expect.any(Number),
      }),
    ]));
    expect(result.quoteHandoff.lineItems[0]?.description).toContain('Quote discount: 7.5% included in this item');
    expect(result.quoteHandoff.lineItems[2]?.description).toContain('Project delivery and site setup');
    expect(result.quoteHandoff.lineItems.some((item) => item.description.includes('Pool blind'))).toBe(true);
    expect(result.quoteHandoff.lineItems.some((item) => item.description.toLowerCase().includes('lighting'))).toBe(true);
  });

  it('keeps displayed infill contributions within the allocated module price', () => {
    const scenario = simpleScenario();
    const withInfill = validateScenario(scenario);
    const withoutInputs = structuredClone(scenario.inputs);
    withoutInputs.modules.forEach((module) => {
      module.infills = { items: [] };
    });
    const withoutResult = calculateSiteCostV1(buildSiteInputsFromCalculatorInputs(withoutInputs));
    const withoutPreview = buildCalculatorPricingPreview({
      result: withoutResult,
      inputs: withoutInputs,
      blindPricing: priceAllBlinds([]),
    });
    const parent = withInfill.livePreview.rows.find((row) => row.kind === 'pergola')!;
    const modules = withInfill.livePreview.rows.filter((row) => row.kind === 'module');
    const infills = withInfill.livePreview.rows.filter((row) => row.kind === 'infill');
    expect(
      modules.reduce((sum, row) => sum + (row.priceIncGstCents ?? 0), 0),
    ).toBe(parent.priceIncGstCents);
    expect(infills.every((row) => (row.priceIncGstCents ?? 0) > 0)).toBe(true);
    expect(infills.every((row) => row.parentId?.startsWith('module:'))).toBe(true);
    expect(withoutPreview.rows.filter((row) => row.kind === 'module')).toHaveLength(modules.length);
  });
});
