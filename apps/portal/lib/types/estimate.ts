import type { CalculatorInputs } from './calculator';
import type {
  DerivedV1,
  InstallV1,
  MaterialsV1,
  OverheadV1,
  PergolaOutputV1,
  SiteSharedOutputV1,
  TotalsV1,
  WarningV1,
} from '@sp/costing';
import type { Contact } from './contact';
import type { Project } from './project';

export type EstimateStatus = 'draft' | 'archived';

type ProjectSnapshot = Pick<
  Project,
  'id' | 'name' | 'quoteRef' | 'region' | 'clientName' | 'email' | 'phone' | 'address' | 'createdAt' | 'updatedAt'
>;

type EstimateSnapshot = {
  contact: Pick<Contact, 'displayName' | 'email' | 'phone'>;
  project: {
    projectName: string;
    region?: string;
    siteAddress?: string;
    quoteRef?: string;
  };
};

export type Estimate = {
  id: string;
  projectId: string;
  version?: number;
  createdAt: string;
  updatedAt?: string;
  status: EstimateStatus;

  inputs: CalculatorInputs;
  derived: DerivedV1;
  projectSnapshot?: ProjectSnapshot;
  snapshot?: EstimateSnapshot;
  outputs: {
    cost_snapshot_version?: 'v1' | 'v2';
    materials: MaterialsV1;
    install: InstallV1;
    overhead: OverheadV1;
    totals: TotalsV1;
    warnings: WarningV1[];
    pergolas?: PergolaOutputV1[];
    siteShared?: SiteSharedOutputV1;
    shared?: SiteSharedOutputV1;
  };

  configVersions: {
    pricebook: string;
    installActions: string;
    overheads: string;
    rules: string;
    manifest: string;
  };
};
