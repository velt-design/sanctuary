import { readBoundedJson, isAllowedMarketingOrigin } from '../../../lib/marketingPublicRequest';
import { getPublishedCostingConfiguration } from '../../../lib/publishedCostingConfiguration.server';
import { landingPricePublicationKey, readLandingPriceTableArtifact } from '../../../lib/landingPriceTableArtifact.server';
import { LANDING_PRICE_LEASE_MS, type LandingPriceTableReply } from '../../../lib/landingPriceTable';

export async function POST(request: Request) {
  const json = (body: LandingPriceTableReply, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (process.env.NODE_ENV === 'development' && ['v2.8', 'v2.9'].includes(process.env.CONFIGURATOR_LOCAL_PRICING_CANDIDATE ?? '')) return json({ status: 'disabled' });
  const approved = process.env.WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID?.trim();
  if (!approved) return json({ status: 'disabled' });
  if (!isAllowedMarketingOrigin(request)) return json({ status: 'unavailable' }, 403);
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json({ status: 'unavailable' }, 415);
  const input = await readBoundedJson(request, 256).catch(() => null);
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => key !== 'knownId')
    || ('knownId' in input && (typeof input.knownId !== 'string' || !/^[a-f0-9]{64}$/.test(input.knownId)))) return json({ status: 'unavailable' }, 422);
  try {
    // Check the live publication even on a conditional response. Never authorize a cached former publication.
    const resolved = await getPublishedCostingConfiguration();
    if (resolved.provenance.versionId !== approved) return json({ status: 'unavailable' }, 503);
    const table = await readLandingPriceTableArtifact();
    if (!table || table.versionId !== approved || table.versionNumber !== resolved.provenance.versionNumber
      || table.publicationKey !== landingPricePublicationKey(resolved.provenance)) return json({ status: 'unavailable' }, 503);
    return json(input.knownId === table.id ? { status: 'current', id: table.id, leaseMs: LANDING_PRICE_LEASE_MS }
      : { status: 'ready', table, leaseMs: LANDING_PRICE_LEASE_MS });
  } catch { return json({ status: 'unavailable' }, 503); }
}
