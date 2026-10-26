'use client';

import dynamic from 'next/dynamic';
import type { QueryClient } from '@tanstack/react-query';
import type { ProjectTabKey } from '@/lib/projects/projectTabs';
import type { ComponentProps } from 'react';
import styles from './projectTabModules.module.css';

export type ProjectTabModuleKey = ProjectTabKey;

const loaders = {
  activity: () => import('./tabs/OverviewTab'),
  files: () => import('./tabs/FilesTab'),
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

const StandaloneOverviewTab = dynamic(loaders.activity, { loading: loadingState('overview', 'activity') });
const ManagedOverviewTab = dynamic(loaders.activity, { loading: () => null });
export function OverviewTab(props: ComponentProps<typeof StandaloneOverviewTab>) {
  const Reader = props.surface ? ManagedOverviewTab : StandaloneOverviewTab;
  return <Reader {...props} />;
}
export const FilesTab = dynamic(loaders.files, { loading: loadingState('files', 'files') });
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

// Code only: the route owns active reads, so this must not prefetch query data.
export async function preloadProjectOverviewModule(): Promise<void> {
  const overview = await loaders.activity();
  await overview.preloadOverviewModules();
}

export async function preloadProjectTabModule(tab: ProjectTabModuleKey): Promise<void> {
  await Promise.all([loaders[tab](), preloadNestedProjectTab(tab)]);
}
