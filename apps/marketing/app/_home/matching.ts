import type { Project } from '../../data/projects';
import {
  buildEnquiryHref,
  type EnquiryAudience,
} from '../../lib/enquiryContext';

export const HOME_PATH = '/';
export const HOME_VARIANT = 'design_conversation_home_v2';
export const HOME_INTENT_STORAGE_KEY =
  'sanctuary:homepage-design-conversation:intent';

export const projectIntentValues = [
  'home-cover',
  'outdoor-room',
  'commercial-professional',
] as const;

export type ProjectIntent = (typeof projectIntentValues)[number];

type ProjectMatchConfig = {
  slug: string;
  rationale: string;
  imageIndex?: number;
};

type IntentConfig = {
  value: ProjectIntent;
  label: string;
  summaryLabel: string;
  statement: string;
  enquiryType?: EnquiryAudience;
  matches: readonly [ProjectMatchConfig, ProjectMatchConfig];
};

type ProjectResponse = {
  slug: string;
  title: string;
  location: string;
  type: Project['type'];
  roof: Project['roof'];
  image: Project['heroImage'];
  rationale: string;
  projectHref: string;
  enquiryHref: string;
};

export type IntentResponse = {
  value: ProjectIntent;
  label: string;
  summaryLabel: string;
  statement: string;
  enquiryType?: EnquiryAudience;
  generalEnquiryHref: string;
  projects: [ProjectResponse, ProjectResponse];
};

const intentConfigs: readonly IntentConfig[] = [
  {
    value: 'home-cover',
    label: 'Cover an outdoor area at home',
    summaryLabel: 'A covered area at home',
    statement:
      'Start with how the cover should relate to the home, preserve light and make the existing outdoor area more usable.',
    enquiryType: 'residential',
    matches: [
      {
        slug: 'dairy-flat-estate',
        rationale:
          'An acrylic gable follows the existing roofline, with an infilled gable end and an open garden side.',
      },
      {
        slug: 'mt-maunganui-box',
        rationale:
          'A first-floor box-perimeter cover follows the deck geometry around the glass balustrade and outlook.',
      },
    ],
  },
  {
    value: 'outdoor-room',
    label: 'Create a complete outdoor room',
    summaryLabel: 'A complete outdoor room',
    statement:
      'A more complete room brings the roof, structure, ceiling, lighting and intended use into one coordinated design response.',
    enquiryType: 'residential',
    matches: [
      {
        slug: 'warkworth-outdoor-room',
        rationale:
          'A freestanding gable combines shelter, cedar lining, lighting, glazing and a fireplace within one resolved garden room.',
        imageIndex: 0,
      },
      {
        slug: 'riverhead-gable-pavilion',
        rationale:
          'A poolside pavilion uses an insulated roof, timber sarking and integrated lighting without closing off the outlook.',
        imageIndex: 1,
      },
    ],
  },
  {
    value: 'commercial-professional',
    label: 'Plan a commercial or architect-led project',
    summaryLabel: 'A commercial or architect-led project',
    statement:
      'Built precedents can clarify how Sanctuary coordinates architectural intent, structure, operations and installation responsibilities.',
    matches: [
      {
        slug: 'goodhome-commercial-terrace',
        rationale:
          'Two linked gables extend an established hospitality facade while coordinating shelter, screens, lighting and day-to-day use.',
      },
      {
        slug: 'kiwi-rail-platform',
        rationale:
          'An architect-led aluminium and acrylic canopy coordinates a long workplace route, integrated lighting and installation within a wider project team.',
      },
    ],
  },
];

export function isProjectIntent(value: unknown): value is ProjectIntent {
  return typeof value === 'string'
    && projectIntentValues.some((intent) => intent === value);
}

function resolveConfiguredProject(
  catalogue: readonly Project[],
  match: ProjectMatchConfig,
  usedSlugs: Set<string>,
): Project {
  const configured = catalogue.find((project) => (
    project.slug === match.slug && !usedSlugs.has(project.slug)
  ));
  if (configured) return configured;

  throw new Error(`Missing governed homepage project: ${match.slug}`);
}

function projectEnquiryType(project: Project): EnquiryAudience {
  return project.type === 'Commercial' ? 'commercial' : 'residential';
}

function toProjectResponse(
  project: Project,
  match: ProjectMatchConfig,
): ProjectResponse {
  const configuredImage = match.imageIndex === undefined
    ? undefined
    : project.gallery[match.imageIndex];

  return {
    slug: project.slug,
    title: project.title,
    location: project.location,
    type: project.type,
    roof: project.roof,
    image: configuredImage ?? project.heroImage,
    rationale: match.rationale,
    projectHref: `/projects/${project.slug}`,
    enquiryHref: buildEnquiryHref({
      enquiryType: projectEnquiryType(project),
      sourcePath: HOME_PATH,
      sourceComponent: 'project_cta',
      sourceProject: project.slug,
    }),
  };
}

export function getIntentResponses(
  catalogue: readonly Project[],
): IntentResponse[] {
  return intentConfigs.map((config) => {
    const usedSlugs = new Set<string>();
    const projects = config.matches.map((match) => {
      const project = resolveConfiguredProject(catalogue, match, usedSlugs);
      usedSlugs.add(project.slug);
      return toProjectResponse(project, match);
    }) as [ProjectResponse, ProjectResponse];

    return {
      value: config.value,
      label: config.label,
      summaryLabel: config.summaryLabel,
      statement: config.statement,
      ...(config.enquiryType ? { enquiryType: config.enquiryType } : {}),
      generalEnquiryHref: buildEnquiryHref({
        enquiryType: config.enquiryType,
        sourcePath: HOME_PATH,
        sourceComponent: 'pathway',
      }),
      projects,
    };
  });
}
