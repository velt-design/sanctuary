import 'server-only';

type ProjectWorkCorrectionError = {
  status: number;
  code: string;
  message: string;
};

export function projectWorkCorrectionDatabaseError(
  error: unknown,
): ProjectWorkCorrectionError {
  const raw = error as { code?: unknown; message?: unknown };
  const databaseCode = typeof raw?.code === 'string' ? raw.code : '';
  const message =
    typeof raw?.message === 'string'
      ? raw.message
      : 'Project work correction failed';

  if (databaseCode === '42501') {
    return { status: 403, code: 'FORBIDDEN', message };
  }
  if (databaseCode === 'P0002') {
    return { status: 404, code: 'NOT_FOUND', message };
  }
  if (
    databaseCode === '40001'
    || databaseCode === '23505'
    || (
      databaseCode === 'P0001'
      && /evidence_stale|review_stale/i.test(message)
    )
    || /already retracted|stale_project|already uses a governed work model/i.test(
      message,
    )
  ) {
    return { status: 409, code: 'STALE_STATE', message };
  }
  if (
    databaseCode === '42P01'
    || databaseCode === '42883'
    || databaseCode === 'PGRST202'
    || /schema cache/i.test(message)
  ) {
    return { status: 503, code: 'PROJECT_WORK_UNAVAILABLE', message };
  }
  if (
    databaseCode === '22023'
    || databaseCode === '22P02'
    || databaseCode === '23502'
    || databaseCode === '23503'
    || databaseCode === '23514'
  ) {
    return { status: 400, code: 'INVALID_REVIEW', message };
  }
  return { status: 500, code: 'REVIEW_FAILED', message };
}
