import type { Project } from '@/lib/types/project';
import { ApiError } from './apiClient';

export class ProjectConflictError extends Error {
  current: Project;

  constructor(message: string, current: Project) {
    super(message);
    this.name = 'ProjectConflictError';
    this.current = current;
  }
}

export function coerceProjectConflict(err: unknown): ProjectConflictError | null {
  if (!(err instanceof ApiError)) return null;
  if (err.status !== 409) return null;
  const current = (err.body as any)?.current as Project | undefined;
  if (!current || typeof current.id !== 'string') return null;
  return new ProjectConflictError('This project was updated elsewhere.', current);
}

