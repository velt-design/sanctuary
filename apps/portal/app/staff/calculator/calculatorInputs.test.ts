import { describe, expect, it } from 'vitest';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { CalculatorInputs } from '@/lib/types/calculator';
import {
  calculatorDraftSessionKey,
  buildInfillItemsForPreset,
  calculatorInputsFromEstimateDetail,
  makeDefaultCalculatorInputs,
  makeDefaultBlindItem,
  makeDefaultModule,
  normalizeBlindsStateForUi,
  normalizeCalculatorInputsForUi,
  normalizeInfillsStateForUi,
  normalizePanelOrientation,
} from './calculatorInputs';

function makeEstimateDetail(inputs: unknown): EstimateDetail {
  return {
    id: 'estimate-1',
    projectId: 'project-1',
    createdAt: '2026-05-03T00:00:00.000Z',
    status: 'draft',
    summary: {},
    versionLabel: 'V1',
    isActiveDraft: true,
    hasSentQuote: false,
    jobPackEligible: false,
    jobPackGeneratedAt: null,
    jobPackQuoteVersionId: null,
    calculatorSnapshot: { inputs },
    editability: {
      isLocked: false,
      lockReason: null,
      lockedAt: null,
      lockedByQuoteVersionId: null,
      lockedByQuoteRef: null,
      lockedByQuoteVersionNumber: null,
      hasDraftQuotes: false,
      draftQuoteCount: 0,
    },
  };
}

describe('calculator input defaults and normalization', () => {
  it('builds the default module shape used by new calculator sessions', () => {
    const module = makeDefaultModule('pergola-a');

    expect(module.pergolaId).toBe('pergola-a');
    expect(module.pergolaStyle).toBe('pitched');
    expect(module.lengthM).toBe('6');
    expect(module.projectionM).toBe('3');
    expect(module.rafterSpacingMm).toBe('500');
    expect(module.houseConnectionType).toBe('soffit');
    expect(module.flashings?.rows[0]).toMatchObject({
      kind: 'primary',
      band: '201-300',
      lengthM: '6',
      purpose: 'CUSTOM',
    });
    expect(module.infills).toEqual({ items: [] });
    expect(module.additionalAluminium).toEqual({ rows: [] });
  });

  it('preserves saved additional aluminium rows during calculator normalization', () => {
    const normalized = normalizeCalculatorInputsForUi({
      ...makeDefaultCalculatorInputs(),
      modules: [{
        ...makeDefaultModule('pergola-1'),
        additionalAluminium: {
          rows: [{ id: 'extra-bar-1', profile: '100x50', stockLengthM: '5', quantity: '3' }],
        },
      }],
    });

    expect(normalized.modules[0].additionalAluminium?.rows).toEqual([
      { id: 'extra-bar-1', profile: '100x50', stockLengthM: '5', quantity: '3' },
    ]);
  });

  it('normalizes saved open pergolas to the supported frame contract', () => {
    const normalized = normalizeCalculatorInputsForUi({
      ...makeDefaultCalculatorInputs(),
      pricingClassification: 'simple',
      modules: [{
        ...makeDefaultModule('pergola-1'),
        roofMaterial: 'none',
        pergolaStyle: 'gable',
        boxPerimeterEnabled: true,
        roofPitchDeg: '25',
        rafterSpacingMm: '725',
        downpipeCount: '2',
        overhangEnabled: true,
        flashings: { rows: [{ id: 'extra-1', kind: 'extra', band: '301-400', lengthM: '2' }] },
      }],
    });

    expect(normalized.modules[0]).toMatchObject({
      roofMaterial: 'none',
      pergolaStyle: 'pitched',
      boxPerimeterEnabled: false,
      roofPitchDeg: '0',
      rafterSpacingMm: '725',
      downpipeCount: '0',
      overhangEnabled: false,
      flashings: { rows: [] },
      overrides: {
        ledgerProfile: '150x50',
        rafterProfile: '150x50',
        frontBeamProfile: '150x50',
      },
    });
    expect(normalized.pricingClassification).toBe('simple');
  });

  it('defaults new infills to explicit material, direction and No support answers while preserving saved choices', () => {
    const defaults = normalizeInfillsStateForUi({ items: [{ id: 'new' }] }).items[0];
    const manual = normalizeInfillsStateForUi({
      items: [{ id: 'saved', acrylicSource: 'strip_620', panelOrientation: 'horizontal' }],
    }).items[0];
    const legacyAutomatic = normalizeInfillsStateForUi({
      items: [{ id: 'legacy-auto', acrylicSource: 'auto', panelOrientation: 'auto' }],
    }).items[0];

    expect(defaults).toMatchObject({ acrylicSource: 'sheet_panels', panelOrientation: 'vertical' });
    expect(defaults.support).toMatchObject({
      hasTop: false,
      hasBottom: false,
      hasLeft: false,
      hasRight: false,
      edgeConfirmations: { top: 'no', bottom: 'no', left: 'no', right: 'no' },
    });
    expect(manual).toMatchObject({ acrylicSource: 'strip_620', panelOrientation: 'horizontal' });
    expect(legacyAutomatic).toMatchObject({ acrylicSource: 'auto', panelOrientation: 'auto' });
  });

  it('infers confirmations from legacy saved support booleans without repricing them', () => {
    const saved = normalizeInfillsStateForUi({
      items: [{
        id: 'legacy-supports',
        support: { hasTop: true, hasBottom: false, hasLeft: true, hasRight: false },
      }],
    }).items[0];

    expect(saved.support).toMatchObject({
      hasTop: true,
      hasBottom: false,
      hasLeft: true,
      hasRight: false,
      edgeConfirmations: { top: 'yes', bottom: 'no', left: 'yes', right: 'no' },
    });
  });

  it('normalizes legacy unsure metadata to No when an infill is duplicated through the input factory', () => {
    const source = normalizeInfillsStateForUi({
      items: [{
        id: 'source',
        support: {
          hasTop: true,
          hasBottom: false,
          hasLeft: false,
          hasRight: false,
          edgeConfirmations: { top: 'yes', bottom: 'no', left: 'unsure', right: 'unsure' },
        },
      }],
    }).items[0];
    const duplicate = normalizeInfillsStateForUi({ items: [{ ...source, id: 'copy' }] }).items[0];

    expect(source.support.edgeConfirmations).toEqual({ top: 'yes', bottom: 'no', left: 'no', right: 'no' });
    expect(duplicate.support.edgeConfirmations).toEqual(source.support.edgeConfirmations);
    expect(duplicate.support).toMatchObject({ hasTop: true, hasBottom: false, hasLeft: false, hasRight: false });
  });

  it('uses explicit choices for every new infill preset', () => {
    const module = makeDefaultModule('pergola-a');
    const presets = ['front', 'house', 'side', 'gable_triangles', 'wall_panel', 'custom'] as const;

    for (const preset of presets) {
      expect(buildInfillItemsForPreset(module, preset).every((item) => (
        item.acrylicSource === 'sheet_panels'
        && item.panelOrientation === 'vertical'
        && Object.values(item.support.edgeConfirmations ?? {}).every((confirmation) => confirmation === 'no')
      ))).toBe(true);
    }
    expect(buildInfillItemsForPreset(module, 'custom')[0]?.shape).toMatchObject({ widthM: '', heightM: '' });
  });

  it('normalizes malformed pergolas, modules, blinds, and infills to safe UI defaults', () => {
    const normalized = normalizeCalculatorInputsForUi({
      schemaVersion: 'v2',
      projectName: 'Malformed',
      quoteRef: 'Q-1',
      access: 'normal',
      height: 'single_storey',
      jobType: 'industrial' as any,
      travelExGst: '10',
      extrasAllowanceExGst: '20',
      quoteDiscountPct: '0',
      pergolas: [
        { id: '', label: '' },
        { id: 'pergola-1', label: 'Second label' },
      ],
      modules: [
        {
          pergolaId: 'missing-pergola',
          pergolaStyle: 'gable',
          roofMaterial: 'mixed',
          lengthM: '6',
          projectionM: '3',
          houseConnectionType: 'none',
          infills: {
            items: [
              {
                id: 'infill-1',
                panelOrientation: 'sideways',
                support: { hasTop: false },
                shape: { type: 'bad-shape' },
              },
            ],
          },
        } as any,
      ],
      blinds: { unexpected: true } as any,
    });

    expect(normalized.jobType).toBe('residential');
    expect(normalized.pergolas).toEqual([{ id: 'pergola-1', label: 'Pergola 1' }]);
    expect(normalized.modules).toHaveLength(1);
    expect(normalized.modules[0]?.pergolaId).toBe('pergola-1');
    expect(normalized.modules[0]?.gableHouseEdgeGutter).toBe('our');
    expect(normalized.modules[0]?.infills?.items[0]).toMatchObject({
      id: 'infill-1',
      panelOrientation: 'vertical',
      support: { hasTop: false, hasBottom: true },
      shape: { type: 'rect', widthM: '1', heightM: '1', bottomOffsetM: '0' },
    });
    expect(normalized.blinds).toEqual({ items: [] });
  });

  it('preserves valid v2 estimate calculator inputs while adding UI defaults', () => {
    const inputs: CalculatorInputs = {
      schemaVersion: 'v2',
      projectName: 'Estimate',
      quoteRef: 'Q-2',
      access: 'hard',
      height: 'two_storey',
      jobType: 'commercial',
      travelExGst: '11',
      extrasAllowanceExGst: '22',
      quoteDiscountPct: '3',
      pergolas: [{
        id: 'pergola-main',
        label: 'Main pergola',
        lighting: { lightCount: '13', dimmer: true },
      }],
      modules: [
        {
          ...makeDefaultModule('pergola-main'),
          roofMaterial: 'mixed',
          mixedAcrylicBaysMain: '',
        },
      ],
      blinds: { items: [{ id: 'blind-1', system: 'OMNI', widthMm: '1200', coverLengthMm: '2100', fabric: 'PVC', motorised: 'YES' }] },
    };

    const normalized = calculatorInputsFromEstimateDetail(makeEstimateDetail(inputs));

    expect(normalized.projectName).toBe('Estimate');
    expect(normalized.jobType).toBe('commercial');
    expect(normalized.pergolas).toEqual([{
      id: 'pergola-main',
      label: 'Main pergola',
      lighting: { lightCount: '13', dimmer: true },
    }]);
    expect(normalized.modules[0]?.pergolaId).toBe('pergola-main');
    expect(normalized.modules[0]?.flashings?.rows[0]?.kind).toBe('primary');
    expect(normalized.blinds?.items[0]?.system).toBe('OMNI');
    expect(normalized.blinds?.items[0]?.rollCover).toBe('NONE');
  });

  it('keeps normalized blind state referentially stable after roll-cover defaults exist', () => {
    const blind = makeDefaultBlindItem({ widthMm: '2000', coverLengthMm: '2000' });
    const blinds = { items: [blind] };
    const normalized = normalizeBlindsStateForUi(blinds);

    expect(normalized).toBe(blinds);
  });

  it('migrates legacy estimate calculator snapshots to v2 UI inputs', () => {
    const normalized = calculatorInputsFromEstimateDetail(
      makeEstimateDetail({
        projectName: 'Legacy',
        quoteRef: 'L-1',
        pergolaStyle: 'pitched',
        roofMaterial: 'acrylic',
        extrusionColour: 'Black',
        boxPerimeterEnabled: false,
        internalRoofType: 'pitched',
        fallDistanceMm: '0',
        roofPitchDeg: '',
        mixedSkylightStripCount: '1',
        mixedSkylightStripWidthM: '0.62',
        postCount: '4',
        houseConnectionType: 'soffit',
        postConnectionType: 'deck_bracket',
        access: 'normal',
        height: 'single_storey',
        ground: 'easy',
        lengthM: '7',
        projectionM: '3.5',
        postCutHeightM: '2.4',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        timberRoofAllowanceExGst: '0',
        quoteDiscountPct: '0',
        blinds: {
          systemType: 'ZIPTRAK',
          totalWidthMm: '2400',
          coverLengthMm: '2100',
          fabric: 'MESH',
          motorised: 'NO',
          panelCount: '1',
          panelWidthsMm: ['2400'],
        },
      }),
    );

    expect(normalized.schemaVersion).toBe('v2');
    expect(normalized.modules[0]).toMatchObject({
      pergolaId: 'pergola-1',
      lengthM: '7',
      projectionM: '3.5',
    });
    expect(normalized.blinds?.items[0]).toMatchObject({
      id: 'legacy-1',
      system: 'ZIPTRAK',
      widthMm: '2400',
      motorised: 'NONE',
      rollCover: 'NONE',
    });
  });

  it('keeps small pure helpers available outside the client component', () => {
    expect(calculatorDraftSessionKey('project-1', '', '')).toBe('sanctuary-portal:calculator:draft:v1:project-1:new');
    expect(calculatorDraftSessionKey('', 'estimate-source', '')).toBe(
      'sanctuary-portal:calculator:draft:v1:none:duplicate:estimate-source',
    );
    expect(calculatorDraftSessionKey('project-1', '', 'estimate-edit')).toBe(
      'sanctuary-portal:calculator:draft:v1:project-1:edit:estimate-edit',
    );
    expect(normalizePanelOrientation('bad')).toBe('vertical');
    expect(normalizeInfillsStateForUi(null)).toEqual({ items: [] });
  });
});
