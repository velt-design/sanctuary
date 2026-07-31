import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  recordMarketingConversionEvent: vi.fn(),
  isProjectWorkModelV2: vi.fn(),
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
  isProjectWorkModelV2: (...args: unknown[]) =>
    h.isProjectWorkModelV2(...args),
}));

describe('AutomationRunner lifecycle ownership', () => {
  beforeEach(() => {
    vi.resetModules();
    h.recordMarketingConversionEvent.mockReset();
    h.isProjectWorkModelV2.mockReset().mockResolvedValue(false);
  });

  it('runs confirmed site-visit automation without owning its conversion', async () => {
    const { automationRunner } = await import('./AutomationRunner');
    (automationRunner as any).onBookSiteVisit = vi.fn();

    await (automationRunner as any).handleEvent('ui.action.book_site_visit', 'proj-1', {
      status: 'CONFIRMED',
      scheduledStart: '2026-06-24T01:00:00.000Z',
      scheduledEnd: '2026-06-24T02:00:00.000Z',
      notes: 'Do not include this free text in the marketing event',
    });

    expect((automationRunner as any).onBookSiteVisit).toHaveBeenCalledOnce();
    expect(h.recordMarketingConversionEvent).not.toHaveBeenCalled();
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

  it('preserves explicit V2 Site Visit automation without owning its conversion', async () => {
    h.isProjectWorkModelV2.mockResolvedValue(true);
    const { automationRunner } = await import('./AutomationRunner');
    (automationRunner as any).onBookSiteVisit = vi.fn();

    await (automationRunner as any).handleEvent('ui.action.book_site_visit', 'proj-1', {
      status: 'CONFIRMED',
      scheduledStart: '2026-06-24T01:00:00.000Z',
    });

    expect((automationRunner as any).onBookSiteVisit).toHaveBeenCalledOnce();
    expect(h.recordMarketingConversionEvent).not.toHaveBeenCalled();
  });

  it('preserves deposit automation after portfolio rollout without owning its conversion', async () => {
    h.isProjectWorkModelV2.mockResolvedValue(true);
    const { automationRunner } = await import('./AutomationRunner');
    (automationRunner as any).onDepositReceived = vi.fn();

    await (automationRunner as any).handleEvent('ui.action.mark_deposit_received', 'proj-1', {});

    expect((automationRunner as any).onDepositReceived).toHaveBeenCalledOnce();
    expect(h.recordMarketingConversionEvent).not.toHaveBeenCalled();
  });

  it('does not recreate Site Visit state from a V2 stage transition', async () => {
    h.isProjectWorkModelV2.mockResolvedValue(true);
    const { automationRunner } = await import('./AutomationRunner');
    (automationRunner as any).onStageChanged = vi.fn();

    await (automationRunner as any).handleEvent(
      'pipeline.stage_changed',
      'proj-1',
      { toStage: 'SITE_VISIT' },
    );

    expect((automationRunner as any).onStageChanged).not.toHaveBeenCalled();
  });
});
