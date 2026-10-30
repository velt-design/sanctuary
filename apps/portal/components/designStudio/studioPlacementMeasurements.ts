import { polygonEdges, segmentDistance } from '@/lib/designStudio/interaction/finitePlacement';

export type PlanPoint = {x: number; y: number};
export type SelectionVisibility = 'inside' | 'partial' | 'outside';
function pointToEdge(p: PlanPoint, a: PlanPoint, b: PlanPoint) {
  const x=b.x-a.x,y=b.y-a.y,length=x*x+y*y;
  const t=length?Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/length)):0;
  return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y);
}
/** Display-only distance. Near-parallel rotated edges must not acquire a false
 * intersection from cross-product cancellation. The movement helper is unchanged. */
function measuredEdges(a: {start:PlanPoint;end:PlanPoint},b: {start:PlanPoint;end:PlanPoint}) {
  const ax=a.end.x-a.start.x,ay=a.end.y-a.start.y,bx=b.end.x-b.start.x,by=b.end.y-b.start.y;
  const scale=Math.hypot(ax,ay)*Math.hypot(bx,by);
  return !scale||Math.abs(ax*by-ay*bx)<=scale*1e-12
    ?Math.min(pointToEdge(a.start,b.start,b.end),pointToEdge(a.end,b.start,b.end),pointToEdge(b.start,a.start,a.end),pointToEdge(b.end,a.start,a.end))
    :segmentDistance(a,b);
}
export function planOutlineSize(points: readonly PlanPoint[]) {
  if (!points.length || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  return {width: Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)), depth: Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))};
}

/** Boundary-to-boundary measurement only. It is not a 3D clearance or a connection. */
export function nearestPlanEdges(points: PlanPoint[], others: {label: string; points: PlanPoint[]}[]) {
  if (points.length < 2) return null;
  let nearest: {label: string; distance: number} | null = null;
  for (const other of others) {
    if (other.points.length < 2) continue;
    const distance = Math.min(...polygonEdges(points).flatMap(a => polygonEdges(other.points).map(b => measuredEdges(a,b))));
    if (Number.isFinite(distance) && (!nearest || distance < nearest.distance)) nearest = {label: other.label, distance};
  }
  return nearest;
}

export function planFrameVisibility(points: readonly PlanPoint[], frame: string): SelectionVisibility {
  const [x,y,width,height] = frame.split(' ').map(Number);
  if (!points.length || ![x,y,width,height].every(Number.isFinite) || width<=0 || height<=0 || points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))) return 'inside';
  // SVG's Y direction is opposite to the world; this reads the current frame only.
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
  const minY=Math.min(...points.map(p=>-p.y)),maxY=Math.max(...points.map(p=>-p.y));
  if(maxX<x || minX>x+width || maxY<y || minY>y+height)return 'outside';
  return minX<x || maxX>x+width || minY<y || maxY>y+height ? 'partial' : 'inside';
}
