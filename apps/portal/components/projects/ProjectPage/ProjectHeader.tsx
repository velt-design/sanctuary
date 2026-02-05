import Link from 'next/link';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import legacy from '@/app/staff/projects/projects.module.css';

export default function ProjectHeader({ project }: { project: ProjectPageSnapshot['project'] }) {
  const subtext = [project.contactName, project.region].filter(Boolean).join(' · ');

  return (
    <header className={legacy.header}>
      <div>
        <h1 className={legacy.title}>{project.name}</h1>
        {subtext ? <p className={legacy.subtitle}>{subtext}</p> : null}
      </div>
      <div className={legacy.actions}>
        <Link href="/staff/projects" className={legacy.buttonSecondary}>
          Projects
        </Link>
      </div>
    </header>
  );
}
