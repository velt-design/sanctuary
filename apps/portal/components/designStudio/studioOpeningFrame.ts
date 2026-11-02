import type { Point3 } from '@sp/geometry';
import type { ResolvedStudioScene } from '@/lib/designStudio/interaction/resolvedScene';
import { transformWebsitePoint } from '@/lib/designStudio/websiteComposition';
import {initialStudioPlanCamera, type StudioPlanCamera} from './studioHousePlanFrame';

export const STUDIO_OPENING_FRAME = 'pergola-context.v1';

function productFramePoints(scene:ResolvedStudioScene):Point3[] {
  return scene.products.flatMap((p) => {
        if (!p.geometry || !p.position) return [];
        const local =
          p.physical?.points ??
          p.geometry.assembly.members.flatMap((m) => [
            m.centerline.start,
            m.centerline.end,
          ]);
        const bound = local.reduce(
          (a, v) => ({
            minX: Math.min(a.minX, v.x),
            minY: Math.min(a.minY, v.y),
            minZ: Math.min(a.minZ, v.z),
            maxX: Math.max(a.maxX, v.x),
            maxY: Math.max(a.maxY, v.y),
            maxZ: Math.max(a.maxZ, v.z),
          }),
          {
            minX: Infinity,
            minY: Infinity,
            minZ: Infinity,
            maxX: -Infinity,
            maxY: -Infinity,
            maxZ: -Infinity,
          },
        );
        return [bound.minX, bound.maxX].flatMap((x) =>
          [bound.minY, bound.maxY].flatMap((y) =>
            [bound.minZ, bound.maxZ].map((z) =>
              transformWebsitePoint({ x, y, z }, p.position!),
            ),
          ),
        );
      });
}

export function studioCameraFrames(scene:ResolvedStudioScene){
  const products=productFramePoints(scene);
  const points=[...scene.houses.flatMap(h=>h.walls.flat()),...scene.houses.flatMap(h=>h.roof.flat()),...products];
  return {points,openingPoints:studioOpeningFrame(scene,points,products)};
}

export function isLegacyStudioPlanOverview(saved:StudioPlanCamera & {framingPolicy?:unknown},points:ReadonlyArray<{x:number;y:number}>){
  if(saved.framingPolicy || !saved.viewport)return false;
  const old=initialStudioPlanCamera(points,saved.viewport);
  return (['x','y','units'] as const).every(axis=>Math.abs(saved[axis]-old[axis])<=Math.max(1e-6,Math.abs(old[axis])*1e-9));
}

/** Camera guides only. Render the complete scene, but frame the pergolas and
 * the nearby part of their surroundings on first open. Fit remains an overview. */
export function studioOpeningFrame(scene: ResolvedStudioScene, overview: Point3[], products=productFramePoints(scene)): Point3[] {
  if (!products.length) return overview;
  const bounds = (axis: 'x' | 'y' | 'z') => [Math.min(...products.map(p => p[axis])), Math.max(...products.map(p => p[axis]))];
  const [minX, maxX] = bounds('x'), [minY, maxY] = bounds('y'), [minZ, maxZ] = bounds('z');
  const gap = Math.max(800, Math.min(2000, Math.max(maxX-minX, maxY-minY)*.2));
  const near = scene.houses.filter(h => h.footprint.some(p => p.x >= minX-gap && p.x <= maxX+gap && p.y >= minY-gap && p.y <= maxY+gap)
    || (Math.min(...h.footprint.map(p=>p.x)) <= maxX+gap && Math.max(...h.footprint.map(p=>p.x)) >= minX-gap
      && Math.min(...h.footprint.map(p=>p.y)) <= maxY+gap && Math.max(...h.footprint.map(p=>p.y)) >= minY-gap));
  const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
  return [...products, ...near.flatMap(h => [...h.walls.flat(), ...h.roof.flat()].map(p=>({
    x:clamp(p.x,minX-gap,maxX+gap), y:clamp(p.y,minY-gap,maxY+gap), z:clamp(p.z,minZ,maxZ+800),
  })))];
}
