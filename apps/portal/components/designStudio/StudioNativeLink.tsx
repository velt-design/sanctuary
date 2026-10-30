'use client';
import {useEffect,useRef,type ComponentProps,type MouseEventHandler} from 'react';
import Link from 'next/link';
import {ButtonLink,type ButtonLinkProps} from '@/components/ui/foundation';
import {useToast} from '@/components/ui/toast/ToastProvider';
import {studioDocumentCallback} from '@/lib/designStudio/studioEditRoute';
import {navigateStudioDocument} from '@/lib/designStudio/studioDocumentNavigation';

function useStudioEntry(href:string,onClick?:MouseEventHandler<HTMLAnchorElement>){
 const toast=useToast(),pending=useRef(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 return ((event)=>{
  onClick?.(event);
  const anchor=event.currentTarget,url=new URL(href,location.href);
  if(event.defaultPrevented||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||anchor.hasAttribute('download')||(anchor.target&&anchor.target!=='_self')||url.origin!==location.origin||url.hash||!studioDocumentCallback(url.pathname+url.search,true))return;
  event.preventDefault();
  if(pending.current)return;pending.current=true;
  const active=new AbortController();controller.current=active;
  void navigateStudioDocument(url.href,false,undefined,active.signal).catch(error=>{if(!active.signal.aborted)toast.error(error instanceof Error?error.message:'Design changes could not be stored. Please try again.');}).finally(()=>{pending.current=false;});
 }) satisfies MouseEventHandler<HTMLAnchorElement>;
}

/** Keep the ordinary href and modified-link behaviour; only exact Studio entry
 * waits for the existing same-owner local persistence before native navigation. */
export default function StudioNativeLink({href,onClick,...props}:Omit<ComponentProps<typeof Link>,'href'>&{href:string}){
 const click=useStudioEntry(href,onClick);
 return <Link {...props} prefetch={studioDocumentCallback(href,true)?false:props.prefetch} href={href} onClick={click}/>;
}
export function StudioNativeButtonLink({href,onClick,...props}:ButtonLinkProps){
 const click=useStudioEntry(href,onClick);
 return <ButtonLink {...props} prefetch={studioDocumentCallback(href,true)?false:props.prefetch} href={href} onClick={click}/>;
}
