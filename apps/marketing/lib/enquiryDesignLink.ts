import type { CustomerBrief } from './enquiryDesign';

/** Deployment-owned origin; customer input must never control links in an email. */
export function customerDesignUrl(brief: CustomerBrief): string | undefined {
  if (!brief.design) return undefined;
  const path = brief.reopenPath;
  if (!path || !path.startsWith('/configurator-preview?open=1#design=') || /[\r\n]/.test(path)) return undefined;
  const branch = process.env.VERCEL_BRANCH_URL;
  const origin = process.env.VERCEL_ENV === 'preview' && branch && /^[a-z0-9.-]+\.vercel\.app$/i.test(branch)
    ? `https://${branch}` : 'https://www.sanctuarypergolas.co.nz';
  return `${origin}${path}`;
}
