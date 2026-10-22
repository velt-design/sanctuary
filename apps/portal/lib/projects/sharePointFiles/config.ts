import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ProjectFilesError } from './types';
import { graphId } from './ids';
export { graphId } from './ids';

export function sharePointConfig() {
  try {
    if (process.env.SANCTUARY_SHAREPOINT_ENABLED !== 'true') throw new Error();
    const tenantId = z.uuid().parse(process.env.SANCTUARY_SHAREPOINT_TENANT_ID);
    const clientId = z.uuid().parse(process.env.SANCTUARY_SHAREPOINT_CLIENT_ID);
    const driveId = graphId.parse(process.env.SANCTUARY_SHAREPOINT_JOBS_DRIVE_ID);
    const enquiriesItemId = graphId.parse(process.env.SANCTUARY_SHAREPOINT_ENQUIRIES_ITEM_ID);
    const hostname = z.string().regex(/^[a-z0-9-]+\.sharepoint\.com$/).parse(process.env.SANCTUARY_SHAREPOINT_HOSTNAME);
    const site = new URL(z.url().parse(process.env.SANCTUARY_SHAREPOINT_JOBS_SITE_URL));
    if (site.protocol !== 'https:' || site.hostname !== hostname || site.port || site.username || site.password || site.search || site.hash || !/^\/sites\/[a-zA-Z0-9_-]+\/?$/.test(site.pathname)) throw new Error();
    const siteUrl = site.origin + site.pathname.replace(/\/$/, '');
    const binding = createHash('sha256').update(JSON.stringify({ tenantId, clientId, driveId, enquiriesItemId, hostname, siteUrl })).digest('hex');
    return { tenantId, clientId, driveId, enquiriesItemId, hostname, siteUrl, binding, provisionEnabled: process.env.SANCTUARY_SHAREPOINT_PROVISION_ENABLED === 'true' };
  } catch { throw new ProjectFilesError('not_configured'); }
}
export type SharePointConfig = ReturnType<typeof sharePointConfig>;
