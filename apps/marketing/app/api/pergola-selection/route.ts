import { readBoundedJson, isAllowedMarketingOrigin } from '@/lib/marketingPublicRequest';
import { prepareLandingDesign } from '@/app/pergolas-auckland/landingDesign.server';

export async function POST(request: Request) {
  const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!isAllowedMarketingOrigin(request)) return reply({ error: 'Unavailable' }, 403);
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return reply({ error: 'Invalid request' }, 415);
  const design = prepareLandingDesign(await readBoundedJson(request, 16000).catch(() => null));
  return design ? reply(design) : reply({ error: 'Check your selections' }, 422);
}
