import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
afterEach(() => vi.unstubAllEnvs());
const request = (widthMm = 6000, level = 'ground', projectionMm = 5000) => new Request('http://localhost:3062/api/configurator-review-price', {
  method: 'POST', headers: { 'Content-Type':'application/json', Origin:'http://localhost:3062' },
  body: JSON.stringify({version:1,input:{widthMm,projectionMm,level,connection:'facade'},roof:{family:'gable',orientation:'parallel',infills:false}}),
});
describe('review price route', () => {
  it('never publishes provisional prices in production', async () => {
    vi.stubEnv('NODE_ENV','production');
    expect((await POST(request())).status).toBe(404);
  });
  it('prices the boundary and returns no number beyond it', async () => {
    vi.stubEnv('NODE_ENV','development');
    expect(await (await POST(request())).json()).toMatchObject({status:'priced'});
    const result=await (await POST(request(6100))).json();
    expect(result.status).toBe('custom'); expect(result).not.toHaveProperty('amount');
    expect(await (await POST(request(5000,'elevated',4000))).json()).toMatchObject({status:'priced'});
    expect(await (await POST(request(5100,'elevated',4000))).json()).toMatchObject({status:'custom'});
  });
});
