import type { Assembly3D } from '@sp/geometry';
import type { StudioHouse, HouseSide } from '@/lib/designStudio/studioHouseScene';
import { studioWebsiteBrackets } from '@/lib/designStudio/studioHouseWebsiteBrackets';
import { transformWebsitePoint } from '@/lib/designStudio/websiteComposition';

/** Frame the real end bracket and its wall/ledger contacts; never change geometry. */
export function connectionView(house:StudioHouse,side:HouseSide,assembly:Assembly3D,pose:{x:number;y:number;rotation:number},width:number){
 const bracket=studioWebsiteBrackets(house,side,assembly,pose,width)[0];
 const vertices=[bracket.startX,bracket.endX].flatMap(x=>bracket.section.map(p=>({x,y:p.y,z:p.z})));
 const low={x:Math.min(...vertices.map(p=>p.x))-100,y:Math.min(...vertices.map(p=>p.y))-100,z:Math.min(...vertices.map(p=>p.z))-120};
 const high={x:Math.max(...vertices.map(p=>p.x))+100,y:Math.max(...vertices.map(p=>p.y))+100,z:Math.max(...vertices.map(p=>p.z))+180};
 const points=[low.x,high.x].flatMap(x=>[low.y,high.y].flatMap(y=>[low.z,high.z].map(z=>transformWebsitePoint({x,y,z},pose))));
 const r=pose.rotation*Math.PI/180;
 return {points,direction:{x:-Math.cos(r)-.35*Math.sin(r),y:-Math.sin(r)+.35*Math.cos(r),z:.08},vertices:vertices.map(p=>transformWebsitePoint(p,pose))};
}
