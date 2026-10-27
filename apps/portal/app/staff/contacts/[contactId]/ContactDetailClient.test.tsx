import { act } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactDetailsView } from './ContactDetailClient';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import type { PortalContactDetailsDraft } from '@/lib/localFirst/contactDetails';

const mocks = vi.hoisted(() => ({
  clearWorkingCopy: vi.fn(),
  enqueue: vi.fn(),
  patchContactDetailsCaches: vi.fn(),
  retry: vi.fn(),
  setWorkingCopy: vi.fn(),
  syncState: {
    entityKey: 'contact:details:ct_1',
    status: 'idle' as 'idle' | 'queued' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict',
    pendingCount: 0,
    updatedAt: '2026-07-20T00:00:00.000Z',
    lastError: undefined as string | undefined,
    lastSyncedAt: undefined as string | undefined,
  },
  workingCopy: {
    hydrated: true,
    hasLocalCopy: false,
    value: null as PortalContactDetailsDraft | null,
  },
}));

vi.mock('@/components/navigation/PortalIndexLink', () => ({
  default: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => <a {...props}>{children}</a>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useQueryClient: () => ({}),
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
}));

vi.mock('@/lib/localFirst/useLocalWorkingCopy', () => ({
  useLocalWorkingCopy: (_entityKey: string, initialData: PortalContactDetailsDraft) => ({
    hydrated: mocks.workingCopy.hydrated,
    hasLocalCopy: mocks.workingCopy.hasLocalCopy,
    value: mocks.workingCopy.value ?? initialData,
    workingCopy: mocks.workingCopy.hasLocalCopy ? { data: mocks.workingCopy.value } : null,
    setWorkingCopy: mocks.setWorkingCopy,
    clearWorkingCopy: mocks.clearWorkingCopy,
  }),
}));

vi.mock('@/lib/localFirst/useEntitySyncState', () => ({
  useAliasedEntitySyncState: () => mocks.syncState,
}));

vi.mock('@/lib/localFirst/queue', () => ({
  enqueueAndProcessLocalFirstMutation: mocks.enqueue,
  retryLocalFirstEntityMutation: mocks.retry,
}));

vi.mock('@/lib/localFirst/contactDetails', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/localFirst/contactDetails')>();
  return {
    ...actual,
    patchContactDetailsCaches: mocks.patchContactDetailsCaches,
  };
});

const contact = {
  id: 'ct_1',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-02T00:00:00Z',
  displayName: 'Taylor',
  email: 'taylor@example.com',
  phone: '0210000000',
};

function renderContact() {
  return renderIntoDocument(
    <ContactDetailsView
      contact={contact}
      hostKey="host"
      loadError={null}
      projects={[]}
      projectsLoaded
      projectsError={false}
    />,
  );
}

function click(target: Element | null) {
  if (!target) throw new Error('Missing click target');
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function changeValue(target: HTMLInputElement | null, value: string) {
  if (!target) throw new Error('Missing input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('Missing value setter');
  act(() => {
    setter.call(target, value);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function findButton(container: Element, label: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.trim() === label) ?? null;
}

describe('ContactDetailClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.clearWorkingCopy.mockReset().mockResolvedValue(undefined);
    mocks.enqueue.mockReset().mockResolvedValue({ id: 'queue_1' });
    mocks.patchContactDetailsCaches.mockReset().mockImplementation(
      (_queryClient, _host, previousContact, draft) => ({
        ...previousContact,
        ...draft,
        updatedAt: '2026-07-20T00:00:00.000Z',
      }),
    );
    mocks.retry.mockReset().mockResolvedValue(true);
    mocks.setWorkingCopy.mockReset().mockImplementation(async (draft: PortalContactDetailsDraft) => {
      mocks.workingCopy.hasLocalCopy = true;
      mocks.workingCopy.value = draft;
    });
    Object.assign(mocks.syncState, {
      status: 'idle',
      pendingCount: 0,
      lastError: undefined,
      lastSyncedAt: undefined,
    });
    mocks.workingCopy.hydrated = true;
    mocks.workingCopy.hasLocalCopy = false;
    mocks.workingCopy.value = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('queues autosaved contact details in the user-owned local-first runtime', async () => {
    const rendered = renderContact();

    click(findButton(rendered.container, 'Edit'));
    changeValue(rendered.container.querySelector('[aria-label="Contact email"]'), 'updated@example.com');

    await act(async () => {
      vi.advanceTimersByTime(701);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.patchContactDetailsCaches).toHaveBeenCalledWith(
      {},
      'host',
      expect.objectContaining({ id: 'ct_1', email: 'taylor@example.com' }),
      expect.objectContaining({ email: 'updated@example.com' }),
    );
    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        entityKey: 'contact:details:ct_1',
        mutationKey: 'portal.contact.details.update',
        payload: expect.objectContaining({
          contactId: 'ct_1',
          draft: expect.objectContaining({ email: 'updated@example.com' }),
          previousContact: expect.objectContaining({ email: 'taylor@example.com' }),
        }),
      }),
    );

    rendered.unmount();
  });

  it('leaves edit mode and shows the new value before local queue persistence settles', async () => {
    let releaseWorkingCopy: () => void = () => undefined;
    mocks.setWorkingCopy.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        releaseWorkingCopy = resolve;
      }),
    );
    const rendered = renderContact();

    click(findButton(rendered.container, 'Edit'));
    changeValue(rendered.container.querySelector('[aria-label="Contact name"]'), 'Instant Taylor');
    click(findButton(rendered.container, 'Done'));

    expect(rendered.container.querySelector('[aria-label="Contact name"]')).toBeNull();
    expect(rendered.container.textContent).toContain('Instant Taylor');
    expect(mocks.enqueue).not.toHaveBeenCalled();

    await act(async () => {
      releaseWorkingCopy();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });

  it('keeps a rejected contact draft available for review and explicit retry', async () => {
    mocks.syncState.status = 'conflict';
    mocks.syncState.pendingCount = 1;
    mocks.syncState.lastError = 'Contact details are no longer writable.';
    mocks.workingCopy.hasLocalCopy = true;
    mocks.workingCopy.value = {
      displayName: 'Rejected Taylor',
      email: 'rejected@example.com',
      phone: '0219999999',
    };
    const rendered = renderContact();

    await act(async () => {
      await Promise.resolve();
    });
    expect(rendered.container.textContent).toContain('Taylor');
    click(findButton(rendered.container, 'Details'));
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Contact details are no longer writable.');
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})));

    click(findButton(rendered.container, 'Review changes'));
    expect((rendered.container.querySelector('[aria-label="Contact name"]') as HTMLInputElement | null)?.value).toBe('Rejected Taylor');
    click(findButton(rendered.container, 'Reset'));
    click(findButton(rendered.container, 'Retry now'));

    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.retry).toHaveBeenCalledWith('contact:details:ct_1');

    rendered.unmount();
  });
});


describe('actual Contact detail while identity is pending', () => {
  it('retains its actual field and project table owners and permits independently verified linked projects', () => {
    const props={hostKey:'host',loadError:null,projects:[{id:'proj_fixture',name:'Fictional courtyard',createdAt:'2026-10-22T00:00:00Z'}] as any[],projectsLoaded:true,projectsError:false};
    const view=renderIntoDocument(<ContactDetailsView {...props} contact={null} contactId="ct_1"/>);
    const info=view.container.querySelector('[aria-label="Contact info"]'), headers=view.container.querySelector('thead');
    expect(view.container.textContent).toContain('Reading name'); expect(view.container.textContent).toContain('Fictional courtyard');
    expect(view.container.textContent).not.toContain('Contact not found');
    expect([...view.container.querySelectorAll('button')].find(button=>button.textContent==='Edit')?.disabled).toBe(true);
    expect(view.container.querySelector('a[href^="/staff/projects/new"]')?.getAttribute('aria-disabled')).toBe('true');
    view.rerender(<ContactDetailsView {...props} contact={contact} contactId="ct_1"/>);
    expect(view.container.querySelector('[aria-label="Contact info"]')).toBe(info); expect(view.container.querySelector('thead')).toBe(headers);
    expect(view.container.textContent).toContain('Taylor'); view.unmount();
  });
  it('renders an error and Retry inside the same interface when contact identity cannot be read',()=>{
    const retry=vi.fn();
    const view=renderIntoDocument(<ContactDetailsView contact={null} contactId="ct_1" pending={false} hostKey="host" loadError="Synthetic read failure" onRetry={retry} projects={[]} projectsLoaded={false} projectsError={false}/>);
    expect(view.container.textContent).toContain('Contact unavailable'); expect(view.container.textContent).not.toContain('Loading contact');
    expect(view.container.querySelector('thead')).not.toBeNull();
    click([...view.container.querySelectorAll('button')].find(button=>button.textContent==='Retry')??null); expect(retry).toHaveBeenCalledOnce(); view.unmount();
  });
});


it('offers the complete long customer name through the same focusable native heading',()=>{
 const name='Fictional coastal property owners and project administration team';
 const ui=(current:typeof contact|null)=><ContactDetailsView contact={current} contactId={contact.id} hostKey="host" loadError={null} projects={[]} projectsLoaded projectsError={false}/>;
 const view=renderIntoDocument(ui(null)),heading=view.container.querySelector<HTMLHeadingElement>('h1')!;
 expect(heading.tabIndex).toBe(0);act(()=>heading.focus());
 view.rerender(ui({...contact,displayName:name}));
 expect(view.container.querySelector('h1')).toBe(heading);expect(heading.textContent).toBe(name);expect(heading.title).toBe(name);expect(document.activeElement).toBe(heading);
 expect(view.container.querySelector('a[href="/staff/contacts"]')).not.toBeNull();view.unmount();
});
