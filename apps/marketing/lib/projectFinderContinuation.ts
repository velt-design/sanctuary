import type { EnquiryContext } from './enquiryContext';
import {
  PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
  PROJECT_FINDER_HOME_PATH,
  isProjectDirection,
  normalizeProjectPriorities,
  type ProjectDirection,
  type ProjectPriority,
} from './projectFinderContract';

type SearchValue = string | string[] | undefined;

export type ProjectFinderJourneySearchParams = Record<string, SearchValue>;

export type ProjectFinderJourneyParamReader = {
  get(name: string): string | null;
  getAll?: (name: string) => string[];
};

export type ProjectFinderJourneyContext = {
  direction: ProjectDirection;
  priorities: ProjectPriority[];
  destination: string;
  summaryHeading: string;
  returnHref: string;
  enquiryContext: EnquiryContext;
};

export type ProjectFinderSelection = {
  direction: ProjectDirection;
  priorities: ProjectPriority[];
};

export type ProjectFinderProjectJourneyContext = ProjectFinderSelection & {
  sourceProject: string;
  enquiryContext: EnquiryContext;
};

export const projectFinderDestinationByDirection: Record<
  ProjectDirection,
  string
> = {
  cover: '/pergolas-auckland',
  'outdoor-room': '/outdoor-rooms-auckland',
  bespoke: '/custom-pergolas-auckland',
};

const briefOpeningByDirection: Record<ProjectDirection, string> = {
  cover: 'A refined deck cover designed to',
  'outdoor-room': 'A complete outdoor room designed to',
  bespoke: 'A bespoke pergola response designed to',
};

const defaultBriefByDirection: Record<ProjectDirection, string> = {
  cover: 'A refined deck cover, shaped to your home and site.',
  'outdoor-room': 'A complete outdoor room, shaped around how you want to live.',
  bespoke: 'A considered bespoke response for your site and wider project.',
};

const briefClauseByPriority: Record<ProjectPriority, string> = {
  daylight: 'preserve natural light',
  shade: 'provide calm, comfortable shade',
  'everyday-use': 'make the space work every day',
  entertaining: 'support cooking and entertaining',
  'open-structure': 'keep the structure visually open',
  coordination: 'coordinate cleanly with the wider project',
};

const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const projectFinderPriorityOrderByDirection: Record<
  ProjectDirection,
  readonly ProjectPriority[]
> = {
  cover: [
    'daylight',
    'shade',
    'everyday-use',
    'open-structure',
    'entertaining',
    'coordination',
  ],
  'outdoor-room': [
    'everyday-use',
    'entertaining',
    'daylight',
    'shade',
    'coordination',
    'open-structure',
  ],
  bespoke: [
    'open-structure',
    'coordination',
    'daylight',
    'everyday-use',
    'shade',
    'entertaining',
  ],
};

function joinClauses(clauses: readonly string[]): string {
  if (clauses.length === 1) return clauses[0];
  if (clauses.length === 2) return `${clauses[0]} and ${clauses[1]}`;
  return `${clauses.slice(0, -1).join(', ')}, and ${clauses.at(-1)}`;
}

function readSingle(
  params: ProjectFinderJourneyParamReader,
  key: string,
): string | null {
  const values = params.getAll?.(key);
  if (values && values.length !== 1) return null;
  return params.get(key);
}

function recordReader(
  params: ProjectFinderJourneySearchParams,
): ProjectFinderJourneyParamReader {
  return {
    get(key) {
      const value = params[key];
      return typeof value === 'string' ? value : null;
    },
    getAll(key) {
      const value = params[key];
      if (Array.isArray(value)) return value;
      return typeof value === 'string' ? [value] : [];
    },
  };
}

function buildSelectionParams(
  direction: ProjectDirection,
  priorities: readonly ProjectPriority[],
): URLSearchParams {
  const params = new URLSearchParams({ project: direction });
  const normalized = normalizeProjectPriorities(priorities);
  if (normalized.length) params.set('priorities', normalized.join(','));
  return params;
}

function readSelection(
  params: ProjectFinderJourneyParamReader,
  expectedDirection?: ProjectDirection,
): ProjectFinderSelection | null {
  const direction = readSingle(params, 'project')?.trim().toLowerCase();
  if (
    !isProjectDirection(direction)
    || (expectedDirection && direction !== expectedDirection)
  ) {
    return null;
  }

  const rawPriorities = readSingle(params, 'priorities');
  return {
    direction,
    priorities: rawPriorities
      ? normalizeProjectPriorities(rawPriorities.split(','))
      : [],
  };
}

export function buildProjectFinderBriefHeading(
  direction: ProjectDirection,
  priorities: readonly ProjectPriority[],
): string {
  const normalized = normalizeProjectPriorities(priorities);
  if (!normalized.length) return defaultBriefByDirection[direction];

  const ordered = projectFinderPriorityOrderByDirection[direction]
    .filter((priority) => normalized.includes(priority));

  return `${briefOpeningByDirection[direction]} ${joinClauses(
    ordered.map((priority) => briefClauseByPriority[priority]),
  )}.`;
}

export function buildProjectFinderDestinationHref(
  direction: ProjectDirection,
  priorities: readonly ProjectPriority[],
): string {
  return `${projectFinderDestinationByDirection[direction]}?${buildSelectionParams(
    direction,
    priorities,
  ).toString()}`;
}

export function buildProjectFinderProjectHref(
  direction: ProjectDirection,
  priorities: readonly ProjectPriority[],
  projectSlug: string,
): string {
  if (!PROJECT_SLUG_PATTERN.test(projectSlug)) {
    throw new Error(`Invalid project finder project slug: ${projectSlug}`);
  }
  const params = buildSelectionParams(direction, priorities);
  params.set('reference', projectSlug);
  return `/projects/${projectSlug}?${params.toString()}`;
}

export function resolveProjectFinderJourneyContextFromReader(
  expectedDirection: ProjectDirection,
  params: ProjectFinderJourneyParamReader,
): ProjectFinderJourneyContext | null {
  const selectionContext = readSelection(params, expectedDirection);
  if (!selectionContext) return null;
  const { direction, priorities } = selectionContext;
  const selection = buildSelectionParams(direction, priorities).toString();
  const destination = projectFinderDestinationByDirection[direction];

  return {
    direction,
    priorities,
    destination,
    summaryHeading: buildProjectFinderBriefHeading(direction, priorities),
    returnHref: `${PROJECT_FINDER_HOME_PATH}?${selection}`,
    enquiryContext: {
      enquiryType: 'residential',
      sourcePath: destination,
      sourceComponent: 'embedded_form',
      sourceExperience: PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
      projectDirection: direction,
      projectPriorities: priorities,
    },
  };
}

export function resolveProjectFinderProjectJourneyContextFromReader(
  expectedProjectSlug: string,
  params: ProjectFinderJourneyParamReader,
): ProjectFinderProjectJourneyContext | null {
  if (!PROJECT_SLUG_PATTERN.test(expectedProjectSlug)) return null;
  const sourceProject = readSingle(params, 'reference')?.trim().toLowerCase();
  if (sourceProject !== expectedProjectSlug) return null;

  const selectionContext = readSelection(params);
  if (!selectionContext) return null;
  const { direction, priorities } = selectionContext;
  const sourcePath = `/projects/${sourceProject}`;

  return {
    direction,
    priorities,
    sourceProject,
    enquiryContext: {
      sourcePath,
      sourceComponent: 'project_cta',
      sourceProject,
      sourceExperience: PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
      projectDirection: direction,
      projectPriorities: priorities,
    },
  };
}

export function resolveProjectFinderJourneyContext(
  expectedDirection: ProjectDirection,
  params: ProjectFinderJourneySearchParams,
): ProjectFinderJourneyContext | null {
  return resolveProjectFinderJourneyContextFromReader(
    expectedDirection,
    recordReader(params),
  );
}

export function resolveProjectFinderProjectJourneyContext(
  expectedProjectSlug: string,
  params: ProjectFinderJourneySearchParams,
): ProjectFinderProjectJourneyContext | null {
  return resolveProjectFinderProjectJourneyContextFromReader(
    expectedProjectSlug,
    recordReader(params),
  );
}
