import {
  PROJECT_FINDER_HOME_PATH,
  isCommercialProfessionalPath,
  isProjectFinderHomeDirection,
  normalizeProjectPriorities,
  projectPriorities,
  type CommercialProfessionalPath,
  type ProjectFinderHomeDirection,
  type ProjectPriority,
  type ResidentialProjectFinderHomeDirection,
} from '@/lib/projectFinderContract';

export type ProjectFinderState = {
  project?: ProjectFinderHomeDirection;
  professionalPath?: CommercialProfessionalPath;
  priorities?: ProjectPriority[];
};

export type ProjectFinderParamReader = {
  get(name: string): string | null;
  getAll?: (name: string) => string[];
};

function readSingle(
  params: ProjectFinderParamReader,
  name: string,
): string | null {
  const values = params.getAll?.(name);
  if (values && values.length !== 1) return null;
  return params.get(name);
}

export function parseProjectFinderState(
  params: ProjectFinderParamReader,
): ProjectFinderState {
  const project = readSingle(params, 'project')?.trim().toLowerCase();
  if (!isProjectFinderHomeDirection(project)) return {};

  if (project === 'commercial-professional') {
    const professionalPath = readSingle(params, 'professional_path')
      ?.trim()
      .toLowerCase();
    return {
      project,
      ...(isCommercialProfessionalPath(professionalPath)
        ? { professionalPath }
        : {}),
    };
  }

  const rawPriorities = readSingle(params, 'priorities');
  const priorities = rawPriorities
    ? normalizeProjectPriorities(rawPriorities.split(','))
    : [];

  return {
    project,
    ...(priorities.length ? { priorities } : {}),
  };
}

export function parseProjectFinderRecord(
  record: Record<string, string | string[] | undefined>,
): ProjectFinderState {
  return parseProjectFinderState({
    get(name) {
      const value = record[name];
      return typeof value === 'string' ? value : null;
    },
    getAll(name) {
      const value = record[name];
      if (Array.isArray(value)) return value;
      return typeof value === 'string' ? [value] : [];
    },
  });
}

export function buildProjectFinderHref(state: ProjectFinderState): string {
  const params = new URLSearchParams();
  if (state.project) params.set('project', state.project);
  if (
    state.project === 'commercial-professional'
    && state.professionalPath
  ) {
    params.set('professional_path', state.professionalPath);
  }
  if (
    state.project
    && state.project !== 'commercial-professional'
    && state.priorities?.length
  ) {
    const normalized = normalizeProjectPriorities(state.priorities);
    if (normalized.length) params.set('priorities', normalized.join(','));
  }
  const query = params.toString();
  return query
    ? `${PROJECT_FINDER_HOME_PATH}?${query}`
    : PROJECT_FINDER_HOME_PATH;
}

export function selectProjectDirection(
  state: ProjectFinderState,
  project: ProjectFinderHomeDirection,
): ProjectFinderState {
  if (project === 'commercial-professional') return { project };
  return {
    project,
    ...(state.project !== 'commercial-professional' && state.priorities?.length
      ? { priorities: normalizeProjectPriorities(state.priorities) }
      : {}),
  };
}

export function selectCommercialProfessionalPath(
  state: ProjectFinderState,
  professionalPath: CommercialProfessionalPath,
): ProjectFinderState {
  if (state.project !== 'commercial-professional') return state;
  return { project: state.project, professionalPath };
}

export function updateProjectPriority(
  state: ProjectFinderState,
  priority: ProjectPriority,
  selected: boolean,
): { state: ProjectFinderState; limitReached: boolean } {
  if (
    !state.project
    || state.project === 'commercial-professional'
    || !projectPriorities.includes(priority)
  ) {
    return { state, limitReached: false };
  }
  const current = normalizeProjectPriorities(state.priorities ?? []);
  if (!selected) {
    const priorities = current.filter((item) => item !== priority);
    return {
      state: { project: state.project, ...(priorities.length ? { priorities } : {}) },
      limitReached: false,
    };
  }
  if (current.includes(priority)) return { state, limitReached: false };
  if (current.length >= 3) return { state, limitReached: true };
  return {
    state: {
      project: state.project,
      priorities: normalizeProjectPriorities([...current, priority]),
    },
    limitReached: false,
  };
}
export function isResidentialProjectFinderState(
  state: ProjectFinderState,
): state is ProjectFinderState & {
  project: ResidentialProjectFinderHomeDirection;
} {
  return state.project === 'cover' || state.project === 'bespoke';
}
