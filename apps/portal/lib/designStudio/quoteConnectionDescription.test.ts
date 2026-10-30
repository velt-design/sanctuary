import {expect,it} from 'vitest';
import {quoteConnectionDescription} from './quoteConnectionDescription';
it('distinguishes selected connection options, actual house bindings and freestanding products',()=>{
 const selected={design:{input:{connection:'facade'},roof:{}}} as any;
 expect(quoteConnectionDescription(selected)).toBe('Wall connection selected. No house edge is assigned.');
 expect(quoteConnectionDescription({...selected,studioAttachment:{method:'soffit',edge:'rear'}})).toBe('Soffit brackets connection to the rear house edge');
 expect(quoteConnectionDescription({design:{...selected.design,roof:{attachmentIntent:'freestanding'}}} as any)).toBe('Freestanding');
});
