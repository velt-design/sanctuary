'use client';

import type { ComponentProps } from 'react';
import ProjectMainTabs from './ProjectMainTabsSurface';
import styles from './ProjectPage.module.css';

/** Presentation only; defaults and body visibility belong to the tab surface. */
export default function ProjectPageShellSurface(props: ComponentProps<typeof ProjectMainTabs>) {
  return (
    <section className={styles.fullWidthShell} data-project-page-shell="true">
      <ProjectMainTabs {...props} />
    </section>
  );
}
