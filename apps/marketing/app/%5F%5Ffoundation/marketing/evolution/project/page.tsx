import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { projects } from '@/data/projects';
import { buildEnquiryHref } from '@/lib/enquiryContext';
import { shouldShowMarketingFoundation } from '../../foundationAccess';
import ProjectReference from '../ProjectReference';
import ReferenceShell from '../ReferenceShell';
import { PROJECT_REFERENCE } from '../referencePaths';

export const metadata: Metadata = { title: 'Warkworth — foundation reference', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function ProjectReferencePage() {
  if (!shouldShowMarketingFoundation({ nodeEnv: process.env.NODE_ENV, enabled: process.env.ENABLE_MARKETING_FOUNDATION })) notFound();
  const project = projects.find(item => item.slug === 'warkworth-outdoor-room');
  if (!project) notFound();
  const enquiryHref = buildEnquiryHref({ enquiryType: 'residential', sourcePath: PROJECT_REFERENCE, sourceComponent: 'project_cta', sourceProject: project.slug });
  return <ReferenceShell page="project" enquiryHref={enquiryHref}><ProjectReference project={project} enquiryHref={enquiryHref} /></ReferenceShell>;
}
