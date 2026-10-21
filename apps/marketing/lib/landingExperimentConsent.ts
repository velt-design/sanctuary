import { isExperimentPath,experimentCookieName,experimentSeenKey,LANDING_EXPERIMENT_PATHS,EXPERIMENT_SEEN_EVENT } from './landingExperiment';
/** Consent withdrawal applies on the designer/contact return path as well. */
export function clearLandingAssignment() {
  for(const path of LANDING_EXPERIMENT_PATHS){
  try{sessionStorage.removeItem(experimentSeenKey(path));}catch{/* Withdrawal still clears cookies and mounted fields. */}
  const name=experimentCookieName(path);
  const stored=document.cookie.split(';').map(value=>value.trim()).find(value=>value.startsWith(`${name}=`))?.slice(name.length+1);
  if(!stored)continue;
  document.cookie=`${name}=; Path=/; SameSite=Lax; Secure; Max-Age=0`;
  try {
    const row=JSON.parse(atob(stored.split('.')[0].replace(/-/g,'+').replace(/_/g,'/')));
    if(isExperimentPath(row.path))void fetch('/api/landing-experiment',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({stage:'revoke',path:row.path,receipt:stored,consent:false}),keepalive:true}).catch(()=>undefined);
  }catch{/* A malformed optional receipt cannot prevent withdrawal. */}
  }
  window.dispatchEvent(new CustomEvent(EXPERIMENT_SEEN_EVENT,{detail:null}));
}
