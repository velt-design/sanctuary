import { ProjectFilesError, projectFilesHeaders } from './types';
export function filesJson(value: unknown, status = 200) { return Response.json(value, { status, headers: projectFilesHeaders }); }
export function filesError(error: unknown) {
  return filesJson({ error: 'Project files are temporarily unavailable. Please try again.', code: error instanceof ProjectFilesError ? error.code : 'source_unavailable' }, error instanceof ProjectFilesError ? error.status : 503);
}
export function privateResponse(response: Response) { for (const [key, value] of Object.entries(projectFilesHeaders)) response.headers.set(key, value); return response; }
