import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1,
  COMMERCIAL_DESIGN_INPUT_SCHEMA_VERSION_V1,
  getCommercialCalculatorFieldOwnershipV1,
  type CommercialDesignInputV1,
  type CommercialModuleInputV1,
  type CommercialQuantityTakeoffV1,
} from '@sp/costing';

describe('commercial costing contract v1', () => {
  it('exports a shadow-only commercial design input contract', () => {
    const takeoff: CommercialQuantityTakeoffV1 = {
      primaryDimensions: {
        lengthM: 5,
        projectionM: 4,
        roofAreaM2: 20,
      },
      roofPlanes: [
        {
          id: 'plane-1',
          areaM2: 20,
          rafterCount: 9,
          rafterProjectedRunM: 4,
          rafterCutLengthM: 4.2,
          rafterLengthM: 4.2,
          rafterSpacingMm: 625,
          rafterTotalLengthM: 37.8,
          bayCount: 8,
          claddingAreaM2: 20,
          claddingDownslopeLengthM: 4.2,
          claddingPanelCount: 4,
          joinerCount: 9,
          joinerTargetLengthM: 4.2,
          joinerTotalLengthM: 37.8,
        },
      ],
      posts: { count: 4, cutHeightM: 2.4, profile: '100x100' },
      rafters: {
        count: 9,
        bayCount: 8,
        spacingMm: 625,
        effectiveRunM: 4,
        projectedRunM: 4,
        cutLengthM: 4.2,
        totalLengthM: 37.8,
        profile: '100x50',
      },
      beams: {
        ledgerLengthM: 5,
        frontBeamLengthM: 5,
        ridgeLengthM: null,
        totalBeamLengthM: 10,
      },
      gutters: {
        ourGutterLengthM: 5,
        houseGutterLengthM: 0,
        totalLengthM: 5,
        downpipeCount: 1,
      },
      roofCladding: {
        acrylicAreaM2: 20,
        timberAreaM2: 0,
        sheetCount: 4,
        effectiveRunM: 4,
        acrylicRequiredDownslopeM: 4.2,
        averageDownslopeLengthM: 4.2,
        panelCount: 4,
        totalAreaM2: 20,
      },
      joiners: {
        count: 9,
        totalLengthM: 37.8,
        averageLengthM: 4.2,
        profile: 'joiner',
      },
      flashings: {
        totalLengthM: 5,
        count: 1,
        surfaceAreaM2: 1.5,
        byBandM: { '201-300': 5 },
        byGirthM: { '300': 5 },
      },
      infills: {
        itemCount: 1,
        sheetAreaM2: 3,
      },
      blindsAndAccessories: {
        blindCount: 1,
        accessoryCount: 0,
      },
    };

    const module: CommercialModuleInputV1 = {
      id: 'module-1',
      label: 'Module 1',
      sourceModuleIndex: 0,
      trustStatus: 'ready',
      designIntent: {
        pergolaStyle: 'pitched',
        roofMaterial: 'acrylic',
        extrusionColour: 'Black',
        houseConnectionType: 'soffit',
        attachmentSide: 'rear',
        postConnectionType: 'deck_bracket',
        ground: 'easy',
        dimensions: {
          lengthM: 5,
          projectionM: 4,
        },
      },
      solvedGeometry: {
        status: 'ready',
        geometrySource: 'workbench_solved',
        primaryDimensionsM: {
          length: 5,
          projection: 4,
        },
        roofPlaneCount: 1,
      },
      quantityTakeoff: takeoff,
      options: {
        flashings: { rows: [] },
        infills: { items: [] },
        blinds: { items: [] },
        overrides: {},
        powdercoat: {
          standardColour: 'Ironsand',
          isCustom: false,
        },
      },
      diagnostics: [],
    };

    const input: CommercialDesignInputV1 = {
      schemaVersion: COMMERCIAL_DESIGN_INPUT_SCHEMA_VERSION_V1,
      source: 'workbench_solved',
      trustStatus: 'ready',
      identity: {
        projectId: 'project-1',
        estimateId: 'estimate-1',
        designRequestId: null,
      },
      pergolas: [
        {
          id: 'pergola-1',
          label: 'Pergola 1',
          trustStatus: 'ready',
          modules: [module],
          diagnostics: [],
        },
      ],
      siteCommercial: {
        jobType: 'residential',
        access: 'normal',
        height: 'single_storey',
        travelExGst: 0,
        extrasAllowanceExGst: 0,
        quoteDiscountPct: 0,
      },
      diagnostics: [],
    };

    expect(input.schemaVersion).toBe('commercial_design_v1');
    expect(input.pergolas[0]?.modules[0]?.quantityTakeoff.roofPlanes?.[0]?.id).toBe('plane-1');
  });

  it('classifies representative calculator fields by future owner', () => {
    expect(COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1.lengthM.owner).toBe('solved_geometry');
    expect(COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1.projectionM.owner).toBe('solved_geometry');
    expect(COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1.roofMaterial.owner).toBe('design_intent');
    expect(COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1.postCount.owner).toBe('quantity_takeoff');
    expect(COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1.houseConnectionType.owner).toBe('design_intent');
    expect(COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1.attachmentSide.owner).toBe('design_intent');
    expect(COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1.infills.owner).toBe('commercial_option');
    expect(COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1.blinds.owner).toBe('commercial_option');
    expect(COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1.flashings.owner).toBe('commercial_option');
    expect(COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1.travelExGst.owner).toBe('site_commercial');
    expect(COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1.extrasAllowanceExGst.owner).toBe('site_commercial');
    expect(COMMERCIAL_CALCULATOR_FIELD_OWNERSHIP_V1.quoteDiscountPct.owner).toBe('site_commercial');
  });

  it('looks up ownership entries without requiring callers to index the map directly', () => {
    expect(getCommercialCalculatorFieldOwnershipV1('roofMaterial')).toMatchObject({
      field: 'roofMaterial',
      owner: 'design_intent',
    });
    expect(getCommercialCalculatorFieldOwnershipV1('unknownField')).toBeNull();
  });
});
