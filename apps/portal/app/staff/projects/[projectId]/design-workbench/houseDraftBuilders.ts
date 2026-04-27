import { buildHouseFootprintPresetSideLocalPoints } from '@sp/geometry';
import {
  buildDeckReferenceHousePolygon,
  buildRectangularDeckOutline,
  inferDeckPresetRectFromOutline,
  sanitizeDeckPresetRect,
} from '@/lib/drawings/state/houseFirstDeckPresets';
import type {
  HouseFirstDeckDraft,
  HouseFirstOpeningDraft,
  HouseModel,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import { normalizeWallOpeningKind } from '@/lib/drawings/state/houseFirstWorkbenchModel';

export function toDeckDrafts(house: HouseModel | null | undefined): HouseFirstDeckDraft[] {
  return (house?.decks ?? []).map((deck) => ({
    id: deck.id,
    name: deck.name,
    kind: deck.kind,
    shape: deck.shape,
    presetType: deck.presetType,
    presetRect: deck.presetRect,
    outline: deck.outline,
    elevationMode: deck.elevationMode,
    levelOffsetMm: deck.levelOffsetMm,
    hostEdgeId: deck.hostEdgeId,
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
    id: opening.id,
    label: opening.label,
    kind: normalizeWallOpeningKind(opening.kind),
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
  const attached = Boolean(input.deck.isAttached);
  const fallbackHostEdgeId = input.deck.hostEdgeId ?? 'rear';
  const hostEdgeId = input.deck.shape === 'preset' ? fallbackHostEdgeId : input.deck.hostEdgeId ?? null;
  const inferredPresetRect =
    input.deck.shape === 'preset'
      ? inferDeckPresetRectFromOutline({
          housePolygon: input.housePolygon,
          hostEdgeId: fallbackHostEdgeId,
          attached,
          outline: input.deck.outline,
        })
      : null;
  const presetRect =
    input.deck.shape === 'preset'
      ? sanitizeDeckPresetRect({
          housePolygon: input.housePolygon,
          hostEdgeId: fallbackHostEdgeId,
          attached,
          presetRect: input.deck.presetRect ?? inferredPresetRect,
          fallbackPresetRect: inferredPresetRect,
        })
      : input.deck.presetRect ?? inferredPresetRect;
  const outline =
    input.deck.shape === 'preset'
      ? buildRectangularDeckOutline({
          housePolygon: input.housePolygon,
          hostEdgeId: fallbackHostEdgeId,
          attached,
          presetRect,
          fallbackPresetRect: inferredPresetRect,
        })
      : input.deck.outline ?? [];

  return {
    ...input.deck,
    hostEdgeId,
    presetRect,
    outline,
  };
}
