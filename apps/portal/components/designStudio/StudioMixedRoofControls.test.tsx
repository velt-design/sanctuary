import { act, useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { newStudioWebsiteDesign, type StudioWebsiteDesign } from '@/lib/designStudio/websiteDesign';
import { solvePergolaPreview } from '@sp/configurator/geometry';
import Roof from './StudioWebsiteRoofControls';
let mount:ReturnType<typeof renderIntoDocument>|undefined;
afterEach(()=>{mount?.unmount();mount=undefined;});
function open(value:StudioWebsiteDesign){let current=value;const changed=vi.fn();function Editor(){const [v,set]=useState(value);current=v;return <Roof value={v} onChange={next=>{changed(next);set(next);}}/>;}mount=renderIntoDocument(<Editor/>);return{current:()=>current,changed};}
const select=(label:string)=>(mount!.container.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement);
function change(label:string,value:string){act(()=>{const field=select(label);field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));});}
it('opts a new Mixed choice into exact full-length panels and visibly restricts mono front/back',()=>{
 const state=open(newStudioWebsiteDesign('p'));
 act(()=>[...mount!.container.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Mixed')!.click());
 expect(state.current().selection.roof.finish!.studioPanels).toEqual({version:1,count:2,side:'left'});
 expect(select('Panel position').value).toBe('left');expect([...select('Panel position').options].filter(o=>o.disabled).map(o=>o.value)).toEqual(['front','back']);
 expect(mount!.container.textContent).toContain('Front/back placement needs a gable roof');
 change('Acrylic panels','3');change('Panel position','right');
 const design=state.current().selection;expect(design.roof.finish!.studioPanels).toEqual({version:1,count:3,side:'right'});
 expect(solvePergolaPreview(design.input,design.roof).geometry!.assembly.roofCladdingPanels.filter(p=>p.id.startsWith('finish-acrylic-'))).toHaveLength(3);
});
it('shows actual inherited house-side count without claiming Left or migrating the saved layout on mount',()=>{
 const value=newStudioWebsiteDesign('old');value.selection.roof={family:'gable',orientation:'away',infills:false,finish:{material:'combination',layout:'house',acrylicBays:2,profile:'corrugated',trayWidth:400}};
 const expected=solvePergolaPreview(value.selection.input,value.selection.roof).geometry!.assembly.roofCladdingPanels.filter(p=>p.id.startsWith('finish-acrylic-')).length;
 const state=open(value);expect(state.changed).not.toHaveBeenCalled();expect(select('Panel position').value).toBe('legacy');expect(select('Panel position').selectedOptions[0].textContent).toBe('Existing house-side band');expect(select('Acrylic panels').value).toBe(String(expected));
 expect(state.current()).toEqual(value);change('Acrylic panels','2');expect(select('Panel position').value).toBe('left');
});
it('limits a Front gable choice to that face instead of silently spilling selected panels onto the back',()=>{
 const value=newStudioWebsiteDesign('g');value.selection.roof={family:'gable',orientation:'parallel',infills:false,finish:{material:'combination',layout:'central',acrylicBays:2,profile:'corrugated',trayWidth:400,studioPanels:{version:1,count:2,side:'front'}}};
 const state=open(value);const max=Number([...select('Acrylic panels').options].at(-1)!.value);change('Acrylic panels',String(max));
 const design=state.current().selection,g=solvePergolaPreview(design.input,design.roof).geometry!;
 expect(g.assembly.roofCladdingPanels.filter(p=>p.id.startsWith('finish-acrylic-')).every(p=>p.boundary.every(v=>v.y>=design.input.projectionMm/2-1e-6))).toBe(true);
 expect(g.assembly.roofCladdingPanels.filter(p=>p.id.startsWith('finish-acrylic-'))).toHaveLength(max);
});
it('starts a narrow valid roof with one panel and retains deliberate panel intent across material toggles',()=>{
 const value=newStudioWebsiteDesign('narrow');value.selection.input.widthMm=1500;
 const state=open(value),click=(text:string)=>act(()=>[...mount!.container.querySelectorAll('button')].find(b=>b.textContent?.trim()===text)!.click());
 click('Mixed');expect(state.current().selection.roof.finish!.studioPanels).toEqual({version:1,count:1,side:'left'});
 change('Panel position','right');click('Acrylic');click('Mixed');expect(state.current().selection.roof.finish!.studioPanels).toEqual({version:1,count:1,side:'right'});
});
