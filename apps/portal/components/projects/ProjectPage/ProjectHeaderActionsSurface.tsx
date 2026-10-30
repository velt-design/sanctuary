'use client';
import type { ReactNode } from 'react';
import StudioProjectLink from '@/components/designStudio/StudioProjectLink';
import ProjectsIndexLink from '@/components/navigation/ProjectsIndexLink';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import styles from './ProjectPage.module.css';
export default function ProjectHeaderActionsSurface({ privateContentReady = true, privateActions, ...props }: {
  project: ProjectPageSnapshot['project'] | null; projectId?: string; disabled?: boolean; privateContentReady?: boolean; privateActions?: ReactNode;
}) {
  const projectId = props.projectId ?? props.project?.id ?? '';
  const disabled = !privateContentReady || props.disabled || !props.project;
  return <div className={styles.mastheadActions}>
    <ProjectsIndexLink href="/staff/projects" variant="secondary" size="small">Projects</ProjectsIndexLink>
    <StudioProjectLink projectId={projectId} disabled={disabled} />
    {process.env.NEXT_PUBLIC_INSTALLER_PAYOUT_ENABLED === 'true' ? <ButtonLink
      href={`/staff/projects/${encodeURIComponent(projectId)}/installer-payout`} disabled={disabled} size="small" variant="secondary">Installer payout</ButtonLink> : null}
    {privateContentReady ? privateActions : null}
  </div>;
}
