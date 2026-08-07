'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import type { QueryClient } from '@tanstack/react-query';
import type { ProjectTabKey } from '@/lib/projects/projectTabs';
import ProjectCalculatorPendingFrame from './tabs/ProjectCalculatorPendingFrame';
import ProjectCommercialPendingFrame from './tabs/CommercialPendingFrames';
import ProjectOverviewPendingFrame from './tabs/overview/ProjectOverviewPendingFrame';
import JobPackDetailPendingFrame from './tabs/JobPackDetailPendingFrame';
import JobPacksPendingFrame from './tabs/JobPacksPendingFrame';

export type ProjectTabModuleKey = ProjectTabKey;

const loaders = {
  activity: () => import('./tabs/OverviewTab'),
  estimates: () => import('./tabs/ProjectCalculatorTab'),
  quotes: () => import('./tabs/CommercialTab'),
  invoices: () => import('./tabs/CommercialTab'),
  'job-packs': () => import('./tabs/JobPacksTab'),
} satisfies Record<ProjectTabModuleKey, () => Promise<unknown>>;

function JobPacksTabPendingFrame() {
  const searchParams = useSearchParams();
  const selectedEstimateId = searchParams.get('estimateId')?.trim();
  return selectedEstimateId
    ? <JobPackDetailPendingFrame sheet={searchParams.get('sheet')} />
    : <JobPacksPendingFrame />;
}

export const OverviewTab = dynamic(loaders.activity, {
  loading: ProjectOverviewPendingFrame,
});
export const ProjectCalculatorTab = dynamic(loaders.estimates, {
  loading: ProjectCalculatorPendingFrame,
});
const CommercialQuotesTab = dynamic(loaders.quotes, {
  loading: () => <ProjectCommercialPendingFrame view="quotes" />,
});
const CommercialInvoicesTab = dynamic(loaders.invoices, {
  loading: () => <ProjectCommercialPendingFrame view="invoices" />,
});

export function CommercialTab(
  props: { host: string; projectId: string; view: 'quotes' | 'invoices' },
) {
  return props.view === 'invoices'
    ? <CommercialInvoicesTab {...props} />
    : <CommercialQuotesTab {...props} />;
}

export const JobPacksTab = dynamic(loaders['job-packs'], {
  loading: JobPacksTabPendingFrame,
});

export async function preloadProjectTab(
  tab: ProjectTabModuleKey,
  context: { host: string; projectId: string; queryClient: QueryClient },
): Promise<void> {
  await Promise.all([
    loaders[tab](),
    import('./projectTabDataPreload').then(({ preloadProjectTabData }) =>
      preloadProjectTabData(tab, context),
    ),
  ]);
}
