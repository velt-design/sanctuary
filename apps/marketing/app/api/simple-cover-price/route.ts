import { NextResponse } from 'next/server';
import { isAllowedMarketingOrigin, readBoundedJson } from '@/lib/marketingPublicRequest';
import {
  parseSimpleCoverInput,
  toCustomerSafeSimpleCoverResult,
  type SimpleCoverInvalidResult,
  type SimpleCoverUnavailableResult,
} from '@/lib/simpleCoverCalculator';
import { calculateSimpleCoverPublicResult } from '@/lib/simpleCoverPricing.server';

const MAX_BODY_BYTES = 2 * 1024;
const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  if (!isAllowedMarketingOrigin(request)) {
    return json({ ok: false, status: 'invalid', message: 'Request not allowed.' } satisfies SimpleCoverInvalidResult, 403);
  }
  if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    return json({ ok: false, status: 'invalid', message: 'Use a JSON request.' } satisfies SimpleCoverInvalidResult, 415);
  }

  const body = await readBoundedJson(request, MAX_BODY_BYTES).catch(() => null);
  const input = parseSimpleCoverInput(body);
  if (!input) {
    return json({
      ok: false,
      status: 'invalid',
      message: 'Choose dimensions in 100 mm increments within the calculator range.',
    } satisfies SimpleCoverInvalidResult, 422);
  }

  try {
    return json(toCustomerSafeSimpleCoverResult(await calculateSimpleCoverPublicResult(input)));
  } catch {
    return json({
      ok: false,
      status: 'unavailable',
      message: 'Live pricing is temporarily unavailable. Your selections are still here—please try again shortly.',
    } satisfies SimpleCoverUnavailableResult, 503);
  }
}
