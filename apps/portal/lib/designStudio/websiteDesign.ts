import { CUSTOMER_DIMENSION_BOUNDS } from '@sp/configurator/core';
import { SIMPLE_COVER_WIDTH_MIN_MM, SIMPLE_COVER_WIDTH_MAX_MM, SIMPLE_COVER_PROJECTION_MIN_MM, previewProjectionMax, previewBlindOpenings, constrainPreviewConnection } from '@sp/configurator/geometry';
import { parseRoofBattens, parseSidePanels } from '@sp/configurator/website';
import { parseStudioWebsiteDesign, type StudioWebsiteDesign } from './websiteDesignContract';
import {readStudioFacadeClearance} from './studioFacadeClearance';
export * from './websiteDesignContract';

/** Last structurally valid choices are not an authority to price malformed raw input. */
export function resolveStudioWebsiteDesign(value: unknown, objectId: string) {
  const parsed = parseStudioWebsiteDesign(value, objectId);
  if (!parsed.ok) return parsed;
  const selection = structuredClone(parsed.value.selection);
  for (const field of ['widthMm', 'projectionMm'] as const) {
    const raw = parsed.value.rawDimensions[field].trim();
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) <= 0)
      return { ok: false as const, message: `Enter a positive whole millimetre value for ${field === 'widthMm' ? 'width' : 'projection'}.`, field };
    const minimum=field==='widthMm'?Math.max(SIMPLE_COVER_WIDTH_MIN_MM,CUSTOMER_DIMENSION_BOUNDS.lengthMm.minimum):Math.max(SIMPLE_COVER_PROJECTION_MIN_MM,CUSTOMER_DIMENSION_BOUNDS.projectionMm.minimum);
    const maximum=field==='widthMm'?SIMPLE_COVER_WIDTH_MAX_MM:previewProjectionMax(selection.roof);
    if(Number(raw)<minimum || Number(raw)>maximum) return {ok:false as const,field,message:`${field==='widthMm'?'Width':'Projection'} must be between ${minimum} and ${maximum} mm for this roof. Your input is kept.`};
    selection.input[field] = Number(raw);
  }
  const roof=selection.roof;
  if (selection.input.connection==='facade' && roof.attachmentIntent!=='freestanding') try {readStudioFacadeClearance(parsed.value.facadeClearanceMm);} catch(error) {return {ok:false as const,field:'facadeClearance' as const,message:(error as Error).message};}
  if(roof.attachmentIntent!=='freestanding'&&!(roof.family==='gable'&&roof.orientation==='away')&&constrainPreviewConnection(selection.input,roof.family).connection!==selection.input.connection)
    return {ok:false as const,field:'connection' as const,message:'Choose an available house connection for this roof and projection. Your previous choice is kept.'};
  if(roof.attachmentIntent==='freestanding'&&selection.input.level==='elevated')
    return {ok:false as const,field:'level' as const,message:'Choose Ground for a freestanding pergola. Your previous site level is kept.'};
  const gaps=parsed.value.rawGaps??{};
  const badGap=(key:string)=>({ok:false as const,field:'gap' as const,gapKey:key,message:'Enter a whole gap from 5–200 mm. Your input is kept.'});
  if(roof.roofBattens&&roof.finish?.material!=='solid'&&gaps.roof!==undefined){
    const raw=gaps.roof.trim(),next=raw?parseRoofBattens({...roof.roofBattens,gap:Number(raw),customGap:true}):null;
    if(!next)return badGap('roof');roof.roofBattens=next;
  }
  // Only an existing active opening can apply a raw panel gap to trusted geometry.
  const needsOpenings=roof.sidePanels?.some(panel=>gaps[panel.opening]!==undefined&&(panel.kind!=='acrylic'||panel.battens));
  const openings=needsOpenings?previewBlindOpenings(selection.input,roof,{rearOpenings:true}):[];
  for(const panel of roof.sidePanels??[]){const raw=gaps[panel.opening];if(raw===undefined||(panel.kind==='acrylic'&&!panel.battens)||!openings.some(o=>o.id===panel.opening))continue;
    const next=raw.trim()?parseSidePanels([{...panel,gap:Number(raw),customGap:true}])?.[0]:null;
    if(!next)return badGap(panel.opening);Object.assign(panel,next);
  }
  if(roof.finish?.material==='solid')delete roof.roofBattens;
  return { ok: true as const, value: selection };
}
