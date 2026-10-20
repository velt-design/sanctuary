// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import Shape from './StudioWebsiteShapeControls';
import Roof from './StudioWebsiteRoofControls';
import {newStudioWebsiteDesign,parseStudioWebsiteDesign,type StudioWebsiteDesign} from '../../lib/designStudio/websiteDesign';
import {DEFAULT_ROOF_BATTENS} from '@sp/configurator/website';
it('Attached removes the optional key and remains a strict safe editable design',async()=>{
 const value=newStudioWebsiteDesign('p1');value.selection.roof.attachmentIntent='freestanding';let next:StudioWebsiteDesign|undefined;
 const host=document.createElement('div'),root=createRoot(host);await act(async()=>root.render(<Shape value={value} onChange={v=>{next=v;}}/>));
 await act(async()=>{Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Attached')!.click();});
 expect(next).toBeDefined();expect(Object.hasOwn(next!.selection.roof,'attachmentIntent')).toBe(false);expect(parseStudioWebsiteDesign(next,'p1').ok).toBe(true);await act(async()=>root.unmount());
});
it('turning roof battens off omits the option but retains dormant raw input safely',async()=>{
 const value=newStudioWebsiteDesign('p1');value.selection.roof.roofBattens={...DEFAULT_ROOF_BATTENS};value.rawGaps={roof:'bad'};let next:StudioWebsiteDesign|undefined;
 const host=document.createElement('div'),root=createRoot(host);await act(async()=>root.render(<Roof value={value} onChange={v=>{next=v;}}/>));
 await act(async()=>{(host.querySelector('input[type=checkbox]') as HTMLInputElement).click();});
 expect(next).toBeDefined();expect(Object.hasOwn(next!.selection.roof,'roofBattens')).toBe(false);expect(next!.rawGaps).toEqual({roof:'bad'});expect(parseStudioWebsiteDesign(next,'p1').ok).toBe(true);await act(async()=>root.unmount());
});
