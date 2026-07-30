import { describe, expect, it } from 'vitest';
import { applyOptimisticRunningJobCellValue, getRunningJobCellEditability, normalizeRunningJobCellInput } from './editing';
import { groupRunningJobRows } from './group';
import type { RunningJobRow, RunningJobsResponse } from './types';

function makeRow(overrides: Partial<RunningJobRow> = {}): RunningJobRow {
  return {
    projectId: 'proj_1',
    source: 'live',
    groupYear: null,
    sourceRowNumber: null,
    contactId: 'ct_1',
    siteVisitEventId: null,
    scheduledJobId: null,
    latestEstimateId: null,
    latestQuoteVersionId: null,
    legacy: null,
    stage: 'DEPOSIT',
    sortDate: null,
    rowVersion: 'v1',
    displayTextByCell: {},
    cells: {
      client_name: 'Alex Santos',
      phone_number: '021',
      site_address: '29A Victor St',
      site_visit_rep: null,
      deposit_paid_date: null,
      materials_ordered: false,
      pergola_type: 'Pitched Pergola',
      estimated_start_date: null,
      final_payment_date: null,
      job_assigned_to: null,
      job_completed: false,
      lights_status: 'TBC',
      blinds_status: 'No',
      install_days: null,
      size_text: '6x3m',
      colour_text: 'Ironsands',
      roofing_text: 'Acrylic',
      roofing_ordered: false,
      running_notes: '',
    },
    derived: {
      pergola_type: 'Pitched Pergola',
      lights_status: 'TBC',
      blinds_status: 'No',
      size_text: '6x3m',
      colour_text: 'Ironsands',
      roofing_text: 'Acrylic',
    },
    state: {
      workModelVersion: null,
      projectCreatedAt: '2026-01-15T00:00:00Z',
      hasSiteVisit: false,
      hasSchedule: false,
      hasCrewAssigned: false,
      hasEstimatedStartDate: false,
      hasLatestEstimate: false,
      tasks: {
        materialsOrdered: false,
        roofingOrdered: false,
        jobComplete: false,
      },
      siteVisit: {
        salespersonId: null,
        status: null,
        updatedAt: null,
      },
      schedule: {
        crewId: null,
        plannedStart: null,
        forecastStart: null,
        plannedDurationDays: null,
        forecastDurationDays: null,
        actualStart: null,
        actualFinish: null,
        status: null,
        updatedAt: null,
      },
      meta: {
        rowVersion: 0,
        lightsStatus: null,
        materialsOrderedAt: null,
        materialsOrderedBy: null,
        roofingOrderedAt: null,
        roofingOrderedBy: null,
        updatedAt: null,
      },
    },
    ...overrides,
  };
}

const LOOKUPS: RunningJobsResponse['lookups'] = {
  crews: [{ id: 'crew-1', name: 'Jayden', shortCode: 'JW', color: null, active: true }],
  salesPeople: [{ id: 'steve', name: 'Steve', shortLabel: 'SC' }],
};

describe('normalizeRunningJobCellInput', () => {
  it('requires positive install days and trims direct text fields', () => {
    expect(normalizeRunningJobCellInput('site_address', ' 123 Example Rd ')).toEqual({ ok: true, value: '123 Example Rd' });
    expect(normalizeRunningJobCellInput('install_days', 0)).toEqual({ ok: false, error: 'Install days must be at least 1.' });
    expect(normalizeRunningJobCellInput('estimated_start_date', '2026-03-18')).toEqual({ ok: true, value: '2026-03-18' });
  });
});

describe('getRunningJobCellEditability', () => {
  it('blocks schedule-owned cells until their backing rows exist', () => {
    const row = makeRow();

    expect(getRunningJobCellEditability(row, 'estimated_start_date')).toEqual({ editable: false, reason: 'Assign a crew first.' });
    expect(getRunningJobCellEditability(row, 'install_days')).toEqual({ editable: false, reason: 'Create schedule state first.' });
    expect(getRunningJobCellEditability(row, 'job_completed')).toEqual({ editable: false, reason: 'Create schedule state first.' });
  });
});

describe('applyOptimisticRunningJobCellValue', () => {
  it('updates display cells and schedule state for optimistic crew assignment', () => {
    const row = applyOptimisticRunningJobCellValue(makeRow(), 'job_assigned_to', 'crew-1', LOOKUPS);

    expect(row.cells.job_assigned_to).toBe('JW');
    expect(row.state.schedule.crewId).toBe('crew-1');
    expect(row.state.hasCrewAssigned).toBe(true);
    expect(row.state.hasSchedule).toBe(true);
  });

  it('re-groups rows when an optimistic start date changes year', () => {
    const base = makeRow();
    const changed = applyOptimisticRunningJobCellValue(base, 'estimated_start_date', '2027-01-10', LOOKUPS);
    const groups = groupRunningJobRows([changed]);

    expect(groups[0]?.year).toBe(2027);
    expect(groups[0]?.rows[0]?.sortDate).toBe('2027-01-10');
  });

  it.each([null, 2] as const)(
    'does not clear Schedule completion when model version %s materials are cleared',
    (workModelVersion) => {
    const initial = makeRow();
    const base = makeRow({
      state: {
        ...initial.state,
        workModelVersion,
        tasks: {
          materialsOrdered: true,
          roofingOrdered: false,
          jobComplete: true,
        },
      },
    });

    const changed = applyOptimisticRunningJobCellValue(base, 'materials_ordered', false, LOOKUPS);

    expect(changed.state.tasks).toEqual({
      materialsOrdered: false,
      roofingOrdered: false,
      jobComplete: true,
    });
    },
  );
});
