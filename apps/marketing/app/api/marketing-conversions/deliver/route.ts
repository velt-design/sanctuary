import 'server-only';

import { NextResponse } from 'next/server';
import {
  ga4MeasurementProtocolConfigFromEnv,
  processMarketingConversionDeliveries,
} from '@/lib/marketingConversionDelivery';
import { secureTokenMatches } from '@/lib/marketingPublicRequest';
import { getServiceSupabase } from '@/lib/supabaseService';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim() || '';
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  if (!cronSecret || !provided || !secureTokenMatches(provided, cronSecret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const config = ga4MeasurementProtocolConfigFromEnv();
  if (!config) {
    return NextResponse.json(
      { ok: false, error: 'Marketing conversion delivery unavailable' },
      { status: 503 },
    );
  }

  try {
    const summary = await processMarketingConversionDeliveries({
      supabase: getServiceSupabase(),
      config,
    });
    return NextResponse.json({ ok: true, ...summary });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Marketing conversion delivery unavailable' },
      { status: 503 },
    );
  }
}
