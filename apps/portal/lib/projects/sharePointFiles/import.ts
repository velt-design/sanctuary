import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { SharePointConfig } from './config';
const manifestSchema = z.object({ formatVersion: z.literal(1), siteUrl: z.url(), libraryName: z.string(), status: z.string(), rows: z.array(z.object({ projectId: z.uuid(), relativePath: z.string().min(1).max(1200), label: z.string().min(1).max(200), evidence: z.string().min(1).max(20000) }).strict()).max(5000) });
export async function prepareProjectFileBindings(input: unknown, cfg: SharePointConfig, projectExists: (id: string) => Promise<boolean>, resolvePath: (path: string) => Promise<{ id: string }>) {
  const manifest = manifestSchema.parse(input);
  if (manifest.siteUrl.replace(/\/$/, '') !== cfg.siteUrl || manifest.libraryName !== 'Documents') throw new Error('Wrong source library');
  const prepared = [];
  const seen = new Set<string>();
  // Resolve and verify the complete batch before the caller may write any binding.
  for (const row of manifest.rows) {
    if (!/^(01 Current projects\/[^/]+|02 Enquiries and quotes\/(?:\d{4}|Design and feasibility)\/[^/]+|90 Completed projects\/\d{4}\/[^/]+)$/.test(row.relativePath)) throw new Error('Mapping is not a project root');
    if (!await projectExists(row.projectId)) throw new Error('Project does not exist');
    const item = await resolvePath(row.relativePath);
    if (seen.has(item.id)) throw new Error('Duplicate folder binding');
    seen.add(item.id);
    prepared.push({ projectId: row.projectId, itemId: item.id, label: row.label, binding: cfg.binding, evidenceSha256: createHash('sha256').update(JSON.stringify({ ...row, binding: cfg.binding, itemId: item.id })).digest('hex') });
  }
  return prepared;
}
