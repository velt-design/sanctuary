import type { GeometryTopProjectionShape } from '@sp/geometry';
import lineweightStyles from './planLineweights.module.css';

function houseCommittedBodyTokenClass(shape: GeometryTopProjectionShape): string {
  if (shape.kind === 'deck') return lineweightStyles.bodyHouseDeck;
  if (shape.kind === 'opening_marker' || shape.kind === 'opening_outline') {
    return lineweightStyles.bodyHouseOpening;
  }
  if (shape.kind === 'roof' || shape.kind === 'house_roof_material') {
    // Milestone 13 plan-view UX: a hip-end facet tagged isOpen=true is
    // a synthetic hover target for an OPENED gable end. Render it
    // transparent so the only visible marker is the .hitTargetTerminalEnd
    // hover affordance from the hit-target layer above. The closed-end
    // hip facets keep the standard roof body style.
    if (shape.kind === 'roof' && shape.metadata?.isOpen === true) {
      return lineweightStyles.bodyTransparent;
    }
    return lineweightStyles.bodyHouseRoof;
  }
  if (shape.kind === 'soffit') return lineweightStyles.bodyHouseSoffit;
  if (shape.kind === 'fascia') return lineweightStyles.bodyHouseFascia;
  if (shape.kind === 'attachment_zone') return lineweightStyles.bodyHouseAttachmentZone;
  if (shape.kind === 'footprint') return lineweightStyles.bodyHouseFootprint;
  if (shape.kind === 'gutter' || shape.kind === 'roof_feature' || shape.kind === 'wall_segment') {
    return lineweightStyles.bodyHouseLine;
  }
  return lineweightStyles.bodyReference;
}

function pergolaCommittedBodyTokenClass(shape: GeometryTopProjectionShape): string {
  if (shape.kind === 'roof_cladding') return lineweightStyles.bodyPergolaCladding;
  if (shape.kind === 'rafter') return lineweightStyles.bodyPergolaRafter;
  if (shape.kind === 'ridge') return lineweightStyles.bodyPergolaRidge;
  return lineweightStyles.bodyPergolaRoof;
}

export function planCommittedBodyTokenClass(shape: GeometryTopProjectionShape): string {
  if (shape.family === 'house') return houseCommittedBodyTokenClass(shape);
  if (shape.family === 'reference') return lineweightStyles.bodyReference;
  return pergolaCommittedBodyTokenClass(shape);
}
