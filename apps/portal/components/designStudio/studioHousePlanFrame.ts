/** Explicit world-to-Plan projection: world +Y is up, SVG +Y is down. */
export function studioPlanPoint<T extends {x:number;y:number}>(point:T):T{return {...point,x:point.x,y:-point.y};}
export type StudioPlanCamera={x:number;y:number;units:number};
export function initialStudioPlanCamera(points:ReadonlyArray<{x:number;y:number}>,viewport:{width:number;height:number}):StudioPlanCamera{
 const [x,y,w,h]=captureStudioHousePlanFrame(points.map(studioPlanPoint),viewport).split(' ').map(Number);
 return {x:x+w/2,y:y+h/2,units:Math.max(w/viewport.width,h/viewport.height)};
}
export function studioPlanViewBox(camera:StudioPlanCamera,viewport:{width:number;height:number}):string{
 const w=viewport.width*camera.units,h=viewport.height*camera.units;
 return [camera.x-w/2,camera.y-h/2,w,h].join(' ');
}
/** Legacy explicit-fit helper. Persistent Studio cameras capture this only once. */
export function captureStudioHousePlanFrame(points:ReadonlyArray<{x:number;y:number}>,viewport?:{width:number;height:number}):string{
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const x=Math.min(-1000,...xs)-1200,y=Math.min(-1000,...ys)-1200;
 const width=Math.max(6000,...xs)-x+1200,height=Math.max(3000,...ys)-y+1200;
 if(!viewport||viewport.width<=0||viewport.height<=0)return [x,y,width,height].join(' ');
 // Screen-readable target labels need real pixel clearance, especially on a
 // tall joined arrangement in the narrower tablet drawable rectangle.
 const marginX=Math.min(96,viewport.width*.2),marginY=Math.min(40,viewport.height*.15);
 const units=Math.max(width/(viewport.width-2*marginX),height/(viewport.height-2*marginY));
 return [x-marginX*units,y-marginY*units,width+2*marginX*units,height+2*marginY*units].join(' ');
}
