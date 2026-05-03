import { calculateSiteCostV1 } from '@sp/costing';
import { describe, expect, it } from 'vitest';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import { buildSiteInputsFromCalculatorInputs } from './costingPayload';
import {
  buildCommercialDesignInputFromCalculatorInputs,
  buildCommercialModuleInputFromCalculatorModule,
} from './commercialDesignPayload';

function makeModule(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorModuleInputs {
  return {
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
    downpipeCount: '2',
    downpipeJoinCount: '1',
    downpipeElbowCount: '3',
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
    attachmentSide: 'left',
    postConnectionType: 'slab_anchors',
    ground: 'easy',
    lengthM: '6',
    projectionM: '4',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    postCutHeightM: '2.7',
    timberRoofAllowanceExGst: '0',
    flashings: {
      rows: [{ id: 'flash-1', kind: 'extra', band: '201-300', lengthM: '1.5', purpose: 'CUSTOM' }],
    },
    overrides: { ledgerProfile: '150x50', rafterProfile: '100x50' },
    infills: { items: [] },
    ...overrides,
  };
}

function makeInputs(overrides: Partial<CalculatorInputs> = {}): CalculatorInputs {
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
    modules: [makeModule()],
    blinds: { items: [] },
    ...overrides,
  };
}

describe('commercialDesignPayload', () => {
  it('builds a shadow commercial design input from a single calculator module', () => {
    const commercial = buildCommercialDesignInputFromCalculatorInputs({
      inputs: makeInputs(),
      identity: { projectId: 'project-1', estimateId: 'estimate-1' },
    });

    expect(commercial.schemaVersion).toBe('commercial_design_v1');
    expect(commercial.source).toBe('calculator_compat');
    expect(commercial.trustStatus).toBe('approximate');
    expect(commercial.identity).toEqual({ projectId: 'project-1', estimateId: 'estimate-1' });
    expect(commercial.siteCommercial).toEqual({
      jobType: 'residential',
      access: 'normal',
      height: 'single_storey',
      travelExGst: 12,
      extrasAllowanceExGst: 45,
      quoteDiscountPct: 5,
    });
    expect(commercial.pergolas).toHaveLength(1);

    const module = commercial.pergolas[0]?.modules[0];
    expect(module?.sourceModuleIndex).toBe(0);
    expect(module?.trustStatus).toBe('approximate');
    expect(module?.solvedGeometry.status).toBe('blocked');
    expect(module?.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'calculator_result_missing',
        severity: 'warning',
      }),
    );
    expect(module?.designIntent).toMatchObject({
      pergolaStyle: 'gable',
      roofMaterial: 'acrylic',
      extrusionColour: 'White',
      roofType: 'gable',
      houseConnectionType: 'fascia',
      attachmentSide: 'left',
      postConnectionType: 'slab_anchors',
      dimensions: { lengthM: 6, projectionM: 4 },
    });
    expect(module?.options.flashings).toEqual(makeInputs().modules[0]?.flashings);
    expect(module?.options.overrides).toEqual({ ledgerProfile: '150x50', rafterProfile: '100x50' });
  });

  it('mirrors calculator pergola grouping and fallback pergola assignment', () => {
    const inputs = makeInputs({
      pergolas: [
        { id: 'pergola-1', label: 'Main' },
        { id: 'pergola-2', label: 'Pool' },
      ],
      modules: [
        makeModule({ pergolaId: 'pergola-2', lengthM: '5' }),
        makeModule({ pergolaId: 'missing-pergola', lengthM: '7' }),
      ],
    });

    const commercial = buildCommercialDesignInputFromCalculatorInputs({ inputs });

    expect(commercial.pergolas.map((pergola) => ({ id: pergola.id, label: pergola.label }))).toEqual([
      { id: 'pergola-1', label: 'Main' },
      { id: 'pergola-2', label: 'Pool' },
    ]);
    expect(commercial.pergolas[0]?.modules.map((module) => module.sourceModuleIndex)).toEqual([1]);
    expect(commercial.pergolas[1]?.modules.map((module) => module.sourceModuleIndex)).toEqual([0]);
  });

  it('maps calculator_compat modules from the same SiteOutputV1 order as live costing', () => {
    const inputs = makeInputs({
      pergolas: [
        { id: 'pergola-1', label: 'Main' },
        { id: 'pergola-2', label: 'Pool' },
      ],
      modules: [
        makeModule({ pergolaId: 'pergola-2', lengthM: '5', projectionM: '3.5' }),
        makeModule({ pergolaId: 'missing-pergola', lengthM: '7', projectionM: '4.5' }),
        makeModule({ pergolaId: 'pergola-2', lengthM: '9', projectionM: '5.5' }),
      ],
    });
    const siteInputs = buildSiteInputsFromCalculatorInputs(inputs);
    const siteResult = calculateSiteCostV1(siteInputs);

    expect(siteInputs.pergolas.map((pergola) => ({ id: pergola.id, moduleCount: pergola.modules.length }))).toEqual([
      { id: 'pergola-1', moduleCount: 1 },
      { id: 'pergola-2', moduleCount: 2 },
    ]);

    const commercial = buildCommercialDesignInputFromCalculatorInputs({ inputs, siteResult });

    const mainModule = commercial.pergolas[0]?.modules[0];
    const poolModules = commercial.pergolas[1]?.modules ?? [];
    expect(commercial.source).toBe('calculator_compat');
    expect(mainModule?.sourceModuleIndex).toBe(1);
    expect(poolModules.map((module) => module.sourceModuleIndex)).toEqual([0, 2]);
    expect(mainModule?.solvedGeometry.primaryDimensionsM).toEqual({
      length: siteResult.pergolas[0]!.modules[0]!.derived.length_m,
      projection: siteResult.pergolas[0]!.modules[0]!.derived.projection_m,
    });
    expect(poolModules[0]?.solvedGeometry.primaryDimensionsM).toEqual({
      length: siteResult.pergolas[1]!.modules[0]!.derived.length_m,
      projection: siteResult.pergolas[1]!.modules[0]!.derived.projection_m,
    });
    expect(poolModules[1]?.solvedGeometry.primaryDimensionsM).toEqual({
      length: siteResult.pergolas[1]!.modules[1]!.derived.length_m,
      projection: siteResult.pergolas[1]!.modules[1]!.derived.projection_m,
    });
  });

  it('keeps missing calculator results as shadow diagnostics instead of live pricing data', () => {
    const commercial = buildCommercialDesignInputFromCalculatorInputs({ inputs: makeInputs() });
    const module = commercial.pergolas[0]?.modules[0];

    expect(commercial.source).toBe('calculator_compat');
    expect(commercial.trustStatus).toBe('approximate');
    expect(module?.solvedGeometry).toMatchObject({
      status: 'blocked',
      geometrySource: 'calculator_compat',
      warnings: ['Calculator costing result was not supplied; solved geometry and takeoff are incomplete.'],
    });
    expect(module?.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'calculator_result_missing',
        severity: 'warning',
      }),
    );
    expect(JSON.stringify(commercial)).not.toContain('workbench_solved');
    expect(JSON.stringify(commercial)).not.toContain('cost_inc_gst');
  });

  it('uses existing costing results to fill solved geometry and stable takeoff buckets', () => {
    const inputs = makeInputs({
      modules: [
        makeModule({
          infills: {
            items: [
              {
                id: 'infill-1',
                label: 'Front infill',
                qty: '2',
                location: 'front',
                acrylicSource: 'sheet_panels',
                panelOrientation: 'vertical',
                widthMode: 'target_width',
                targetPanelWidthM: '0.8',
                maxPanelWidthM: '1.2',
                support: {
                  hasTop: true,
                  hasBottom: true,
                  hasLeft: true,
                  hasRight: true,
                  internalSupportMode: 'none',
                },
                shape: { type: 'rect', widthM: '2', heightM: '1.5' },
              },
            ],
          },
        }),
      ],
    });
    const siteResult = calculateSiteCostV1(buildSiteInputsFromCalculatorInputs(inputs));

    const commercial = buildCommercialDesignInputFromCalculatorInputs({ inputs, siteResult });
    const module = commercial.pergolas[0]?.modules[0];

    expect(module?.solvedGeometry.status).toBe('approximate');
    expect(module?.solvedGeometry.primaryDimensionsM).toEqual({ length: 6, projection: 4 });
    expect(module?.solvedGeometry.roofPlaneCount).toBe(2);
    expect(module?.quantityTakeoff.primaryDimensions?.roofAreaM2 ?? 0).toBeGreaterThan(0);
    expect(module?.quantityTakeoff.roofPlanes).toHaveLength(2);
    expect(module?.quantityTakeoff.posts?.count).toBe(2);
    expect(module?.quantityTakeoff.rafters?.count ?? 0).toBeGreaterThan(0);
    expect(module?.quantityTakeoff.beams?.ledgerLengthM ?? 0).toBeGreaterThanOrEqual(0);
    expect(module?.quantityTakeoff.gutters?.ourGutterLengthM ?? 0).toBeGreaterThan(0);
    expect(module?.quantityTakeoff.gutters?.downpipeCount).toBe(2);
    expect(module?.quantityTakeoff.roofCladding?.acrylicAreaM2 ?? 0).toBeGreaterThan(0);
    expect(module?.quantityTakeoff.flashings?.totalLengthM ?? 0).toBeGreaterThan(0);
    expect(module?.quantityTakeoff.infills?.itemCount).toBe(2);
    expect(module?.quantityTakeoff.infills?.sheetAreaM2 ?? 0).toBeGreaterThan(0);
  });

  it('carries global blinds as estimate-scoped shadow options without prorating', () => {
    const inputs = makeInputs({
      blinds: {
        items: [
          {
            id: 'blind-1',
            label: 'Front blind',
            system: 'ZIPTRAK',
            widthMm: '2400',
            coverLengthMm: '2100',
            fabric: 'MESH',
            motorised: 'NONE',
          },
        ],
      },
    });

    const commercial = buildCommercialDesignInputFromCalculatorInputs({ inputs });
    const module = commercial.pergolas[0]?.modules[0];

    expect(commercial.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'calculator_blinds_estimate_scoped',
        severity: 'info',
      }),
    );
    expect(module?.options.blinds).toEqual(inputs.blinds);
    expect(module?.quantityTakeoff.blindsAndAccessories).toEqual({
      blindCount: 1,
      accessoryCount: 0,
      notes: ['Calculator blinds are estimate-scoped and are not prorated to modules.'],
    });
  });

  it('preserves commercial mapping fields used by parity diagnostics', () => {
    const inputs = makeInputs({
      access: 'hard',
      height: 'two_storey',
      jobType: 'commercial',
      travelExGst: '88.5',
      extrasAllowanceExGst: '120',
      quoteDiscountPct: '3.5',
      modules: [
        makeModule({
          powdercoatStandardColour: 'Black',
          powdercoatIsCustom: true,
          powdercoatCustomColour: 'Monument',
          overrides: {
            ledgerProfile: '150x50',
            rafterProfile: '100x50',
            frontBeamProfile: '200x50',
          },
        }),
      ],
    });

    const commercial = buildCommercialDesignInputFromCalculatorInputs({ inputs });
    const module = commercial.pergolas[0]?.modules[0];

    expect(commercial.siteCommercial).toEqual({
      jobType: 'commercial',
      access: 'hard',
      height: 'two_storey',
      travelExGst: 88.5,
      extrasAllowanceExGst: 120,
      quoteDiscountPct: 3.5,
    });
    expect(module?.options.overrides).toEqual({
      ledgerProfile: '150x50',
      rafterProfile: '100x50',
      frontBeamProfile: '200x50',
    });
    expect(module?.options.powdercoat).toEqual({
      standardColour: 'Black',
      isCustom: true,
      customColour: 'Monument',
    });
  });

  it('supports focused module-level conversion tests', () => {
    const module = buildCommercialModuleInputFromCalculatorModule({
      module: makeModule({ houseConnectionType: 'none', attachmentSide: 'right' }),
      moduleIndex: 3,
    });

    expect(module.id).toBe('calculator-module-4');
    expect(module.sourceModuleIndex).toBe(3);
    expect(module.designIntent.attachmentSide).toBe('rear');
    expect(module.solvedGeometry.status).toBe('blocked');
  });
});
