import { describe, expect, it } from 'vitest';
import { projects } from '../../data/projects';
import {
  getProjectCollectionItems,
  type ProjectCollectionItem,
} from './projectCollection';

describe('project collection payload', () => {
  it('keeps only card and filter fields in the collection boundary', () => {
    const [item] = getProjectCollectionItems(projects);

    expect(item).toEqual<ProjectCollectionItem>({
      heroImage: projects[0]!.heroImage,
      location: projects[0]!.location,
      region: projects[0]!.region,
      roof: projects[0]!.roof,
      slug: projects[0]!.slug,
      title: projects[0]!.title,
      type: projects[0]!.type,
    });
    expect(Object.keys(item!).sort()).toEqual([
      'heroImage',
      'location',
      'region',
      'roof',
      'slug',
      'title',
      'type',
    ]);
    expect(item).not.toHaveProperty('gallery');
    expect(item).not.toHaveProperty('description');
    expect(item).not.toHaveProperty('sections');
    expect(item).not.toHaveProperty('videoYoutubeId');
  });
});
