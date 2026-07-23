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
  name: string;
  purpose: string;
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

export type CostingEstimateCandidate = {
  id: string;
  projectId: string;
  projectName: string;
  quoteRef: string | null;
  siteAddress: string | null;
  version: number | null;
  status: string;
  updatedAt: string;
  savedCostingVersionId: string | null;
};

export type CostingEstimatePreview = {
  estimate: CostingEstimateCandidate & {
    savedProvenance: {
      source: string | null;
      versionId: string | null;
      versionNumber: number | null;
      contentHash: string | null;
    } | null;
  };
  impact: CostingControlImpactRowV1;
  draftContentHash: string;
  currentVersionId: string | null;
  generatedAt: string;
};
