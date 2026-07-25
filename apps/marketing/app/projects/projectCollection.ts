import type { Project } from '../../data/projects';

export type ProjectCollectionItem = Pick<
  Project,
  'heroImage' | 'location' | 'region' | 'roof' | 'slug' | 'title' | 'type'
>;

export function getProjectCollectionItems(
  projects: Project[],
): ProjectCollectionItem[] {
  return projects.map((project) => ({
    heroImage: project.heroImage,
    location: project.location,
    region: project.region,
    roof: project.roof,
    slug: project.slug,
    title: project.title,
    type: project.type,
  }));
}
