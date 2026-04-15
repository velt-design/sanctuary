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
  default: (props: { initialScheduleMode?: 'v2' | 'legacy'; initialV2Snapshot?: { generatedAt: string } | null }) => (
    <div
      data-testid="schedule-client"
      data-mode={props.initialScheduleMode ?? 'default'}
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

  it('loads the server schedule seed for board/gantt and passes it into the client entrypoint', async () => {
    loadSchedulePageSeedMock.mockResolvedValue({
      initialScheduleMode: 'v2',
      initialV2Snapshot: { generatedAt: '2026-04-07T00:00:00.000Z' },
    });

    const ui = (await StaffSchedulePage({ searchParams: { view: 'board' } })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(loadSchedulePageSeedMock).toHaveBeenCalled();
    expect(markup).toContain('data-testid="schedule-client"');
    expect(markup).toContain('data-mode="v2"');
    expect(markup).toContain('data-generated-at="2026-04-07T00:00:00.000Z"');
  });

  it('skips the schedule seed for site visits', async () => {
    const ui = (await StaffSchedulePage({ searchParams: { view: 'site-visits' } })) as ReactElement;
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

    const ui = (await StaffSchedulePage({ searchParams: { view: 'board' } })) as ReactElement;
    const markup = renderToStaticMarkup(ui);

    expect(loadSchedulePageSeedMock).toHaveBeenCalled();
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

    expect(scheduleClient).not.toContain("from './ganttAxis'");
    expect(ganttView).toContain("from './ganttAxis'");
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
  });
});
