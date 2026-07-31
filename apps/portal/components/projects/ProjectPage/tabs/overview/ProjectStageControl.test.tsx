import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import ProjectStageControl from './ProjectStageControl';

const mocks = vi.hoisted(() => ({
  correctProjectStage: vi.fn(),
  invalidate: vi.fn(),
  patchList: vi.fn(),
  patchSnapshot: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));
vi.mock('@/components/ui/PipelineModal', () => ({
  PIPELINE_MODAL_ACTION_CLASSES: { primary: 'primary', secondary: 'secondary' },
  PipelineModal: ({ title, description, actions, children }: any) => (
    <section role="dialog" aria-label={title}>
      <p>{description}</p>
      {children}
      {actions}
    </section>
  ),
}));
vi.mock('@/lib/repo/projectsRepo', () => ({ correctProjectStage: mocks.correctProjectStage }));
vi.mock('@/lib/queries/projectCache', () => ({
  invalidateProjectReadCaches: mocks.invalidate,
  patchProjectListItem: mocks.patchList,
  patchProjectSnapshot: mocks.patchSnapshot,
}));
vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
}));

function click(container: Element, label: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    .find((candidate) => candidate.textContent?.trim() === label);
  if (!button) throw new Error(`Missing button: ${label}`);
  act(() => button.click());
  return button;
}

function changeControl(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (!setter) throw new Error('Missing value setter');
  act(() => {
    setter.call(control, value);
    control.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('ProjectStageControl', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.correctProjectStage.mockResolvedValue({ rollback: false, resetManualTaskCount: 0 });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('requires an explicit Apply and sends optional reason for a deposit transition', async () => {
    const rendered = renderIntoDocument(<ProjectStageControl projectId="proj_1" host="host" stage="sent" />);
    click(rendered.container, 'Correct stage');
    changeControl(rendered.container.querySelector('#project-stage-target') as HTMLSelectElement, 'deposit');
    changeControl(rendered.container.querySelector('#project-stage-reason') as HTMLInputElement, 'Deposit received');

    expect(mocks.correctProjectStage).not.toHaveBeenCalled();
    await act(async () => {
      click(rendered.container, 'Correct to Deposit');
      await Promise.resolve();
    });

    expect(mocks.correctProjectStage).toHaveBeenCalledWith('proj_1', 'DEPOSIT', { reason: 'Deposit received' });
    expect(mocks.patchSnapshot).toHaveBeenCalledOnce();
    expect(mocks.patchList).toHaveBeenCalledOnce();
    rendered.unmount();
  });

  it('keeps rollback Apply disabled until RESET is entered', () => {
    const rendered = renderIntoDocument(<ProjectStageControl projectId="proj_1" host="host" stage="deposit" />);
    click(rendered.container, 'Correct stage');
    changeControl(rendered.container.querySelector('#project-stage-target') as HTMLSelectElement, 'quoting');

    const apply = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Correct to Quoting');
    expect(apply?.disabled).toBe(true);

    changeControl(rendered.container.querySelector('#project-stage-reset') as HTMLInputElement, 'RESET');
    expect(apply?.disabled).toBe(false);
    rendered.unmount();
  });
});
