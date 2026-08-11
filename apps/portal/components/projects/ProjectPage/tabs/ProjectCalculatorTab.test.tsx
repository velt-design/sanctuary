import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import ProjectCalculatorTab from './ProjectCalculatorTab';

const replace = vi.fn();
const push = vi.fn();
const useQueryMock = vi.fn();
let search = 'tab=estimates';

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

vi.mock('@/app/staff/calculator/CalculatorGridClient', () => ({
  default: ({ workspace }: any) => (
    <div
      data-testid="embedded-calculator"
      data-project-id={workspace.projectId}
      data-edit-estimate-id={workspace.editEstimateId ?? ''}
      data-from-estimate-id={workspace.fromEstimateId ?? ''}
      data-create-new={String(Boolean(workspace.createNewEstimate))}
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
      <button type="button" onClick={() => workspace.onEstimateSaved('est_saved')}>Save fixture</button>
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
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    search = 'tab=estimates';
    useQueryMock.mockReturnValue({ data: [activeDraft, historical], isPending: false, isError: false });
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
      '/staff/projects/proj_1?tab=estimates&campaign=winter&estimateId=est_saved',
    );
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
    expect(replace).toHaveBeenCalledWith('/staff/projects/proj_1?tab=estimates&fromEstimateId=est_history');
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

  it('opens Duplicate as a new calculator revision without mutating its source', () => {
    search = 'tab=estimates&campaign=winter';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    const duplicate = Array.from(rendered.container.querySelectorAll('button'))
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
    expect(replace).toHaveBeenCalledWith('/staff/projects/proj_1?tab=estimates&campaign=winter');
    rendered.unmount();
  });

  it('does not pass an invalid project design ID into the Calculator', () => {
    search = 'tab=estimates&estimateId=est_missing';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    expect(rendered.container.querySelector('[data-calculator-invalid-source="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="embedded-calculator"]')).toBeNull();
    rendered.unmount();
  });
});
