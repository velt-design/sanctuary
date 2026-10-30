import {getLocalFirstStoreOwner} from '@/lib/localFirst/store';
import {prepareStudioNavigation} from './studioSessionLifecycle';

/** Await local accepted work, not a server Save, before replacing its document. */
export async function navigateStudioDocument(href:string,replace=false,navigate:(url:string,replace:boolean)=>void=(url,replace)=>replace?location.replace(url):location.assign(url),signal?:AbortSignal) {
 const owner=getLocalFirstStoreOwner(),prepared=owner?prepareStudioNavigation(owner):null;
 let masked=false;
 try {
  await prepared?.ready;
  signal?.throwIfAborted();
  if(prepared&&!prepared.valid())throw Error('The signed-in owner changed. Navigation was stopped.');
  // Hand off the action fence synchronously to the document's leaving mask.
  // No await can expose an eligible old controller between these operations.
  prepared?.release();
  window.dispatchEvent(new Event('studio:document-leaving'));
  masked=true;
  navigate(href,replace);
 }catch(error){if(masked)window.dispatchEvent(new Event('studio:document-staying'));throw error;}
 finally {prepared?.release();}
}
