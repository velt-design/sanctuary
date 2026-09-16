import {useId} from 'react';
import type { RoofFinishGeometry, RoofFinishMesh } from '@sp/geometry';

// Project the same finish surfaces used in 3D. No separate board/profile spacing rules.
export function projectedFinishFaces(mesh: RoofFinishMesh) {
  const faces: { points: string; shade: number }[] = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = mesh.indices.slice(i, i + 3).map(index => mesh.positions.slice(index * 3, index * 3 + 3));
    const [a, b, c] = points;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nz = ux * vy - uy * vx;
    if (Math.abs(nz) < .01) continue;
    const normal = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, nz);
    faces.push({ points: points.map(p => `${p[0]},${p[1]}`).join(' '), shade: Math.abs(nz) / normal });
  }
  return faces;
}

export default function PlanFinishes({ covering, reflected, scale=1, profile='corrugated', trayWidth=400, fall }: { covering?: RoofFinishGeometry; reflected: boolean; scale?:number; profile?:string; trayWidth?:number; fall?:{x:number;y:number} }) {
  const pattern=useId();
  if (!covering) return null;
  // roof-edges contains the ceiling backing sheet, which would obscure the steel from above.
  const meshes = covering.meshes.filter(m => reflected ? m.kind === 'cedar' : m.id.startsWith('edge-flashings-'))
    .sort((a, b) => Number(a.kind === 'flashing') - Number(b.kind === 'flashing'));
  const pitch=Math.max(profile==='tray'?trayWidth:profile==='trapezoidal'?154:76.2, (profile==='tray'?12:7)/scale);
  const angle=fall?Math.atan2(fall.y,fall.x)*180/Math.PI-90:0;
  return <g data-plan-finishes={reflected ? 'ceiling' : 'roof'} pointerEvents="none">
    <defs><pattern id={pattern} width={pitch} height={pitch} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
      <rect width={pitch} height={pitch} fill="#b4c0bc"/>
      <path d={`M 0 0 V ${pitch}`} stroke="#697c74" strokeWidth={.9/scale}/>
      {profile!=='corrugated'&&<path d={`M ${2/scale} 0 V ${pitch}`} stroke="#81928a" strokeWidth={.5/scale}/>}
    </pattern></defs>
    {covering.regions.filter(region => region.material === 'solid').map(region => <polygon key={region.id} data-roof-region={region.material}
      points={region.boundary.map(p => `${p.x},${p.y}`).join(' ')}
      fill={reflected ? '#c8c2af' : `url(#${pattern})`} stroke={reflected?'none':'#65756c'} strokeWidth={.8/scale}
      fillOpacity={region.material === 'solid' ? 1 : .65} />)}
    {meshes.map(mesh => <g key={mesh.id} data-finish-mesh={mesh.kind}>
      {projectedFinishFaces(mesh).map((face, i) => <polygon key={i} points={face.points}
        fill={mesh.kind === 'cedar' ? '#e2ddcc' : '#97a79f'} />)}
    </g>)}
    {covering.battenBoundaries?.map((boundary, i) => <polygon key={i} data-roof-batten
      points={boundary.map(p => `${p.x},${p.y}`).join(' ')} fill="#bb9871" fillOpacity={reflected ? 1 : .65} />)}
  </g>;
}
