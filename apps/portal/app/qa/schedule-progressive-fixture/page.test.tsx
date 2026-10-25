import {afterEach,expect,it,vi} from 'vitest';
import Page from './page';
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('NOT_FOUND');}}));
vi.mock('./Fixture',()=>({default:()=>null}));
afterEach(()=>vi.unstubAllEnvs());
it.each([['development','',''],['production','1','production']])('denies disabled fixtures and production even with a fixture flag',async(node,flag,vercel)=>{
  vi.stubEnv('NODE_ENV',node);vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES',flag);vi.stubEnv('VERCEL_ENV',vercel);
  await expect(Page({searchParams:Promise.resolve({view:'gantt'})})).rejects.toThrow('NOT_FOUND');
});
