import { act, type ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import ProjectCalculatorTab from './ProjectCalculatorTab';
import { __resetLocalFirstStoreForTests, __setLocalFirstStorageAdapterForTests, ensureLocalFirstStoreReady, registerLocalFirstIdAlias, writeLocalFirstWorkingCopy } from '@/lib/localFirst/store';
import { buildEstimateEntityKey } from '@/lib/localFirst/portalEntities';

const editorCode = vi.hoisted(() => ({ load: null as null | (() => Promise<{ default: ComponentType<any> }>), calls: vi.fn() }));
vi.mock('next/dynamic', async () => {
  const { default: Loadable } = await vi.importActual<typeof import('next/dist/shared/lib/lazy-dynamic/loadable')>('next/dist/shared/lib/lazy-dynamic/loadable');
  return { default: (loader: () => Promise<any>, options?: object) => Loadable({
    loader: () => { editorCode.calls(); return editorCode.load ? editorCode.load() : loader(); }, ...options,
  }) };
});
async function settleEditor() { await act(async () => { await vi.dynamicImportSettled(); }); }

const replace = vi.fn();
const push = vi.fn();
const useQueryMock = vi.fn();
let search = 'tab=estimates';
let savedFixtureId = 'est_saved';

vi.mock('next/navigation', () => ({
  usePathname: () => '/staff/projects/proj_1',
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useQueryClient: () => ({ setQueryData: vi.fn() }),
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/lib/queries/projectEstimates', () => ({
  estimateMetasByProjectQueryOptions: () => ({}),
}));

vi.mock('@/lib/queries/quotes', () => ({
  quoteVersionsByProjectQueryOptions: () => ({ queryKey: ['quote-links'] }),
}));

vi.mock('@/app/staff/calculator/CalculatorGridClient', () => ({
  default: ({ workspace }: any) => (
    <div
      data-testid="embedded-calculator"
      data-project-id={workspace.projectId}
      data-edit-estimate-id={workspace.editEstimateId ?? ''}
      data-from-estimate-id={workspace.fromEstimateId ?? ''}
      data-create-new={String(Boolean(workspace.createNewEstimate))}
      data-scope-kind={workspace.newEstimateCommercialScopeKind ?? 'base'}
      data-scope-id={workspace.newEstimateCommercialScopeId ?? ''}
    >
      <select
        aria-label="Design version"
        value={workspace.designNavigation.value}
        onChange={(event) => workspace.designNavigation.onChange(event.target.value)}
      >
        {workspace.designNavigation.options.map((option: any) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <span data-testid="design-state">{workspace.designNavigation.stateLabel}</span>
      <button type="button" onClick={() => workspace.onEstimateSaved(savedFixtureId)}>Save fixture</button>
    </div>
  ),
}));

const activeDraft = {
  id: 'est_draft',
  projectId: 'proj_1',
  createdAt: '2026-07-20T00:00:00Z',
  status: 'draft',
  summary: {},
  versionLabel: 'V2',
  isActiveDraft: true,
  hasSentQuote: false,
  jobPackEligible: false,
  jobPackGeneratedAt: null,
  jobPackQuoteVersionId: null,
};
const historical = { ...activeDraft, id: 'est_history', versionLabel: 'V1', isActiveDraft: false };

describe('ProjectCalculatorTab', () => {
  beforeEach(async () => {
    __resetLocalFirstStoreForTests();
    __setLocalFirstStorageAdapterForTests({ get: async () => undefined, set: async () => undefined });
    await ensureLocalFirstStoreReady();
    savedFixtureId = 'est_saved';
    editorCode.load = null; editorCode.calls.mockClear();
    replace.mockReset();
    push.mockReset();
    search = 'tab=estimates';
    useQueryMock.mockImplementation((options) => ({ data: options.queryKey?.[0] === 'quote-links' ? [] : [activeDraft, historical], isPending: false, isError: false }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the versioned estimate list when the route has no design intent', async () => {
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    await settleEditor();
    expect(rendered.container.querySelector('[data-estimates-view="list"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Estimates');
    expect(rendered.container.textContent).toContain('V2');
    expect(rendered.container.textContent).toContain('V1');
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();

    const edit = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Edit in calculator');
    act(() => edit?.click());
    expect(push).toHaveBeenCalledWith('/staff/projects/proj_1?tab=estimates&estimateId=est_draft');
    rendered.unmount();
  });

  it('moves active design navigation into the embedded Calculator command surface', async () => {
    search = 'tab=estimates&estimateId=est_draft';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" projectName="Deck Build" />);
    await settleEditor();
    expect(rendered.container.querySelector('[data-project-calculator-state-navigation]')).toBeNull();
    expect(rendered.container.querySelector<HTMLSelectElement>('[aria-label="Design version"]')?.value).toBe('draft:est_draft');
    expect(rendered.container.querySelector('[data-testid="design-state"]')?.textContent).toBe('Current draft · V2');
    expect(rendered.container.textContent).not.toContain('Project Calculator');
    expect(rendered.container.textContent).toContain('Back to estimates');
    expect(rendered.container.querySelector('[data-calculator-workspace-bar="true"]')?.textContent).toContain('Deck Build');
    expect(rendered.container.querySelector('[data-calculator-workspace-bar="true"]')?.textContent).toContain('V2');
    rendered.unmount();
  });

  it('fixes the embedded Calculator to the project and normalizes its URL after save', async () => {
    search = 'tab=estimates&fromEstimateId=est_history&campaign=winter';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    await settleEditor();
    const calculator = rendered.container.querySelector('[data-testid="embedded-calculator"]');

    expect(calculator?.getAttribute('data-project-id')).toBe('proj_1');
    expect(calculator?.getAttribute('data-from-estimate-id')).toBe('est_history');
    expect(calculator?.getAttribute('data-create-new')).toBe('true');

    const saveFixture = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Save fixture');
    act(() => saveFixture?.click());
    expect(replace).toHaveBeenCalledWith(
      '/staff/projects/proj_1?tab=estimates&campaign=winter&estimateId=est_saved', { scroll: false }
    );
    rendered.unmount();
  });


  it.each(['list-first', 'alias-first'] as const)('keeps a duplicate open through %s save acknowledgement and delayed route updates', async (order) => {
    search = 'tab=estimates&fromEstimateId=est_history&campaign=winter';
    savedFixtureId = 'local-estimate:pending-create';
    const localDraft = { ...activeDraft, id: savedFixtureId };
    const canonicalDraft = { ...activeDraft, id: 'est_saved' };
    let rows = [localDraft, historical];
    useQueryMock.mockImplementation(() => ({ data: rows, isPending: false, isError: false }));
    await writeLocalFirstWorkingCopy({ entityKey: buildEstimateEntityKey(localDraft.id), data: localDraft });
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    await settleEditor();
    const assertOpen = (id: string) => {
      expect(rendered.container.querySelector('[data-calculator-invalid-source]')).toBeNull();
      expect(rendered.container.querySelector('[data-testid="embedded-calculator"]')?.getAttribute('data-edit-estimate-id')).toBe(id);
      expect(rendered.container.querySelector<HTMLSelectElement>('[aria-label="Design version"]')?.value).toBe(`draft:${id}`);
    };
    const save = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Save fixture');
    act(() => save!.click());
    search = new URL(String(replace.mock.calls.at(-1)?.[0]), 'https://portal.example').search.slice(1);
    act(() => rendered.rerender(<ProjectCalculatorTab host="host" projectId="proj_1" />));
    assertOpen(localDraft.id);

    if (order === 'list-first') {
      rows = [canonicalDraft, historical];
      act(() => rendered.rerender(<ProjectCalculatorTab host="host" projectId="proj_1" />));
      assertOpen(localDraft.id);
      await act(async () => registerLocalFirstIdAlias(localDraft.id, canonicalDraft.id));
    } else {
      await act(async () => registerLocalFirstIdAlias(localDraft.id, canonicalDraft.id));
      assertOpen(localDraft.id);
      rows = [canonicalDraft, historical];
      act(() => rendered.rerender(<ProjectCalculatorTab host="host" projectId="proj_1" />));
    }
    assertOpen(canonicalDraft.id);
    expect(replace).toHaveBeenLastCalledWith('/staff/projects/proj_1?tab=estimates&campaign=winter&estimateId=est_saved', { scroll: false });
    search = new URL(String(replace.mock.calls.at(-1)?.[0]), 'https://portal.example').search.slice(1);
    act(() => rendered.rerender(<ProjectCalculatorTab host="host" projectId="proj_1" />));
    assertOpen(canonicalDraft.id);
    rendered.unmount();
  });

  it('opens an already acknowledged local save with its canonical URL', async () => {
    search = 'tab=estimates&fromEstimateId=est_history';
    savedFixtureId = 'local-estimate:fast-create';
    await registerLocalFirstIdAlias(savedFixtureId, 'est_saved');
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    await settleEditor();
    const save = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Save fixture');
    act(() => save!.click());
    expect(replace).toHaveBeenLastCalledWith('/staff/projects/proj_1?tab=estimates&estimateId=est_saved', { scroll: false });
    rendered.unmount();
  });

  it('preserves the complete temporary ID when selecting a queued local draft', async () => {
    const localDraft = { ...activeDraft, id: 'local-estimate:offline' };
    useQueryMock.mockReturnValue({ data: [localDraft, historical], isPending: false, isError: false });
    search = 'tab=estimates&newDesign=1';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    await settleEditor();
    const select = rendered.container.querySelector<HTMLSelectElement>('[aria-label="Design version"]')!;
    act(() => {
      select.value = `draft:${localDraft.id}`;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(replace).toHaveBeenLastCalledWith('/staff/projects/proj_1?tab=estimates&estimateId=local-estimate%3Aoffline', { scroll: false });
    rendered.unmount();
  });

  it('does not recover a temporary working copy from another project', async () => {
    const id = 'local-estimate:foreign-project';
    await writeLocalFirstWorkingCopy({ entityKey: buildEstimateEntityKey(id), data: { ...activeDraft, id, projectId: 'proj_2' } });
    search = `tab=estimates&estimateId=${encodeURIComponent(id)}`;
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    await settleEditor();
    expect(rendered.container.querySelector('[data-calculator-invalid-source]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="embedded-calculator"]')).toBeNull();
    rendered.unmount();
  });

  it('requires Start revision before a historical source can be edited', async () => {
    search = 'tab=estimates&estimateId=est_history';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    await settleEditor();
    expect(rendered.container.querySelector('[data-calculator-locked-source="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-project-calculator-state-navigation="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[aria-label="Design version"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="embedded-calculator"]')).toBeNull();

    const startRevision = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Start revision');
    act(() => startRevision?.click());
    expect(replace).toHaveBeenCalledWith('/staff/projects/proj_1?tab=estimates&fromEstimateId=est_history', { scroll: false });
    rendered.unmount();
  });

  it('offers a deliberate blank estimate when the project has no designs', async () => {
    useQueryMock.mockReturnValue({ data: [], isPending: false, isError: false });
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    await settleEditor();
    expect(rendered.container.textContent).toContain('No estimates yet');
    const create = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Create estimate');
    act(() => create?.click());
    const openCalculator = Array.from(document.body.querySelectorAll('button'))
      .find((button) => button.textContent === 'Open calculator');
    act(() => openCalculator?.click());
    expect(push).toHaveBeenCalledWith('/staff/projects/proj_1?tab=estimates&newDesign=1');
    rendered.unmount();
  });

  it('preserves add-on scope when reopening its active calculator draft', async () => {
    const addOnDraft = {
      ...activeDraft,
      id: 'est_add_on',
      commercialScopeId: '11111111-1111-4111-8111-111111111111',
      commercialScopeKind: 'add_on',
    };
    useQueryMock.mockReturnValue({ data: [activeDraft, addOnDraft], isPending: false, isError: false });
    search = 'tab=estimates&estimateId=est_add_on';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    await settleEditor();
    const calculator = rendered.container.querySelector('[data-testid="embedded-calculator"]');

    expect(calculator?.getAttribute('data-scope-kind')).toBe('add_on');
    expect(calculator?.getAttribute('data-scope-id')).toBe(addOnDraft.commercialScopeId);
    rendered.unmount();
  });

  it('opens a separate add-on estimate scope without replacing the base design', async () => {
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    await settleEditor();
    const createAddOn = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Create add-on estimate');
    act(() => createAddOn?.click());
    expect(document.body.textContent).toContain('Create a separate add-on scope');
    const openCalculator = Array.from(document.body.querySelectorAll('button'))
      .find((button) => button.textContent === 'Open calculator');
    act(() => openCalculator?.click());
    const href = String(push.mock.calls.at(-1)?.[0] ?? '');
    expect(href).toContain('tab=estimates&newDesign=1&estimateKind=add_on&commercialScopeId=');
    expect(href).toMatch(/commercialScopeId=[0-9a-f-]{36}/i);
    rendered.unmount();
  });

  it('opens Duplicate as a new calculator revision without mutating its source', async () => {
    search = 'tab=estimates&campaign=winter';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    await settleEditor();
    const actions = rendered.container.querySelector<HTMLButtonElement>('button[aria-label="Actions for Estimate V2"]');
    act(() => actions?.click());
    const menu = document.body.querySelector('[role="menu"]');
    expect(menu?.parentElement).toBe(document.body);
    const duplicate = Array.from(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
      .find((button) => button.textContent === 'Duplicate');
    act(() => duplicate?.click());
    expect(push).toHaveBeenCalledWith(
      '/staff/projects/proj_1?tab=estimates&campaign=winter&fromEstimateId=est_draft&estimateName=Copy+of+Estimate+V2',
    );
    rendered.unmount();
  });

  it('returns an explicit calculator deep link to the Estimates list', async () => {
    search = 'tab=estimates&estimateId=est_draft&campaign=winter';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    await settleEditor();
    const back = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Back to estimates');
    act(() => back?.click());
    expect(replace).toHaveBeenCalledWith('/staff/projects/proj_1?tab=estimates&campaign=winter', { scroll: false });
    rendered.unmount();
  });

  it('does not pass an invalid project design ID into the Calculator', async () => {
    search = 'tab=estimates&estimateId=est_missing';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    await settleEditor();
    expect(rendered.container.querySelector('[data-calculator-invalid-source="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="embedded-calculator"]')).toBeNull();
    rendered.unmount();
  });
  it('mounts its actual list and safe Find before metadata without starting a URL-requested default draft runtime', async () => {
    search = 'tab=estimates&newDesign=1&estimateName=Unverified';
    const view = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" projectReady={false} />);
    await settleEditor();
    const find = view.container.querySelector('#estimate-search');
    const table = view.container.querySelector('table');
    expect(find).not.toBeNull();
    expect((find as HTMLInputElement).disabled).toBe(false);
    expect(table?.textContent).toContain('V2');
    expect(view.container.querySelector('[data-testid="embedded-calculator"]')).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    view.rerender(<ProjectCalculatorTab host="host" projectId="proj_1" projectReady />);
    await settleEditor();
    expect(view.container.querySelector('[data-testid="embedded-calculator"]')?.getAttribute('data-create-new')).toBe('true');
    view.unmount();
  });

  it('keeps the actual list, Find and metadata read independent of held editor code', async () => {
    let release!: (value: { default: ComponentType<any> }) => void;
    const held = new Promise<{ default: ComponentType<any> }>(resolve => { release = resolve; });
    editorCode.load = () => held;
    useQueryMock.mockReturnValue({ data: undefined, isPending: true, isError: false });
    const view = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    const find = view.container.querySelector<HTMLInputElement>('#estimate-search')!;
    const table = view.container.querySelector('table');
    expect(find.disabled).toBe(false); expect(table?.textContent).toContain('Reading estimates');
    expect(editorCode.calls).not.toHaveBeenCalled();
    find.focus();
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(find, 'V2');
      find.dispatchEvent(new Event('input', { bubbles: true }));
    });
    useQueryMock.mockImplementation(options => ({ data: options.queryKey?.[0] === 'quote-links' ? [] : [activeDraft, historical], isPending: false, isError: false }));
    view.rerender(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    expect(view.container.querySelector('#estimate-search')).toBe(find);
    expect(view.container.querySelector('table')).toBe(table);
    expect(document.activeElement).toBe(find); expect(find.value).toBe('V2');
    expect(table?.textContent).toContain('V2');
    expect(editorCode.calls).not.toHaveBeenCalled();
    search = 'tab=estimates&estimateId=est_draft';
    await act(async () => view.rerender(<ProjectCalculatorTab host="host" projectId="proj_1" />));
    expect(editorCode.calls).toHaveBeenCalledTimes(1);
    expect(view.container.textContent).toContain('Preparing calculator tools');
    expect(view.container.querySelector('[data-testid="embedded-calculator"]')).toBeNull();
    await act(async () => { release(await import('@/app/staff/calculator/CalculatorGridClient')); });
    expect(view.container.querySelector('[data-testid="embedded-calculator"]')?.getAttribute('data-edit-estimate-id')).toBe('est_draft');
    view.unmount();
  });

  it('keeps Back on the actual list when retired editor code arrives later', async () => {
    let release!: (value: { default: ComponentType<any> }) => void;
    editorCode.load = () => new Promise(resolve => { release = resolve; });
    search = 'tab=estimates&estimateId=est_draft&campaign=winter';
    const view = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    expect(view.container.textContent).toContain('Preparing calculator tools');
    const back = [...view.container.querySelectorAll('button')].find(button => button.textContent === 'Back to estimates')!;
    act(() => back.click());
    search = new URL(String(replace.mock.calls.at(-1)?.[0]), 'https://portal.test').search.slice(1);
    view.rerender(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    const find = view.container.querySelector('#estimate-search'); const table = view.container.querySelector('table');
    expect(search).toBe('tab=estimates&campaign=winter');
    await act(async () => { release(await import('@/app/staff/calculator/CalculatorGridClient')); });
    expect(view.container.querySelector('#estimate-search')).toBe(find); expect(view.container.querySelector('table')).toBe(table);
    expect(view.container.querySelector('[data-testid="embedded-calculator"]')).toBeNull();
    view.unmount();
  });

  it('rejects a retired project editor while the current project waits for its own code', async () => {
    let releaseA!: (value: { default: ComponentType<any> }) => void, releaseB!: (value: { default: ComponentType<any> }) => void;
    const heldA = new Promise<{ default: ComponentType<any> }>(resolve => { releaseA = resolve; });
    const heldB = new Promise<{ default: ComponentType<any> }>(resolve => { releaseB = resolve; });
    editorCode.load = vi.fn().mockReturnValueOnce(heldA).mockReturnValueOnce(heldB);
    search = 'tab=estimates&newDesign=1';
    const view = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    view.rerender(<ProjectCalculatorTab host="host" projectId="proj_2" />);
    expect(editorCode.calls).toHaveBeenCalledTimes(2);
    await act(async () => { releaseA(await import('@/app/staff/calculator/CalculatorGridClient')); });
    expect(view.container.querySelector('[data-testid="embedded-calculator"]')).toBeNull();
    await act(async () => { releaseB(await import('@/app/staff/calculator/CalculatorGridClient')); });
    expect(view.container.querySelector('[data-testid="embedded-calculator"]')?.getAttribute('data-project-id')).toBe('proj_2');
    expect(push).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled();
    view.unmount();
  });

  it('offers explicit code Retry without automatic loops and retires it on unmount', async () => {
    const second = { default: ({ workspace }: any) => <button data-recovered-editor onClick={() => workspace.onEstimateSaved('est_recovered')}>Save recovered</button> };
    editorCode.load = vi.fn().mockRejectedValueOnce(new Error('Fictional chunk unavailable')).mockResolvedValueOnce(second);
    search = 'tab=estimates&newDesign=1&campaign=winter';
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    await settleEditor();
    expect(view.container.textContent).toContain('Calculator tools unavailable');
    expect(view.container.querySelector('[data-recovered-editor]')).toBeNull();
    expect(editorCode.calls).toHaveBeenCalledTimes(1);
    await act(async () => [...view.container.querySelectorAll('button')].find(button => button.textContent === 'Retry')!.click());
    expect(editorCode.calls).toHaveBeenCalledTimes(2);
    expect(view.container.querySelector('[data-recovered-editor]')).not.toBeNull();
    act(() => view.container.querySelector<HTMLButtonElement>('[data-recovered-editor]')!.click());
    expect(replace).toHaveBeenLastCalledWith('/staff/projects/proj_1?tab=estimates&campaign=winter&estimateId=est_recovered', { scroll: false });
    expect(errors.mock.calls.flat().some(value => String(value).includes('Fictional chunk unavailable'))).toBe(true);
    view.unmount(); errors.mockRestore();
    let release!: (value: typeof second) => void;
    editorCode.load = () => new Promise(resolve => { release = resolve; });
    const retired = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    retired.unmount();
    await act(async () => release(second));
    expect(document.querySelector('[data-recovered-editor]')).toBeNull();
    expect(editorCode.calls).toHaveBeenCalledTimes(3);
  });

});
