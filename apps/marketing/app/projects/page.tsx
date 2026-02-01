import type { Metadata } from 'next';
import { projects } from '@/data/projects';
import ProjectsExperience from './ProjectsExperience';

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Built pergolas across Auckland and beyond. Explore finished work with pitched, gable, hip and box-perimeter styles, screens and lighting.',
  alternates: { canonical: '/projects' },
  openGraph: {
    url: '/projects',
    title: 'Projects – Sanctuary Pergolas',
    description:
      'Explore real pergola projects: pitched, gable, hip and box-perimeter, with screens, blinds and lighting.',
  },
};

export default function ProjectsPage() {
  return <ProjectsExperience projects={projects} />;
}
