import { beforeEach,expect,it,vi } from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const h=vi.hoisted(()=>({access:vi.fn()}));
vi.mock('@/lib/auth',()=>({requireStaffPageAccess:h.access}));
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('not-found');}}));
vi.mock('@/components/marketingPerformance/MarketingPerformance',()=>({default:()=> <div data-marketing-client/>}));
import Page from './page';
beforeEach(()=>{vi.unstubAllEnvs();h.access.mockReset();});
it('retains the existing staff and confirmed-developer gates before rendering any Marketing view',async()=>{
 h.access.mockRejectedValueOnce(new Error('redirect:login'));
 await expect(Page()).rejects.toThrow('redirect:login');
 h.access.mockResolvedValueOnce({role:'staff',user:{email:'staff@example.test',email_confirmed_at:'2026-01-01'}});
 await expect(Page()).rejects.toThrow('not-found');
 h.access.mockResolvedValueOnce({role:'admin',user:{email:'jordan@sanctuarypergolas.co.nz'}});
 await expect(Page()).rejects.toThrow('not-found');
 h.access.mockResolvedValueOnce({role:'staff',user:{email:'jordan@sanctuarypergolas.co.nz',email_confirmed_at:'2026-01-01'}});
 expect(renderToStaticMarkup(await Page())).toContain('data-marketing-client');
 expect(h.access).toHaveBeenLastCalledWith('/staff/marketing-performance');
});
