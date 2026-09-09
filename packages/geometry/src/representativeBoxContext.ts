import type { Assembly3D } from './contracts';
import { buildRepresentativeSurroundings } from './representativeSurroundings';

export function buildRepresentativeBoxContext(assembly:Assembly3D,options:{connection:'facade'|'soffit';elevated:boolean;soffitBracketCount:number}) {
  const context=buildRepresentativeSurroundings(assembly,options);
  if(context && options.connection==='soffit') {
    // The 300mm box needs the representative L's arm below its underside.
    for(const bracket of context.brackets) {
      for(const i of [0,1]) bracket.section[i].z=context.ledger.bottomZ-120;
      for(const i of [4,5]) bracket.section[i].z=context.ledger.bottomZ-80;
    }
  }
  return context;
}
