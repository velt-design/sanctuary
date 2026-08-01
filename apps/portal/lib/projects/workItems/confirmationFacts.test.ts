import { describe, expect, it } from 'vitest';
import { activeConfirmationEventRows, hasActiveProjectConfirmation } from './confirmationFacts';

describe('active project confirmation facts', () => {
  it('keeps confirmed facts unless an append-only retraction targets them', () => {
    const rows = [
      {
        id: 'visit-1',
        project_id: 'project-1',
        event_kind: 'CONFIRMED',
        confirmation_type: 'SITE_VISIT_COMPLETED',
        retracts_event_id: null,
      },
      {
        id: 'visit-2',
        project_id: 'project-2',
        event_kind: 'CONFIRMED',
        confirmation_type: 'SITE_VISIT_COMPLETED',
        retracts_event_id: null,
      },
      {
        id: 'retraction-1',
        project_id: 'project-1',
        event_kind: 'RETRACTED',
        confirmation_type: 'SITE_VISIT_COMPLETED',
        retracts_event_id: 'visit-1',
      },
    ];

    expect(activeConfirmationEventRows(rows).map((row) => row.id)).toEqual(['visit-2']);
    expect(hasActiveProjectConfirmation(rows, 'project-1', 'SITE_VISIT_COMPLETED')).toBe(false);
    expect(hasActiveProjectConfirmation(rows, 'project-2', 'SITE_VISIT_COMPLETED')).toBe(true);
  });
});
