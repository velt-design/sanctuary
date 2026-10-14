import { loadEnvConfig } from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getPublishedCostingConfiguration } from '../../apps/marketing/lib/publishedCostingConfiguration.server';
import { generateLandingPriceTable } from '../../apps/marketing/lib/landingPriceTableGenerator.server';

async function main() {
  // Invoked from apps/marketing by npm build, before Next bundles/traces the server-only artifact.
  loadEnvConfig(process.cwd());
  const directory = path.join(process.cwd(), '.generated');
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'landing-price-table.json');
  // Erase any previous build output before resolving the current approved publication.
  await writeFile(file, JSON.stringify({ status: 'disabled' }));
  const approved = process.env.WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID?.trim();
  if (!approved) { console.log('Landing price table: disabled (no approved publication).'); return; }
  const started = performance.now();
  const resolved = await getPublishedCostingConfiguration();
  if (resolved.provenance.versionId !== approved) throw new Error('Approved publication is not current');
  const table = generateLandingPriceTable(resolved);
  await writeFile(file, JSON.stringify(table));
  console.log(`Landing price table: ${table.amounts.length} exact entries, version ${table.versionNumber}, ${Math.round(performance.now() - started)} ms.`);
}

main().catch(() => { console.error('Landing price table generation failed. Check the approved publication and server build environment.'); process.exitCode = 1; });
