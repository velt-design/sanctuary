'use client';
import {useEffect,useLayoutEffect,useRef,type FormEventHandler,type ReactNode} from 'react';
import AdvertisingMeasurementNotice from '../../components/enquiry/AdvertisingMeasurementNotice';
import {ExperimentReceiptField} from '../../components/landing-experiment/ExperimentReceiptField';
import {isInlineFunnelPath,isGoogleFunnelPath} from '../../lib/googleFunnel';
import {allowsOptionalEnquiryPhone} from '../../lib/enquiryContactValidation';
import type {ContactFieldErrors} from './contactFormModel';
import css from '../design-enquiry/enquiry.module.css';
const key='sanctuary-enquiry-contact-v1';
export default function ConfiguredEnquiryFields({onSubmit,onInteraction,attachments,errors,state,error,receivedEarlier=false,mobileFinish=false,funnel=false,hasDesign=true,sourcePath='/contact',sourceContext='{}'}:{attachments?:ReactNode;onSubmit:FormEventHandler<HTMLFormElement>;onInteraction?:()=>void;errors:ContactFieldErrors;state:string;error:string|null;receivedEarlier?:boolean;mobileFinish?:boolean;funnel?:boolean;hasDesign?:boolean;sourcePath?:string;sourceContext?:string}){
 const form=useRef<HTMLFormElement>(null);
 const attachmentsPanel=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{if(errors.files&&attachmentsPanel.current)attachmentsPanel.current.open=true;},[errors.files]);
 const hasErrors=Object.values(errors).some(Boolean);
 const phoneOptional=hasDesign||(funnel&&allowsOptionalEnquiryPhone('residential',sourcePath,'project-discussion'));
 // Preserve the editorial form hook independently of advertising attribution.
 const editorialForm=funnel&&isInlineFunnelPath(sourcePath)&&!isGoogleFunnelPath(sourcePath);
 const status=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{try{const values=JSON.parse(sessionStorage.getItem(key)??'{}');for(const name of ['name','suburb','email','phone','message']){const field=form.current?.elements.namedItem(name);if((field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement)&&!field.value)field.value=typeof values[name]==='string'?values[name]:'';}}catch{/* Keep the form usable without browser storage. */}},[]);
 useEffect(()=>{if(state==='success'&&!receivedEarlier){try{sessionStorage.removeItem(key);}catch{} }if(state==='error'||state==='success'||hasErrors)status.current?.focus();},[state,errors,hasErrors,receivedEarlier]);
 const save=()=>{if(!form.current)return;const data=new FormData(form.current);try{sessionStorage.setItem(key,JSON.stringify(Object.fromEntries(['name','suburb','email','phone','message'].map(name=>[name,data.get(name)]))));}catch{}};
 if(state==='success')return <div className={css.form} ref={status} tabIndex={-1} role="status">{receivedEarlier?<><h1>Your earlier enquiry was received.</h1><p>Changes made after your first send attempt are not included in that enquiry.</p><p>We’ll contact you to discuss your design. You can tell us about any changes then.</p></>:<><h1>{mobileFinish?'Design saved. Enquiry sent.':'Your enquiry has been sent.'}</h1><p>We’ll review your enquiry and contact you to discuss the next step.</p>{!mobileFinish&&hasDesign&&<p>Your design is shown here for reference.</p>}</>}</div>;
 return <form method="post" action="/api/enquiry/fallback" data-clarity-mask="true" data-inline-enquiry={funnel||undefined} className={`${css.form}${editorialForm?' acrylic-form':''}`} ref={form} onInput={save} onInputCapture={onInteraction} onChangeCapture={onInteraction} onSubmit={onSubmit} noValidate>
 <ExperimentReceiptField sourcePath={sourcePath}/>
 {funnel ? <h3>Your details</h3> : <><h1>{mobileFinish?'Your details':'Enquire about your design.'}</h1><p>{mobileFinish?'Your design is saved with your enquiry when you send.':'We’ll review your pergola and contact you to discuss your space.'}</p></>}
 <input type="hidden" name="page" value={sourcePath}/><input type="hidden" name="source" value="website"/><input type="hidden" name="enquiryContext" value={sourceContext}/><input type="hidden" name="enquiryType" value="residential"/><input type="hidden" name="requestType" value="project-discussion"/>
 {(hasErrors||error)&&<div ref={status} tabIndex={-1} role="alert" className={css.error}>{error||'Please check the details below.'}</div>}
 <div className={css.fields}>{(['name','suburb','email','phone'] as const).map(name=><label key={name} htmlFor={`contact-${name}`}>{name[0].toUpperCase()+name.slice(1)}{name==='phone'&&phoneOptional&&<small>Optional</small>}<input id={`contact-${name}`} name={name} type={name==='email'?'email':name==='phone'?'tel':'text'} autoComplete={name==='suburb'?'address-level2':name==='phone'?'tel':name} required={name!=='phone'||!phoneOptional} aria-invalid={!!errors[name]} aria-describedby={errors[name]?`error-${name}`:undefined}/>{errors[name]&&<span id={`error-${name}`} className={css.error}>{errors[name]}</span>}</label>)}</div>
 {mobileFinish?<details><summary>Add a note (optional)</summary><label htmlFor="contact-message">Message<textarea id="contact-message" name="message" rows={3}/></label></details>:<label htmlFor="contact-message">Message <small>Optional</small><textarea id="contact-message" name="message" rows={3}/></label>}
 {attachments&&<details ref={attachmentsPanel} data-enquiry-attachments><summary>Add photos or plans (optional)</summary>{attachments}</details>}
 <div hidden aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off"/></div>
 <button type="submit" className={css.send} disabled={state==='sending'}>{state==='sending'?'Sending…':mobileFinish?'Enquire about this design':'Send my enquiry'}</button>
 {funnel&&<p data-enquiry-next-step>No measurements needed. Free Auckland site measures. We usually respond within the working day.</p>}
 <AdvertisingMeasurementNotice configured={hasDesign} className={css.privacy}/>
 </form>;
}
