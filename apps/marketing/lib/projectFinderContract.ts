export const PROJECT_FINDER_HOME_PATH = '/home-project-finder';
export const PROJECT_FINDER_HOME_VARIANT = 'project_finder_home_v1';
export const PROJECT_FINDER_ENQUIRY_SOURCE_EXPERIENCE =
  'project-finder-home-v1';

export const projectDirections = [
  'cover',
  'outdoor-room',
  'bespoke',
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
export type ProjectPriority = (typeof projectPriorities)[number];

export const projectDirectionLabels: Record<ProjectDirection, string> = {
  cover: 'A refined deck cover',
  'outdoor-room': 'A complete outdoor room',
  bespoke: 'A bespoke or difficult-site solution',
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
