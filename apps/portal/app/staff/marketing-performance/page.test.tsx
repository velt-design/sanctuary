import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ requireStaffPageAccess: auth }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('@/components/marketingPerformance/MarketingPerformance', () => ({ default: () => <div>Private report</div> }));
import Page from './page';
it('renders for the verified developer and denies other admins and unverified identity', async () => {
  auth.mockResolvedValue({user:{email:'Jordan@sanctuarypergolas.co.nz',email_confirmed_at:'today'}});
  expect(renderToStaticMarkup(await Page())).toContain('Private report');
  for (const user of [{email:'staff@example.test',email_confirmed_at:'today'}, {email:'jordan@sanctuarypergolas.co.nz'}]) {
    auth.mockResolvedValue({role:'admin',user});
    await expect(Page()).rejects.toThrow('NOT_FOUND');
  }
});
