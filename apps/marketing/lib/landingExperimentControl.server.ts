import 'server-only';
import { unstable_cache } from 'next/cache';
import { getServiceSupabase } from './supabaseService';
import { EXPERIMENT_TEMPLATE } from './landingExperiment.server';
import { isExperimentPath, parseLandingCopies, type LandingCopies } from './landingExperiment';
/** Public approved copy only. No cookie, assignment or visitor data is read. */
const read = unstable_cache(async(path:string):Promise<LandingCopies>=>{
  const result=await getServiceSupabase().rpc('landing_experiment_public_control',{p_path:path,p_template:EXPERIMENT_TEMPLATE}).abortSignal(AbortSignal.timeout(1500));
  if(result.error)throw new Error('Control unavailable');
  return parseLandingCopies(result.data)??{};
},['landing-approved-control',EXPERIMENT_TEMPLATE],{revalidate:60});
export async function landingControl(path:string):Promise<LandingCopies>{
  if(process.env.SANCTUARY_LANDING_EXPERIMENT_ENABLED!=='true'||!isExperimentPath(path))return {};
  try{return await read(path);}catch{return {};}
}
