'use client';

import dynamic from 'next/dynamic';
import type { QueryClient } from '@tanstack/react-query';
import type { ProjectTabKey } from '@/lib/projects/projectTabs';
import styles from './projectTabModules.module.css';

export type ProjectTabModuleKey = ProjectTabKey;

const loaders = {
  activity: () => import('./tabs/OverviewTab'),
  estimates: () => import('./tabs/EstimatesTab'),
  quotes: () => import('./tabs/QuotesTab'),
  invoices: () => import('./tabs/InvoicesTab'),
  'job-packs': () => import('./tabs/JobPacksTab'),
  emails: () => import('./tabs/EmailsTab'),
} satisfies Record<ProjectTabModuleKey, () => Promise<unknown>>;

function loadingState(label: string, key: ProjectTabModuleKey) {
  return function ProjectTabLoadingState() {
    return (
      <div className={styles.tabLoadingState} data-project-tab-loading={key} role="status">
        Loading {label} in the background…
      </div>
    );
  };
}

export const OverviewTab = dynamic(loaders.activity, { loading: loadingState('overview', 'activity') });
export const EstimatesTab = dynamic(loaders.estimates, { loading: loadingState('designs', 'estimates') });
export const QuotesTab = dynamic(loaders.quotes, { loading: loadingState('quotes', 'quotes') });
export const InvoicesTab = dynamic(loaders.invoices, { loading: loadingState('invoices', 'invoices') });
export const JobPacksTab = dynamic(loaders['job-packs'], { loading: loadingState('job packs', 'job-packs') });
export const EmailsTab = dynamic(loaders.emails, { loading: loadingState('emails', 'emails') });

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
