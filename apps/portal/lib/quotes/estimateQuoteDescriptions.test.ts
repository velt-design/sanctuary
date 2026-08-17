import { describe, expect, it } from 'vitest';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import { priceBlindLineItem } from '@sp/costing';
import {
  buildIncludedSiteCostsValue,
  buildInputPergolaModules,
  buildLegacyPergolaDescription,
  buildPergolaDescription,
  buildSiteCostsDescription,
} from './estimateQuoteDescriptions';
import {
  buildAdditionalAluminiumDescription,
  buildApprovalDescription,
  buildBlindDescription,
  buildHistoricalLightingDescription,
  buildLightingDescription,
  buildStandaloneInfillsDescription,
} from './estimateQuoteAddonDescriptions';

function module(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorModuleInputs {
  return {
    pergolaId: 'pergola-1',
    pergolaStyle: 'pitched',
    roofMaterial: 'acrylic',
    extrusionColour: 'Black',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '5',
    gableEndFramesMode: 'outer_end_only',
    gableHouseEdgeGutter: 'house',
    gableOuterEdgeGutter: 'our',
    boxGutterHouseEdge: 'house',
    boxGutterFarEdge: 'our',
    downpipeCount: '1',
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
    timberInsulatedPanelThicknessMm: '0',
    timberTrayWidthMm: '0',
    postCount: '2',
    houseConnectionType: 'soffit',
    postConnectionType: 'deck_bracket',
    ground: 'easy',
    lengthM: '6',
    projectionM: '3',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    postCutHeightM: '2.4',
    timberRoofAllowanceExGst: '0',
    ...overrides,
  };
}

function inputs(overrides: Partial<CalculatorInputs> = {}): CalculatorInputs {
  return {
    schemaVersion: 'v2',
    projectName: 'Test',
    quoteRef: '',
    access: 'normal',
    height: 'single_storey',
    jobType: 'residential',
    travelExGst: '0',
    extrasAllowanceExGst: '0',
    quoteDiscountPct: '0',
    modules: [module()],
    blinds: { items: [] },
    ...overrides,
  };
}

describe('estimate quote descriptions', () => {
  it('groups input modules by their saved pergola identity', () => {
    const inputs = {
      schemaVersion: 'v2',
      projectName: 'Test',
      quoteRef: '',
      access: 'normal',
      height: 'single_storey',
      jobType: 'residential',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
      pergolas: [
        { id: 'pergola-1', label: 'Courtyard' },
        { id: 'pergola-2', label: 'Pool' },
      ],
      modules: [
        module(),
        module({ pergolaId: 'pergola-2', lengthM: '4' }),
      ],
      blinds: { items: [] },
    } satisfies CalculatorInputs;

    expect(buildInputPergolaModules(inputs).map((pergola) => ({
      id: pergola.id,
      label: pergola.label,
      lengths: pergola.modules.map((item) => item.lengthM),
    }))).toEqual([
      { id: 'pergola-1', label: 'Courtyard', lengths: ['6'] },
      { id: 'pergola-2', label: 'Pool', lengths: ['4'] },
    ]);
  });

  it('builds the existing single-module customer description', () => {
    expect(buildPergolaDescription({
      label: 'Courtyard',
      fallbackIndex: 0,
      modules: [module()],
    })).toBe([
      'Courtyard',
      '- Included: Custom-designed pergola, supplied and installed',
      '- Roof form: Pitched',
      '- Overall size: 6m x 3m',
      '- Roof covering: Acrylic roofing — admits natural light while adding overhead shelter',
      '- Frame finish: Black',
      '- Roof pitch: 5°',
      '- Support posts: 2',
      '- Connection to home: Soffit brackets',
      '- Post foundations and fixings: Deck brackets',
    ].join('\n'));
  });

  it('describes real site-cost components without exposing internal extras wording', () => {
    expect(buildSiteCostsDescription({
      pergolaCount: 2,
      sharedInstallCostEx: 500,
      travelCostEx: 200,
      extrasCostEx: 150,
    })).toBe([
      'Project delivery and site setup',
      '- Shared installation setup across 2 pergolas',
      '- Travel to and from the project site',
      '- Project-specific site allowance',
    ].join('\n'));
    expect(buildIncludedSiteCostsValue({
      pergolaCount: 1,
      sharedInstallCostEx: 500,
      travelCostEx: 200,
      extrasCostEx: 150,
    })).toBe('installation setup, project travel, and a project-specific site allowance included in this item');
  });

  it('keeps a specification-poor compatibility line customer-safe', () => {
    const description = buildPergolaDescription({
      label: 'Courtyard pergola',
      fallbackIndex: 0,
      modules: [],
    });

    expect(description).toContain('Included: Pergola works');
    expect(description).toContain('Final dimensions and selections require confirmation');
    expect(description).not.toMatch(/snapshot|legacy|regenerate/i);
  });

  it('explains a blind package in customer language while retaining exact selections', () => {
    const blind = {
      id: 'pool',
      label: 'Pool',
      system: 'OMNI' as const,
      widthMm: 2000,
      coverLengthMm: 2400,
      fabric: 'FINE_MESH' as const,
      motorised: true,
      rollCover: 'FLASHING' as const,
    };
    const pricing = priceBlindLineItem(blind);

    expect(buildBlindDescription(blind, 0, blind.label, [], pricing)).toBe([
      'Pool blind',
      '- Included: Custom-sized blind system',
      '- System: Omni',
      '- Dimensions: 2,000mm wide × 2,400mm drop',
      '- Fabric: Fine mesh',
      '- Operation: Motorised',
      '- Roll cover: Flashing — 2m charged at $44/m; $88.00 incl GST',
    ].join('\n'));
  });

  it('makes standalone infill and aluminium scope boundaries explicit', () => {
    const copyInputs = inputs({
      modules: [],
      standaloneInfills: {
        extrusionColour: 'Mill',
        powdercoatStandardColour: 'FlaxPod',
        items: [{
          id: 'side',
          label: 'Side wall',
          qty: '2',
          location: 'wall',
          acrylicSource: 'sheet_panels',
          panelOrientation: 'vertical',
          widthMode: 'target_width',
          targetPanelWidthM: '0.6',
          maxPanelWidthM: '0.62',
          support: { hasTop: true, hasBottom: true, hasLeft: true, hasRight: true },
          shape: { type: 'rect', widthM: '2.4', heightM: '1.2' },
        }],
      },
      additionalAluminium: {
        extrusionColour: 'Black',
        rows: [{ id: 'posts', profile: '100 × 100 post', stockLengthM: '6', quantity: '2' }],
      },
    });

    expect(buildStandaloneInfillsDescription(copyInputs)).toContain(
      'Included: Custom-made acrylic infills, supplied and installed',
    );
    expect(buildStandaloneInfillsDescription(copyInputs)).toContain('Side wall: 2.4m × 1.2m; quantity 2');
    expect(buildStandaloneInfillsDescription(copyInputs)).toContain('Existing pergola structure excluded');
    expect(buildAdditionalAluminiumDescription(copyInputs, 1)).toBe([
      'Additional aluminium — supply only',
      '- Frame finish: Black',
      '- 2 × 6m lengths: 100 × 100 post',
      '- Scope boundary: Materials supplied; installation excluded',
    ].join('\n'));
  });

  it('describes approval and lighting allowances without internal pricing rules', () => {
    const engineering = buildApprovalDescription('engineering_required');
    const consent = buildApprovalDescription('full_building_consent');
    const lighting = buildLightingDescription({ label: 'Courtyard', lightCount: 8, driverCount: 1, dimmer: true });

    expect(engineering).toContain('Allowance for professional engineering required by this project');
    expect(consent).toBe([
      'Design, engineering and consent documentation',
      '- Included: Additional design and documentation allowance required to support the pergola through the building consent process',
      '- Structural engineering calculations',
      "- Engineer's PS1 documentation",
      '- Full shop drawing set for the pergola structure',
      '- Consent documentation support',
      '- Responses to council RFIs relating to the pergola structure',
      "- Builder's PS3 on completion",
      '- Coordination with the engineer, as required',
    ].join('\n'));
    expect(lighting).toContain('Rafter-integrated lighting package and installation labour');
    expect(lighting).toContain('Control: Dimming included');
    expect([engineering, consent, lighting].join('\n')).not.toMatch(/not discountable|customer allowance/i);
  });

  it('keeps historical fallback copy customer-safe', () => {
    const historicalLighting = buildHistoricalLightingDescription();
    const historicalPergola = buildLegacyPergolaDescription([module()]);

    expect(historicalLighting).toContain('carried forward from the saved project estimate');
    expect(historicalPergola).toContain('Included: Custom-designed pergola, supplied and installed');
    expect(`${historicalLighting}\n${historicalPergola}`).not.toMatch(/legacy|historical|regenerate/i);
  });
});
