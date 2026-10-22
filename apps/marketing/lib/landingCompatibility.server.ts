import 'server-only';
import {EXPERIMENT_TEMPLATE} from './landingExperiment.server';
export function landingCompatibility(expected:unknown){return {status:'template_mismatch',expected:typeof expected==='string'&&/^[a-f0-9]{64}$/.test(expected)?expected:null,current:EXPERIMENT_TEMPLATE,release:/^[a-f0-9]{40}$/.test(process.env.VERCEL_GIT_COMMIT_SHA??'')?process.env.VERCEL_GIT_COMMIT_SHA:null};}
