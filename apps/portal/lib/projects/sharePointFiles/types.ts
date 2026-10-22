type ProjectFileRoot = { id: string; label: string; itemId: string };
type ProjectFileItem = {
  id: string; name: string; kind: 'folder' | 'file'; size: number;
  modifiedAt: string | null; viewable: boolean; contentType?: string | null;
};
export type ProjectFilesPage = {
  state: 'ready' | 'unlinked' | 'pending' | 'needs_attention' | 'disabled';
  roots: ProjectFileRoot[]; rootId: string | null; folderId: string | null;
  items: ProjectFileItem[]; cursor: string | null;
};
export class ProjectFilesError extends Error {
  constructor(readonly code: 'not_configured' | 'access_required' | 'not_found' | 'invalid_request' | 'source_unavailable' | 'source_invalid' | 'busy', readonly status = 503) {
    super(code);
  }
}
export const projectFilesHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
