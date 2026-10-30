import {act} from 'react';
import {expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type {StudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import StudioCommercialFields from './StudioCommercialFields';
it('shows current resolved inheritance without writing it into authored site choices, and removes stale assumptions',()=>{
 const edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'assumption-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{jobType:'commercial'},objectOptions:[],deletions:[]},change=vi.fn();
 const mount=renderIntoDocument(<StudioCommercialFields edit={edit} onChange={change} disabled={false} assumptions={{access:'Normal',height:'Single storey',jobType:'Commercial',pricingClassification:'Simple',approvalRequirement:'Neither'}}/>);
 const selects=[...mount.container.querySelectorAll('select')];expect(selects[0].selectedOptions[0].textContent).toBe('Normal (inherited)');expect(selects[2].value).toBe('commercial');expect(change).not.toHaveBeenCalled();
 act(()=>{selects[0].value='hard';selects[0].dispatchEvent(new Event('change',{bubbles:true}));});expect(change).toHaveBeenCalledWith({...edit,site:{jobType:'commercial',access:'hard'}});
 mount.rerender(<StudioCommercialFields edit={edit} onChange={change} disabled={false}/>);
 expect(mount.container.textContent).not.toContain('Normal (inherited)');expect(mount.container.textContent).toContain('current price unavailable');expect(edit.site).toEqual({jobType:'commercial'});mount.unmount();
});

it('shows every ordinary quote input directly in the compact Review without changing authored values',()=>{
 const edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'clear-input-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{jobType:'residential',pricingClassification:'bespoke',approvalRequirement:'neither',travelExGst:'75',extrasAllowanceExGst:'0',quoteDiscountPct:'5'},objectOptions:[],deletions:[]},change=vi.fn(),before=structuredClone(edit);
 const mount=renderIntoDocument(<StudioCommercialFields edit={edit} onChange={change} disabled={false} compact/>);
 for(const label of ['Site access','Building height','Job type','Pricing classification','Approvals','Travel cost excluding GST','Extra cost allowance excluding GST','Quote discount'])expect(mount.container.textContent).toContain(label);
 expect([...mount.container.querySelectorAll('select')].filter(select=>!select.closest('details'))).toHaveLength(5);expect([...mount.container.querySelectorAll('input')].every(input=>!input.closest('details'))).toBe(true);expect(change).not.toHaveBeenCalled();expect(edit).toEqual(before);mount.unmount();
});

it('presents unknown inherited quoted settings as saved facts without inventing current defaults',()=>{
 const edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'frozen-inputs',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{jobType:'commercial',travelExGst:'123'},objectOptions:[],deletions:[]},change=vi.fn(),before=structuredClone(edit);
 const mount=renderIntoDocument(<StudioCommercialFields edit={edit} onChange={change} disabled quoted compact/>);
 expect(mount.container.textContent).toContain('Inherited setting · saved with quoted design');
 expect(mount.container.textContent).not.toContain('current price unavailable');
 expect(mount.container.querySelector('fieldset')?.disabled).toBe(true);
 expect(mount.container.querySelectorAll('select')[2].value).toBe('commercial');
 expect(edit).toEqual(before);expect(change).not.toHaveBeenCalled();
 mount.rerender(<StudioCommercialFields edit={edit} onChange={change} disabled compact/>);
 expect(mount.container.textContent).toContain('current price unavailable');
 mount.unmount();
});
