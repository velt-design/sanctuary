'use client';

import dynamic from 'next/dynamic';
import type { QueryClient } from '@tanstack/react-query';
import type { ProjectTabKey } from '@/lib/projects/projectTabs';
import styles from './projectTabModules.module.css';

export type ProjectTabModuleKey = ProjectTabKey;

const loaders = {
  activity: () => import('./tabs/OverviewTab'),
  estimates: () => import('./tabs/CommercialTab'),
  quotes: () => import('./tabs/CommercialTab'),
  invoices: () => import('./tabs/CommercialTab'),
  'job-packs': () => import('./tabs/JobPacksTab'),
} satisfies Record<ProjectTabModuleKey, () => Promise<unknown>>;

export async function preloadNestedProjectTab(
  tab: ProjectTabModuleKey,
  preloadCommercialView: (view: 'estimates' | 'quotes' | 'invoices') => Promise<unknown> = async (view) => {
    const { preloadCommercialViewModule } = await import('./tabs/CommercialTab');
    return preloadCommercialViewModule(view);
  },
): Promise<void> {
  if (tab !== 'estimates' && tab !== 'quotes' && tab !== 'invoices') return;
  await preloadCommercialView(tab);
}

function loadingState(label: string, key: ProjectTabModuleKey | 'commercial') {
  return function ProjectTabLoadingState() {
    return (
      <div className={styles.tabLoadingState} data-project-tab-loading={key} role="status">
        Loading {label} in the background…
      </div>
    );
  };
}

export const OverviewTab = dynamic(loaders.activity, { loading: loadingState('overview', 'activity') });
export const CommercialTab = dynamic(loaders.quotes, { loading: loadingState('commercial', 'commercial') });
export const JobPacksTab = dynamic(loaders['job-packs'], { loading: loadingState('job packs', 'job-packs') });

export async function preloadProjectTab(
  tab: ProjectTabModuleKey,
  context: { host: string; projectId: string; queryClient: QueryClient },
): Promise<void> {
  await Promise.all([
    loaders[tab](),
    preloadNestedProjectTab(tab),
    import('./projectTabDataPreload').then(({ preloadProjectTabData }) =>
      preloadProjectTabData(tab, context),
    ),
  ]);
}
