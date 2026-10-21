import {act} from 'react';
import {expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../../../test/reactHarness';
import QuoteLineItemsEditor from './QuoteLineItemsEditor';
it('keeps Studio commercial text editable without calculator-specific warnings and preserves the ordinary warning',()=>{
 const update=vi.fn(),description='Pergola 2 · Rafter lighting · 12 lights\n- Selected lights, installed.';
 const props={editable:true,draftItems:[{id:'line',description,qty:1,unitPriceIncGstCents:12300,lineTotalIncGstCents:12300,sortOrder:0}],setDraftItems:vi.fn(),unitInputDrafts:{},setUnitInputDrafts:vi.fn(),activeUnitInputId:null,setActiveUnitInputId:vi.fn(),getLiveUnitPriceIncGstCents:()=>12300,parsedPergolaDrafts:new Map(),draftPergolaOverrideMode:{},setDraftPergolaOverrideMode:vi.fn(),updateDraftItemDescription:update,updatePergolaModule:vi.fn(),updatePergolaSharedField:vi.fn(),commitUnitPriceDraft:vi.fn(),moveRow:vi.fn(),deleteRow:vi.fn(),addRow:vi.fn()};
 const m=renderIntoDocument(<QuoteLineItemsEditor {...props} structuredPergolas={false}/>);
 expect(m.container.textContent).not.toContain('Manual pergola text');const input=m.container.querySelector('textarea')!;expect(input.value).toBe(description);
 act(()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,description+' Confirmed.');input.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(update).toHaveBeenCalledWith('line',description+' Confirmed.');
 m.rerender(<QuoteLineItemsEditor {...props}/>);expect(m.container.textContent).toContain('Manual pergola text');expect(m.container.querySelector('textarea')!.value).toBe(description);m.unmount();
});
