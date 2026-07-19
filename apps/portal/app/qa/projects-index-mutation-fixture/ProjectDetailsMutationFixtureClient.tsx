'use client';

import { useEffect, useState, type ReactNode } from 'react';
import ProjectDetailsSidebarClient from '@/components/projects/ProjectPage/ProjectDetailsSidebar.client';
import LocalFirstPortalMutations from '@/components/sync/LocalFirstPortalMutations';
import { startLocalFirstRuntime, stopLocalFirstRuntime } from '@/lib/localFirst/runtime';
import { discardAllLocalFirstState } from '@/lib/localFirst/store';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import styles from './projectsIndexMutationFixture.module.css';

const FIXTURE_OWNER_ID = 'qa-project-mutation-fixture';
const FIXTURE_PROJECT: ProjectPageSnapshot['project'] = {
  id: 'fixture-project',
  name: 'Fixture Detail Project',
  stage: 'new',
  contactId: 'fixture-contact',
  contactName: 'Fixture Contact',
  contactEmail: 'fixture@example.invalid',
  contactPhone: '000 000 0000',
  siteAddress: '1 Fixture Lane',
  region: 'Fixture Region',
  quoteRef: 'FIXTURE-1',
  nextActionDate: '2026-07-20',
};

function FixtureLocalFirstBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      await startLocalFirstRuntime(FIXTURE_OWNER_ID);
      await discardAllLocalFirstState();
      if (active) setReady(true);
    })();

    return () => {
      active = false;
      stopLocalFirstRuntime({ clearOwner: true });
    };
  }, []);

  if (!ready) return <p role="status">Preparing local save fixture…</p>;

  return (
    <>
      <LocalFirstPortalMutations />
      {children}
    </>
  );
}

export default function ProjectDetailsMutationFixtureClient() {
  return (
    <section className={styles.card} data-project-details-mutation-fixture="ready">
      <p className={styles.eyebrow}>Local-first detail check</p>
      <h2 className={styles.heading}>Project details in the background</h2>
      <p className={styles.explanation}>
        This sample mounts the production user-owned queue, retry state, and project-details editor.
      </p>
      <FixtureLocalFirstBoundary>
        <ProjectDetailsSidebarClient project={FIXTURE_PROJECT} />
      </FixtureLocalFirstBoundary>
    </section>
  );
}
