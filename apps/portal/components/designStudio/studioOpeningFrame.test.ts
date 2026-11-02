import { expect, it } from 'vitest';
import { studioAttachmentFixture } from '../../../../test/studioAttachmentFixture';
import { createStudioSceneResolver } from '@/lib/designStudio/interaction/resolvedScene';
import { studioHouseScene } from '@/lib/designStudio/studioHouseScene';
import { updateStudioHouse, previewStudioAttachment } from '@/lib/designStudio/studioHouseCommands';
import { transformWebsitePoint } from '@/lib/designStudio/websiteComposition';
import { studioOpeningFrame, isLegacyStudioPlanOverview } from './studioOpeningFrame';
import {initialStudioPlanCamera} from './studioHousePlanFrame';

it.each([0,37,180])('frames the pergola with nearby large-house context at %s degrees without editing the scene', rotation=>{
  let edit=studioAttachmentFixture(rotation);
  const house=studioHouseScene(edit.site,edit.spatial)!.houses[0];
  edit=updateStudioHouse(edit,{...house,widthMm:'12000',depthMm:'8000'});
  edit=previewStudioAttachment(edit,{objectId:'p2',houseId:'house',edge:'rear',kind:'eave',method:'soffit'});
  const scene=createStudioSceneResolver().resolve(edit),raw=JSON.stringify(edit);
  const product=scene.products[0],physical=product.physical!.points.map(p=>transformWebsitePoint(p,product.position!));
  const overview=[...physical,...scene.houses.flatMap(h=>[...h.walls.flat(),...h.roof.flat()])];
  const initial=studioOpeningFrame(scene,overview);
  expect(initial.length).toBeLessThan(physical.length);
  const span=(points:typeof physical,axis:'x'|'y')=>Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis]));
  expect(span(initial,'x')).toBeLessThanOrEqual(span(physical,'x')+4000);
  expect(span(initial,'y')).toBeLessThanOrEqual(span(physical,'y')+4000);
  expect(initial.length).toBeGreaterThan(8);
  for(const point of physical)for(const axis of ['x','y','z'] as const){
    expect(point[axis]).toBeGreaterThanOrEqual(Math.min(...initial.map(p=>p[axis])));
    expect(point[axis]).toBeLessThanOrEqual(Math.max(...initial.map(p=>p[axis])));
  }
  expect(JSON.stringify(edit)).toBe(raw);
  expect(studioOpeningFrame({...scene,products:[]},overview)).toBe(overview);
});

it('recognizes the exact historic automatic Plan overview but retains manual pan/zoom and a deliberate current-policy overview',()=>{
 const points=[{x:0,y:0},{x:12000,y:8000}],old=initialStudioPlanCamera(points,{width:900,height:600});
 expect(isLegacyStudioPlanOverview(old,points)).toBe(true);
 expect(isLegacyStudioPlanOverview({...old,x:old.x+100},points)).toBe(false);
 expect(isLegacyStudioPlanOverview({...old,units:old.units*.8},points)).toBe(false);
 expect(isLegacyStudioPlanOverview({...old,framingPolicy:'pergola-context.v1'},points)).toBe(false);
 expect(isLegacyStudioPlanOverview({x:old.x,y:old.y,units:old.units},points)).toBe(false);
});
