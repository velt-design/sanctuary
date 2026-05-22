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
import type {
  ObjectFirstHouseFormDraft,
  ObjectFirstWorkbenchDraftVNext,
} from './objectFirstWorkbenchModel';
import { buildObjectWorkbenchCompatibilityDraftFromObjectFirstDraft } from './legacyObjectFirstCompatibilityAdapter';
import { buildSharedDecks } from './houseFirstDeckAdapter';
import { buildSharedOpenings } from './houseFirstOpeningAdapter';
import {
  buildDerivedWallLookup,
  type DerivedWallLookup,
} from './houseFirstWallLookup';
import { resolveHouseRoofProjection } from './houseRoofFormAdapter';
import {
  buildHouseEnvelopeLookup,
  normalizePergolaAttachmentEdgeId,
  normalizePergolaAttachmentZoneId,
  resolveAttachmentStrategyZoneKinds,
  resolvePergolaAttachment,
  resolvePergolaAttachmentKind,
  resolvePergolaFamily,
} from './pergolaAttachmentResolver';

type HouseFirstWorkbenchDraftCarrier = EstimateDrawingDraft & {
  houseFirst?: {
    roof?: HouseFirstRoofDraft | null;
    decks?: HouseFirstDeckDraft[] | null;
    openings?: HouseFirstOpeningDraft[] | null;
    pergolas?: HouseFirstPergolaDraft[] | null;
  } | null;
};

/**
 * PR-A: derive the legacy houseFirst-shaped view from the canonical
 * `objectFirst` draft. This used to live as a cross-file bridge
 * (`buildObjectWorkbenchCompatibilityProjectModel` in `state/compat/`);
 * now it's a private helper called inline by
 * `buildHouseFirstWorkbenchProjectModel`. The conversion logic itself
 * still lives in `buildObjectWorkbenchCompatibilityDraftFromObjectFirstDraft`
 * (in `legacyObjectFirstCompatibilityAdapter.ts`) because PR-D / PR-E /
 * PR-F will retire it entirely when adapters migrate to consume the
 * object-first types directly. Keeping the conversion in one named
 * helper makes the deletion in those PRs a single grep.
 */
function deriveHouseFirstDraftViewFromObjectFirst(
  objectFirstDraft: ObjectFirstWorkbenchDraftVNext,
): HouseFirstWorkbenchDraftCarrier['houseFirst'] {
  return buildObjectWorkbenchCompatibilityDraftFromObjectFirstDraft(objectFirstDraft);
}

/**
 * PR-B: convert a built `HouseModel` (output of `buildSharedHouse`) into
 * an `ObjectFirstHouseFormDraft` so primary and additional forms can
 * flow through the same `buildHouseFormFromDraft` builder. The four
 * fields that `buildSharedHouse` carries but `ObjectFirstHouseFormDraft`
 * doesn't carry (`attachmentKind`, `firstModuleLengthMm`/`ProjectionMm`,
 * source tracking, `confidence`) are dropped — `buildHouseFormFromDraft`
 * uses freestanding defaults for them. This causes a deliberate workbench
 * behavior change: the primary form's attachment zones disappear from the
 * roof projection until PR-F restores them via snap references. Per the
 * locked Phase 1 permission (2026-05-22), this temporary UX degradation
 * is acceptable; the email-quote path is unaffected because it doesn't
 * traverse the workbench.
 */
function houseModelToObjectFirstHouseFormDraft(
  house: HouseModel,
): ObjectFirstHouseFormDraft {
  return {
    id: house.id,
    label: house.label,
    transform: house.transform,
    footprint: {
      mode: house.footprint.mode,
      preset: house.footprint.preset,
      params: house.footprint.params,
      polygon: house.footprint.polygon,
      attachmentSide: house.footprint.attachmentSide,
    },
    roofIntent: {
      form: house.roof.form,
      material: house.roof.material,
      primaryPitchDeg: house.roof.primaryPitchDeg,
      primaryFallDirection: house.roof.primaryFallDirection,
      ridgeAxis: house.roof.ridgeAxis,
      openGableEndIds: house.roof.openGableEndIds,
      appendage: house.roof.appendage,
    },
    storeyMode: house.storeyMode,
    attachmentStrategy: house.attachmentStrategy,
    eaveHeightM: house.eaveHeightM,
    wallHeightM: house.wallHeightM,
    soffitDepthMm: house.soffitDepthMm,
    fasciaHeightMm: house.fasciaHeightMm,
    gutterWidthMm: house.gutterWidthMm,
    gutterDepthMm: house.gutterDepthMm,
    gutterProjectionMm: house.gutterProjectionMm,
    eaveOverhangMm: house.eaveOverhangMm,
    // `sourceModuleIndexes`/`sourceModuleIds` not on `ObjectFirstHouseFormDraft`
    // (they're on `HouseFormModel`, a related but different shape used inside
    // the object-first project model). Dropped here; `buildHouseFormFromDraft`
    // sets them to empty arrays. Acceptable per Phase 1 permission.
  };
}

/**
 * Legacy id for the single shared house form that pre-multi-form
 * estimates implicitly own. Until `houseForms[]` becomes a real
 * user-authored array, every estimate continues to synthesise exactly
 * one house under this id so the migration path for existing data is
 * a no-op: read once → see `LEGACY_PRIMARY_HOUSE_FORM_ID` → write back
 * unchanged.
 *
 * Multi-form phases will:
 *   - keep emitting this id for the first form (so persisted
 *     `hostHouseFormId`-less deck/opening drafts still resolve)
 *   - allocate new ids (`house-form-${uuid}` or similar) for
 *     subsequently-added forms.
 *
 * PR-C (2026-05-22): the previously-exported `LEGACY_PRIMARY_HOUSE_FORM_ID`
 * constant is gone. The id `'house-main'` is now just an id string the
 * synthesized form gets assigned by `buildSharedHouse`; nothing else
 * special-cases it. Other layers that need to identify "the primary form"
 * should read the actual form's `.id` field from the project model, not
 * compare against a constant.
 */
const SYNTHESIZED_PRIMARY_FORM_ID = 'house-main';

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
  // The id of the house form this call is producing. Defaults to the
  // legacy primary id so existing single-form callers don't need to
  // change. Multi-form callers (a future `buildHousesFromDraft` loop)
  // pass each form's id explicitly so wall / envelope / model ids
  // stay scoped per-form and don't collide across forms.
  houseFormId: string = SYNTHESIZED_PRIMARY_FORM_ID,
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
    houseId: houseFormId,
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
    houseId: houseFormId,
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
      id: houseFormId,
      label: 'House',
      confidence: lowConfidence ? 'low' : 'high',
      lowConfidence,
      sourceModuleIndexes: modules.map((_, index) => index),
      sourceModuleIds,
      // Primary form sits at world origin -- legacy module-synthesised
      // houses have no authored offset. Rotation here mirrors the
      // footprint's `drawingRotationQuarterTurns` so PR8 can drop the
      // footprint field once geometry consumers migrate.
      transform: {
        offsetXM: 0,
        offsetYM: 0,
        rotationQuarterTurns: normalizedDrawingRotationQuarterTurns,
      },
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

/**
 * Build a `HouseModel` for an additional (non-primary) house form authored
 * directly in `objectFirst.houseAssembly.houseForms[]`. Mirrors
 * `buildSharedHouse`'s post-collect block but reads every input from the
 * authored draft instead of synthesising from `CalculatorModuleInputs[]`.
 *
 * Two deliberate v0 simplifications:
 *   1. `attachmentKind: 'freestanding'` — additional forms cannot host
 *      pergolas yet. Cross-form pergola hosting is a later phase that
 *      lifts the per-pergola `hostHouseFormId` field.
 *   2. Pergola-dimension fallbacks (`fallbackWidthMm`/`Depth`) are used
 *      when synthesising preset-mode footprints. For draft-authored
 *      forms these only matter when `footprintMode === 'preset'` AND
 *      the form is independent of any pergola; the 6×3m default keeps
 *      preset-derived polygons sensibly sized.
 *
 * Returns the form's `HouseModel` plus any warnings the roof projection
 * raised. Migration warnings (the "collect disagreed across modules"
 * shape) don't apply here because there are no modules to disagree.
 */
/**
 * PR-B (2026-05-22): renamed from `buildAdditionalHouseFormFromDraft`.
 * This is now the unified form-building pipeline for ALL house forms
 * (primary and additional). The primary's `ObjectFirstHouseFormDraft`
 * is synthesized from `buildSharedHouse`'s output via
 * `houseModelToObjectFirstHouseFormDraft`; additional forms come straight
 * from `draft.objectFirst.houseAssembly.houseForms[]`. Both flow through
 * this single function.
 */
function buildHouseFormFromDraft(input: {
  formDraft: ObjectFirstHouseFormDraft;
  deckDrafts: HouseFirstDeckDraft[] | null | undefined;
  openingDrafts: HouseFirstOpeningDraft[] | null | undefined;
  houseFormId: string;
}): {
  house: HouseModel;
  warnings: HouseFirstMigrationWarning[];
} {
  const { formDraft, houseFormId } = input;
  const warnings: HouseFirstMigrationWarning[] = [];

  const normalizedFootprintMode = formDraft.footprint.mode;
  const normalizedFootprintPreset = formDraft.footprint.preset;
  const normalizedFootprintParams = formDraft.footprint.params;
  const normalizedFootprintPolygon = formDraft.footprint.polygon;
  const normalizedAttachmentSide = formDraft.footprint.attachmentSide;
  const normalizedDrawingRotationQuarterTurns =
    formDraft.transform.rotationQuarterTurns;
  const normalizedRoofMaterial = formDraft.roofIntent.material;
  const normalizedStoreyMode = formDraft.storeyMode;

  // Default pergola dims for preset-mode footprint synthesis. Additional
  // forms aren't tied to a pergola, so we pick a sensible 6×3m fallback;
  // when `footprintMode === 'custom_polygon'` these values are ignored.
  const fallbackPergolaWidthMm = 6000;
  const fallbackPergolaDepthMm = 3000;
  const derivedHousePolygon =
    normalizedFootprintMode === 'custom_polygon'
      ? normalizedFootprintPolygon
      : buildHouseFootprintPresetSideLocalPoints({
          pergolaWidthMm: fallbackPergolaWidthMm,
          pergolaDepthMm: fallbackPergolaDepthMm,
          preset: normalizedFootprintPreset,
          params: normalizedFootprintParams,
          attachmentSide: normalizedAttachmentSide,
        }).map((point) => ({
          alongM: String(point.alongM),
          depthM: String(point.depthM),
        }));

  const roofDraft: HouseFirstRoofDraft = {
    form: formDraft.roofIntent.form,
    primaryPitchDeg: formDraft.roofIntent.primaryPitchDeg,
    material: formDraft.roofIntent.material,
    primaryFallDirection: formDraft.roofIntent.primaryFallDirection,
    ridgeAxis: formDraft.roofIntent.ridgeAxis,
    openGableEndIds: formDraft.roofIntent.openGableEndIds,
    appendage: formDraft.roofIntent.appendage,
  };

  const roofProjection = resolveHouseRoofProjection({
    roofDraft,
    derivedHousePolygon,
    normalizedFootprintMode,
    normalizedFootprintPreset,
    normalizedFootprintParams,
    normalizedAttachmentSide,
    attachmentKind: 'freestanding',
    attachmentStrategy: formDraft.attachmentStrategy,
    normalizedRoofMaterial,
    roofMaterialSource: 'legacy_shared_value',
    roofPitchSource: 'legacy_shared_value',
    inferredPrimaryPitchDeg: formDraft.roofIntent.primaryPitchDeg,
    roofForm: formDraft.roofIntent.form,
    firstModuleLengthMm: fallbackPergolaWidthMm,
    firstModuleProjectionMm: fallbackPergolaDepthMm,
    eaveHeightM: formDraft.eaveHeightM ?? '',
    eaveOverhangMm: formDraft.eaveOverhangMm ?? '',
  });
  for (const warning of roofProjection.warnings) warnings.push(warning);

  const derivedWalls = buildDerivedWallLookup({
    houseId: houseFormId,
    housePolygon: derivedHousePolygon,
  });
  const decks = buildSharedDecks({
    deckDrafts: input.deckDrafts,
    housePolygon: derivedHousePolygon,
    footprintParams: normalizedFootprintParams,
  });
  const openings = buildSharedOpenings({
    openingDrafts: input.openingDrafts,
    derivedWalls,
    fallbackWallId: normalizedAttachmentSide,
  });
  const derivedEnvelope = buildDerivedEnvelopeLookup({
    houseId: houseFormId,
    housePolygon: derivedHousePolygon,
    derivedWalls,
    roof: {
      form: roofProjection.roof.form,
      validation: roofProjection.roof.validation,
    },
    attachmentStrategy: formDraft.attachmentStrategy,
    openings,
  });

  return {
    house: {
      id: houseFormId,
      label: formDraft.label,
      confidence: 'high',
      lowConfidence: false,
      // No source modules — this form was authored directly in the draft,
      // not synthesised from `CalculatorModuleInputs`.
      sourceModuleIndexes: [],
      sourceModuleIds: [],
      // Carry the authored world-space transform straight from the draft
      // so PR8's solver pass can place this form at its offset (10m east
      // by default, see PR5's `addHouseFormToObjectFirstDraft`).
      transform: formDraft.transform,
      footprint: {
        mode: normalizedFootprintMode,
        preset: normalizedFootprintPreset,
        params: normalizedFootprintParams,
        polygon: normalizedFootprintPolygon,
        drawingRotationQuarterTurns: normalizedDrawingRotationQuarterTurns,
        attachmentSide: normalizedAttachmentSide,
      },
      roof: {
        ...roofProjection.roof,
        confidence: 'high',
      },
      storeyMode: normalizedStoreyMode,
      attachmentStrategy: formDraft.attachmentStrategy,
      eaveHeightM: formDraft.eaveHeightM ?? '',
      wallHeightM: formDraft.wallHeightM ?? '',
      soffitDepthMm: formDraft.soffitDepthMm ?? '',
      fasciaHeightMm: formDraft.fasciaHeightMm ?? '',
      gutterWidthMm: formDraft.gutterWidthMm ?? '',
      gutterDepthMm: formDraft.gutterDepthMm ?? '',
      gutterProjectionMm: formDraft.gutterProjectionMm ?? '',
      eaveOverhangMm: formDraft.eaveOverhangMm ?? '',
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

  // Build the host-envelope lookup once per house and reuse for each
  // pergola. Once `houseForms[]` lifts off the single-house assumption,
  // this lookup gets keyed by `houseFormId` so each pergola can resolve
  // against the host form it's attached to.
  const envelope = buildHouseEnvelopeLookup(input.house);

  const warnings: HouseFirstMigrationWarning[] = [];
  const pergolas: PergolaModel[] = Array.from(groups.entries()).map(([pergolaId, group]) => {
    const firstModule = group.modules[0]!;
    const moduleInput = firstModule.moduleInput;
    const resolution = resolvePergolaAttachment({
      pergolaId,
      moduleInput,
      draft: draftByPergolaId.get(pergolaId) ?? null,
      firstModuleIndex: firstModule.moduleIndex,
      envelope,
    });
    if (resolution.warning) warnings.push(resolution.warning);

    return {
      id: pergolaId,
      label: group.label,
      family: resolvePergolaFamily(moduleInput),
      confidence: input.house?.lowConfidence ? 'low' : 'high',
      sourceModuleIndexes: group.modules.map((module) => module.moduleIndex),
      sourceModuleIds: group.modules.map((module) => module.moduleId),
      attachment: resolution.attachment,
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

  // PR-A: previously `buildObjectWorkbenchCompatibilityProjectModel` (in
  // `state/compat/`) acted as a cross-file bridge that converted
  // `draft.objectFirst` into the legacy `houseFirst` shape this adapter
  // consumes. The conversion now happens inline. When `draft.objectFirst`
  // is set (canonical state since the migration), it wins. The bare
  // `draft.houseFirst` fallback is kept only for legacy callers that
  // pre-bridged data in the carrier shape (notably the historical PR9
  // integration test). PR-D / PR-E / PR-F retire this view entirely
  // when adapters migrate to consume the object-first types directly.
  const derivedHouseFirstView = input.draft?.objectFirst
    ? deriveHouseFirstDraftViewFromObjectFirst(input.draft.objectFirst)
    : null;
  const houseFirstDraftView = derivedHouseFirstView ?? input.draft?.houseFirst ?? null;

  // PR9: split decks/openings by host-form id so the primary form gets
  // only its own decks/openings, and each additional form gets its
  // share. `null`/`undefined` `hostHouseFormId` routes to the primary
  // (back-compat for legacy single-form estimates and decks authored
  // before multi-form).
  const allDeckDrafts = houseFirstDraftView?.decks ?? null;
  const allOpeningDrafts = houseFirstDraftView?.openings ?? null;

  // PR-B (2026-05-22): synthesize the primary form's draft from calculator
  // modules via `buildSharedHouse`, then route both the primary and any
  // authored additional forms through the unified `buildHouseFormFromDraft`
  // pipeline. The primary's `attachmentKind` becomes `'freestanding'` after
  // this round-trip (workbench attachment zones disappear until PR-F restores
  // them via snap references). The email-quote path is unaffected — it
  // doesn't traverse the workbench.
  //
  // PR-C (2026-05-22): the previous `LEGACY_PRIMARY_HOUSE_FORM_ID` constant
  // is gone. Filtering / routing now reads the synthesized primary's actual
  // `.id` field (whatever `buildSharedHouse` happens to assign — today
  // `'house-main'`, but not special-cased anywhere). A null `hostHouseFormId`
  // on a deck/opening routes to the primary by way of "first form in list";
  // an explicit id routes to the matching form.
  //
  // `buildSharedHouse` is called once with null deck/opening drafts because
  // `houseModelToObjectFirstHouseFormDraft` only reads the form fields
  // (footprint, roof, eave, etc.) — not the resolved decks/openings, which
  // `buildHouseFormFromDraft` re-derives per-form below.
  const sharedHouse = buildSharedHouse(
    modules.map((module) => module.input),
    houseFirstDraftView?.roof ?? null,
    null,
    null,
  );
  const primaryFormDraft = sharedHouse.house
    ? houseModelToObjectFirstHouseFormDraft(sharedHouse.house)
    : null;
  const primaryId = primaryFormDraft?.id ?? null;
  const isHostedByPrimary = (host: string | null | undefined): boolean =>
    host == null || (primaryId != null && host === primaryId);
  const primaryDeckDrafts = allDeckDrafts?.filter((deck) => isHostedByPrimary(deck.hostHouseFormId)) ?? null;
  const primaryOpeningDrafts = allOpeningDrafts?.filter((opening) => isHostedByPrimary(opening.hostHouseFormId)) ?? null;
  const authoredAdditionalForms = (input.draft?.objectFirst?.houseAssembly?.houseForms ?? []).filter(
    (form) => primaryId == null || form.id !== primaryId,
  );
  const unifiedFormDrafts: ObjectFirstHouseFormDraft[] = primaryFormDraft
    ? [primaryFormDraft, ...authoredAdditionalForms]
    : authoredAdditionalForms;

  const houseForms: HouseModel[] = [];
  const additionalFormWarnings: HouseFirstMigrationWarning[] = [];
  for (let index = 0; index < unifiedFormDrafts.length; index += 1) {
    const formDraft = unifiedFormDrafts[index]!;
    // PR-C: primary is "the first form in the unified list" (no constant
    // check). It gets the null-host-fallback decks; additional forms get
    // decks tagged with their own id.
    const isPrimary = index === 0 && primaryFormDraft !== null;
    const formDeckDrafts = isPrimary
      ? primaryDeckDrafts
      : allDeckDrafts?.filter((deck) => deck.hostHouseFormId === formDraft.id) ?? null;
    const formOpeningDrafts = isPrimary
      ? primaryOpeningDrafts
      : allOpeningDrafts?.filter((opening) => opening.hostHouseFormId === formDraft.id) ?? null;
    const result = buildHouseFormFromDraft({
      formDraft,
      deckDrafts: formDeckDrafts,
      openingDrafts: formOpeningDrafts,
      houseFormId: formDraft.id,
    });
    houseForms.push(result.house);
    for (const warning of result.warnings) additionalFormWarnings.push(warning);
  }
  const primaryHouseForm = houseForms[0] ?? null;
  const pergolaResult = buildPergolas({
    modules,
    legacyPergolas: calculatorInputs?.pergolas ?? [],
    house: primaryHouseForm,
    pergolaDrafts: houseFirstDraftView?.pergolas ?? null,
  });

  return {
    source: 'legacy_estimate_snapshot',
    houseForms,
    pergolas: pergolaResult.pergolas,
    warnings: [
      ...sharedHouse.warnings,
      ...additionalFormWarnings,
      ...pergolaResult.warnings,
    ],
  };
}
