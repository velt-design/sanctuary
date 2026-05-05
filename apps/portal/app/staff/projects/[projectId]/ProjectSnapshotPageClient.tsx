'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ProjectPageFrame from '@/components/projects/ProjectPage/ProjectPageFrame';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import type { ProjectPageSnapshot, ProjectPageSnapshotResponse } from '@/lib/projects/types';
import { projectPageSnapshotQueryOptions } from '@/lib/queries/projects';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

export default function ProjectSnapshotPageClient({
  projectId,
  tab,
  initialSnapshot,
}: {
  projectId: string;
  tab: string;
  initialSnapshot: ProjectPageSnapshot;
}) {
  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const initialData = useMemo<ProjectPageSnapshotResponse>(
    () => ({ snapshot: initialSnapshot, generatedAt: new Date().toISOString() }),
    [initialSnapshot],
  );

  const { data } = useQuery({
    ...projectPageSnapshotQueryOptions(host, projectId),
    initialData,
  });

  const snapshot = data?.snapshot ?? initialSnapshot;

  return (
    <main className={styles.page} data-project-id={projectId}>
      <ProjectPageFrame snapshot={snapshot} tab={tab} />
    </main>
  );
}
