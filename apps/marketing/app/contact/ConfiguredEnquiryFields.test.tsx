import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import ConfiguredEnquiryFields from './ConfiguredEnquiryFields';
it('retains entered details across editing, keeps optional fields optional, and clears details after success',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);sessionStorage.clear();
 const host=document.createElement('div');const root=createRoot(host);const submit=vi.fn(event=>event.preventDefault());
 const render=(state='idle')=><ConfiguredEnquiryFields onSubmit={submit} errors={{}} state={state} error={null}/>;
 try{
 await React.act(async()=>root.render(render()));
 expect([...host.querySelectorAll('input[required]')].map(input=>input.getAttribute('name'))).toEqual(['name','suburb','email']);
 const name=host.querySelector<HTMLInputElement>('[name=name]')!;
 await React.act(async()=>{name.value='Alex';name.dispatchEvent(new Event('input',{bubbles:true}));});
 await React.act(async()=>root.render(null));await React.act(async()=>root.render(render()));
 expect(host.querySelector<HTMLInputElement>('[name=name]')!.value).toBe('Alex');
 await React.act(async()=>root.render(render('error')));expect(host.querySelector<HTMLInputElement>('[name=name]')!.value).toBe('Alex');
 await React.act(async()=>root.render(render('success')));expect(host.textContent).toContain('Your enquiry has been sent');
 expect(sessionStorage.getItem('sanctuary-enquiry-contact-v1')).toBeNull();
 }finally{await React.act(async()=>root.unmount());sessionStorage.clear();vi.unstubAllGlobals();}
});
