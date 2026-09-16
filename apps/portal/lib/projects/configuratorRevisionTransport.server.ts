import 'server-only';

/** Authenticate the fixed marketing preview without exposing its credential to staff browsers. */
export function configuratorRevisionHeaders(origin: string, staffToken: string): Record<string, string> {
  const headers: Record<string, string> = {'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}`};
  const credential = process.env.CONFIGURATOR_MARKETING_PREVIEW_SECRET?.trim();
  if (process.env.VERCEL_ENV === 'preview' && credential) {
    const target = new URL(origin);
    if (target.protocol !== 'https:' || !target.hostname.endsWith('.vercel.app')) {
      throw new Error('Invalid protected marketing preview origin');
    }
    headers['x-vercel-protection-bypass'] = credential;
  }
  return headers;
}
