import * as React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {PerspectiveCamera,Vector3,MOUSE} from 'three';
import {computeSceneBoundsFromPoints} from '@sp/geometry-viewer';
import {renderIntoDocument} from '../../../../../test/reactHarness';
import PreviewCamera from './PreviewCamera';
const f=vi.hoisted(()=>({state:{} as any,props:{} as any,orbit:{} as any}));
vi.mock('@react-three/fiber',()=>({useThree:()=>f.state,useFrame:()=>{}}));
vi.mock('@react-three/drei',()=>({OrbitControls:React.forwardRef(function Controls(props:any,ref){f.props=props;Object.assign(f.orbit,{enabled:props.enabled??true,enableRotate:true,enablePan:props.enablePan??true,enableZoom:true,mouseButtons:props.mouseButtons??{LEFT:MOUSE.ROTATE,MIDDLE:MOUSE.DOLLY,RIGHT:MOUSE.PAN},touches:props.touches});React.useImperativeHandle(ref,()=>f.orbit);return null;})}));
let m:ReturnType<typeof renderIntoDocument>|undefined;
afterEach(()=>{m?.unmount();m=undefined;vi.unstubAllGlobals();});
it('opts the editor into right orbit and free camera without changing default consumer controls',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:true}));const camera=new PerspectiveCamera(24,1,10,200000);
 f.orbit={target:new Vector3(),update:()=>{camera.lookAt(f.orbit.target);camera.updateMatrixWorld();}};f.state={camera,size:{width:900,height:600},gl:{domElement:document.createElement('canvas')},invalidate:vi.fn()};
 const points=[{x:0,y:0,z:0},{x:6000,y:3000,z:3000}],props={bounds:computeSceneBoundsFromPoints(points),fitPoints:points,enabled:true,reset:0,fit:0,surroundings:true,studio:true};
 m=renderIntoDocument(<PreviewCamera {...props} {...{studioCad:true} as any}/>);
 expect(f.props.mouseButtons).toEqual({LEFT:undefined,MIDDLE:MOUSE.PAN,RIGHT:MOUSE.ROTATE});expect(f.props.enablePan).toBe(true);expect(f.props.maxDistance).toBe(Infinity);expect(f.props.maxPolarAngle).toBe(Math.PI);
 m.rerender(<PreviewCamera {...props}/>);expect(f.props.mouseButtons).toBeUndefined();expect(f.props.enablePan).toBe(false);expect(f.props.maxDistance).toBe(100000);expect(f.props.maxPolarAngle).toBe(Math.PI*.48);
});

it('contains the explored camera on narrower layouts and reverses resize without fitting changed edits',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:true}));sessionStorage.removeItem('cad-resize');const camera=new PerspectiveCamera(24,1,10,200000);
 f.orbit={target:new Vector3(),update:()=>{camera.lookAt(f.orbit.target);camera.updateMatrixWorld();}};f.state={camera,size:{width:960,height:600},gl:{domElement:document.createElement('canvas')},invalidate:vi.fn()};
 const points=[{x:0,y:0,z:0},{x:20000,y:8000,z:3400}],base={bounds:computeSceneBoundsFromPoints(points),fitPoints:points,enabled:true,reset:0,fit:0,surroundings:true,studio:true,studioCad:true,preserveUserCamera:true,framingKey:'unchanged-design',storageKey:'cad-resize'};
 m=renderIntoDocument(<PreviewCamera {...base}/>);
 f.props.onStart();camera.position.sub(f.orbit.target).multiplyScalar(1.15).add(f.orbit.target);f.orbit.update();f.props.onChange();
 const position=camera.position.toArray(),target=f.orbit.target.toArray(),zoom=camera.zoom,fov=camera.fov;
 f.state.size={width:448,height:600};m.rerender(<PreviewCamera {...base}/>);
 for(const p of points){const v=new Vector3(p.x,p.y,p.z).project(camera);expect(Math.abs(v.x)).toBeLessThan(1);expect(Math.abs(v.y)).toBeLessThan(1);}
 expect(camera.position.toArray()).toEqual(position);expect(f.orbit.target.toArray()).toEqual(target);expect(camera.fov).toBe(fov);
 f.state.size={width:960,height:600};m.rerender(<PreviewCamera {...base}/>);expect(camera.zoom).toBe(zoom);expect(camera.position.toArray()).toEqual(position);
 const changed=[...points,{x:60000,y:60000,z:4000}];m.rerender(<PreviewCamera {...base} bounds={computeSceneBoundsFromPoints(changed)} fitPoints={changed}/>);
 expect(camera.position.toArray()).toEqual(position);expect(f.orbit.target.toArray()).toEqual(target);expect(camera.zoom).toBe(zoom);
});

it('moves the Studio pivot only on selection, preserving the explored eye offset, zoom and all default consumers',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:true}));const camera=new PerspectiveCamera(24,1,10,200000);
 f.orbit={target:new Vector3(),update:()=>{camera.lookAt(f.orbit.target);camera.updateMatrixWorld();}};f.state={camera,size:{width:900,height:600},gl:{domElement:document.createElement('canvas')},invalidate:vi.fn()};
 const points=[{x:0,y:0,z:0},{x:20000,y:8000,z:3400}],base={bounds:computeSceneBoundsFromPoints(points),fitPoints:points,enabled:true,reset:0,fit:0,surroundings:true,studio:true,studioCad:true,preserveUserCamera:true};
 m=renderIntoDocument(<PreviewCamera {...base} selectionPivot={{id:'p1',centre:{x:3000,y:1500,z:1500}}}/>);
 f.props.onStart();camera.position.sub(f.orbit.target).multiplyScalar(1.2).add(f.orbit.target);f.orbit.update();f.props.onChange();
 const delta=camera.position.clone().sub(f.orbit.target),zoom=camera.zoom,fov=camera.fov;
 m.rerender(<PreviewCamera {...base} selectionPivot={{id:'p2',centre:{x:18000,y:6000,z:1700}}}/>);
 expect(f.orbit.target.toArray()).toEqual([18000,6000,1700]);expect(camera.position.clone().sub(f.orbit.target).distanceTo(delta)).toBeLessThan(1e-8);expect(camera.zoom).toBe(zoom);expect(camera.fov).toBe(fov);
 const eye=camera.position.toArray();m.rerender(<PreviewCamera {...base} selectionPivot={{id:'p2',centre:{x:20000,y:6000,z:1900}}}/>);
 expect(f.orbit.target.toArray()).toEqual([18000,6000,1700]);expect(camera.position.toArray()).toEqual(eye);
 const start=(button:number)=>{const e=new MouseEvent('pointerdown',{button});Object.defineProperty(e,'pointerType',{value:'mouse'});f.state.gl.domElement.dispatchEvent(e);f.props.onStart();};
 start(1);expect(camera.position.toArray()).toEqual(eye);expect(f.orbit.target.toArray()).toEqual([18000,6000,1700]);
 window.dispatchEvent(new Event('pointerup'));f.props.onStart(); // Wheel/dolly has no rotation pointer.
 expect(f.orbit.target.toArray()).toEqual([18000,6000,1700]);
 const touch=(type:string,id:number)=>{const e=new MouseEvent(type,{clientX:type==='pointermove'?10:0});Object.defineProperties(e,{pointerType:{value:'touch'},pointerId:{value:id}});(type==='pointerup'?window:f.state.gl.domElement).dispatchEvent(e);};
 touch('pointerdown',1);touch('pointerdown',2);f.props.onStart();touch('pointermove',1);expect(f.orbit.target.toArray()).toEqual([18000,6000,1700]);touch('pointerup',1);touch('pointerup',2);
 start(2);expect(f.orbit.target.toArray()).toEqual([18000,6000,1700]);
 const rotate=new MouseEvent('pointermove',{clientX:10});Object.defineProperty(rotate,'pointerType',{value:'mouse'});f.state.gl.domElement.dispatchEvent(rotate);
 expect(f.orbit.target.toArray()).toEqual([20000,6000,1900]);expect(camera.position.clone().sub(f.orbit.target).distanceTo(delta)).toBeLessThan(1e-8);expect(camera.zoom).toBe(zoom);
 const movedEye=camera.position.toArray();m.rerender(<PreviewCamera {...base} studioCad={false} selectionPivot={{id:'different',centre:{x:1,y:2,z:3}}}/>);expect(camera.position.toArray()).toEqual(movedEye);
});

it('restores a manually panned same-selection frame, then uses the latest selected centre for a one-touch orbit',()=>{
 vi.stubGlobal('matchMedia',()=>({matches:true}));const camera=new PerspectiveCamera(24,1,10,200000),saved={projection:'perspective',position:[1000,5000,4000],target:[1000,2000,1000],fov:31,zoom:1};sessionStorage.setItem('selection-return',JSON.stringify(saved));
 f.orbit={target:new Vector3(),update:()=>{camera.lookAt(f.orbit.target);camera.updateMatrixWorld();}};f.state={camera,size:{width:900,height:600},gl:{domElement:document.createElement('canvas')},invalidate:vi.fn()};
 const points=[{x:0,y:0,z:0},{x:20000,y:8000,z:3400}],base={bounds:computeSceneBoundsFromPoints(points),fitPoints:points,enabled:true,reset:0,fit:0,surroundings:true,studio:true,studioCad:true,preserveUserCamera:true,storageKey:'selection-return'};
 m=renderIntoDocument(<PreviewCamera {...base} selectionPivot={{id:'p1',centre:{x:3000,y:1500,z:1500}}}/>);
 expect(camera.position.toArray()).toEqual(saved.position);expect(f.orbit.target.toArray()).toEqual(saved.target);
 const delta=camera.position.clone().sub(f.orbit.target);m.rerender(<PreviewCamera {...base} selectionPivot={{id:'p1',centre:{x:7000,y:1500,z:1600}}}/>);
 expect(camera.position.toArray()).toEqual(saved.position);
 for(const type of ['pointerdown','pointermove']){const e=new MouseEvent(type,{clientX:type==='pointermove'?10:0});Object.defineProperties(e,{pointerType:{value:'touch'},pointerId:{value:1}});f.state.gl.domElement.dispatchEvent(e);}
 expect(f.orbit.target.toArray()).toEqual([7000,1500,1600]);expect(camera.position.clone().sub(f.orbit.target).distanceTo(delta)).toBeLessThan(1e-8);expect(camera.fov).toBe(31);
 sessionStorage.removeItem('selection-return');
});

it.each(['shiftKey','ctrlKey','metaKey'])('uses the actual OrbitControls %s pan/rotate mapping instead of the raw button',modifier=>{
 vi.stubGlobal('matchMedia',()=>({matches:true}));const camera=new PerspectiveCamera(24,1,10,200000);
 f.orbit={target:new Vector3(),update:()=>{camera.lookAt(f.orbit.target);camera.updateMatrixWorld();}};f.state={camera,size:{width:900,height:600},gl:{domElement:document.createElement('canvas')},invalidate:vi.fn()};
 const points=[{x:0,y:0,z:0},{x:20000,y:8000,z:3400}],base={bounds:computeSceneBoundsFromPoints(points),fitPoints:points,enabled:true,reset:0,fit:0,surroundings:true,studio:true,studioCad:true,preserveUserCamera:true};
 m=renderIntoDocument(<PreviewCamera {...base} selectionPivot={{id:'p1',centre:{x:3000,y:1500,z:1500}}}/>);
 const old=f.orbit.target.toArray(),eye=camera.position.toArray(),delta=camera.position.clone().sub(f.orbit.target);
 m.rerender(<PreviewCamera {...base} selectionPivot={{id:'p1',centre:{x:9000,y:2000,z:1600}}}/>);
 const drag=(button:number)=>{for(const type of ['pointerdown','pointermove','pointerup']){const event=new MouseEvent(type,{button,clientX:type==='pointermove'?10:0,[modifier]:true});Object.defineProperty(event,'pointerType',{value:'mouse'});(type==='pointerup'?window:f.state.gl.domElement).dispatchEvent(event);}};
 drag(2);expect(f.orbit.target.toArray()).toEqual(old);expect(camera.position.toArray()).toEqual(eye);
 for(const field of ['enabled','enableRotate']){f.orbit[field]=false;drag(1);expect(f.orbit.target.toArray()).toEqual(old);f.orbit[field]=true;}
 drag(1);expect(f.orbit.target.toArray()).toEqual([9000,2000,1600]);expect(camera.position.clone().sub(f.orbit.target).distanceTo(delta)).toBeLessThan(1e-8);
});
