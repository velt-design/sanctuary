import { act, useEffect } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { PortalGuardedPage, PortalPageSourceProvider, usePortalPageSourceController } from './PortalPageSource';
import Calculator from '@/app/staff/calculator/page';
import Email from '@/app/staff/email-review/page';
import Costing from '@/app/admin/costing/page';
import Revision from '@/app/staff/projects/[projectId]/configurator-revision/page';
import Workbench from '@/app/staff/projects/[projectId]/design-workbench/page';

const calls = vi.hoisted(() => ({ staff: vi.fn(), admin: vi.fn(), auth: vi.fn(), read: vi.fn(), mounts: 0, retired: 0 }));
function PrivateClient() { useEffect(() => { calls.mounts++; return () => { calls.mounts--; calls.retired++; }; }, []); return <p data-private-leaf>Genuine current leaf</p>; }
vi.mock('@/lib/auth', () => ({ requireStaffPageAccess: calls.staff, requireAdminPageAccess: calls.admin }));
vi.mock('@/lib/supabase/serverClient', () => ({ getSupabaseServerAuth: calls.auth }));
vi.mock('@/lib/costing/configurationAdmin', () => ({ listCostingConfigurationOverview: calls.read }));
vi.mock('@/app/staff/calculator/CalculatorGridClient', () => ({ default: () => <PrivateClient/> }));
vi.mock('@/components/emailReview/EmailReviewWorkspace', () => ({ default: () => <PrivateClient/> }));
vi.mock('@/app/admin/costing/CostingControlCentre', () => ({ default: () => <PrivateClient/> }));
vi.mock('@/components/projects/ConfiguratorRevisionClient', () => ({ default: () => <PrivateClient/> }));
vi.mock('@/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchReadHost', () => ({ default: () => <PrivateClient/> }));
vi.mock('@/app/staff/projects/[projectId]/design-workbench/loadWorkbenchPageRead.server', () => ({ loadWorkbenchPageRead: calls.read }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), notFound: () => { throw Error('not-found'); } }));
vi.mock('@/components/layout/StaffPageHeader', () => ({ default: () => <h1>Revise configured design</h1> }));
let view: ReturnType<typeof renderIntoDocument> | undefined;
beforeEach(() => { vi.clearAllMocks(); calls.mounts = calls.retired = 0; calls.staff.mockResolvedValue({ role: 'staff' }); calls.admin.mockResolvedValue({ role: 'admin' }); calls.auth.mockResolvedValue({}); calls.read.mockResolvedValue(null); });
afterEach(() => { view?.unmount(); view = undefined; });
const project = 'proj_fictional';
const cases = [
  { path: '/staff/calculator', page: () => Calculator(), gate: 'staff' },
  { path: '/staff/email-review', page: () => Email(), gate: 'staff' },
  { path: '/admin/costing', page: () => Costing(), gate: 'admin' },
  { path: `/staff/projects/${project}/configurator-revision`, page: () => Revision({ params: Promise.resolve({ projectId: project }), searchParams: Promise.resolve({ sourceEstimateId: 'est_fictional' }) }), gate: 'staff' },
  { path: `/staff/projects/${project}/design-workbench`, page: () => Workbench({ params: Promise.resolve({ projectId: project }) }), gate: 'staff' },
] as const;
it.each(cases)('retires only after accepted navigation and permits the valid cached return for $path', async ({ path, page, gate }) => {
  window.history.replaceState(null, '', path); const leaf = await page();
  expect(leaf.type).toBe(PortalGuardedPage); expect(leaf.props.pathname).toBe(path); expect(leaf.props.publicFrame).toBe(false);
  expect(calls[gate]).toHaveBeenCalledWith(path);
  let source!: ReturnType<typeof usePortalPageSourceController>;
  function Host({ canonical }: { canonical: string }) {
    source = usePortalPageSourceController(window.location.pathname, canonical, '');
    return <PortalPageSourceProvider value={source}>{leaf}</PortalPageSourceProvider>;
  }
  view = renderIntoDocument(<Host canonical={path}/>); expect(calls.mounts).toBe(1);
  // A merely considered/blocked departure never invokes begin and leaves the same private owner.
  view.rerender(<Host canonical={path}/>); expect(calls.mounts).toBe(1); expect(calls.retired).toBe(0);
  act(() => { source.begin('/staff/projects'); window.history.pushState(null, '', '/staff/projects'); });
  expect(view.container.querySelector('[data-private-leaf]')).toBeNull(); expect(calls.mounts).toBe(0); expect(calls.retired).toBe(1);
  act(() => { source.cancel(); window.history.replaceState(null, '', path); }); view.rerender(<Host canonical={path}/>);
  expect(view.container.querySelector('[data-private-leaf]')).not.toBeNull(); expect(calls.mounts).toBe(1);
});
it.each(cases)('does not manufacture a completion/private client before the same effective $gate guard for $path', async ({ page, gate }) => {
  calls[gate].mockRejectedValueOnce(new Error('role-not-allowed'));
  await expect(page()).rejects.toThrow('role-not-allowed'); expect(calls.auth).not.toHaveBeenCalled(); expect(calls.read).not.toHaveBeenCalled(); expect(calls.mounts).toBe(0);
});
