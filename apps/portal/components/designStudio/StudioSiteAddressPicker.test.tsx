import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import StudioSiteAddressPicker from './StudioSiteAddressPicker';

const mocks = vi.hoisted(() => ({ api: vi.fn(), invalidate: vi.fn(), actor: 'actor', role: 'staff', status: 'authenticated' }));
vi.mock('@/lib/repo/apiClient', () => ({ apiJson: mocks.api }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
vi.mock('@/lib/queries/projectCache', () => ({ invalidateProjectReadCaches: mocks.invalidate }));
vi.mock('@/lib/supabase/browserClient', () => ({ supabaseRuntimeUrl: () => '', supabaseHostFromUrl: () => 'test' }));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => ({ status: mocks.status, user: { id: mocks.actor }, role: mocks.role }) }));
const projectId = 'proj_test';
const original = { projectId, address: 'Old recorded address', updatedAt: '2026-10-28T00:00:00Z' };
const chosen = { placeId: 'place-one', address: '12 Example Road, Auckland 1010, New Zealand' };
const saved = { ...original, address: chosen.address, updatedAt: '2026-10-28T01:00:00Z' };
const mounts: ReturnType<typeof renderIntoDocument>[] = [];
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; }
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks(); mocks.actor = 'actor'; mocks.role = 'staff'; mocks.status = 'authenticated';
  mocks.invalidate.mockResolvedValue(undefined);
  mocks.api.mockImplementation(async (_path, init) => !init?.method ? { siteAddress: original }
    : JSON.parse(init.body).action === 'search' ? { suggestions: [chosen] } : { siteAddress: saved });
});
afterEach(() => { mounts.splice(0).forEach(m => m.unmount()); vi.useRealTimers(); });
async function mount() { const m = renderIntoDocument(<StudioSiteAddressPicker actorId="actor" projectId={projectId} disabled={false} canEditNow={() => true} />); mounts.push(m); await act(async () => {}); return m; }
function input(m: ReturnType<typeof renderIntoDocument>) { return m.container.querySelector('input')!; }
async function type(m: ReturnType<typeof renderIntoDocument>, text: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(m), text);
    input(m).dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function results(m: ReturnType<typeof renderIntoDocument>, text = '12 Example') { await type(m, text); await act(async () => { vi.advanceTimersByTime(301); }); }
async function key(m: ReturnType<typeof renderIntoDocument>, value: string) { await act(async () => input(m).dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }))); }
function requests(action: string) { return mocks.api.mock.calls.filter(([, init]) => init?.body && JSON.parse(init.body).action === action); }
async function click(m: ReturnType<typeof renderIntoDocument>, text: string) { await act(async () => [...m.container.querySelectorAll('button')].find(b => b.textContent === text)!.click()); }

it('reads the canonical saved address without a provider request or false validation on entry', async () => {
  const m = await mount(); expect(input(m).value).toBe(original.address);
  expect(m.container.textContent).toContain('Saved project address'); expect(m.container.textContent).not.toContain('Address saved');
  expect(mocks.api).toHaveBeenCalledOnce(); expect(mocks.api.mock.calls[0][1]).not.toHaveProperty('method');
  await key(m, 'Enter'); expect(requests('select')).toHaveLength(0);
});
it('debounces bounded search and commits the keyboard-selected result once without an Apply step', async () => {
  const m = await mount(); await type(m, '12'); await act(async () => vi.advanceTimersByTime(1000)); expect(requests('search')).toHaveLength(0);
  await results(m); expect(requests('search')).toHaveLength(1); expect(input(m).getAttribute('aria-expanded')).toBe('true');
  await key(m, 'ArrowDown'); expect(input(m).getAttribute('aria-activedescendant')).toBeTruthy(); await key(m, 'Enter');
  expect(requests('select')).toHaveLength(1); expect(JSON.parse(requests('select')[0][1].body)).toMatchObject({ placeId: chosen.placeId, expectedUpdatedAt: original.updatedAt });
  expect(input(m).value).toBe(chosen.address); expect(m.container.textContent).toContain('Address saved'); expect(mocks.invalidate).toHaveBeenCalledOnce();
  expect(m.container.textContent).not.toMatch(/Confirm address|Apply/);
});
it('supports mouse selection and retains the same receipt when the response is interrupted', async () => {
  let attempts = 0;
  mocks.api.mockImplementation(async (_path, init) => !init?.method ? { siteAddress: original }
    : JSON.parse(init.body).action === 'search' ? { suggestions: [chosen] }
      : ++attempts === 1 ? Promise.reject(Error('The save response was interrupted. Retry the same selection.')) : { siteAddress: saved });
  const m = await mount(); await results(m);
  await act(async () => (m.container.querySelector('[role=option]') as HTMLElement).click());
  expect(m.container.textContent).toContain('save response was interrupted'); await click(m, 'Retry selection');
  expect(requests('select')).toHaveLength(2); expect(requests('select')[0][1].body).toBe(requests('select')[1][1].body);
  expect(m.container.textContent).toContain('Address saved');
});
it('invalidates the selected state on editing and never saves arbitrary free text', async () => {
  const m = await mount(); await results(m); await key(m, 'ArrowDown'); await key(m, 'Enter'); expect(m.container.textContent).toContain('Address saved');
  await type(m, 'Not an address'); expect(m.container.textContent).not.toContain('Address saved'); await key(m, 'Enter'); await key(m, 'Escape');
  expect(requests('select')).toHaveLength(1); expect(m.container.querySelector('[role=listbox]')).toBeNull();
});
it('ignores an old search completion after a newer query even if transport cancellation is ignored', async () => {
  const old = deferred<{ suggestions: typeof chosen[] }>();
  mocks.api.mockImplementation(async (_path, init) => !init?.method ? { siteAddress: original }
    : JSON.parse(init.body).query === 'Old query' ? old.promise : { suggestions: [chosen] });
  const m = await mount(); await results(m, 'Old query'); await results(m, 'New query');
  await act(async () => old.resolve({ suggestions: [{ placeId: 'old', address: 'Wrong old address' }] }));
  expect(m.container.textContent).toContain(chosen.address); expect(m.container.textContent).not.toContain('Wrong old address');
});
it('keeps the query when search fails and retries only search, not the saved project read', async () => {
  let searches = 0;
  mocks.api.mockImplementation(async (_path, init) => !init?.method ? { siteAddress: original }
    : ++searches === 1 ? Promise.reject(Error('Provider failed')) : { suggestions: [chosen] });
  const m = await mount(); await results(m); expect(m.container.textContent).toContain('Address search is unavailable');
  await click(m, 'Retry search'); await act(async () => vi.advanceTimersByTime(301));
  expect(input(m).value).toBe('12 Example'); expect(requests('search')).toHaveLength(2);
  expect(mocks.api.mock.calls.filter(([, init]) => !init?.method)).toHaveLength(1); expect(m.container.textContent).toContain(chosen.address);
});
it('reports missing rural or new addresses truthfully without clearing the canonical address', async () => {
  mocks.api.mockImplementation(async (_path, init) => !init?.method ? { siteAddress: original } : { suggestions: [] });
  const m = await mount(); await results(m, 'New rural road'); expect(m.container.textContent).toContain('Rural or new addresses may be missing');
  expect(m.container.textContent).toContain('travel cost remains manual'); expect(requests('select')).toHaveLength(0);
});
it('reloads current canonical state after a concurrent edit instead of replaying a stale selection', async () => {
  mocks.api.mockImplementation(async (_path, init) => !init?.method ? { siteAddress: original }
    : JSON.parse(init.body).action === 'search' ? { suggestions: [chosen] } : Promise.reject(Object.assign(Error('Conflict'), { status: 409 })));
  const m = await mount(); await results(m); await key(m, 'ArrowDown'); await key(m, 'Enter');
  expect(m.container.textContent).toContain('changed elsewhere');
  mocks.api.mockResolvedValue({ siteAddress: { ...original, address: 'Address edited in Project', updatedAt: saved.updatedAt } });
  await click(m, 'Retry project address'); expect(input(m).value).toBe('Address edited in Project'); expect(requests('select')).toHaveLength(1);
});
it('recovers a failed saved-address read and refuses a foreign project response', async () => {
  mocks.api.mockRejectedValueOnce(Error('Read failed'));
  const m = await mount(); expect(input(m).disabled).toBe(true); expect(m.container.textContent).toContain('could not be loaded');
  await click(m, 'Retry project address'); expect(input(m).value).toBe(original.address); expect(input(m).disabled).toBe(false);
  mocks.api.mockResolvedValue({ siteAddress: { ...original, projectId: 'proj_other' } });
  m.rerender(<StudioSiteAddressPicker actorId="actor" projectId="proj_other_requested" disabled={false} canEditNow={() => true} />); await act(async () => {});
  expect(input(m).disabled).toBe(true); expect(input(m).value).toBe('');
});
it('masks old actor data and ignores a late selected save across sign-out and return', async () => {
  const write = deferred<{ siteAddress: typeof saved }>();
  mocks.api.mockImplementation(async (_path, init) => !init?.method ? { siteAddress: original }
    : JSON.parse(init.body).action === 'search' ? { suggestions: [chosen] } : write.promise);
  const m = await mount(); await results(m); await key(m, 'ArrowDown'); await key(m, 'Enter'); expect(input(m).disabled).toBe(true);
  mocks.status = 'unauthenticated'; mocks.actor = 'other';
  m.rerender(<StudioSiteAddressPicker actorId="actor" projectId={projectId} disabled={false} canEditNow={() => true} />);
  expect(input(m).value).toBe(''); await act(async () => write.resolve({ siteAddress: saved })); expect(mocks.invalidate).not.toHaveBeenCalled();
  mocks.status = 'authenticated'; mocks.actor = 'actor'; mocks.api.mockResolvedValue({ siteAddress: saved });
  m.rerender(<StudioSiteAddressPicker actorId="actor" projectId={projectId} disabled={false} canEditNow={() => true} />); await act(async () => {});
  expect(input(m).value).toBe(saved.address); expect(m.container.textContent).toContain('Saved project address');
});
it('stops selection on current authority loss and keeps other controls usable during address save', async () => {
  const write = deferred<{ siteAddress: typeof saved }>();
  mocks.api.mockImplementation(async (_path, init) => !init?.method ? { siteAddress: original }
    : JSON.parse(init.body).action === 'search' ? { suggestions: [chosen] } : write.promise);
  const m = await mount(); await results(m);
  await act(async () => { const row = m.container.querySelector('[role=option]') as HTMLElement; row.click(); row.click(); });
  expect(requests('select')).toHaveLength(1); expect(input(m).disabled).toBe(true);
  m.rerender(<><button>Design control</button><StudioSiteAddressPicker actorId="actor" projectId={projectId} disabled canEditNow={() => true} /></>); await act(async () => {});
  expect(m.container.querySelector('button')?.disabled).toBe(false); await act(async () => write.resolve({ siteAddress: saved }));
  expect(mocks.invalidate).not.toHaveBeenCalled();
});
it('checks the existing Studio lifecycle predicate immediately before a delayed dispatch', async () => {
  let allowed = true;
  const m = renderIntoDocument(<StudioSiteAddressPicker actorId="actor" projectId={projectId} disabled={false} canEditNow={() => allowed} />);
  mounts.push(m); await act(async () => {}); await type(m, '12 Example');
  allowed = false; await act(async () => vi.advanceTimersByTime(301));
  expect(requests('search')).toHaveLength(0); expect(requests('select')).toHaveLength(0);
});
it.each([401, 403, 404])('hides saved address after a fresh server access denial (%s)', async status => {
  const m = await mount(); mocks.api.mockRejectedValue(Object.assign(Error('Access denied'), { status }));
  await results(m); expect(input(m).value).toBe(''); expect(input(m).disabled).toBe(true);
  expect(m.container.textContent).toContain('access could not be confirmed');
});
it.each(['Escape', 'blur'])('keeps deferred search success closed after %s and allows explicit keyboard reopening', async dismissal => {
  const response = deferred<{ suggestions: typeof chosen[] }>();
  mocks.api.mockImplementation(async (_path, init) => !init?.method ? { siteAddress: original } : response.promise);
  const m = await mount(); await results(m);
  if (dismissal === 'Escape') await key(m, 'Escape');
  else await act(async () => input(m).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body })));
  await act(async () => response.resolve({ suggestions: [chosen] }));
  expect(m.container.querySelector('[role=listbox]')).toBeNull(); expect(input(m).getAttribute('aria-expanded')).toBe('false');
  await key(m, 'ArrowDown'); expect(m.container.querySelector('[role=listbox]')).toBeTruthy();
  expect(m.container.querySelector('[role=option][aria-selected=true]')?.textContent).toBe(chosen.address);
  expect(requests('search')).toHaveLength(1);
});
it.each(['Escape', 'blur'])('keeps deferred search failure closed after %s and allows explicit focus reopening', async dismissal => {
  const response = deferred<{ suggestions: typeof chosen[] }>();
  mocks.api.mockImplementation(async (_path, init) => !init?.method ? { siteAddress: original } : response.promise);
  const m = await mount(); await results(m);
  if (dismissal === 'Escape') await key(m, 'Escape');
  else await act(async () => input(m).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body })));
  await act(async () => response.reject(Error('Synthetic deferred search failure')));
  expect(m.container.querySelector('[role=alert]')).toBeNull();
  await act(async () => input(m).focus()); expect(m.container.querySelector('[role=alert]')?.textContent).toContain('Address search is unavailable');
  expect(requests('search')).toHaveLength(1);
});
it('retains a dismissed search error until the user explicitly reopens the address field', async () => {
  const m = await mount(); mocks.api.mockRejectedValue(Error('Synthetic search failure')); await results(m);
  await click(m, 'Dismiss'); expect(m.container.querySelector('[role=alert]')).toBeNull();
  await act(async () => {}); expect(m.container.querySelector('[role=alert]')).toBeNull();
  await key(m, 'ArrowDown'); expect(m.container.querySelector('[role=alert]')?.textContent).toContain('Address search is unavailable');
});
it('does not cancel an already selected address save on incidental outer blur', async () => {
  const response = deferred<{ siteAddress: typeof saved }>();
  mocks.api.mockImplementation(async (_path, init) => !init?.method ? { siteAddress: original }
    : JSON.parse(init.body).action === 'search' ? { suggestions: [chosen] } : response.promise);
  const m = await mount(); await results(m); await key(m, 'ArrowDown'); await key(m, 'Enter');
  await act(async () => input(m).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body })));
  expect(requests('select')[0][1].signal.aborted).toBe(false);
  await act(async () => response.resolve({ siteAddress: saved }));
  expect(input(m).value).toBe(saved.address); expect(m.container.textContent).toContain('Address saved'); expect(mocks.invalidate).toHaveBeenCalledOnce();
});
it('marks the Google Maps attribution as non-translatable', async () => {
  const m = await mount(); await results(m);
  expect(m.container.querySelector('[translate=no]')?.textContent).toBe('Google Maps');
});
