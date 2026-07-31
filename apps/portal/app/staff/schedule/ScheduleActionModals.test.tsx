import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScheduleActionModals, { type ScheduleActionModalsProps, type ScheduleModalState } from './ScheduleActionModals';
import { renderIntoDocument } from '../../../../../test/reactHarness';

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
    findJobPresentation: () => ({
      scheduleItemId: 'sch_1',
      projectName: 'Alpha Deck',
      customerName: 'Alex Customer',
      siteAddress: '10 Harbour Road',
      identityDetail: 'Alex Customer · 10 Harbour Road',
      searchText: 'alpha deck alex customer 10 harbour road',
      crewName: 'Crew Alpha',
      startDate: '2026-04-07',
      endDate: '2026-04-08',
      durationDays: 2,
    }),
    formatShortDate: (value) => value,
    formatCommitImpactList: () => 'Crew Bravo pulls forward by 2 days',
    setQuickEdit: vi.fn(),
    setCommitmentEdit: vi.fn(),
    setDurationEdit: vi.fn(),
    setPinEdit: vi.fn(),
    setDaysRemainingEdit: vi.fn(),
    setDowntimeEdit: vi.fn(),
    onCancelFinishEarly: vi.fn(),
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
    const saveButton = Array.from(document.body.querySelectorAll('button')).find((node) => node.textContent === 'Save') as HTMLButtonElement;

    expect(document.body.textContent).toContain('Quick edit');
    expect(document.body.textContent).toContain('Alex Customer · 10 Harbour Road');
    expect(document.body.textContent).toContain('Current2026-04-07 to 2026-04-08 · 2d');
    expect(document.body.textContent).toContain('ProposedStarts 2026-04-07 · 2d');

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
    const confirmButton = Array.from(document.body.querySelectorAll('button')).find((node) => node.textContent === 'Confirm') as HTMLButtonElement;

    expect(confirmButton.disabled).toBe(true);

    rendered.unmount();
  });

  it('keeps quick extensions inside the duration workflow', () => {
    const props = buildProps(buildState({ durationEdit: { id: 'sch_1', durationDays: '2' } }));
    const rendered = renderIntoDocument(<ScheduleActionModals {...props} />);
    const addTwoDays = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === '+2 days',
    );

    expect(addTwoDays).toBeTruthy();
    act(() => addTwoDays?.click());
    const update = vi.mocked(props.setDurationEdit).mock.calls[0]?.[0];
    expect(typeof update).toBe('function');
    if (typeof update === 'function') {
      expect(update({ id: 'sch_1', durationDays: '2' })).toEqual({ id: 'sch_1', durationDays: '4' });
    }
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
    const pullForwardButton = Array.from(document.body.querySelectorAll('button')).find((node) => node.textContent === 'Pull forward') as HTMLButtonElement;

    expect(document.body.textContent).toContain('Alpha Deck');
    expect(document.body.textContent).toContain('Crew: Crew Alpha');
    expect(document.body.textContent).toContain('Crew Bravo pulls forward by 2 days');

    act(() => {
      pullForwardButton.click();
    });

    expect(props.onFinishEarlyPullForward).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });

  it('routes finish-early cancellation through the parent trust handler', () => {
    const props = buildProps(
      buildState({
        finishEarlyPrompt: {
          jobId: 'proj_alpha',
          scheduleItemId: 'sch_1',
          freedDays: 2,
          actualFinish: '2026-04-03',
          forecastEndExclusive: '2026-04-06',
          impacts: [],
        },
      }),
    );
    const rendered = renderIntoDocument(<ScheduleActionModals {...props} />);
    const cancelButton = Array.from(document.body.querySelectorAll('button')).find(
      (node) => node.textContent === 'Cancel',
    ) as HTMLButtonElement;

    act(() => cancelButton.click());

    expect(props.onCancelFinishEarly).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });
});
