import { PerspectiveCamera, Vector3 } from 'three';
import type { Point3 } from '@sp/geometry';
import type { SceneBounds } from '@sp/geometry-viewer';

/** Shared by fitting and conservative recognition of an old automatic Studio
 * fit. This is projection math only; it never changes scene geometry. */
export function perspectiveFitDistance(camera: PerspectiveCamera, fitPoints: Point3[], oldDistance: number, paddingX: number, paddingY: number, padding: number) {
      const tanY = Math.tan((camera.fov * Math.PI) / 360);
      let distance = 1000;
      for (const p of fitPoints) {
        const point = new Vector3(p.x, p.y, p.z).applyMatrix4(
          camera.matrixWorldInverse,
        );
        const depth = point.z + oldDistance;
        distance = Math.max(
          distance,
          depth +
            Math.abs(point.x) / (tanY * camera.aspect * paddingX * padding),
          depth + Math.abs(point.y) / (tanY * paddingY * padding),
        );
      }
      return distance;
}

export type StudioOpeningFit = { policy: string; overviewBounds: SceneBounds; overviewPoints: Point3[] };

/** Old records contain no input provenance. Migrate only the exact automatic
 * overview at the same drawable aspect, never an unknown/panned/zoomed pose. */
export function isLegacyStudioOverview(saved: {position:number[];target:number[];fov:number;zoom?:number;viewport?:{aspect:number;zoom:number}}, opening: StudioOpeningFit, direction: Point3 | undefined, size:{width:number;height:number}, padding:number, surroundings:boolean) {
  if(!direction || saved.fov!==24 || (saved.zoom??1)!==1 || (saved.viewport?.zoom??1)!==1) return false;
  const near=(a:number,b:number)=>Math.abs(a-b)<=Math.max(1e-6,Math.abs(b)*1e-9);
  const aspect=size.width/size.height;
  if(saved.viewport&&!near(saved.viewport.aspect,aspect))return false;
  const bounds=opening.overviewBounds,centre=new Vector3(bounds.center.x,bounds.center.y,bounds.center.z);
  if(!saved.target.every((v,i)=>near(v,centre.getComponent(i))))return false;
  const camera=new PerspectiveCamera(24,aspect),normal=new Vector3(direction.x,direction.y,direction.z).normalize();
  camera.up.set(0,0,1);camera.position.copy(centre).addScaledVector(normal,bounds.size*3);camera.lookAt(centre);camera.updateMatrixWorld();
  const distance=perspectiveFitDistance(camera,opening.overviewPoints,bounds.size*3,.97,Math.max(.5,(size.height-(size.height<320?16:40))/size.height)*(surroundings ? .9 : 1),padding);
  const expected=centre.addScaledVector(normal,distance);
  return saved.position.every((v,i)=>near(v,expected.getComponent(i)));
}
