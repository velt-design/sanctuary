import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import Placement from './StudioWebsitePlacementControls';
vi.mock('@sp/configurator/react/controls',()=>({useLighting:()=>null}));
it('restored Position waits safely for session hydration',async()=>{
 const host=document.createElement('div'),root=createRoot(host);
 const props={label:'Pergola',edit:null,row:undefined,attachmentKind:'roof_eave',onAttachmentKind:()=>{},position:null,onChange:()=>{},onBack:()=>{},onAttach:()=>{},onDetach:()=>{},onHeight:()=>{},onHouse:()=>{},onPickEdge:()=>{},pickingEdge:false} as unknown as React.ComponentProps<typeof Placement>;
 await act(async()=>root.render(<Placement {...props}/>));
 expect(host.querySelector('[role=status]')?.textContent).toContain('Opening your saved choices');expect(host.querySelector('input,select')).toBeNull();
 await act(async()=>root.unmount());
});
