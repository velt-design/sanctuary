'use client';
import {useEffect,useLayoutEffect,useRef,type FormEventHandler} from 'react';
import Link from 'next/link';
import type {ContactFieldErrors} from './contactFormModel';
import css from '../design-enquiry/enquiry.module.css';
const key='sanctuary-enquiry-contact-v1';
export default function ConfiguredEnquiryFields({onSubmit,errors,state,error,receivedEarlier=false,mobileFinish=false}:{onSubmit:FormEventHandler<HTMLFormElement>;errors:ContactFieldErrors;state:string;error:string|null;receivedEarlier?:boolean;mobileFinish?:boolean}){
 const form=useRef<HTMLFormElement>(null);
 const status=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{try{const values=JSON.parse(sessionStorage.getItem(key)??'{}');for(const name of ['name','suburb','email','phone','message']){const field=form.current?.elements.namedItem(name);if((field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement)&&!field.value)field.value=typeof values[name]==='string'?values[name]:'';}}catch{/* Keep the form usable without browser storage. */}},[]);
 useEffect(()=>{if(state==='success'&&!receivedEarlier){try{sessionStorage.removeItem(key);}catch{} }if(state==='error'||state==='success'||Object.keys(errors).length)status.current?.focus();},[state,errors,receivedEarlier]);
 const save=()=>{if(!form.current)return;const data=new FormData(form.current);try{sessionStorage.setItem(key,JSON.stringify(Object.fromEntries(['name','suburb','email','phone','message'].map(name=>[name,data.get(name)]))));}catch{}};
 if(state==='success')return <div className={css.form} ref={status} tabIndex={-1} role="status">{receivedEarlier?<><h1>Your earlier enquiry was received.</h1><p>Changes made after your first send attempt are not included in that enquiry.</p><p>We’ll contact you to discuss your design. You can tell us about any changes then.</p></>:<><h1>{mobileFinish?'Design saved. Enquiry sent.':'Your enquiry has been sent.'}</h1><p>We’ll review your design and contact you to discuss the next step.</p>{!mobileFinish&&<p>Your design is shown here for reference.</p>}</>}</div>;
 return <form data-clarity-mask="true" className={css.form} ref={form} onInput={save} onSubmit={onSubmit} noValidate>
 <h1>{mobileFinish?'Your details':'Enquire about your design.'}</h1><p>{mobileFinish?'Your design is saved with your enquiry when you send.':'We’ll review your pergola and contact you to discuss your space.'}</p>
 <input type="hidden" name="enquiryType" value="residential"/><input type="hidden" name="requestType" value="project-discussion"/>
 {(Object.keys(errors).length>0||error)&&<div ref={status} tabIndex={-1} role="alert" className={css.error}>{error||'Please check the details below.'}</div>}
 <div className={css.fields}>{(['name','suburb','email','phone'] as const).map(name=><label key={name} htmlFor={`contact-${name}`}>{name[0].toUpperCase()+name.slice(1)}{name==='phone'&&<small>Optional</small>}<input id={`contact-${name}`} name={name} type={name==='email'?'email':name==='phone'?'tel':'text'} autoComplete={name==='suburb'?'address-level2':name==='phone'?'tel':name} required={name!=='phone'} aria-invalid={!!errors[name]} aria-describedby={errors[name]?`error-${name}`:undefined}/>{errors[name]&&<span id={`error-${name}`} className={css.error}>{errors[name]}</span>}</label>)}</div>
 {mobileFinish?<details><summary>Add a note (optional)</summary><label htmlFor="contact-message">Message<textarea id="contact-message" name="message" rows={3}/></label></details>:<label htmlFor="contact-message">Message <small>Optional</small><textarea id="contact-message" name="message" rows={3}/></label>}
 <div hidden aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off"/></div>
 <button type="submit" className={css.send} disabled={state==='sending'}>{state==='sending'?'Sending…':mobileFinish?'Enquire about this design':'Send my enquiry'}</button>
 <p className={css.privacy}>Your design is included. <Link href="/privacy">Privacy policy</Link></p>
 </form>;
}
