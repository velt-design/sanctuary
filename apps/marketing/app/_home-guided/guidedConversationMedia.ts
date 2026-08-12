import type { Project } from '../../data/projects';
import type {
  GuidedAnswerValue,
  GuidedBusinessSector,
  GuidedConversationState,
  GuidedResultId,
} from './guidedConversationModel';

export type GuidedMedia = {
  alt: string;
  location: string;
  objectPosition?: string;
  projectSlug: string;
  projectTitle: string;
  src: string;
};

export type GuidedHomepageMedia = {
  hero: GuidedMedia;
  optionByAnswer: Partial<Record<GuidedAnswerValue, GuidedMedia>>;
  resultById: Record<GuidedResultId, GuidedMedia>;
  commercialResultBySector: Record<GuidedBusinessSector, GuidedMedia>;
};

type ProjectImageReference = {
  galleryIndex?: number;
  projectSlug: string;
};

function resolveMedia(
  projects: readonly Project[],
  reference: ProjectImageReference,
): GuidedMedia {
  const project = projects.find(({ slug }) => slug === reference.projectSlug);
  if (!project) {
    throw new Error(`Missing guided homepage project: ${reference.projectSlug}`);
  }

  const image = reference.galleryIndex === undefined
    ? project.heroImage
    : project.gallery[reference.galleryIndex];
  if (!image) {
    throw new Error(
      `Missing guided homepage image: ${reference.projectSlug} gallery ${reference.galleryIndex}`,
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

export function buildGuidedHomepageMedia(
  projects: readonly Project[],
): GuidedHomepageMedia {
  const media = (reference: ProjectImageReference) => (
    resolveMedia(projects, reference)
  );

  const hospitality = media({
    projectSlug: 'goodhome-commercial-terrace',
    galleryIndex: 0,
  });
  const workplace = media({ projectSlug: 'kiwi-rail-platform' });
  const recreation = media({
    projectSlug: 'lilliput-mini-golf',
    galleryIndex: 2,
  });

  return {
    hero: media({
      projectSlug: 'warkworth-outdoor-room',
      galleryIndex: 0,
    }),
    optionByAnswer: {
      'straightforward-cover': media({ projectSlug: 'dairy-flat-estate' }),
      'outdoor-room': media({ projectSlug: 'warkworth-outdoor-room' }),
      'difficult-site': media({ projectSlug: 'tindalls-bay-pavilion' }),
      hospitality,
      workplace,
      recreation,
    },
    resultById: {
      'residential-cover': media({ projectSlug: 'dairy-flat-estate' }),
      'outdoor-room': media({
        projectSlug: 'riverhead-gable-pavilion',
        galleryIndex: 1,
      }),
      bespoke: media({
        projectSlug: 'tindalls-bay-pavilion',
        galleryIndex: 0,
      }),
      commercial: hospitality,
      professional: media({
        projectSlug: 'kiwi-rail-platform',
        galleryIndex: 0,
      }),
    },
    commercialResultBySector: {
      hospitality,
      workplace,
      recreation,
    },
  };
}

export function getGuidedResultMedia(
  media: GuidedHomepageMedia,
  resultId: GuidedResultId,
  state: GuidedConversationState,
): GuidedMedia {
  if (resultId === 'commercial' && state.sector) {
    return media.commercialResultBySector[state.sector];
  }
  return media.resultById[resultId];
}
