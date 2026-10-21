import { useState,act } from 'react';
import { it,expect,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { unassignedDesigner,type SalesDesigner } from '@/lib/marketingPerformance/salesDesigner';
import SalesDesignerAssignment,{AssignmentError,type AssignmentClient} from './SalesDesignerAssignment';
const projectId='77777777-7777-4777-8777-777777777777',empty=unassignedDesigner(projectId);
const saved:SalesDesigner={...empty,designerKey:'jordan',revision:1,updatedAt:'2026-10-21T00:00:00Z',basis:'Confirmed responsibility'};
function Harness({client}:{client:AssignmentClient}){const [value,setValue]=useState(empty);return <SalesDesignerAssignment value={value} onChange={setValue} client={client}/>;}
function click(root:HTMLElement,label:string){act(()=>[...root.querySelectorAll('button')].find(b=>b.textContent===label)!.click());}
function edit(root:HTMLElement){click(root,'Assign sales designer');act(()=>{const select=root.querySelector('select')!;select.value='jordan';select.dispatchEvent(new Event('change',{bubbles:true}));const text=root.querySelector('textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(text,'Confirmed responsibility');text.dispatchEvent(new Event('input',{bubbles:true}));});}
const flush=()=>act(async()=>{await Promise.resolve();});
it('reconciles an uncertain response with the identical command, then reads current assignment',async()=>{
 const client={assign:vi.fn().mockRejectedValueOnce(new Error('Lost response')).mockResolvedValue(saved),read:vi.fn().mockResolvedValue(saved)};
 const view=renderIntoDocument(<Harness client={client}/>);edit(view.container);click(view.container,'Save assignment');await flush();
 expect(view.container.textContent).toContain('save result is uncertain');expect(view.container.querySelector('select')!.disabled).toBe(true);
 click(view.container,'Retry same save');await flush();expect(client.assign.mock.calls[1]).toEqual(client.assign.mock.calls[0]);expect(client.read).toHaveBeenCalledWith(projectId);
 expect(view.container.textContent).toContain('Sales designer: Jordan');expect(view.container.querySelector('textarea')).toBeNull();view.unmount();
});
it('requires current revision reload after a concurrent edit, preserving the reason for deliberate retry',async()=>{
 const current={...saved,designerKey:'joe' as const,revision:3};const client={assign:vi.fn().mockRejectedValueOnce(new AssignmentError(409)).mockResolvedValue(saved),read:vi.fn().mockResolvedValue(current)};
 const view=renderIntoDocument(<Harness client={client}/>);edit(view.container);click(view.container,'Save assignment');await flush();expect(view.container.textContent).toContain('Someone changed');
 click(view.container,'Reload assignment');await flush();expect(view.container.querySelector('select')!.value).toBe('joe');expect(view.container.querySelector('textarea')!.value).toBe('Confirmed responsibility');
 click(view.container,'Save assignment');await flush();expect(client.assign.mock.calls[1][1]).toMatchObject({expectedRevision:3,designerKey:'joe'});expect(client.assign.mock.calls[1][1].commandId).not.toBe(client.assign.mock.calls[0][1].commandId);view.unmount();
});
it('does not write on cancel, denied access, or a read-only synthetic fixture',async()=>{
 const client={assign:vi.fn().mockRejectedValue(new AssignmentError(403)),read:vi.fn()};const view=renderIntoDocument(<Harness client={client}/>);edit(view.container);click(view.container,'Cancel');expect(client.assign).not.toHaveBeenCalled();
 edit(view.container);click(view.container,'Save assignment');await flush();expect(view.container.textContent).toContain('Owner access is required');expect(client.read).not.toHaveBeenCalled();view.unmount();
 const demo=renderIntoDocument(<SalesDesignerAssignment value={empty} onChange={vi.fn()} readOnly client={client}/>);expect(demo.container.querySelector('button')!.disabled).toBe(true);demo.unmount();
});
