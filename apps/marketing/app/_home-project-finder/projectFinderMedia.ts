import type { Project } from '../../data/projects';
import { projectDirectionContent } from './projectFinderContent';
import type { ProjectDirection } from '@/lib/projectFinderContract';

type ProjectFinderMedia = {
  alt: string;
  location: string;
  objectPosition?: string;
  projectSlug: string;
  projectTitle: string;
  src: string;
};

type ProjectEvidence = ProjectFinderMedia & {
  reason: string;
};

export type ProjectFinderHomepageMedia = {
  hero: ProjectFinderMedia;
  choiceByDirection: Record<ProjectDirection, ProjectFinderMedia>;
  evidenceByDirection: Record<ProjectDirection, readonly ProjectEvidence[]>;
};

type ProjectReference = {
  galleryIndex?: number;
  projectSlug: string;
};

function resolveMedia(
  projects: readonly Project[],
  reference: ProjectReference,
): ProjectFinderMedia {
  const project = projects.find(({ slug }) => slug === reference.projectSlug);
  if (!project) {
    throw new Error(`Missing project finder project: ${reference.projectSlug}`);
  }
  const image = reference.galleryIndex === undefined
    ? project.heroImage
    : project.gallery[reference.galleryIndex];
  if (!image) {
    throw new Error(
      `Missing project finder image: ${reference.projectSlug} gallery ${reference.galleryIndex}`,
    );
  }
  return {
    alt: image.alt,
    location: project.location,
    objectPosition: image.objectPosition,
    projectSlug: project.slug,
    projectTitle: project.title,
    src: image.src,
  };
}

function evidence(
  projects: readonly Project[],
  direction: ProjectDirection,
  references: readonly ProjectReference[],
): ProjectEvidence[] {
  return references.map((reference) => {
    const media = resolveMedia(projects, reference);
    const reason = projectDirectionContent[direction]
      .evidenceReasonBySlug[media.projectSlug];
    if (!reason) {
      throw new Error(`Missing project finder rationale: ${media.projectSlug}`);
    }
    return { ...media, reason };
  });
}

export function buildProjectFinderHomepageMedia(
  projects: readonly Project[],
): ProjectFinderHomepageMedia {
  return {
    hero: resolveMedia(projects, {
      projectSlug: 'warkworth-outdoor-room',
      galleryIndex: 0,
    }),
    choiceByDirection: {
      cover: resolveMedia(projects, { projectSlug: 'dairy-flat-estate' }),
      'outdoor-room': resolveMedia(projects, {
        projectSlug: 'warkworth-outdoor-room',
      }),
      bespoke: resolveMedia(projects, {
        projectSlug: 'tindalls-bay-pavilion',
      }),
    },
    evidenceByDirection: {
      cover: evidence(projects, 'cover', [
        { projectSlug: 'dairy-flat-estate' },
        { projectSlug: 'st-heliers-townhouse' },
      ]),
      'outdoor-room': evidence(projects, 'outdoor-room', [
        { projectSlug: 'warkworth-outdoor-room', galleryIndex: 0 },
        { projectSlug: 'riverhead-gable-pavilion' },
      ]),
      bespoke: evidence(projects, 'bespoke', [
        { projectSlug: 'tindalls-bay-pavilion', galleryIndex: 0 },
        { projectSlug: 'ardmore-box-carport' },
      ]),
    },
  };
}
