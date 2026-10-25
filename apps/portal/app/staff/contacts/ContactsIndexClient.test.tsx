import GuardedContactsIndexClient from './GuardedContactsIndexClient';
import {ContactsIndexWorkspace,useContactsIndexWorkspace} from './ContactsIndexWorkspace';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContactsIndexClient from './ContactsIndexClient';
import { renderIntoDocument } from '../../../../../test/reactHarness';

const retry = vi.fn();
const finishInstantRoute = vi.fn();
const useContactsIndexData = vi.fn();
const contact = {
  id: 'ct_1',
  displayName: 'Alex Mason',
  email: 'alex@example.com',
  phone: '021',
  createdAt: '2026-04-03T00:00:00.000Z',
  updatedAt: '2026-04-03T00:00:00.000Z',
};

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://host.supabase.co',
}));
vi.mock('@/components/page-state/PortalRouteTransition', () => ({
  usePortalRouteTransition: () => ({ finishInstantRoute }),
}));
vi.mock('./ContactsImportAction', () => ({
  default: () => <button type="button">Import CSV</button>,
}));
vi.mock('./useContactsIndexData', () => ({
  useContactsIndexData: (...args: unknown[]) => useContactsIndexData(...args),
}));

function indexResult(
  state: 'pending' | 'cached' | 'fresh' | 'refresh-failed' | 'unavailable',
  rows = state === 'pending' || state === 'unavailable' ? [] : [contact],
  search = '',
) {
  return {
    state,
    data: state === 'pending' || state === 'unavailable' ? undefined : {
      contacts: {
        rows,
        totalCount: rows.length,
        truncated: false,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      },
      query: { search, sort: 'name_asc' },
      generatedAt: state === 'fresh' ? 'fresh' : 'cached',
    },
    error: state === 'refresh-failed' ? new Error('offline') : null,
    retry,
    backgroundReady: state === 'fresh',
  };
}

function changeInputValue(target: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('Missing input value setter');
  setter.call(target, value);
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ContactsIndexClient', () => {
  beforeEach(() => {
    retry.mockReset();
    finishInstantRoute.mockReset();
    useContactsIndexData.mockReset();
    useContactsIndexData.mockImplementation((params: { search?: string }) =>
      params.search
        ? indexResult('fresh', [], params.search)
        : indexResult('fresh'));
  });

  afterEach(() => { document.body.innerHTML = ''; });

  it('keeps the actual frame while private code arrives and retires old record/pager callbacks',async()=>{
    const ownerA={},ownerB={};const results=new Map<string,ReturnType<typeof indexResult>>();
    useContactsIndexData.mockImplementation((params)=>{
      const key=JSON.stringify(params);if(!results.has(key)){
        const result=indexResult('fresh',[{...contact,displayName:`Verified ${params.search||'A'}`}],params.search);
        result.data!.contacts.totalCount=100;result.data!.contacts.totalPages=2;result.data!.contacts.page=params.page;
        results.set(key,result);
      }return results.get(key);
    });
    let pager:((page:number)=>void)|undefined;
    function Observe(){const workspace=useContactsIndexWorkspace();pager=workspace?.evidence?.onPageChange;return null;}
    const root=(owner:object|null,denied=false)=><ContactsIndexWorkspace owner={owner} entryIdentity="same-entry" unavailable={denied}><GuardedContactsIndexClient readOnly/><Observe/></ContactsIndexWorkspace>;
    const view=renderIntoDocument(root(ownerA));const table=view.container.querySelector('table'),body=view.container.querySelector('tbody'),head=view.container.querySelector('thead'),input=view.container.querySelector<HTMLInputElement>('#contactSearch')!;
    expect(useContactsIndexData).not.toHaveBeenCalled();expect(view.container.textContent).toContain('Reading contacts');
    act(()=>changeInputValue(input,'Beta'));input.focus();
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,230));});
    expect(view.container.textContent).toContain('Verified Beta');expect(document.activeElement).toBe(input);
    expect(view.container.querySelector('table')).toBe(table);expect(view.container.querySelector('thead')).toBe(head);expect(view.container.querySelector('tbody')).toBe(body);
    const firstPager=pager!;expect(firstPager).toBeTypeOf('function');act(()=>firstPager(2));await act(async()=>{await Promise.resolve();});
    expect(useContactsIndexData.mock.calls.at(-1)![0].page).toBe(2);
    view.rerender(root(null,true));const reads=useContactsIndexData.mock.calls.length;
    act(()=>firstPager(1));expect(useContactsIndexData).toHaveBeenCalledTimes(reads);expect(view.container.textContent).not.toContain('Verified Beta');
    view.rerender(root(ownerB));await act(async()=>{await Promise.resolve();});
    const secondPager=pager;act(()=>firstPager(1));await act(async()=>{await Promise.resolve();});
    expect(useContactsIndexData.mock.calls.at(-1)![0].page).toBe(2);expect(pager).toBe(secondPager);expect(input.value).toBe('Beta');
    expect(view.container.querySelector('tbody')).toBe(body);expect(view.container.textContent).toContain('Verified Beta');view.unmount();
  });

  it('keeps real columns and typed search across a pending-to-complete read',()=>{
    let pending=true;useContactsIndexData.mockImplementation(params=>indexResult(pending?'pending':'fresh',[contact],params.search));
    const view=renderIntoDocument(<ContactsIndexClient/>),table=view.container.querySelector('table'),header=view.container.querySelector('thead'),search=view.container.querySelector<HTMLInputElement>('#contactSearch')!;
    expect(header?.textContent).toContain('Email');expect(view.container.textContent).toContain('Reading contacts');expect(search.disabled).toBe(false);act(()=>changeInputValue(search,'Alex'));
    pending=false;view.rerender(<ContactsIndexClient/>);expect(view.container.querySelector('table')).toBe(table);expect(view.container.querySelector('thead')).toBe(header);expect(view.container.querySelector('#contactSearch')).toBe(search);expect(search.value).toBe('Alex');expect(view.container.textContent).toContain('Alex Mason');view.unmount();
  });

  it('renders fresh contacts and dismisses the instant pending frame', () => {
    const rendered = renderIntoDocument(<ContactsIndexClient />);
    expect(rendered.container.querySelector('[data-contacts-index-state="fresh"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Alex Mason');
    expect(rendered.container.textContent).not.toContain('Updating contacts');
    expect(finishInstantRoute).toHaveBeenCalledWith('contacts-index');
    rendered.unmount();
  });

  it.each(['pending', 'cached'] as const)('shows a truthful updating state for %s data', (state) => {
    useContactsIndexData.mockReturnValue(indexResult(state));
    const rendered = renderIntoDocument(<ContactsIndexClient />);
    expect(rendered.container.textContent).toContain(state === 'pending' ? 'Reading contacts…' : 'Updating...');
    expect(rendered.container.textContent).not.toContain('No contacts found.');
    rendered.unmount();
  });

  it('retains cached rows and offers Retry after a refresh failure', () => {
    useContactsIndexData.mockReturnValue(indexResult('refresh-failed'));
    const rendered = renderIntoDocument(<ContactsIndexClient />);
    expect(rendered.container.textContent).toContain('Alex Mason');
    act(() => Array.from(rendered.container.querySelectorAll('button')).find(button => button.textContent === 'Details')!.click());
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Could not refresh contacts');
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})));
    const retryButton = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Retry');
    act(() => retryButton?.click());
    expect(retry).toHaveBeenCalled();
    rendered.unmount();
  });

  it('hides cached content when access ends', () => {
    useContactsIndexData.mockReturnValue(indexResult('unavailable'));
    const rendered = renderIntoDocument(<ContactsIndexClient />);
    expect(rendered.container.textContent).toContain('Contacts unavailable');
    expect(rendered.container.textContent).not.toContain('Alex Mason');
    rendered.unmount();
  });

  it('shows the genuine empty state only after a successful fresh response', () => {
    useContactsIndexData.mockReturnValue(indexResult('fresh', []));
    const rendered = renderIntoDocument(<ContactsIndexClient />);
    expect(rendered.container.textContent).toContain('No contacts found.');
    rendered.unmount();
  });

  it('does not claim to show or update a saved list when the first refresh fails', () => {
    useContactsIndexData.mockReturnValue(indexResult('refresh-failed', []));
    const rendered = renderIntoDocument(<ContactsIndexClient />);
    act(() => Array.from(rendered.container.querySelectorAll('button')).find(button => button.textContent === 'Details')!.click());
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('No saved list is available. Retry the request.');
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})));
    expect(rendered.container.textContent).not.toContain('Showing the last saved list.');
    expect(rendered.container.textContent).not.toContain('Updating contacts...');
    rendered.unmount();
  });

  it('hands a global-search query to the server-backed index', () => {
    const rendered = renderIntoDocument(<ContactsIndexClient initialQuery="missing" />);
    expect((rendered.container.querySelector('#contactSearch') as HTMLInputElement).value).toBe('missing');
    expect(useContactsIndexData).toHaveBeenCalledWith(expect.objectContaining({ search: 'missing' }));
    expect(rendered.container.textContent).toContain('No contacts match your search.');
    expect(rendered.container.textContent).not.toContain('Alex Mason');
    rendered.unmount();
  });

  it('reconciles a new URL query without overwriting typing on an unrelated rerender', () => {
    const rendered = renderIntoDocument(<ContactsIndexClient initialQuery="doreen" />);
    const input = rendered.container.querySelector('#contactSearch') as HTMLInputElement;

    act(() => changeInputValue(input, 'doreen h'));
    rendered.rerender(<ContactsIndexClient initialQuery="doreen" />);
    expect(input.value).toBe('doreen h');

    rendered.rerender(<ContactsIndexClient initialQuery="mark" />);
    expect(input.value).toBe('mark');
    rendered.unmount();
  });
});
