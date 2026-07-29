import type { Project } from '../../data/projects';
import {
  buildEnquiryHref,
  type EnquiryAudience,
} from '../../lib/enquiryContext';

export const HOME_PATH = '/';
export const HOME_VARIANT = 'design_conversation_home_v3';
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
    label: 'Cover a deck',
    summaryLabel: 'Deck cover',
    statement:
      'Start with the house connection, daylight and how the deck should work.',
    enquiryType: 'residential',
    matches: [
      {
        slug: 'dairy-flat-estate',
        rationale:
          'An acrylic gable follows the roofline with one infilled end.',
      },
      {
        slug: 'mt-maunganui-box',
        rationale:
          'A box-perimeter cover follows the first-floor deck and outlook.',
      },
    ],
  },
  {
    value: 'outdoor-room',
    label: 'Create an outdoor room',
    summaryLabel: 'Outdoor room',
    statement:
      'Coordinate the roof, structure, ceiling, lighting and intended use.',
    enquiryType: 'residential',
    matches: [
      {
        slug: 'warkworth-outdoor-room',
        rationale:
          'A freestanding gable combines mixed roofing, cedar lining, lighting and a fireplace.',
        imageIndex: 0,
      },
      {
        slug: 'riverhead-gable-pavilion',
        rationale:
          'A poolside gable uses a timber-lined roof and integrated lighting.',
        imageIndex: 1,
      },
    ],
  },
  {
    value: 'commercial-professional',
    label: 'Commercial or professional project',
    summaryLabel: 'Commercial or professional project',
    statement:
      'See how Sanctuary coordinates design, operations and installation.',
    matches: [
      {
        slug: 'goodhome-commercial-terrace',
        rationale:
          'Two gables extend a hospitality facade over the courtyard.',
      },
      {
        slug: 'kiwi-rail-platform',
        rationale:
          'An architect-led canopy and lighting follow a workplace route.',
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
