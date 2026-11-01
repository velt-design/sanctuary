import { expect, it } from 'vitest';
import { studioAttachmentFixture } from '../../../../test/studioAttachmentFixture';
import { studioHouseScene } from './studioHouseScene';
import { createStudioSceneResolver } from './interaction/resolvedScene';
import { updateStudioHouse } from './studioHouseCommands';
import { parseStudioAuthoringEdit } from './authoringView';
import { studioComputedCoordinate } from './studioHouseCoordinates';
import { houseNumber } from './studioHouseGeometry';
import { applyStudioHouseEdit } from './houseEditing';

it.each([-180,-90,90,180,270,360])('retains a genuine canonical house at raw origin zero and rotation %s', rotation=>{
 const edit=studioAttachmentFixture(),source=edit.spatial.houseAssembly!.houseForms[0];
 source.position={originXMm:'0',originYMm:'0',rotationDeg:String(rotation)};
 expect(parseStudioAuthoringEdit(edit).ok).toBe(true);
 const scene=createStudioSceneResolver().resolve(edit);
 expect(scene.houseRecords[0].error).toBeNull();expect(scene.houses).toHaveLength(1);
 expect(scene.houses[0].footprint.every(p=>[p.x,p.y,p.z].every(Number.isFinite))).toBe(true);
});
it('preserves the exact finite number at the existing string boundary, including subnormal values and the existing negative-zero policy',()=>{
 for(const value of [0,-0,1,-1,4.898587196589413e-13,-2.4492935982947065e-13,Number.MIN_VALUE,-Number.MIN_VALUE,1e-7,1e21,-1.2345678901234568e25,Number.MAX_VALUE]) {
  const text=studioComputedCoordinate(value);expect(text).toMatch(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/);expect(Number(text)).toBe(value===0?0:value);
 }
 expect(studioComputedCoordinate(-0)).toBe('0');
 for(const value of [NaN,Infinity,-Infinity])expect(()=>studioComputedCoordinate(value)).toThrow('finite');
});
it('retains strict user input, finite checks and existing range guards',()=>{
 const edit=studioAttachmentFixture();
 for(const raw of ['1e3','NaN','Infinity','', 'not a coordinate']) {
  expect(()=>houseNumber(raw,'house position')).toThrow();
  expect(applyStudioHouseEdit(edit.spatial,{kind:'move',houseFormId:'house',position:{originXMm:raw,originYMm:'0',rotationDeg:'0'}}).ok).toBe(false);
 }
 expect(()=>houseNumber(studioComputedCoordinate(1e8),'house position')).toThrow();
});
it('keeps a valid very small decimal rotation usable after deriving its display pose',()=>{
 const edit=studioAttachmentFixture();edit.spatial.houseAssembly!.houseForms[0].position={originXMm:'0',originYMm:'0',rotationDeg:'0.0000000001'};
 const scene=createStudioSceneResolver().resolve(edit);expect(scene.houses).toHaveLength(1);expect(scene.houseRecords[0].error).toBeNull();
 expect(Number(scene.houses[0].house.position.rotationDeg)).toBe(1e-10);
});
it('retains a new house with a finite tiny derived origin without exponent text in its authored pose',()=>{
 const edit=studioAttachmentFixture(),before=structuredClone(edit);
 const defaults=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'new-house'});if(!defaults.ok)throw Error(defaults.message);
 const primitive=defaults.spatial.houseAssembly!.houseForms.find(h=>h.id==='new-house')!.composition.primitives[0];if(primitive.kind!=='axisAlignedRectangle')throw Error('Expected actual new-house rectangle');
 const x=primitive.originXMm+1e-10;
 const result=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'new-house',worldPosition:{x,y:primitive.originYMm}});if(!result.ok)throw Error(result.message);
 const scene=createStudioSceneResolver().resolve({...edit,spatial:result.spatial}),record=scene.houseRecords.find(h=>h.id==='new-house');
 expect(record?.error).toBeNull();expect(scene.houses).toHaveLength(2);expect(Number(scene.houses.find(h=>h.house.id==='new-house')!.house.position.xMm)).toBe(x);expect(edit).toEqual(before);
});
it.each([-180,-90,90,180,270,360])('updates a valid world-axis position at rotation %s without rejecting internal trig output',rotation=>{
 const edit=studioAttachmentFixture(),before=structuredClone(edit),house=studioHouseScene(edit.site,edit.spatial)!.houses[0];
 const next=updateStudioHouse(edit,{...house,position:{xMm:'0',yMm:'-4000',rotationDeg:String(rotation)}});
 const scene=createStudioSceneResolver().resolve(next);expect(scene.houses).toHaveLength(1);expect(scene.houseRecords[0].error).toBeNull();
 expect(Number(scene.houses[0].house.position.xMm)).toBeCloseTo(0,9);expect(Number(scene.houses[0].house.position.yMm)).toBeCloseTo(-4000,9);
 expect(next.spatial.pergolas).toEqual(edit.spatial.pergolas);expect(edit).toEqual(before);
});
