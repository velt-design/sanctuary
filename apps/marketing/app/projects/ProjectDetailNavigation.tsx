'use client';

import Link from 'next/link';
import ArrowUpRight from '@/components/marketing-foundation/ArrowUpRight';
import { useEffect, useState, type MouseEvent } from 'react';
import { Container, Figure } from '@/components/marketing-foundation';
import type { ProjectCollectionItem } from './projectCollection';
import { readCollectionReturn } from './projectCollectionReturn';
import styles from './projectNavigation.module.css';

type Props = {
  previousProject: ProjectCollectionItem;
  nextProject: ProjectCollectionItem;
  buildProjectHref: (slug: string) => string;
  onProjectIntent: (slug: string) => void;
  onProjectSelect: (slug: string, event: MouseEvent<HTMLAnchorElement>) => void;
  pendingProjectSlug: string | null;
  photographic?: boolean;
};

export default function ProjectDetailNavigation({ previousProject, nextProject, buildProjectHref, onProjectIntent, onProjectSelect, pendingProjectSlug, photographic = false }: Props) {
  const [collectionHref, setCollectionHref] = useState('/projects');
  useEffect(() => { setCollectionHref(readCollectionReturn()?.href ?? '/projects'); }, []);
  const linkProps = (project: ProjectCollectionItem) => ({
    href: buildProjectHref(project.slug),
    'aria-busy': pendingProjectSlug === project.slug || undefined,
    'data-project-detail-switch': 'true',
    onFocus: () => onProjectIntent(project.slug),
    onPointerEnter: () => onProjectIntent(project.slug),
    onClick: (event: MouseEvent<HTMLAnchorElement>) => onProjectSelect(project.slug, event),
  });
  if (photographic) return <section className={styles.nextSection} aria-label="Next project" data-next-project>
    <Container width="wide"><Link {...linkProps(nextProject)} className={styles.photoLink} aria-label={`Next project: ${nextProject.title}`}>
      <div className={styles.nextHeading}><div><span>Next project</span><h2>{nextProject.title}</h2></div><span aria-hidden="true"><ArrowUpRight /></span></div>
      <Figure image={nextProject.heroImage.src} alt={nextProject.heroImage.alt} objectPosition={nextProject.heroImage.objectPosition} ratio="wide" mobileRatio="standard" sizes="(max-width:1440px) 100vw,1440px" />
    </Link></Container>
  </section>;
  return <Container width="wide"><nav className={styles.navigation} aria-label="Project navigation">
    <Link href={collectionHref} className={styles.all} data-all-projects>← All projects</Link>
    <div className={styles.steps}>
      <Link {...linkProps(previousProject)} data-project-previous aria-label={`Previous project: ${previousProject.title}`} title={previousProject.title}><span className={styles.directionIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m14 6-6 6 6 6M8 12h13" /></svg></span><span className={styles.directionText}>← Previous</span><strong>{previousProject.title}</strong></Link>
      <Link {...linkProps(nextProject)} data-project-next aria-label={`Next project: ${nextProject.title}`} title={nextProject.title}><span className={styles.directionIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m10 6 6 6-6 6M3 12h13" /></svg></span><span className={styles.directionText}>Next →</span><strong>{nextProject.title}</strong></Link>
    </div>
  </nav></Container>;
}
