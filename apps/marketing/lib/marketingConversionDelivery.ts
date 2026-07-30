import 'server-only';

const GA_CLIENT_ID_PATTERN = /^\d{1,20}\.\d{1,20}$/;
const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;
const MAX_EVENT_AGE_MS = 72 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const LOST_OUTCOMES = new Set([
  'LOST_NO_RESPONSE',
  'LOST_BUDGET_PRICE',
  'LOST_OTHER_SUPPLIER',
  'LOST_TIMING_DEFERRED',
  'LOST_NOT_SUITABLE',
  'CANCELLED',
]);

type JsonRecord = Record<string, unknown>;

type Ga4MeasurementProtocolConfig = {
  measurementId: string;
  apiSecret: string;
};

export type MarketingConversionClaim = {
  delivery_id: string;
  audit_event_id: string;
  event_type: string;
  event_timestamp: string;
  payload: unknown;
  attempt_count: number;
  max_attempts: number;
  lease_token: string;
};

type RpcResult = {
  data: unknown;
  error: unknown;
};

type MarketingConversionSupabase = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
};

type DeliveryOutcome = 'SENT' | 'SKIPPED' | 'RETRY' | 'FAILED';

type PreparedGa4Event =
  | {
      kind: 'send';
      body: {
        client_id: string;
        timestamp_micros: number;
        consent: {
          ad_user_data: 'GRANTED' | 'DENIED';
          ad_personalization: 'GRANTED' | 'DENIED';
        };
        events: Array<{
          name: string;
          params: Record<string, string | number>;
        }>;
      };
    }
  | {
      kind: 'skip';
      errorCode:
        | 'ANALYTICS_CONSENT_NOT_GRANTED'
        | 'GA_CLIENT_ID_MISSING'
        | 'EVENT_TOO_OLD'
        | 'EVENT_TIME_INVALID'
        | 'EVENT_TYPE_UNSUPPORTED'
        | 'LOST_OUTCOME_INVALID';
    };

type MarketingConversionDeliverySummary = {
  claimed: number;
  sent: number;
  skipped: number;
  retrying: number;
  failed: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown, maximum = 100): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum) return null;
  return cleaned;
}

function safeDimension(value: unknown): string | null {
  const cleaned = cleanString(value, 100);
  if (!cleaned || !/^[A-Za-z0-9 ._:/+-]+$/.test(cleaned)) return null;
  return cleaned;
}

function safeCurrencyValue(cents: unknown): number | null {
  if (typeof cents !== 'number' || !Number.isSafeInteger(cents) || cents <= 0) return null;
  return Number((cents / 100).toFixed(2));
}

export function ga4MeasurementProtocolConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Ga4MeasurementProtocolConfig | null {
  const measurementId = env.GA4_MEASUREMENT_ID?.trim().toUpperCase() || '';
  const apiSecret = env.GA4_MEASUREMENT_PROTOCOL_API_SECRET?.trim() || '';
  if (!GA_MEASUREMENT_ID_PATTERN.test(measurementId) || !apiSecret) return null;
  return { measurementId, apiSecret };
}

export function prepareGa4MarketingEvent(
  claim: MarketingConversionClaim,
  now = new Date(),
): PreparedGa4Event {
  const payload = isRecord(claim.payload) ? claim.payload : {};
  const attribution = isRecord(payload.attribution) ? payload.attribution : {};
  const consent = isRecord(attribution.consent) ? attribution.consent : {};
  if (consent.analytics !== true) {
    return { kind: 'skip', errorCode: 'ANALYTICS_CONSENT_NOT_GRANTED' };
  }

  const clientId = cleanString(attribution.analyticsClientId, 41);
  if (!clientId || !GA_CLIENT_ID_PATTERN.test(clientId)) {
    return { kind: 'skip', errorCode: 'GA_CLIENT_ID_MISSING' };
  }

  const eventDate = new Date(claim.event_timestamp);
  const eventTime = eventDate.valueOf();
  if (!Number.isFinite(eventTime) || eventTime - now.valueOf() > MAX_FUTURE_SKEW_MS) {
    return { kind: 'skip', errorCode: 'EVENT_TIME_INVALID' };
  }
  if (now.valueOf() - eventTime > MAX_EVENT_AGE_MS) {
    return { kind: 'skip', errorCode: 'EVENT_TOO_OLD' };
  }

  const params: Record<string, string | number> = {};
  const marketingGranted = consent.marketing === true;
  const utm = marketingGranted && isRecord(attribution.utm) ? attribution.utm : {};
  const leadSource = safeDimension(utm.utm_source);
  if (leadSource) params.lead_source = leadSource;

  let eventName: string;
  switch (claim.event_type) {
    case 'marketing.site_visit_booked':
      eventName = 'qualify_lead';
      params.site_visit_status = 'confirmed';
      break;
    case 'marketing.quote_accepted': {
      eventName = 'quote_accepted';
      const value = safeCurrencyValue(payload.valueIncGstCents);
      if (value !== null) {
        params.value = value;
        params.currency = 'NZD';
      }
      break;
    }
    case 'marketing.deposit_received':
      eventName = 'close_convert_lead';
      break;
    case 'marketing.project_lost': {
      eventName = 'close_unconvert_lead';
      const outcome = cleanString(payload.outcome, 64);
      if (!outcome || !LOST_OUTCOMES.has(outcome)) {
        return { kind: 'skip', errorCode: 'LOST_OUTCOME_INVALID' };
      }
      params.loss_reason = outcome;
      break;
    }
    default:
      return { kind: 'skip', errorCode: 'EVENT_TYPE_UNSUPPORTED' };
  }

  return {
    kind: 'send',
    body: {
      client_id: clientId,
      timestamp_micros: eventTime * 1000,
      consent: {
        ad_user_data: marketingGranted ? 'GRANTED' : 'DENIED',
        ad_personalization: marketingGranted ? 'GRANTED' : 'DENIED',
      },
      events: [{ name: eventName, params }],
    },
  };
}

function retryDelaySeconds(attemptCount: number): number {
  const exponent = Math.max(0, Math.min(8, attemptCount - 1));
  return Math.min(21_600, 60 * (2 ** exponent));
}

async function deliverGa4Event(params: {
  config: Ga4MeasurementProtocolConfig;
  body: Extract<PreparedGa4Event, { kind: 'send' }>['body'];
  fetchImpl: typeof fetch;
  attemptCount: number;
}): Promise<{
  outcome: Exclude<DeliveryOutcome, 'SKIPPED'>;
  errorCode: string | null;
  providerStatus: number | null;
  retryAfterSeconds: number | null;
}> {
  const endpoint = new URL('https://www.google-analytics.com/mp/collect');
  endpoint.searchParams.set('measurement_id', params.config.measurementId);
  endpoint.searchParams.set('api_secret', params.config.apiSecret);

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 10_000);
  try {
    const response = await params.fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params.body),
      signal: abort.signal,
    });
    if (response.ok) {
      return {
        outcome: 'SENT',
        errorCode: null,
        providerStatus: response.status,
        retryAfterSeconds: null,
      };
    }
    const retryable = response.status === 408
      || response.status === 429
      || response.status >= 500;
    return {
      outcome: retryable ? 'RETRY' : 'FAILED',
      errorCode: retryable ? 'GA4_RETRYABLE_RESPONSE' : 'GA4_REJECTED',
      providerStatus: response.status,
      retryAfterSeconds: retryable ? retryDelaySeconds(params.attemptCount) : null,
    };
  } catch {
    return {
      outcome: 'RETRY',
      errorCode: 'GA4_NETWORK_ERROR',
      providerStatus: null,
      retryAfterSeconds: retryDelaySeconds(params.attemptCount),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeClaims(value: unknown): MarketingConversionClaim[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is MarketingConversionClaim => {
    if (!isRecord(row)) return false;
    return typeof row.delivery_id === 'string'
      && typeof row.audit_event_id === 'string'
      && typeof row.event_type === 'string'
      && typeof row.event_timestamp === 'string'
      && typeof row.attempt_count === 'number'
      && typeof row.max_attempts === 'number'
      && typeof row.lease_token === 'string';
  });
}

export async function processMarketingConversionDeliveries(params: {
  supabase: MarketingConversionSupabase;
  config: Ga4MeasurementProtocolConfig;
  fetchImpl?: typeof fetch;
  limit?: number;
  now?: Date;
}): Promise<MarketingConversionDeliverySummary> {
  const limit = Math.max(1, Math.min(100, params.limit ?? 20));
  const summary: MarketingConversionDeliverySummary = {
    claimed: 0,
    sent: 0,
    skipped: 0,
    retrying: 0,
    failed: 0,
  };
  const fetchImpl = params.fetchImpl ?? fetch;

  for (let index = 0; index < limit; index += 1) {
    // Claim immediately before delivery so a slow earlier provider request cannot
    // consume the lease of a later row in the same cron invocation.
    const claimResult = await params.supabase.rpc('marketing_conversion_delivery_claim', {
      p_limit: 1,
      p_lease_seconds: 120,
    });
    if (claimResult.error) throw new Error('MARKETING_CONVERSION_CLAIM_FAILED');

    const claim = normalizeClaims(claimResult.data)[0];
    if (!claim) break;
    summary.claimed += 1;

    const prepared = prepareGa4MarketingEvent(claim, params.now);
    let outcome: DeliveryOutcome;
    let errorCode: string | null;
    let providerStatus: number | null = null;
    let retryAfterSeconds: number | null = null;

    if (prepared.kind === 'skip') {
      outcome = 'SKIPPED';
      errorCode = prepared.errorCode;
      summary.skipped += 1;
    } else {
      const delivery = await deliverGa4Event({
        config: params.config,
        body: prepared.body,
        fetchImpl,
        attemptCount: claim.attempt_count,
      });
      outcome = delivery.outcome;
      errorCode = delivery.errorCode;
      providerStatus = delivery.providerStatus;
      retryAfterSeconds = delivery.retryAfterSeconds;
      if (outcome === 'SENT') summary.sent += 1;
      else if (outcome === 'RETRY' && claim.attempt_count < claim.max_attempts) {
        summary.retrying += 1;
      } else {
        summary.failed += 1;
      }
    }

    const completeResult = await params.supabase.rpc(
      'marketing_conversion_delivery_complete',
      {
        p_delivery_id: claim.delivery_id,
        p_lease_token: claim.lease_token,
        p_outcome: outcome,
        p_error_code: errorCode,
        p_provider_status: providerStatus,
        p_retry_after_seconds: retryAfterSeconds,
      },
    );
    if (completeResult.error) throw new Error('MARKETING_CONVERSION_COMPLETE_FAILED');
  }

  return summary;
}
