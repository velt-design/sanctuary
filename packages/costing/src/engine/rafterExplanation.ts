import type {
  RafterCutLengthDeductionV1,
  RafterCutLengthExplanationV1,
  RafterCutLengthPlaneExplanationV1,
  RafterProfile,
  RoofType,
} from './types';

type RafterTakeoffExplanationFacts = {
  roofType: RoofType;
  enteredSpanM: number;
  pitchDegUsed: number;
  rafterProfile: RafterProfile;
  rafterCount: number;
  boxPerimeterEnabled: boolean;
  angleCutAllowanceM: number;
  representativeRunM: number;
  representativeCutLengthM: number;
  houseAllowanceM?: number;
  farAllowanceM?: number;
  ridgeHalfM?: number;
  houseRunM?: number;
  outerRunM?: number;
  houseCutLengthM?: number;
  outerCutLengthM?: number;
};

const FORMULA =
  'cut length = effective projected run / cos(pitch) + angle-cut allowance' as const;

function finiteNonNegative(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function deduction(
  id: RafterCutLengthDeductionV1['id'],
  label: string,
  value: number,
): RafterCutLengthDeductionV1 {
  return { id, label, value_m: Math.max(0, value) };
}

function plane(input: {
  id: RafterCutLengthPlaneExplanationV1['id'];
  label: string;
  diagramSide: RafterCutLengthPlaneExplanationV1['diagram_side'];
  baseRunM: number;
  deductions: RafterCutLengthDeductionV1[];
  effectiveRunM: number;
  angleCutAllowanceM: number;
  cutLengthM: number;
}): RafterCutLengthPlaneExplanationV1 {
  return {
    id: input.id,
    label: input.label,
    diagram_side: input.diagramSide,
    base_projected_run_m: Math.max(0, input.baseRunM),
    deductions: input.deductions,
    effective_projected_run_m: Math.max(0, input.effectiveRunM),
    sloped_length_before_allowance_m: Math.max(
      0,
      input.cutLengthM - input.angleCutAllowanceM,
    ),
    angle_cut_allowance_m: Math.max(0, input.angleCutAllowanceM),
    cut_length_m: Math.max(0, input.cutLengthM),
  };
}

function commonContract(
  input: RafterTakeoffExplanationFacts,
  planes: RafterCutLengthPlaneExplanationV1[],
  assumptions: string[],
): RafterCutLengthExplanationV1 {
  const values = [
    input.enteredSpanM,
    input.pitchDegUsed,
    input.angleCutAllowanceM,
    ...planes.flatMap((item) => [
      item.base_projected_run_m,
      ...item.deductions.map((deductionItem) => deductionItem.value_m),
      item.effective_projected_run_m,
      item.sloped_length_before_allowance_m,
      item.cut_length_m,
    ]),
  ];
  const status =
    values.every((value) => Number.isFinite(value) && value >= 0) &&
    input.enteredSpanM > 0 &&
    planes.length > 0 &&
    planes.every((item) => item.effective_projected_run_m > 0 && item.cut_length_m > 0)
      ? 'ready'
      : 'invalid_input';

  return {
    version: 1,
    status,
    source: '@sp/costing/engine/rafter-takeoff-v1',
    roof_type: input.roofType,
    entered_span_m: Math.max(0, input.enteredSpanM),
    pitch_deg_used: Math.max(0, input.pitchDegUsed),
    rafter_profile: input.rafterProfile,
    rafter_count: Math.max(0, input.rafterCount),
    formula: FORMULA,
    rounding: {
      display_increment_mm: 1,
      method: 'nearest',
      engine_values: 'unrounded',
    },
    planes,
    assumptions,
    ...(status === 'invalid_input'
      ? { unavailable_reason: 'Resolve the module dimensions before relying on this cut length.' }
      : null),
  };
}

export function buildRafterCutLengthExplanationV1(
  input: RafterTakeoffExplanationFacts,
): RafterCutLengthExplanationV1 {
  const sharedAssumptions = [
    'Pitch is the value selected by the costing engine after defaults and box-perimeter rules.',
    'The angle-cut allowance is owned by the costing engine and follows the resolved rafter profile.',
    'Displayed values round to the nearest millimetre; costing retains the unrounded metre values.',
  ];

  if (input.roofType === 'hip_corner') {
    return {
      version: 1,
      status: 'unsupported_roof',
      source: '@sp/costing/engine/rafter-takeoff-v1',
      roof_type: input.roofType,
      entered_span_m: Math.max(0, input.enteredSpanM),
      pitch_deg_used: Math.max(0, input.pitchDegUsed),
      rafter_profile: input.rafterProfile,
      rafter_count: Math.max(0, input.rafterCount),
      formula: FORMULA,
      rounding: {
        display_increment_mm: 1,
        method: 'nearest',
        engine_values: 'unrounded',
      },
      planes: [],
      assumptions: sharedAssumptions,
      unavailable_reason:
        'Hip-corner modules require a two-wing explanation and are not represented by one Section cut.',
    };
  }

  if (input.roofType === 'pitched') {
    const houseAllowanceM = finiteNonNegative(input.houseAllowanceM) ?? 0;
    const farAllowanceM = finiteNonNegative(input.farAllowanceM) ?? 0;
    const explanationPlane = plane({
      id: 'single',
      label: 'Rafter',
      diagramSide: 'single',
      baseRunM: input.enteredSpanM,
      deductions: [
        deduction('house_edge', 'House-edge allowance', houseAllowanceM),
        deduction('outer_edge', 'Outer-edge allowance', farAllowanceM),
      ],
      effectiveRunM: input.representativeRunM,
      angleCutAllowanceM: input.angleCutAllowanceM,
      cutLengthM: input.representativeCutLengthM,
    });
    return commonContract(input, [explanationPlane], [
      ...sharedAssumptions,
      'House-edge and outer-edge allowances reflect the resolved ledger, beam, and gutter arrangement.',
      ...(input.boxPerimeterEnabled
        ? ['Box-perimeter pitch and fall constraints are already reflected in the engine-selected pitch.']
        : []),
    ]);
  }

  if (input.roofType === 'gable' || input.roofType === 'low_gable') {
    const halfSpanM = Math.max(0, input.enteredSpanM / 2);
    const ridgeHalfM = finiteNonNegative(input.ridgeHalfM) ?? 0;
    const houseRunM = finiteNonNegative(input.houseRunM) ?? 0;
    const outerRunM = finiteNonNegative(input.outerRunM) ?? 0;
    const houseCutLengthM = finiteNonNegative(input.houseCutLengthM) ?? 0;
    const outerCutLengthM = finiteNonNegative(input.outerCutLengthM) ?? 0;
    const houseEaveM = Math.max(0, halfSpanM - ridgeHalfM - houseRunM);
    const outerEaveM = Math.max(0, halfSpanM - ridgeHalfM - outerRunM);

    return commonContract(
      input,
      [
        plane({
          id: 'house',
          label: 'House-side rafter',
          diagramSide: 'left',
          baseRunM: halfSpanM,
          deductions: [
            deduction('ridge', 'Half ridge width', ridgeHalfM),
            deduction('house_edge', 'House-side eave allowance', houseEaveM),
          ],
          effectiveRunM: houseRunM,
          angleCutAllowanceM: input.angleCutAllowanceM,
          cutLengthM: houseCutLengthM,
        }),
        plane({
          id: 'outer',
          label: 'Outer-side rafter',
          diagramSide: 'right',
          baseRunM: halfSpanM,
          deductions: [
            deduction('ridge', 'Half ridge width', ridgeHalfM),
            deduction('outer_edge', 'Outer-side eave allowance', outerEaveM),
          ],
          effectiveRunM: outerRunM,
          angleCutAllowanceM: input.angleCutAllowanceM,
          cutLengthM: outerCutLengthM,
        }),
      ],
      [
        ...sharedAssumptions,
        'The entered span is split at the ridge and each roof side is calculated separately.',
        ...(input.boxPerimeterEnabled
          ? ['Box-perimeter pitch and fall constraints are already reflected in the engine-selected pitch.']
          : []),
      ],
    );
  }

  const halfSpanM = Math.max(0, input.enteredSpanM / 2);
  const totalEdgeAllowancesM = Math.max(0, halfSpanM - input.representativeRunM);
  const explanationPlane = plane({
    id: 'common',
    label: 'Common rafter',
    diagramSide: 'both',
    baseRunM: halfSpanM,
    deductions: [
      deduction('edge_allowances', 'Engine edge allowances', totalEdgeAllowancesM),
    ],
    effectiveRunM: input.representativeRunM,
    angleCutAllowanceM: input.angleCutAllowanceM,
    cutLengthM: input.representativeCutLengthM,
  });

  return commonContract(input, [explanationPlane], [
    ...sharedAssumptions,
    'This explains the common rafters on both roof planes.',
    'Diagonal hip rafters use a separate engine takeoff and are not represented by this common-rafter result.',
  ]);
}
