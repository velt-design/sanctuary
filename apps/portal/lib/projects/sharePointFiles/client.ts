import type { ProjectFilesPage } from './types';

export class ProjectFilesReadError extends Error {
  constructor(readonly status: number) { super(status === 401 || status === 403 ? 'File access is unavailable.' : status === 404 ? 'This folder no longer exists or has moved.' : 'Project files could not be loaded.'); }
}
export function projectFileOpenHref(projectId: string, rootId: string, itemId: string, mode: 'view' | 'download') {
  return `/api/staff/v1/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(itemId)}/open?${new URLSearchParams({ rootId, mode })}`;
}
export async function fetchProjectFiles(projectId: string, input: { rootId?: string; folderId?: string; cursor?: string }, signal?: AbortSignal): Promise<ProjectFilesPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (value) params.set(key, value);
  const response = await fetch(`/api/staff/v1/projects/${encodeURIComponent(projectId)}/files?${params}`, { credentials: 'same-origin', cache: 'no-store', signal });
  if (!response.ok) throw new ProjectFilesReadError(response.status);
  return response.json();
}
