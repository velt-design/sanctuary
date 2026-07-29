import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/repo/apiClient';
import {
  isDefinitiveScheduleMutationFailure,
  isValidScheduleCrewSchedule,
  isValidScheduleMutationEnvelope,
  parseScheduleCommitImpacts,
  parseScheduleConfirmationEnvelope,
  parseScheduleFinishEarlyPreview,
  scheduleCommitImpactFingerprint,
  scheduleMutationNeedsReconciliation,
} from './scheduleMutationTrust';

const CREW_UUID = '00000000-0000-4000-8000-000000000001';
const SOURCE_CREW_UUID = '00000000-0000-4000-8000-000000000002';
const PROJECT_UUID = '00000000-0000-4000-8000-000000000101';
const OTHER_PROJECT_UUID = '00000000-0000-4000-8000-000000000102';
const SCHEDULED_JOB_UUID = '00000000-0000-4000-8000-000000000201';
const OTHER_SCHEDULED_JOB_UUID = '00000000-0000-4000-8000-000000000202';
const SCHEDULE_ITEM_UUID = '00000000-0000-4000-8000-000000000301';
const OTHER_SCHEDULE_ITEM_UUID = '00000000-0000-4000-8000-000000000302';
const DOWNTIME_UUID = '00000000-0000-4000-8000-000000000501';

function formatterShapedCrewSchedule(crewId = CREW_UUID) {
  return {
    crew_id: crewId,
    items: [
      {
        id: SCHEDULE_ITEM_UUID,
        item_type: 'job',
        position: 0,
        start: '2026-04-08',
        end_exclusive: '2026-04-10',
        duration_days: 2,
        job: {
          id: SCHEDULED_JOB_UUID,
          job_id: PROJECT_UUID,
          crew_id: crewId,
          mode: 'floating',
          planned_commitment_type: null,
          planned_week_start: null,
          planned_start: null,
          planned_duration_days: null,
          planned_flex_days: null,
          forecast_start: '2026-04-08',
          forecast_end_exclusive: '2026-04-10',
          forecast_duration_days: 2,
          actual_start: null,
          actual_finish: null,
          status: 'not_started',
          days_remaining: null,
        },
      },
    ],
    conflicts: [],
    next_available_date: '2026-04-10',
  };
}

describe('schedule mutation trust policy', () => {
  it.each([400, 401, 403, 422, 501])('treats HTTP %s as a definitive rejection', (status) => {
    const error = new ApiError('Rejected', { status, body: null });
    expect(isDefinitiveScheduleMutationFailure(error)).toBe(true);
    expect(scheduleMutationNeedsReconciliation(error)).toBe(false);
  });

  it.each([404, 409])('refreshes after stale-state HTTP %s rejections', (status) => {
    const error = new ApiError('Stale', { status, body: null });
    expect(isDefinitiveScheduleMutationFailure(error)).toBe(true);
    expect(scheduleMutationNeedsReconciliation(error)).toBe(true);
  });

  it.each([408, 500, 502, 503])('reconciles commit-ambiguous HTTP %s failures', (status) => {
    const error = new ApiError('Server error', { status, body: null });
    expect(isDefinitiveScheduleMutationFailure(error)).toBe(false);
    expect(scheduleMutationNeedsReconciliation(error)).toBe(true);
  });

  it('reconciles failures without a server response', () => {
    expect(isDefinitiveScheduleMutationFailure(new Error('Connection lost'))).toBe(false);
    expect(scheduleMutationNeedsReconciliation(new Error('Connection lost'))).toBe(true);
  });

  it('normalizes valid changed-job impacts', () => {
    expect(
      parseScheduleCommitImpacts([
        {
          job_id: ` ${PROJECT_UUID} `,
          scheduled_job_id: ` ${SCHEDULED_JOB_UUID} `,
          before_start: '2026-04-08',
          after_start: '2026-04-10',
        },
      ]),
    ).toEqual([
      {
        job_id: PROJECT_UUID,
        scheduled_job_id: SCHEDULED_JOB_UUID,
        before_start: '2026-04-08',
        after_start: '2026-04-10',
      },
    ]);
  });

  it.each([
    [[{}]],
    [[{ job_id: PROJECT_UUID, scheduled_job_id: SCHEDULED_JOB_UUID, before_start: 'bad-date', after_start: '2026-04-10' }]],
    [[{ job_id: PROJECT_UUID, scheduled_job_id: SCHEDULED_JOB_UUID, before_start: '2026-99-99', after_start: '2026-04-10' }]],
    [[{ job_id: PROJECT_UUID, scheduled_job_id: SCHEDULED_JOB_UUID, before_start: '2026-04-08', after_start: '2026-04-08' }]],
    [[
        { job_id: PROJECT_UUID, scheduled_job_id: SCHEDULED_JOB_UUID, before_start: '2026-04-08', after_start: '2026-04-10' },
        { job_id: OTHER_PROJECT_UUID, scheduled_job_id: SCHEDULED_JOB_UUID, before_start: '2026-04-10', after_start: '2026-04-12' },
    ]],
  ])('rejects malformed, unchanged, or duplicate commit impacts', (impacts) => {
    expect(parseScheduleCommitImpacts(impacts)).toBeNull();
  });

  it('normalizes impact order while preserving date changes', () => {
    const first = [
      { job_id: 'project-b', scheduled_job_id: 'scheduled-b', before_start: '2026-04-10', after_start: '2026-04-12' },
      { job_id: 'project-a', scheduled_job_id: 'scheduled-a', before_start: '2026-04-08', after_start: '2026-04-10' },
    ];
    const reordered = [first[1], first[0]];
    const changed = [
      first[1],
      { ...first[0], after_start: '2026-04-13' },
    ];

    expect(scheduleCommitImpactFingerprint(first)).toBe(scheduleCommitImpactFingerprint(reordered));
    expect(scheduleCommitImpactFingerprint(first)).not.toBe(scheduleCommitImpactFingerprint(changed));
  });

  it('accepts the formatter-shaped crew schedule where the irrelevant row property is omitted', () => {
    expect(isValidScheduleCrewSchedule(formatterShapedCrewSchedule())).toBe(true);
  });

  it('rejects a malformed nested crew schedule row', () => {
    expect(
      isValidScheduleCrewSchedule({
        ...formatterShapedCrewSchedule(),
        items: [
          {
            id: SCHEDULE_ITEM_UUID,
            item_type: 'job',
            position: 0,
            start: '2026-04-08',
            end_exclusive: '2026-04-10',
            duration_days: 2,
            job: null,
          },
        ],
      }),
    ).toBe(false);
  });

  it('rejects duplicate nested identities and conflicts that do not name a unique scheduled job', () => {
    const schedule = formatterShapedCrewSchedule();
    const firstItem = schedule.items[0];
    expect(
      isValidScheduleCrewSchedule({
        ...schedule,
        items: [
          firstItem,
          {
            ...firstItem,
            id: OTHER_SCHEDULE_ITEM_UUID,
            position: 1,
            start: '2026-04-10',
            end_exclusive: '2026-04-12',
            job: {
              ...firstItem.job,
              job_id: OTHER_PROJECT_UUID,
              forecast_start: '2026-04-10',
              forecast_end_exclusive: '2026-04-12',
            },
          },
        ],
        next_available_date: '2026-04-12',
      }),
    ).toBe(false);
    expect(
      isValidScheduleCrewSchedule({
        ...schedule,
        items: [
          firstItem,
          {
            ...firstItem,
            id: OTHER_SCHEDULE_ITEM_UUID,
            position: 1,
            start: '2026-04-10',
            end_exclusive: '2026-04-12',
            job: {
              ...firstItem.job,
              id: OTHER_SCHEDULED_JOB_UUID,
              forecast_start: '2026-04-10',
              forecast_end_exclusive: '2026-04-12',
            },
          },
        ],
        next_available_date: '2026-04-12',
      }),
    ).toBe(false);
    expect(
      isValidScheduleCrewSchedule({
        ...schedule,
        conflicts: [
          {
            job_id: OTHER_SCHEDULED_JOB_UUID,
            type: 'pinned_collision',
            expected_cursor_start: '2026-04-10',
            pinned_start: '2026-04-08',
            overlap_days: 2,
          },
        ],
      }),
    ).toBe(false);
    const validConflict = {
      job_id: SCHEDULED_JOB_UUID,
      type: 'pinned_collision',
      expected_cursor_start: '2026-04-10',
      pinned_start: '2026-04-08',
      overlap_days: 2,
    };
    expect(
      isValidScheduleCrewSchedule({
        ...schedule,
        conflicts: [validConflict, validConflict],
      }),
    ).toBe(false);
  });

  it('validates a complete finish-early preview', () => {
    expect(
      parseScheduleFinishEarlyPreview({
        requires_finish_early: true,
        freed_days: 2,
        actual_finish: '2026-04-08',
        forecast_end_exclusive: '2026-04-10',
        impacts: [
          {
            job_id: OTHER_PROJECT_UUID,
            scheduled_job_id: OTHER_SCHEDULED_JOB_UUID,
            before_start: '2026-04-10',
            after_start: '2026-04-08',
          },
        ],
      }),
    ).toEqual({
      freedDays: 2,
      actualFinish: '2026-04-08',
      forecastEndExclusive: '2026-04-10',
      impacts: [
        {
          job_id: OTHER_PROJECT_UUID,
          scheduled_job_id: OTHER_SCHEDULED_JOB_UUID,
          before_start: '2026-04-10',
          after_start: '2026-04-08',
        },
      ],
    });
  });

  it.each([
    { requires_finish_early: true, freed_days: 0, actual_finish: '2026-04-08', forecast_end_exclusive: '2026-04-10', impacts: [] },
    { requires_finish_early: true, freed_days: 2, actual_finish: 'bad-date', forecast_end_exclusive: '2026-04-10', impacts: [] },
    { requires_finish_early: true, freed_days: 2, actual_finish: '2026-04-08', forecast_end_exclusive: null, impacts: [] },
    { requires_finish_early: true, freed_days: 2, actual_finish: '2026-04-08', forecast_end_exclusive: '2026-04-08', impacts: [] },
    { requires_finish_early: true, freed_days: 2, actual_finish: '2026-04-08', forecast_end_exclusive: 'bad-date', impacts: [] },
    { requires_finish_early: true, freed_days: 2, actual_finish: '2026-04-08', forecast_end_exclusive: '2026-04-10' },
    { requires_finish_early: 1, freed_days: 2, actual_finish: '2026-04-08', forecast_end_exclusive: '2026-04-10', impacts: [] },
    { requires_finish_early: true, ok: true, freed_days: 2, actual_finish: '2026-04-08', forecast_end_exclusive: '2026-04-10', impacts: [] },
  ])('rejects an invalid finish-early preview', (preview) => {
    expect(parseScheduleFinishEarlyPreview(preview)).toBeNull();
  });

  it('requires a target schedule and matching top-level crew identity', () => {
    const schedule = formatterShapedCrewSchedule();
    expect(isValidScheduleMutationEnvelope({ ok: true, crew_id: CREW_UUID, schedule })).toBe(true);
    expect(isValidScheduleMutationEnvelope({ ok: true })).toBe(false);
    expect(
      isValidScheduleMutationEnvelope({ ok: true, crew_id: SOURCE_CREW_UUID, schedule }),
    ).toBe(false);
    expect(
      isValidScheduleMutationEnvelope({
        ok: true,
        crew_id: ` ${CREW_UUID}`,
        schedule: { ...schedule, crew_id: ` ${CREW_UUID}` },
      }),
    ).toBe(false);
    expect(
      isValidScheduleMutationEnvelope({
        ok: true,
        requires_confirmation: false,
        crew_id: CREW_UUID,
        schedule,
      }),
    ).toBe(false);
  });

  it('requires both matching source fields for a cross-crew response', () => {
    const schedule = formatterShapedCrewSchedule();
    const sourceSchedule = {
      ...formatterShapedCrewSchedule(SOURCE_CREW_UUID),
      items: [],
    };
    expect(
      isValidScheduleMutationEnvelope(
        {
          ok: true,
          crew_id: CREW_UUID,
          schedule,
          source_crew_id: SOURCE_CREW_UUID,
          source_schedule: sourceSchedule,
        },
        {
          requireSourceSchedule: true,
          expectedCrewId: CREW_UUID,
          expectedSourceCrewId: SOURCE_CREW_UUID,
        },
      ),
    ).toBe(true);
    expect(
      isValidScheduleMutationEnvelope(
        { ok: true, crew_id: CREW_UUID, schedule },
        { requireSourceSchedule: true },
      ),
    ).toBe(false);
    expect(
      isValidScheduleMutationEnvelope(
        {
          ok: true,
          crew_id: CREW_UUID,
          schedule,
          source_crew_id: SOURCE_CREW_UUID,
          source_schedule: formatterShapedCrewSchedule(SOURCE_CREW_UUID),
        },
        { requireSourceSchedule: true },
      ),
    ).toBe(false);
    const sourceWithCollidingItem = formatterShapedCrewSchedule(SOURCE_CREW_UUID);
    sourceWithCollidingItem.items = sourceWithCollidingItem.items.map((item) => ({
      ...item,
      id: SCHEDULE_ITEM_UUID,
      job: item.job
        ? {
            ...item.job,
            id: OTHER_SCHEDULED_JOB_UUID,
            job_id: OTHER_PROJECT_UUID,
          }
        : item.job,
    }));
    expect(
      isValidScheduleMutationEnvelope(
        {
          ok: true,
          crew_id: CREW_UUID,
          schedule,
          source_crew_id: SOURCE_CREW_UUID,
          source_schedule: sourceWithCollidingItem,
        },
        { requireSourceSchedule: true },
      ),
    ).toBe(false);
    const downtimeSchedule = (crewId: string, itemId: string) => ({
      crew_id: crewId,
      items: [
        {
          id: itemId,
          item_type: 'downtime' as const,
          position: 0,
          start: '2026-04-08',
          end_exclusive: '2026-04-09',
          duration_days: 1,
          downtime: {
            id: DOWNTIME_UUID,
            crew_id: crewId,
            duration_days: 1,
            reason: 'weather',
            note: null,
          },
        },
      ],
      conflicts: [],
      next_available_date: '2026-04-09',
    });
    expect(
      isValidScheduleMutationEnvelope(
        {
          ok: true,
          crew_id: CREW_UUID,
          schedule: downtimeSchedule(CREW_UUID, SCHEDULE_ITEM_UUID),
          source_crew_id: SOURCE_CREW_UUID,
          source_schedule: downtimeSchedule(SOURCE_CREW_UUID, OTHER_SCHEDULE_ITEM_UUID),
        },
        { requireSourceSchedule: true },
      ),
    ).toBe(false);
  });

  it('allows the explicit no-schedule acknowledgement exception', () => {
    expect(isValidScheduleMutationEnvelope({ ok: true }, { allowMissingSchedule: true })).toBe(true);
  });

  it('requires a literal, mutually exclusive confirmation envelope', () => {
    const impacts = [
      {
        job_id: PROJECT_UUID,
        scheduled_job_id: SCHEDULED_JOB_UUID,
        before_start: '2026-04-08',
        after_start: '2026-04-10',
      },
    ];
    expect(
      parseScheduleConfirmationEnvelope({
        requires_confirmation: true,
        impacts,
      }),
    ).toEqual(impacts);
    expect(
      parseScheduleConfirmationEnvelope({
        requires_confirmation: 'yes',
        impacts,
      }),
    ).toBeNull();
    expect(
      parseScheduleConfirmationEnvelope({
        requires_confirmation: true,
        ok: true,
        impacts,
      }),
    ).toBeNull();
  });
});
