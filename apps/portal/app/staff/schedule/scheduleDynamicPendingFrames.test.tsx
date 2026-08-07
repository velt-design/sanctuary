import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ScheduleBoardChunkPendingFrame,
  ScheduleGanttChunkPendingFrame,
} from './SchedulePendingFrame';
import { SiteVisitsChunkPendingFrame } from './SiteVisitsPendingFrame';

describe('Schedule dynamic pending frames', () => {
  it('keeps the Board and Gantt chunk boundaries structurally useful', () => {
    const board = renderToStaticMarkup(<ScheduleBoardChunkPendingFrame />);
    const gantt = renderToStaticMarkup(<ScheduleGanttChunkPendingFrame />);

    expect(board).toContain('data-schedule-chunk-pending="board"');
    expect(board).toContain('aria-label="Unscheduled jobs"');
    expect(board).toContain('aria-label="Installer lanes"');
    expect(gantt).toContain('data-schedule-chunk-pending="gantt"');
    expect(gantt).toContain('aria-label="Schedule controls"');
    expect(gantt).toContain('Planning range and crews');
    expect(gantt).not.toContain('Loading Gantt');
  });

  it('keeps the Site Visits calendar and queue mounted at its chunk boundary', () => {
    const markup = renderToStaticMarkup(<SiteVisitsChunkPendingFrame />);

    expect(markup).toContain('data-schedule-chunk-pending="site-visits"');
    expect(markup).toContain('aria-label="Unscheduled site visits"');
    expect(markup).toContain('aria-label="Site visits week calendar"');
    expect(markup).not.toContain('Loading site visits');
  });

  it('uses the exact pending structures at every Schedule dynamic boundary', () => {
    const read = (filename: string) => readFileSync(
      path.resolve(process.cwd(), `apps/portal/app/staff/schedule/${filename}`),
      'utf8',
    );
    const scheduleClient = read('ScheduleClient.tsx');
    const legacyClient = read('ScheduleLegacyFallbackClient.tsx');
    const siteVisitsClient = read('SiteVisitsScheduleClient.tsx');
    const siteVisitsView = read('SiteVisitsView.tsx');

    expect(scheduleClient).toContain('loading: ScheduleBoardChunkPendingFrame');
    expect(scheduleClient).toContain('loading: ScheduleGanttChunkPendingFrame');
    expect(scheduleClient).toContain('<SchedulePendingFrame view="board" />');
    expect(scheduleClient).toContain('<SchedulePendingFrame view="gantt" />');
    expect(legacyClient).toContain('loading: ScheduleBoardChunkPendingFrame');
    expect(legacyClient).toContain('loading: ScheduleGanttChunkPendingFrame');
    expect(siteVisitsClient).toContain('loading: SiteVisitsChunkPendingFrame');
    expect(siteVisitsView).toContain('if (!mounted) return <SiteVisitsChunkPendingFrame />;');
    expect(siteVisitsView).not.toContain('Loading site visits');
    expect(`${scheduleClient}\n${legacyClient}\n${siteVisitsClient}`).not.toMatch(
      /loading:\s*\(\)\s*=>\s*<p[^>]*>Loading (?:Board|Gantt|site visits|legacy schedule fallback)/,
    );
  });
});
