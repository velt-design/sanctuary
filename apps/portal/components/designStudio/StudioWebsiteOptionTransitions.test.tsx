// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import {StudioSupportModelControls as Shape} from './StudioWebsiteShapeControls';
import Roof from './StudioWebsiteRoofControls';
import {newStudioWebsiteDesign,parseStudioWebsiteDesign,type StudioWebsiteDesign} from '../../lib/designStudio/websiteDesign';
import {DEFAULT_ROOF_BATTENS} from '@sp/configurator/website';
it('Attached removes the optional key and remains a strict safe editable design',async()=>{
 const value=newStudioWebsiteDesign('p1');value.selection.roof.attachmentIntent='freestanding';let next:StudioWebsiteDesign|undefined;
 const host=document.createElement('div'),root=createRoot(host);await act(async()=>root.render(<Shape value={value} onChange={v=>{next=v;}}/>));
 await act(async()=>{Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='House-supported model')!.click();});
 expect(next).toBeDefined();expect(Object.hasOwn(next!.selection.roof,'attachmentIntent')).toBe(false);expect(parseStudioWebsiteDesign(next,'p1').ok).toBe(true);await act(async()=>root.unmount());
});
it('turning roof battens off omits the option but retains dormant raw input safely',async()=>{
 const value=newStudioWebsiteDesign('p1');value.selection.roof.roofBattens={...DEFAULT_ROOF_BATTENS};value.rawGaps={roof:'bad'};let next:StudioWebsiteDesign|undefined;
 const host=document.createElement('div'),root=createRoot(host);await act(async()=>root.render(<Roof value={value} onChange={v=>{next=v;}}/>));
 await act(async()=>{(host.querySelector('input[type=checkbox]') as HTMLInputElement).click();});
 expect(next).toBeDefined();expect(Object.hasOwn(next!.selection.roof,'roofBattens')).toBe(false);expect(next!.rawGaps).toEqual({roof:'bad'});expect(parseStudioWebsiteDesign(next,'p1').ok).toBe(true);await act(async()=>root.unmount());
});

it('labels house support as intent while retaining every support choice and strict intent transition',async()=>{
 const value=newStudioWebsiteDesign('intent-proof');value.selection.roof.attachmentIntent='freestanding';let next:StudioWebsiteDesign|undefined;
 const host=document.createElement('div'),root=createRoot(host);await act(async()=>root.render(<Shape value={value} onChange={v=>{next=v;}}/>));
 expect(host.textContent).toContain('House-supported model');expect(host.textContent).toContain('Independent supports');expect(host.textContent).toContain('Undecided supports');
 await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='House-supported model')!.click());
 expect(Object.hasOwn(next!.selection.roof,'attachmentIntent')).toBe(false);expect(parseStudioWebsiteDesign(next,'intent-proof').ok).toBe(true);expect(next!.selection.input.connection).toBe(value.selection.input.connection);await act(async()=>root.unmount());
});
it('keeps Acrylic/Solid swatches and current roof choices while only Mixed follows the canonical band and ceiling',async()=>{
 const value=newStudioWebsiteDesign('swatch-proof');value.selection.roof.family='gable';value.selection.roof.orientation='away';
 value.selection.roof.finish={material:'combination',layout:'house',profile:'tray',trayWidth:300,acrylicBays:2,ceiling:'cedar-100'};
 let next:StudioWebsiteDesign|undefined;const host=document.createElement('div'),root=createRoot(host);
 await act(async()=>root.render(<Roof value={value} onChange={v=>{next=v;}}/>));
 const choices=[...host.querySelectorAll('button')].filter(button=>['Acrylic','Solid + timber','Mixed'].includes(button.textContent!));
 expect(choices).toHaveLength(3);expect(choices[0].querySelector('img')).toBeNull();expect(choices[1].querySelector('img')).toBeNull();
 expect(choices[2].querySelector('img')!.getAttribute('src')).toBe('/studio/mixed-gable-away-house-cedar-100.svg');
 await act(async()=>choices[0].click());expect(next!.selection.roof.finish).toEqual({...value.selection.roof.finish,material:'acrylic'});expect(parseStudioWebsiteDesign(next).ok).toBe(true);
 await act(async()=>root.unmount());
});
