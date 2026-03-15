import { describe, expect, it } from 'vitest';
import { deriveRunningJobFields, getLatestRunningJobsEstimate, type RunningJobsEstimateLite } from './derive';

function makeEstimate(overrides: Partial<RunningJobsEstimateLite> = {}): RunningJobsEstimateLite {
  return {
    id: 'est-1',
    project_id: 'proj-1',
    status: 'draft',
    created_at: '2026-03-15T00:00:00Z',
    version: 1,
    inputs: {
      schemaVersion: 'v2',
      projectName: 'Project',
      quoteRef: '',
      access: 'normal',
      height: 'single_storey',
      jobType: 'residential',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
      modules: [
        {
          pergolaId: 'pergola-1',
          pergolaStyle: 'pitched',
          roofMaterial: 'acrylic',
          extrusionColour: 'Mill',
          powdercoatStandardColour: 'Ironsands',
          powdercoatIsCustom: false,
          powdercoatCustomColour: '',
          boxPerimeterEnabled: false,
          internalRoofType: 'flat',
          fallDistanceMm: '0',
          roofPitchDeg: '5',
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
          invertedHouseGutter: true,
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
          postConnectionType: 'deck_bracket',
          ground: 'level',
          lengthM: '6',
          projectionM: '3',
          hipCornerLengthBM: '0',
          hipCornerProjectionBM: '0',
          postCutHeightM: '2.4',
          timberRoofAllowanceExGst: '0',
        },
      ],
      blinds: { items: [] },
    },
    outputs: {
      materials: { lines: [], totals: { materials_ex_gst: 0 } },
      install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
      overhead: { method: 'job_rollup', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
      totals: { cost_ex_gst: 0, cost_inc_gst: 0, warnings: [], notes_and_warnings: [] },
      warnings: [],
      snapshot: {
        contact: {
          displayName: 'Snapshot Contact',
        },
      },
    },
    ...overrides,
  };
}

describe('getLatestRunningJobsEstimate', () => {
  it('prefers the highest-version non-archived estimate', () => {
    const latest = getLatestRunningJobsEstimate([
      makeEstimate({ id: 'archived-v9', status: 'archived', version: 9 }),
      makeEstimate({ id: 'draft-v2', version: 2, created_at: '2026-03-15T00:00:00Z' }),
      makeEstimate({ id: 'draft-v3', version: 3, created_at: '2026-03-14T00:00:00Z' }),
    ]);

    expect(latest?.id).toBe('draft-v3');
  });
});

describe('deriveRunningJobFields', () => {
  it('derives estimate-backed columns and keeps lights manual-only', () => {
    const derived = deriveRunningJobFields(
      makeEstimate({
        inputs: {
          schemaVersion: 'v2',
          projectName: 'Project',
          quoteRef: '',
          access: 'normal',
          height: 'single_storey',
          jobType: 'commercial',
          travelExGst: '0',
          extrasAllowanceExGst: '0',
          quoteDiscountPct: '0',
          pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
          modules: [
            {
              pergolaId: 'pergola-1',
              pergolaStyle: 'pitched',
              roofMaterial: 'acrylic',
              extrusionColour: 'Mill',
              powdercoatStandardColour: 'Ironsands',
              powdercoatIsCustom: false,
              powdercoatCustomColour: '',
              boxPerimeterEnabled: false,
              internalRoofType: 'flat',
              fallDistanceMm: '0',
              roofPitchDeg: '5',
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
              invertedEnabled: true,
              invertedHouseGutter: true,
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
              postConnectionType: 'deck_bracket',
              ground: 'level',
              lengthM: '6',
              projectionM: '3',
              hipCornerLengthBM: '0',
              hipCornerProjectionBM: '0',
              postCutHeightM: '2.4',
              timberRoofAllowanceExGst: '0',
            },
          ],
          blinds: {
            items: [{ id: 'blind-1', label: 'Kitchen', system: 'ZIPTRAK', widthMm: '2400', coverLengthMm: '2100', fabric: 'PVC', motorised: 'NONE' }],
          },
        },
      }),
      'Yes',
    );

    expect(derived.snapshotContactName).toBe('Snapshot Contact');
    expect(derived.derived.pergola_type).toBe('Commercial Inverted Pitched');
    expect(derived.derived.blinds_status).toBe('Yes');
    expect(derived.derived.size_text).toBe('6x3m');
    expect(derived.derived.colour_text).toBe('Ironsands');
    expect(derived.derived.roofing_text).toBe('Acrylic');
    expect(derived.derived.lights_status).toBe('TBC');
    expect(derived.effectiveLightsStatus).toBe('Yes');
  });

  it('normalizes roofing labels to the three ops categories', () => {
    const timber = deriveRunningJobFields(
      makeEstimate({
        inputs: {
          ...(makeEstimate().inputs as any),
          modules: [
            {
              ...(makeEstimate().inputs as any).modules[0],
              roofMaterial: 'timber',
            },
          ],
        },
      }),
      null,
    );
    const combination = deriveRunningJobFields(
      makeEstimate({
        inputs: {
          ...(makeEstimate().inputs as any),
          modules: [
            {
              ...(makeEstimate().inputs as any).modules[0],
              roofMaterial: 'mixed',
            },
          ],
        },
      }),
      null,
    );

    expect(timber.derived.roofing_text).toBe('Timber');
    expect(combination.derived.roofing_text).toBe('Combination');
  });

  it('returns TBC for estimate-backed statuses when no estimate exists', () => {
    const derived = deriveRunningJobFields(null, null);

    expect(derived.snapshotContactName).toBe('');
    expect(derived.derived.blinds_status).toBe('TBC');
    expect(derived.derived.pergola_type).toBeNull();
    expect(derived.effectiveLightsStatus).toBe('TBC');
  });
});
