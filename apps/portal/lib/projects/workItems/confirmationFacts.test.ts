import { describe, expect, it } from 'vitest';
import { activeConfirmationEventRows, activeConfirmationProjectIds, hasActiveProjectConfirmation } from './confirmationFacts';

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

  it('indexes only current facts of the requested type across mixed projects and duplicate confirmations', () => {
    const confirmation = (id: string, project: unknown, type = 'SITE_VISIT_COMPLETED') => ({
      id, project_id: project, event_kind: 'CONFIRMED', confirmation_type: type, retracts_event_id: null,
    });
    const rows = [
      confirmation('retracted', 'project-1'),
      confirmation('current', ' project-2 '),
      confirmation('current', 'project-2'),
      confirmation('another', 'project-2'),
      confirmation('delivery', 'project-3', 'DELIVERY_COMPLETED'),
      confirmation('missing-project', null),
      { ...confirmation('correction', 'project-1'), event_kind: ' RETRACTED ', retracts_event_id: ' retracted ' },
      { ...confirmation('unknown', 'project-4'), event_kind: 'UNKNOWN' },
    ];

    const siteVisits = activeConfirmationProjectIds(rows, 'SITE_VISIT_COMPLETED');
    expect([...siteVisits]).toEqual(['project-2']);
    expect([...activeConfirmationProjectIds(rows, 'DELIVERY_COMPLETED')]).toEqual(['project-3']);
    for (const project of ['project-1', 'project-2', 'project-3', 'project-4']) {
      expect(siteVisits.has(project)).toBe(hasActiveProjectConfirmation(rows, project, 'SITE_VISIT_COMPLETED'));
    }
    expect([...activeConfirmationProjectIds([], 'SITE_VISIT_COMPLETED')]).toEqual([]);
  });

  it.each([100, 556, 2000, 4000])('indexes %i projects with linear event inspection', (size) => {
    let eventReads = 0;
    const rows = Array.from({ length: size }, (_, index) => ({
      id: `confirmation-${index}`,
      project_id: `project-${index}`,
      get event_kind() { eventReads++; return 'CONFIRMED'; },
      confirmation_type: 'SITE_VISIT_COMPLETED',
      retracts_event_id: null,
    }));
    const projects = activeConfirmationProjectIds(rows, 'SITE_VISIT_COMPLETED');
    for (let index = 0; index < size; index++) expect(projects.has(`project-${index}`)).toBe(true);
    expect(eventReads).toBeLessThanOrEqual(size * 3);
  });
});
