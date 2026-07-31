import { describe, expect, it } from 'vitest';
import type { Installer, ScheduleItem } from '@/lib/types/scheduling';
import {
  buildScheduleJobIdentity,
  buildScheduleJobPresentation,
  buildScheduleJobPresentationIndex,
  formatScheduleJobTiming,
} from './ScheduleJobPresentation';

const installer: Installer = {
  id: 'crew_alpha',
  name: 'Crew Alpha',
  color: '#0f766e',
  active: true,
  sortOrder: 0,
};

const item: ScheduleItem = {
  id: 'sch_alpha',
  projectId: 'proj_alpha',
  estimateId: 'est_alpha',
  installerId: installer.id,
  sortIndex: 0,
  forecastStart: '2026-04-07',
  forecastEndExclusive: '2026-04-10',
  forecastDurationDays: 3,
  updatedAt: '2026-04-01T00:00:00.000Z',
};

const project = {
  id: 'proj_alpha',
  projectName: 'Harbour Pergola',
  name: 'Harbour Pergola',
  customerName: 'Alex Customer',
  siteAddress: '10 Harbour Road, Auckland',
  status: 'DEPOSIT',
  nextActionDate: null,
  followUpDate: null,
};

describe('ScheduleJobPresentation', () => {
  it('builds a searchable identity without repeating equivalent project and customer labels', () => {
    expect(buildScheduleJobIdentity(project)).toEqual(expect.objectContaining({
      projectName: 'Harbour Pergola',
      identityDetail: 'Alex Customer · 10 Harbour Road, Auckland',
      searchText: 'harbour pergola alex customer 10 harbour road, auckland',
    }));
    expect(buildScheduleJobIdentity({ ...project, customerName: 'Harbour Pergola' }).identityDetail)
      .toBe('10 Harbour Road, Auckland');
  });

  it('owns crew and current forecast timing presentation for dialogs', () => {
    const presentation = buildScheduleJobPresentation({ item, project, installer });
    expect(presentation).toEqual(expect.objectContaining({
      crewName: 'Crew Alpha',
      startDate: '2026-04-07',
      endDate: '2026-04-09',
      durationDays: 3,
    }));
    expect(formatScheduleJobTiming(presentation, (value) => value)).toBe('2026-04-07 to 2026-04-09 · 3d');
  });

  it('indexes jobs only and leaves downtime with its specialist presentation owner', () => {
    const downtime: ScheduleItem = { ...item, id: 'dt_alpha', itemType: 'downtime', projectId: '' };
    const index = buildScheduleJobPresentationIndex({
      scheduleItems: [item, downtime],
      projectsById: new Map([[project.id, project]]),
      installersById: new Map([[installer.id, installer]]),
    });
    expect([...index.keys()]).toEqual(['sch_alpha']);
  });
});
