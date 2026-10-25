'use client';
import { createContext, useContext } from 'react';
import type { useProjectTabSelection } from '@/components/projects/ProjectPage/useProjectTabSelection';
import type { ProjectSnapshotEvidence } from './[projectId]/ProjectSnapshotSurface';
import type { QuotesListBinding } from '@/components/projects/ProjectPage/tabs/QuotesListSurface';
import type { InvoicesListBinding } from '@/components/projects/ProjectPage/tabs/InvoicesListSurface';
import type { CommercialTabChrome } from '@/components/projects/ProjectPage/tabs/CommercialTabSurface';
import type { EstimatesListBinding } from '@/components/projects/ProjectPage/tabs/EstimatesListSurface';
import type {JobPacksListEvidence} from '@/components/projects/ProjectPage/tabs/JobPacksListSurface';
import type {OverviewBinding} from '@/components/projects/ProjectPage/tabs/ProjectOverviewSurface';
import type {FilesBinding} from '@/components/projects/ProjectPage/tabs/ProjectFilesSurface';
export type ProjectInstantNavigationValue = {
  showProject: (href: string) => void;
  projectId: string;
  owner: object | null;
  navigation: ReturnType<typeof useProjectTabSelection>;
  publish: (value: ProjectSnapshotEvidence | null) => void;
  warmCorrespondence: boolean;
  estimatesList: EstimatesListBinding;
  quotesList: QuotesListBinding; invoicesList: InvoicesListBinding;
  overview:OverviewBinding;files:FilesBinding;publishJobPacks:(value:JobPacksListEvidence|null)=>void;
  publishCommercial: (value: CommercialTabChrome | null) => void;
};

export const ProjectInstantNavigationContext = createContext<ProjectInstantNavigationValue | null>(null);

export function useProjectInstantNavigation(): ProjectInstantNavigationValue {
  const value = useContext(ProjectInstantNavigationContext);
  if (!value) throw new Error('useProjectInstantNavigation must be used inside the Projects layout.');
  return value;
}

export function useOptionalProjectWorkspace() { return useContext(ProjectInstantNavigationContext); }
