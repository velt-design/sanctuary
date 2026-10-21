import {act,useState} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import {addWebsitePergola} from '@/lib/designStudio/websiteComposition';
import type {StudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import StudioHouseCanvas,{type StudioDirectDrag} from './StudioHouseCanvas';

// Keep the actual Plan, product contexts and pointer handlers. Only the unused
// WebGL host and unavailable browser CTM/capture primitives are substituted.
vi.mock('@sp/geometry-viewer/react/canvas',()=>({SceneCanvas:()=>null}));
let mounted:ReturnType<typeof renderIntoDocument>|undefined;
let captured:Element[];
const originalCapture=Object.getOwnPropertyDescriptor(Element.prototype,'setPointerCapture');
const originalWidth=Object.getOwnPropertyDescriptor(SVGSVGElement.prototype,'clientWidth'),originalHeight=Object.getOwnPropertyDescriptor(SVGSVGElement.prototype,'clientHeight');
beforeEach(()=>{
 sessionStorage.clear();captured=[];
 Object.defineProperty(Element.prototype,'setPointerCapture',{configurable:true,value:function(this:Element){captured.push(this);}});
 Object.defineProperty(SVGSVGElement.prototype,'clientWidth',{configurable:true,get:()=>1000});Object.defineProperty(SVGSVGElement.prototype,'clientHeight',{configurable:true,get:()=>700});
 vi.stubGlobal('DOMPoint',class {constructor(public x:number,public y:number){} matrixTransform(m:DOMMatrix){return {x:m.a*this.x+m.c*this.y+m.e,y:m.b*this.x+m.d*this.y+m.f};}});
});
afterEach(()=>{
 mounted?.unmount();mounted=undefined;window.getSelection()?.removeAllRanges();vi.unstubAllGlobals();
 if(originalCapture)Object.defineProperty(Element.prototype,'setPointerCapture',originalCapture);else Reflect.deleteProperty(Element.prototype,'setPointerCapture');
 if(originalWidth)Object.defineProperty(SVGSVGElement.prototype,'clientWidth',originalWidth);else Reflect.deleteProperty(SVGSVGElement.prototype,'clientWidth');
 if(originalHeight)Object.defineProperty(SVGSVGElement.prototype,'clientHeight',originalHeight);else Reflect.deleteProperty(SVGSVGElement.prototype,'clientHeight');
});
function design(){
 const empty:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'pointer-regression',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};
 return addWebsitePergola(empty,'p');
}
function handlers(ready=true){return {canDrag:vi.fn(()=>ready),begin:vi.fn(),move:vi.fn(),finish:vi.fn()} satisfies StudioDirectDrag;}
function pointer(target:Element,type:string,x=10,y=20,button=0){
 const event=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button,buttons:type==='pointerup'?0:1});
 Object.defineProperties(event,{pointerId:{value:1},pointerType:{value:'mouse'}});
 act(()=>target.dispatchEvent(event));return event;
}
function open(drag:StudioDirectDrag,selected='p'){
 mounted=renderIntoDocument(<><input aria-label="Exact X" defaultValue="123.45"/><StudioHouseCanvas edit={design()} selected={selected} onSelect={()=>{}} onMove={()=>{}} directDrag={drag} view="Plan" persistentViewport/></>);
 return mounted.container.querySelector<SVGSVGElement>('svg[aria-label="Studio design Plan"]')!;
}
function selectRoofText(svg:SVGSVGElement){
 const text=svg.querySelector('[data-roof-fall-label]')!;expect(text).toBeTruthy();
 const range=document.createRange();range.selectNodeContents(text);window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);
 expect(window.getSelection()!.toString()).toBe('Roof fall');
}

it('suppresses the native default with existing roof text selected and releases the exact grabbed delta',()=>{
 const drag=handlers(),svg=open(drag);selectRoofText(svg);
 const down=pointer(svg.querySelector('[data-selected-product-grab]')!,'pointerdown');
 expect(down.defaultPrevented).toBe(true);expect(captured).toEqual([svg]);expect(drag.begin).toHaveBeenCalledExactlyOnceWith('p');
 // CTM is identity in this test; the actual Plan flips screen Y into world Y.
 pointer(svg,'pointermove',50,70);expect(drag.move).toHaveBeenLastCalledWith('p',40,-50,{x:50,y:-70},expect.any(Number));
 pointer(svg,'pointerup',60,80);expect(drag.move).toHaveBeenLastCalledWith('p',50,-60,{x:60,y:-80},expect.any(Number));expect(drag.finish).toHaveBeenCalledExactlyOnceWith(true);
});

it('prevents native selection even when placement preparation denies the start',()=>{
 const drag=handlers(false),svg=open(drag);selectRoofText(svg);
 expect(pointer(svg.querySelector('[data-selected-product-grab]')!,'pointerdown').defaultPrevented).toBe(true);
 expect(captured).toEqual([]);expect(drag.begin).not.toHaveBeenCalled();pointer(svg,'pointermove',80,80);pointer(svg,'pointerup',80,80);expect(drag.finish).not.toHaveBeenCalled();
});

it('keeps capture on the stable SVG when selecting an inactive product replaces its descendant',()=>{
 const edit=design(),drag=handlers();
 function Harness(){const [selected,setSelected]=useState('');return <StudioHouseCanvas edit={edit} selected={selected} onSelect={setSelected} onMove={()=>{}} directDrag={drag} view="Plan" persistentViewport/>;}
 mounted=renderIntoDocument(<Harness/>);const svg=mounted.container.querySelector<SVGSVGElement>('svg[aria-label="Studio design Plan"]')!,oldProduct=svg.querySelector('[aria-label="Select Pergola 1"]')!;
 pointer(oldProduct,'pointerdown');expect(oldProduct.isConnected).toBe(false);expect(captured).toEqual([svg]);expect(svg.isConnected).toBe(true);
 pointer(svg,'pointermove',40,50);pointer(svg,'pointerup',40,50);expect(drag.finish).toHaveBeenCalledExactlyOnceWith(true);
 expect(mounted.container.querySelector('svg[aria-label="Studio design Plan"]')).toBe(svg);
});

it('cancels native dragstart only inside Plan and leaves external numeric selection and input events intact',()=>{
 const svg=open(handlers());selectRoofText(svg);
 const nativeDrag=new Event('dragstart',{bubbles:true,cancelable:true});act(()=>svg.querySelector('[data-selected-product-grab]')!.dispatchEvent(nativeDrag));expect(nativeDrag.defaultPrevented).toBe(true);
 const input=mounted!.container.querySelector('input')!;expect(pointer(input,'pointerdown').defaultPrevented).toBe(false);
 input.select();expect(input.selectionStart).toBe(0);expect(input.selectionEnd).toBe(input.value.length);
 const outsideDrag=new Event('dragstart',{bubbles:true,cancelable:true});input.dispatchEvent(outsideDrag);expect(outsideDrag.defaultPrevented).toBe(false);
});

it.each(['pointercancel','escape','lostpointercapture'] as const)('retains cancellation without committing after %s',kind=>{
 const drag=handlers(),svg=open(drag);pointer(svg.querySelector('[data-selected-product-grab]')!,'pointerdown');pointer(svg,'pointermove',50,70);
 if(kind==='escape')act(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));else pointer(svg,kind,50,70);
 expect(drag.finish).toHaveBeenCalledExactlyOnceWith(false);pointer(svg,'pointerup',50,70);expect(drag.finish).toHaveBeenCalledTimes(1);
});

it('preserves the existing four-screen-pixel grab threshold',()=>{
 const drag=handlers(),svg=open(drag);pointer(svg.querySelector('[data-selected-product-grab]')!,'pointerdown');pointer(svg,'pointermove',12,20);pointer(svg,'pointerup',12,20);
 expect(drag.move).not.toHaveBeenCalled();expect(drag.finish).toHaveBeenCalledExactlyOnceWith(false);
});
