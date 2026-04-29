import { buildHouseFootprintPresetSideLocalPoints } from '@sp/geometry';
import {
  buildDeckReferenceHousePolygon,
  resolveDeckPresetGeometry,
} from '@/lib/drawings/state/houseFirstDeckPresets';
import type {
  HouseFirstDeckDraft,
  HouseFirstOpeningDraft,
  HouseModel,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import {
  normalizeWallOpeningKind,
  resolveOpeningPanelCount,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';

export function toDeckDrafts(house: HouseModel | null | undefined): HouseFirstDeckDraft[] {
  return (house?.decks ?? []).map((deck) => ({
    id: deck.id,
    name: deck.name,
    kind: deck.kind,
    shape: deck.shape,
    presetType: deck.presetType,
    presetRect: deck.presetRect,
    floatingRect: deck.floatingRect,
    outline: deck.outline,
    elevationMode: deck.elevationMode,
    levelOffsetMm: deck.levelOffsetMm,
    hostEdgeId: deck.hostEdgeId,
    attachmentMode: deck.attachmentMode,
    primaryHostEdgeId: deck.primaryHostEdgeId,
    secondaryHostEdgeId: deck.secondaryHostEdgeId,
    cornerVertexId: deck.cornerVertexId,
    isAttached: deck.isAttached,
    surfaceMaterial: deck.surfaceMaterial,
  }));
}

export function nextDeckId(existing: HouseFirstDeckDraft[]): string {
  const used = new Set(existing.map((deck) => deck.id));
  let index = existing.length + 1;
  while (used.has(`deck-${index}`)) index += 1;
  return `deck-${index}`;
}

export function toOpeningDrafts(house: HouseModel | null | undefined): HouseFirstOpeningDraft[] {
  return (house?.openings ?? []).map((opening) => ({
    kind: normalizeWallOpeningKind(opening.kind),
    id: opening.id,
    label: opening.label,
    panelCount: resolveOpeningPanelCount(normalizeWallOpeningKind(opening.kind), opening.panelCount),
    hostWallId: opening.hostWallId,
    wallId: opening.wallId,
    hostEdgeId: opening.hostEdgeId,
    widthM: opening.widthM,
    heightM: opening.heightM,
    sillHeightM: opening.sillHeightM,
    offsetAlongWallM: opening.offsetAlongWallM,
  }));
}

export function nextOpeningId(existing: HouseFirstOpeningDraft[]): string {
  const used = new Set(existing.map((opening) => opening.id));
  let index = existing.length + 1;
  while (used.has(`opening-${index}`)) index += 1;
  return `opening-${index}`;
}

export function houseLocalPolygon(input: {
  house: HouseModel;
  moduleLengthM: string | undefined;
  moduleProjectionM: string | undefined;
}): Array<{ alongM: string; depthM: string }> {
  if (input.house.footprint.mode === 'custom_polygon' && input.house.footprint.polygon.length) {
    return input.house.footprint.polygon;
  }
  const widthMm = Math.round((Number(input.moduleLengthM) || 6) * 1000);
  const depthMm = Math.round((Number(input.moduleProjectionM) || 3) * 1000);
  return buildHouseFootprintPresetSideLocalPoints({
    pergolaWidthMm: widthMm,
    pergolaDepthMm: depthMm,
    preset: input.house.footprint.preset,
    params: input.house.footprint.params,
    attachmentSide: input.house.footprint.attachmentSide,
  }).map((point) => ({
    alongM: String(point.alongM),
    depthM: String(point.depthM),
  }));
}

export function deckReferenceHousePolygon(input: {
  house: HouseModel;
  moduleLengthM: string | undefined;
  moduleProjectionM: string | undefined;
}): Array<{ alongM: string; depthM: string }> {
  return buildDeckReferenceHousePolygon({
    housePolygon: houseLocalPolygon(input),
    footprintParams: input.house.footprint.params,
  });
}

export function resolveDeckDraftGeometry(input: {
  deck: HouseFirstDeckDraft;
  housePolygon: Array<{ alongM: string; depthM: string }>;
}): HouseFirstDeckDraft {
  const resolved = resolveDeckPresetGeometry({
    deck: input.deck,
    housePolygon: input.housePolygon,
  });

  return {
    ...input.deck,
    hostEdgeId: resolved.hostEdgeId,
    attachmentMode: resolved.attachmentMode,
    primaryHostEdgeId: resolved.primaryHostEdgeId,
    secondaryHostEdgeId: resolved.secondaryHostEdgeId,
    cornerVertexId: resolved.cornerVertexId,
    presetRect: resolved.presetRect,
    floatingRect: resolved.floatingRect,
    outline: resolved.outline,
  };
}
