import {solveStudioHouse} from '@/lib/designStudio/studioHouseGeometry';
import type {StudioHouse} from '@/lib/designStudio/studioHouseScene';

/** Display the actual solved roof, without introducing an implicit wall-follow rule. */
export function studioHouseHeightNotice(house:StudioHouse){
 try{
  const roof=solveStudioHouse(house).roof.flat();
  const lowestRoofEdgeMm=Math.min(...roof.map(p=>p.z));
  if(!Number.isFinite(lowestRoofEdgeMm))return null;
  const height=lowestRoofEdgeMm.toLocaleString('en-NZ',{maximumFractionDigits:1});
  return {lowestRoofEdgeMm,text:`Lowest roof edge: ${height} mm. Wall and eave heights are independent. ${house.eaveHeightMm?'Changing the wall height keeps this roof height.':'The blank eave field uses the current default. Enter an eave height to change the roof.'}${Number(house.wallHeightMm)>lowestRoofEdgeMm?' The wall is above the lowest roof edge; check both heights before applying.':''}`};
 }catch{return null;}
}
