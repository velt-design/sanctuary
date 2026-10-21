'use client';
import {useEffect,useState} from 'react';
import {isExperimentPath,experimentCookieName,experimentSeenKey,EXPERIMENT_SEEN_EVENT} from '../../lib/landingExperiment';
/** Capture this form's experienced receipt, not whatever a different tab sees later. */
export function ExperimentReceiptField({sourcePath}:{sourcePath?:string}){
 const [receipt,setReceipt]=useState('');
 useEffect(()=>{
  if(!isExperimentPath(sourcePath)){setReceipt('');return;}
  const name=experimentCookieName(sourcePath);
  let experienced='';try{experienced=sessionStorage.getItem(experimentSeenKey(sourcePath))??'';}catch{/* Cookie fallback. */}
  setReceipt(experienced||(document.cookie.split(';').map(value=>value.trim()).find(value=>value.startsWith(`${name}=`))?.slice(name.length+1)??''));
  const changed=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail===null)setReceipt('');else if(detail?.path===sourcePath&&typeof detail.receipt==='string'&&detail.receipt.length<=1500)setReceipt(detail.receipt);};
  window.addEventListener(EXPERIMENT_SEEN_EVENT,changed);return()=>window.removeEventListener(EXPERIMENT_SEEN_EVENT,changed);
 },[sourcePath]);
 return <input type="hidden" name="experimentReceipt" value={receipt} readOnly/>;
}
