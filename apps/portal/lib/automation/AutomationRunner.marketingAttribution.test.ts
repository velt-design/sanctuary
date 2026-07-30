import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  recordMarketingConversionEvent: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/marketingAttribution/server', () => ({
  recordMarketingConversionEvent: h.recordMarketingConversionEvent,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: {
    from: (...args: unknown[]) => h.from(...args),
  },
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
    h.from.mockReset();
  });

  it('records a site-visit conversion when handling a booked site visit event', async () => {
    const { automationRunner } = await import('./AutomationRunner');
    (automationRunner as any).onBookSiteVisit = vi.fn();

    await (automationRunner as any).handleEvent('ui.action.book_site_visit', 'proj-1', {
      scheduledStart: '2026-06-24T01:00:00.000Z',
      scheduledEnd: '2026-06-24T02:00:00.000Z',
      notes: 'Do not include this free text in the marketing event',
    });

    expect(h.recordMarketingConversionEvent).toHaveBeenCalledWith({
      type: 'marketing.site_visit_booked',
      projectId: 'proj-1',
      payload: {
        scheduledStart: '2026-06-24T01:00:00.000Z',
        scheduledEnd: '2026-06-24T02:00:00.000Z',
      },
    });
    expect(JSON.stringify(h.recordMarketingConversionEvent.mock.calls)).not.toContain('free text');
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

  it('keeps the new-enquiry email without creating a legacy automation task', async () => {
    const outboxInsert = vi.fn().mockResolvedValue({ error: null });
    h.from.mockImplementation((table: string) => {
      if (table === 'projects') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'proj-1',
                  contact_id: 'contact-1',
                  name: 'Pergola',
                  pipeline_stage: 'NEW',
                  site_address: null,
                  quote_ref: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'contacts') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'contact-1',
                  name: 'Taylor',
                  email: 'taylor@example.com',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'email_templates') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'EMAIL_NEW_RANGE_AND_BROCHURES',
                  subject: 'Thanks for your enquiry',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'email_outbox') return { insert: outboxInsert };
      throw new Error(`Unexpected table ${table}`);
    });

    const { automationRunner } = await import('./AutomationRunner');
    await (automationRunner as any).handleEvent(
      'ui.action.project_created',
      'proj-1',
      {},
    );

    expect(outboxInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-1',
        contact_id: 'contact-1',
        to_email: 'taylor@example.com',
        status: 'QUEUED',
      }),
    );
    expect(h.from.mock.calls.map(([table]) => table)).toEqual([
      'projects',
      'contacts',
      'email_templates',
      'email_outbox',
    ]);
  });

  it('keeps site-visit evidence without creating a legacy booking task', async () => {
    const siteVisitUpsert = vi.fn().mockResolvedValue({ error: null });
    h.from.mockImplementation((table: string) => {
      if (table === 'site_visit_events') return { upsert: siteVisitUpsert };
      throw new Error(`Unexpected table ${table}`);
    });

    const { automationRunner } = await import('./AutomationRunner');
    await (automationRunner as any).handleEvent(
      'ui.action.customer_agreed_site_visit',
      'proj-1',
      {},
    );

    expect(siteVisitUpsert).toHaveBeenCalledWith(
      { project_id: 'proj-1', status: 'UNSCHEDULED' },
      { onConflict: 'project_id' },
    );
    expect(h.from.mock.calls.map(([table]) => table)).toEqual([
      'site_visit_events',
    ]);
  });

  it('does not create quote follow-up records when a legacy project reaches Sent', async () => {
    const { automationRunner } = await import('./AutomationRunner');

    await (automationRunner as any).handleEvent(
      'pipeline.stage_changed',
      'proj-1',
      { fromStage: 'QUOTING', toStage: 'SENT', quoteId: 'quote-1' },
    );

    expect(h.from).not.toHaveBeenCalled();
  });
});
