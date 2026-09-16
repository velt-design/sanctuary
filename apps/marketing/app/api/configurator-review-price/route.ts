import { getPublishedCostingConfiguration } from '../../../lib/publishedCostingConfiguration.server';
import { readBoundedJson, isAllowedMarketingOrigin } from '../../../lib/marketingPublicRequest';
import { parsePreviewDraft } from '../../../components/configurator-prototype/previewDraft';
import { calculateConfiguratorPricing, calculateReviewPrice } from '../../../lib/configuratorReviewPrice';

export async function POST(request: Request) {
  // Provisional repository rates must never silently replace published customer pricing.
  if (process.env.NODE_ENV !== 'development') return new Response(null, { status: 404 });
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!isAllowedMarketingOrigin(request)) return json({ status: 'unavailable' }, 403);
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json({ status: 'unavailable' }, 415);
  const body = await readBoundedJson(request, 16000).catch(() => null);
  const draft = parsePreviewDraft(body);
  if (!draft) return json({ status: 'unavailable' }, 422);
  try {
    const candidateVersion = process.env.CONFIGURATOR_LOCAL_PRICING_CANDIDATE;
    if (candidateVersion === 'v2.8' || candidateVersion === 'v2.9') {
      const published = await getPublishedCostingConfiguration();
      // Local review only: retain approved rates, opt into candidate calculation rules.
      const candidate = { ...published.config, appliedControlManifestVersion: candidateVersion };
      return json(calculateConfiguratorPricing(draft, candidate).estimate);
    }
    return json(calculateReviewPrice(draft));
  }
  catch { return json({ status: 'unavailable' }, 503); }
}
