import { describe, expect, it, vi } from 'vitest';
import {
  prepareGa4MarketingEvent,
  processMarketingConversionDeliveries,
  type MarketingConversionClaim,
} from './marketingConversionDelivery';

const NOW = new Date('2026-07-30T02:00:00.000Z');

function claim(overrides: Partial<MarketingConversionClaim> = {}): MarketingConversionClaim {
  return {
    delivery_id: '11111111-1111-4111-8111-111111111111',
    audit_event_id: '22222222-2222-4222-8222-222222222222',
    event_type: 'marketing.site_visit_booked',
    event_timestamp: '2026-07-30T01:00:00.000Z',
    payload: {
      projectId: '33333333-3333-4333-8333-333333333333',
      contactEmail: 'not-for-analytics@example.com',
      attribution: {
        analyticsClientId: '1234567890.9876543210',
        consent: {
          necessary: true,
          analytics: true,
          marketing: false,
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
        utm: { utm_source: 'google', utm_campaign: 'private-campaign-name' },
      },
    },
    attempt_count: 1,
    max_attempts: 8,
    lease_token: '44444444-4444-4444-8444-444444444444',
    ...overrides,
  };
}

describe('GA4 marketing conversion delivery', () => {
  it('prepares a consent-aware qualify_lead event without portal IDs or PII', () => {
    const prepared = prepareGa4MarketingEvent(claim(), NOW);

    expect(prepared).toEqual({
      kind: 'send',
      body: {
        client_id: '1234567890.9876543210',
        timestamp_micros: 1785373200000000,
        consent: {
          ad_user_data: 'DENIED',
          ad_personalization: 'DENIED',
        },
        events: [{
          name: 'qualify_lead',
          params: {
            lead_source: 'google',
            site_visit_status: 'confirmed',
          },
        }],
      },
    });
    const encoded = JSON.stringify(prepared);
    expect(encoded).not.toContain('33333333-3333-4333-8333-333333333333');
    expect(encoded).not.toContain('not-for-analytics@example.com');
    expect(encoded).not.toContain('private-campaign-name');
  });

  it('maps quote, win and structured loss events to the lifecycle event contract', () => {
    expect(prepareGa4MarketingEvent(claim({
      event_type: 'marketing.quote_accepted',
      payload: {
        valueIncGstCents: 123456,
        attribution: {
          analyticsClientId: '1234567890.9876543210',
          consent: { analytics: true, marketing: true },
        },
      },
    }), NOW)).toMatchObject({
      kind: 'send',
      body: {
        events: [{ name: 'quote_accepted', params: { value: 1234.56, currency: 'NZD' } }],
      },
    });
    expect(prepareGa4MarketingEvent(claim({
      event_type: 'marketing.deposit_received',
    }), NOW)).toMatchObject({
      kind: 'send',
      body: { events: [{ name: 'close_convert_lead' }] },
    });
    expect(prepareGa4MarketingEvent(claim({
      event_type: 'marketing.project_lost',
      payload: {
        outcome: 'LOST_BUDGET_PRICE',
        note: 'Free-text reason must not leave the portal',
        attribution: {
          analyticsClientId: '1234567890.9876543210',
          consent: { analytics: true, marketing: true },
        },
      },
    }), NOW)).toMatchObject({
      kind: 'send',
      body: {
        events: [{
          name: 'close_unconvert_lead',
          params: { loss_reason: 'LOST_BUDGET_PRICE' },
        }],
      },
    });
  });

  it('skips events without analytics consent, identity, recent time or a valid loss code', () => {
    expect(prepareGa4MarketingEvent(claim({
      payload: {
        attribution: {
          analyticsClientId: '1234567890.9876543210',
          consent: { analytics: false },
        },
      },
    }), NOW)).toEqual({
      kind: 'skip',
      errorCode: 'ANALYTICS_CONSENT_NOT_GRANTED',
    });
    expect(prepareGa4MarketingEvent(claim({
      payload: { attribution: { consent: { analytics: true } } },
    }), NOW)).toEqual({ kind: 'skip', errorCode: 'GA_CLIENT_ID_MISSING' });
    expect(prepareGa4MarketingEvent(claim({
      event_timestamp: '2026-07-26T00:00:00.000Z',
    }), NOW)).toEqual({ kind: 'skip', errorCode: 'EVENT_TOO_OLD' });
    expect(prepareGa4MarketingEvent(claim({
      event_type: 'marketing.project_lost',
      payload: {
        outcome: 'A free-form reason',
        attribution: {
          analyticsClientId: '1234567890.9876543210',
          consent: { analytics: true },
        },
      },
    }), NOW)).toEqual({ kind: 'skip', errorCode: 'LOST_OUTCOME_INVALID' });
  });

  it('claims, sends and completes a delivery without reading provider response data', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [claim()], error: null })
      .mockResolvedValueOnce({ data: 'SENT', error: null });
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    const result = await processMarketingConversionDeliveries({
      supabase: { rpc },
      config: { measurementId: 'G-KGLF83X6JW', apiSecret: 'test-api-secret' },
      fetchImpl,
      now: NOW,
    });

    expect(result).toEqual({
      claimed: 1,
      sent: 1,
      skipped: 0,
      retrying: 0,
      failed: 0,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const request = fetchImpl.mock.calls[0];
    expect(String(request[0])).toContain('measurement_id=G-KGLF83X6JW');
    expect(JSON.parse(String(request[1]?.body))).toMatchObject({
      client_id: '1234567890.9876543210',
      events: [{ name: 'qualify_lead' }],
    });
    expect(rpc).toHaveBeenLastCalledWith(
      'marketing_conversion_delivery_complete',
      expect.objectContaining({
        p_outcome: 'SENT',
        p_error_code: null,
        p_provider_status: 204,
      }),
    );
  });

  it('schedules a bounded retry for a transient provider response', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [claim({ attempt_count: 2 })], error: null })
      .mockResolvedValueOnce({ data: 'RETRY', error: null });
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));

    const result = await processMarketingConversionDeliveries({
      supabase: { rpc },
      config: { measurementId: 'G-KGLF83X6JW', apiSecret: 'test-api-secret' },
      fetchImpl,
      now: NOW,
    });

    expect(result.retrying).toBe(1);
    expect(rpc).toHaveBeenLastCalledWith(
      'marketing_conversion_delivery_complete',
      expect.objectContaining({
        p_outcome: 'RETRY',
        p_error_code: 'GA4_RETRYABLE_RESPONSE',
        p_provider_status: 503,
        p_retry_after_seconds: 120,
      }),
    );
  });
});
