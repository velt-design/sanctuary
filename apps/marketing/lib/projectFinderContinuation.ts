import type { EnquiryContext } from './enquiryContext';
import {
  PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
  PROJECT_FINDER_HOME_PATH,
  isCommercialProfessionalPath,
  isProjectFinderHomeDirection,
  isResidentialProjectDirection,
  normalizeProjectPriorities,
  type CommercialProfessionalPath,
  type ProjectFinderHomeDirection,
  type ProjectPriority,
  type ResidentialProjectDirection,
} from './projectFinderContract';

type SearchValue = string | string[] | undefined;

export type ProjectFinderJourneySearchParams = Record<string, SearchValue>;

export type ProjectFinderJourneyParamReader = {
  get(name: string): string | null;
  getAll?: (name: string) => string[];
};

export type ProjectFinderJourneyContext = {
  direction: ResidentialProjectDirection;
  priorities: ProjectPriority[];
  destination: string;
  summaryHeading: string;
  returnHref: string;
  enquiryContext: EnquiryContext;
};

export type ProjectFinderSelection = {
  direction: ResidentialProjectDirection;
  priorities: ProjectPriority[];
};

export type ProjectFinderHomeSelection = {
  direction: ProjectFinderHomeDirection;
  priorities: ProjectPriority[];
  professionalPath?: CommercialProfessionalPath;
};

export type ProjectFinderProjectJourneyContext = ProjectFinderSelection & {
  sourceProject: string;
  enquiryContext: EnquiryContext;
};

export const projectFinderDestinationByDirection: Record<
  ResidentialProjectDirection,
  string
> = {
  cover: '/pergolas-auckland',
  'outdoor-room': '/outdoor-rooms-auckland',
  bespoke: '/custom-pergolas-auckland',
};

const briefOpeningByDirection: Record<ResidentialProjectDirection, string> = {
  cover: 'A simple cover designed to',
  'outdoor-room': 'A complete outdoor room designed to',
  bespoke: 'A custom pergola design developed to',
};

const defaultBriefByDirection: Record<ResidentialProjectDirection, string> = {
  cover: 'A simple cover, shaped to your home and site.',
  'outdoor-room': 'A complete outdoor room, shaped around how you want to live.',
  bespoke: 'A custom pergola design, shaped around your site and wider project.',
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
  ResidentialProjectDirection,
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
  direction: ResidentialProjectDirection,
  priorities: readonly ProjectPriority[],
): URLSearchParams {
  const params = new URLSearchParams({ project: direction });
  const normalized = normalizeProjectPriorities(priorities);
  if (normalized.length) params.set('priorities', normalized.join(','));
  return params;
}

function readProjectFinderHomeSelection(
  params: ProjectFinderJourneyParamReader,
): ProjectFinderHomeSelection | null {
  const direction = readSingle(params, 'project')?.trim().toLowerCase();
  if (!isProjectFinderHomeDirection(direction)) return null;

  if (direction === 'commercial-professional') {
    const professionalPath = readSingle(params, 'professional_path')
      ?.trim()
      .toLowerCase();
    return {
      direction,
      priorities: [],
      ...(isCommercialProfessionalPath(professionalPath)
        ? { professionalPath }
        : {}),
    };
  }

  const rawPriorities = readSingle(params, 'priorities');
  return {
    direction,
    priorities: rawPriorities
      ? normalizeProjectPriorities(rawPriorities.split(','))
      : [],
  };
}

function buildProjectFinderHomeSelectionParams(
  selection: ProjectFinderHomeSelection,
): URLSearchParams {
  const params = new URLSearchParams({ project: selection.direction });
  if (
    selection.direction === 'commercial-professional'
    && selection.professionalPath
  ) {
    params.set('professional_path', selection.professionalPath);
  } else if (selection.priorities.length) {
    params.set(
      'priorities',
      normalizeProjectPriorities(selection.priorities).join(','),
    );
  }
  return params;
}

export function resolveProjectFinderHomeDestination(
  selection: ProjectFinderHomeSelection,
): string {
  if (selection.direction === 'cover') {
    return '/acrylic-roof-pergolas-auckland';
  }
  if (selection.direction === 'bespoke') {
    return '/custom-pergolas-auckland';
  }
  return selection.professionalPath === 'venue'
    ? '/commercial-pergolas-auckland'
    : '/architects-designers-builders';
}

export function buildProjectFinderHomeDestinationHref(
  selection: ProjectFinderHomeSelection,
): string {
  const destination = resolveProjectFinderHomeDestination(selection);
  const params = buildProjectFinderHomeSelectionParams(selection);
  return `${destination}?${params.toString()}`;
}

export function resolveProjectFinderHomeSelectionFromReader(
  params: ProjectFinderJourneyParamReader,
): ProjectFinderHomeSelection | null {
  return readProjectFinderHomeSelection(params);
}

export function resolveProjectFinderHomeEnquiryContextFromReader(
  params: ProjectFinderJourneyParamReader,
): EnquiryContext | null {
  const selection = readProjectFinderHomeSelection(params);
  if (!selection) return null;
  const isCommercialProfessional =
    selection.direction === 'commercial-professional';
  const enquiryType = isCommercialProfessional
    ? (selection.professionalPath && selection.professionalPath !== 'venue'
      ? 'professional'
      : 'commercial')
    : 'residential';

  return {
    enquiryType,
    sourcePath: PROJECT_FINDER_HOME_PATH,
    sourceComponent: 'header',
    sourceExperience: PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE,
    projectDirection: selection.direction,
    ...(selection.professionalPath
      ? { projectProfessionalPath: selection.professionalPath }
      : {}),
    ...(selection.priorities.length
      ? { projectPriorities: selection.priorities }
      : {}),
  };
}

function readSelection(
  params: ProjectFinderJourneyParamReader,
  expectedDirection?: ResidentialProjectDirection,
): ProjectFinderSelection | null {
  const direction = readSingle(params, 'project')?.trim().toLowerCase();
  if (
    !isResidentialProjectDirection(direction)
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
  direction: ResidentialProjectDirection,
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
  direction: ResidentialProjectDirection,
  priorities: readonly ProjectPriority[],
): string {
  return `${projectFinderDestinationByDirection[direction]}?${buildSelectionParams(
    direction,
    priorities,
  ).toString()}`;
}

export function buildProjectFinderProjectHref(
  direction: ResidentialProjectDirection,
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
  expectedDirection: ResidentialProjectDirection,
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
  expectedDirection: ResidentialProjectDirection,
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
