import { getPortalSession } from '@/lib/auth';
import { resolvePublishedCostingConfiguration } from '@/lib/costing/configurationResolver';
import { calculateSiteCostV2 } from '@sp/costing';
import type { SiteInputsV2 } from '@sp/costing';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * V2 cost engine endpoint. Accepts the scene-derived `SiteInputsV2` shape
 * the workbench produces via `buildSiteInputsV2FromScene`. Per the Phase 2
 * north star: cost engine receives pergola data only (no house/deck/opening
 * fields); logical-pergola grouping is derived from spatial adjacency in
 * the workbench scene.
 *
 * Unlike the V1 endpoint (`/api/staff/costing/v1/job`), validation here is
 * deliberately thin — the V2 input is produced by typed workbench code, not
 * by an external untrusted source (marketing form / external API). The
 * engine itself enforces structural invariants (throws on empty pergolas,
 * empty modules, etc.) so duplicating field-by-field shape checks would
 * just add maintenance burden without catching real bugs. The marketing
 * form continues to use the V1 endpoint with its existing strict
 * validation (per Phase 2 plan Q5: marketing path stays on V1).
 */
function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body || typeof body !== 'object') return badRequest('Body must be an object');
  if ((body as { schema_version?: unknown }).schema_version !== 'v2') {
    return badRequest('schema_version must be "v2"');
  }
  if (!Array.isArray((body as { pergolas?: unknown }).pergolas)) {
    return badRequest('pergolas must be an array');
  }

  try {
    const { config, provenance } = await resolvePublishedCostingConfiguration();
    const result = calculateSiteCostV2(body as SiteInputsV2, config);
    return NextResponse.json({ ...result, costingConfiguration: provenance });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Costing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
