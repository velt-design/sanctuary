import {LightingProvider,useLighting} from "@sp/configurator/react/controls";
import {newStudioWebsiteDesign} from "@/lib/designStudio/websiteDesign";
import {act} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {addWebsitePergola} from '@/lib/designStudio/websiteComposition';
import type {StudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import StudioHouseCanvas from './StudioHouseCanvas';
const host=vi.hoisted(()=>({active:false,mounts:0}));
vi.mock('@sp/geometry-viewer/react/canvas',async()=>{const React=await import('react');return{SceneCanvas:({active}:any)=>{host.active=active;React.useEffect(()=>{host.mounts++;},[]);return <div data-model-host/>;}};});
let m:ReturnType<typeof renderIntoDocument>|undefined;
afterEach(()=>{m?.unmount();m=undefined;vi.restoreAllMocks();});
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
