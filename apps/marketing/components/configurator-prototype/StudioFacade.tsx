import type { RepresentativeSurroundings } from '@sp/geometry';
import Box from './ContextBoxMesh';
import StudioGlazing from './StudioGlazing';

/** Recess the illustrative slider in the existing solved opening; never move its wall or connection. */
export default function StudioFacade({ context }: { context: RepresentativeSurroundings }) {
  const { opening, frame, glazing } = context.architecture;
  const face = context.wall.max.y;
  const recess = 105;
  const shifted = (box: typeof opening) => ({ ...box, min: { ...box.min,y:box.min.y-recess }, max: { ...box.max,y:box.max.y-recess } });
  const reveal = (id: string, x1: number, z1: number, x2: number, z2: number) => ({ id,min:{x:x1,y:face-recess-50,z:z1},max:{x:x2,y:face+2,z:z2} });
  return <group name="studio-recessed-facade">
    {glazing.map(pane=><StudioGlazing key={pane.id} box={shifted(pane)}/>)}
    {frame.map(member=><Box key={member.id} box={shifted(member)} color="#343833"/>)}
    <Box box={reveal('opening-reveal-left',opening.min.x,opening.min.z,opening.min.x+18,opening.max.z)} color="#d1cabe"/>
    <Box box={reveal('opening-reveal-right',opening.max.x-18,opening.min.z,opening.max.x,opening.max.z)} color="#d1cabe"/>
    <Box box={reveal('opening-reveal-head',opening.min.x,opening.max.z-18,opening.max.x,opening.max.z)} color="#d1cabe"/>
    <Box box={reveal('stone-threshold',opening.min.x-20,opening.min.z+1,opening.max.x+20,opening.min.z+20)} color="#bcb6a9"/>
    <Box box={{id:"window-shadow-head",min:{x:opening.min.x-100,y:face+2,z:opening.max.z+85},max:{x:opening.max.x+100,y:face+24,z:opening.max.z+110}}} color="#c7c1b5"/>
  </group>;
}
