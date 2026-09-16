import { representativeBlindOpenings, type BlindOpening } from '@sp/geometry';
import { getBlindSystemLimits } from '@sp/costing';
import { solvePergolaPreview } from './solvePreview';
import type { PreviewRoofChoices } from './GableChoices';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewBlind } from './blindCatalog';

export function previewBlindOpenings(input:SimpleCoverInput, roof:PreviewRoofChoices) {
  const geometry=solvePergolaPreview(input,roof).geometry;
  return geometry?representativeBlindOpenings(geometry.assembly):[];
}
export function blindUnavailable(opening:BlindOpening, fabric='urban') {
  const limits=getBlindSystemLimits('ZIPTRAK');
  const max=fabric==='pvc'?Math.min(5500,limits.maxWidthMm):limits.maxWidthMm;
  return opening.width>max?`This opening exceeds the ${(max/1000).toFixed(1)} m ${fabric==='pvc'?'PVC':'mesh'} limit.`
    :opening.top>limits.maxCoverLengthMm?'This opening exceeds the 3.5 m blind height limit.'
    :opening.width<650 || opening.top<500?'This opening is too small for Ziptrak.':'';
}
export function validPreviewBlinds(input:SimpleCoverInput,roof:PreviewRoofChoices,blinds:PreviewBlind[]) {
  if(!blinds.length) return [];
  const openings=previewBlindOpenings(input,roof);
  return blinds.filter(b=>{const o=openings.find(o=>o.id===b.opening);return o && !blindUnavailable(o,b.fabric);});
}
