import {applyHouseReferencePosition,buildHouseReferenceProjectionShape} from '@sp/geometry';
import {buildWorkbenchProjectModelFromObjectFirstDraft,type ObjectFirstWorkbenchDraftVNext} from '../drawings/state/objectFirstWorkbenchModel';
import {buildProjectHouseGeometryRegistry,type ProjectHouseGeometryEntry} from '../drawings/state/projectHouseGeometryRegistry';
/** Studio's exact pose boundary. The canonical composition/roof solver is unchanged;
 * existing workbench transform-only writers keep their established semantics. */
export function buildStudioHouseGeometryRegistry(spatial:ObjectFirstWorkbenchDraftVNext):ProjectHouseGeometryEntry[]{
 return (spatial.houseAssembly?.houseForms??[]).flatMap(source=>{
  const form=structuredClone(source);form.transform={offsetXM:0,offsetYM:0,rotationQuarterTurns:0};delete form.position;
  const raw=source.position,values=raw?[raw.originXMm,raw.originYMm,raw.rotationDeg].map(v=>v.trim()===''?NaN:Number(v)):[source.transform.offsetXM*1000,source.transform.offsetYM*1000,source.transform.rotationQuarterTurns*90];
  if(values.some(v=>!Number.isFinite(v)))return [];
  const position={origin:{x:values[0],y:values[1]},rotationDeg:values[2]};
  const entry=buildProjectHouseGeometryRegistry(buildWorkbenchProjectModelFromObjectFirstDraft({...spatial,pergolas:[],houseAssembly:{...spatial.houseAssembly!,houseForms:[form]}}))[0];if(!entry)return [];
  const geometry=applyHouseReferencePosition(entry.geometry,position),model=geometry.model;if(!model)return [];
  const referenceShape=buildHouseReferenceProjectionShape({house:geometry,houseSourceId:source.id});if(!referenceShape)return [];
  return [{...entry,geometry,model,referenceShape,rawHouseInput:{...entry.rawHouseInput,position}}];
 });
}
