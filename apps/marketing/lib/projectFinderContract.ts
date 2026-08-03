export const PROJECT_FINDER_HOME_PATH = '/';
export const PROJECT_FINDER_HOME_VARIANT = 'project_finder_home_v2';
export const PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE =
  'project-finder-home-v1';
export const PROJECT_FINDER_STATE_EVENT = 'projectfinderstatechange';

export const residentialProjectDirections = [
  'cover',
  'outdoor-room',
  'bespoke',
] as const;

const projectDirections = [
  ...residentialProjectDirections,
  'commercial-professional',
] as const;

export const projectFinderHomeDirections = [
  'cover',
  'bespoke',
  'commercial-professional',
] as const;

export const commercialProfessionalPaths = [
  'venue',
  'builder-contractor',
  'architects-designers',
] as const;

export const projectPriorities = [
  'daylight',
  'shade',
  'everyday-use',
  'entertaining',
  'open-structure',
  'coordination',
] as const;

export type ProjectDirection = (typeof projectDirections)[number];
export type ResidentialProjectDirection =
  (typeof residentialProjectDirections)[number];
export type ProjectFinderHomeDirection =
  (typeof projectFinderHomeDirections)[number];
export type ResidentialProjectFinderHomeDirection = Exclude<
  ProjectFinderHomeDirection,
  'commercial-professional'
>;
export type CommercialProfessionalPath =
  (typeof commercialProfessionalPaths)[number];
export type ProjectPriority = (typeof projectPriorities)[number];

export const projectDirectionLabels: Record<ProjectDirection, string> = {
  cover: 'Simple cover',
  'outdoor-room': 'A complete outdoor room',
  bespoke: 'Custom design',
  'commercial-professional': 'Commercial / Professional',
};

export const commercialProfessionalPathLabels: Record<
  CommercialProfessionalPath,
  string
> = {
  venue: 'Extending a Venue',
  'builder-contractor': 'Builder or Contractor',
  'architects-designers': 'Architects and Designers',
};

export const projectPriorityLabels: Record<ProjectPriority, string> = {
  daylight: 'Keep natural light',
  shade: 'Create more shade and comfort',
  'everyday-use': 'Use the space more often',
  entertaining: 'Plan for cooking or entertaining',
  'open-structure': 'Keep the structure open',
  coordination: 'Coordinate with a wider project',
};

export function isProjectDirection(
  value: string | null | undefined,
): value is ProjectDirection {
  return Boolean(
    value && (projectDirections as readonly string[]).includes(value),
  );
}

export function isResidentialProjectDirection(
  value: string | null | undefined,
): value is ResidentialProjectDirection {
  return Boolean(
    value
      && (residentialProjectDirections as readonly string[]).includes(value),
  );
}

export function isProjectFinderHomeDirection(
  value: string | null | undefined,
): value is ProjectFinderHomeDirection {
  return Boolean(
    value
      && (projectFinderHomeDirections as readonly string[]).includes(value),
  );
}

export function isCommercialProfessionalPath(
  value: string | null | undefined,
): value is CommercialProfessionalPath {
  return Boolean(
    value
      && (commercialProfessionalPaths as readonly string[]).includes(value),
  );
}

function isProjectPriority(
  value: string | null | undefined,
): value is ProjectPriority {
  return Boolean(
    value && (projectPriorities as readonly string[]).includes(value),
  );
}

export function normalizeProjectPriorities(
  values: Iterable<string>,
): ProjectPriority[] {
  const selected = new Set<ProjectPriority>();
  for (const rawValue of values) {
    const value = rawValue.trim().toLowerCase();
    if (isProjectPriority(value)) selected.add(value);
  }
  return projectPriorities.filter((priority) => selected.has(priority)).slice(0, 3);
}
