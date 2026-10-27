import { act, memo, Suspense, useMemo, type ComponentType } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import { useOwnedPortalPublication } from '@/components/page-state/PortalPageSource';
import InvoicesListSurface, { type InvoicesListBinding, type InvoicesListEvidence } from './InvoicesListSurface';
import { useCommercialListControls } from './CommercialTabSurface';
import { invoice, projectId, schedule } from '@/app/qa/project-page-shell-fixture/commercialClarityData';
import { qk } from '@/lib/queries/keys';

const cold = vi.hoisted(() => {
  let release!: () => void;
  return { promise: Promise.resolve(), reset() { this.promise = new Promise<void>(resolve => { release = resolve; }); }, release: () => release(), requested: vi.fn() };
});
vi.mock('next/dynamic', async () => {
  const { default: Loadable } = await vi.importActual<typeof import('next/dist/shared/lib/lazy-dynamic/loadable')>('next/dist/shared/lib/lazy-dynamic/loadable');
  return { default: (loader: () => Promise<{ default: ComponentType<any> }>, options?: object) => Loadable({
    loader: () => { cold.requested(); return cold.promise.then(loader); }, ...options,
  }) };
});
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => ({ isAdmin: false }) }));
vi.mock('@/components/ui/toast/ToastProvider', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/lib/supabase/browserClient', () => ({ supabaseHostFromUrl: () => 'fixture', supabaseRuntimeUrl: () => 'https://example.invalid' }));
vi.mock('@/lib/repo/invoicesRepo', async original => ({
  ...await original<typeof import('@/lib/repo/invoicesRepo')>(),
  loadProjectInvoiceSchedule: vi.fn(async () => schedule),
  loadDepositInvoiceArtifactPreview: vi.fn(async () => ({ invoiceId: invoice.id, invoiceRef: invoice.invoiceRef, subject: 'Synthetic invoice', html: '', text: '', recipients: { to: [], cc: [], bcc: [] }, attachmentNames: [], source: 'prepared' })),
}));
vi.mock('./InvoicePdfInlinePreview', () => ({ default: () => <p>Controlled PDF unavailable</p> }));
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a> }));

let view: ReturnType<typeof renderIntoDocument> | undefined;
let client: QueryClient;
let accessError: Error;
let InvoiceController: ComponentType<{ projectId: string; listSurface?: InvoicesListBinding }>;
beforeEach(async () => {
  cold.reset(); cold.requested.mockClear(); vi.resetModules();
  InvoiceController = memo((await import('./InvoicesTab')).default);
  const { ApiError } = await import('@/lib/repo/apiClient');
  accessError = new ApiError('Access ended', { status: 403, body: null });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(qk.invoices.byProject('fixture', projectId), [invoice]);
  client.setQueryData(qk.invoices.scheduleByProject('fixture', projectId), schedule);
});
afterEach(() => { view?.unmount(); view = undefined; client.clear(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

function ManagedInvoices() {
  const owner = useMemo(() => ({}), []);
  const publication = useOwnedPortalPublication<InvoicesListEvidence>(owner);
  const controls = useCommercialListControls(projectId);
  const binding = useMemo(() => ({ controls, publish: publication.publish }), [controls, publication.publish]);
  return <><header><h1>Project frame</h1></header>
    <InvoicesListSurface query={controls.query} onQueryChange={controls.setQuery} evidence={publication.value} />
    <Suspense fallback={<p>Preparing invoice controller</p>}><InvoiceController projectId={projectId} listSurface={binding} /></Suspense>
  </>;
}

function openColdPreview() {
  view = renderIntoDocument(<QueryClientProvider client={client}><Suspense fallback={<p>Outer frame suspended</p>}><ManagedInvoices /></Suspense></QueryClientProvider>);
  const heading = view.container.querySelector('h1'), input = view.container.querySelector('input'), table = view.container.querySelector('table');
  const open = Array.from(view.container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === invoice.invoiceRef)!;
  expect(open).toBeDefined();
  act(() => { open.focus(); open.click(); });
  expect(cold.requested).toHaveBeenCalledOnce();
  expect(view.container.querySelector('h1')).toBe(heading);
  expect(view.container.querySelector('input')).toBe(input);
  expect(view.container.querySelector('table')).toBe(table);
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Preparing invoice preview');
  expect(view.container.textContent).not.toContain('Outer frame suspended');
  return { heading, input, table, open };
}

it('opens a cold invoice preview on its first activation without retiring the published frame or losing its controller', async () => {
  const { input, table, open } = openColdPreview();
  await act(async () => { cold.release(); await vi.dynamicImportSettled(); });
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(`Preview invoice ${invoice.invoiceRef}`));
  expect(view!.container.querySelector('table')).toBe(table);
  expect(view!.container.querySelector('input')).toBe(input);
  act(() => document.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(open);
});

it.each(['cancel', 'access ending'])('never resurrects a cold preview after %s while its module settles', async reason => {
  const { input, table, open } = openColdPreview();
  if (reason === 'cancel') act(() => document.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click());
  else await act(async () => {
    client.getQueryCache().find({ queryKey: qk.invoices.byProject('fixture', projectId) })!.setState({ status: 'error', error: accessError });
  });
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  await act(async () => { cold.release(); await vi.dynamicImportSettled(); });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(view!.container.querySelector('table')).toBe(table);
  expect(view!.container.querySelector('input')).toBe(input);
  if (reason === 'cancel') expect(document.activeElement).toBe(open);
  else expect(table?.textContent).not.toContain(invoice.invoiceRef);
});
