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
    expect(markup).toContain('data-testid="schedule-client"');
    expect(markup).toContain('data-mode="default"');
    expect(markup).toContain('data-generated-at="none"');
  });
});
