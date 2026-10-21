import { experimentCookieName,experimentSeenKey,LANDING_EXPERIMENT_PATHS,EXPERIMENT_SEEN_EVENT } from './landingExperiment';
/** Consent withdrawal applies on the designer/contact return path as well. */
export function clearLandingAssignment() {
  for(const path of LANDING_EXPERIMENT_PATHS){
  let experienced:string|null=null;
  try{experienced=sessionStorage.getItem(experimentSeenKey(path));sessionStorage.removeItem(experimentSeenKey(path));}catch{/* Withdrawal still clears cookies and mounted fields. */}
  const name=experimentCookieName(path);
  const stored=document.cookie.split(';').map(value=>value.trim()).find(value=>value.startsWith(`${name}=`))?.slice(name.length+1);
  document.cookie=`${name}=; Path=/; SameSite=Lax; Secure; Max-Age=0`;
  for(const receipt of new Set([experienced,stored])){
  if(!receipt||receipt.length>1500)continue;
  try {
    const row=JSON.parse(atob(receipt.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));
    if(row.path===path)void fetch('/api/landing-experiment',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({stage:'revoke',path,receipt,consent:false}),keepalive:true}).catch(()=>undefined);
  }catch{/* A malformed optional receipt cannot prevent withdrawal. */}
  }
  }
  window.dispatchEvent(new CustomEvent(EXPERIMENT_SEEN_EVENT,{detail:null}));
}
