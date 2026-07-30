import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  recordMarketingConversionEvent: vi.fn(),
}));

vi.mock('@/lib/marketingAttribution/server', () => ({
  recordMarketingConversionEvent: h.recordMarketingConversionEvent,
}));

vi.mock('@/lib/emails/transactional', () => ({
  sendDesignConsultationBookedEmail: vi.fn(),
  sendProjectCompletedEmail: vi.fn(),
  sendProjectScheduledEmail: vi.fn(),
}));

vi.mock('@/lib/projects/workItems/modelBoundary', () => ({
  isProjectWorkModelV2: vi.fn().mockResolvedValue(false),
}));

describe('AutomationRunner marketing attribution events', () => {
  beforeEach(() => {
    vi.resetModules();
    h.recordMarketingConversionEvent.mockReset();
  });

  it('records a site-visit conversion when handling a confirmed site visit event', async () => {
    const { automationRunner } = await import('./AutomationRunner');
    (automationRunner as any).onBookSiteVisit = vi.fn();

    await (automationRunner as any).handleEvent('ui.action.book_site_visit', 'proj-1', {
      status: 'CONFIRMED',
      scheduledStart: '2026-06-24T01:00:00.000Z',
      scheduledEnd: '2026-06-24T02:00:00.000Z',
      notes: 'Do not include this free text in the marketing event',
    });

    expect(h.recordMarketingConversionEvent).toHaveBeenCalledWith({
      type: 'marketing.site_visit_booked',
      projectId: 'proj-1',
      payload: {
        status: 'CONFIRMED',
        scheduledStart: '2026-06-24T01:00:00.000Z',
        scheduledEnd: '2026-06-24T02:00:00.000Z',
      },
    });
    expect(JSON.stringify(h.recordMarketingConversionEvent.mock.calls)).not.toContain('free text');
  });

  it('does not record a tentative site visit as a marketing conversion', async () => {
    const { automationRunner } = await import('./AutomationRunner');
    (automationRunner as any).onBookSiteVisit = vi.fn();

    await (automationRunner as any).handleEvent('ui.action.book_site_visit', 'proj-1', {
      status: 'TENTATIVE',
      scheduledStart: '2026-06-24T01:00:00.000Z',
      notes: 'Awaiting customer confirmation',
    });

    expect(h.recordMarketingConversionEvent).not.toHaveBeenCalled();
  });

  it('records a deposit conversion when handling deposit received', async () => {
    const { automationRunner } = await import('./AutomationRunner');
    (automationRunner as any).onDepositReceived = vi.fn();

    await (automationRunner as any).handleEvent('ui.action.mark_deposit_received', 'proj-1', {});

    expect(h.recordMarketingConversionEvent).toHaveBeenCalledWith({
      type: 'marketing.deposit_received',
      projectId: 'proj-1',
    });
  });
});
