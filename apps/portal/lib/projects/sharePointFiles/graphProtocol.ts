import 'server-only';
import { z } from 'zod';
import { graphId, type SharePointConfig } from './config';
import { ProjectFilesError } from './types';

export const itemSchema = z.object({
  id: graphId, name: z.string().min(1).max(400), size: z.number().int().nonnegative().optional(),
  parentReference: z.object({ id: graphId.optional(), driveId: graphId.optional(), path: z.string().max(16000).optional() }).optional(),
  folder: z.object({ childCount: z.number().optional() }).optional(),
  file: z.object({ mimeType: z.string().optional() }).optional(),
  remoteItem: z.unknown().optional(), lastModifiedDateTime: z.string().optional(),
  webUrl: z.string().optional(), sharepointIds: z.object({ siteUrl: z.string().optional() }).optional(),
  eTag: z.string().min(1).max(1024).regex(/^[^\r\n\x00-\x1f]*$/).optional(),
  cTag: z.string().min(1).max(1024).regex(/^[^\r\n\x00-\x1f]*$/).optional(),
  '@microsoft.graph.downloadUrl': z.string().optional(),
});
export type DriveItem = z.infer<typeof itemSchema>;
export const ITEM_SELECT = 'id,name,size,folder,file,parentReference,lastModifiedDateTime,remoteItem,eTag,cTag,webUrl,sharepointIds';
export const LIBRARY_SELECT = 'id,name,webUrl,folder,parentReference,sharepointIds,remoteItem';

export async function boundedJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new ProjectFilesError([401, 403].includes(response.status) ? 'access_required' : response.status === 404 ? 'not_found' : 'source_unavailable', response.status === 404 ? 404 : 503);
  const reader = response.body?.getReader(); if (!reader) throw new ProjectFilesError('source_invalid');
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 2_000_000) { await reader.cancel(); throw new ProjectFilesError('source_invalid'); } chunks.push(part.value); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>; } catch { throw new ProjectFilesError('source_invalid'); }
}

export function validateLibrary(drive: Record<string, unknown>, cfg: SharePointConfig) {
  const root = itemSchema.safeParse(drive);
  if (!root.success || !root.data.folder || root.data.remoteItem || root.data.parentReference?.driveId !== cfg.driveId || typeof drive.webUrl !== 'string') throw new ProjectFilesError('source_invalid');
  const driveUrl = new URL(drive.webUrl), siteUrl = new URL(cfg.siteUrl);
  if (driveUrl.origin !== siteUrl.origin || decodeURIComponent(driveUrl.pathname).replace(/\/$/, '') !== siteUrl.pathname + '/Shared Documents' || driveUrl.username || driveUrl.password || driveUrl.hash || driveUrl.search) throw new ProjectFilesError('source_invalid');
  const ids = drive.sharepointIds as { siteUrl?: unknown } | undefined;
  if (ids?.siteUrl !== undefined && ids.siteUrl !== cfg.siteUrl) throw new ProjectFilesError('source_invalid');
}

/** A current project folder can prove the same library without reading its slower drive root. */
export function currentProjectLibrary(root: DriveItem, cfg: SharePointConfig): boolean {
  if (!root.folder || root.remoteItem || root.parentReference?.driveId !== cfg.driveId || !root.webUrl) return false;
  if (root.sharepointIds?.siteUrl !== undefined && root.sharepointIds.siteUrl !== cfg.siteUrl) throw new ProjectFilesError('source_invalid');
  try {
    const url = new URL(root.webUrl), site = new URL(cfg.siteUrl);
    if (url.origin !== site.origin || url.username || url.password || url.search || url.hash) return false;
    const decode = (path: string) => path.replace(/\/$/, '').split('/').slice(1).map(part => decodeURIComponent(part));
    const actual = decode(url.pathname), prefix = [...decode(site.pathname), 'Shared Documents'];
    if (actual.some(part => !part || part === '.' || part === '..' || /[\/\\\x00-\x1f]/.test(part))) return false;
    return actual.length > prefix.length && prefix.every((part, index) => actual[index] === part) && actual.at(-1) === root.name;
  } catch { return false; }
}

export function parseItem(value: unknown, id: string, driveId: string): DriveItem {
  const parsed = itemSchema.safeParse(value);
  if (!parsed.success || parsed.data.id !== id || parsed.data.remoteItem || parsed.data.parentReference?.driveId && parsed.data.parentReference.driveId !== driveId) throw new ProjectFilesError('source_invalid');
  return parsed.data;
}

export function batchBodies(value: Record<string, unknown>, expected: string[], invalidateToken: () => void): Map<string, unknown> {
  if (!Array.isArray(value.responses)) throw new ProjectFilesError('source_invalid');
  if (value.responses.some(response => response && (response.status === 401 || response.status === 403))) invalidateToken();
  if (value.responses.length !== expected.length) throw new ProjectFilesError('source_invalid');
  const bodies = new Map<string, unknown>();
  for (const raw of value.responses) {
    const response = z.object({ id: z.string(), status: z.number().int(), body: z.unknown() }).safeParse(raw);
    if (!response.success || !expected.includes(response.data.id) || bodies.has(response.data.id)) throw new ProjectFilesError('source_invalid');
    const { id, status, body } = response.data;
    if (status === 401 || status === 403) invalidateToken();
    if (status !== 200) throw new ProjectFilesError([401, 403].includes(status) ? 'access_required' : status === 404 ? 'not_found' : 'source_unavailable', status === 404 ? 404 : 503);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ProjectFilesError('source_invalid');
    bodies.set(id, body);
  }
  return bodies;
}
