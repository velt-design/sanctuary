import {
  buildAssemblyQuantityTakeoff,
  buildHouseReferenceProjectionShape,
  buildProjectReferenceShapes,
  buildTopProjectionViewModelFromScene,
  buildViewerSceneModel,
  type Assembly3D,
  type GeometryConfig,
  type GeometryPlanViewModel,
  type GeometryQuantityTakeoff,
  type GeometrySectionViewModel,
  type GeometryTopProjectionShape,
  type GeometryTopProjectionViewModel,
  type GeometryValidationReport,
  type HouseModel3D,
  type ProjectPergolaEntry,
  type RawGeometryModuleInput,
  type ViewerSceneModel,
  validateGeometrySolve,
} from '@sp/geometry';
import { mapProjectDecks, mapProjectOpenings } from '@/lib/drawings/geometry/buildRawGeometryModuleInput';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import {
  deriveWorkbenchGeometry,
  type WorkbenchPergolaRenderSource,
  type WorkbenchPergolaRenderStatus,
} from '@/lib/drawings/geometry/deriveWorkbenchGeometry';
import { buildObjectWorkbenchGeometryContext, type ObjectWorkbenchGeometryContext } from '@/lib/drawings/geometry/objectWorkbenchGeometryContext';
import { coerceHiddenWorkbenchGableBaseline } from '@/lib/drawings/geometry/hiddenWorkbenchGableBaseline';
import {
  resolveWorkbenchGeometryModule,
  type WorkbenchGeometryResultSource,
} from '@/lib/drawings/geometry/resolveWorkbenchGeometryModule';
import { buildEstimateDrawingModules, type EstimateDrawingModule } from '@/lib/estimates/moduleDrawing';
import { mergeEstimateDrawingDraftIntoSnapshot, type EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import type { CalculatorHouseAttachmentStrategy, CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  buildWorkbenchDeckSupportDiagnostic,
  resolveWorkbenchDeckSupportActiveSide,
  type WorkbenchDeckSupportDiagnostic,
} from './deckSupportDiagnostics';
import type { WorkbenchProjectModel } from './objectFirstWorkbenchModel';
import { resolveObjectFirstPergolaAttachment } from './objectFirstDerivedHosting';
import { buildAdditionalHouseFormGeometry } from './buildAdditionalHouseFormGeometry';

type AttachmentSide = 'rear' | 'front' | 'left' | 'right';
type LocalPolygonPoint = { alongM: number; depthM: number };

export type GeometryPreviewMode = 'snapshot_validated' | 'snapshot_local_resolved' | 'draft_local_resolved';

export type GeometryPreviewState =
  | {
      kind: 'ready';
      previewMode: GeometryPreviewMode;
      resultSource: 'snapshot' | 'local_resolve';
      config: GeometryConfig;
      assembly: Assembly3D;
      validation: GeometryValidationReport;
      scene: ViewerSceneModel;
      topProjection: GeometryTopProjectionViewModel;
      deckSupport: WorkbenchDeckSupportDiagnostic;
    }
  | {
      kind: 'unsupported';
      previewMode: GeometryPreviewMode;
      config?: GeometryConfig;
      validation?: GeometryValidationReport;
      message: string;
      deckSupport: WorkbenchDeckSupportDiagnostic;
    }
  | {
      kind: 'error';
      message: string;
    };

export type WorkbenchTrustStatusKind =
  | 'geometry_ready'
  | 'legacy_fallback'
  | 'legacy_unsupported_family'
  | 'invalid_geometry'
  | 'unresolved_host'
  | 'approximate';

export type WorkbenchTrustStatus = {
  status: WorkbenchTrustStatusKind;
  issues: WorkbenchTrustStatusKind[];
  renderSource: WorkbenchPergolaRenderSource | 'none';
  message: string | null;
};

type WorkbenchTrustGateAction = 'pass' | 'warn' | 'block';

export type WorkbenchTrustGateModel = {
  status: WorkbenchTrustGateAction;
  trustStatus: WorkbenchTrustStatusKind;
  issues: WorkbenchTrustStatusKind[];
  blockingIssues: WorkbenchTrustStatusKind[];
  warningIssues: WorkbenchTrustStatusKind[];
  canExport: boolean;
  canReview: boolean;
  label: string;
  message: string | null;
};

export type WorkbenchGeometryIdentity = {
  projectId: string;
  estimateId: string;
  designRequestId?: string | null;
};

type WorkbenchSolvedGeometryArtifactFallback =
  | null
  | 'legacy_unsupported_family'
  | 'invalid_geometry';

export type WorkbenchSolvedGeometryArtifact = {
  source: 'solved_geometry';
  fallback: WorkbenchSolvedGeometryArtifactFallback;
  previewMode: GeometryPreviewMode;
  resultSource: WorkbenchGeometryResultSource;
  deckSupport: WorkbenchDeckSupportDiagnostic;
  config: GeometryConfig;
  assembly: Assembly3D;
  plan: GeometryPlanViewModel;
  section: GeometrySectionViewModel;
  quantityTakeoff: GeometryQuantityTakeoff;
  topProjection: GeometryTopProjectionViewModel;
  viewerScene: ViewerSceneModel;
  validation: GeometryValidationReport;
  trust: WorkbenchTrustStatus;
  renderSource: WorkbenchPergolaRenderSource;
  renderStatus: WorkbenchPergolaRenderStatus;
};

export type WorkbenchViewportGeometry = {
  artifact: WorkbenchSolvedGeometryArtifact | null;
  legacyFallback: {
    planModel: ModulePlanModel | null;
    sectionModel: ModuleSectionModel | null;
  };
  preview: GeometryPreviewState;
};

export type WorkbenchSolvedModule = {
  index: number;
  id: string;
  label: string;
  drawingModule: EstimateDrawingModule;
  moduleInput: CalculatorModuleInputs;
  previewMode: GeometryPreviewMode;
  resultSource: WorkbenchGeometryResultSource;
  draftTouchesGeometry: boolean;
  trust: WorkbenchTrustStatus;
  renderSource: WorkbenchPergolaRenderSource;
  renderStatus: WorkbenchPergolaRenderStatus;
  geometryArtifact: WorkbenchSolvedGeometryArtifact | null;
  config: GeometryConfig | null;
  assembly: Assembly3D | null;
  geometryPlan: GeometryPlanViewModel | null;
  geometrySection: GeometrySectionViewModel | null;
  geometryTopProjection: GeometryTopProjectionViewModel | null;
  validation: GeometryValidationReport | null;
  viewerScene: ViewerSceneModel | null;
  geometryPreview: GeometryPreviewState;
  viewportGeometry: WorkbenchViewportGeometry;
  deckSupport: WorkbenchDeckSupportDiagnostic | null;
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
};

export type WorkbenchSolvedModel = {
  projectModel: WorkbenchProjectModel;
  modules: WorkbenchSolvedModule[];
  activeModule: WorkbenchSolvedModule | null;
  /**
   * Project-level reference shapes — one canonical `house_reference` plus one
   * `pergola_reference` per pergola module. Step 5d Option A of the
   * first-class spatial-entities migration: lets the canvas render outlines
   * for non-active pergolas as a context overlay so multi-pergola scenes
   * are visible at a glance. Active-module rendering still uses
   * `module.geometryTopProjection`; the overlay only adds shapes for OTHER
   * pergolas (filtered via `buildProjectContextOverlayShapes`).
   */
  projectReferenceShapes: GeometryTopProjectionShape[];
  trust: WorkbenchTrustStatus;
  geometryIdentity: Required<WorkbenchGeometryIdentity>;
};

// ============================================================================
// PR-2B.1a (2026-05-23): per-object solved shape — coexists with legacy
// ============================================================================
//
// `SolvedPergola` and `WorkbenchSolvedProject` are the per-object equivalents
// of `WorkbenchSolvedModule` and `WorkbenchSolvedModel`. They expose the same
// per-pergola data but keyed by pergola id (matching `projectModel.pergolas[]`)
// instead of by drawing-module array position. New consumers can target this
// shape; existing consumers continue reading `modules[]` until PR-2B.1b
// migrates them.
//
// Difference from `WorkbenchSolvedModule`:
// - Drops `index` (array position, structural — rederive from list position).
// - Drops `drawingModule` (legacy wrapper; consumers that needed the cost
//   result reach it via `pergola.moduleInput`).
// - Adds `pergolaIndex` as an explicit back-reference to the source
//   `WorkbenchSolvedModule` for the coexist period.
// - Adds `sourceModules: WorkbenchSolvedModule[]` — all underlying solver
//   modules that share this pergola id. Length 1 for the per-object case;
//   length > 1 only for legacy multi-module-per-pergola snapshots, which
//   collapse in the cost engine V2 migration (Phase 2). The first entry is
//   reflected in the SolvedPergola's primary fields (moduleInput, assembly,
//   trust, etc.) for the single-module callers.
//
// Difference from `WorkbenchSolvedModel`:
// - `modules: WorkbenchSolvedModule[]` → `pergolas: SolvedPergola[]`.
// - `activeModule` → `activePergolaId: string | null` (UI selection by id).

export type SolvedPergola = {
  /** Pergola id (matches `projectModel.pergolas[].id` and `moduleInput.pergolaId`). */
  id: string;
  label: string;
  /** Back-reference to the first source module's array index — drops when PR-2B.1b retires the legacy loop. */
  pergolaIndex: number;
  moduleInput: CalculatorModuleInputs;
  previewMode: GeometryPreviewMode;
  resultSource: WorkbenchGeometryResultSource;
  draftTouchesGeometry: boolean;
  trust: WorkbenchTrustStatus;
  renderSource: WorkbenchPergolaRenderSource;
  renderStatus: WorkbenchPergolaRenderStatus;
  geometryArtifact: WorkbenchSolvedGeometryArtifact | null;
  config: GeometryConfig | null;
  assembly: Assembly3D | null;
  geometryPlan: GeometryPlanViewModel | null;
  geometrySection: GeometrySectionViewModel | null;
  geometryTopProjection: GeometryTopProjectionViewModel | null;
  validation: GeometryValidationReport | null;
  viewerScene: ViewerSceneModel | null;
  geometryPreview: GeometryPreviewState;
  viewportGeometry: WorkbenchViewportGeometry;
  deckSupport: WorkbenchDeckSupportDiagnostic | null;
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
  /**
   * Legacy multi-module-per-pergola carrier. Typically a single entry equal
   * to the primary module that populates this SolvedPergola's fields. For
   * legacy snapshots where multiple solver modules share `pergolaId`, all
   * entries appear here in source order so commercial parity callers can
   * enumerate every cost row. Collapses to length 1 in Phase 2 once the
   * cost engine reads from the per-object spine.
   */
  sourceModules: WorkbenchSolvedModule[];
};

export type WorkbenchSolvedProject = {
  projectModel: WorkbenchProjectModel;
  pergolas: SolvedPergola[];
  /** Pergola id of the currently-active selection, or null when nothing is active. */
  activePergolaId: string | null;
  /** Convenience accessor — `pergolas.find(p => p.id === activePergolaId) ?? null`. */
  activePergola: SolvedPergola | null;
  projectReferenceShapes: GeometryTopProjectionShape[];
  trust: WorkbenchTrustStatus;
  geometryIdentity: Required<WorkbenchGeometryIdentity>;
};

const DEFAULT_GEOMETRY_IDENTITY: Required<WorkbenchGeometryIdentity> = {
  projectId: 'hidden-workbench-project',
  estimateId: 'hidden-workbench-estimate',
  designRequestId: null,
};

const EMPTY_WORKBENCH_PROJECT_MODEL: WorkbenchProjectModel = {
  source: 'legacy_estimate_snapshot',
  houseAssembly: null,
  decks: [],
  openings: [],
  pergolas: [],
  warnings: [],
};

function resolveGeometryIdentity(
  identity: WorkbenchGeometryIdentity | null | undefined,
): Required<WorkbenchGeometryIdentity> {
  return {
    projectId: identity?.projectId ?? DEFAULT_GEOMETRY_IDENTITY.projectId,
    estimateId: identity?.estimateId ?? DEFAULT_GEOMETRY_IDENTITY.estimateId,
    designRequestId: identity?.designRequestId ?? DEFAULT_GEOMETRY_IDENTITY.designRequestId,
  };
}

function resolvePreviewMode(input: {
  resultSource: 'snapshot' | 'local_resolve';
  draftTouchesGeometry: boolean;
}): GeometryPreviewMode {
  if (input.draftTouchesGeometry) return 'draft_local_resolved';
  return input.resultSource === 'local_resolve' ? 'snapshot_local_resolved' : 'snapshot_validated';
}

function parseLocalPolygon(
  polygon: Array<{ alongM: string; depthM: string }> | null | undefined,
): LocalPolygonPoint[] {
  return (polygon ?? [])
    .map((point) => ({
      alongM: Number(point.alongM),
      depthM: Number(point.depthM),
    }))
    .filter((point) => Number.isFinite(point.alongM) && Number.isFinite(point.depthM));
}

function hostEdgeSideBySourceEdgeId(
  polygon: Array<{ alongM: string; depthM: string }> | null | undefined,
): Map<string, AttachmentSide> {
  const localPolygon = parseLocalPolygon(polygon);
  if (!localPolygon.length) return new Map();
  const alongValues = localPolygon.map((point) => point.alongM);
  const depthValues = localPolygon.map((point) => point.depthM);
  const minAlong = Math.min(...alongValues);
  const maxAlong = Math.max(...alongValues);
  const minDepth = Math.min(...depthValues);
  const maxDepth = Math.max(...depthValues);
  const result = new Map<string, AttachmentSide>();
  for (let index = 0; index < localPolygon.length; index += 1) {
    const current = localPolygon[index]!;
    const next = localPolygon[(index + 1) % localPolygon.length]!;
    const sourceEdgeId = `footprint-edge-${index + 1}`;
    if (Math.abs(current.depthM - next.depthM) <= 1e-6) {
      const depth = (current.depthM + next.depthM) / 2;
      result.set(
        sourceEdgeId,
        Math.abs(depth - minDepth) <= Math.abs(depth - maxDepth) ? 'rear' : 'front',
      );
      continue;
    }
    if (Math.abs(current.alongM - next.alongM) <= 1e-6) {
      const along = (current.alongM + next.alongM) / 2;
      result.set(
        sourceEdgeId,
        Math.abs(along - minAlong) <= Math.abs(along - maxAlong) ? 'left' : 'right',
      );
    }
  }
  return result;
}

function annotateSceneHostEdgeSides(
  scene: ViewerSceneModel,
  polygon: Array<{ alongM: string; depthM: string }> | null | undefined,
): ViewerSceneModel {
  const sideBySourceEdgeId = hostEdgeSideBySourceEdgeId(polygon);
  if (!sideBySourceEdgeId.size) return scene;
  return {
    ...scene,
    layers: scene.layers.map((layer) => ({
      ...layer,
      objects: layer.objects.map((object) => {
        const sourceEdgeId = typeof object.metadata?.sourceEdgeId === 'string' ? object.metadata.sourceEdgeId : null;
        const hostEdgeSide = sourceEdgeId ? sideBySourceEdgeId.get(sourceEdgeId) : undefined;
        if (!hostEdgeSide) return object;
        return {
          ...object,
          metadata: {
            ...(object.metadata ?? {}),
            hostEdgeSide,
          },
        };
      }),
    })),
  };
}

type AttachmentZoneKind = 'wall' | 'soffit' | 'fascia' | 'roof_edge';
type AttachmentBlockReason = 'side_openings_block_wall' | 'side_openings_block_roof_zone';

function resolveAttachmentStrategyZoneKinds(
  strategy: CalculatorHouseAttachmentStrategy | null,
): AttachmentZoneKind[] {
  if (strategy === 'none') return [];
  const kinds = new Set<AttachmentZoneKind>();
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

function isAttachmentSide(value: unknown): value is AttachmentSide {
  return value === 'rear' || value === 'front' || value === 'left' || value === 'right';
}

function openingBlocksAttachmentZone(opening: WorkbenchProjectModel['openings'][number]): boolean {
  return opening.validation?.status !== 'invalid';
}

function openingBlocksRoofAttachmentZone(opening: WorkbenchProjectModel['openings'][number]): boolean {
  return openingBlocksAttachmentZone(opening) && (opening.kind === 'slider' || opening.kind === 'stacker');
}

function resolveOpeningAttachmentSide(input: {
  projectModel: WorkbenchProjectModel;
  opening: WorkbenchProjectModel['openings'][number];
}): AttachmentSide | null {
  if (isAttachmentSide(input.opening.wallId)) return input.opening.wallId;
  const envelope = input.projectModel.houseAssembly?.derivedEnvelope ?? null;
  const zones = envelope?.attachmentZones ?? [];
  const zone = zones.find((candidate) =>
    (input.opening.hostEdgeId && candidate.hostEdgeId === input.opening.hostEdgeId) ||
    (input.opening.hostWallId && candidate.hostWallId === input.opening.hostWallId),
  );
  return zone?.side ?? null;
}

function resolveAttachmentZoneBlockedReasons(
  projectModel: WorkbenchProjectModel | null | undefined,
): string {
  if (!projectModel?.houseAssembly) return 'none';
  const houseForm = projectModel.houseAssembly.houseForms[0] ?? null;
  const candidateKinds = resolveAttachmentStrategyZoneKinds(houseForm?.attachmentStrategy ?? null);
  if (!candidateKinds.length) return 'none';

  const blocked = new Set<string>();
  for (const opening of projectModel.openings) {
    const side = resolveOpeningAttachmentSide({ projectModel, opening });
    if (!side) continue;
    for (const kind of candidateKinds) {
      const reason: AttachmentBlockReason | null =
        kind === 'wall' && openingBlocksAttachmentZone(opening)
          ? 'side_openings_block_wall'
          : kind !== 'wall' && openingBlocksRoofAttachmentZone(opening)
            ? 'side_openings_block_roof_zone'
            : null;
      if (reason) {
        blocked.add(`${side}:${kind}:${reason}`);
      }
    }
  }

  return blocked.size ? Array.from(blocked).join(',') : 'none';
}

function annotateSceneAttachmentZoneMetadata(
  scene: ViewerSceneModel,
  geometryContext: ObjectWorkbenchGeometryContext,
): ViewerSceneModel {
  const projectModel = geometryContext.projectModel;
  const houseAssembly = projectModel?.houseAssembly ?? null;
  const zones = houseAssembly?.derivedEnvelope?.attachmentZones ?? [];
  const pergolaAttachmentResolutions = (projectModel?.pergolas ?? []).map((pergola) =>
    resolveObjectFirstPergolaAttachment({ houseAssembly, pergola }),
  );
  const resolvedPergolaAttachmentZoneCount = pergolaAttachmentResolutions.filter(
    (resolution) => resolution.status === 'resolved' && resolution.attachmentZoneId !== null,
  ).length;
  const unresolvedPergolaAttachmentZoneCount = pergolaAttachmentResolutions.filter(
    (resolution) => resolution.status !== 'resolved',
  ).length;
  return {
    ...scene,
    metadata: {
      ...(scene.metadata ?? {}),
      houseAttachmentZoneCount: zones.length,
      houseAttachmentZoneKinds: zones.length
        ? zones.map((zone) => `${zone.side}:${zone.kind}`).join(',')
        : 'none',
      houseAttachmentZoneBlockedReasons: resolveAttachmentZoneBlockedReasons(projectModel),
      pergolaResolvedAttachmentZoneCount: resolvedPergolaAttachmentZoneCount,
      pergolaUnresolvedAttachmentZoneCount: unresolvedPergolaAttachmentZoneCount,
    },
  };
}

function annotateSceneHouseRoofMetadata(
  scene: ViewerSceneModel,
  config: GeometryConfig,
): ViewerSceneModel {
  const roof = config.houseContext.model ?? null;
  if (!roof) return scene;
  return {
    ...scene,
    metadata: {
      ...(scene.metadata ?? {}),
      houseRoofForm: roof.roofForm ?? null,
      houseRoofHealedPitchDeg: roof.roofPitchDeg ?? null,
      houseRoofHealedRidgeAxis: roof.roofRidgeAxis ?? null,
    },
  };
}

function buildViewerSceneFromSolvedGeometry(input: {
  config: GeometryConfig;
  assembly: Assembly3D;
  geometryContext: ObjectWorkbenchGeometryContext;
  /**
   * Pre-built `HouseModel3D`s for project house forms beyond the active
   * pergola's host. Built once at project level in `buildWorkbenchSolvedModel`
   * (PR-G3a, 2026-05-22) and threaded through; the per-module solve no
   * longer rebuilds them. The scene builder iterates them inside `buildLayers`.
   */
  additionalHouseModels: ReadonlyArray<HouseModel3D>;
}): ViewerSceneModel {
  return annotateSceneHouseRoofMetadata(
    annotateSceneAttachmentZoneMetadata(
      annotateSceneHostEdgeSides(
        buildViewerSceneModel(input.assembly, {
          additionalHouseModels: input.additionalHouseModels,
        }),
        input.geometryContext.projectModel?.houseAssembly?.houseForms[0]?.footprint.polygon,
      ),
      input.geometryContext,
    ),
    input.config,
  );
}

/**
 * PR-G3a (2026-05-22): build `HouseModel3D`s for every non-host form once
 * at project level (replaces the per-module `composeAdditionalHouseFormsIntoScene`
 * workaround that called `buildAdditionalHouseFormGeometry` M × F times).
 *
 * Active pergola's host house arrives via the per-pergola solve in
 * `assembly.house.model`; everything else comes from this list. Today the
 * primary form (index 0) is the only one the pergola solver carries, so
 * `houseForms.slice(1)` enumerates the additional forms. Once PR-G3b
 * restructures `buildRawGeometryModuleInput`, this list can include every
 * non-host form regardless of index.
 */
function buildProjectAdditionalHouseModels(
  projectModel: WorkbenchProjectModel | null | undefined,
): ReadonlyArray<HouseModel3D> {
  const allForms = projectModel?.houseAssembly?.houseForms ?? [];
  if (allForms.length <= 1) return [];
  const models: HouseModel3D[] = [];
  for (const form of allForms.slice(1)) {
    const geometry = buildAdditionalHouseFormGeometry({ houseForm: form });
    if (geometry?.model) models.push(geometry.model);
  }
  return models;
}

function buildTopProjectionFromSolvedScene(input: {
  scene: ViewerSceneModel;
  fallbackTopProjection: GeometryTopProjectionViewModel;
  /**
   * The solved assembly. Threaded through so `buildTopProjectionViewModelFromScene`
   * can run the milestone-13 hip-end metadata enrichment on house roof
   * facets -- without this, the plan-view click-to-toggle target
   * doesn't get its `openGableEndId`/`isOpen` tags and the selection
   * router falls back to the standard "select the roof" path.
   */
  assembly: Assembly3D;
  /**
   * The pergola id this assembly belongs to. When set, every pergola-family
   * shape in the projection is tagged with `metadata.pergolaId` so consumers
   * (selection, move tool) can resolve the active pergola from any of its
   * member shapes (rafters, posts, beams) without relying on shape-id
   * heuristics. Without this tag the classifier falls back to the member's
   * own id, which breaks the move tool's active-target gate.
   *
   * Lifted out of the per-shape builder so the geometry package doesn't
   * need to know about the workbench's pergola identity. Documented in
   * `docs/maintainability-principles.md` -- "workarounds belong at the
   * source": tag once at projection time instead of patching every consumer.
   */
  pergolaId?: string | null;
  /**
   * PR-Bug1 (2026-05-25): host house form id for this assembly. Mirrors the
   * `pergolaId` enrichment above for house-family shapes. After PR-Geo1's
   * scene-seam id prefixing, `house_surface_solid` shapes (walls, roof
   * solids, eaves) carry prefixed scene ids like `<houseId>:house-wall-1`
   * that don't map to any workbench house form id. Without this tag the
   * plan-view classifier resolves clicks on those surfaces to the prefixed
   * scene id, and the right inspector can't find a matching house form so
   * shows "No selection". Tagging once at projection time lets the
   * classifier prefer `metadata.houseFormId` over the id-derived fallback.
   *
   * The primary host house is the active pergola's host (the one carried in
   * `assembly.house.model`). Additional house forms render via
   * `projectReferenceShapes` overlay and carry their own ids in
   * `sourceObjectId` from `buildHouseReferenceProjectionShape`.
   */
  houseFormId?: string | null;
}): GeometryTopProjectionViewModel {
  const projection = buildTopProjectionViewModelFromScene(input.scene, {
    referenceShapes: input.fallbackTopProjection.shapes.filter(
      (shape) => shape.sourceType === 'house_reference' || shape.sourceType === 'pergola_reference',
    ),
    terminalEndAssembly: input.assembly,
  });
  const taggedPergolaId = input.pergolaId ?? null;
  const taggedHouseFormId = input.houseFormId ?? null;
  return {
    ...projection,
    shapes: projection.shapes.map((shape) => {
      if (taggedPergolaId && shape.family === 'pergola') {
        return {
          ...shape,
          metadata: { ...(shape.metadata ?? {}), pergolaId: taggedPergolaId },
        };
      }
      if (shape.family === 'house' && (shape.kind === 'deck' || shape.kind === 'landing')) {
        // PR-Bug4 (2026-05-25): mirror the pergolaId/houseFormId pattern for
        // decks. The `house_surface_solid` deck prism arrives with
        // `metadata.sourceId === deck.id` (set in
        // `packages/geometry/src/house/envelopeSolids.ts`), but
        // `selectionMatch.ts` reads `metadata.deckId` to disambiguate
        // selection halos between decks. Without this tag, every deck
        // matches the active deck selection and the renderer falls back to
        // the largest-area shape, so only one deck visually highlights.
        // Copy the existing sourceId into the family-specific discriminator
        // so all consumers can resolve "which deck" by the same key.
        const existingDeckId = (shape.metadata as { deckId?: string } | undefined)?.deckId;
        if (existingDeckId) return shape;
        const sourceDeckId =
          typeof shape.metadata?.sourceId === 'string'
            ? shape.metadata.sourceId
            : (shape.sourceId ?? null);
        if (!sourceDeckId) return shape;
        return {
          ...shape,
          metadata: { ...(shape.metadata ?? {}), deckId: sourceDeckId },
        };
      }
      if (taggedHouseFormId && shape.family === 'house') {
        // Only tag shapes that don't already carry an explicit houseFormId.
        // Additional house forms' reference shapes (built via
        // `buildHouseReferenceProjectionShape` at line ~1275) get their own
        // form id; preserve those so clicks on additional houses resolve
        // correctly once Bug 2's hit-target promotion lands.
        const existing = (shape.metadata as { houseFormId?: string } | undefined)?.houseFormId;
        if (existing) return shape;
        return {
          ...shape,
          metadata: { ...(shape.metadata ?? {}), houseFormId: taggedHouseFormId },
        };
      }
      return shape;
    }),
  };
}

function uniqueIssues(issues: WorkbenchTrustStatusKind[]): WorkbenchTrustStatusKind[] {
  return Array.from(new Set(issues));
}

function isBlockingTrustIssue(issue: WorkbenchTrustStatusKind): boolean {
  return issue === 'invalid_geometry' || issue === 'unresolved_host';
}

function isWarningTrustIssue(issue: WorkbenchTrustStatusKind): boolean {
  return (
    issue === 'approximate' ||
    issue === 'legacy_fallback' ||
    issue === 'legacy_unsupported_family'
  );
}

function sortTrustIssuesByPriority(
  issues: WorkbenchTrustStatusKind[],
  priority: WorkbenchTrustStatusKind[],
): WorkbenchTrustStatusKind[] {
  return [...issues].sort((left, right) => {
    const leftIndex = priority.indexOf(left);
    const rightIndex = priority.indexOf(right);
    return (leftIndex === -1 ? priority.length : leftIndex) -
      (rightIndex === -1 ? priority.length : rightIndex);
  });
}

export function labelForWorkbenchTrustStatus(status: WorkbenchTrustStatusKind): string {
  switch (status) {
    case 'geometry_ready':
      return 'Geometry ready';
    case 'legacy_fallback':
      return 'Legacy fallback';
    case 'legacy_unsupported_family':
      return 'Unsupported family';
    case 'invalid_geometry':
      return 'Invalid geometry';
    case 'unresolved_host':
      return 'Unresolved host';
    case 'approximate':
      return 'Approximate';
    default:
      return 'Unknown';
  }
}

function messageForWorkbenchTrustIssue(
  issue: WorkbenchTrustStatusKind,
  trust: WorkbenchTrustStatus,
): string {
  if (trust.status === issue && trust.message) return trust.message;
  switch (issue) {
    case 'invalid_geometry':
      return 'Geometry is invalid. Resolve the blocking geometry issue before export or review.';
    case 'unresolved_host':
      return 'Resolve unresolved object hosts before export or review.';
    case 'approximate':
      return 'Geometry is approximate. Export and review can continue with a warning.';
    case 'legacy_fallback':
      return 'This view is using legacy fallback geometry. Verify accuracy before export or review.';
    case 'legacy_unsupported_family':
      return 'This family is not fully supported by native geometry. Verify accuracy before export or review.';
    case 'geometry_ready':
      return 'Geometry is ready for export and review.';
    default:
      return 'Review geometry trust before export.';
  }
}

export function appendWorkbenchTrustIssues(
  trust: WorkbenchTrustStatus,
  issues: WorkbenchTrustStatusKind[],
): WorkbenchTrustStatus {
  if (!issues.length) return trust;
  return {
    ...trust,
    issues: uniqueIssues([...trust.issues, ...issues]),
  };
}

export function resolveWorkbenchTrustGate(trust: WorkbenchTrustStatus): WorkbenchTrustGateModel {
  const issues = uniqueIssues([trust.status, ...trust.issues].filter(
    (issue) => issue !== 'geometry_ready',
  ));
  const blockingIssues = sortTrustIssuesByPriority(
    issues.filter(isBlockingTrustIssue),
    ['invalid_geometry', 'unresolved_host'],
  );
  const warningIssues = sortTrustIssuesByPriority(
    issues.filter(isWarningTrustIssue),
    ['legacy_fallback', 'legacy_unsupported_family', 'approximate'],
  );
  const firstBlockingIssue = blockingIssues[0] ?? null;
  const firstWarningIssue = warningIssues[0] ?? null;
  const status: WorkbenchTrustGateAction = firstBlockingIssue
    ? 'block'
    : firstWarningIssue
      ? 'warn'
      : 'pass';
  const primaryIssue = firstBlockingIssue ?? firstWarningIssue;

  return {
    status,
    trustStatus: primaryIssue ?? trust.status,
    issues,
    blockingIssues,
    warningIssues,
    canExport: status !== 'block',
    canReview: status !== 'block',
    label: primaryIssue
      ? `${status === 'block' ? 'Blocked' : 'Warning'}: ${labelForWorkbenchTrustStatus(primaryIssue)}`
      : labelForWorkbenchTrustStatus('geometry_ready'),
    message: primaryIssue ? messageForWorkbenchTrustIssue(primaryIssue, trust) : null,
  };
}

function buildTrustStatus(input: {
  status: WorkbenchTrustStatusKind;
  issues?: WorkbenchTrustStatusKind[];
  renderSource: WorkbenchPergolaRenderSource | 'none';
  message?: string | null;
}): WorkbenchTrustStatus {
  return {
    status: input.status,
    issues: uniqueIssues(input.issues ?? []),
    renderSource: input.renderSource,
    message: input.message ?? null,
  };
}

function collectGeometryTrustIssues(
  geometryContext: ObjectWorkbenchGeometryContext,
): WorkbenchTrustStatusKind[] {
  const issues: WorkbenchTrustStatusKind[] = [];
  const projectModel = geometryContext.projectModel;
  if ((projectModel?.warnings.length ?? 0) > 0) {
    issues.push('approximate');
  }
  return uniqueIssues(issues);
}

function buildDeckSupport(input: {
  moduleInput: CalculatorModuleInputs;
  geometryContext: ObjectWorkbenchGeometryContext;
}): WorkbenchDeckSupportDiagnostic {
  return buildWorkbenchDeckSupportDiagnostic({
    activeHostSide: resolveWorkbenchDeckSupportActiveSide(input.moduleInput),
    decks: input.geometryContext.projectModel?.decks ?? [],
  });
}

function previewMessageFromWorkbenchMessage(message: string): string {
  return message.replace('workbench geometry', '3D geometry preview');
}

export function buildGeometryPreviewStateFromArtifact(
  artifact: WorkbenchSolvedGeometryArtifact,
): GeometryPreviewState {
  return {
    kind: 'ready',
    previewMode: artifact.previewMode,
    resultSource: artifact.resultSource,
    config: artifact.config,
    assembly: artifact.assembly,
    validation: artifact.validation,
    scene: artifact.viewerScene,
    topProjection: artifact.topProjection,
    deckSupport: artifact.deckSupport,
  };
}

function buildWorkbenchViewportGeometry(input: {
  artifact: WorkbenchSolvedGeometryArtifact | null;
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
  preview: GeometryPreviewState;
}): WorkbenchViewportGeometry {
  return {
    artifact: input.artifact,
    legacyFallback: {
      planModel: input.planModel,
      sectionModel: input.sectionModel,
    },
    preview: input.artifact ? buildGeometryPreviewStateFromArtifact(input.artifact) : input.preview,
  };
}

function buildInvalidSolvedModule(input: {
  index: number;
  drawingModule: EstimateDrawingModule;
  label: string;
  moduleInput: CalculatorModuleInputs;
  previewMode: GeometryPreviewMode;
  resultSource: WorkbenchGeometryResultSource;
  draftTouchesGeometry: boolean;
  message: string;
  geometryPreviewMessage?: string;
  drawingResult: EstimateDrawingModule['result'];
  deckSupport?: WorkbenchDeckSupportDiagnostic | null;
  previewKind?: 'error' | 'unsupported';
}): WorkbenchSolvedModule {
  const drawingModule = {
    ...input.drawingModule,
    result: input.drawingResult,
  };
  const previewKind = input.previewKind ?? 'error';
  const geometryPreview: GeometryPreviewState =
    previewKind === 'unsupported' && input.deckSupport
      ? {
          kind: 'unsupported',
          previewMode: input.previewMode,
          message: input.geometryPreviewMessage ?? input.message,
          deckSupport: input.deckSupport,
        }
      : {
          kind: 'error',
          message: input.geometryPreviewMessage ?? input.message,
        };
  return {
    index: input.index,
    id: input.drawingModule.id,
    label: input.label,
    drawingModule,
    moduleInput: input.moduleInput,
    previewMode: input.previewMode,
    resultSource: input.resultSource,
    draftTouchesGeometry: input.draftTouchesGeometry,
    trust: buildTrustStatus({
      status: 'invalid_geometry',
      renderSource: 'legacy',
      message: input.message,
    }),
    renderSource: 'legacy',
    renderStatus: 'invalid_geometry',
    geometryArtifact: null,
    config: null,
    assembly: null,
    geometryPlan: null,
    geometrySection: null,
    geometryTopProjection: null,
    validation: null,
    viewerScene: null,
    geometryPreview,
    viewportGeometry: buildWorkbenchViewportGeometry({
      artifact: null,
      planModel: null,
      sectionModel: null,
      preview: geometryPreview,
    }),
    deckSupport: input.deckSupport ?? null,
    planModel: null,
    sectionModel: null,
  };
}

function buildSolvedModule(input: {
  index: number;
  drawingModule: EstimateDrawingModule;
  label: string;
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  ignoreModuleResults?: boolean;
  geometryIdentity: Required<WorkbenchGeometryIdentity>;
  geometryContext: ObjectWorkbenchGeometryContext;
  /** PR-G3a: pre-built non-host house models, shared across all modules. */
  additionalHouseModels: ReadonlyArray<HouseModel3D>;
  /** PR-G3b: pre-computed project-level decks, shared across all modules. */
  projectDecks: RawGeometryModuleInput['houseContext']['decks'];
  /** PR-G3b: pre-computed project-level openings, shared across all modules. */
  projectOpenings: RawGeometryModuleInput['houseContext']['openings'];
  /**
   * PR-Bug1 (2026-05-25): primary host house form id. Tagged onto every
   * house-family shape in the top projection so plan-view clicks resolve
   * to a real workbench house form id (not the scene-seam prefixed scene
   * id introduced in PR-Geo1).
   */
  primaryHouseFormId: string | null;
}): WorkbenchSolvedModule {
  const initialModuleInput = coerceHiddenWorkbenchGableBaseline(input.drawingModule.input);
  const resolved = resolveWorkbenchGeometryModule({
    snapshot: input.snapshot,
    draft: input.draft,
    moduleIndex: input.index,
    ignoreModuleResults: input.ignoreModuleResults,
  });
  const previewMode = resolvePreviewMode({
    resultSource: resolved.resultSource,
    draftTouchesGeometry: resolved.draftTouchesGeometry,
  });

  if (!resolved.ok) {
    return buildInvalidSolvedModule({
      index: input.index,
      drawingModule: input.drawingModule,
      label: input.label,
      moduleInput: resolved.module ? coerceHiddenWorkbenchGableBaseline(resolved.module) : initialModuleInput,
      previewMode,
      resultSource: resolved.resultSource,
      draftTouchesGeometry: resolved.draftTouchesGeometry,
      message: resolved.message,
      geometryPreviewMessage: previewMessageFromWorkbenchMessage(resolved.message),
      drawingResult: null,
    });
  }

  const moduleInput = coerceHiddenWorkbenchGableBaseline(resolved.module);
  const deckSupport = buildDeckSupport({
    moduleInput,
    geometryContext: input.geometryContext,
  });
  const drawingModule: EstimateDrawingModule = {
    ...input.drawingModule,
    result: resolved.moduleResult,
  };

  const derivation = deriveWorkbenchGeometry({
    projectId: input.geometryIdentity.projectId,
    estimateId: input.geometryIdentity.estimateId,
    designRequestId: input.geometryIdentity.designRequestId,
    moduleId: input.drawingModule.id,
    module: moduleInput,
    result: resolved.moduleResult,
    objectWorkbenchGeometryContext: input.geometryContext,
    fallbackPlanModel: drawingModule.planModel,
    fallbackSectionModel: drawingModule.sectionModel,
    projectDecks: input.projectDecks,
    projectOpenings: input.projectOpenings,
  });

  if (derivation.kind === 'legacy_unsupported_family') {
    const legacyIssues: WorkbenchTrustStatusKind[] =
      derivation.planModel || derivation.sectionModel ? ['legacy_fallback'] : [];
    const geometryPreview: GeometryPreviewState = {
      kind: 'unsupported',
      previewMode,
      message: derivation.message,
      deckSupport,
    };
    return {
      index: input.index,
      id: input.drawingModule.id,
      label: input.label,
      drawingModule,
      moduleInput,
      previewMode,
      resultSource: resolved.resultSource,
      draftTouchesGeometry: resolved.draftTouchesGeometry,
      trust: buildTrustStatus({
        status: 'legacy_unsupported_family',
        issues: legacyIssues,
        renderSource: 'legacy',
        message: derivation.message,
      }),
      renderSource: derivation.renderSource,
      renderStatus: derivation.renderStatus,
      geometryArtifact: null,
      config: null,
      assembly: null,
      geometryPlan: null,
      geometrySection: null,
      geometryTopProjection: null,
      validation: null,
      viewerScene: null,
      geometryPreview,
      viewportGeometry: buildWorkbenchViewportGeometry({
        artifact: null,
        planModel: derivation.planModel,
        sectionModel: derivation.sectionModel,
        preview: geometryPreview,
      }),
      deckSupport,
      planModel: derivation.planModel,
      sectionModel: derivation.sectionModel,
    };
  }

  if (derivation.kind === 'invalid_geometry') {
    return buildInvalidSolvedModule({
      index: input.index,
      drawingModule: input.drawingModule,
      label: input.label,
      moduleInput,
      previewMode,
      resultSource: resolved.resultSource,
      draftTouchesGeometry: resolved.draftTouchesGeometry,
      message: derivation.message,
      drawingResult: resolved.moduleResult,
      deckSupport,
    });
  }

  const validation = validateGeometrySolve({
    config: derivation.config,
    solveResult: {
      ok: true,
      value: derivation.assembly,
    },
  });
  const scene = buildViewerSceneFromSolvedGeometry({
    config: derivation.config,
    assembly: derivation.assembly,
    geometryContext: input.geometryContext,
    additionalHouseModels: input.additionalHouseModels,
  });
  const quantityTakeoff = buildAssemblyQuantityTakeoff(derivation.assembly);
  const geometryTopProjection = buildTopProjectionFromSolvedScene({
    scene,
    fallbackTopProjection: derivation.geometryTopProjection,
    assembly: derivation.assembly,
    pergolaId: moduleInput.pergolaId ?? null,
    houseFormId: input.primaryHouseFormId,
  });
  const trust = buildTrustStatus({
    status: 'geometry_ready',
    issues: collectGeometryTrustIssues(input.geometryContext),
    renderSource: 'geometry',
  });
  const geometryArtifact: WorkbenchSolvedGeometryArtifact = {
    source: 'solved_geometry',
    fallback: null,
    previewMode,
    resultSource: resolved.resultSource,
    deckSupport,
    config: derivation.config,
    assembly: derivation.assembly,
    plan: derivation.geometryPlan,
    section: derivation.geometrySection,
    quantityTakeoff,
    topProjection: geometryTopProjection,
    viewerScene: scene,
    validation,
    trust,
    renderSource: derivation.renderSource,
    renderStatus: derivation.renderStatus,
  };
  const geometryPreview = buildGeometryPreviewStateFromArtifact(geometryArtifact);

  return {
    index: input.index,
    id: input.drawingModule.id,
    label: input.label,
    drawingModule,
    moduleInput,
    previewMode,
    resultSource: resolved.resultSource,
    draftTouchesGeometry: resolved.draftTouchesGeometry,
    trust,
    renderSource: geometryArtifact.renderSource,
    renderStatus: geometryArtifact.renderStatus,
    geometryArtifact,
    config: geometryArtifact.config,
    assembly: geometryArtifact.assembly,
    geometryPlan: geometryArtifact.plan,
    geometrySection: geometryArtifact.section,
    geometryTopProjection: geometryArtifact.topProjection,
    validation: geometryArtifact.validation,
    viewerScene: geometryArtifact.viewerScene,
    geometryPreview,
    viewportGeometry: buildWorkbenchViewportGeometry({
      artifact: geometryArtifact,
      planModel: derivation.planModel,
      sectionModel: derivation.sectionModel,
      preview: geometryPreview,
    }),
    deckSupport,
    planModel: derivation.planModel,
    sectionModel: derivation.sectionModel,
  };
}

function resolveInactiveSolvedModelMessage(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  ignoreModuleResults?: boolean;
  activeModuleIndex?: number;
  drawingModules?: EstimateDrawingModule[];
}): string {
  if (input.drawingModules?.length) {
    return 'The selected module is not available for workbench geometry.';
  }
  const resolution = resolveWorkbenchGeometryModule({
    snapshot: input.snapshot,
    draft: input.draft,
    moduleIndex: input.activeModuleIndex ?? 0,
    ignoreModuleResults: input.ignoreModuleResults,
  });
  return resolution.ok ? 'No active workbench module is available.' : resolution.message;
}

export function buildWorkbenchSolvedModel(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  ignoreModuleResults?: boolean;
  moduleLabels?: string[];
  activeModuleIndex?: number;
  geometryIdentity?: WorkbenchGeometryIdentity | null;
  projectModel?: WorkbenchProjectModel | null;
  drawingModules?: EstimateDrawingModule[];
  objectWorkbenchGeometryContext?: ObjectWorkbenchGeometryContext | null;
}): WorkbenchSolvedModel {
  const geometryIdentity = resolveGeometryIdentity(input.geometryIdentity);
  const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(input.snapshot, input.draft);
  const drawingModules =
    input.drawingModules ??
    buildEstimateDrawingModules(effectiveSnapshot, {
      ignoreModuleResults: input.ignoreModuleResults,
    });
  const geometryContext =
    input.objectWorkbenchGeometryContext ??
    buildObjectWorkbenchGeometryContext({
      snapshot: input.snapshot,
      draft: input.draft,
      projectModel: input.projectModel,
      ignoreModuleResults: input.ignoreModuleResults,
    });
  const projectModel = input.projectModel ?? geometryContext.projectModel ?? EMPTY_WORKBENCH_PROJECT_MODEL;
  // PR-G3a (2026-05-22): build additional-house geometry ONCE per project
  // instead of once per pergola module (closes audit row N10's O(M×F)
  // workaround). Threaded into every module's scene via `buildSolvedModule`.
  const additionalHouseModels = buildProjectAdditionalHouseModels(projectModel);
  // PR-G3b (2026-05-22): map project-level decks/openings ONCE instead of
  // once per pergola module. Closes audit row 9 in production-path spirit.
  const projectDecks = mapProjectDecks(projectModel);
  const projectOpenings = mapProjectOpenings(projectModel);
  const primaryHouseFormId = projectModel.houseAssembly?.houseForms[0]?.id ?? null;
  const modules = drawingModules.map((drawingModule, index) =>
    buildSolvedModule({
      index,
      drawingModule,
      label: input.moduleLabels?.[index] ?? drawingModule.label,
      snapshot: input.snapshot,
      draft: input.draft,
      ignoreModuleResults: input.ignoreModuleResults,
      geometryIdentity,
      geometryContext,
      additionalHouseModels,
      projectDecks,
      projectOpenings,
      primaryHouseFormId,
    }),
  );
  const activeModule = modules[input.activeModuleIndex ?? 0] ?? null;
  const inactiveMessage = activeModule ? null : resolveInactiveSolvedModelMessage(input);
  const projectReferenceShapes = buildProjectReferenceShapesFromModules(modules, projectModel);

  return {
    projectModel,
    modules,
    activeModule,
    projectReferenceShapes,
    trust:
      activeModule?.trust ??
      buildTrustStatus({
        status: 'invalid_geometry',
        renderSource: 'none',
        message: inactiveMessage ?? 'No active workbench module is available.',
      }),
    geometryIdentity,
  };
}

/**
 * PR-2B.1a (2026-05-23): derive the per-object `WorkbenchSolvedProject`
 * from a `WorkbenchSolvedModel`. Transposes the legacy per-module array
 * into a per-pergola array keyed by `PergolaObjectModel.id`. Active
 * selection lifts from `activeModuleIndex` to `activePergolaId`.
 *
 * For each pergola in `projectModel.pergolas`, the matching
 * `WorkbenchSolvedModule` is identified via `moduleInput.pergolaId === pergola.id`.
 * Legacy multi-module setups (multiple modules sharing a pergolaId) use
 * first-wins — V2's "one PergolaObjectModel equals one logical module"
 * contract assumes 1:1. Pergolas in the scene without matching solved
 * modules are skipped (the geometry pipeline has nothing to solve for them).
 *
 * Coexists with the legacy `WorkbenchSolvedModel` for the duration of
 * PR-2B.1a. Consumers migrate to this shape in PR-2B.1b, after which
 * the legacy `modules[]` array and the transposition both retire.
 */
export function buildWorkbenchSolvedProject(input: {
  solvedModel: WorkbenchSolvedModel;
  activePergolaId?: string | null;
}): WorkbenchSolvedProject {
  const { solvedModel } = input;
  // Iterate in source-module order: first occurrence of each pergolaId
  // establishes the SolvedPergola's primary fields and ordering; subsequent
  // occurrences (legacy multi-module-per-pergola) append to `sourceModules`.
  const indexByPergolaId = new Map<string, number>();
  const pergolaLabelById = new Map(
    solvedModel.projectModel.pergolas.map((pergolaObj) => [pergolaObj.id, pergolaObj.label]),
  );
  const pergolas: SolvedPergola[] = [];

  for (let index = 0; index < solvedModel.modules.length; index += 1) {
    const module = solvedModel.modules[index]!;
    const pergolaId = module.moduleInput.pergolaId;
    if (typeof pergolaId !== 'string' || pergolaId.trim().length === 0) continue;
    if (!pergolaLabelById.has(pergolaId)) continue; // orphan: no matching project pergola
    const existingPergolaIndex = indexByPergolaId.get(pergolaId);
    if (existingPergolaIndex !== undefined) {
      pergolas[existingPergolaIndex]!.sourceModules.push(module);
      continue;
    }
    indexByPergolaId.set(pergolaId, pergolas.length);
    pergolas.push({
      id: pergolaId,
      label: pergolaLabelById.get(pergolaId)!,
      pergolaIndex: index,
      moduleInput: module.moduleInput,
      previewMode: module.previewMode,
      resultSource: module.resultSource,
      draftTouchesGeometry: module.draftTouchesGeometry,
      trust: module.trust,
      renderSource: module.renderSource,
      renderStatus: module.renderStatus,
      geometryArtifact: module.geometryArtifact,
      config: module.config,
      assembly: module.assembly,
      geometryPlan: module.geometryPlan,
      geometrySection: module.geometrySection,
      geometryTopProjection: module.geometryTopProjection,
      validation: module.validation,
      viewerScene: module.viewerScene,
      geometryPreview: module.geometryPreview,
      viewportGeometry: module.viewportGeometry,
      deckSupport: module.deckSupport,
      planModel: module.planModel,
      sectionModel: module.sectionModel,
      sourceModules: [module],
    });
  }

  // Active selection: prefer the caller's explicit pergola id; else fall
  // back to the legacy `activeModule`'s pergolaId; else first pergola; else null.
  const explicit = input.activePergolaId ?? null;
  const fallback = solvedModel.activeModule?.moduleInput.pergolaId ?? pergolas[0]?.id ?? null;
  const activePergolaId =
    explicit && pergolas.some((p) => p.id === explicit) ? explicit : fallback;
  const activePergola = pergolas.find((p) => p.id === activePergolaId) ?? null;

  return {
    projectModel: solvedModel.projectModel,
    pergolas,
    activePergolaId,
    activePergola,
    projectReferenceShapes: solvedModel.projectReferenceShapes,
    trust: solvedModel.trust,
    geometryIdentity: solvedModel.geometryIdentity,
  };
}

/**
 * Step 5d Option A: aggregate reference shapes for every pergola module's
 * solved assembly. The pergola source id comes from
 * `module.drawingModule.input.pergolaId` (or `pergola-${index+1}` fallback);
 * the house source id comes from the project's first house form id (the
 * workbench has at most one house form today, so any pergola's house data
 * is canonical).
 */
function buildProjectReferenceShapesFromModules(
  modules: WorkbenchSolvedModule[],
  projectModel: WorkbenchProjectModel,
): GeometryTopProjectionShape[] {
  const entries: ProjectPergolaEntry[] = [];
  for (let index = 0; index < modules.length; index += 1) {
    const module = modules[index]!;
    const assembly = module.assembly;
    if (!assembly) continue;
    const pergolaSourceId =
      module.moduleInput.pergolaId ?? `pergola-${index + 1}`;
    entries.push({ assembly, pergolaSourceId });
  }
  const allHouseForms = projectModel.houseAssembly?.houseForms ?? [];
  const primaryHouseForm = allHouseForms[0] ?? null;
  const primaryHouseSourceId = primaryHouseForm?.id ?? null;
  const shapes: GeometryTopProjectionShape[] =
    entries.length === 0
      ? []
      : buildProjectReferenceShapes({
          pergolas: entries,
          houseSourceId: primaryHouseSourceId,
        });

  // PR8c-iii: additional house forms (sleepouts, granny flats) get their
  // own `house_reference` shapes appended to the project overlay so
  // PlanViewport can render them in their authored world position.
  // The primary form is already covered by `buildProjectReferenceShapes`
  // via the pergolas it hosts; for non-pergola estimates with only a
  // primary house we also emit the primary here so the plan still shows
  // it (no pergola means no overlay otherwise).
  const additionalForms = allHouseForms.slice(entries.length === 0 ? 0 : 1);
  for (const form of additionalForms) {
    const geometry = buildAdditionalHouseFormGeometry({ houseForm: form });
    if (!geometry) continue;
    const shape = buildHouseReferenceProjectionShape({
      house: geometry,
      houseSourceId: form.id,
    });
    if (shape) shapes.push(shape);
  }

  return shapes;
}

/**
 * Filter the project-level reference shapes for use as a context overlay
 * alongside the active module's topProjection. Drops the active pergola's
 * own outline (already rendered in full detail) and the house reference
 * (likewise) so the overlay only adds shapes the active view doesn't
 * already provide.
 */
export function buildProjectContextOverlayShapes(input: {
  projectReferenceShapes: ReadonlyArray<GeometryTopProjectionShape>;
  activePergolaSourceId: string | null;
}): GeometryTopProjectionShape[] {
  return input.projectReferenceShapes.filter((shape) => {
    if (shape.sourceType === 'house_reference') return false;
    if (
      shape.sourceType === 'pergola_reference' &&
      input.activePergolaSourceId &&
      shape.sourceObjectId === input.activePergolaSourceId
    ) {
      return false;
    }
    return true;
  });
}

function buildGeometryPreviewStateFromSolvedModule(
  module: WorkbenchSolvedModule | null,
  fallbackMessage = 'The selected module is not available for 3D geometry preview.',
): GeometryPreviewState {
  return module?.viewportGeometry.preview ?? { kind: 'error', message: fallbackMessage };
}

export function buildGeometryPreviewStateFromSolvedModel(
  model: WorkbenchSolvedModel,
  fallbackMessage = 'The selected module is not available for 3D geometry preview.',
): GeometryPreviewState {
  return buildGeometryPreviewStateFromSolvedModule(
    model.activeModule,
    model.trust.message ? previewMessageFromWorkbenchMessage(model.trust.message) : fallbackMessage,
  );
}
