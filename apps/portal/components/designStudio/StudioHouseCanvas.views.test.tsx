import {LightingProvider,useLighting} from "@sp/configurator/react/controls";
import {newStudioWebsiteDesign} from "@/lib/designStudio/websiteDesign";
import {act} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {addWebsitePergola,positionWebsitePergola} from '@/lib/designStudio/websiteComposition';
import type {StudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import StudioHouseCanvas from './StudioHouseCanvas';
import {applyStudioHouseEdit} from '@/lib/designStudio/houseEditing';
import {createStudioSceneResolver} from '@/lib/designStudio/interaction/resolvedScene';
import {newStudioHousePosition} from '@/lib/designStudio/newHousePlacement';
const host=vi.hoisted(()=>({active:false,mounts:0}));
vi.mock('@sp/geometry-viewer/react/canvas',async()=>{const React=await import('react');return{SceneCanvas:({active}:any)=>{host.active=active;React.useEffect(()=>{host.mounts++;},[]);return <div data-model-host/>;}};});
let m:ReturnType<typeof renderIntoDocument>|undefined;
let width:ReturnType<typeof vi.spyOn>,height:ReturnType<typeof vi.spyOn>,resize:Array<()=>void>;
beforeEach(()=>{
 width=vi.spyOn(Element.prototype,'clientWidth','get').mockReturnValue(1000);
 height=vi.spyOn(Element.prototype,'clientHeight','get').mockReturnValue(700);
 resize=[];vi.stubGlobal('ResizeObserver',class{constructor(callback:()=>void){resize.push(callback);}observe(){}disconnect(){}});
});
afterEach(()=>{m?.unmount();m=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
it('shows live Plan and the same persistent 3D host in Split, preserving both camera storage addresses across views',()=>{
 let edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'split',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};edit=addWebsitePergola(edit,'p');
 sessionStorage.setItem('split-camera:3d','retained-model-camera');sessionStorage.setItem('split-camera:plan',JSON.stringify({x:123,y:456,units:12}));host.mounts=0;
 const render=(view:any)=><StudioHouseCanvas edit={edit} selected="p" onSelect={()=>{}} view={view} cameraStorageKey="split-camera" persistentViewport/>;
 m=renderIntoDocument(render('Split'));
 expect(m.container.querySelector('svg[aria-label="Studio design Plan"]')).not.toBeNull();expect(host.active).toBe(true);expect(host.mounts).toBe(1);
 const camera=sessionStorage.getItem('split-camera:plan');
 act(()=>m!.rerender(render('3D')));expect(host.mounts).toBe(1);expect(host.active).toBe(true);
 act(()=>m!.rerender(render('Plan')));expect(host.mounts).toBe(1);expect(host.active).toBe(false);
 act(()=>m!.rerender(render('Split')));expect(host.mounts).toBe(1);expect(host.active).toBe(true);
 expect(sessionStorage.getItem('split-camera:3d')).toBe('retained-model-camera');expect(sessionStorage.getItem('split-camera:plan')).toBe(camera);
});

it('preserves legacy non-CAD provider view-driven Night behavior',()=>{
 const {input,roof}=newStudioWebsiteDesign('legacy-lights').selection;
 const edit=addWebsitePergola({schemaVersion:'studio_authoring_edit.v1',designId:'legacy-lights',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]} as StudioAuthoringEdit,'p');
 function LightState(){const light=useLighting()!;return <><button onClick={light.open}>Open light tools</button><output data-night>{String(light.night)}</output></>;}
 m=renderIntoDocument(<LightingProvider input={input} roof={roof} onChange={()=>{}}><LightState/><StudioHouseCanvas edit={edit} selected="p" onSelect={()=>{}}/></LightingProvider>);
 const click=(text:string)=>act(()=>[...m!.container.querySelectorAll('button')].find(b=>b.textContent===text)!.click());
 click('Open light tools');expect(m.container.querySelector('[data-night]')!.textContent).toBe('false');
 click('Plan');click('3D');expect(m.container.querySelector('[data-night]')!.textContent).toBe('true');
});
it('fits a newly added house once and keeps that same camera during later edits and moves',()=>{
 let edit=addWebsitePergola({schemaVersion:'studio_authoring_edit.v1',designId:'add-fit',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]} as StudioAuthoringEdit,'p');
 const render=()=> <StudioHouseCanvas edit={edit} selected="p" onSelect={()=>{}} view="Plan" cameraStorageKey="add-fit" persistentViewport/>;
 m=renderIntoDocument(render());const before=m.container.querySelector('svg')!.getAttribute('viewBox');
 const result=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'house',worldPosition:newStudioHousePosition(createStudioSceneResolver().resolve(edit))});if(!result.ok)throw Error(result.message);
 edit={...edit,spatial:result.spatial};act(()=>m!.rerender(render()));
 const after=m.container.querySelector('svg')!.getAttribute('viewBox');expect(after).not.toBe(before);
 edit=structuredClone(edit);edit.site.access='hard';act(()=>m!.rerender(render()));expect(m.container.querySelector('svg')!.getAttribute('viewBox')).toBe(after);
 edit.spatial.pergolas[0].position!.originXMm='17000';act(()=>m!.rerender(render()));expect(m.container.querySelector('svg')!.getAttribute('viewBox')).toBe(after);
});

it('retains an explored Plan camera for a visible copy, its removal and re-addition',()=>{
 let edit=addWebsitePergola({schemaVersion:'studio_authoring_edit.v1',designId:'visible-copy',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]} as StudioAuthoringEdit,'p');
 sessionStorage.setItem('visible-copy:plan',JSON.stringify({x:3000,y:-1500,units:15,viewport:{width:1000,height:700},framingPolicy:'pergola-context.v1'}));
 const render=()=> <StudioHouseCanvas edit={edit} selected="p" onSelect={()=>{}} view="Plan" cameraStorageKey="visible-copy" persistentViewport/>;
 m=renderIntoDocument(render());const original=edit,frame=m.container.querySelector('svg')!.getAttribute('viewBox'),stored=sessionStorage.getItem('visible-copy:plan');
 edit=positionWebsitePergola(addWebsitePergola(edit,'copy'),'copy',{originXMm:'0',originYMm:'0'});const copy=edit;
 act(()=>m!.rerender(render()));expect(m.container.querySelector('svg')!.getAttribute('viewBox')).toBe(frame);expect(sessionStorage.getItem('visible-copy:plan')).toBe(stored);
 edit=original;act(()=>m!.rerender(render()));expect(m.container.querySelector('svg')!.getAttribute('viewBox')).toBe(frame);
 edit=copy;act(()=>m!.rerender(render()));expect(m.container.querySelector('svg')!.getAttribute('viewBox')).toBe(frame);
});

it('defers outside-add visibility while Plan has no drawable, then reveals it when a real viewport returns',()=>{
 width.mockReturnValue(0);height.mockReturnValue(0);
 let edit=addWebsitePergola({schemaVersion:'studio_authoring_edit.v1',designId:'deferred-add',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]} as StudioAuthoringEdit,'p');
 const render=()=> <StudioHouseCanvas edit={edit} selected="p" onSelect={()=>{}} view="Plan" cameraStorageKey="deferred-add" persistentViewport/>;
 m=renderIntoDocument(render());const before=m.container.querySelector('svg')!.getAttribute('viewBox');
 const result=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'house',worldPosition:newStudioHousePosition(createStudioSceneResolver().resolve(edit))});if(!result.ok)throw Error(result.message);
 edit={...edit,spatial:result.spatial};act(()=>m!.rerender(render()));expect(m.container.querySelector('svg')!.getAttribute('viewBox')).toBe(before);
 width.mockReturnValue(1000);height.mockReturnValue(700);act(()=>resize.forEach(callback=>callback()));
 const [x,y,w,h]=m.container.querySelector('svg')!.getAttribute('viewBox')!.split(' ').map(Number);
 for(const point of createStudioSceneResolver().resolve(edit).houses[0].footprint){expect(point.x).toBeGreaterThanOrEqual(x);expect(point.x).toBeLessThanOrEqual(x+w);expect(-point.y).toBeGreaterThanOrEqual(y);expect(-point.y).toBeLessThanOrEqual(y+h);}
});
