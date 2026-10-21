import { buildSoffitBracketSections, type Assembly3D, type Point3 } from '@sp/geometry';
import { calculateSoffitBracketCountV1 } from '@sp/costing';
import { boxedHouseSoffits } from './studioHouseWebsiteContact';
import { solveStudioHouse } from './studioHouseGeometry';
import { websiteConnectionEdge } from './websiteConnectionEdge';
import type { StudioHouse, HouseSide } from './studioHouseScene';

/** Website support detail against actual canonical surfaces, not a fixing schedule. */
export function studioWebsiteBrackets(house: StudioHouse, side: HouseSide, assembly: Assembly3D, pose: {x:number;y:number;rotation:number}, widthMm: number) {
  const surface = boxedHouseSoffits(solveStudioHouse(house)).find(s => s.side === side);
  if (!surface) throw Error('No level boxed soffit surface supports this detail.');
  const r = -pose.rotation * Math.PI / 180;
  const local = (p: Point3) => ({x:(p.x-pose.x)*Math.cos(r)-(p.y-pose.y)*Math.sin(r),y:(p.x-pose.x)*Math.sin(r)+(p.y-pose.y)*Math.cos(r),z:p.z});
  const points = surface.world.map(local), edge = websiteConnectionEdge(assembly);
  const soffitZ = points[0].z, bottomZ = edge.start.z, backY = edge.start.y;
  const startX = Math.min(edge.start.x, edge.end.x), endX = Math.max(edge.start.x, edge.end.x), wallY = Math.min(...points.map(p => p.y));
  const count = calculateSoffitBracketCountV1(widthMm);
  if(bottomZ<=soffitZ)throw Error(`The ledger underside is ${Math.round(soffitZ-bottomZ)} mm below this soffit. The website bracket detail cannot meet both surfaces. Choose another compatible connection.`);
  if (points.some(p => Math.abs(p.z-soffitZ)>1e-5) || Math.abs(edge.end.y-backY)>1e-5 || Math.abs(edge.end.z-bottomZ)>1e-5 || bottomZ<=soffitZ || wallY>=backY || endX-startX<=40 || count<2) throw Error('This actual house and ledger cannot form the website soffit support detail.');
  return buildSoffitBracketSections({startX,endX,wallY,backY,soffitZ,ledgerBottomZ:bottomZ,count});
}
