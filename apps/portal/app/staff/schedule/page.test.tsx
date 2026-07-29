import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StaffSchedulePage from './page';

const loadSchedulePageSeedMock = vi.fn();

vi.mock('@/lib/scheduling/serverSchedulePageSeed', () => ({
  loadSchedulePageSeed: (...args: unknown[]) => loadSchedulePageSeedMock(...args),
}));

vi.mock('./ScheduleClient', () => ({
  default: (props: { initialScheduleMode?: 'v2' | 'legacy'; initialSeedKind?: 'board' | 'gantt'; initialV2Snapshot?: { generatedAt: string } | null }) => (
    <div
      data-testid="schedule-client"
      data-mode={props.initialScheduleMode ?? 'default'}
      data-seed-kind={props.initialSeedKind ?? 'none'}
      data-generated-at={props.initialV2Snapshot?.generatedAt ?? 'none'}
    />
  ),
}));

vi.mock('./SiteVisitsScheduleClient', () => ({
  default: () => <div data-testid="site-visits-schedule-client" />,
}));

describe('StaffSchedulePage', () => {
  beforeEach(() => {
    loadSchedulePageSeedMock.mockReset();
  });

  it('loads the Board server schedule seed for board and passes it into the client entrypoint', async () => {
    loadSchedulePageSeedMock.mockResolvedValue({
      initialScheduleMode: 'v2',
      initialSeedKind: 'board',
      initialV2Snapshot: { generatedAt: '2026-04-07T00:00:00.000Z' },
    });

    const ui = (await StaffSchedulePage({ searchParams: Promise.resolve({ view: 'board' }) })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(loadSchedulePageSeedMock).toHaveBeenCalledWith({ view: 'board' });
    expect(markup).toContain('data-testid="schedule-client"');
    expect(markup).toContain('data-mode="v2"');
    expect(markup).toContain('data-seed-kind="board"');
    expect(markup).toContain('data-generated-at="2026-04-07T00:00:00.000Z"');
  });

  it('loads the Gantt server schedule seed for gantt and passes it into the client entrypoint', async () => {
    loadSchedulePageSeedMock.mockResolvedValue({
      initialScheduleMode: 'v2',
      initialSeedKind: 'gantt',
      initialV2Snapshot: { generatedAt: '2026-04-07T00:00:00.000Z' },
    });

    const ui = (await StaffSchedulePage({ searchParams: Promise.resolve({ view: 'gantt' }) })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(loadSchedulePageSeedMock).toHaveBeenCalledWith({ view: 'gantt' });
    expect(markup).toContain('data-testid="schedule-client"');
    expect(markup).toContain('data-mode="v2"');
    expect(markup).toContain('data-seed-kind="gantt"');
    expect(markup).toContain('data-generated-at="2026-04-07T00:00:00.000Z"');
  });

  it('skips the schedule seed for site visits', async () => {
    const ui = (await StaffSchedulePage({ searchParams: Promise.resolve({ view: 'site-visits' }) })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(loadSchedulePageSeedMock).not.toHaveBeenCalled();
    expect(markup).toContain('data-testid="site-visits-schedule-client"');
    expect(markup).not.toContain('data-testid="schedule-client"');
  });

  it('passes server schema-not-ready mode into the schedule client boundary', async () => {
    loadSchedulePageSeedMock.mockResolvedValue({
      initialScheduleMode: 'legacy',
      initialV2Snapshot: null,
    });

    const ui = (await StaffSchedulePage({ searchParams: Promise.resolve({ view: 'board' }) })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(loadSchedulePageSeedMock).toHaveBeenCalledWith({ view: 'board' });
    expect(markup).toContain('data-testid="schedule-client"');
    expect(markup).toContain('data-mode="legacy"');
  });

  it('keeps the site visits entrypoint independent from Board and Gantt modules', () => {
    const source = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/SiteVisitsScheduleClient.tsx'), 'utf8');

    expect(source).not.toContain("from './ScheduleClient'");
    expect(source).not.toContain('@dnd-kit/');
    expect(source).not.toContain('scheduleV2Repo');
    expect(source).not.toContain("from './ganttAxis'");
    expect(source).not.toContain("from './boardDrag'");
  });

  it('keeps Gantt axis code behind the Gantt view boundary', () => {
    const scheduleClient = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleClient.tsx'), 'utf8');
    const ganttView = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleGanttView.tsx'), 'utf8');
    const ganttModel = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleGanttModel.ts'), 'utf8');

    expect(scheduleClient).not.toContain("from './ganttAxis'");
    expect(ganttView).toContain("from './ganttAxis'");
    expect(ganttView).toContain("from './ScheduleGanttModel'");
    expect(ganttModel).toContain("from './ganttAxis'");
  });

  it('keeps Board drag code behind the Board view boundary', () => {
    const scheduleClient = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleClient.tsx'), 'utf8');
    const boardView = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleBoardView.tsx'), 'utf8');
    const ganttView = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleGanttView.tsx'), 'utf8');

    expect(scheduleClient).not.toContain('@dnd-kit/');
    expect(scheduleClient).not.toContain("from './boardDrag'");
    expect(boardView).toContain('@dnd-kit/');
    expect(boardView).toContain("from './boardDrag'");
    expect(ganttView).not.toContain('@dnd-kit/');
    expect(ganttView).not.toContain("from './boardDrag'");
  });

  it('keeps legacy schedule repos behind the legacy fallback boundary', () => {
    const scheduleClient = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleClient.tsx'), 'utf8');
    const legacyClient = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleLegacyFallbackClient.tsx'), 'utf8');

    for (const legacyImport of [
      '@/lib/repo/estimatesRepo',
      '@/lib/repo/scheduleRepo',
      '@/lib/repo/installersRepo',
      '@/lib/repo/projectsRepo',
      '@/lib/supabase/browserClient',
      'listAllEstimates',
      'listScheduleItems',
      'replaceScheduleItems',
      'confirmScheduleItem',
      'unlockScheduleItem',
    ]) {
      expect(scheduleClient).not.toContain(legacyImport);
    }

    expect(legacyClient).toContain('@/lib/repo/estimatesRepo');
    expect(legacyClient).toContain('@/lib/repo/scheduleRepo');
    expect(legacyClient).toContain('listAllEstimates');
    expect(legacyClient).not.toContain('scheduleV2Repo');
  });

  it('keeps Board and Gantt views independent from the shared client entrypoint', () => {
    const boardView = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleBoardView.tsx'), 'utf8');
    const ganttView = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleGanttView.tsx'), 'utf8');
    const ganttModel = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleGanttModel.ts'), 'utf8');
    const ganttTimeline = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleGanttTimeline.tsx'), 'utf8');
    const ganttToolbar = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleGanttToolbar.tsx'), 'utf8');

    expect(boardView).not.toContain("from './ScheduleClient'");
    for (const source of [ganttView, ganttModel, ganttTimeline, ganttToolbar]) {
      expect(source).not.toContain("from './ScheduleClient'");
    }
  });

  it('derives only the model needed by the active Board or Gantt view', () => {
    const scheduleClient = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleClient.tsx'), 'utf8');

    expect(scheduleClient).toContain(
      "if (view !== 'board' || activeSnapshotKind !== 'board') return EMPTY_SCHEDULE_BOARD_MODEL;",
    );
    expect(scheduleClient).toMatch(/view === 'gantt'\s*\? buildLaneItems/);
  });

  it('keeps V2 and legacy board model dependencies separated', () => {
    const v2Model = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleBoardModelV2.ts'), 'utf8');
    const legacyModel = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/ScheduleBoardModelLegacy.ts'), 'utf8');

    expect(v2Model).not.toContain('@/lib/types/estimate');
    expect(v2Model).not.toContain('isCalculatorInputsV2');
    expect(v2Model).not.toContain('isLegacyCalculatorInputsV1');
    expect(v2Model).not.toContain('deriveDurationHoursFromEstimate');

    expect(legacyModel).toContain('@/lib/types/estimate');
    expect(legacyModel).toContain('isCalculatorInputsV2');
    expect(legacyModel).toContain('deriveDurationHoursFromEstimate');
  });

  it('keeps schedule CSS imports scoped by view boundary', () => {
    const scheduleDir = path.join(process.cwd(), 'apps/portal/app/staff/schedule');
    const siteVisitsShell = readFileSync(path.join(scheduleDir, 'SiteVisitsScheduleClient.tsx'), 'utf8');
    const boardView = readFileSync(path.join(scheduleDir, 'ScheduleBoardView.tsx'), 'utf8');
    const ganttView = readFileSync(path.join(scheduleDir, 'ScheduleGanttView.tsx'), 'utf8');
    const ganttTimeline = readFileSync(path.join(scheduleDir, 'ScheduleGanttTimeline.tsx'), 'utf8');
    const ganttToolbar = readFileSync(path.join(scheduleDir, 'ScheduleGanttToolbar.tsx'), 'utf8');
    const siteVisitsView = readFileSync(path.join(scheduleDir, 'SiteVisitsView.tsx'), 'utf8');
    const siteVisitCard = readFileSync(path.join(scheduleDir, 'UnscheduledSiteVisitCard.tsx'), 'utf8');

    expect(siteVisitsShell).not.toContain('scheduleBoard.module.css');
    expect(siteVisitsShell).not.toContain('scheduleGantt.module.css');
    expect(siteVisitsShell).not.toContain('scheduleTimeline.module.css');
    expect(boardView).toContain('scheduleBoard.module.css');
    expect(boardView).toContain('scheduleTimeline.module.css');
    expect(boardView).not.toContain('scheduleGantt.module.css');
    expect(boardView).not.toContain('scheduleSiteVisits.module.css');
    expect(ganttView).toContain('scheduleGantt.module.css');
    expect(ganttView).toContain('scheduleTimeline.module.css');
    expect(ganttView).not.toContain('scheduleBoard.module.css');
    expect(ganttView).not.toContain('scheduleSiteVisits.module.css');
    expect(ganttTimeline).toContain('scheduleGantt.module.css');
    expect(ganttTimeline).toContain('scheduleTimeline.module.css');
    expect(ganttTimeline).not.toContain('scheduleBoard.module.css');
    expect(ganttTimeline).not.toContain('scheduleSiteVisits.module.css');
    expect(ganttToolbar).toContain('scheduleGantt.module.css');
    expect(ganttToolbar).toContain('scheduleTimeline.module.css');
    expect(ganttToolbar).not.toContain('scheduleBoard.module.css');
    expect(ganttToolbar).not.toContain('scheduleSiteVisits.module.css');

    for (const source of [siteVisitsView, siteVisitCard]) {
      expect(source).toContain('scheduleSiteVisits.module.css');
      expect(source).not.toContain('scheduleBoard.module.css');
      expect(source).not.toContain('scheduleGantt.module.css');
    }
  });

  it('keeps shared schedule CSS free of view-owned selectors', () => {
    const sharedCss = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/schedule.module.css'), 'utf8');

    expect(sharedCss).not.toMatch(/^\\.(?:gantt|siteVisit|siteVisits|jobCard|lane\\b|unscheduledBody\\b)/m);
    expect(sharedCss).not.toContain('eventModal');
  });
});
