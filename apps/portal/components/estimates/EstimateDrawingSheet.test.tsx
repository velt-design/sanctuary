import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CostOutputV1, RoofType } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { buildEstimateDrawingDraftFromSnapshot, deriveEstimateDrawingEditableFields } from '@/lib/estimates/drawingEdits';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import EstimateDrawingSheet from './EstimateDrawingSheet';

function makeModule(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorModuleInputs {
  const base: Partial<CalculatorModuleInputs> = {
    pergolaId: 'pergola-1',
    pergolaStyle: 'gable',
    roofMaterial: 'acrylic',
    extrusionColour: 'White',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '18',
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
    lengthM: '4.6',
    projectionM: '5.1',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    postCutHeightM: '2.4',
    timberRoofAllowanceExGst: '0',
    flashings: { rows: [] },
    overrides: {},
    infills: { items: [] },
  };
  return { ...base, ...overrides } as CalculatorModuleInputs;
}

function makeResult(params: {
  roofType?: RoofType;
  lengthA?: number;
  spanA?: number;
  slopeDirection?: 'away_from_house' | 'toward_house' | null;
} = {}): CostOutputV1 {
  return {
    inputs_normalized: {
      roof_type: params.roofType ?? 'gable',
    },
    derived: {
      length_m: params.lengthA ?? 4.6,
      projection_m: params.spanA ?? 5.1,
      slope_direction: params.slopeDirection ?? 'away_from_house',
      roof_pitch_deg_used: 18,
      height_house_side_m: 2.4,
      height_outer_side_m: 2.4,
    },
  } as unknown as CostOutputV1;
}

function makeDrawingModels(overrides: Partial<CalculatorModuleInputs> = {}) {
  const modules = buildEstimateDrawingModules({
    inputs: {
      schemaVersion: 'v2',
      projectName: 'Millwater',
      quoteRef: 'Q-1000',
      access: 'normal',
      height: 'single_storey',
      jobType: 'residential',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
      modules: [makeModule(overrides)],
    },
    outputs: {
      pergolas: [{ id: 'pergola-1', modules: [makeResult()] }],
    },
  });

  return modules[0]!;
}

describe('EstimateDrawingSheet', () => {
  it('renders a plan sheet with title block metadata and legend', () => {
    const drawing = makeDrawingModels();
    const meta = buildEstimateDrawingSheetMeta({
      moduleLabel: 'M1 - Gable - 4.6m x 5.1m - Acrylic',
      moduleInfoRows: buildEstimateDrawingModuleInfoRows(makeModule()),
      view: 'plan',
      versionLabel: 'V1',
      estimateDate: '2026-03-19T03:14:00.000Z',
      siteAddress: 'Millwater',
      clientName: 'Chanel',
    });

    const markup = renderToStaticMarkup(
      <EstimateDrawingSheet
        moduleLabel="M1 - Gable - 4.6m x 5.1m - Acrylic"
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        meta={meta}
      />,
    );

    expect(markup).toContain('Plan view');
    expect(markup).toContain('Gable - 4.6m x 5.1m - Acrylic');
    expect(markup).toContain('Legend');
    expect(markup).toContain('Primary structure');
    expect(markup).toContain('Roof framing');
    expect(markup).toContain('Roof field');
    expect(markup).toContain('data-legend-sample="primary"');
    expect(markup).toContain('data-legend-sample="secondary"');
    expect(markup).toContain('data-legend-sample="tertiary"');
    expect(markup).toContain('data-source-class="modulePlanPerimeter"');
    expect(markup).toContain('data-source-class="modulePlanMemberEdge"');
    expect(markup).toContain('data-source-class="modulePlanRafter"');
    expect(markup).toContain('Sheet info');
    expect(markup).toContain('Module info');
    expect(markup).toContain('data-sheet-meta="sheet"');
    expect(markup).toContain('data-sheet-meta="revision"');
    expect(markup).toContain('data-sheet-meta="date"');
    expect(markup).not.toContain('data-sheet-meta="scale"');
    expect(markup).toContain('data-module-meta="style"');
    expect(markup).toContain('data-module-meta="roof material"');
    expect(markup).toContain('data-module-meta="colour"');
    expect(markup).toContain('data-module-meta="house connection"');
    expect(markup).toContain('data-module-meta="post connection"');
    expect(markup).toContain('data-module-meta="posts"');
    expect(markup).toContain('Fascia');
    expect(markup).toContain('Slab Anchors');
    expect(markup).toContain('Gable - 4.6m x 5.1m - Acrylic - Roof Plan');
    expect(markup).toContain('P-01');
    expect(markup).toContain('V1');
    expect(markup).toContain('1:50');
    expect(markup).toContain('Fit / NTS');
    expect(markup).toContain('Chanel');
    expect(markup).toContain('Portal preview');
    expect(markup).toContain('Note');
    expect(markup).toContain('Do not scale off portal preview.');
    expect(markup).toContain('Verify all dimensions on site.');
  });

  it('keeps soffit brackets as a dedicated plan legend item using drawing-system samples', () => {
    const drawing = makeDrawingModels({ houseConnectionType: 'soffit' });
    const meta = buildEstimateDrawingSheetMeta({
      moduleLabel: 'M3 - Gable - 4.6m x 5.1m - Acrylic',
      view: 'plan',
      versionLabel: 'V1',
      estimateDate: '2026-03-19T03:14:00.000Z',
      siteAddress: 'Millwater',
      clientName: 'Chanel',
    });

    const markup = renderToStaticMarkup(
      <EstimateDrawingSheet
        moduleLabel="M3 - Gable - 4.6m x 5.1m - Acrylic"
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        meta={meta}
      />,
    );

    expect(markup).toContain('Soffit brackets');
    expect(markup).toContain('data-source-class="modulePlanSoffitBracket"');
  });

  it('renders a section sheet with updated sheet code and title', () => {
    const drawing = makeDrawingModels();
    const meta = buildEstimateDrawingSheetMeta({
      moduleLabel: 'M2 - Gable - 6.2m x 3.4m - Acrylic',
      view: 'section',
      versionLabel: 'V2',
      estimateDate: '2026-03-20T03:14:00.000Z',
      projectName: 'Te Arai',
    });

    const markup = renderToStaticMarkup(
      <EstimateDrawingSheet
        moduleLabel="M2 - Gable - 6.2m x 3.4m - Acrylic"
        view="section"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        meta={meta}
      />,
    );

    expect(markup).toContain('Section view');
    expect(markup).toContain('Gable - 6.2m x 3.4m - Acrylic');
    expect(markup).toContain('Ridge beam');
    expect(markup).toContain('Roof members');
    expect(markup).toContain('Tie beam');
    expect(markup).toContain('Datum / guide');
    expect(markup).toContain('data-source-class="moduleSectionRidgeBeam"');
    expect(markup).toContain('data-source-class="moduleSectionTieBeamPrimary"');
    expect(markup).toContain('data-source-class="moduleSectionConnection"');
    expect(markup).toContain('Sheet info');
    expect(markup).toContain('data-sheet-meta="sheet"');
    expect(markup).toContain('data-sheet-meta="revision"');
    expect(markup).toContain('data-sheet-meta="date"');
    expect(markup).not.toContain('data-sheet-meta="scale"');
    expect(markup).toContain('Gable - 6.2m x 3.4m - Acrylic - Section');
    expect(markup).toContain('S-01');
    expect(markup).toContain('Te Arai');
  });

  it('keeps mono-only support conditions out of gable section legends', () => {
    const drawing = makeDrawingModels({ overhangEnabled: true, overhangAmountM: '0.45' });
    const meta = buildEstimateDrawingSheetMeta({
      moduleLabel: 'M4 - Gable - 4.6m x 5.1m - Acrylic',
      view: 'section',
      versionLabel: 'V2',
      estimateDate: '2026-03-20T03:14:00.000Z',
      siteAddress: 'Millwater',
    });

    const markup = renderToStaticMarkup(
      <EstimateDrawingSheet
        moduleLabel="M4 - Gable - 4.6m x 5.1m - Acrylic"
        view="section"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        meta={meta}
      />,
    );

    expect(markup).not.toContain('Overhang support');
    expect(markup).not.toContain('King strut');
    expect(markup).toContain('Datum / guide');
  });

  it('renders conditional module info rows for overhang and hip-corner modules', () => {
    const drawing = makeDrawingModels({
      pergolaStyle: 'hip_corner',
      overhangEnabled: true,
      overhangAmountM: '0.25',
      hipCornerLengthBM: '3.2',
      hipCornerProjectionBM: '2.4',
    });
    const meta = buildEstimateDrawingSheetMeta({
      moduleLabel: 'M5 - Hip Corner - Acrylic',
      moduleInfoRows: buildEstimateDrawingModuleInfoRows(
        makeModule({
          pergolaStyle: 'hip_corner',
          overhangEnabled: true,
          overhangAmountM: '0.25',
          hipCornerLengthBM: '3.2',
          hipCornerProjectionBM: '2.4',
        }),
      ),
      view: 'plan',
    });

    const markup = renderToStaticMarkup(
      <EstimateDrawingSheet
        moduleLabel="M5 - Hip Corner - Acrylic"
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        meta={meta}
      />,
    );

    expect(markup).toContain('data-module-meta="overhang"');
    expect(markup).toContain('0.25m');
    expect(markup).toContain('data-module-meta="hip corner b"');
    expect(markup).toContain('3.2m x 2.4m');
  });

  it('renders editable field affordances when editable fields are provided', () => {
    const snapshot = {
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Millwater',
        quoteRef: 'Q-1000',
        access: 'normal',
        height: 'single_storey',
        jobType: 'residential',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
        modules: [makeModule()],
      },
      outputs: {},
    } satisfies Record<string, unknown>;
    const drawing = buildEstimateDrawingModules(snapshot, { ignoreModuleResults: true })[0]!;
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    const editableFields = deriveEstimateDrawingEditableFields({
      draft,
      moduleIndex: 0,
      moduleLabel: 'M1 - Gable - 4.6m x 5.1m - Acrylic',
      view: 'plan',
      planModel: drawing.planModel,
      sectionModel: drawing.sectionModel,
    });
    const meta = buildEstimateDrawingSheetMeta({
      moduleLabel: 'M1 - Gable - 4.6m x 5.1m - Acrylic',
      view: 'plan',
    });

    const markup = renderToStaticMarkup(
      <EstimateDrawingSheet
        moduleLabel="M1 - Gable - 4.6m x 5.1m - Acrylic"
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        meta={meta}
        editableFields={editableFields}
        onCommitField={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('data-editable-field-id="plan:lengthA"');
  });

  it('renders hover targets for editable plan footprints without the old edit-house toolbar UI', () => {
    const drawing = makeDrawingModels();
    const meta = buildEstimateDrawingSheetMeta({
      moduleLabel: 'M1 - Gable - 4.6m x 5.1m - Acrylic',
      view: 'plan',
    });

    const markup = renderToStaticMarkup(
      <EstimateDrawingSheet
        moduleLabel="M1 - Gable - 4.6m x 5.1m - Acrylic"
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        meta={meta}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('data-sheet-hover-target="house"');
    expect(markup).toContain('data-sheet-hover-target="pergola"');
    expect(markup).not.toContain('Edit house context');
    expect(markup).not.toContain('data-sheet-plan-popover="house"');
  });

  it('keeps debug overlays hidden by default but can render them when enabled', () => {
    const drawing = makeDrawingModels();
    const meta = buildEstimateDrawingSheetMeta({
      moduleLabel: 'M1 - Gable - 4.6m x 5.1m - Acrylic',
      view: 'plan',
    });

    const hiddenMarkup = renderToStaticMarkup(
      <EstimateDrawingSheet
        moduleLabel="M1 - Gable - 4.6m x 5.1m - Acrylic"
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        meta={meta}
      />,
    );
    expect(hiddenMarkup).not.toContain('data-debug-crop="outer-plan"');

    const shownMarkup = renderToStaticMarkup(
      <EstimateDrawingSheet
        moduleLabel="M1 - Gable - 4.6m x 5.1m - Acrylic"
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        meta={meta}
        showDebugOverlays
      />,
    );
    expect(shownMarkup).toContain('data-debug-crop="outer-plan"');
    expect(shownMarkup).toContain('data-debug-crop="fit-plan"');
    expect(shownMarkup).toContain('data-debug-crop="bounds-plan"');
  });
});
