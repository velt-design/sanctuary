type XY = {x:number;y:number};
/** Look from the products toward their context house, rather than through it. */
export function studioCompositionOverview(products:XY[],house:XY[],obliqueDegrees=15){
 if(!products.length||!house.length)return undefined;
 const centre=(points:XY[])=>points.reduce((sum,p)=>({x:sum.x+p.x/points.length,y:sum.y+p.y/points.length}),{x:0,y:0});
 const p=centre(products),h=centre(house),dx=p.x-h.x,dy=p.y-h.y,length=Math.hypot(dx,dy);
 if(!Number.isFinite(length)||length<1)return undefined;
 // A small oblique angle reveals side faces while keeping the house behind.
 const angle=obliqueDegrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 return {x:(dx*c-dy*s)/length,y:(dx*s+dy*c)/length,z:.65};
}
