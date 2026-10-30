import {validateCommercialInternalName} from '@/lib/commercial/internalName';
import {getSafeCallbackUrl} from '@/lib/portalAccess';

/** Routing only. This value never admits a user or replaces a fresh guard. */
export const STUDIO_EDIT_CALLBACK_HEADER='x-sanctuary-studio-callback';
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const canonicalEdit=new RegExp(`^/staff/design-studio/proj_${uuid}/est_${uuid}/edit$`);
const canonicalReview=new RegExp(`^/staff/design-studio/proj_${uuid}/est_${uuid}$`);

export function studioEditQuery(query:Record<string,string|string[]|undefined>){
 const intent=query.intent??'edit';
 if(Object.keys(query).some(key=>!['intent','name'].includes(key))||Array.isArray(intent)||!['edit','revision','duplicate'].includes(intent)||Array.isArray(query.name))return null;
 const name=validateCommercialInternalName(query.name);
 if(!name.ok||(query.name!==undefined&&intent!=='duplicate'))return null;
 const search=new URLSearchParams();
 for(const key of ['intent','name'])if(typeof query[key]==='string')search.set(key,query[key] as string);
 return{intent:intent as 'edit'|'revision'|'duplicate',duplicateName:name.value??undefined,search:search.size?`?${search}`:''};
}

/** Only the enabled, exact canonical route can receive the proxy optimisation. */
export function studioEditCallback(raw:string|null|undefined,enabled:boolean):string|null{
 if(!enabled||typeof raw!=='string'||getSafeCallbackUrl(raw,'')!==raw)return null;
 const url=new URL(raw,'https://studio-route.invalid');
 if(!canonicalEdit.test(url.pathname)||url.hash)return null;
 // Next's stripInternalQueries removes this transport-only field before page
 // searchParams. Keep the same boundary without accepting other unknown keys.
 url.searchParams.delete('_rsc');
 const query:Record<string,string>=Object.create(null);
 for(const key of url.searchParams.keys()){
  if(url.searchParams.getAll(key).length!==1)return null;
  query[key]=url.searchParams.get(key)!;
 }
 const selected=studioEditQuery(query);
 return selected?url.pathname+selected.search:null;
}

/** Exact public presentation only. Unknown queries/aliases retain protection. */
export function studioReviewCallback(raw:string|null|undefined,enabled:boolean):string|null {
 if(!enabled||typeof raw!=='string'||getSafeCallbackUrl(raw,'')!==raw)return null;
 const url=new URL(raw,'https://studio-route.invalid');
 if(!canonicalReview.test(url.pathname)||url.hash)return null;
 url.searchParams.delete('_rsc');
 if([...url.searchParams.keys()].some(key=>key!=='quoteVersionId')||url.searchParams.getAll('quoteVersionId').length>1)return null;
 const quote=url.searchParams.get('quoteVersionId');
 if(quote!==null&&!new RegExp(`^qv_${uuid}$`).test(quote))return null;
 const search=new URLSearchParams();if(quote!==null)search.set('quoteVersionId',quote);
 return url.pathname+(search.size?`?${search}`:'');
}

/** Public presentation only. Revision/duplicate keep their protected page flow. */
export function studioDocumentCallback(raw:string|null|undefined,enabled:boolean):string|null {
 const review=studioReviewCallback(raw,enabled);if(review)return review;
 const callback=studioEditCallback(raw,enabled);
 if(!callback)return null;
 return (new URL(callback,'https://studio-route.invalid').searchParams.get('intent')??'edit')==='edit'?callback:null;
}
