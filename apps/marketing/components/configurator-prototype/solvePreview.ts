import { solveCustomerConfigurationV1 } from '@sp/configurator/geometry';
import { calculateSoffitBracketCountV1 } from '@sp/costing';
import { buildRepresentativeSurroundings, buildRepresentativeGable, buildRepresentativeGableContext, buildRepresentativeBox, buildRepresentativeBoxContext, type Assembly3D } from '@sp/geometry';
import { simpleCoverPostCount, simpleCoverRafterLayout, type SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import { configurationForSimpleCover } from './model';
import { INITIAL_ROOF, type PreviewRoofChoices } from './GableChoices';

export function solvePergolaPreview(input: SimpleCoverInput, roof: PreviewRoofChoices = INITIAL_ROOF) {
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
