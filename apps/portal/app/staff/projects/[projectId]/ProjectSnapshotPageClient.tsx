'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ProjectHeader from '@/components/projects/ProjectPage/ProjectHeader';
import ProjectPipelineBar from '@/components/projects/ProjectPage/ProjectPipelineBar';
import ProjectPageShell from '@/components/projects/ProjectPage/ProjectPageShell';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import { getProjectSnapshotPlaceholderFromList } from '@/lib/queries/projectCache';
import { projectPageSnapshotQueryOptions } from '@/lib/queries/projects';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

export default function ProjectSnapshotPageClient({
  projectId,
  tab,
  mode,
}: {
  projectId: string;
  tab: string;
  mode: string;
}) {
  const queryClient = useQueryClient();
  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const placeholder = useMemo(
    () => getProjectSnapshotPlaceholderFromList(queryClient, hostKey, projectId),
    [hostKey, projectId, queryClient],
  );

  const snapshotQuery = useQuery({
    ...projectPageSnapshotQueryOptions(hostKey, projectId),
    placeholderData: placeholder,
  });

  const snapshot = snapshotQuery.data?.snapshot ?? null;
  const error =
    snapshotQuery.error instanceof Error ? snapshotQuery.error.message : snapshotQuery.error ? String(snapshotQuery.error) : null;

  if (!snapshot) {
    return (
      <main className={styles.page}>
        <section className={styles.surface}>
          <div className={styles.surfaceInner}>
            <h1 className={styles.title}>Project unavailable</h1>
            <p className={styles.subtitle}>
              {error || 'We could not load this project. It may have been deleted, or access is temporarily unavailable.'}
            </p>
            <Link href="/staff/projects" className={styles.backLink}>
              Back to Projects
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <ProjectHeader
        project={snapshot.project}
        currentStage={snapshot.pipeline.stage}
        pipeline={<ProjectPipelineBar projectId={snapshot.project.id} stage={snapshot.pipeline.stage} compact />}
      />
      <ProjectPageShell snapshot={snapshot} tab={tab} mode={mode} />
    </main>
  );
}
