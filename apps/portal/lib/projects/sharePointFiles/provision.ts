import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { supabaseServiceRole } from '@/lib/supabaseClient';
import { graphId, sharePointConfig } from './config';
import { createGraph } from './graph';
import { ProjectFilesError } from './types';

const projectSubfolders = ['3 CAD', '4 RENDERING', '5 DESIGN PACKAGE'] as const;
const claimSchema = z.object({ claimed: z.literal(true), projectId: z.uuid(), parentId: graphId, year: z.string().regex(/^\d{4}$/), folderName: z.string().min(1).max(180) });
export async function provisionProjectFolder(assertion: string) {
  const cfg = sharePointConfig();
  if (!cfg.provisionEnabled) return { updated: false, reason: 'disabled' };
  const lease = randomUUID();
  async function command(action: string, projectId: string | null = null, input: unknown = {}) {
    const result = await supabaseServiceRole.rpc('project_files_provision', { p_action: action, p_binding: cfg.binding, p_lease: lease, p_project_id: projectId, p_input: input });
    if (result.error) throw new ProjectFilesError('source_unavailable');
    return result.data;
  }
  const raw = await command('claim');
  if (raw?.claimed === false) return { updated: false, reason: raw.reason };
  const claim = claimSchema.parse(raw);
  try {
    if (claim.parentId !== cfg.enquiriesItemId) throw new ProjectFilesError('source_invalid');
    const graph = await createGraph(cfg, assertion, AbortSignal.timeout(45000));
    if ((await graph.resolvePath('02 Enquiries and quotes')).id !== claim.parentId) throw new ProjectFilesError('source_invalid');
    const year = await graph.ensureFolder(claim.parentId, claim.year);
    const root = await graph.ensureFolder(year.id, claim.folderName);
    for (const name of projectSubfolders) await graph.ensureFolder(root.id, name);
    const evidenceSha256 = createHash('sha256').update(JSON.stringify({ binding: cfg.binding, projectId: claim.projectId, itemId: root.id, subfolders: projectSubfolders })).digest('hex');
    const result = await command('complete', claim.projectId, { itemId: root.id, evidenceSha256 });
    if (!result?.completed) throw new ProjectFilesError('busy');
    return { updated: true };
  } catch (error) {
    const safe = error instanceof ProjectFilesError ? error : new ProjectFilesError('source_unavailable');
    await command('fail', claim.projectId, { code: safe.code }).catch(() => undefined);
    throw safe;
  }
}
