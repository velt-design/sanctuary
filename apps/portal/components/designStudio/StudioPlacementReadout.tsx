import {studioMillimetres} from '@/lib/designStudio/studioConnectionPresentation';
import {nearestPlanEdges,planOutlineSize,type PlanPoint,type SelectionVisibility} from './studioPlacementMeasurements';
import css from './StudioPlacement.module.css';

export type StudioPlacementSelection = {
  label:string; kind:'house'|'pergola'; local:PlanPoint[]; world:PlanPoint[];
  origin:PlanPoint; rotation:number; along?:number; reference?:boolean;
};
export default function StudioPlacementReadout({selection,others,preview,moving,visibility,view}: {
  selection:StudioPlacementSelection|null;others:{label:string;points:PlanPoint[]}[];
  preview:boolean;moving:boolean;visibility:SelectionVisibility;view:'3D'|'Plan';
}) {
  if(!selection)return null;
  const size=planOutlineSize(selection.local),nearest=nearestPlanEdges(selection.world,others);
  return <aside className={css.readout} aria-label="Selected placement measurements">
    <strong>{selection.label} · {selection.reference?'Retained reference':preview?'Proposed placement':'Applied placement'}</strong>
    {size&&<span>{selection.kind==='house'?'Wall footprint':'Roof Plan outline'}: {studioMillimetres(size.width)} × {studioMillimetres(size.depth)}</span>}
    <span>Object origin: X {studioMillimetres(selection.origin.x)} · Y {studioMillimetres(selection.origin.y)} · {selection.rotation.toLocaleString('en-NZ',{maximumFractionDigits:1})}°</span>
    {selection.along!==undefined&&<span>Along house edge: {studioMillimetres(selection.along)} offset</span>}
    {!moving&&!selection.reference&&nearest&&<span>Closest Plan edges to {nearest.label}: {studioMillimetres(nearest.distance)} <small>(boundary separation, not 3D clearance)</small></span>}
    {moving&&<span>Moving footprint is a preview. These measurements describe the stationary model.</span>}
    <small>World origin is (0, 0). +X right, +Y up in Plan.</small>
    {visibility!=='inside'?<p role="status">{selection.label}{view==='3D'?' selection bounds are':' is'} {visibility==='partial'?'partly outside':'outside'} this {view} view. {view==='3D'?'Zoom out (−), or use Plan and pan to locate it.':'Zoom out (−) or right-drag to pan toward its X/Y position.'} The camera stays where you left it.</p>:<small>{view==='Plan'?'Wheel or ± to zoom · right-drag to pan':'Drag to orbit · wheel or ± to zoom · use Plan for placement'}</small>}
  </aside>;
}
