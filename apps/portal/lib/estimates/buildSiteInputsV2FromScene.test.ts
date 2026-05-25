import { describe, expect, it } from 'vitest';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import type {
  PergolaAttachment,
  PergolaObjectModel,
  WorkbenchProjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { buildSiteInputsV2FromScene } from './buildSiteInputsV2FromScene';

function makeModule(overrides: Partial<CalculatorModuleInputs> & { pergolaId: string }): CalculatorModuleInputs {
  return {
    pergolaStyle: 'pitched',
    roofMaterial: 'acrylic',
    extrusionColour: 'White',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '20',
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
    postCount: '4',
    houseConnectionType: 'soffit',
    postConnectionType: 'slab_anchors',
    ground: 'easy',
    lengthM: '6',
    projectionM: '3',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    postCutHeightM: '2.4',
    timberRoofAllowanceExGst: '0',
    flashings: { rows: [] },
    overrides: {},
    infills: { items: [] },
    ...overrides,
  } as CalculatorModuleInputs;
}

function makeInputs(overrides: Partial<CalculatorInputs> & { modules: CalculatorModuleInputs[] }): CalculatorInputs {
  return {
    schemaVersion: 'v2',
    projectName: 'Test',
    quoteRef: 'Q-1000',
    access: 'normal',
    height: 'single_storey',
    jobType: 'residential',
    travelExGst: '20',
    extrasAllowanceExGst: '0',
    quoteDiscountPct: '0',
    pergolas: overrides.modules
      .map((m) => m.pergolaId)
      .filter((id, index, arr) => arr.indexOf(id) === index)
      .map((id) => ({ id, label: id })),
    ...overrides,
  } as CalculatorInputs;
}

function makePergola(overrides: Partial<PergolaObjectModel> & { id: string }): PergolaObjectModel {
  return {
    id: overrides.id,
    label: overrides.label ?? overrides.id,
    family: 'mono',
    connectionKind: undefined,
    attachmentEdgeId: null,
    attachmentZoneId: null,
    side: 'rear',
    strategy: null,
    geometry: undefined,
    position: undefined,
    attachment: overrides.attachment,
  };
}

function snapToPergola(targetId: string): PergolaAttachment {
  return {
    host: {
      objectFamily: 'pergolas',
      objectId: targetId,
      edgeKind: 'pergola_outline',
      edgeId: '',
      myEdgeIndex: 0,
    },
    spatialKind: 'pergola_outline',
    method: 'none',
  };
}

function makeProject(pergolas: PergolaObjectModel[]): Pick<WorkbenchProjectModel, 'pergolas'> {
  return { pergolas };
}

describe('buildSiteInputsV2FromScene', () => {
  it('produces a SiteInputsV2 with schema_version=v2 and site-level fields lifted from calculator inputs', () => {
    const result = buildSiteInputsV2FromScene({
      projectModel: makeProject([makePergola({ id: 'pergola-1' })]),
      calculatorInputs: makeInputs({ modules: [makeModule({ pergolaId: 'pergola-1' })] }),
    });
    expect(result.schema_version).toBe('v2');
    expect(result.job_type).toBe('residential');
    expect(result.access).toBe('normal');
    expect(result.height).toBe('single_storey');
    expect(result.travel_ex_gst).toBe(20);
    expect(result.extras_allowance_ex_gst).toBe(0);
    expect(result.quote_discount_pct).toBe(0);
  });

  it('maps one unsnapped pergola in the scene to one logical pergola with one module', () => {
    const result = buildSiteInputsV2FromScene({
      projectModel: makeProject([makePergola({ id: 'pergola-1' })]),
      calculatorInputs: makeInputs({ modules: [makeModule({ pergolaId: 'pergola-1' })] }),
    });
    expect(result.pergolas).toHaveLength(1);
    expect(result.pergolas[0]?.id).toBe('pergola-1');
    expect(result.pergolas[0]?.modules).toHaveLength(1);
    expect(result.pergolas[0]?.modules[0]?.id).toBe('pergola-1');
  });

  it('groups two snap-connected pergolas as one logical pergola with two modules', () => {
    const result = buildSiteInputsV2FromScene({
      projectModel: makeProject([
        makePergola({ id: 'pergola-1' }),
        makePergola({ id: 'pergola-2', attachment: snapToPergola('pergola-1') }),
      ]),
      calculatorInputs: makeInputs({
        modules: [
          makeModule({ pergolaId: 'pergola-1', lengthM: '6', projectionM: '3' }),
          makeModule({ pergolaId: 'pergola-2', lengthM: '4', projectionM: '3' }),
        ],
      }),
    });
    expect(result.pergolas).toHaveLength(1);
    expect(result.pergolas[0]?.id).toBe('pergola-1');
    expect(result.pergolas[0]?.modules).toHaveLength(2);
    expect(result.pergolas[0]?.modules.map((m) => m.id)).toEqual(['pergola-1', 'pergola-2']);
    expect(result.pergolas[0]?.modules[0]?.length_m).toBe(6);
    expect(result.pergolas[0]?.modules[1]?.length_m).toBe(4);
  });

  it('keeps two unconnected pergolas as separate logical pergolas', () => {
    const result = buildSiteInputsV2FromScene({
      projectModel: makeProject([makePergola({ id: 'pergola-1' }), makePergola({ id: 'pergola-2' })]),
      calculatorInputs: makeInputs({
        modules: [
          makeModule({ pergolaId: 'pergola-1' }),
          makeModule({ pergolaId: 'pergola-2' }),
        ],
      }),
    });
    expect(result.pergolas).toHaveLength(2);
    expect(result.pergolas.map((p) => p.id)).toEqual(['pergola-1', 'pergola-2']);
    expect(result.pergolas[0]?.modules).toHaveLength(1);
    expect(result.pergolas[1]?.modules).toHaveLength(1);
  });

  it('skips pergolas in the scene with no matching calculator module', () => {
    // pergola-1 has calc data; pergola-2 is freshly added without calc data
    const result = buildSiteInputsV2FromScene({
      projectModel: makeProject([
        makePergola({ id: 'pergola-1' }),
        makePergola({ id: 'pergola-2' }),
      ]),
      calculatorInputs: makeInputs({ modules: [makeModule({ pergolaId: 'pergola-1' })] }),
    });
    expect(result.pergolas).toHaveLength(1);
    expect(result.pergolas[0]?.id).toBe('pergola-1');
  });

  it('drops a logical pergola whose modules all skip out (no calc data anywhere in the group)', () => {
    const result = buildSiteInputsV2FromScene({
      projectModel: makeProject([
        makePergola({ id: 'pergola-1' }),
        makePergola({ id: 'pergola-2', attachment: snapToPergola('pergola-1') }),
      ]),
      calculatorInputs: makeInputs({ modules: [] }),
    });
    expect(result.pergolas).toHaveLength(0);
  });

  it('exposes a per-pergola accessories slot as an empty array (forward-compatible)', () => {
    const result = buildSiteInputsV2FromScene({
      projectModel: makeProject([makePergola({ id: 'pergola-1' })]),
      calculatorInputs: makeInputs({ modules: [makeModule({ pergolaId: 'pergola-1' })] }),
    });
    expect(result.pergolas[0]?.accessories).toEqual([]);
  });

  it('maps pergola-only fields without house/deck/opening data', () => {
    // The V2 module shape carries only pergola-relevant fields. Verify no
    // houseContext or related fields leak through.
    const result = buildSiteInputsV2FromScene({
      projectModel: makeProject([makePergola({ id: 'pergola-1' })]),
      calculatorInputs: makeInputs({
        modules: [makeModule({ pergolaId: 'pergola-1', lengthM: '6', projectionM: '3', postCount: '4' })],
      }),
    });
    const module = result.pergolas[0]?.modules[0];
    expect(module?.length_m).toBe(6);
    expect(module?.roof_span_m).toBe(3);
    expect(module?.post_count).toBe(4);
    expect(module?.pergola_style).toBe('pitched');
    // Verify no leaked house/deck/opening fields. These shouldn't typecheck
    // anyway, but runtime check catches regressions.
    expect('houseContext' in (module ?? {})).toBe(false);
    expect('decks' in (module ?? {})).toBe(false);
    expect('openings' in (module ?? {})).toBe(false);
  });

  it('produces a stable logical pergolaId regardless of scene module order', () => {
    const orderA = buildSiteInputsV2FromScene({
      projectModel: makeProject([
        makePergola({ id: 'pergola-1' }),
        makePergola({ id: 'pergola-2', attachment: snapToPergola('pergola-1') }),
      ]),
      calculatorInputs: makeInputs({
        modules: [makeModule({ pergolaId: 'pergola-1' }), makeModule({ pergolaId: 'pergola-2' })],
      }),
    });
    const orderB = buildSiteInputsV2FromScene({
      projectModel: makeProject([
        makePergola({ id: 'pergola-2', attachment: snapToPergola('pergola-1') }),
        makePergola({ id: 'pergola-1' }),
      ]),
      calculatorInputs: makeInputs({
        modules: [makeModule({ pergolaId: 'pergola-2' }), makeModule({ pergolaId: 'pergola-1' })],
      }),
    });
    expect(orderA.pergolas[0]?.id).toBe('pergola-1');
    expect(orderB.pergolas[0]?.id).toBe('pergola-1');
  });

  it('coerces non-finite travel/extras/discount values to zero', () => {
    const result = buildSiteInputsV2FromScene({
      projectModel: makeProject([makePergola({ id: 'pergola-1' })]),
      calculatorInputs: makeInputs({
        modules: [makeModule({ pergolaId: 'pergola-1' })],
        travelExGst: 'not-a-number',
        extrasAllowanceExGst: '',
        quoteDiscountPct: 'NaN',
      }),
    });
    expect(result.travel_ex_gst).toBe(0);
    expect(result.extras_allowance_ex_gst).toBe(0);
    expect(result.quote_discount_pct).toBe(0);
  });
});
