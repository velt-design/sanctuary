import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import ProjectCalculatorTab from './ProjectCalculatorTab';

const replace = vi.fn();
const useQueryMock = vi.fn();
let search = 'tab=estimates';

vi.mock('next/navigation', () => ({
  usePathname: () => '/staff/projects/proj_1',
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
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
    search = 'tab=estimates';
    useQueryMock.mockReturnValue({ data: [activeDraft, historical], isPending: false, isError: false });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens the active editable draft when the project route has no design intent', () => {
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    expect(replace).toHaveBeenCalledWith('/staff/projects/proj_1?tab=estimates&estimateId=est_draft');
    rendered.unmount();
  });

  it('moves active design navigation into the embedded Calculator command surface', () => {
    search = 'tab=estimates&estimateId=est_draft';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    expect(rendered.container.querySelector('[data-project-calculator-state-navigation]')).toBeNull();
    expect(rendered.container.querySelector<HTMLSelectElement>('[aria-label="Design version"]')?.value).toBe('draft:est_draft');
    expect(rendered.container.querySelector('[data-testid="design-state"]')?.textContent).toBe('Current draft · V2');
    expect(rendered.container.textContent).not.toContain('Project Calculator');
    rendered.unmount();
  });

  it('fixes the embedded Calculator to the project and normalizes its URL after save', () => {
    search = 'tab=estimates&fromEstimateId=est_history&campaign=winter';
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    const calculator = rendered.container.querySelector('[data-testid="embedded-calculator"]');

    expect(calculator?.getAttribute('data-project-id')).toBe('proj_1');
    expect(calculator?.getAttribute('data-from-estimate-id')).toBe('est_history');
    expect(calculator?.getAttribute('data-create-new')).toBe('true');

    act(() => rendered.container.querySelector<HTMLButtonElement>('button')?.click());
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

  it('starts with a deliberate blank design when the project has no designs', () => {
    useQueryMock.mockReturnValue({ data: [], isPending: false, isError: false });
    const rendered = renderIntoDocument(<ProjectCalculatorTab host="host" projectId="proj_1" />);
    expect(replace).toHaveBeenCalledWith('/staff/projects/proj_1?tab=estimates&newDesign=1');
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
