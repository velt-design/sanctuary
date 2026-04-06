import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScheduleActionModals, { type ScheduleActionModalsProps, type ScheduleModalState } from './ScheduleActionModals';
import { renderIntoDocument } from '../../../../../test/reactHarness';

vi.mock('@/components/ui/modal/Modal', () => ({
  default: ({ open, children, ariaLabel }: any) => (open ? <div role="dialog" aria-label={ariaLabel}>{children}</div> : null),
}));

function buildState(overrides: Partial<ScheduleModalState> = {}): ScheduleModalState {
  return {
    quickEdit: null,
    commitmentEdit: null,
    durationEdit: null,
    pinEdit: null,
    daysRemainingEdit: null,
    downtimeEdit: null,
    finishEarlyPrompt: null,
    ...overrides,
  };
}

function buildProps(state: ScheduleModalState): ScheduleActionModalsProps {
  return {
    state,
    scheduleMode: 'v2',
    findScheduleItem: () => ({ id: 'sch_1' } as any),
    findProjectName: () => 'Alpha Deck',
    formatShortDate: (value) => value,
    formatCommitImpactList: () => 'Crew Bravo pulls forward by 2 days',
    setQuickEdit: vi.fn(),
    setCommitmentEdit: vi.fn(),
    setDurationEdit: vi.fn(),
    setPinEdit: vi.fn(),
    setDaysRemainingEdit: vi.fn(),
    setDowntimeEdit: vi.fn(),
    setFinishEarlyPrompt: vi.fn(),
    onSaveQuickEdit: vi.fn(),
    onSaveCommitment: vi.fn(),
    onSaveDuration: vi.fn(),
    onSavePin: vi.fn(),
    onSaveDaysRemaining: vi.fn(),
    onSaveDowntime: vi.fn(),
    onFinishEarlyKeepSchedule: vi.fn(),
    onFinishEarlyPullForward: vi.fn(),
  };
}

describe('ScheduleActionModals', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders quick edit lazily and forwards the save action', () => {
    const props = buildProps(
      buildState({
        quickEdit: {
          id: 'sch_1',
          startDateOverride: '2026-04-07',
          durationDays: '2',
        },
      }),
    );

    const rendered = renderIntoDocument(<ScheduleActionModals {...props} />);
    const saveButton = Array.from(rendered.container.querySelectorAll('button')).find((node) => node.textContent === 'Save') as HTMLButtonElement;

    expect(rendered.container.textContent).toContain('Quick edit');

    act(() => {
      saveButton.click();
    });

    expect(props.onSaveQuickEdit).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });

  it('keeps invalid commitment state disabled until the dates and flex are valid', () => {
    const props = buildProps(
      buildState({
        commitmentEdit: {
          id: 'sch_1',
          mode: 'lock',
          commitmentType: 'fixed_date',
          weekOfDate: '',
          startDate: '',
          durationDays: '0',
          flexDays: '-1',
          hardLock: true,
        },
      }),
    );

    const rendered = renderIntoDocument(<ScheduleActionModals {...props} />);
    const confirmButton = Array.from(rendered.container.querySelectorAll('button')).find((node) => node.textContent === 'Confirm') as HTMLButtonElement;

    expect(confirmButton.disabled).toBe(true);

    rendered.unmount();
  });

  it('renders the finish-early prompt and forwards the pull-forward action', () => {
    const props = buildProps(
      buildState({
        finishEarlyPrompt: {
          jobId: 'proj_alpha',
          scheduleItemId: 'sch_1',
          freedDays: 2,
          actualFinish: '2026-04-03',
          forecastEndExclusive: '2026-04-06',
          impacts: [{ id: 1 }],
        },
      }),
    );

    const rendered = renderIntoDocument(<ScheduleActionModals {...props} />);
    const pullForwardButton = Array.from(rendered.container.querySelectorAll('button')).find((node) => node.textContent === 'Pull forward') as HTMLButtonElement;

    expect(rendered.container.textContent).toContain('Alpha Deck');
    expect(rendered.container.textContent).toContain('Crew Bravo pulls forward by 2 days');

    act(() => {
      pullForwardButton.click();
    });

    expect(props.onFinishEarlyPullForward).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });
});
