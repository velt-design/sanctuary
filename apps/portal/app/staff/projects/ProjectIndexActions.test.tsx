import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectIndexActions from './ProjectIndexActions';
import * as dates from '@/lib/format/portalDateTime';
const { drawerRender, modalRender, api } = vi.hoisted(() => ({ drawerRender: vi.fn(), modalRender: vi.fn(), api: vi.fn() }));
vi.mock('@/components/ui/drawer/Drawer', async (original) => {
  const actual = await original<typeof import('@/components/ui/drawer/Drawer')>();
  return { ...actual, Drawer: (props: React.ComponentProps<typeof actual.Drawer>) => {
    drawerRender(props); return <actual.Drawer {...props} />;
  } };
});
vi.mock('@/components/ui/PipelineModal', async (original) => {
  const actual = await original<typeof import('@/components/ui/PipelineModal')>();
  return { ...actual, PipelineModal: (props: React.ComponentProps<typeof actual.PipelineModal>) => {
    modalRender(props); return <actual.PipelineModal {...props} />;
  } };
});
vi.mock('@/lib/repo/apiClient', async (original) => ({ ...await original<typeof import('@/lib/repo/apiClient')>(), apiJson: api }));
vi.mock('@/components/projects/ProjectDeliveryAction', () => ({ default: ({ renderTrigger }: { renderTrigger: (open: () => void) => React.ReactNode }) => renderTrigger(() => {}) }));
const props = { project: { id: 'proj_1', projectName: 'Deck', createdAt: '2026-09-01T00:00:00Z' }, host: 'test', client: 'Sample client', nameEditor: <button>Edit name</button>, phone: <button>Edit phone</button>, address: <button>Edit address</button>, stageBusy: false, archiveBusy: false, isAdmin: true, onOpen: vi.fn(), onCorrect: vi.fn(), onArchive: vi.fn(), onDelete: vi.fn() };
it('keeps contact editing and actions accessible without opening the project row', async () => {
  const rowOpen = vi.fn();
  const rendered = renderIntoDocument(<div onClick={rowOpen}><ProjectIndexActions {...props} /></div>);
  act(() => rendered.container.querySelector<HTMLButtonElement>('button')!.click());
  expect(document.querySelector('[role="menu"]')?.textContent).toContain('Mark delivery completed');
  act(() => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(item=>item.textContent==='Contact & location')!.click());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Edit phone');
  act(() => document.querySelector<HTMLButtonElement>('[role="dialog"] button')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(rendered.container.querySelector('button[aria-haspopup="menu"]'));
  expect(rowOpen).not.toHaveBeenCalled();
  rendered.unmount();
});
it('preserves stage correction and hides administrator-only actions for staff', async () => {
  const rendered = renderIntoDocument(<ProjectIndexActions {...props} isAdmin={false} />);
  act(() => rendered.container.querySelector<HTMLButtonElement>('button')!.click());
  expect(document.querySelector('[role="menu"]')?.textContent).not.toContain('Delete');
  act(() => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(item=>item.textContent==='Correct stage')!.click());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
  expect(props.onCorrect).toHaveBeenCalledOnce();
  rendered.unmount();
});
it('derives contact-only dates only while the SAME drawer is open and uses current props on reopening', async () => {
  const nextProject={...props.project,createdAt:'2026-09-08T00:00:00Z'};
  const firstDate=dates.formatPortalDate(props.project.createdAt),nextDate=dates.formatPortalDate(nextProject.createdAt);
  const format=vi.spyOn(dates,'formatPortalDate');
  const rendered=renderIntoDocument(<ProjectIndexActions {...props}/>);
  const trigger=rendered.container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
  async function openContact(){
    act(()=>trigger.click());
    act(()=>Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(item=>item.textContent==='Contact & location')!.click());
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,40));});
  }
  try {
    expect(format).not.toHaveBeenCalled();
    act(()=>trigger.click());expect(format).not.toHaveBeenCalled();
    act(()=>trigger.click());
    await openContact();
    expect(format).toHaveBeenCalledWith(props.project.createdAt);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(firstDate);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Edit name');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Edit address');
    act(()=>document.querySelector<HTMLButtonElement>('[role="dialog"] button')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    expect(document.activeElement).toBe(trigger);format.mockClear();
    rendered.rerender(<ProjectIndexActions {...props} project={nextProject}/>);
    expect(format).not.toHaveBeenCalled();
    await openContact();
    expect(format).toHaveBeenCalledWith(nextProject.createdAt);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(nextDate);
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain(firstDate);
    expect(rendered.container.querySelector('button[aria-haspopup="menu"]')).toBe(trigger);
  } finally {rendered.unmount();format.mockRestore();}
});

it('mounts the actual contact drawer only when requested and retires it on backdrop close', async () => {
  drawerRender.mockClear();
  const rendered = renderIntoDocument(<ProjectIndexActions {...props} />);
  const trigger = rendered.container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
  try {
    expect(drawerRender).not.toHaveBeenCalled();
    act(() => trigger.click());
    expect(drawerRender).not.toHaveBeenCalled();
    act(() => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(item => item.textContent === 'Contact & location')!.click());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
    expect(drawerRender).toHaveBeenCalledWith(expect.objectContaining({ open: true, title: 'Contact & location' }));
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Sample client');
    act(() => document.querySelector('[data-drawer-overlay]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    drawerRender.mockClear();
    rendered.rerender(<ProjectIndexActions {...props} client="Current client" />);
    expect(drawerRender).not.toHaveBeenCalled();
  } finally { rendered.unmount(); }
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const deliveryStatus = { scheduled: false, completed: false, archived: false, completedDate: null, confirmationId: null, closureBlockers: [] };
function change(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => { Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(control, value); control.dispatchEvent(new Event('input', { bubbles: true })); });
}

describe('actual delivery action overlay ownership', () => {
  it('retries a failed current read in the same modal and preserves archive command restrictions', async () => {
    const { default: Delivery } = await vi.importActual<typeof import('@/components/projects/ProjectDeliveryAction')>('@/components/projects/ProjectDeliveryAction');
    const read = deferred<typeof deliveryStatus>();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    api.mockReset(); api.mockRejectedValueOnce(new Error('Fictional read unavailable')).mockReturnValueOnce(read.promise);
    const rendered = renderIntoDocument(<QueryClientProvider client={client}><Delivery projectId="proj_1" host="test" /></QueryClientProvider>);
    try {
      await act(async () => { rendered.container.querySelector<HTMLButtonElement>('button')!.click(); });
      const modal = document.querySelector('[role="dialog"]')!;
      expect(modal.textContent).toContain('Fictional read unavailable');
      act(() => Array.from(modal.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Retry')!.click());
      expect(document.querySelector('[role="dialog"]')).toBe(modal);
      expect(modal.textContent).toContain('Loading...');
      await act(async () => { read.resolve({ ...deliveryStatus, archived: true }); await read.promise; });
      expect(document.querySelector('[role="dialog"]')).toBe(modal);
      expect(modal.textContent).not.toContain('Fictional read unavailable');
      const confirm = Array.from(modal.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Confirm delivery completed')!;
      expect(confirm.disabled).toBe(true);
      act(() => confirm.click()); expect(api).toHaveBeenCalledTimes(2);
      act(() => modal.parentElement!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    } finally { rendered.unmount(); client.clear(); }
  });

  it('keeps the closed modal absent, preserves busy dismissal locks and retries the same command with its draft', async () => {
    const { default: Delivery } = await vi.importActual<typeof import('@/components/projects/ProjectDeliveryAction')>('@/components/projects/ProjectDeliveryAction');
    const read = deferred<typeof deliveryStatus>();
    const save = deferred<{ ok: boolean }>();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const refreshed = vi.fn();
    api.mockReset(); api.mockReturnValueOnce(read.promise).mockReturnValueOnce(save.promise).mockResolvedValueOnce({ ok: true });
    modalRender.mockClear();
    const rendered = renderIntoDocument(<QueryClientProvider client={client}><Delivery projectId="proj_1" host="test" onRefresh={refreshed} /></QueryClientProvider>);
    const trigger = rendered.container.querySelector<HTMLButtonElement>('button')!;
    try {
      expect(modalRender).not.toHaveBeenCalled(); expect(api).not.toHaveBeenCalled();
      act(() => trigger.focus()); act(() => trigger.click());
      expect(modalRender).toHaveBeenCalledWith(expect.objectContaining({ open: true }));
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Loading...');
      act(() => document.querySelector('[role="dialog"]')!.parentElement!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
      await act(async () => { read.resolve(deliveryStatus); await read.promise; });
      const date = document.querySelector<HTMLInputElement>('input[type="date"]')!;
      const note = document.querySelector<HTMLTextAreaElement>('textarea')!;
      change(date, '2026-10-26'); change(note, 'Fictional completion note');
      const confirm = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(button => button.textContent === 'Confirm delivery completed')!;
      expect(confirm().disabled).toBe(false);
      act(() => confirm().click()); act(() => confirm().click());
      expect(api).toHaveBeenCalledTimes(2);
      act(() => document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
      await act(async () => { save.resolve({ ok: false }); await save.promise; });
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Completion was not confirmed');
      expect(date.value).toBe('2026-10-26'); expect(note.value).toBe('Fictional completion note');
      await act(async () => { confirm().click(); });
      const first = JSON.parse(api.mock.calls[1][1].body), second = JSON.parse(api.mock.calls[2][1].body);
      expect(second).toEqual(first);
      expect(first).toMatchObject({ action: 'complete', completedDate: '2026-10-26', note: 'Fictional completion note' });
      expect(refreshed).toHaveBeenCalledOnce();
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Delivery updated');
      act(() => document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
      modalRender.mockClear(); rendered.rerender(<QueryClientProvider client={client}><Delivery projectId="proj_2" host="test" disabled /></QueryClientProvider>);
      expect(modalRender).not.toHaveBeenCalled(); expect(trigger.disabled).toBe(true);
      act(() => trigger.click()); expect(api).toHaveBeenCalledTimes(3);
    } finally { rendered.unmount(); client.clear(); }
  });

  it('uses the current project on reopening and rejects a retired read after its owner unmounts', async () => {
    const { default: Delivery } = await vi.importActual<typeof import('@/components/projects/ProjectDeliveryAction')>('@/components/projects/ProjectDeliveryAction');
    const old = deferred<typeof deliveryStatus>();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    api.mockReset(); api.mockResolvedValueOnce(deliveryStatus).mockReturnValueOnce(old.promise).mockResolvedValueOnce({ ...deliveryStatus, completed: true, completedDate: '2026-10-25' });
    const view = (id: string, key = 'same') => <QueryClientProvider client={client}><Delivery key={key} projectId={id} host="test" /></QueryClientProvider>;
    const rendered = renderIntoDocument(view('proj_1'));
    try {
      await act(async () => { rendered.container.querySelector<HTMLButtonElement>('button')!.click(); });
      act(() => document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      rendered.rerender(view('proj_2'));
      act(() => rendered.container.querySelector<HTMLButtonElement>('button')!.click());
      expect(api.mock.calls[1][0]).toBe('/api/staff/v1/projects/proj_2/delivery');
      rendered.rerender(view('proj_3', 'new-owner'));
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      await act(async () => { rendered.container.querySelector<HTMLButtonElement>('button')!.click(); });
      expect(api.mock.calls[2][0]).toBe('/api/staff/v1/projects/proj_3/delivery');
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Completed: 2026-10-25');
      await act(async () => { old.resolve(deliveryStatus); await old.promise; });
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Completed: 2026-10-25');
      expect(api).toHaveBeenCalledTimes(3);
    } finally { rendered.unmount(); client.clear(); }
  });
});
