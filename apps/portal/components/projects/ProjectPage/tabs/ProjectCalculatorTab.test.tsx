import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import ProjectCalculatorTab from './ProjectCalculatorTab';
import { __resetLocalFirstStoreForTests, __setLocalFirstStorageAdapterForTests, ensureLocalFirstStoreReady, registerLocalFirstIdAlias, writeLocalFirstWorkingCopy } from '@/lib/localFirst/store';
import { buildEstimateEntityKey } from '@/lib/localFirst/portalEntities';

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
  designKind: 'calculator',
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
    replace.mockReset();
    push.mockReset();
    search = 'tab=estimates';
    useQueryMock.mockImplementation((options) => ({ data: options.queryKey?.[0] === 'quote-links' ? [] : [activeDraft, historical], isPending: false, isError: false }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the versioned estimate list when the route has no design intent', () => {
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
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

  it('moves active design navigation into the embedded Calculator command surface', () => {
    search = 'tab=estimates&estimateId=est_draft';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" projectName="Deck Build" />);
    expect(rendered.container.querySelector('[data-project-calculator-state-navigation]')).toBeNull();
    expect(rendered.container.querySelector<HTMLSelectElement>('[aria-label="Design version"]')?.value).toBe('draft:est_draft');
    expect(rendered.container.querySelector('[data-testid="design-state"]')?.textContent).toBe('Current draft · V2');
    expect(rendered.container.textContent).not.toContain('Project Calculator');
    expect(rendered.container.textContent).toContain('Back to estimates');
    expect(rendered.container.querySelector('[data-calculator-workspace-bar="true"]')?.textContent).toContain('Deck Build');
    expect(rendered.container.querySelector('[data-calculator-workspace-bar="true"]')?.textContent).toContain('V2');
    rendered.unmount();
  });

  it('fixes the embedded Calculator to the project and normalizes its URL after save', () => {
    search = 'tab=estimates&fromEstimateId=est_history&campaign=winter';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
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
    expect(rendered.container.querySelector('[data-calculator-invalid-source]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="embedded-calculator"]')).toBeNull();
    rendered.unmount();
  });

  it('requires Start revision before a historical source can be edited', () => {
    search = 'tab=estimates&estimateId=est_history';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
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

  it('offers a deliberate blank estimate when the project has no designs', () => {
    useQueryMock.mockReturnValue({ data: [], isPending: false, isError: false });
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
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

  it('preserves add-on scope when reopening its active calculator draft', () => {
    const addOnDraft = {
      ...activeDraft,
      id: 'est_add_on',
      commercialScopeId: '11111111-1111-4111-8111-111111111111',
      commercialScopeKind: 'add_on',
    };
    useQueryMock.mockReturnValue({ data: [activeDraft, addOnDraft], isPending: false, isError: false });
    search = 'tab=estimates&estimateId=est_add_on';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    const calculator = rendered.container.querySelector('[data-testid="embedded-calculator"]');

    expect(calculator?.getAttribute('data-scope-kind')).toBe('add_on');
    expect(calculator?.getAttribute('data-scope-id')).toBe(addOnDraft.commercialScopeId);
    rendered.unmount();
  });

  it('opens a separate add-on estimate scope without replacing the base design', () => {
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
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

  it('opens Duplicate as a new calculator revision without mutating its source', () => {
    search = 'tab=estimates&campaign=winter';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
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

  it('returns an explicit calculator deep link to the Estimates list', () => {
    search = 'tab=estimates&estimateId=est_draft&campaign=winter';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    const back = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Back to estimates');
    act(() => back?.click());
    expect(replace).toHaveBeenCalledWith('/staff/projects/proj_1?tab=estimates&campaign=winter', { scroll: false });
    rendered.unmount();
  });

  it('does not pass an invalid project design ID into the Calculator', () => {
    search = 'tab=estimates&estimateId=est_missing';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    expect(rendered.container.querySelector('[data-calculator-invalid-source="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="embedded-calculator"]')).toBeNull();
    rendered.unmount();
  });

  it.each(['button', 'row', 'Enter', ' '] as const)('opens Studio review from the %s action without assuming draft editability', (action) => {
    const studio = { ...activeDraft, designKind: 'studio', hasSentQuote: true };
    useQueryMock.mockImplementation(options => ({ data: options.queryKey?.[0] === 'quote-links' ? [] : [studio, historical], isPending: false, isError: false }));
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    const row = rendered.container.querySelector<HTMLElement>('[data-estimate-id="est_draft"]')!;
    expect(row.getAttribute('aria-label')).toContain('Open in Studio');
    act(() => {
      if (action === 'button') Array.from(row.querySelectorAll('button')).find(button => button.textContent === 'Open in Studio')!.click();
      else if (action === 'row') row.click();
      else row.dispatchEvent(new KeyboardEvent('keydown', { key: action, bubbles: true }));
    });
    expect(push).toHaveBeenLastCalledWith('/staff/design-studio/proj_1/est_draft');
    expect(rendered.container.querySelector('[data-testid="embedded-calculator"]')).toBeNull();
    rendered.unmount();
  });

  it.each([
    ['estimateId=est_history', '/staff/design-studio/proj_1/est_history'],
    ['fromEstimateId=est_history', '/staff/design-studio/proj_1/est_history/edit?intent=revision'],
  ])('recovers saved and quote-source bookmarks through Studio authority: %s', (params, href) => {
    search = `tab=estimates&${params}`;
    useQueryMock.mockReturnValue({ data: [activeDraft, { ...historical, designKind: 'studio' }], isPending: false, isError: false });
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    expect(replace).toHaveBeenCalledWith(href);
    expect(rendered.container.querySelector('[data-testid="embedded-calculator"]')).toBeNull();
    expect(rendered.container.querySelector('[data-calculator-locked-source]')).toBeNull();
    rendered.unmount();
  });

  it('sends Studio duplicate to the existing explicit new-revision confirmation', () => {
    useQueryMock.mockImplementation(options => ({ data: options.queryKey?.[0] === 'quote-links' ? [] : [{ ...historical, designKind: 'studio' }], isPending: false, isError: false }));
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    act(() => rendered.container.querySelector<HTMLButtonElement>('button[aria-label="Actions for Estimate V1"]')!.click());
    act(() => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(button => button.textContent === 'Duplicate in Studio')!.click());
    expect(push).toHaveBeenCalledWith('/staff/design-studio/proj_1/est_history/edit?intent=duplicate');
    rendered.unmount();
  });

  it('opens a historical Studio version from the calculator selector without converting the source', () => {
    search = 'tab=estimates&newDesign=1';
    useQueryMock.mockReturnValue({ data: [activeDraft, { ...historical, designKind: 'studio' }], isPending: false, isError: false });
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    const select = rendered.container.querySelector<HTMLSelectElement>('[aria-label="Design version"]')!;
    act(() => { select.value = 'history:est_history'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(push).toHaveBeenCalledWith('/staff/design-studio/proj_1/est_history');
    rendered.unmount();
  });
});
