import type {
  DeckFloatingPresetRect,
  DeckPresetRect,
  DeckElevationMode,
  DeckKind,
  DeckPresetType,
  DeckShape,
  DeckSurfaceMaterial,
  HouseFirstDeckDraft,
  HouseFirstOpeningDraft,
  HouseFirstPergolaDraft,
  HouseFirstRoofDraft,
  SliderPanelCount,
  WallOpeningHostSide,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import {
  normalizeWallOpeningKind,
  resolveOpeningPanelCount,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import { normalizeHouseFootprintPolygon } from '@/lib/types/calculator';
import type { EstimateDrawingDraft } from '../drawingEdits';

export type EstimateDrawingHouseFirstDraft = {
  roof?: HouseFirstRoofDraft | null;
  decks?: HouseFirstDeckDraft[] | null;
  openings?: HouseFirstOpeningDraft[] | null;
  pergolas?: HouseFirstPergolaDraft[] | null;
};

export type EstimateDrawingHouseFirstRoofDraft = HouseFirstRoofDraft;
export type EstimateDrawingHouseFirstDeckDraft = HouseFirstDeckDraft;
export type EstimateDrawingHouseFirstOpeningDraft = HouseFirstOpeningDraft;
export type EstimateDrawingHouseFirstPergolaDraft = HouseFirstPergolaDraft;

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function trimNullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeHouseFirstRoofDraft(
  roof: HouseFirstRoofDraft | null | undefined,
): HouseFirstRoofDraft | null {
  if (!roof) return null;

  const openGableEndIds = Array.isArray(roof.openGableEndIds)
    ? [...new Set(
      roof.openGableEndIds
        .filter((candidate): candidate is string => typeof candidate === 'string')
        .map((candidate) => candidate.trim())
        .filter((candidate) => candidate.length > 0),
    )]
    : [];

  const appendage = roof.appendage
    ? {
        ...(typeof roof.appendage.enabled === 'boolean' ? { enabled: roof.appendage.enabled } : null),
        ...(roof.appendage.form ? { form: roof.appendage.form } : null),
        ...(roof.appendage.hostEdge ? { hostEdge: roof.appendage.hostEdge } : null),
        ...(trimNullableString(roof.appendage.pitchDeg ?? null)
          ? { pitchDeg: trimNullableString(roof.appendage.pitchDeg ?? null) }
          : null),
        ...(trimNullableString(roof.appendage.dropMm ?? null)
          ? { dropMm: trimNullableString(roof.appendage.dropMm ?? null) }
          : null),
      }
    : null;

  const normalized: HouseFirstRoofDraft = {
    ...(roof.form ? { form: roof.form } : null),
    ...(trimNullableString(roof.primaryPitchDeg ?? null)
      ? { primaryPitchDeg: trimNullableString(roof.primaryPitchDeg ?? null) }
      : null),
    ...(roof.material ? { material: roof.material } : null),
    ...(roof.primaryFallDirection ? { primaryFallDirection: roof.primaryFallDirection } : null),
    ...(roof.ridgeAxis ? { ridgeAxis: roof.ridgeAxis } : null),
    ...(openGableEndIds.length ? { openGableEndIds } : null),
    ...(appendage && Object.keys(appendage).length ? { appendage } : null),
  };

  return Object.keys(normalized).length ? normalized : null;
}

function isDeckKind(value: unknown): value is DeckKind {
  return value === 'deck' || value === 'landing';
}

function isDeckShape(value: unknown): value is DeckShape {
  return value === 'preset' || value === 'custom';
}

function isDeckPresetType(value: unknown): value is DeckPresetType {
  return value === 'rect_attached' || value === 'rect_detached';
}

function isDeckElevationMode(value: unknown): value is DeckElevationMode {
  return value === 'ground' || value === 'stepped' || value === 'aligned_to_threshold';
}

function isDeckAttachmentMode(value: unknown): value is HouseFirstDeckDraft['attachmentMode'] {
  return value === 'floating' || value === 'single_edge' || value === 'corner_dual_edge';
}

function isDeckSurfaceMaterial(value: unknown): value is DeckSurfaceMaterial {
  return value === 'timber_decking' || value === 'composite' || value === 'concrete';
}

function normalizeDeckPresetRect(
  value: DeckPresetRect | null | undefined,
): DeckPresetRect | null {
  if (!value || typeof value !== 'object') return null;
  const widthM = trimNullableString(value.widthM ?? null);
  const depthM = trimNullableString(value.depthM ?? null);
  const centerOffsetM = trimNullableString(value.centerOffsetM ?? null);
  const detachedGapM = trimNullableString(value.detachedGapM ?? null);
  if (!widthM || !depthM || !centerOffsetM) return null;
  return {
    widthM,
    depthM,
    centerOffsetM,
    ...(detachedGapM ? { detachedGapM } : null),
  };
}

function normalizeDeckFloatingPresetRect(
  value: DeckFloatingPresetRect | null | undefined,
): DeckFloatingPresetRect | null {
  if (!value || typeof value !== 'object') return null;
  const centerAlongM = trimNullableString(value.centerAlongM ?? null);
  const centerDepthM = trimNullableString(value.centerDepthM ?? null);
  const widthM = trimNullableString(value.widthM ?? null);
  const depthM = trimNullableString(value.depthM ?? null);
  if (!centerAlongM || !centerDepthM || !widthM || !depthM) return null;
  return {
    centerAlongM,
    centerDepthM,
    widthM,
    depthM,
  };
}

function normalizeHouseFirstDeckDraft(
  deck: HouseFirstDeckDraft | null | undefined,
): HouseFirstDeckDraft | null {
  if (!deck || typeof deck.id !== 'string' || deck.id.trim().length === 0) return null;
  const outline = normalizeHouseFootprintPolygon(deck.outline);
  const normalized: HouseFirstDeckDraft = {
    id: deck.id.trim(),
    ...(trimNullableString(deck.name ?? null) ? { name: trimNullableString(deck.name ?? null) } : null),
    ...(isDeckKind(deck.kind) ? { kind: deck.kind } : null),
    ...(isDeckShape(deck.shape) ? { shape: deck.shape } : null),
    ...(isDeckPresetType(deck.presetType) ? { presetType: deck.presetType } : null),
    ...(normalizeDeckPresetRect(deck.presetRect) ? { presetRect: normalizeDeckPresetRect(deck.presetRect) } : null),
    ...(normalizeDeckFloatingPresetRect(deck.floatingRect)
      ? { floatingRect: normalizeDeckFloatingPresetRect(deck.floatingRect) }
      : null),
    ...(outline.length ? { outline } : null),
    ...(isDeckElevationMode(deck.elevationMode) ? { elevationMode: deck.elevationMode } : null),
    ...(trimNullableString(deck.levelOffsetMm ?? null)
      ? { levelOffsetMm: trimNullableString(deck.levelOffsetMm ?? null) }
      : null),
    ...(typeof deck.hostEdgeId === 'string' && deck.hostEdgeId.trim()
      ? { hostEdgeId: deck.hostEdgeId.trim() }
      : null),
    ...(isDeckAttachmentMode(deck.attachmentMode) ? { attachmentMode: deck.attachmentMode } : null),
    ...(typeof deck.primaryHostEdgeId === 'string' && deck.primaryHostEdgeId.trim()
      ? { primaryHostEdgeId: deck.primaryHostEdgeId.trim() }
      : null),
    ...(typeof deck.secondaryHostEdgeId === 'string' && deck.secondaryHostEdgeId.trim()
      ? { secondaryHostEdgeId: deck.secondaryHostEdgeId.trim() }
      : null),
    ...(typeof deck.cornerVertexId === 'string' && deck.cornerVertexId.trim()
      ? { cornerVertexId: deck.cornerVertexId.trim() }
      : null),
    ...(typeof deck.isAttached === 'boolean' ? { isAttached: deck.isAttached } : null),
    ...(isDeckSurfaceMaterial(deck.surfaceMaterial) ? { surfaceMaterial: deck.surfaceMaterial } : null),
  };
  return normalized;
}

function isWallOpeningHostSide(value: unknown): value is WallOpeningHostSide {
  return value === 'rear' || value === 'front' || value === 'left' || value === 'right';
}

function normalizeHouseFirstOpeningDraft(
  opening: HouseFirstOpeningDraft | null | undefined,
): HouseFirstOpeningDraft | null {
  if (!opening || typeof opening.id !== 'string' || opening.id.trim().length === 0) return null;
  const kind = normalizeWallOpeningKind(opening.kind);
  const label = trimNullableString(opening.label ?? null);
  const widthM = trimNullableString(opening.widthM ?? null);
  const heightM = trimNullableString(opening.heightM ?? null);
  const sillHeightM = trimNullableString(opening.sillHeightM ?? null);
  const offsetAlongWallM = trimNullableString(opening.offsetAlongWallM ?? null);
  const hostWallId = trimNullableString(opening.hostWallId ?? null);
  const panelCount = resolveOpeningPanelCount(kind, opening.panelCount);
  return {
    id: opening.id.trim(),
    ...(label ? { label } : null),
    kind,
    ...(panelCount !== null ? { panelCount: panelCount as SliderPanelCount } : null),
    ...(hostWallId ? { hostWallId } : null),
    ...(isWallOpeningHostSide(opening.wallId) ? { wallId: opening.wallId } : null),
    ...(typeof opening.hostEdgeId === 'string' && opening.hostEdgeId.trim()
      ? { hostEdgeId: opening.hostEdgeId.trim() }
      : null),
    ...(widthM ? { widthM } : null),
    ...(heightM ? { heightM } : null),
    ...(sillHeightM ? { sillHeightM } : null),
    ...(offsetAlongWallM ? { offsetAlongWallM } : null),
  };
}

function normalizeHouseFirstPergolaDraft(
  pergola: HouseFirstPergolaDraft | null | undefined,
): HouseFirstPergolaDraft | null {
  if (!pergola || typeof pergola.id !== 'string' || pergola.id.trim().length === 0) return null;
  const attachmentEdgeId = trimNullableString(pergola.attachmentEdgeId ?? null);
  const attachmentZoneId = trimNullableString(pergola.attachmentZoneId ?? null);
  return {
    id: pergola.id.trim(),
    ...(attachmentEdgeId ? { attachmentEdgeId } : null),
    ...(attachmentZoneId ? { attachmentZoneId } : null),
  };
}

export function normalizeEstimateDrawingHouseFirstDraft(
  value: EstimateDrawingHouseFirstDraft | null | undefined,
): EstimateDrawingHouseFirstDraft | undefined {
  const roof = normalizeHouseFirstRoofDraft(value?.roof);
  const decks = (value?.decks ?? [])
    .map((deck) => normalizeHouseFirstDeckDraft(deck))
    .filter((deck): deck is HouseFirstDeckDraft => Boolean(deck));
  const openings = (value?.openings ?? [])
    .map((opening) => normalizeHouseFirstOpeningDraft(opening))
    .filter((opening): opening is HouseFirstOpeningDraft => Boolean(opening));
  const pergolas = (value?.pergolas ?? [])
    .map((pergola) => normalizeHouseFirstPergolaDraft(pergola))
    .filter((pergola): pergola is HouseFirstPergolaDraft => Boolean(pergola));
  return roof || decks.length || openings.length || pergolas.length
    ? {
        ...(roof ? { roof } : null),
        ...(decks.length ? { decks } : null),
        ...(openings.length ? { openings } : null),
        ...(pergolas.length ? { pergolas } : null),
      }
    : undefined;
}

export function updateEstimateDrawingHouseFirstRoofDraft(input: {
  draft: EstimateDrawingDraft;
  roof: HouseFirstRoofDraft | null;
}): EstimateDrawingDraft {
  const nextDraft = cloneValue(input.draft);
  nextDraft.houseFirst = normalizeEstimateDrawingHouseFirstDraft({
    ...(nextDraft.houseFirst ?? {}),
    roof: input.roof,
  });
  return nextDraft;
}

export function updateEstimateDrawingHouseFirstDeckDrafts(input: {
  draft: EstimateDrawingDraft;
  decks: HouseFirstDeckDraft[] | null;
}): EstimateDrawingDraft {
  const nextDraft = cloneValue(input.draft);
  nextDraft.houseFirst = normalizeEstimateDrawingHouseFirstDraft({
    ...(nextDraft.houseFirst ?? {}),
    decks: input.decks,
  });
  return nextDraft;
}

export function updateEstimateDrawingHouseFirstOpeningDrafts(input: {
  draft: EstimateDrawingDraft;
  openings: HouseFirstOpeningDraft[] | null;
}): EstimateDrawingDraft {
  const nextDraft = cloneValue(input.draft);
  nextDraft.houseFirst = normalizeEstimateDrawingHouseFirstDraft({
    ...(nextDraft.houseFirst ?? {}),
    openings: input.openings,
  });
  return nextDraft;
}

export function updateEstimateDrawingHouseFirstPergolaDrafts(input: {
  draft: EstimateDrawingDraft;
  pergolas: HouseFirstPergolaDraft[] | null;
}): EstimateDrawingDraft {
  const nextDraft = cloneValue(input.draft);
  nextDraft.houseFirst = normalizeEstimateDrawingHouseFirstDraft({
    ...(nextDraft.houseFirst ?? {}),
    pergolas: input.pergolas,
  });
  return nextDraft;
}
