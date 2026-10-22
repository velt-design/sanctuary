import {afterEach,expect,it,vi} from 'vitest';
import Page from './page';
import GuardedFrameFixture from './GuardedFrameFixture';
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('NOT_FOUND');}}));
vi.mock('./Fixture',()=>({default:()=>null}));
vi.mock('./GuardedFrameFixture',()=>({default:()=>null}));
afterEach(()=>vi.unstubAllEnvs());
it.each([['development','',''],['production','1','production']])('denies disabled fixtures and production even with a fixture flag',async(node,flag,vercel)=>{
  vi.stubEnv('NODE_ENV',node);vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES',flag);vi.stubEnv('VERCEL_ENV',vercel);
  await expect(Page({searchParams:Promise.resolve({view:'sheet'})})).rejects.toThrow('NOT_FOUND');
});

it.each(['complete', 'denied'])('keeps the fictional %s guard pending before publishing its separate completion', async scenario => {
  vi.useFakeTimers();
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES','1');
  try {
    const ui = await Page({ searchParams: Promise.resolve({ fixture: 'guarded-frames', route: 'schedule', guard: scenario }) });
    expect(ui.type).toBe(GuardedFrameFixture);
    expect(ui.props.route).toBe('schedule');
    let settled = false;
    const observed = ui.props.guard.then((value: { unavailable: boolean; completion: object }) => { settled = true; return value; });
    await vi.advanceTimersByTimeAsync(1799);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(observed).resolves.toEqual({ unavailable: scenario === 'denied', completion: {} });
  } finally { vi.useRealTimers(); }
});

it.each(['dashboard','projects','work-queue','drafting','running'])('uses the same gated server completion for the actual %s owner',async route=>{
 vi.useFakeTimers();vi.stubEnv('NODE_ENV','production');vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES','1');
 try{const ui=await Page({searchParams:Promise.resolve({fixture:'guarded-frames',route})});expect(ui.type).toBe(GuardedFrameFixture);expect(ui.props.route).toBe(route);
 let settled=false;const guard=Promise.resolve(ui.props.guard).then(value=>{settled=true;return value;});await vi.advanceTimersByTimeAsync(1799);expect(settled).toBe(false);await vi.advanceTimersByTimeAsync(1);await expect(guard).resolves.toEqual({unavailable:false,completion:{}});
 }finally{vi.useRealTimers();}
});
