import {prepareStudioCreation} from '../../apps/portal/lib/designStudio/createPreparation';
import {projectStudioAuthoringView,createStudioAuthoringEdit} from '../../apps/portal/lib/designStudio/authoringView';
import {addWebsitePergola} from '../../apps/portal/lib/designStudio/websiteComposition';
import {applyStudioHouseEdit} from '../../apps/portal/lib/designStudio/houseEditing';
import type {StudioWebsiteDesign} from '../../apps/portal/lib/designStudio/websiteDesign';
/** Synthetic source only. It is never a live project or inferred site survey. */
export function studioClientDocumentFixture(){
 const made=prepareStudioCreation({mode:'blank',projectId:'proj_10000000-0000-4000-8000-000000000001',designId:'document-fixture',commercialScopeId:null});if(!made.ok)throw Error(made.message);
 const initial=made.prepared.row.outputs,view=projectStudioAuthoringView({authored:initial.studio_authored,spatial:initial.drawing_object_first});if(!view.ok)throw Error(view.message);
 const edit=addWebsitePergola(addWebsitePergola(createStudioAuthoringEdit(view.value),'p1'),'p2');
 const house=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'house'});if(!house.ok)throw Error(house.message);edit.spatial=house.spatial;
 edit.spatial.houseAssembly!.houseForms[0].position={originXMm:'0',originYMm:'-5000',rotationDeg:'0'};
 const primitive=edit.spatial.houseAssembly!.houseForms[0].composition.primitives[0];if(primitive.kind!=='axisAlignedRectangle')throw Error('Expected rectangle');Object.assign(primitive,{originXMm:0,originYMm:0,widthMm:6000,depthMm:4000});
 const first=edit.objectOptions[0].values.websiteDesign as unknown as StudioWebsiteDesign,second=edit.objectOptions[1].values.websiteDesign as unknown as StudioWebsiteDesign;
 first.rawDimensions={widthMm:'6000',projectionMm:'4000'};first.selection.roof.attachmentIntent='freestanding';first.supportDatumMm='2400';first.selection.roof.frameFinish='black';
 first.selection.roof.finish={material:'combination',profile:'corrugated',trayWidth:400,ceiling:'cedar-100',layout:'central',acrylicBays:2};
 second.rawDimensions={widthMm:'4000',projectionMm:'3000'};second.selection.roof={...second.selection.roof,family:'gable',attachmentIntent:'freestanding',frameFinish:'white',finish:{material:'solid',profile:'corrugated',trayWidth:400,ceiling:'thermopine-150',layout:'central',acrylicBays:2}};
 second.supportDatumMm='2600';edit.spatial.pergolas[1].family='gable';
 edit.spatial.pergolas[0].label='Test pergola 1';edit.spatial.pergolas[1].label='Test pergola 2';
 return edit;
}
