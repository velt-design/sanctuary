import type {
  CostingControlConfigV1,
  CostingControlDiffEntryV1,
  CostingControlImpactRowV1,
  SiteOutputV1,
} from '@sp/costing';

type CostingConfigurationStatus = 'draft' | 'published';

export type CostingConfigurationVersion = {
  id: string;
  versionNumber: number;
  status: CostingConfigurationStatus;
  schemaVersion: string;
  baseManifestVersion: string;
  basedOnVersionId: string | null;
  config: CostingControlConfigV1;
  contentHash: string;
  createdAt: string;
  createdByEmail: string;
  updatedAt: string;
  updatedByEmail: string;
  publishedAt: string | null;
  publishedByEmail: string | null;
  publishNote: string | null;
  publicationDiff: CostingControlDiffEntryV1[] | null;
  publicationImpact: CostingControlImpactRowV1[] | null;
};

export type CostingConfigurationVersionSummary = Omit<
  CostingConfigurationVersion,
  'config' | 'publicationDiff' | 'publicationImpact'
>;

export type CostingConfigurationProvenanceV1 =
  | {
      schemaVersion: 'costing-provenance.v1';
      source: 'published';
      versionId: string;
      versionNumber: number;
      contentHash: string;
      baseManifestVersion: string;
    }
  | {
      schemaVersion: 'costing-provenance.v1';
      source: 'legacy-overrides';
      versionId: null;
      versionNumber: null;
      contentHash: string;
      baseManifestVersion: string;
      configSnapshot: CostingControlConfigV1;
    };

export type CalculatorCostingResponse = SiteOutputV1 & {
  costingConfiguration?: CostingConfigurationProvenanceV1;
};
