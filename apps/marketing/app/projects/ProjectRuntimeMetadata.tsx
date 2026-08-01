'use client';

import { useEffect } from 'react';
import type { Project } from '@/data/projects';
import { absoluteUrl } from '@/lib/seo';
import {
  getProjectCaseStudyHero,
  getProjectPageTitle,
  getProjectRoute,
} from './projectSeo';

type ProjectRuntimeMetadataProps = {
  project: Project;
};

function setMetaContent(selector: string, content: string) {
  document.head.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', content);
}

export default function ProjectRuntimeMetadata({
  project,
}: ProjectRuntimeMetadataProps) {
  useEffect(() => {
    const title = getProjectPageTitle(project);
    const route = getProjectRoute(project);
    const absoluteRoute = absoluteUrl(route);
    const hero = getProjectCaseStudyHero(project);

    document.title = title;
    document.head
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.setAttribute('href', absoluteRoute);
    setMetaContent('meta[name="description"]', project.blurb);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', project.blurb);
    setMetaContent('meta[property="og:url"]', absoluteRoute);
    setMetaContent('meta[property="og:image"]', absoluteUrl(hero.src));
    setMetaContent('meta[property="og:image:alt"]', hero.alt);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', project.blurb);
    setMetaContent('meta[name="twitter:image"]', absoluteUrl(hero.src));
  }, [project]);

  return null;
}
