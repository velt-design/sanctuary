import { useState,act } from 'react';
import { it,expect,vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { unrecordedSalesOutcome,type SalesOutcome } from '@/lib/marketingPerformance/salesOutcome';
import ProjectSalesOutcome,{OutcomeError,type OutcomeClient} from './ProjectSalesOutcome';
const projectId='77777777-7777-4777-8777-777777777777',empty=unrecordedSalesOutcome(projectId);
const saved:SalesOutcome={...empty,outcome:'refunded',revision:1,updatedAt:'2026-10-21T00:00:00Z',basis:'Confirmed responsibility'};
function Harness({client}:{client:OutcomeClient}){const [value,setValue]=useState(empty);return <ProjectSalesOutcome value={value} onChange={setValue} client={client}/>;}
function click(root:HTMLElement,label:string){act(()=>[...root.querySelectorAll('button')].find(b=>b.textContent===label)!.click());}
function edit(root:HTMLElement){click(root,'Record sales outcome');act(()=>{const select=root.querySelector('select')!;select.value='refunded';select.dispatchEvent(new Event('change',{bubbles:true}));const text=root.querySelector('textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(text,'Confirmed responsibility');text.dispatchEvent(new Event('input',{bubbles:true}));});}
const flush=()=>act(async()=>{await Promise.resolve();});
it('reconciles an uncertain response with the identical command, then reads current assignment',async()=>{
 const client={record:vi.fn().mockRejectedValueOnce(new Error('Lost response')).mockResolvedValue(saved),read:vi.fn().mockResolvedValue(saved)};
 const view=renderIntoDocument(<Harness client={client}/>);edit(view.container);click(view.container,'Save outcome');await flush();
 expect(view.container.textContent).toContain('save result is uncertain');expect(view.container.querySelector('select')!.disabled).toBe(true);
 click(view.container,'Retry same save');await flush();expect(client.record.mock.calls[1]).toEqual(client.record.mock.calls[0]);expect(client.read).toHaveBeenCalledWith(projectId);
 expect(view.container.textContent).toContain('Sales outcome: Refunded');expect(view.container.querySelector('textarea')).toBeNull();view.unmount();
});
it('requires current revision reload after a concurrent edit, preserving the reason for deliberate retry',async()=>{
 const current={...saved,outcome:'cancelled' as const,revision:3};const client={record:vi.fn().mockRejectedValueOnce(new OutcomeError(409)).mockResolvedValue(saved),read:vi.fn().mockResolvedValue(current)};
 const view=renderIntoDocument(<Harness client={client}/>);edit(view.container);click(view.container,'Save outcome');await flush();expect(view.container.textContent).toContain('Someone changed');
 click(view.container,'Reload outcome');await flush();expect(view.container.querySelector('select')!.value).toBe('cancelled');expect(view.container.querySelector('textarea')!.value).toBe('Confirmed responsibility');
 click(view.container,'Save outcome');await flush();expect(client.record.mock.calls[1][1]).toMatchObject({expectedRevision:3,outcome:'cancelled'});expect(client.record.mock.calls[1][1].commandId).not.toBe(client.record.mock.calls[0][1].commandId);view.unmount();
});
it('does not write on cancel, denied access, or a read-only synthetic fixture',async()=>{
 const client={record:vi.fn().mockRejectedValue(new OutcomeError(403)),read:vi.fn()};const view=renderIntoDocument(<Harness client={client}/>);edit(view.container);click(view.container,'Cancel');expect(client.record).not.toHaveBeenCalled();
 edit(view.container);click(view.container,'Save outcome');await flush();expect(view.container.textContent).toContain('Owner access is required');expect(client.read).not.toHaveBeenCalled();view.unmount();
 const demo=renderIntoDocument(<ProjectSalesOutcome value={empty} onChange={vi.fn()} readOnly client={client}/>);expect(demo.container.querySelector('button')!.disabled).toBe(true);demo.unmount();
});
