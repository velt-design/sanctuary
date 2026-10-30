import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {nearestPlanEdges,planFrameVisibility,planOutlineSize} from './studioPlacementMeasurements';
import StudioPlacementReadout from './StudioPlacementReadout';
import {transformWebsitePoint} from '@/lib/designStudio/websiteComposition';

const outline=[{x:0,y:0},{x:6000,y:0},{x:6000,y:3000},{x:0,y:3000}];
it('measures local resolved size independently from rotated world pose and finite adjacent edges',()=>{
 const pose={x:1300,y:-400,rotation:37},world=outline.map(p=>transformWebsitePoint(p,pose));
 const adjacent=outline.map(p=>transformWebsitePoint({x:p.x+6500,y:p.y},pose));
 expect(planOutlineSize(outline)).toEqual({width:6000,depth:3000});
 expect(nearestPlanEdges(world,[{label:'Pergola 2 roof outline',points:adjacent}])!.distance).toBeCloseTo(500,8);
 const html=renderToStaticMarkup(<StudioPlacementReadout selection={{label:'Pergola 1',kind:'pergola',local:outline,world,origin:pose,rotation:37,along:450}} others={[{label:'Pergola 2 roof outline',points:adjacent}]} preview moving={false} visibility="outside" view="Plan"/>);
 expect(html).toContain('Proposed placement');expect(html).toContain('6,000 mm');expect(html).toContain('X 1,300 mm');expect(html).toContain('450 mm offset');expect(html).toContain('500 mm');expect(html).toContain('not 3D clearance');expect(html).toContain('right-drag');expect(html).not.toContain('<button');
});
it('reads world Y against the exact current Plan frame without changing it or the outlines',()=>{
 const copy=structuredClone(outline),frame='-100 -3100 6200 3200';
 expect(planFrameVisibility(outline,frame)).toBe('inside');
 expect(planFrameVisibility(outline.map(p=>({...p,y:p.y+10000})),frame)).toBe('outside');
 expect(planFrameVisibility(outline.map(p=>({...p,x:p.x+10000})),frame)).toBe('outside');
 expect(outline).toEqual(copy);expect(frame).toBe('-100 -3100 6200 3200');
});
it('distinguishes clipping at every Plan edge and removes the cue after manual pan or zoom',()=>{
 const frame='-100 -3100 6200 3200';
 for(const [dx,dy] of [[-200,0],[200,0],[0,-200],[0,200]]){
  const points=outline.map(p=>({x:p.x+dx,y:p.y+dy}));
  expect(planFrameVisibility(points,frame)).toBe('partial');
  expect(planFrameVisibility(points,`${-100+dx} ${-3100-dy} 6200 3200`)).toBe('inside');
 }
 // A large selection surrounding the whole frame is clipped, not fully outside.
 expect(planFrameVisibility(outline,'1000 -2000 4000 1000')).toBe('partial');
 expect(planFrameVisibility(outline,'0 -3000 6000 3000')).toBe('inside');
 const points=outline.map(p=>({...p,x:p.x+200}));
 const render=(currentFrame:string)=>renderToStaticMarkup(<StudioPlacementReadout selection={{label:'Pergola 2',kind:'pergola',local:outline,world:points,origin:{x:200,y:0},rotation:0}} others={[]} preview={false} moving={false} visibility={planFrameVisibility(points,currentFrame)} view="Plan"/>);
 expect(render(frame)).toContain('Pergola 2 is partly outside this Plan view.');
 expect(render(frame)).toContain('right-drag to pan');
 expect(render('-500 -3500 7000 4000')).not.toContain('role="status"');
 expect(planFrameVisibility([],frame)).toBe('inside');
 expect(planFrameVisibility(outline,'unavailable')).toBe('inside');
});
it('does not call retained or drag-reference measurements current clearance',()=>{
 const html=renderToStaticMarkup(<StudioPlacementReadout selection={{label:'Pergola 1',kind:'pergola',local:outline,world:outline,origin:{x:0,y:0},rotation:0,reference:true}} others={[{label:'Other',points:outline}]} preview={false} moving visibility="inside" view="3D"/>);
 expect(html).toContain('Retained reference');expect(html).toContain('stationary model');expect(html).not.toContain('Closest Plan edges');
 expect(nearestPlanEdges([],[])).toBeNull();expect(planOutlineSize([])).toBeNull();
});

it('measures parallel, nearly parallel, crossing and touching finite boundaries without an infinite-line shortcut',()=>{
 const edge=[{x:0,y:0},{x:1000,y:0}];
 expect(nearestPlanEdges(edge,[{label:'parallel',points:[{x:0,y:25},{x:1000,y:25}]}])!.distance).toBe(25);
 expect(nearestPlanEdges(edge,[{label:'near parallel',points:[{x:0,y:25},{x:1000,y:25+1e-10}]}])!.distance).toBeCloseTo(25,8);
 expect(nearestPlanEdges(edge,[{label:'past endpoint',points:[{x:1300,y:400},{x:1300,y:800}]}])!.distance).toBe(500);
 expect(nearestPlanEdges(edge,[{label:'crossing',points:[{x:500,y:-20},{x:500,y:20}]}])!.distance).toBe(0);
 expect(nearestPlanEdges(edge,[{label:'overlapping',points:[{x:500,y:0},{x:1500,y:0}]}])!.distance).toBe(0);
});
