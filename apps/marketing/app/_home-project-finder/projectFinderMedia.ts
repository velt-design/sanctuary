import type { Project } from '../../data/projects';
import {
  commercialProfessionalPathContent,
  residentialProjectResultContent,
} from './projectFinderContent';
import type {
  CommercialProfessionalPath,
  ProjectFinderHomeDirection,
  ResidentialProjectFinderHomeDirection,
} from '@/lib/projectFinderContract';

type ProjectFinderMedia = {
  alt: string;
  location: string;
  mobileObjectPosition?: string;
  mobileSrc?: string;
  objectPosition?: string;
  projectSlug: string;
  projectTitle: string;
  src: string;
};

type ProjectFinderChoiceMedia = Pick<
  ProjectFinderMedia,
  'alt' | 'objectPosition' | 'src'
>;

export type ProjectEvidence = ProjectFinderMedia & {
  reason: string;
};

export type ProjectFinderHomepageMedia = {
  hero: ProjectFinderMedia;
  choiceByDirection: Record<
    ProjectFinderHomeDirection,
    ProjectFinderChoiceMedia
  >;
  choiceByProfessionalPath: Record<
    CommercialProfessionalPath,
    ProjectFinderMedia
  >;
  evidenceByDirection: Record<
    ResidentialProjectFinderHomeDirection,
    readonly ProjectEvidence[]
  >;
  evidenceByProfessionalPath: Record<
    CommercialProfessionalPath,
    readonly ProjectEvidence[]
  >;
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
  references: readonly ProjectReference[],
  reasonBySlug: Readonly<Record<string, string>>,
): ProjectEvidence[] {
  return references.map((reference) => {
    const media = resolveMedia(projects, reference);
    const reason = reasonBySlug[media.projectSlug];
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
    hero: {
      ...resolveMedia(projects, {
        projectSlug: 'warkworth-outdoor-room',
        galleryIndex: 0,
      }),
      mobileObjectPosition: '50% 50%',
      mobileSrc: '/images/warkworth-gable-02.jpg',
    },
    choiceByDirection: {
      cover: {
        alt: 'White pitched acrylic pergola covering a ground-level patio beside a weatherboard home',
        objectPosition: '50% 50%',
        src: '/images/simple-pergolas/pitched-01.webp',
      },
      bespoke: resolveMedia(projects, {
        projectSlug: 'mt-maunganui-box',
      }),
      'commercial-professional': resolveMedia(projects, {
        projectSlug: 'lilliput-mini-golf',
        galleryIndex: 1,
      }),
    },
    choiceByProfessionalPath: {
      venue: resolveMedia(projects, {
        projectSlug: 'goodhome-commercial-terrace',
        galleryIndex: 0,
      }),
      'builder-contractor': resolveMedia(projects, {
        projectSlug: 'lilliput-mini-golf',
      }),
      'architects-designers': resolveMedia(projects, {
        projectSlug: 'kiwi-rail-platform',
        galleryIndex: 0,
      }),
    },
    evidenceByDirection: {
      cover: evidence(
        projects,
        [
          { projectSlug: 'dairy-flat-estate' },
          { projectSlug: 'st-heliers-townhouse' },
        ],
        residentialProjectResultContent.cover.evidenceReasonBySlug,
      ),
      bespoke: evidence(
        projects,
        [
          { projectSlug: 'tindalls-bay-pavilion', galleryIndex: 0 },
          { projectSlug: 'warkworth-outdoor-room', galleryIndex: 0 },
        ],
        residentialProjectResultContent.bespoke.evidenceReasonBySlug,
      ),
    },
    evidenceByProfessionalPath: {
      venue: evidence(
        projects,
        [
          { projectSlug: 'goodhome-commercial-terrace', galleryIndex: 0 },
          { projectSlug: 'lilliput-mini-golf' },
        ],
        commercialProfessionalPathContent.venue.evidenceReasonBySlug,
      ),
      'builder-contractor': evidence(
        projects,
        [
          { projectSlug: 'lilliput-mini-golf' },
          { projectSlug: 'kiwi-rail-platform', galleryIndex: 0 },
        ],
        commercialProfessionalPathContent['builder-contractor']
          .evidenceReasonBySlug,
      ),
      'architects-designers': evidence(
        projects,
        [
          { projectSlug: 'kiwi-rail-platform', galleryIndex: 0 },
          { projectSlug: 'goodhome-commercial-terrace', galleryIndex: 0 },
        ],
        commercialProfessionalPathContent['architects-designers']
          .evidenceReasonBySlug,
      ),
    },
  };
}
