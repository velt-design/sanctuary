import type {
  CommercialDesignInputV1,
  CommercialDiagnosticV1,
  CommercialModuleInputV1,
  CommercialPergolaInputV1,
  CommercialTrustStatusV1,
} from './types';

export type CommercialParityStatusV1 = 'match' | 'drift' | 'blocked';

export type CommercialParityDifferenceCategoryV1 =
  | 'schema'
  | 'trust'
  | 'structure'
  | 'site_commercial'
  | 'design_intent'
  | 'solved_geometry'
  | 'quantity_takeoff'
  | 'commercial_option';

export type CommercialParityDriftOriginV1 =
  | 'authored_intent'
  | 'solved_geometry'
  | 'physical_takeoff'
  | 'commercial_mapping';

export type CommercialParityOriginDetailV1 = {
  origin: CommercialParityDriftOriginV1;
  sourceCategory: CommercialParityDifferenceCategoryV1;
  fieldPath: string;
  explanation: string;
};

export type CommercialParityDifferenceV1 = {
  path: string;
  label: string;
  left: unknown;
  right: unknown;
  severity: 'warning' | 'blocking';
  category: CommercialParityDifferenceCategoryV1;
  driftOrigin: CommercialParityDriftOriginV1;
  originDetail: CommercialParityOriginDetailV1;
  tolerance?: number;
  location?: {
    pathSegments: string[];
    fieldPath: string;
    pergolaId?: string;
    moduleKey?: string;
    sourceModuleIndex?: number;
  };
  numericDrift?: {
    delta: number;
    absoluteDelta: number;
    tolerance: number;
  };
};

export type CommercialParityToleranceCategoryV1 =
  | 'area_m2'
  | 'count'
  | 'length_m'
  | 'money'
  | 'number'
  | 'percentage';

export type CommercialParityOptionsV1 = {
  labelLeft?: string;
  labelRight?: string;
  tolerances?: Partial<Record<CommercialParityToleranceCategoryV1, number>> & Record<string, number | undefined>;
};

export type CommercialParityReportV1 = {
  status: CommercialParityStatusV1;
  left: {
    label: string;
    source: CommercialDesignInputV1['source'];
    trustStatus: CommercialTrustStatusV1;
  };
  right: {
    label: string;
    source: CommercialDesignInputV1['source'];
    trustStatus: CommercialTrustStatusV1;
  };
  counts: {
    pergolasCompared: number;
    modulesCompared: number;
    differences: number;
    blockingDifferences: number;
    warningDifferences: number;
  };
  differences: CommercialParityDifferenceV1[];
  diagnostics: CommercialDiagnosticV1[];
  summary?: {
    byCategory: Partial<Record<CommercialParityDifferenceCategoryV1, number>>;
    byDriftOrigin: Partial<Record<CommercialParityDriftOriginV1, number>>;
    bySeverity: Partial<Record<CommercialParityDifferenceV1['severity'], number>>;
    byModule: Record<
      string,
      {
        pergolaId: string;
        moduleKey: string;
        sourceModuleIndex?: number;
        differences: number;
        blockingDifferences: number;
        warningDifferences: number;
      }
    >;
  };
};

type DifferenceDraft = Omit<CommercialParityDifferenceV1, 'severity' | 'driftOrigin' | 'originDetail'> & {
  severity?: CommercialParityDifferenceV1['severity'];
  driftOrigin?: CommercialParityDifferenceV1['driftOrigin'];
  originDetail?: CommercialParityDifferenceV1['originDetail'];
};

type CompareContext = {
  options: CommercialParityOptionsV1;
  differences: CommercialParityDifferenceV1[];
  pergolasCompared: number;
  modulesCompared: number;
};

const DEFAULT_TOLERANCES: Record<CommercialParityToleranceCategoryV1, number> = {
  area_m2: 0.1,
  count: 0,
  length_m: 0.02,
  money: 0,
  number: 0,
  percentage: 0,
};

function sourceLabel(input: CommercialDesignInputV1, label: string | undefined): string {
  return label ?? input.source;
}

function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toleranceFor(
  options: CommercialParityOptionsV1,
  path: string,
  category: CommercialParityToleranceCategoryV1,
): number {
  const pathTolerance = options.tolerances?.[path];
  if (typeof pathTolerance === 'number' && Number.isFinite(pathTolerance)) return Math.max(0, pathTolerance);
  const categoryTolerance = options.tolerances?.[category];
  if (typeof categoryTolerance === 'number' && Number.isFinite(categoryTolerance)) return Math.max(0, categoryTolerance);
  return DEFAULT_TOLERANCES[category];
}

function driftOriginForCategory(category: CommercialParityDifferenceCategoryV1): CommercialParityDriftOriginV1 {
  switch (category) {
    case 'design_intent':
      return 'authored_intent';
    case 'trust':
    case 'solved_geometry':
      return 'solved_geometry';
    case 'quantity_takeoff':
      return 'physical_takeoff';
    case 'schema':
    case 'structure':
    case 'site_commercial':
    case 'commercial_option':
      return 'commercial_mapping';
    default:
      return 'commercial_mapping';
  }
}

function originExplanation(input: {
  origin: CommercialParityDriftOriginV1;
  category: CommercialParityDifferenceCategoryV1;
  fieldPath: string;
}): string {
  const field = input.fieldPath || 'root';
  switch (input.origin) {
    case 'authored_intent':
      return `Authored intent mismatch at ${field}.`;
    case 'solved_geometry':
      return `Solved geometry mismatch at ${field}.`;
    case 'physical_takeoff':
      return `Physical takeoff mismatch at ${field}.`;
    case 'commercial_mapping':
      return `Commercial mapping mismatch at ${field}.`;
    default:
      return `${input.category} mismatch at ${field}.`;
  }
}

function originDetailForDifference(input: {
  category: CommercialParityDifferenceCategoryV1;
  driftOrigin: CommercialParityDriftOriginV1;
  location: NonNullable<CommercialParityDifferenceV1['location']>;
}): CommercialParityOriginDetailV1 {
  const fieldPath = input.location.fieldPath || input.location.pathSegments.join('.');
  return {
    origin: input.driftOrigin,
    sourceCategory: input.category,
    fieldPath,
    explanation: originExplanation({
      origin: input.driftOrigin,
      category: input.category,
      fieldPath,
    }),
  };
}

function addDifference(context: CompareContext, difference: DifferenceDraft): void {
  const severity = difference.severity ?? 'warning';
  const driftOrigin = difference.driftOrigin ?? driftOriginForCategory(difference.category);
  const location = difference.location ?? locationForPath(difference.path);
  context.differences.push({
    ...difference,
    severity,
    driftOrigin,
    location,
    originDetail:
      difference.originDetail ??
      originDetailForDifference({
        category: difference.category,
        driftOrigin,
        location,
      }),
  });
}

function compareExact(
  context: CompareContext,
  input: {
    path: string;
    label: string;
    left: unknown;
    right: unknown;
    category: CommercialParityDifferenceCategoryV1;
    severity?: CommercialParityDifferenceV1['severity'];
  },
): void {
  if (input.left === input.right) return;
  addDifference(context, input);
}

function compareNumeric(
  context: CompareContext,
  input: {
    path: string;
    label: string;
    left: unknown;
    right: unknown;
    category: CommercialParityDifferenceCategoryV1;
    toleranceCategory: CommercialParityToleranceCategoryV1;
    severity?: CommercialParityDifferenceV1['severity'];
  },
): void {
  const tolerance = toleranceFor(context.options, input.path, input.toleranceCategory);
  if (isNumeric(input.left) && isNumeric(input.right) && Math.abs(input.left - input.right) <= tolerance) {
    return;
  }
  if (input.left == null && input.right == null) return;
  const numericDrift =
    isNumeric(input.left) && isNumeric(input.right)
      ? {
          delta: input.right - input.left,
          absoluteDelta: Math.abs(input.right - input.left),
          tolerance,
        }
      : undefined;
  addDifference(context, {
    path: input.path,
    label: input.label,
    left: input.left,
    right: input.right,
    category: input.category,
    tolerance,
    numericDrift,
    severity: input.severity,
  });
}

function parseSourceModuleIndex(moduleKey: string | undefined): number | undefined {
  if (!moduleKey?.startsWith('source:')) return undefined;
  const parsed = Number.parseInt(moduleKey.slice('source:'.length), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function locationForPath(path: string): CommercialParityDifferenceV1['location'] {
  const pathSegments = path.split('.').filter(Boolean);
  const pergolaIndex = pathSegments.indexOf('pergolas');
  const modulesIndex = pathSegments.indexOf('modules');
  const pergolaId = pergolaIndex >= 0 ? pathSegments[pergolaIndex + 1] : undefined;
  const moduleKey = modulesIndex >= 0 ? pathSegments[modulesIndex + 1] : undefined;
  const sourceModuleIndex = parseSourceModuleIndex(moduleKey);
  const fieldSegments = moduleKey
    ? pathSegments.slice(modulesIndex + 2)
    : pergolaId
      ? pathSegments.slice(pergolaIndex + 2)
      : pathSegments;

  return {
    pathSegments,
    fieldPath: fieldSegments.join('.'),
    ...(pergolaId ? { pergolaId } : null),
    ...(moduleKey ? { moduleKey } : null),
    ...(sourceModuleIndex != null ? { sourceModuleIndex } : null),
  };
}

function keyForModule(module: CommercialModuleInputV1): string {
  if (typeof module.sourceModuleIndex === 'number' && Number.isFinite(module.sourceModuleIndex)) {
    return `source:${module.sourceModuleIndex}`;
  }
  return `id:${module.id}`;
}

function moduleLabel(module: CommercialModuleInputV1 | undefined, fallback: string): string {
  return module?.label ?? module?.id ?? fallback;
}

function matchModules(
  left: CommercialPergolaInputV1,
  right: CommercialPergolaInputV1,
): Array<{ key: string; left?: CommercialModuleInputV1; right?: CommercialModuleInputV1 }> {
  const leftByKey = new Map(left.modules.map((module) => [keyForModule(module), module]));
  const rightByKey = new Map(right.modules.map((module) => [keyForModule(module), module]));
  const keys = Array.from(new Set([...leftByKey.keys(), ...rightByKey.keys()])).sort();
  return keys.map((key) => ({ key, left: leftByKey.get(key), right: rightByKey.get(key) }));
}

function compareDesignIntent(
  context: CompareContext,
  path: string,
  left: CommercialModuleInputV1,
  right: CommercialModuleInputV1,
): void {
  const l = left.designIntent;
  const r = right.designIntent;
  const exactFields = [
    ['pergolaStyle', 'Pergola style'],
    ['roofMaterial', 'Roof material'],
    ['extrusionColour', 'Extrusion colour'],
    ['roofType', 'Roof type'],
    ['houseConnectionType', 'House connection'],
    ['attachmentSide', 'Attachment side'],
    ['postConnectionType', 'Post connection'],
    ['ground', 'Ground condition'],
    ['roofOptions.boxPerimeterEnabled', 'Box perimeter enabled'],
    ['roofOptions.gableEndFramesMode', 'Gable end frames mode'],
    ['roofOptions.mixedRoofMode', 'Mixed roof mode'],
    ['roofOptions.overhangEnabled', 'Overhang enabled'],
    ['roofOptions.invertedEnabled', 'Inverted enabled'],
  ] as const;

  for (const [field, label] of exactFields) {
    compareExact(context, {
      path: `${path}.designIntent.${field}`,
      label,
      left: valueAt(l, field),
      right: valueAt(r, field),
      category: 'design_intent',
    });
  }

  compareNumeric(context, {
    path: `${path}.designIntent.roofPitchDeg`,
    label: 'Roof pitch',
    left: l.roofPitchDeg,
    right: r.roofPitchDeg,
    category: 'design_intent',
    toleranceCategory: 'number',
  });
  compareNumeric(context, {
    path: `${path}.designIntent.dimensions.lengthM`,
    label: 'Authored length',
    left: l.dimensions?.lengthM,
    right: r.dimensions?.lengthM,
    category: 'design_intent',
    toleranceCategory: 'length_m',
  });
  compareNumeric(context, {
    path: `${path}.designIntent.dimensions.projectionM`,
    label: 'Authored projection',
    left: l.dimensions?.projectionM,
    right: r.dimensions?.projectionM,
    category: 'design_intent',
    toleranceCategory: 'length_m',
  });
  compareNumeric(context, {
    path: `${path}.designIntent.dimensions.secondaryLengthM`,
    label: 'Authored secondary length',
    left: l.dimensions?.secondaryLengthM,
    right: r.dimensions?.secondaryLengthM,
    category: 'design_intent',
    toleranceCategory: 'length_m',
  });
  compareNumeric(context, {
    path: `${path}.designIntent.dimensions.secondaryProjectionM`,
    label: 'Authored secondary projection',
    left: l.dimensions?.secondaryProjectionM,
    right: r.dimensions?.secondaryProjectionM,
    category: 'design_intent',
    toleranceCategory: 'length_m',
  });
}

function compareSolvedGeometry(
  context: CompareContext,
  path: string,
  left: CommercialModuleInputV1,
  right: CommercialModuleInputV1,
): void {
  const l = left.solvedGeometry;
  const r = right.solvedGeometry;
  compareExact(context, {
    path: `${path}.solvedGeometry.status`,
    label: 'Solved geometry trust',
    left: l.status,
    right: r.status,
    category: 'trust',
    severity: l.status === 'blocked' || r.status === 'blocked' ? 'blocking' : 'warning',
  });
  compareNumeric(context, {
    path: `${path}.solvedGeometry.primaryDimensionsM.length`,
    label: 'Solved length',
    left: l.primaryDimensionsM?.length,
    right: r.primaryDimensionsM?.length,
    category: 'solved_geometry',
    toleranceCategory: 'length_m',
  });
  compareNumeric(context, {
    path: `${path}.solvedGeometry.primaryDimensionsM.projection`,
    label: 'Solved projection',
    left: l.primaryDimensionsM?.projection,
    right: r.primaryDimensionsM?.projection,
    category: 'solved_geometry',
    toleranceCategory: 'length_m',
  });
  compareNumeric(context, {
    path: `${path}.solvedGeometry.roofPlaneCount`,
    label: 'Roof plane count',
    left: l.roofPlaneCount,
    right: r.roofPlaneCount,
    category: 'solved_geometry',
    toleranceCategory: 'count',
  });
  compareNumeric(context, {
    path: `${path}.solvedGeometry.attachmentLengthM`,
    label: 'Attachment length',
    left: l.attachmentLengthM,
    right: r.attachmentLengthM,
    category: 'solved_geometry',
    toleranceCategory: 'length_m',
  });
}

function compareTakeoff(
  context: CompareContext,
  path: string,
  left: CommercialModuleInputV1,
  right: CommercialModuleInputV1,
): void {
  const l = left.quantityTakeoff;
  const r = right.quantityTakeoff;
  const numericFields: Array<[string, string, CommercialParityToleranceCategoryV1]> = [
    ['primaryDimensions.lengthM', 'Takeoff length', 'length_m'],
    ['primaryDimensions.projectionM', 'Takeoff projection', 'length_m'],
    ['primaryDimensions.roofAreaM2', 'Roof area', 'area_m2'],
    ['roofPlanes.length', 'Roof plane rows', 'count'],
    ['posts.count', 'Post count', 'count'],
    ['posts.cutHeightM', 'Post cut height', 'length_m'],
    ['rafters.count', 'Rafter count', 'count'],
    ['rafters.bayCount', 'Rafter bay count', 'count'],
    ['rafters.spacingMm', 'Rafter spacing', 'number'],
    ['rafters.effectiveRunM', 'Rafter effective run', 'length_m'],
    ['rafters.projectedRunM', 'Rafter projected run', 'length_m'],
    ['rafters.cutLengthM', 'Rafter cut length', 'length_m'],
    ['rafters.totalLengthM', 'Rafter total length', 'length_m'],
    ['beams.ledgerLengthM', 'Ledger length', 'length_m'],
    ['beams.frontBeamLengthM', 'Front beam length', 'length_m'],
    ['beams.ridgeLengthM', 'Ridge length', 'length_m'],
    ['beams.tieBeamLengthM', 'Tie beam length', 'length_m'],
    ['beams.totalBeamLengthM', 'Total beam length', 'length_m'],
    ['gutters.ourGutterLengthM', 'Our gutter length', 'length_m'],
    ['gutters.houseGutterLengthM', 'House gutter length', 'length_m'],
    ['gutters.totalLengthM', 'Total gutter length', 'length_m'],
    ['gutters.downpipeCount', 'Downpipe count', 'count'],
    ['gutters.downpipeJoinCount', 'Downpipe join count', 'count'],
    ['gutters.downpipeElbowCount', 'Downpipe elbow count', 'count'],
    ['roofCladding.acrylicAreaM2', 'Acrylic area', 'area_m2'],
    ['roofCladding.timberAreaM2', 'Timber area', 'area_m2'],
    ['roofCladding.sheetCount', 'Sheet count', 'count'],
    ['roofCladding.effectiveRunM', 'Roof cladding effective run', 'length_m'],
    ['roofCladding.acrylicRequiredDownslopeM', 'Acrylic required downslope', 'length_m'],
    ['roofCladding.averageDownslopeLengthM', 'Roof cladding average downslope', 'length_m'],
    ['roofCladding.joinerRuns', 'Joiner runs', 'count'],
    ['roofCladding.panelCount', 'Roof cladding panel count', 'count'],
    ['roofCladding.totalAreaM2', 'Roof cladding total area', 'area_m2'],
    ['joiners.count', 'Joiner count', 'count'],
    ['joiners.totalLengthM', 'Joiner total length', 'length_m'],
    ['joiners.averageLengthM', 'Joiner average length', 'length_m'],
    ['flashings.totalLengthM', 'Flashing total length', 'length_m'],
    ['flashings.count', 'Flashing count', 'count'],
    ['flashings.surfaceAreaM2', 'Flashing surface area', 'area_m2'],
    ['infills.itemCount', 'Infill item count', 'count'],
    ['infills.sheetAreaM2', 'Infill sheet area', 'area_m2'],
    ['infills.stripPanelCount', 'Infill strip panel count', 'count'],
    ['blindsAndAccessories.blindCount', 'Blind count', 'count'],
    ['blindsAndAccessories.accessoryCount', 'Accessory count', 'count'],
  ];

  for (const [field, label, toleranceCategory] of numericFields) {
    compareNumeric(context, {
      path: `${path}.quantityTakeoff.${field}`,
      label,
      left: field === 'roofPlanes.length' ? l.roofPlanes?.length : valueAt(l, field),
      right: field === 'roofPlanes.length' ? r.roofPlanes?.length : valueAt(r, field),
      category: 'quantity_takeoff',
      toleranceCategory,
    });
  }

  const roofPlaneCount = Math.max(l.roofPlanes?.length ?? 0, r.roofPlanes?.length ?? 0);
  for (let index = 0; index < roofPlaneCount; index += 1) {
    const leftPlane = l.roofPlanes?.[index];
    const rightPlane = r.roofPlanes?.[index];
    const planePath = `${path}.quantityTakeoff.roofPlanes.${index}`;
    compareNumeric(context, {
      path: `${planePath}.areaM2`,
      label: `Roof plane ${index + 1} area`,
      left: leftPlane?.areaM2,
      right: rightPlane?.areaM2,
      category: 'quantity_takeoff',
      toleranceCategory: 'area_m2',
    });
    compareNumeric(context, {
      path: `${planePath}.rafterLengthM`,
      label: `Roof plane ${index + 1} rafter length`,
      left: leftPlane?.rafterLengthM,
      right: rightPlane?.rafterLengthM,
      category: 'quantity_takeoff',
      toleranceCategory: 'length_m',
    });
    compareNumeric(context, {
      path: `${planePath}.rafterProjectedRunM`,
      label: `Roof plane ${index + 1} rafter projected run`,
      left: leftPlane?.rafterProjectedRunM,
      right: rightPlane?.rafterProjectedRunM,
      category: 'quantity_takeoff',
      toleranceCategory: 'length_m',
    });
    compareNumeric(context, {
      path: `${planePath}.rafterCutLengthM`,
      label: `Roof plane ${index + 1} rafter cut length`,
      left: leftPlane?.rafterCutLengthM,
      right: rightPlane?.rafterCutLengthM,
      category: 'quantity_takeoff',
      toleranceCategory: 'length_m',
    });
    compareNumeric(context, {
      path: `${planePath}.rafterCount`,
      label: `Roof plane ${index + 1} rafter count`,
      left: leftPlane?.rafterCount,
      right: rightPlane?.rafterCount,
      category: 'quantity_takeoff',
      toleranceCategory: 'count',
    });
    compareNumeric(context, {
      path: `${planePath}.rafterSpacingMm`,
      label: `Roof plane ${index + 1} rafter spacing`,
      left: leftPlane?.rafterSpacingMm,
      right: rightPlane?.rafterSpacingMm,
      category: 'quantity_takeoff',
      toleranceCategory: 'number',
    });
    compareNumeric(context, {
      path: `${planePath}.rafterTotalLengthM`,
      label: `Roof plane ${index + 1} rafter total length`,
      left: leftPlane?.rafterTotalLengthM,
      right: rightPlane?.rafterTotalLengthM,
      category: 'quantity_takeoff',
      toleranceCategory: 'length_m',
    });
    compareNumeric(context, {
      path: `${planePath}.bayCount`,
      label: `Roof plane ${index + 1} bay count`,
      left: leftPlane?.bayCount,
      right: rightPlane?.bayCount,
      category: 'quantity_takeoff',
      toleranceCategory: 'count',
    });
    compareNumeric(context, {
      path: `${planePath}.claddingAreaM2`,
      label: `Roof plane ${index + 1} cladding area`,
      left: leftPlane?.claddingAreaM2,
      right: rightPlane?.claddingAreaM2,
      category: 'quantity_takeoff',
      toleranceCategory: 'area_m2',
    });
    compareNumeric(context, {
      path: `${planePath}.claddingDownslopeLengthM`,
      label: `Roof plane ${index + 1} cladding downslope length`,
      left: leftPlane?.claddingDownslopeLengthM,
      right: rightPlane?.claddingDownslopeLengthM,
      category: 'quantity_takeoff',
      toleranceCategory: 'length_m',
    });
    compareNumeric(context, {
      path: `${planePath}.claddingPanelCount`,
      label: `Roof plane ${index + 1} cladding panel count`,
      left: leftPlane?.claddingPanelCount,
      right: rightPlane?.claddingPanelCount,
      category: 'quantity_takeoff',
      toleranceCategory: 'count',
    });
    compareNumeric(context, {
      path: `${planePath}.joinerCount`,
      label: `Roof plane ${index + 1} joiner count`,
      left: leftPlane?.joinerCount,
      right: rightPlane?.joinerCount,
      category: 'quantity_takeoff',
      toleranceCategory: 'count',
    });
    compareNumeric(context, {
      path: `${planePath}.joinerTotalLengthM`,
      label: `Roof plane ${index + 1} joiner total length`,
      left: leftPlane?.joinerTotalLengthM,
      right: rightPlane?.joinerTotalLengthM,
      category: 'quantity_takeoff',
      toleranceCategory: 'length_m',
    });
    compareNumeric(context, {
      path: `${planePath}.joinerTargetLengthM`,
      label: `Roof plane ${index + 1} joiner target length`,
      left: leftPlane?.joinerTargetLengthM,
      right: rightPlane?.joinerTargetLengthM,
      category: 'quantity_takeoff',
      toleranceCategory: 'length_m',
    });
  }

  const flashingBandKeys = Array.from(
    new Set([
      ...Object.keys(l.flashings?.byBandM ?? {}),
      ...Object.keys(r.flashings?.byBandM ?? {}),
    ]),
  ).sort();
  for (const band of flashingBandKeys) {
    compareNumeric(context, {
      path: `${path}.quantityTakeoff.flashings.byBandM.${band}`,
      label: `Flashing band ${band}`,
      left: l.flashings?.byBandM?.[band],
      right: r.flashings?.byBandM?.[band],
      category: 'quantity_takeoff',
      toleranceCategory: 'length_m',
    });
  }

  const flashingGirthKeys = Array.from(
    new Set([
      ...Object.keys(l.flashings?.byGirthM ?? {}),
      ...Object.keys(r.flashings?.byGirthM ?? {}),
    ]),
  ).sort();
  for (const girth of flashingGirthKeys) {
    compareNumeric(context, {
      path: `${path}.quantityTakeoff.flashings.byGirthM.${girth}`,
      label: `Flashing girth ${girth}`,
      left: l.flashings?.byGirthM?.[girth],
      right: r.flashings?.byGirthM?.[girth],
      category: 'quantity_takeoff',
      toleranceCategory: 'length_m',
    });
  }

  const exactFields = [
    ['posts.profile', 'Post profile'],
    ['rafters.profile', 'Rafter profile'],
    ['beams.ledgerProfile', 'Ledger profile'],
    ['beams.frontBeamProfile', 'Front beam profile'],
    ['beams.ridgeProfile', 'Ridge profile'],
    ['joiners.profile', 'Joiner profile'],
  ] as const;
  for (const [field, label] of exactFields) {
    compareExact(context, {
      path: `${path}.quantityTakeoff.${field}`,
      label,
      left: valueAt(l, field),
      right: valueAt(r, field),
      category: 'quantity_takeoff',
    });
  }
}

function compareOptions(
  context: CompareContext,
  path: string,
  left: CommercialModuleInputV1,
  right: CommercialModuleInputV1,
): void {
  const l = left.options;
  const r = right.options;
  const powdercoatFields = [
    ['powdercoat.standardColour', 'Powdercoat standard colour'],
    ['powdercoat.isCustom', 'Powdercoat custom flag'],
    ['powdercoat.customColour', 'Powdercoat custom colour'],
  ] as const;

  for (const [field, label] of powdercoatFields) {
    compareExact(context, {
      path: `${path}.options.${field}`,
      label,
      left: valueAt(l, field),
      right: valueAt(r, field),
      category: 'commercial_option',
    });
  }

  const overrideKeys = Array.from(
    new Set([
      ...Object.keys(l.overrides ?? {}),
      ...Object.keys(r.overrides ?? {}),
    ]),
  ).sort();
  for (const key of overrideKeys) {
    compareExact(context, {
      path: `${path}.options.overrides.${key}`,
      label: `Override ${key}`,
      left: l.overrides?.[key],
      right: r.overrides?.[key],
      category: 'commercial_option',
    });
  }
}

function compareSiteCommercial(context: CompareContext, left: CommercialDesignInputV1, right: CommercialDesignInputV1): void {
  const l = left.siteCommercial;
  const r = right.siteCommercial;
  const exactFields = [
    ['jobType', 'Job type'],
    ['access', 'Access'],
    ['height', 'Height'],
  ] as const;
  for (const [field, label] of exactFields) {
    compareExact(context, {
      path: `siteCommercial.${field}`,
      label,
      left: l[field],
      right: r[field],
      category: 'site_commercial',
    });
  }
  compareNumeric(context, {
    path: 'siteCommercial.travelExGst',
    label: 'Travel ex GST',
    left: l.travelExGst,
    right: r.travelExGst,
    category: 'site_commercial',
    toleranceCategory: 'money',
  });
  compareNumeric(context, {
    path: 'siteCommercial.extrasAllowanceExGst',
    label: 'Extras allowance ex GST',
    left: l.extrasAllowanceExGst,
    right: r.extrasAllowanceExGst,
    category: 'site_commercial',
    toleranceCategory: 'money',
  });
  compareNumeric(context, {
    path: 'siteCommercial.quoteDiscountPct',
    label: 'Quote discount percent',
    left: l.quoteDiscountPct,
    right: r.quoteDiscountPct,
    category: 'site_commercial',
    toleranceCategory: 'percentage',
  });
}

function valueAt(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current == null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

function compareModule(
  context: CompareContext,
  input: {
    pergolaId: string;
    moduleKey: string;
    left: CommercialModuleInputV1;
    right: CommercialModuleInputV1;
  },
): void {
  context.modulesCompared += 1;
  const path = `pergolas.${input.pergolaId}.modules.${input.moduleKey}`;
  compareExact(context, {
    path: `${path}.trustStatus`,
    label: `Module trust (${moduleLabel(input.left, input.moduleKey)})`,
    left: input.left.trustStatus,
    right: input.right.trustStatus,
    category: 'trust',
    severity: input.left.trustStatus === 'blocked' || input.right.trustStatus === 'blocked' ? 'blocking' : 'warning',
  });
  compareDesignIntent(context, path, input.left, input.right);
  compareSolvedGeometry(context, path, input.left, input.right);
  compareTakeoff(context, path, input.left, input.right);
  compareOptions(context, path, input.left, input.right);
}

function collectDiagnostics(left: CommercialDesignInputV1, right: CommercialDesignInputV1): CommercialDiagnosticV1[] {
  return [
    ...left.diagnostics.map((diagnostic) => ({ ...diagnostic, code: `left.${diagnostic.code}` })),
    ...right.diagnostics.map((diagnostic) => ({ ...diagnostic, code: `right.${diagnostic.code}` })),
  ];
}

function emptyCategorySummary(): Partial<Record<CommercialParityDifferenceCategoryV1, number>> {
  return {};
}

function emptyDriftOriginSummary(): Partial<Record<CommercialParityDriftOriginV1, number>> {
  return {};
}

function emptySeveritySummary(): Partial<Record<CommercialParityDifferenceV1['severity'], number>> {
  return {};
}

function buildSummary(differences: CommercialParityDifferenceV1[]): NonNullable<CommercialParityReportV1['summary']> {
  const byCategory = emptyCategorySummary();
  const byDriftOrigin = emptyDriftOriginSummary();
  const bySeverity = emptySeveritySummary();
  const byModule: NonNullable<CommercialParityReportV1['summary']>['byModule'] = {};

  for (const difference of differences) {
    byCategory[difference.category] = (byCategory[difference.category] ?? 0) + 1;
    byDriftOrigin[difference.driftOrigin] = (byDriftOrigin[difference.driftOrigin] ?? 0) + 1;
    bySeverity[difference.severity] = (bySeverity[difference.severity] ?? 0) + 1;

    const location = difference.location;
    if (!location?.pergolaId || !location.moduleKey) continue;
    const key = `${location.pergolaId}/${location.moduleKey}`;
    const moduleSummary = byModule[key] ?? {
      pergolaId: location.pergolaId,
      moduleKey: location.moduleKey,
      ...(location.sourceModuleIndex != null ? { sourceModuleIndex: location.sourceModuleIndex } : null),
      differences: 0,
      blockingDifferences: 0,
      warningDifferences: 0,
    };
    moduleSummary.differences += 1;
    if (difference.severity === 'blocking') {
      moduleSummary.blockingDifferences += 1;
    } else {
      moduleSummary.warningDifferences += 1;
    }
    byModule[key] = moduleSummary;
  }

  return { byCategory, byDriftOrigin, bySeverity, byModule };
}

export function compareCommercialDesignInputsV1(
  left: CommercialDesignInputV1,
  right: CommercialDesignInputV1,
  options: CommercialParityOptionsV1 = {},
): CommercialParityReportV1 {
  const context: CompareContext = {
    options,
    differences: [],
    pergolasCompared: 0,
    modulesCompared: 0,
  };

  compareExact(context, {
    path: 'schemaVersion',
    label: 'Schema version',
    left: left.schemaVersion,
    right: right.schemaVersion,
    category: 'schema',
    severity: 'blocking',
  });
  compareExact(context, {
    path: 'trustStatus',
    label: 'Top-level trust',
    left: left.trustStatus,
    right: right.trustStatus,
    category: 'trust',
    severity: left.trustStatus === 'blocked' || right.trustStatus === 'blocked' ? 'blocking' : 'warning',
  });
  compareSiteCommercial(context, left, right);

  const leftPergolas = new Map(left.pergolas.map((pergola) => [pergola.id, pergola]));
  const rightPergolas = new Map(right.pergolas.map((pergola) => [pergola.id, pergola]));
  const pergolaIds = Array.from(new Set([...leftPergolas.keys(), ...rightPergolas.keys()])).sort();

  for (const pergolaId of pergolaIds) {
    const leftPergola = leftPergolas.get(pergolaId);
    const rightPergola = rightPergolas.get(pergolaId);
    if (!leftPergola || !rightPergola) {
      addDifference(context, {
        path: `pergolas.${pergolaId}`,
        label: `Pergola ${pergolaId}`,
        left: leftPergola ? 'present' : 'missing',
        right: rightPergola ? 'present' : 'missing',
        category: 'structure',
        severity: 'blocking',
      });
      continue;
    }
    context.pergolasCompared += 1;
    compareExact(context, {
      path: `pergolas.${pergolaId}.trustStatus`,
      label: `Pergola trust (${leftPergola.label ?? pergolaId})`,
      left: leftPergola.trustStatus,
      right: rightPergola.trustStatus,
      category: 'trust',
      severity: leftPergola.trustStatus === 'blocked' || rightPergola.trustStatus === 'blocked' ? 'blocking' : 'warning',
    });

    for (const moduleMatch of matchModules(leftPergola, rightPergola)) {
      if (!moduleMatch.left || !moduleMatch.right) {
        addDifference(context, {
          path: `pergolas.${pergolaId}.modules.${moduleMatch.key}`,
          label: `Module ${moduleMatch.key}`,
          left: moduleMatch.left ? 'present' : 'missing',
          right: moduleMatch.right ? 'present' : 'missing',
          category: 'structure',
          severity: 'blocking',
        });
        continue;
      }
      compareModule(context, {
        pergolaId,
        moduleKey: moduleMatch.key,
        left: moduleMatch.left,
        right: moduleMatch.right,
      });
    }
  }

  if (context.modulesCompared === 0) {
    addDifference(context, {
      path: 'pergolas.modules',
      label: 'Comparable modules',
      left: left.pergolas.flatMap((pergola) => pergola.modules).length,
      right: right.pergolas.flatMap((pergola) => pergola.modules).length,
      category: 'structure',
      severity: 'blocking',
    });
  }

  const blockingDifferences = context.differences.filter((difference) => difference.severity === 'blocking').length;
  const warningDifferences = context.differences.length - blockingDifferences;
  const status: CommercialParityStatusV1 =
    left.trustStatus === 'blocked' || right.trustStatus === 'blocked' || blockingDifferences > 0
      ? 'blocked'
      : warningDifferences > 0
        ? 'drift'
        : 'match';

  return {
    status,
    left: {
      label: sourceLabel(left, options.labelLeft),
      source: left.source,
      trustStatus: left.trustStatus,
    },
    right: {
      label: sourceLabel(right, options.labelRight),
      source: right.source,
      trustStatus: right.trustStatus,
    },
    counts: {
      pergolasCompared: context.pergolasCompared,
      modulesCompared: context.modulesCompared,
      differences: context.differences.length,
      blockingDifferences,
      warningDifferences,
    },
    differences: context.differences,
    diagnostics: collectDiagnostics(left, right),
    summary: buildSummary(context.differences),
  };
}
