// Operator-only. Default preflight is read-only; never discovers credentials or prompts.
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { sharePointConfig } from '../apps/portal/lib/projects/sharePointFiles/config';
import { createGraph } from '../apps/portal/lib/projects/sharePointFiles/graph';
import { prepareProjectFileBindings } from '../apps/portal/lib/projects/sharePointFiles/import';

async function main() {
  const [inputPath, outputPath, mode = '--preflight'] = process.argv.slice(2);
  if (!inputPath || !outputPath || !['--preflight', '--apply'].includes(mode) || inputPath === outputPath) throw new Error('Usage: input.private.json output.private.json [--preflight|--apply]');
  const cfg = sharePointConfig();
  const manifest: unknown = JSON.parse(await readFile(inputPath, 'utf8'));
  const databaseUrl = new URL(process.env.SUPABASE_URL ?? '');
  const databaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (databaseUrl.protocol !== 'https:' || databaseUrl.username || databaseUrl.password || databaseUrl.search || databaseUrl.hash || databaseUrl.pathname !== '/' || databaseKey.length < 20) throw new Error('Approved operator configuration required');
  const db = createClient(databaseUrl.origin, databaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const graph = await createGraph(cfg, process.env.VERCEL_OIDC_TOKEN ?? '', AbortSignal.timeout(300000));
  const prepared = await prepareProjectFileBindings(manifest, cfg, async id => {
    const result = await db.from('projects').select('id').eq('id', id).maybeSingle();
    return !result.error && !!result.data;
  }, graph.resolvePath);
  await writeFile(outputPath, JSON.stringify({ mode, binding: cfg.binding, prepared }, null, 2), { flag: 'wx', mode: 0o600 });
  if (mode === '--apply') for (const row of prepared) {
    const result = await db.rpc('project_files_admin', { p_action: 'import', p_input: row });
    if (result.error) throw new Error('Binding import failed; completed rows are safe to replay');
  }
  console.log(`${prepared.length} verified folder bindings ${mode === '--apply' ? 'imported' : 'prepared; no writes'}.`);
}
main().catch(() => { console.error('Preflight/import failed. Check private input, configured source, approved credentials and project identities. No provider files are created by this tool.'); process.exitCode = 1; });
