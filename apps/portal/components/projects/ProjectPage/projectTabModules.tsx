'use client';

import dynamic from 'next/dynamic';
import type { QueryClient } from '@tanstack/react-query';
import styles from './ProjectPage.module.css';

export type ProjectTabModuleKey =
  | 'activity'
  | 'estimates'
  | 'quotes'
  | 'invoices'
  | 'job-packs'
  | 'emails';

type ProjectLazyTabModuleKey = Exclude<ProjectTabModuleKey, 'activity'>;

const loaders = {
  estimates: () => import('./tabs/EstimatesTab'),
  quotes: () => import('./tabs/QuotesTab'),
  invoices: () => import('./tabs/InvoicesTab'),
  'job-packs': () => import('./tabs/JobPacksTab'),
  emails: () => import('./tabs/EmailsTab'),
} satisfies Record<ProjectLazyTabModuleKey, () => Promise<unknown>>;

function loadingState(label: string, key: ProjectLazyTabModuleKey) {
  return function ProjectTabLoadingState() {
    return (
      <div className={styles.tabLoadingState} data-project-tab-loading={key} role="status">
        Loading {label} in the background…
      </div>
    );
  };
}

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
    tab === 'activity' ? Promise.resolve() : loaders[tab](),
    import('./projectTabDataPreload').then(({ preloadProjectTabData }) =>
      preloadProjectTabData(tab, context),
    ),
  ]);
}
