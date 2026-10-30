'use client';
import {useEffect} from 'react';
import {studioDocumentCallback} from '@/lib/designStudio/studioEditRoute';
import {useToast} from '@/components/ui/toast/ToastProvider';
import {navigateStudioDocument} from '@/lib/designStudio/studioDocumentNavigation';

/** Native navigation owns the document boundary. Capture before Next Link can
 * retire the working editor; modifier/new-tab/download behavior stays native. */
export default function StudioNavigationCapture({enabled}:{enabled:boolean}) {
 const toast=useToast();
 useEffect(()=>{
  if(!enabled)return;
  let pending=false;const controller=new AbortController();
  const click=(event:MouseEvent)=>{
   const anchor=event.target instanceof Element?event.target.closest('a'):null;
   if(event.defaultPrevented||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!anchor||anchor.hasAttribute('download')||(anchor.target&&anchor.target!=='_self'))return;
   const url=new URL(anchor.href,location.href);
   if(url.origin!==location.origin||url.hash)return;
   const current=studioDocumentCallback(location.pathname+location.search,true),next=studioDocumentCallback(url.pathname+url.search,true);
   if(!current&&!next)return;
   event.preventDefault();event.stopImmediatePropagation();
   if(pending)return;pending=true;
   void navigateStudioDocument(url.href,false,undefined,controller.signal).catch(error=>{if(!controller.signal.aborted)toast.error(error instanceof Error?error.message:'Design changes could not be stored. Please try again.');}).finally(()=>{pending=false;});
  };
  document.addEventListener('click',click,true);
  return()=>{controller.abort();document.removeEventListener('click',click,true);};
 },[enabled,toast]);
 return null;
}
