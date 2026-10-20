import {act} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {addWebsitePergola} from '@/lib/designStudio/websiteComposition';
import type {StudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import StudioQuoteViews from './StudioQuoteViews';

// The actual composition and capture controller run here. GPU pixels and camera
// feel are separately checked in the hosted browser, not inferred from this test.
const observed=vi.hoisted(()=>({camera:null as any,render:vi.fn(),invalidate:vi.fn(),decode:vi.fn(),perspective:vi.fn(()=> 'data:image/png;base64,cGVyc3BlY3RpdmU=')}));
vi.mock('@sp/geometry-viewer/react/canvas',()=>({SceneCanvas:({children}:any)=>children}));
vi.mock('@react-three/fiber',()=>({useThree:()=>({gl:{render:observed.render,domElement:{toDataURL:observed.perspective}},scene:{},camera:{},invalidate:observed.invalidate})}));
vi.mock('@sp/configurator/react',()=>({PreviewCamera:(props:any)=>{observed.camera=props;return null;},PreviewLighting:()=>null,PreviewProductNode:()=>null,PreviewPlanProduct:()=>null,StudioTreatment:{Provider:({children}:any)=>children}}));
vi.mock('./StudioProductContext',()=>({default:({children}:any)=>children}));
vi.mock('./StudioHouseNode',()=>({default:()=>null}));
vi.mock('./directDemo/WebsiteConnectionDetail',()=>({default:()=>null}));
let mount:ReturnType<typeof renderIntoDocument>|undefined;
function design(){const edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'view-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};return addWebsitePergola(edit,'p');}
async function click(label:string){await act(async()=>{const button=[...mount!.container.querySelectorAll('button')].find(b=>b.textContent===label)!;expect(button).toBeTruthy();button.click();});}
beforeEach(()=>{
 vi.useFakeTimers();vi.clearAllMocks();observed.decode.mockResolvedValue(undefined);
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
