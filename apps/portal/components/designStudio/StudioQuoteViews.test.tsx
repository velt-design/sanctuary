import {act} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {addWebsitePergola} from '@/lib/designStudio/websiteComposition';
import type {StudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import StudioQuoteViews from './StudioQuoteViews';
import {applyStudioHouseEdit} from '@/lib/designStudio/houseEditing';

// The actual composition and capture controller run here. GPU pixels and camera
// feel are separately checked in the hosted browser, not inferred from this test.
const observed=vi.hoisted(()=>({camera:null as any,houses:[] as any[],accessories:[] as {kind:string;openings:string[];panels:string[]}[],render:vi.fn(),invalidate:vi.fn(),decode:vi.fn(),perspective:vi.fn(()=> 'data:image/png;base64,cGVyc3BlY3RpdmU=')}));
vi.mock('@sp/geometry-viewer/react/canvas',()=>({SceneCanvas:({children}:any)=>children}));
vi.mock('@react-three/fiber',()=>({useThree:()=>({gl:{render:observed.render,domElement:{toDataURL:observed.perspective}},scene:{},camera:{},invalidate:observed.invalidate})}));
vi.mock('@sp/configurator/react',async()=>{const {usePreviewBlinds}=await import('@sp/configurator/react/controls');const read=(kind:string)=>{const sides=usePreviewBlinds();observed.accessories.push({kind,openings:sides?.openings.map(o=>o.id)??[],panels:sides?.panels.map(p=>p.opening)??[]});return null;};return{PreviewCamera:(props:any)=>{observed.camera=props;return null;},PreviewLighting:()=>null,PreviewProductNode:()=>read('perspective'),PreviewPlanProduct:()=>read('plan'),StudioTreatment:{Provider:({children}:any)=>children}};});
vi.mock('./StudioHouseNode',()=>({default:({geometry}:any)=>{observed.houses.push(geometry);return null;}}));
vi.mock('./directDemo/WebsiteConnectionDetail',()=>({default:()=>null}));
let mount:ReturnType<typeof renderIntoDocument>|undefined;
function design(){const edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'view-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};return addWebsitePergola(edit,'p');}
async function click(label:string){await act(async()=>{const button=[...mount!.container.querySelectorAll('button')].find(b=>b.textContent===label)!;expect(button).toBeTruthy();button.click();});}
beforeEach(()=>{
 vi.useFakeTimers();vi.clearAllMocks();observed.decode.mockResolvedValue(undefined);
 observed.accessories=[];
 observed.houses=[];
 vi.stubGlobal('Image',class {src='';decode(){return observed.decode();}});
 vi.stubGlobal('URL',Object.assign(class {},{createObjectURL:vi.fn(()=> 'blob:plan'),revokeObjectURL:vi.fn()}));
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillStyle:'',fillRect:vi.fn(),drawImage:vi.fn()} as any);
 vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue('data:image/png;base64,cGxhbg==');
 sessionStorage.clear();sessionStorage.setItem('editor-camera-proof','unchanged');
});
afterEach(()=>{mount?.unmount();mount=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
it('uses explicit presentation framing without changing editor storage or capturing on a view change',async()=>{
 const edit=design(),capture=vi.fn();mount=renderIntoDocument(<StudioQuoteViews edit={edit} onCapture={capture}/>);
 expect(observed.camera.preserveUserCamera).toBe(true);expect(observed.camera.fit).toBe(0);
 await click('Lower view');expect(observed.camera.fit).toBe(1);expect(observed.camera.overviewDirection.z).toBe(.25);
 await click('Opposite side');expect(observed.camera.fit).toBe(2);expect(observed.camera.overviewDirection.x).toBeLessThan(0);
 expect(capture).not.toHaveBeenCalled();expect(sessionStorage.length).toBe(1);expect(sessionStorage.getItem('editor-camera-proof')).toBe('unchanged');
 mount.rerender(<StudioQuoteViews edit={{...edit,revision:2}} onCapture={capture}/>);
 expect(observed.camera.fit).toBe(2);expect(observed.camera.preserveUserCamera).toBe(true);
 await click('Capture quote views');await act(async()=>{await vi.advanceTimersByTimeAsync(180);});
 expect(capture).toHaveBeenCalledWith([{kind:'perspective',dataUrl:'data:image/png;base64,cGVyc3BlY3RpdmU='},{kind:'plan',dataUrl:'data:image/png;base64,cGxhbg=='}]);
 expect(sessionStorage.getItem('editor-camera-proof')).toBe('unchanged');
});
it('rejects a capture completing after the authored identity changes and permits an explicit retry',async()=>{
 let finish!:()=>void;observed.decode.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
 const edit=design(),capture=vi.fn();mount=renderIntoDocument(<StudioQuoteViews edit={edit} onCapture={capture}/>);
 await click('Capture quote views');await act(async()=>{await vi.advanceTimersByTimeAsync(180);});
 mount.rerender(<StudioQuoteViews edit={{...edit,revision:2}} onCapture={capture}/>);await act(async()=>finish());
 expect(capture).not.toHaveBeenCalled();expect(mount.container.textContent).toContain('Design changed while capturing');
 await click('Capture quote views');await act(async()=>{await vi.advanceTimersByTimeAsync(180);});expect(capture).toHaveBeenCalledOnce();
});
it('retains a view but refuses new capture when Review is disabled',async()=>{
 const capture=vi.fn();mount=renderIntoDocument(<StudioQuoteViews edit={design()} onCapture={capture} disabled/>);
 const button=[...mount.container.querySelectorAll('button')].find(b=>b.textContent==='Capture quote views')!;
 expect(button.disabled).toBe(true);await act(async()=>button.click());expect(capture).not.toHaveBeenCalled();
});
it('uses the real read-only accessory context for rear panels in both quote views and capture',async()=>{
 const edit=design(),value=edit.objectOptions[0].values.websiteDesign as any;value.selection.roof.attachmentIntent='freestanding';value.selection.roof.sidePanels=[{opening:'rear-1of2',kind:'aluminium',profile:'65x16',edge:true,gap:100,customGap:true,frame:50,battens:false,direction:'vertical'}];
 const capture=vi.fn();mount=renderIntoDocument(<StudioQuoteViews edit={edit} onCapture={capture}/>);
 for(const kind of ['perspective','plan']){const context=observed.accessories.filter(a=>a.kind===kind).at(-1)!;expect(context.openings).toContain('rear-1of2');expect(context.panels).toEqual(['rear-1of2']);}
 await click('Capture quote views');await act(async()=>{await vi.advanceTimersByTimeAsync(180);});expect(capture).toHaveBeenCalledOnce();expect(value.selection.roof.sidePanels[0].opening).toBe('rear-1of2');
});
it('passes the same saved house material source to actual quote composition and capture without rewriting the edit',async()=>{
 const edit=design(),added=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'house'});if(!added.ok)throw Error(added.message);
 const appearance={wallMaterial:'weatherboard' as const,roofProfile:'tray' as const,roofTrayWidth:300 as const,roofColour:'#506070'};
 const styled=applyStudioHouseEdit(added.spatial,{kind:'appearance',houseFormId:'house',patch:appearance});if(!styled.ok)throw Error(styled.message);edit.spatial=styled.spatial;
 const before=structuredClone(edit),capture=vi.fn();mount=renderIntoDocument(<StudioQuoteViews edit={edit} onCapture={capture}/>);
 expect(observed.houses.at(-1).house.source.appearance).toEqual(appearance);
 await click('Capture quote views');await act(async()=>{await vi.advanceTimersByTimeAsync(180);});expect(capture).toHaveBeenCalledOnce();
 expect(observed.houses.at(-1).house.source).toEqual(edit.spatial.houseAssembly!.houseForms[0]);expect(edit).toEqual(before);
});

it('captures the real current composition only on an explicit parent request and preserves the camera',async()=>{
 const edit=design(),capture=vi.fn(),error=vi.fn();mount=renderIntoDocument(<StudioQuoteViews edit={edit} onCapture={capture} onCaptureError={error} manualCapture={false}/>);expect(mount.container.textContent).not.toContain('Capture quote views');await act(async()=>{await vi.advanceTimersByTimeAsync(200);});expect(capture).not.toHaveBeenCalled();
 mount.rerender(<StudioQuoteViews edit={edit} onCapture={capture} onCaptureError={error} manualCapture={false} captureRequest={1}/>);await act(async()=>{await vi.advanceTimersByTimeAsync(200);});expect(capture).toHaveBeenCalledOnce();expect(capture.mock.calls[0][0].map((image:any)=>image.kind)).toEqual(['perspective','plan']);expect(error).not.toHaveBeenCalled();expect(sessionStorage.getItem('editor-camera-proof')).toBe('unchanged');
 mount.rerender(<StudioQuoteViews edit={edit} onCapture={capture} manualCapture={false} captureRequest={1}/>);await act(async()=>{await vi.advanceTimersByTimeAsync(200);});expect(capture).toHaveBeenCalledOnce();
});
it('reports a requested disabled capture without rendering or returning a stale image',async()=>{
 const capture=vi.fn(),error=vi.fn();mount=renderIntoDocument(<StudioQuoteViews edit={design()} onCapture={capture} onCaptureError={error} manualCapture={false} disabled captureRequest={1}/>);await act(async()=>{});expect(error).toHaveBeenCalledOnce();expect(capture).not.toHaveBeenCalled();expect(observed.render).not.toHaveBeenCalled();
});

it('rejects a requested renderer capture failure and permits a new explicit request',async()=>{
 const capture=vi.fn(),error=vi.fn(),edit=design();observed.render.mockImplementationOnce(()=>{throw Error('Canvas unavailable');});mount=renderIntoDocument(<StudioQuoteViews edit={edit} onCapture={capture} onCaptureError={error} manualCapture={false} captureRequest={1}/>);await act(async()=>{await vi.advanceTimersByTimeAsync(180);});expect(error).toHaveBeenCalledWith('Canvas unavailable');expect(capture).not.toHaveBeenCalled();mount.rerender(<StudioQuoteViews edit={edit} onCapture={capture} onCaptureError={error} manualCapture={false} captureRequest={2}/>);await act(async()=>{await vi.advanceTimersByTimeAsync(180);});expect(capture).toHaveBeenCalledOnce();
});

it('does not let a timed-out Plan decode satisfy or cancel a later explicit capture',async()=>{
 let finish!:()=>void;observed.decode.mockImplementationOnce(()=>new Promise<void>(r=>{finish=r;}));const capture=vi.fn(),error=vi.fn(),edit=design();mount=renderIntoDocument(<StudioQuoteViews edit={edit} onCapture={capture} onCaptureError={error} manualCapture={false} captureRequest={1}/>);await act(async()=>{await vi.advanceTimersByTimeAsync(180);});await act(async()=>{await vi.advanceTimersByTimeAsync(15000);});expect(error).toHaveBeenCalledOnce();expect(capture).not.toHaveBeenCalled();mount.rerender(<StudioQuoteViews edit={edit} onCapture={capture} onCaptureError={error} manualCapture={false} captureRequest={2}/>);await act(async()=>{await vi.advanceTimersByTimeAsync(180);});expect(capture).toHaveBeenCalledOnce();await act(async()=>finish());expect(capture).toHaveBeenCalledOnce();expect(error).toHaveBeenCalledOnce();
});

it('keeps deferred capture-only retries independent after an old mounted Plan decode is retired',async()=>{
 let finish!:()=>void;observed.decode.mockImplementationOnce(()=>new Promise<void>(r=>{finish=r;}));const capture=vi.fn(),error=vi.fn(),edit=design();
 mount=renderIntoDocument(<StudioQuoteViews edit={edit} onCapture={capture} onCaptureError={error} manualCapture={false} captureOnly captureRequest={1}/>);expect(mount.container.querySelector('section')?.hasAttribute('inert')).toBe(true);
 await act(async()=>{await vi.advanceTimersByTimeAsync(180);});mount.unmount();
 mount=renderIntoDocument(<StudioQuoteViews edit={edit} onCapture={capture} onCaptureError={error} manualCapture={false} captureOnly captureRequest={2}/>);
 await act(async()=>{await vi.advanceTimersByTimeAsync(180);});expect(capture).toHaveBeenCalledOnce();
 await act(async()=>finish());expect(capture).toHaveBeenCalledOnce();expect(error).not.toHaveBeenCalled();expect(sessionStorage.getItem('editor-camera-proof')).toBe('unchanged');
});
