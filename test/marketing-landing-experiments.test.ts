// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect,it,vi } from 'vitest';
import {landingExperimentTestBootstrap} from '../scripts/lib/landing-experiment-test-bootstrap.mjs';
vi.mock('server-only',()=>({}));
import { parseLandingCopies } from '../apps/marketing/lib/landingExperiment';
import { readAssignment,signAssignment } from '../apps/marketing/lib/landingExperiment.server';
it('rejects arbitrary copy, wrong slot, tampered and expired assignment',()=>{
 expect(parseLandingCopies({support:'explore'})).toBeNull();expect(parseLandingCopies({help:'project'})).toEqual({help:'project'});
 vi.stubEnv('SANCTUARY_LANDING_EXPERIMENT_KEY','synthetic-key-'.repeat(4));
 const receipt=signAssignment({assignment:'a2000000-0000-4000-8000-000000000001',experiment:'a1000000-0000-4000-8000-000000000001',path:'/auckland-outdoor-living'});
 expect(readAssignment(receipt)?.path).toBe('/auckland-outdoor-living');expect(readAssignment(receipt+'x')).toBeNull();
 vi.spyOn(Date,'now').mockReturnValue(Date.now()+29*86400_000);expect(readAssignment(receipt)).toBeNull();vi.restoreAllMocks();vi.unstubAllEnvs();
});
it('runs the source SQL authority, publication, exposure, maturation, withdrawal and rollback contract',async()=>{
 const db=new PGlite();try{
 await db.exec(landingExperimentTestBootstrap(process.cwd()));
 await db.exec(readFileSync('supabase/migrations/20261021010002_landing_experiments.sql','utf8'));
 await db.exec(readFileSync('supabase/tests/landing_experiments.sql','utf8'));
 expect((await db.query('select count(*)::int n from landing_experiments')).rows).toEqual([{n:0}]);
 }finally{await db.close();}
},30000);
