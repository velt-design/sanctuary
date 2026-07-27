import type {
  InstallActionV1,
  InstallTotalsV1,
  MaterialsLineV1,
  TrustedBreakdownOwnerV1,
  TrustedLabourBreakdownGroupV1,
  TrustedLabourBreakdownV1,
  TrustedMaterialBreakdownGroupV1,
  TrustedMaterialsBreakdownV1,
  TrustedQuantityExplanationV1,
} from './types';

type BreakdownGroupDefinition = {
  id: string;
  label: string;
};

const MATERIAL_GROUPS = [
  { id: 'structure', label: 'Structure & framing' },
  { id: 'roofing', label: 'Roofing & weatherproofing' },
  { id: 'drainage', label: 'Drainage' },
  { id: 'fixings', label: 'Fixings & hardware' },
  { id: 'infills', label: 'Infills' },
  { id: 'finishes', label: 'Finishes' },
  { id: 'site', label: 'Site & access' },
  { id: 'consumables', label: 'Consumables & allowances' },
  { id: 'other', label: 'Other materials' },
] as const satisfies readonly BreakdownGroupDefinition[];

const LABOUR_GROUPS = [
  { id: 'site_setup', label: 'Site setup & mobilisation' },
  { id: 'structure', label: 'Structure installation' },
  { id: 'roofing', label: 'Roof installation' },
  { id: 'drainage', label: 'Drainage' },
  { id: 'infills', label: 'Infills' },
  { id: 'finishing', label: 'Finishing & handover' },
  { id: 'site_access', label: 'Site access & scaffolding' },
  { id: 'other', label: 'Other labour' },
] as const satisfies readonly BreakdownGroupDefinition[];

const STOCK_CUT_NOTE =
  /^Cuts\s+([\d.]+)m\s+from\s+([\d.]+)[x\u00d7]([\d.]+)m;\s+waste\s+([\d.]+)m\s+\(([^)]+)\)/i;

function round(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function cleanScopedLabel(value: string): {
  label: string;
  owner: TrustedBreakdownOwnerV1;
} {
  const match = value.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) {
    return {
      label: value.trim() || 'Unlabelled result',
      owner: { scope: 'unknown', label: 'Whole job' },
    };
  }

  const scopeLabel = match[1]!.trim();
  const label = match[2]!.trim().replace(/^\[Job\]\s*/i, '') || value.trim();
  if (/^job$/i.test(scopeLabel)) {
    return { label, owner: { scope: 'job', label: 'Whole job' } };
  }

  const moduleMatch = scopeLabel.match(/^(.*?)(?:\s+M)(\d+)$/i);
  if (moduleMatch) {
    const pergolaRaw = moduleMatch[1]!.trim();
    const pergolaLabel = /^P\d+$/i.test(pergolaRaw)
      ? `Pergola ${pergolaRaw.slice(1)}`
      : pergolaRaw;
    return {
      label,
      owner: {
        scope: 'module',
        label: `${pergolaLabel || 'Pergola'} / Module ${moduleMatch[2]}`,
      },
    };
  }

  const pergolaLabel = /^P\d+$/i.test(scopeLabel)
    ? `Pergola ${scopeLabel.slice(1)}`
    : scopeLabel;
  return {
    label,
    owner: { scope: 'pergola', label: pergolaLabel },
  };
}

function baseResultId(value: string): string {
  let id = value;
  while (/^(?:m|p)\d+\./i.test(id)) id = id.replace(/^(?:m|p)\d+\./i, '');
  return id.replace(/^job\./i, '');
}

function materialGroup(line: MaterialsLineV1): BreakdownGroupDefinition {
  const id = baseResultId(line.id).toLowerCase();
  const label = line.label.toLowerCase();
  const profile = String(line.profile ?? '').toLowerCase();

  if (id.includes('infill') || label.includes('infill')) return MATERIAL_GROUPS[4];
  if (id.includes('scaffold') || id.includes('hire.') || profile.includes('scaffold')) {
    return MATERIAL_GROUPS[6];
  }
  if (id.includes('powdercoat') || label.includes('powdercoat')) return MATERIAL_GROUPS[5];
  if (id.includes('consumable') || label.includes('consumable')) return MATERIAL_GROUPS[7];
  if (
    id.includes('gutter') ||
    id.includes('downpipe') ||
    profile.includes('gutter') ||
    label.includes('gutter') ||
    label.includes('downpipe')
  ) {
    return MATERIAL_GROUPS[2];
  }
  if (
    id.includes('roof') ||
    id.includes('flashing') ||
    id.includes('rubber') ||
    id.includes('underlay') ||
    id.includes('insulation') ||
    profile.includes('joiner') ||
    profile.includes('roofing') ||
    label.includes('roofing') ||
    label.includes('flashing') ||
    label.includes('rubber') ||
    label.includes('foam')
  ) {
    return MATERIAL_GROUPS[1];
  }
  if (
    id.includes('fixing') ||
    id.includes('bracket') ||
    id.includes('hardware') ||
    label.includes('screw') ||
    label.includes('bracket')
  ) {
    return MATERIAL_GROUPS[3];
  }
  if (
    id.includes('extrusion') ||
    id.includes('beam') ||
    id.includes('post') ||
    Boolean(line.profile)
  ) {
    return MATERIAL_GROUPS[0];
  }
  return MATERIAL_GROUPS[8];
}

function materialExplanation(
  line: MaterialsLineV1,
): TrustedQuantityExplanationV1 | undefined {
  const notes = String(line.notes ?? '').trim();
  const safeNotes = notes.includes('$')
    ? 'The configured finish and purchasing allowance are included in this line.'
    : notes;
  const stockMatch = notes.match(STOCK_CUT_NOTE);
  if (stockMatch) {
    const requiredLengthM = Number(stockMatch[1]);
    const bars = Number(stockMatch[2]);
    const stockLengthM = Number(stockMatch[3]);
    const wasteM = Number(stockMatch[4]);
    const hasFinishOverlay = notes.includes('|');

    return {
      version: 1,
      source: '@sp/costing/materials-v1',
      summary: `Required cuts total ${round(requiredLengthM)} m. Purchasing uses ${bars} whole ${round(stockLengthM)} m bar${bars === 1 ? '' : 's'}.`,
      facts: [
        { label: 'Required cuts', value: round(requiredLengthM), unit: 'm' },
        { label: 'Stock length', value: round(stockLengthM), unit: 'm' },
        { label: 'Bars purchased', value: bars, unit: 'bar' },
        { label: 'Allocated waste', value: round(wasteM), unit: 'm' },
      ],
      assumptions: hasFinishOverlay
        ? ['The configured finish is included without exposing its internal cost components.']
        : [],
      rounding:
        'Bars are purchased whole; allocated waste is stock left after arranging required cuts.',
    };
  }

  if (line.unit === 'sheet' && safeNotes) {
    return {
      version: 1,
      source: '@sp/costing/materials-v1',
      summary: safeNotes,
      facts: [
        { label: 'Sheets purchased', value: line.qty, unit: 'sheet' },
        ...(line.profile ? [{ label: 'Stock format', value: line.profile }] : []),
      ],
      assumptions: [],
      rounding:
        'Sheets are purchased as whole units; the engine rounds up to cover the calculated area or strip yield.',
    };
  }

  if (!safeNotes) return undefined;
  return {
    version: 1,
    source: '@sp/costing/materials-v1',
    summary: safeNotes,
    facts: [{ label: 'Calculated purchase quantity', value: line.qty, unit: line.unit }],
    assumptions: [
      'This purchasing note is supplied with the calculated material line.',
    ],
    rounding:
      line.unit === 'each' || line.unit === 'bar' || line.unit === 'job' || line.unit === 'day'
        ? 'Purchased in the whole units shown.'
        : 'The displayed quantity uses the rounding already applied to the calculated result.',
  };
}

function labourGroup(action: InstallActionV1): BreakdownGroupDefinition {
  const category = action.category.toLowerCase();
  const id = baseResultId(action.id).toLowerCase();

  if (id.includes('scaffold') || category === 'mob') return LABOUR_GROUPS[6];
  if (category.includes('mobil') || category.includes('site')) return LABOUR_GROUPS[0];
  if (
    category.includes('frame') ||
    category.includes('house') ||
    category.includes('post') ||
    category.includes('footing')
  ) {
    return LABOUR_GROUPS[1];
  }
  if (category.includes('rafter') || category === 'roof') return LABOUR_GROUPS[2];
  if (category.includes('drain')) return LABOUR_GROUPS[3];
  if (category.includes('infill') || id.includes('infill')) return LABOUR_GROUPS[4];
  if (category.includes('finish') || category.includes('demob')) return LABOUR_GROUPS[5];
  return LABOUR_GROUPS[7];
}

function cleanLabourLabel(value: string): string {
  return cleanScopedLabel(value).label
    .replace(/\s+-\s+per\s+.+$/i, '')
    .replace(/\s+-\s+each$/i, '')
    .replace(/\s+\((?:each|no fixings)\)$/i, '')
    .trim();
}

function multiplierLabel(value: string): string {
  const labels: Record<string, string> = {
    access: 'Site access',
    access_logistics: 'Access logistics',
    ground: 'Ground conditions',
    height: 'Working height',
    pitch_steep_roof: 'Steep roof pitch',
    rafter_length_loading_curve: 'Rafter length loading',
    rafter_length_multiplier: 'Rafter length',
    roof_type: 'Roof style',
    steel_beam: 'Steel beam handling',
    structure_type: 'Structure type',
  };
  return labels[value] ?? value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function labourQuantityBasis(action: InstallActionV1): string {
  const id = baseResultId(action.id).toLowerCase();
  if (id.includes('day_cycle')) return 'The calculated site duration sets this daily activity.';
  if (id.includes('install_rafter')) return 'The calculated rafter count sets this activity.';
  if (id.includes('rafter_length_loading')) {
    return 'The total calculated installed rafter length sets this activity.';
  }
  if (id.includes('post') || action.unit === 'post') {
    return 'The configured post or footing count sets this activity.';
  }
  if (id.includes('acrylic') && action.unit === 'm2') {
    return 'The calculated acrylic roof area sets this activity.';
  }
  if (id.includes('timber') && action.unit === 'm2') {
    return 'The calculated timber roof area sets this activity.';
  }
  if (id.includes('joiner') || id.includes('fix_joiner')) {
    return action.unit === 'each'
      ? 'The calculated joiner fixing count sets this activity.'
      : 'The calculated joiner length sets this activity.';
  }
  if (id.includes('flashing')) return 'The calculated flashing length sets this activity.';
  if (action.scope === 'job' && action.unit === 'job') {
    return 'This allowance is included once for the whole job.';
  }
  if (action.unit === 'job' || action.unit === 'module') {
    return 'This allowance is included once for the stated job or module.';
  }
  if (action.unit === 'm2') return 'A calculated installation area sets this activity.';
  if (action.unit === 'metre') return 'A calculated installed length sets this activity.';
  return 'The calculated result supplies this activity quantity.';
}

function labourExplanation(action: InstallActionV1): TrustedQuantityExplanationV1 {
  const nonNeutralMultipliers = Object.entries(action.applied_multipliers)
    .filter(([, factor]) => Number.isFinite(factor) && Math.abs(factor - 1) > 0.0001)
    .map(([id, factor]) => `${multiplierLabel(id)} ${round(factor)}x`);

  return {
    version: 1,
    source: '@sp/costing/install-actions-v1',
    summary: labourQuantityBasis(action),
    facts: [
      { label: 'Activity quantity', value: round(action.qty), unit: action.unit },
      { label: 'Estimated crew time', value: round(action.minutes), unit: 'min' },
      { label: 'Estimated crew hours', value: round(action.minutes / 60), unit: 'hours' },
    ],
    assumptions: nonNeutralMultipliers.length
      ? [`Time includes these applied loadings: ${nonNeutralMultipliers.join(', ')}.`]
      : ['No non-neutral access, height, roof, structure or handling loading changed this activity.'],
    rounding:
      'Activity minutes are rounded to 0.01 minute; displayed crew hours are minutes divided by 60.',
  };
}

function buildGroupedRows<Row>(
  definitions: readonly BreakdownGroupDefinition[],
  rows: Array<{ group: BreakdownGroupDefinition; row: Row }>,
): Array<{ definition: BreakdownGroupDefinition; rows: Row[] }> {
  return definitions
    .map((definition) => ({
      definition,
      rows: rows
        .filter((entry) => entry.group.id === definition.id)
        .map((entry) => entry.row),
    }))
    .filter((group) => group.rows.length > 0);
}

export function buildTrustedMaterialsBreakdownV1(
  lines: readonly MaterialsLineV1[],
): TrustedMaterialsBreakdownV1 {
  const rowsWithGroups = lines.map((line, index) => {
    const scoped = cleanScopedLabel(line.label);
    return {
      group: materialGroup(line),
      row: {
        instance_id: `${line.id}#${index + 1}`,
        id: line.id,
        label: scoped.label,
        owner: scoped.owner,
        quantity: line.qty,
        unit: line.unit,
        profile: line.profile,
        internal_cost_ex_gst: line.line_cost_ex_gst,
        explanation: materialExplanation(line),
      },
    };
  });

  for (const group of rowsWithGroups) {
    // Customer-facing order favours the largest procurement consequences first.
    group.row.internal_cost_ex_gst = round(group.row.internal_cost_ex_gst);
  }

  const grouped = buildGroupedRows(MATERIAL_GROUPS, rowsWithGroups).map(
    ({ definition, rows }): TrustedMaterialBreakdownGroupV1 => ({
      ...definition,
      rows: rows.sort(
        (left, right) =>
          right.internal_cost_ex_gst - left.internal_cost_ex_gst ||
          left.label.localeCompare(right.label),
      ),
    }),
  );

  return {
    version: 1,
    status: lines.length > 0 ? 'ready' : 'empty',
    source: '@sp/costing/materials-v1',
    scope: 'whole_job',
    row_count: lines.length,
    groups: grouped,
    assumptions: [
      'Quantities are whole-job procurement outputs, not selected-module estimates.',
      'Stock lengths, whole-unit purchasing, cut allocation and waste come directly from the calculated procurement result.',
      'Internal costs are included only for people with the existing permission.',
    ],
  };
}

export function buildTrustedLabourBreakdownV1(
  actions: readonly InstallActionV1[],
  totals: InstallTotalsV1,
): TrustedLabourBreakdownV1 {
  const rowsWithGroups = actions.map((action, index) => {
    const scoped = cleanScopedLabel(action.label);
    const relevantMultipliers = Object.entries(action.applied_multipliers)
      .filter(([, factor]) => Number.isFinite(factor) && Math.abs(factor - 1) > 0.0001)
      .map(([id, factor]) => ({
        id,
        label: multiplierLabel(id),
        factor: round(factor),
      }));

    return {
      group: labourGroup(action),
      row: {
        instance_id: `${action.id}#${index + 1}`,
        id: action.id,
        label: cleanLabourLabel(action.label),
        owner: scoped.owner,
        quantity: action.qty,
        unit: action.unit,
        minutes: action.minutes,
        crew_hours: round(action.minutes / 60),
        internal_cost_ex_gst: action.cost_ex_gst,
        relevant_multipliers: relevantMultipliers,
        explanation: labourExplanation(action),
      },
    };
  });

  const grouped = buildGroupedRows(LABOUR_GROUPS, rowsWithGroups).map(
    ({ definition, rows }): TrustedLabourBreakdownGroupV1 => {
      const sortedRows = rows.sort(
        (left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label),
      );
      const crewMinutes = round(sortedRows.reduce((total, row) => total + row.minutes, 0));
      return {
        ...definition,
        crew_minutes: crewMinutes,
        crew_hours: round(crewMinutes / 60),
        rows: sortedRows,
      };
    },
  );

  return {
    version: 1,
    status: actions.length > 0 ? 'ready' : 'empty',
    source: '@sp/costing/install-actions-v1',
    scope: 'whole_job',
    action_count: actions.length,
    total_crew_minutes: totals.crew_minutes,
    total_crew_hours: totals.crew_hours,
    groups: grouped,
    assumptions: [
      'Activities and time are whole-job crew estimates from the calculated result.',
      'Displayed loadings include only non-neutral multipliers; neutral 1x factors are omitted.',
      'Internal labour costs remain available only to people with the existing permission.',
    ],
  };
}
