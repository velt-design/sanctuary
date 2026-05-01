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
  | 'quantity_takeoff';

export type CommercialParityDifferenceV1 = {
  path: string;
  label: string;
  left: unknown;
  right: unknown;
  severity: 'warning' | 'blocking';
  category: CommercialParityDifferenceCategoryV1;
  tolerance?: number;
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
};

type DifferenceDraft = Omit<CommercialParityDifferenceV1, 'severity'> & {
  severity?: CommercialParityDifferenceV1['severity'];
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

function addDifference(context: CompareContext, difference: DifferenceDraft): void {
  context.differences.push({
    ...difference,
    severity: difference.severity ?? 'warning',
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
  addDifference(context, {
    path: input.path,
    label: input.label,
    left: input.left,
    right: input.right,
    category: input.category,
    tolerance,
    severity: input.severity,
  });
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
    ['rafters.spacingMm', 'Rafter spacing', 'number'],
    ['rafters.cutLengthM', 'Rafter cut length', 'length_m'],
    ['beams.ledgerLengthM', 'Ledger length', 'length_m'],
    ['beams.frontBeamLengthM', 'Front beam length', 'length_m'],
    ['beams.ridgeLengthM', 'Ridge length', 'length_m'],
    ['beams.tieBeamLengthM', 'Tie beam length', 'length_m'],
    ['gutters.ourGutterLengthM', 'Our gutter length', 'length_m'],
    ['gutters.houseGutterLengthM', 'House gutter length', 'length_m'],
    ['gutters.downpipeCount', 'Downpipe count', 'count'],
    ['gutters.downpipeJoinCount', 'Downpipe join count', 'count'],
    ['gutters.downpipeElbowCount', 'Downpipe elbow count', 'count'],
    ['roofCladding.acrylicAreaM2', 'Acrylic area', 'area_m2'],
    ['roofCladding.timberAreaM2', 'Timber area', 'area_m2'],
    ['roofCladding.sheetCount', 'Sheet count', 'count'],
    ['roofCladding.joinerRuns', 'Joiner runs', 'count'],
    ['flashings.totalLengthM', 'Flashing total length', 'length_m'],
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

  const exactFields = [
    ['posts.profile', 'Post profile'],
    ['rafters.profile', 'Rafter profile'],
    ['beams.ledgerProfile', 'Ledger profile'],
    ['beams.frontBeamProfile', 'Front beam profile'],
    ['beams.ridgeProfile', 'Ridge profile'],
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
}

function collectDiagnostics(left: CommercialDesignInputV1, right: CommercialDesignInputV1): CommercialDiagnosticV1[] {
  return [
    ...left.diagnostics.map((diagnostic) => ({ ...diagnostic, code: `left.${diagnostic.code}` })),
    ...right.diagnostics.map((diagnostic) => ({ ...diagnostic, code: `right.${diagnostic.code}` })),
  ];
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
  };
}
