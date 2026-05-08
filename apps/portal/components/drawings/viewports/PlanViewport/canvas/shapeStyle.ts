import type { GeometryTopProjectionShape } from '@sp/geometry';
import lineweightStyles from './planLineweights.module.css';

function houseCommittedBodyTokenClass(shape: GeometryTopProjectionShape): string {
  if (shape.kind === 'deck') return lineweightStyles.bodyHouseDeck;
  if (shape.kind === 'opening_marker' || shape.kind === 'opening_outline') {
    return lineweightStyles.bodyHouseOpening;
  }
  if (shape.kind === 'roof' || shape.kind === 'house_roof_material') return lineweightStyles.bodyHouseRoof;
  if (shape.kind === 'soffit') return lineweightStyles.bodyHouseSoffit;
  if (shape.kind === 'fascia') return lineweightStyles.bodyHouseFascia;
  if (shape.kind === 'attachment_zone') return lineweightStyles.bodyHouseAttachmentZone;
  if (shape.kind === 'footprint') return lineweightStyles.bodyHouseFootprint;
  if (shape.kind === 'house_terminal_end') {
    // The geometry emitter (packages/geometry/src/topProjection.ts) tags
    // every terminal-end marker with `metadata.isOpen`. Closed ends are
    // hip slopes (filled triangle); open ends render as gable walls
    // (dashed outline). The hit-target layer handles the click.
    return shape.metadata?.isOpen === true
      ? lineweightStyles.bodyHouseTerminalEndOpen
      : lineweightStyles.bodyHouseTerminalEndClosed;
  }
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
