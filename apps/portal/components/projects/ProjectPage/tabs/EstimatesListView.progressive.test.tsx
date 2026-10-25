import {act} from 'react';
import {expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../../../test/reactHarness';
import EstimatesListView from './EstimatesListView';
import {estimates,projectId} from '../../../../app/qa/project-page-shell-fixture/commercialClarityData';
it('keeps the actual estimate search/header through pending, error and a filtered complete read',()=>{
 const handlers={onRetry:vi.fn(),onCreate:vi.fn(),onCreateAddOn:vi.fn(),onOpen:vi.fn(),onDuplicate:vi.fn(),onRename:vi.fn()},props={projectId,quotes:[],quoteReadState:'loading' as const,...handlers};const view=renderIntoDocument(<EstimatesListView {...props} estimates={[]} loading error={null}/>),table=view.container.querySelector('table'),input=view.container.querySelector('input')!;
 expect(table?.textContent).toContain('Linked quotes');expect(table?.textContent).toContain('Reading estimates');expect(view.container.textContent).not.toContain('No estimates yet');act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Screen');input.dispatchEvent(new Event('input',{bubbles:true}));});view.rerender(<EstimatesListView {...props} estimates={[]} loading={false} error="Read failed"/>);expect(view.container.querySelector('table')).toBe(table);expect(view.container.querySelector('input')).toBe(input);expect(table?.textContent).toContain('Estimates unavailable');view.rerender(<EstimatesListView {...props} estimates={estimates} loading={false} error={null}/>);expect(view.container.querySelector('table')).toBe(table);expect(table?.textContent).toContain('Screen option');expect(table?.textContent).not.toContain('Louvre roof');expect(input.value).toBe('Screen');view.unmount();
});
