import { readBoundedJson, isAllowedMarketingOrigin } from '../../../lib/marketingPublicRequest';
import { parsePreviewDraft } from '../../../components/configurator-prototype/previewDraft';
import { getPublishedCostingConfiguration } from '../../../lib/publishedCostingConfiguration.server';
import { calculateFrozenConfiguratorPrice } from '../../../lib/configuratorPricing.server';
import { issueConfiguratorCalculationRef } from '../../../lib/configuratorCalculationRef.server';
import type { ConfiguratorPublicPrice } from '../../../lib/configuratorPublicPrice';

export async function POST(request: Request) {
  const json = (body: ConfiguratorPublicPrice, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  // Explicit owner approval of one immutable version, followed by release activation. Never set automatically.
  const approvedVersion = process.env.WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID?.trim();
  if (!approvedVersion) return json({ status: 'disabled' });
  if (!isAllowedMarketingOrigin(request)) return json({ status: 'unavailable' }, 403);
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json({ status: 'unavailable' }, 415);
  const draft = parsePreviewDraft(await readBoundedJson(request, 16000).catch(() => null));
  if (!draft) return json({ status: 'unavailable' }, 422);
  if (draft.input.widthMm * draft.input.projectionMm > (draft.input.level === 'ground' ? 30 : 20) * 1_000_000)
    return json({ status: 'custom', reason: 'Your design needs a tailored quote.' });
  try {
    const resolved = await getPublishedCostingConfiguration();
    if (resolved.provenance.versionId !== approvedVersion) return json({ status: 'unavailable' }, 503);
    const frozen = calculateFrozenConfiguratorPrice(draft, resolved);
    if (!frozen) return json({ status: 'custom', reason: 'We’ll confirm the complete price for your design after reviewing your site and selections.' });
    return json({ status: 'priced', ...frozen.customerPrice, versionNumber: resolved.provenance.versionNumber,
      calculationRef: issueConfiguratorCalculationRef(frozen) });
  } catch { return json({ status: 'unavailable' }, 503); }
}
