import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import ConfiguredEnquiryFields from './ConfiguredEnquiryFields';
it.each([
 ['/auckland-outdoor-living',true,true],
 ['/acrylic-roof-pergolas-auckland',true,true],
 ['/ads/facebook/outdoor-living',true,true],
 ['/ads/facebook/acrylic-pergolas',true,true],
 ['/ads/outdoor-living',true,false],
 ['/ads/acrylic-pergolas',true,false],
 ['/contact',true,false],
 ['/acrylic-roof-pergolas-auckland',false,false],
] as const)('preserves editorial form compatibility for %s (inline=%s)',async(sourcePath,funnel,editorial)=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const host=document.createElement('div');const root=createRoot(host);
 try{
 await React.act(async()=>root.render(<ConfiguredEnquiryFields funnel={funnel} hasDesign={false} sourcePath={sourcePath} onSubmit={event=>event.preventDefault()} errors={{}} state="idle" error={null}/>));
 const form=host.querySelector('form')!;
 expect(form.classList.contains('acrylic-form')).toBe(editorial);
 expect(form.getAttribute('data-inline-enquiry')).toBe(funnel?'true':null);
 expect(form.getAttribute('action')).toBe('/api/enquiry/fallback');
 expect(form.querySelector<HTMLInputElement>('[name=page]')?.value).toBe(sourcePath);
 expect(form.textContent).not.toContain('Your design is included');
 }finally{await React.act(async()=>root.unmount());vi.unstubAllGlobals();}
});
it('describes a direct funnel honestly and retains the native intake fallback',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const host=document.createElement('div');const root=createRoot(host);
 try{
 await React.act(async()=>root.render(<ConfiguredEnquiryFields funnel hasDesign={false} sourcePath="/ads/acrylic-pergolas" onSubmit={event=>event.preventDefault()} errors={{}} state="idle" error={null}/>));
 expect(host.textContent).not.toContain('Your design is included');
 expect(host.textContent).toContain('They are not published');
 expect(host.querySelector('form')?.getAttribute('method')).toBe('post');
 expect(host.querySelector('form')?.getAttribute('action')).toBe('/api/enquiry/fallback');
 expect(host.querySelector<HTMLInputElement>('[name=phone]')?.required).toBe(false);
 expect(host.textContent).toContain('PhoneOptional');
 expect([...host.querySelectorAll('input[required]')].map(input=>input.getAttribute('name'))).toEqual(['name','suburb','email']);
 await React.act(async()=>root.render(<ConfiguredEnquiryFields funnel hasDesign onSubmit={event=>event.preventDefault()} errors={{}} state="idle" error={null}/>));
 expect(host.textContent).toContain('Your design is included');
 expect(host.querySelector<HTMLInputElement>('[name=phone]')?.required).toBe(false);
 await React.act(async()=>root.render(<ConfiguredEnquiryFields hasDesign={false} sourcePath="/contact" onSubmit={event=>event.preventDefault()} errors={{}} state="idle" error={null}/>));
 expect(host.querySelector<HTMLInputElement>('[name=phone]')?.required).toBe(true);
 }finally{await React.act(async()=>root.unmount());vi.unstubAllGlobals();}
});
it('keeps optional fields optional and renders accepted success without the form',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);sessionStorage.clear();
 const host=document.createElement('div');const root=createRoot(host);const submit=vi.fn(event=>event.preventDefault());
 const render=(state='idle')=><ConfiguredEnquiryFields onSubmit={submit} errors={{}} state={state} error={null}/>;
 try{
 await React.act(async()=>root.render(render()));
 expect([...host.querySelectorAll('input[required]')].map(input=>input.getAttribute('name'))).toEqual(['name','suburb','email']);
 const name=host.querySelector<HTMLInputElement>('[name=name]')!;
 await React.act(async()=>{name.value='Alex';name.dispatchEvent(new Event('input',{bubbles:true}));});
 await React.act(async()=>root.render(render('error')));expect(host.querySelector<HTMLInputElement>('[name=name]')!.value).toBe('Alex');
 await React.act(async()=>root.render(render('success')));expect(host.textContent).toContain('Your enquiry has been sent');
 expect(sessionStorage.getItem('sanctuary-enquiry-contact-v1')).toBeNull();
 }finally{await React.act(async()=>root.unmount());sessionStorage.clear();vi.unstubAllGlobals();}
});
