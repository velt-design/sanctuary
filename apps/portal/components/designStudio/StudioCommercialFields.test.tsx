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
