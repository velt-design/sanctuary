import {act,useState} from 'react';
import {PerspectiveCamera} from 'three';
import {expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
const frames=vi.hoisted(()=>({run:null as null|((state:any)=>void)}));
vi.mock('@react-three/fiber',()=>({useFrame:(fn:any)=>{frames.run=fn;}}));
import StudioSelectionVisibility from './StudioSelectionVisibility';
import StudioPlacementReadout from './StudioPlacementReadout';
import type {SelectionVisibility} from './studioPlacementMeasurements';

it('observes actual camera frustum transitions without mutating pose, projection or input objects',()=>{
 const camera=new PerspectiveCamera(45,1,1,10000);camera.position.set(0,0,1000);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const before=camera.toJSON(),points=[{x:-10,y:-10,z:0},{x:10,y:10,z:20}],copy=structuredClone(points),change=vi.fn();
 const mounted=renderIntoDocument(<StudioSelectionVisibility points={points} onChange={change}/>);
 act(()=>{frames.run!({camera});frames.run!({camera});});expect(change.mock.calls).toEqual([['inside']]);expect(camera.toJSON()).toEqual(before);expect(points).toEqual(copy);
 // The 45-degree camera covers roughly +/-414 at z=0. These bounds cross its right edge.
 mounted.rerender(<StudioSelectionVisibility points={[{x:390,y:-10,z:0},{x:430,y:10,z:20}]} onChange={change}/>);
 act(()=>frames.run!({camera}));expect(change.mock.calls).toEqual([['inside'],['partial']]);expect(camera.toJSON()).toEqual(before);
 mounted.rerender(<StudioSelectionVisibility points={points.map(p=>({...p,x:p.x+10000}))} onChange={change}/>);
 act(()=>frames.run!({camera}));expect(change.mock.calls).toEqual([['inside'],['partial'],['outside']]);expect(camera.toJSON()).toEqual(before);
 mounted.rerender(<StudioSelectionVisibility points={points} onChange={change}/>);act(()=>frames.run!({camera}));expect(change.mock.calls).toEqual([['inside'],['partial'],['outside'],['inside']]);mounted.unmount();
});

it('shows a partial-bound cue and clears it after manual zoom without writing the camera',()=>{
 const camera=new PerspectiveCamera(45,1,1,10000);camera.position.set(0,0,1000);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const points=[{x:390,y:-10,z:0},{x:430,y:10,z:20}],copy=structuredClone(points);
 function ObservedSelection(){
  const [visibility,setVisibility]=useState<SelectionVisibility>('inside');
  return <><StudioSelectionVisibility points={points} onChange={setVisibility}/><StudioPlacementReadout selection={{label:'Pergola 2',kind:'pergola',local:points,world:points,origin:{x:390,y:0},rotation:0}} others={[]} preview={false} moving={false} visibility={visibility} view="3D"/></>;
 }
 const mounted=renderIntoDocument(<ObservedSelection/>),before=camera.toJSON();
 act(()=>frames.run!({camera}));expect(mounted.container.textContent).toContain('Pergola 2 selection bounds are partly outside this 3D view.');expect(camera.toJSON()).toEqual(before);
 // Simulate the existing controls' manual zoom. The observer only reads the new matrix.
 camera.zoom=.5;camera.updateProjectionMatrix();const zoomed=camera.toJSON();
 act(()=>frames.run!({camera}));expect(mounted.container.querySelector('[role="status"]')).toBeNull();expect(camera.toJSON()).toEqual(zoomed);
 camera.position.x=10000;camera.lookAt(10000,0,0);camera.updateMatrixWorld();const panned=camera.toJSON();
 act(()=>frames.run!({camera}));expect(mounted.container.textContent).toContain('Pergola 2 selection bounds are outside this 3D view.');expect(camera.toJSON()).toEqual(panned);
 camera.position.x=0;camera.lookAt(0,0,0);camera.updateMatrixWorld();const returned=camera.toJSON();
 act(()=>frames.run!({camera}));expect(mounted.container.querySelector('[role="status"]')).toBeNull();expect(camera.toJSON()).toEqual(returned);expect(points).toEqual(copy);mounted.unmount();
});
