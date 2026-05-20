import {
  mergeEstimateDrawingDraftIntoSnapshot,
  resolveCalculatorInputsFromSnapshot,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import {
  buildHouseFootprintPresetSideLocalPoints,
} from '@sp/geometry';
import {
  makeDefaultHouseFootprintParams,
  normalizeAttachmentSide,
  normalizeDrawingRotationQuarterTurns,
  normalizeHouseFootprintMode,
  normalizeHouseFootprintParams,
  normalizeHouseFootprintPolygon,
  normalizeHouseFootprintPreset,
  normalizeHouseRoofMaterial,
  type CalculatorDrawingRotationQuarterTurns,
  type CalculatorHouseAttachmentStrategy,
  type CalculatorHouseFootprintMode,
  type CalculatorHouseFootprintParams,
  type CalculatorHouseFootprintPolygonPoint,
  type CalculatorHouseFootprintPreset,
  type CalculatorHouseRoofMaterial,
  type CalculatorHouseStoreyMode,
  type CalculatorModuleInputs,
} from '@/lib/types/calculator';
import type {
  HouseAttachmentZoneKind,
  HouseFirstDeckDraft,
  HouseFirstOpeningDraft,
  HouseFirstPergolaDraft,
  HouseFirstRoofDraft,
  HouseFirstMigrationWarning,
  HouseModel,
  HouseRoofFieldSource,
  HouseRoofForm,
  HouseFirstWorkbenchProjectModel,
  PergolaModel,
} from './houseFirstWorkbenchModel';
import { buildSharedDecks } from './houseFirstDeckAdapter';
import { buildSharedOpenings } from './houseFirstOpeningAdapter';
import {
  buildDerivedWallLookup,
  type DerivedWallLookup,
} from './houseFirstWallLookup';
import { resolveHouseRoofProjection } from './houseRoofFormAdapter';

type HouseFirstWorkbenchDraftCarrier = EstimateDrawingDraft & {
  houseFirst?: {
    roof?: HouseFirstRoofDraft | null;
    decks?: HouseFirstDeckDraft[] | null;
    openings?: HouseFirstOpeningDraft[] | null;
    pergolas?: HouseFirstPergolaDraft[] | null;
  } | null;
};

type SharedFieldConfig<T> = {
  field: string;
  fallback: T;
  pick: (module: CalculatorModuleInputs) => T;
  normalize?: (value: T) => T;
  isBlank?: (value: T) => boolean;
};

type SharedFieldResult<T> = {
  value: T;
  warning: HouseFirstMigrationWarning | null;
  lowConfidence: boolean;
  source: Extract<HouseRoofFieldSource, 'legacy_shared_value' | 'default_fallback'>;
};

function isBlankString(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${key}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function pickFirstDefined<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

function resolveHouseRoofForm(module: CalculatorModuleInputs): HouseRoofForm {
  if (module.boxPerimeterEnabled) return 'flat';
  // Milestone 13 session C: legacy `pergolaStyle === 'gable'` inherits
  // the same roof-form mapping as hipped (the unified Dutch-hip
  // builder produces gable-shape topology when all terminal ends are
  // opened, which the workbench draft normalize layer arranges).
  if (
    module.pergolaStyle === 'gable' ||
    module.pergolaStyle === 'hip' ||
    module.pergolaStyle === 'hip_corner'
  ) {
    return 'hipped';
  }
  return 'mono';
}


function resolvePergolaFamily(module: CalculatorModuleInputs): PergolaModel['family'] {
  if (module.boxPerimeterEnabled) return 'box';
  if (module.pergolaStyle === 'gable') return 'gable';
  if (module.pergolaStyle === 'hip') return 'hip';
  if (module.pergolaStyle === 'hip_corner') return 'hip_corner';
  if (module.pergolaStyle === 'pitched') return 'mono';
  return 'unknown';
}

function resolvePergolaAttachmentKind(
  module: CalculatorModuleInputs,
): PergolaModel['attachment']['kind'] {
  if (module.houseConnectionType === 'none') return 'freestanding';
  if (module.houseConnectionType === 'facade') return 'wall';
  return module.houseConnectionType;
}

function resolveAttachmentStrategyZoneKinds(
  strategy: CalculatorHouseAttachmentStrategy | null,
): HouseAttachmentZoneKind[] {
  if (strategy === 'none') return [];
  const kinds = new Set<HouseAttachmentZoneKind>();
  if (strategy === 'facade_ledger' || strategy === 'post_supported_tieback' || strategy === null) {
    kinds.add('wall');
  }
  if (strategy === 'soffit_brackets' || strategy === 'post_supported_tieback' || strategy === null) {
    kinds.add('soffit');
  }
  if (strategy === 'fascia_under_gutter' || strategy === null) {
    kinds.add('fascia');
  }
  if (strategy === 'fascia_under_gutter') {
    kinds.add('roof_edge');
  }
  return Array.from(kinds);
}


function normalizePergolaAttachmentZoneId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizePergolaAttachmentEdgeId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^footprint-edge-\d+$/.test(trimmed) ? trimmed : null;
}


type DerivedAttachmentZoneResolution = {
  zone: NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'][number];
  wall: HouseModel['derivedWallGraph']['walls'][number];
  side: NonNullable<CalculatorModuleInputs['attachmentSide']>;
  sourceEdgeId: string;
};

type DerivedEnvelopeLookup = {
  envelope: NonNullable<HouseModel['derivedEnvelope']>;
  compatibilityZones: HouseModel['attachmentZones'];
  diagnostics: HouseModel['attachmentZoneDiagnostics'];
  byEdgeId: Map<string, NonNullable<HouseModel['derivedEnvelope']>['edges'][number]>;
  byZoneId: Map<string, DerivedAttachmentZoneResolution>;
  zonesByEdgeId: Map<string, DerivedAttachmentZoneResolution[]>;
  zonesBySideAndKind: Map<string, DerivedAttachmentZoneResolution[]>;
};


function formatDerivedAttachmentZoneLabel(input: {
  edgeLabel: string;
  kind: HouseAttachmentZoneKind;
}): string {
  return `${input.edgeLabel} ${input.kind.replace('_', ' ')}`;
}

function buildDerivedEnvelopeLookup(input: {
  houseId: string;
  housePolygon: CalculatorHouseFootprintPolygonPoint[];
  derivedWalls: DerivedWallLookup;
  roof: Pick<HouseModel['roof'], 'form' | 'validation'>;
  attachmentStrategy: CalculatorHouseAttachmentStrategy | null;
  openings: HouseModel['openings'];
}): DerivedEnvelopeLookup {
  const edges: NonNullable<HouseModel['derivedEnvelope']>['edges'] = [];
  for (const resolvedWall of input.derivedWalls.byWallId.values()) {
    const [start, end] = resolvedWall.wall.polygon;
    if (!start || !end) continue;
    edges.push({
      id: resolvedWall.sourceEdgeId,
      label: resolvedWall.wall.label,
      semanticKind: 'wall_perimeter',
      sourceFormIds: [input.houseId],
      hostWallId: resolvedWall.wall.id,
      hostRoofZoneIds: [],
      start,
      end,
    });
  }

  const candidateKinds = resolveAttachmentStrategyZoneKinds(input.attachmentStrategy);
  const envelopeAttachmentZones: NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'] = [];
  const compatibilityZones: HouseModel['attachmentZones'] = [];
  const blocked: HouseModel['attachmentZoneDiagnostics']['blocked'] = [];
  const blockedKeys = new Set<string>();
  const openingsByWallId = new Map<string, HouseModel['openings']>();
  for (const opening of input.openings) {
    const key = opening.hostWallId ?? '';
    if (!key) continue;
    const existing = openingsByWallId.get(key) ?? [];
    existing.push(opening);
    openingsByWallId.set(key, existing);
  }

  for (const resolvedWall of input.derivedWalls.byWallId.values()) {
    const wallOpenings = openingsByWallId.get(resolvedWall.wall.id) ?? [];
    const hasAnyOpening = wallOpenings.some((opening) => opening.validation.status === 'valid');
    const hasLargeOpening = wallOpenings.some(
      (opening) =>
        opening.validation.status === 'valid' &&
        (opening.kind === 'slider' || opening.kind === 'stacker'),
    );

    for (const kind of candidateKinds) {
      let reason: HouseModel['attachmentZoneDiagnostics']['blocked'][number]['reason'] | null = null;
      if (kind === 'roof_edge' && input.roof.form === 'flat') {
        reason = 'unsupported_roof_form';
      } else if (
        (kind === 'soffit' || kind === 'fascia' || kind === 'roof_edge') &&
        input.roof.validation.status === 'invalid'
      ) {
        reason = 'invalid_roof_state';
      } else if (kind === 'wall' && hasAnyOpening) {
        reason = 'side_openings_block_wall';
      } else if ((kind === 'soffit' || kind === 'fascia' || kind === 'roof_edge') && hasLargeOpening) {
        reason = 'side_openings_block_roof_zone';
      }

      if (reason) {
        const blockedKey = `${resolvedWall.side}:${kind}:${reason}`;
        if (!blockedKeys.has(blockedKey)) {
          blocked.push({
            side: resolvedWall.side,
            kind,
            reason,
          });
          blockedKeys.add(blockedKey);
        }
        continue;
      }

      const zoneId = `zone-${kind}-${resolvedWall.sourceEdgeId}`;
      const label = formatDerivedAttachmentZoneLabel({
        edgeLabel: resolvedWall.wall.label,
        kind,
      });
      envelopeAttachmentZones.push({
        id: zoneId,
        label,
        kind,
        side: resolvedWall.side,
        sourceFormIds: [input.houseId],
        hostWallId: resolvedWall.wall.id,
        hostEdgeId: resolvedWall.sourceEdgeId,
        hostRoofZoneId: null,
      });
      compatibilityZones.push({
        id: zoneId,
        label,
        kind,
        side: resolvedWall.side,
      });
    }
  }

  const envelope: NonNullable<HouseModel['derivedEnvelope']> = {
    mergedFormIds: [input.houseId],
    footprint: input.housePolygon,
    wallGraph: input.derivedWalls.graph,
    roofZones: [],
    edges,
    attachmentZones: envelopeAttachmentZones,
  };

  const byEdgeId = new Map<string, NonNullable<HouseModel['derivedEnvelope']>['edges'][number]>();
  for (const edge of edges) {
    byEdgeId.set(edge.id, edge);
  }

  const byZoneId = new Map<string, DerivedAttachmentZoneResolution>();
  const zonesByEdgeId = new Map<string, DerivedAttachmentZoneResolution[]>();
  const zonesBySideAndKind = new Map<string, DerivedAttachmentZoneResolution[]>();
  for (const zone of envelopeAttachmentZones) {
    const wall = zone.hostWallId ? input.derivedWalls.byWallId.get(zone.hostWallId)?.wall ?? null : null;
    if (!wall || !zone.hostEdgeId) continue;
    const resolved = {
      zone,
      wall,
      side: zone.side,
      sourceEdgeId: zone.hostEdgeId,
    } satisfies DerivedAttachmentZoneResolution;
    byZoneId.set(zone.id, resolved);
    const edgeZones = zonesByEdgeId.get(zone.hostEdgeId) ?? [];
    edgeZones.push(resolved);
    zonesByEdgeId.set(zone.hostEdgeId, edgeZones);
    const sideKey = `${zone.side}:${zone.kind}`;
    const sideZones = zonesBySideAndKind.get(sideKey) ?? [];
    sideZones.push(resolved);
    zonesBySideAndKind.set(sideKey, sideZones);
  }

  return {
    envelope,
    compatibilityZones,
    diagnostics: { blocked },
    byEdgeId,
    byZoneId,
    zonesByEdgeId,
    zonesBySideAndKind,
  };
}


function normalizeStoreyMode(value: CalculatorModuleInputs['houseStoreyMode']): CalculatorHouseStoreyMode {
  if (value === 'double_storey' || value === 'custom') return value;
  return 'single_storey';
}

function isBlankFootprintParams(value: CalculatorHouseFootprintParams | undefined): boolean {
  return stableStringify(normalizeHouseFootprintParams(value)) === stableStringify(makeDefaultHouseFootprintParams());
}

function resolveSharedHouseField<T>(
  modules: CalculatorModuleInputs[],
  config: SharedFieldConfig<T>,
): SharedFieldResult<T> {
  const normalizedEntries = modules.map((module, moduleIndex) => {
    const rawValue = config.pick(module);
    const value = config.normalize ? config.normalize(rawValue) : rawValue;
    return {
      moduleIndex,
      value,
      comparable: stableStringify(value),
      blank: config.isBlank ? config.isBlank(value) : value === null || value === undefined,
    };
  });
  const populated = normalizedEntries.filter((entry) => !entry.blank);
  if (!populated.length) {
    return {
      value: config.fallback,
      warning: null,
      lowConfidence: false,
      source: 'default_fallback',
    };
  }

  const firstPopulated = populated[0]!;
  const conflict = populated.find((entry) => entry.comparable !== firstPopulated.comparable);
  if (!conflict) {
    return {
      value: firstPopulated.value,
      warning: null,
      lowConfidence: false,
      source: 'legacy_shared_value',
    };
  }

  const conflictingModuleIndexes = Array.from(
    new Set(populated.map((entry) => entry.moduleIndex)),
  );
  return {
    value: firstPopulated.value,
    warning: {
      id: `house-field-${config.field}`,
      code: 'conflicting_house_field',
      severity: 'blocking',
      field: config.field,
      chosenModuleIndex: firstPopulated.moduleIndex,
      conflictingModuleIndexes,
      message: `Legacy modules disagree on house ${config.field}. Using module ${firstPopulated.moduleIndex + 1} as the temporary shared value.`,
    },
    lowConfidence: true,
    source: 'legacy_shared_value',
  };
}

function buildSharedHouse(
  modules: CalculatorModuleInputs[],
  roofDraft?: HouseFirstRoofDraft | null,
  deckDrafts?: HouseFirstDeckDraft[] | null,
  openingDrafts?: HouseFirstOpeningDraft[] | null,
): {
  house: HouseModel | null;
  warnings: HouseFirstMigrationWarning[];
} {
  if (!modules.length) {
    return {
      house: null,
      warnings: [],
    };
  }

  const warnings: HouseFirstMigrationWarning[] = [];
  let lowConfidence = false;
  const collectResult = <T,>(config: SharedFieldConfig<T>) => {
    const result = resolveSharedHouseField(modules, config);
    if (result.warning) warnings.push(result.warning);
    if (result.lowConfidence) lowConfidence = true;
    return result;
  };
  const collect = <T,>(config: SharedFieldConfig<T>) => collectResult(config).value;

  const preset = collect({
    field: 'footprint preset',
    fallback: 'straight',
    pick: (module) => module.houseFootprintPreset,
    normalize: (value) => normalizeHouseFootprintPreset(value),
  });
  const footprintMode = collect({
    field: 'footprint mode',
    fallback: 'preset',
    pick: (module) => module.houseFootprintMode,
    normalize: (value) => normalizeHouseFootprintMode(value),
  });
  const footprintParams = collect({
    field: 'footprint params',
    fallback: makeDefaultHouseFootprintParams(),
    pick: (module) => module.houseFootprintParams,
    normalize: (value) => normalizeHouseFootprintParams(value),
    isBlank: (value) => isBlankFootprintParams(value),
  });
  const footprintPolygon = collect({
    field: 'footprint polygon',
    fallback: [] as CalculatorHouseFootprintPolygonPoint[],
    pick: (module) => module.houseFootprintPolygon,
    normalize: (value) => normalizeHouseFootprintPolygon(value),
    isBlank: (value) => normalizeHouseFootprintPolygon(value).length === 0,
  });
  const drawingRotationQuarterTurns = collect({
    field: 'drawing rotation',
    fallback: 0,
    pick: (module) => module.drawingRotationQuarterTurns ?? 0,
    normalize: (value) => normalizeDrawingRotationQuarterTurns(value),
  });
  const attachmentSide = collect({
    field: 'attachment side',
    fallback: 'rear',
    pick: (module) => module.attachmentSide ?? 'rear',
    normalize: (value) => normalizeAttachmentSide(value),
  });
  const storeyMode = collect({
    field: 'storey mode',
    fallback: 'single_storey' as const,
    pick: (module) => module.houseStoreyMode,
    normalize: (value) => normalizeStoreyMode(value),
  });
  const attachmentStrategy = collect({
    field: 'attachment strategy',
    fallback: null as CalculatorHouseAttachmentStrategy | null,
    pick: (module) => pickFirstDefined(module.houseAttachmentStrategy, null),
    isBlank: (value) => value === null,
  });
  const eaveHeightM = collect({
    field: 'eave height',
    fallback: '',
    pick: (module) => module.houseEaveHeightM ?? '',
    isBlank: isBlankString,
  });
  const wallHeightM = collect({
    field: 'wall height',
    fallback: '',
    pick: (module) => module.houseWallHeightM ?? '',
    isBlank: isBlankString,
  });
  const roofPitchResult = collectResult({
    field: 'roof pitch',
    fallback: '',
    pick: (module) => module.houseRoofPitchDeg ?? '',
    isBlank: isBlankString,
  });
  const roofPitchDeg = roofPitchResult.value;
  const soffitDepthMm = collect({
    field: 'soffit depth',
    fallback: '',
    pick: (module) => module.houseSoffitDepthMm ?? '',
    isBlank: isBlankString,
  });
  const fasciaHeightMm = collect({
    field: 'fascia height',
    fallback: '',
    pick: (module) => module.houseFasciaHeightMm ?? '',
    isBlank: isBlankString,
  });
  const gutterWidthMm = collect({
    field: 'gutter width',
    fallback: '',
    pick: (module) => module.houseGutterWidthMm ?? '',
    isBlank: isBlankString,
  });
  const gutterDepthMm = collect({
    field: 'gutter depth',
    fallback: '',
    pick: (module) => module.houseGutterDepthMm ?? '',
    isBlank: isBlankString,
  });
  const gutterProjectionMm = collect({
    field: 'gutter projection',
    fallback: '',
    pick: (module) => module.houseGutterProjectionMm ?? '',
    isBlank: isBlankString,
  });
  const eaveOverhangMm = collect({
    field: 'eave overhang',
    fallback: '',
    pick: (module) => module.houseEaveOverhangMm ?? '',
    isBlank: isBlankString,
  });
  const roofMaterialResult = collectResult({
    field: 'roof material',
    fallback: 'corrugated_iron',
    pick: (module) => module.houseRoofMaterial,
    normalize: (value) => normalizeHouseRoofMaterial(value),
  });
  const roofMaterial = roofMaterialResult.value;
  const roofForm = collect({
    field: 'roof form',
    fallback: 'mono' as const,
    pick: (module) => resolveHouseRoofForm(module),
  });

  const sourceModuleIds = modules.map((_, index) => `module-${index + 1}`);
  const attachmentKind = resolvePergolaAttachmentKind(modules[0]!);
  const normalizedFootprintMode = normalizeHouseFootprintMode(footprintMode) as CalculatorHouseFootprintMode;
  const normalizedFootprintPreset = normalizeHouseFootprintPreset(preset) as CalculatorHouseFootprintPreset;
  const normalizedFootprintParams = normalizeHouseFootprintParams(footprintParams);
  const normalizedFootprintPolygon = normalizeHouseFootprintPolygon(footprintPolygon);
  const normalizedDrawingRotationQuarterTurns = normalizeDrawingRotationQuarterTurns(
    drawingRotationQuarterTurns,
  ) as CalculatorDrawingRotationQuarterTurns;
  const normalizedAttachmentSide = normalizeAttachmentSide(
    attachmentSide,
  ) as NonNullable<CalculatorModuleInputs['attachmentSide']>;
  const normalizedRoofMaterial = normalizeHouseRoofMaterial(roofMaterial) as CalculatorHouseRoofMaterial;
  const normalizedStoreyMode = normalizeStoreyMode(storeyMode) as CalculatorHouseStoreyMode;
  const firstModuleLengthMm = Math.round((Number(modules[0]!.lengthM) || 6) * 1000);
  const firstModuleProjectionMm = Math.round((Number(modules[0]!.projectionM) || 3) * 1000);
  const derivedHousePolygon =
    normalizedFootprintMode === 'custom_polygon'
      ? normalizedFootprintPolygon
      : buildHouseFootprintPresetSideLocalPoints({
          pergolaWidthMm: firstModuleLengthMm,
          pergolaDepthMm: firstModuleProjectionMm,
          preset: normalizedFootprintPreset,
          params: normalizedFootprintParams,
          attachmentSide: normalizedAttachmentSide,
        }).map((point) => ({
          alongM: String(point.alongM),
          depthM: String(point.depthM),
        }));
  const roofProjection = resolveHouseRoofProjection({
    roofDraft: roofDraft ?? null,
    derivedHousePolygon,
    normalizedFootprintMode,
    normalizedFootprintPreset,
    normalizedFootprintParams,
    normalizedAttachmentSide,
    attachmentKind,
    attachmentStrategy,
    normalizedRoofMaterial,
    roofMaterialSource: roofMaterialResult.source,
    roofPitchSource: roofPitchResult.source,
    inferredPrimaryPitchDeg: roofPitchDeg,
    roofForm,
    firstModuleLengthMm,
    firstModuleProjectionMm,
    eaveHeightM,
    eaveOverhangMm,
  });
  for (const warning of roofProjection.warnings) warnings.push(warning);
  const derivedWalls = buildDerivedWallLookup({
    houseId: 'house-main',
    housePolygon: derivedHousePolygon,
  });
  const decks = buildSharedDecks({
    deckDrafts,
    housePolygon: derivedHousePolygon,
    footprintParams: normalizedFootprintParams,
  });
  const openings = buildSharedOpenings({
    openingDrafts,
    derivedWalls,
    fallbackWallId: normalizedAttachmentSide,
  });
  const derivedEnvelope = buildDerivedEnvelopeLookup({
    houseId: 'house-main',
    housePolygon: derivedHousePolygon,
    derivedWalls,
    roof: {
      form: roofProjection.roof.form,
      validation: roofProjection.roof.validation,
    },
    attachmentStrategy,
    openings,
  });

  return {
    house: {
      id: 'house-main',
      label: 'House',
      confidence: lowConfidence ? 'low' : 'high',
      lowConfidence,
      sourceModuleIndexes: modules.map((_, index) => index),
      sourceModuleIds,
      footprint: {
        mode: normalizedFootprintMode,
        preset: normalizedFootprintPreset,
        params: normalizedFootprintParams,
        polygon: normalizedFootprintPolygon,
        drawingRotationQuarterTurns: normalizedDrawingRotationQuarterTurns,
        attachmentSide: normalizedAttachmentSide,
      },
      // Roof view-model comes from the focused projection adapter
      // (`houseRoofFormAdapter`); the only field overlaid here is
      // `confidence`, which depends on whether any of the collect()'d
      // shared fields hit a low-confidence fallback inside this function.
      // Everything else (form, material, pitch, fall direction, ridge
      // axis, terminal ends, open gable IDs, appendage, geometry kind,
      // validation, provenance, capabilities, source) is owned by
      // `resolveHouseRoofProjection`.
      roof: {
        ...roofProjection.roof,
        confidence: lowConfidence ? 'low' : 'high',
      },
      storeyMode: normalizedStoreyMode,
      attachmentStrategy,
      eaveHeightM,
      wallHeightM,
      soffitDepthMm,
      fasciaHeightMm,
      gutterWidthMm,
      gutterDepthMm,
      gutterProjectionMm,
      eaveOverhangMm,
      derivedEnvelope: derivedEnvelope.envelope,
      derivedWallGraph: derivedWalls.graph,
      decks,
      openings,
      attachmentZones: derivedEnvelope.compatibilityZones,
      attachmentZoneDiagnostics: derivedEnvelope.diagnostics,
    },
    warnings,
  };
}

function buildPergolas(input: {
  modules: ReturnType<typeof buildEstimateDrawingModules>;
  legacyPergolas: Array<{ id: string; label: string }>;
  house: HouseModel | null;
  pergolaDrafts: HouseFirstPergolaDraft[] | null | undefined;
}): {
  pergolas: PergolaModel[];
  warnings: HouseFirstMigrationWarning[];
} {
  const groups = new Map<
    string,
    {
      label: string;
      modules: Array<{ moduleId: string; moduleIndex: number; moduleInput: CalculatorModuleInputs }>;
    }
  >();

  input.modules.forEach((module, moduleIndex) => {
    const pergolaId = module.input.pergolaId ?? `pergola-${moduleIndex + 1}`;
    const label =
      input.legacyPergolas.find((pergola) => pergola.id === pergolaId)?.label ??
      `Pergola ${groups.size + 1}`;
    const group = groups.get(pergolaId);
    if (group) {
      group.modules.push({ moduleId: module.id, moduleIndex, moduleInput: module.input });
      return;
    }
    groups.set(pergolaId, {
      label,
      modules: [{ moduleId: module.id, moduleIndex, moduleInput: module.input }],
    });
  });

  const draftByPergolaId = new Map<string, HouseFirstPergolaDraft>();
  for (const draft of input.pergolaDrafts ?? []) {
    if (!draft || typeof draft.id !== 'string' || draft.id.trim().length === 0) continue;
    draftByPergolaId.set(draft.id.trim(), draft);
  }

  const derivedEnvelope = input.house?.derivedEnvelope ?? null;
  const zonesById = new Map<string, NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'][number]>();
  const edgesById = new Map<string, NonNullable<HouseModel['derivedEnvelope']>['edges'][number]>();
  const zonesByEdgeId = new Map<string, Array<NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'][number]>>();
  const zonesBySideAndKind = new Map<string, Array<NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'][number]>>();
  for (const edge of derivedEnvelope?.edges ?? []) {
    edgesById.set(edge.id, edge);
  }
  for (const zone of derivedEnvelope?.attachmentZones ?? []) {
    zonesById.set(zone.id, zone);
    if (zone.hostEdgeId) {
      const edgeZones = zonesByEdgeId.get(zone.hostEdgeId) ?? [];
      edgeZones.push(zone);
      zonesByEdgeId.set(zone.hostEdgeId, edgeZones);
    }
    const sideKey = `${zone.side}:${zone.kind}`;
    const sideZones = zonesBySideAndKind.get(sideKey) ?? [];
    sideZones.push(zone);
    zonesBySideAndKind.set(sideKey, sideZones);
  }

  const warnings: HouseFirstMigrationWarning[] = [];
  const pergolas: PergolaModel[] = Array.from(groups.entries()).map(([pergolaId, group]) => {
    const firstModule = group.modules[0]!;
    const moduleInput = firstModule.moduleInput;
    const attachmentKind = resolvePergolaAttachmentKind(moduleInput);
    const normalizedAttachmentSide = normalizeAttachmentSide(
      moduleInput.attachmentSide ?? 'rear',
    ) as NonNullable<CalculatorModuleInputs['attachmentSide']>;
    const zoneKind = attachmentKind === 'freestanding'
      ? null
      : attachmentKind === 'wall'
        ? 'wall'
        : attachmentKind;
    const savedDraft = draftByPergolaId.get(pergolaId) ?? null;
    const requestedAttachmentZoneId = normalizePergolaAttachmentZoneId(savedDraft?.attachmentZoneId);
    const requestedAttachmentEdgeId = normalizePergolaAttachmentEdgeId(savedDraft?.attachmentEdgeId);
    let attachmentEdgeId =
      attachmentKind === 'freestanding'
        ? null
        : requestedAttachmentEdgeId;
    let attachmentZoneId =
      attachmentKind === 'freestanding'
        ? null
        : requestedAttachmentZoneId;
    let houseAttachmentZoneId: string | null = null;
    let resolvedAttachmentSide = normalizedAttachmentSide;
    let resolutionStatus: PergolaModel['attachment']['resolution']['status'] =
      attachmentKind === 'freestanding' ? 'resolved' : 'unresolved';
    let resolutionMessage: string | null = null;

    if (zoneKind === null) {
      attachmentEdgeId = null;
      attachmentZoneId = null;
    } else if (!derivedEnvelope) {
      resolutionMessage = 'This pergola no longer has a derived building envelope to attach to.';
    } else if (requestedAttachmentZoneId !== null) {
      const requestedZone = zonesById.get(requestedAttachmentZoneId) ?? null;
      if (requestedZone && requestedZone.kind === zoneKind && requestedZone.hostEdgeId) {
        attachmentZoneId = requestedZone.id;
        attachmentEdgeId = requestedZone.hostEdgeId;
        houseAttachmentZoneId = requestedZone.id;
        resolvedAttachmentSide = requestedZone.side;
        resolutionStatus = 'resolved';
      } else {
        resolutionMessage =
          `The saved ${zoneKind.replace('_', ' ')} host zone for this pergola is no longer available. Select a new host zone.`;
      }
    } else if (requestedAttachmentEdgeId !== null) {
      const compatibleZones = (zonesByEdgeId.get(requestedAttachmentEdgeId) ?? []).filter(
        (zone) => zone.kind === zoneKind,
      );
      const requestedEdge = edgesById.get(requestedAttachmentEdgeId) ?? null;
      if (requestedEdge && compatibleZones.length === 1) {
        const resolvedZone = compatibleZones[0]!;
        attachmentEdgeId = requestedEdge.id;
        attachmentZoneId = resolvedZone.id;
        houseAttachmentZoneId = resolvedZone.id;
        resolvedAttachmentSide = resolvedZone.side;
        resolutionStatus = 'resolved';
      } else {
        resolutionMessage =
          compatibleZones.length > 1
            ? `The saved host edge now resolves to multiple compatible ${zoneKind.replace('_', ' ')} zones. Select one explicitly.`
            : `The saved host edge no longer supports a ${zoneKind.replace('_', ' ')} attachment for this pergola. Select a new host edge.`;
      }
    } else {
      const legacyZones = zonesBySideAndKind.get(`${normalizedAttachmentSide}:${zoneKind}`) ?? [];
      if (legacyZones.length === 1) {
        const resolvedZone = legacyZones[0]!;
        attachmentEdgeId = resolvedZone.hostEdgeId ?? null;
        attachmentZoneId = resolvedZone.id;
        houseAttachmentZoneId = resolvedZone.id;
        resolvedAttachmentSide = resolvedZone.side;
        resolutionStatus = 'resolved';
      } else if (legacyZones.length > 1) {
        resolutionStatus = 'ambiguous';
        resolutionMessage =
          `Multiple compatible ${zoneKind.replace('_', ' ')} host edges exist on the ${normalizedAttachmentSide} side. Select the correct host edge for this pergola.`;
      } else {
        resolutionMessage =
          `The shared house no longer exposes a valid ${normalizedAttachmentSide} ${zoneKind.replace('_', ' ')} host zone for this pergola.`;
      }
    }

    if (zoneKind && resolutionStatus !== 'resolved') {
      const warningField =
        requestedAttachmentZoneId !== null
          ? `houseFirst.pergolas.${pergolaId}.attachmentZoneId`
          : requestedAttachmentEdgeId !== null
            ? `houseFirst.pergolas.${pergolaId}.attachmentEdgeId`
            : `inputs.modules.${firstModule.moduleIndex}.attachmentSide`;
      warnings.push({
        id: `house-attachment-zone-${pergolaId}`,
        code: 'invalid_house_attachment_zone_overlay',
        severity: 'blocking',
        field: warningField,
        chosenModuleIndex: firstModule.moduleIndex,
        conflictingModuleIndexes: [],
        message:
          resolutionMessage ??
          `The shared house no longer exposes a valid ${normalizedAttachmentSide} ${zoneKind.replace('_', ' ')} host zone for this pergola.`,
      });
    }

    return {
      id: pergolaId,
      label: group.label,
      family: resolvePergolaFamily(moduleInput),
      confidence: input.house?.lowConfidence ? 'low' : 'high',
      sourceModuleIndexes: group.modules.map((module) => module.moduleIndex),
      sourceModuleIds: group.modules.map((module) => module.moduleId),
      attachment: {
        id: `attachment-${pergolaId}`,
        kind: attachmentKind,
        attachmentEdgeId,
        attachmentZoneId,
        houseAttachmentZoneId,
        side: resolvedAttachmentSide,
        strategy: pickFirstDefined(moduleInput.houseAttachmentStrategy, null),
        resolution: {
          status: resolutionStatus,
          message: resolutionMessage,
        },
      },
    };
  });

  return {
    pergolas,
    warnings,
  };
}

export function buildHouseFirstWorkbenchProjectModel(input: {
  snapshot: Record<string, unknown> | null;
  draft?: HouseFirstWorkbenchDraftCarrier | null;
  ignoreModuleResults?: boolean;
}): HouseFirstWorkbenchProjectModel {
  const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(input.snapshot, input.draft);
  const calculatorInputs = resolveCalculatorInputsFromSnapshot(effectiveSnapshot);
  const modules = buildEstimateDrawingModules(effectiveSnapshot, {
    ignoreModuleResults: input.ignoreModuleResults,
  });
  const sharedHouse = buildSharedHouse(
    modules.map((module) => module.input),
    input.draft?.houseFirst?.roof ?? null,
    input.draft?.houseFirst?.decks ?? null,
    input.draft?.houseFirst?.openings ?? null,
  );
  const pergolaResult = buildPergolas({
    modules,
    legacyPergolas: calculatorInputs?.pergolas ?? [],
    house: sharedHouse.house,
    pergolaDrafts: input.draft?.houseFirst?.pergolas ?? null,
  });

  return {
    source: 'legacy_estimate_snapshot',
    house: sharedHouse.house,
    pergolas: pergolaResult.pergolas,
    warnings: [...sharedHouse.warnings, ...pergolaResult.warnings],
  };
}
