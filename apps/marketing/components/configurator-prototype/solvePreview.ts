import { buildRepresentativeRoofFinish, fitRepresentativeBlindPosts, matchRepresentativePitchedLedger } from "@sp/geometry";
import { getRoofFinish } from "./roofFinish";
import { solveCustomerConfigurationV1 } from '@sp/configurator/geometry';
import { calculateSoffitBracketCountV1 } from '@sp/costing';
import { buildRepresentativeSurroundings, buildRepresentativeGable, buildRepresentativeGableContext, buildRepresentativeBox, buildRepresentativeBoxContext, type Assembly3D, type GeometryPlanViewModel, type ViewerSceneModel, type RoofFinishGeometry } from '@sp/geometry';
import { simpleCoverPostCount, simpleCoverRafterLayout, type SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import { configurationForSimpleCover } from './model';
import { INITIAL_ROOF, type PreviewRoofChoices } from './GableChoices';

function solveBasePreview(input: SimpleCoverInput, roof: PreviewRoofChoices = INITIAL_ROOF) {
  if (roof.family === 'mono') return solveSimpleCoverPreview(input);
  try {
    if (roof.family === 'box') {
      if(input.connection === 'fascia') throw new Error('Invalid box connection');
      return { status:'review_required' as const, geometry:buildRepresentativeBox({...input,connection:input.connection}),messages:[] };
    }
    return { status: 'review_required' as const, geometry: buildRepresentativeGable({ ...input, ...roof }), messages: [] };
  } catch {
    return { status: 'invalid' as const, messages: [{ message: 'This design needs a closer look. Adjust your dimensions to continue.' }] };
  }
}

export function solvePergolaPreview(input: SimpleCoverInput, roof: PreviewRoofChoices = INITIAL_ROOF): { status: string; messages: { message: string }[]; geometry?: { assembly: Assembly3D; plan: GeometryPlanViewModel; viewerScene: ViewerSceneModel; covering?: RoofFinishGeometry } } {
  let source: ReturnType<typeof solvePergolaPreview> = solveBasePreview(input, roof);
  if(roof.family==='mono'&&source.geometry){const matched=matchRepresentativePitchedLedger(source.geometry.assembly);if(matched)source={...source,geometry:matched};}
  if ('geometry' in source && source.geometry && roof.blinds?.length) {
    const fitted=fitRepresentativeBlindPosts(source.geometry.assembly,roof.blinds);
    if(fitted) source={...source,geometry:fitted};
  }
  const finish = getRoofFinish(roof);
  if (finish.material === 'acrylic' || !('geometry' in source) || !source.geometry) return source;
  try {
    const geometry=buildRepresentativeRoofFinish(source.geometry.assembly, finish, { ...input, ...roof });
    const matched=roof.family==='mono'?matchRepresentativePitchedLedger(geometry.assembly):null;
    return { status: 'review_required' as const, messages: [], geometry: matched?{...geometry,...matched}:geometry };
  } catch (error) {
    return { status: 'invalid' as const, messages: [{ message: error instanceof Error ? error.message : 'This roof needs a closer look. Adjust your dimensions to continue.' }] };
  }
}

export function solveSimpleCoverSurroundings(input: SimpleCoverInput, assembly: Assembly3D, roof: PreviewRoofChoices = INITIAL_ROOF) {
  if (roof.family === 'box') return input.connection === 'fascia' ? null : buildRepresentativeBoxContext(assembly,{connection:input.connection,
    elevated:input.level==='elevated',soffitBracketCount:calculateSoffitBracketCountV1(input.widthMm)});
  if (roof.family === 'gable') return buildRepresentativeGableContext(assembly, { ...input, ...roof,
    elevated: input.level === 'elevated', soffitBracketCount: calculateSoffitBracketCountV1(input.widthMm) });
  return buildRepresentativeSurroundings(assembly, {
    connection: input.connection, elevated: input.level === 'elevated',
    soffitBracketCount: input.connection === 'soffit' ? calculateSoffitBracketCountV1(input.widthMm) : 0,
  });
}

export function solveSimpleCoverPreview(input: SimpleCoverInput) {
  const rafters = simpleCoverRafterLayout(input.widthMm);
  return solveCustomerConfigurationV1(configurationForSimpleCover(input), {
    projectId: 'configurator-preview', estimateId: 'configurator-preview', designRequestId: 'configurator-preview',
  }, {
    layout: {
      postCount: simpleCoverPostCount(input.widthMm),
      rafterCount: rafters.rafterCount,
      rafterSpacingMm: rafters.spacingMm,
      widthReference: 'outside_faces',
    },
  });
}
