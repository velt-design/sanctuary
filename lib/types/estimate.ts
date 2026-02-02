import type { CalculatorInputs } from './calculator';
import type { DerivedV1, InstallV1, MaterialsV1, OverheadV1, TotalsV1, WarningV1 } from '@sp/costing';
import type { Contact } from './contact';
import type { Project } from './project';

export type EstimateStatus = 'draft' | 'approved' | 'archived';

export type ProjectSnapshot = Pick<
  Project,
  'id' | 'name' | 'quoteRef' | 'region' | 'clientName' | 'email' | 'phone' | 'address' | 'createdAt' | 'updatedAt'
>;

export type EstimateSnapshot = {
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
    materials: MaterialsV1;
    install: InstallV1;
    overhead: OverheadV1;
    totals: TotalsV1;
    warnings: WarningV1[];
  };

  configVersions: {
    pricebook: string;
    installActions: string;
    overheads: string;
    rules: string;
    manifest: string;
  };
};
