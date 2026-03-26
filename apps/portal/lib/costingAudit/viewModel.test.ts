import { describe, expect, it } from 'vitest';
import type { MaterialsExplainV1 } from '@sp/costing';
import type { EstimateDetail } from '@/lib/estimates/types';
import {
  buildCostingAuditInstallRows,
  buildCostingAuditMaterialsRows,
  buildCostingAuditSummaryRows,
  buildModuleCostInputsFromSnapshot,
  getModuleCostOutputFromSnapshot,
} from './viewModel';

function makeDetail(): EstimateDetail {
  const snapshot = {
    inputs: {
      schemaVersion: 'v2',
      projectName: 'Coatesville',
      quoteRef: 'Q-2001',
      access: 'hard',
      height: 'single_storey',
      jobType: 'residential',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
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
          lengthM: '4.5',
          projectionM: '3.2',
          hipCornerLengthBM: '0',
          hipCornerProjectionBM: '0',
          postCutHeightM: '2.4',
          timberRoofAllowanceExGst: '0',
          flashings: { rows: [] },
          overrides: {},
          infills: { items: [] },
        },
        {
          pergolaId: 'pergola-1',
          pergolaStyle: 'gable',
          roofMaterial: 'acrylic',
          extrusionColour: 'Black',
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
          postCount: '3',
          houseConnectionType: 'none',
          postConnectionType: 'slab_anchors',
          ground: 'easy',
          lengthM: '6.1',
          projectionM: '4.4',
          hipCornerLengthBM: '0',
          hipCornerProjectionBM: '0',
          postCutHeightM: '2.6',
          timberRoofAllowanceExGst: '0',
          flashings: { rows: [] },
          overrides: {},
          infills: { items: [] },
        },
      ],
    },
    outputs: {
      materials: {
        lines: [],
        totals: {
          materials_ex_gst: 1200,
          waste_m_by_profile: {},
          bars_by_profile: {},
        },
      },
      install: {
        actions: [
          {
            id: 'job.mob.offload_materials',
            category: 'Mobilisation',
            label: 'Offload materials',
            scope: 'job',
            unit: 'each',
            qty: 1,
            minutes: 25,
            applied_multipliers: {},
            cost_ex_gst: 41.67,
          },
          {
            id: 'frame.install_front_beam_m',
            category: 'Frame',
            label: 'Install front beam',
            scope: 'module',
            unit: 'metre',
            qty: 6.1,
            minutes: 122,
            applied_multipliers: { steel_beam: 2.5 },
            cost_ex_gst: 203.33,
          },
        ],
        totals: {
          crew_minutes: 147,
          crew_hours: 2.45,
          install_ex_gst: 245,
        },
      },
      overhead: {
        method: 'fixed_plus_variable',
        ops_ex_gst: 80,
        sales_ex_gst: 40,
        total_ex_gst: 120,
      },
      totals: {
        cost_ex_gst: 1565,
        cost_inc_gst: 1799.75,
        warnings: [{ level: 'info', message: 'Check ridge flashing alignment' }],
        notes_and_warnings: [],
      },
      pergolas: [
        {
          id: 'pergola-1',
          modules: [
            {
              materials: {
                lines: [
                  {
                    id: 'frame.front_beam_250x50',
                    label: 'Front beam 250x50',
                    unit: 'bar',
                    qty: 2,
                    unit_cost_ex_gst: 180,
                    line_cost_ex_gst: 360,
                  },
                ],
                totals: {
                  materials_ex_gst: 360,
                  waste_m_by_profile: {},
                  bars_by_profile: {},
                },
              },
              install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
              overhead: { method: 'fixed', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
              add_ons: { travel_ex_gst: 0, extras_allowance_ex_gst: 0 },
              totals: { cost_ex_gst: 360, cost_inc_gst: 414, warnings: [], notes_and_warnings: [] },
              inputs_normalized: {},
              derived: {},
            },
            {
              materials: {
                lines: [
                  {
                    id: 'frame.front_beam_300x50',
                    label: 'Front beam 300x50',
                    unit: 'bar',
                    qty: 3,
                    unit_cost_ex_gst: 220,
                    line_cost_ex_gst: 660,
                  },
                ],
                totals: {
                  materials_ex_gst: 660,
                  waste_m_by_profile: {},
                  bars_by_profile: {},
                },
              },
              install: { actions: [], totals: { crew_minutes: 0, crew_hours: 0, install_ex_gst: 0 } },
              overhead: { method: 'fixed', ops_ex_gst: 0, sales_ex_gst: 0, total_ex_gst: 0 },
              add_ons: { travel_ex_gst: 0, extras_allowance_ex_gst: 0 },
              totals: { cost_ex_gst: 660, cost_inc_gst: 759, warnings: [], notes_and_warnings: [] },
              inputs_normalized: {},
              derived: {},
            },
          ],
        },
      ],
    },
    costing_manifest: 'manifest_v1.6',
    costing_rules: 'rules_v1.3',
  };

  return {
    id: 'est_1',
    projectId: 'proj_1',
    createdAt: '2026-03-20T03:14:00.000Z',
    status: 'draft',
    summary: {
      total: 1799.75,
      cost: 1565,
    },
    createdBy: 'Jordan',
    versionLabel: 'V2',
    isActiveDraft: true,
    hasSentQuote: false,
    jobPackEligible: false,
    jobPackGeneratedAt: null,
    jobPackQuoteVersionId: null,
    calculatorSnapshot: snapshot,
    internalNotes: null,
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

describe('costing audit view model', () => {
  it('builds summary rows from the estimate snapshot', () => {
    const rows = buildCostingAuditSummaryRows(makeDetail());

    expect(rows.find((row) => row.metric === 'Manifest')?.value).toBe('manifest_v1.6');
    expect(rows.find((row) => row.metric === 'Materials ex GST')?.value).toBe('$1200.00');
    expect(rows.find((row) => row.metric === 'Count')?.notes).toContain('Check ridge flashing alignment');
  });

  it('extracts module-specific costing data from the snapshot', () => {
    const detail = makeDetail();

    expect(buildModuleCostInputsFromSnapshot(detail.calculatorSnapshot, 1)?.length_m).toBe(6.1);
    expect(getModuleCostOutputFromSnapshot(detail.calculatorSnapshot, 1)?.materials.lines[0]?.id).toBe('frame.front_beam_300x50');
  });

  it('maps materials reasoning onto module material rows', () => {
    const detail = makeDetail();
    const moduleOutput = getModuleCostOutputFromSnapshot(detail.calculatorSnapshot, 1);
    const explain: MaterialsExplainV1 = {
      version: 'materials_explain_v1',
      created_at: '2026-03-26T00:00:00.000Z',
      inputs_normalized_snapshot: {},
      derived_snapshot: {},
      decisions: [],
      globals: {},
      cut_groups: {},
      lines: {
        '0': {
          kind: 'simple',
          line_index: 0,
          line_id: 'frame.front_beam_300x50',
          label: 'Front beam 300x50',
          unit: 'bar',
          qty: 3,
          unit_cost_ex_gst: 220,
          line_cost_ex_gst: 660,
          formula: 'qty from fixed BOM line',
          deps: { qty: 3, unit: 'bar' },
        },
      },
      warnings: [],
      truncation: [],
      stats: {
        detail: 'summary',
        total_cut_groups: 0,
        total_lines: 1,
        payload_truncated: false,
      },
    };

    const rows = buildCostingAuditMaterialsRows(moduleOutput, explain);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.itemId).toBe('frame.front_beam_300x50');
    expect(rows[0]?.why).toBe('qty from fixed BOM line');
    expect(rows[0]?.dependsOn).toContain('qty=3');
  });

  it('builds inferred install explanations from saved install actions', () => {
    const rows = buildCostingAuditInstallRows(makeDetail());

    expect(rows[0]?.why).toContain('Job-scoped action included once.');
    expect(rows[1]?.why).toContain('Steel beam multiplier applied.');
    expect(rows[1]?.dependsOn).toContain('Steel Beam x2.5');
  });
});
