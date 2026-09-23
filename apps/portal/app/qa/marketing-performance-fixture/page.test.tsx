import { afterEach,expect,it,vi } from 'vitest';
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('not-found');}}));
vi.mock('./Fixture',()=>({default:()=>null}));
import FixturePage from './page';
import FixtureProject from './project/page';
afterEach(()=>vi.unstubAllEnvs());
it.each(['production',undefined])('production fixture routes fail closed in %s environment even with fixture flag',async environment=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('VERCEL_ENV',environment);vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES','1');
  const args={searchParams:Promise.resolve({})};
  await expect(FixturePage(args)).rejects.toThrow('not-found');await expect(FixtureProject(args)).rejects.toThrow('not-found');
});
it('hosted preview needs the explicit fixture flag and serves only synthetic fixture output',async()=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES','0');
  await expect(FixturePage({searchParams:Promise.resolve({})})).rejects.toThrow('not-found');
  vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES','1');
  expect(await FixturePage({searchParams:Promise.resolve({representative:'1'})})).toBeTruthy();
  await expect(FixtureProject({searchParams:Promise.resolve({project:'not-a-fixture'})})).rejects.toThrow('not-found');
});
