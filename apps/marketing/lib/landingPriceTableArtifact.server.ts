import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PublishedCostingConfigurationProvenanceV1 } from '@sp/costing/server';
import { parseLandingPriceTable, type LandingPriceTable } from './landingPriceTable';

export function landingPricePublicationKey(provenance: PublishedCostingConfigurationProvenanceV1): string {
  return createHash('sha256').update(JSON.stringify([provenance.versionId, provenance.versionNumber,
    provenance.contentHash, provenance.baseManifestVersion])).digest('hex');
}

export function landingPriceTableId(table: Omit<LandingPriceTable, 'id'>): string {
  return createHash('sha256').update(JSON.stringify([table.schema, table.versionId, table.versionNumber,
    table.publicationKey, table.currency, table.includesGst, table.amounts])).digest('hex');
}

// Immutable within a deployment; no visitor-triggered generation or private config cache.
let artifact: Promise<LandingPriceTable | null> | undefined;
export function readLandingPriceTableArtifact(): Promise<LandingPriceTable | null> {
  artifact ??= readFile(path.join(process.cwd(), '.generated', 'landing-price-table.json'), 'utf8')
    .then(text => {
      const table = parseLandingPriceTable(JSON.parse(text));
      return table && landingPriceTableId(table) === table.id ? table : null;
    }).catch(() => null);
  return artifact;
}
