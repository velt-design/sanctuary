import { expect, it } from 'vitest';
import { prepareStudioCreation } from './createPreparation';
import { projectStudioAuthoringView, createStudioAuthoringEdit } from './authoringView';
import { createStudioSceneResolver } from './interaction/resolvedScene';
import { newStudioHousePosition } from './newHousePlacement';
import { applyStudioHouseEdit } from './houseEditing';
import { positionWebsitePergola } from './websiteComposition';

it.each([0,37,180])('places a new actual house outside the entire %s-degree physical product envelope without changing the pergola', rotation => {
 const prepared=prepareStudioCreation({mode:'blank',projectId:'10000000-0000-4000-8000-000000000001',designId:'new-test',commercialScopeId:null});if(!prepared.ok)throw Error(prepared.message);
 const view=projectStudioAuthoringView({authored:prepared.prepared.row.outputs.studio_authored,spatial:prepared.prepared.row.outputs.drawing_object_first});if(!view.ok)throw Error(view.message);
 let edit=createStudioAuthoringEdit(view.value);edit=positionWebsitePergola(edit,'initial-pergola',{originXMm:'12700',originYMm:'-3200',rotationDeg:String(rotation)});
 const before=structuredClone(edit),resolver=createStudioSceneResolver(),scene=resolver.resolve(edit),position=newStudioHousePosition(scene);
 const result=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'house',worldPosition:position});if(!result.ok)throw Error(result.message);
 const after=resolver.resolve({...edit,spatial:result.spatial});expect(after.houses).toHaveLength(1);expect(after.products).toHaveLength(1);
 const minY=Math.min(...scene.products[0].physical!.points.map(p=>scene.products[0].position!.y+p.x*Math.sin(rotation*Math.PI/180)+p.y*Math.cos(rotation*Math.PI/180)));
 expect(Math.max(...after.houses[0].footprint.map(p=>p.y))).toBeLessThanOrEqual(minY-1000);
 expect(Math.max(...after.houses[0].roof.flat().map(p=>p.y))).toBeLessThan(minY);
 expect(result.spatial.pergolas).toEqual(before.spatial.pergolas);expect(edit).toEqual(before);
});
