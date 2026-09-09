const CI_WORKERS = 4;
const LOCAL_WORKERS = 8;

type WorkerEnvironment = Readonly<Record<string, string | undefined>>;

function isCi(environment: WorkerEnvironment): boolean {
  const value = environment.CI?.trim().toLowerCase();
  return value === '1' || value === 'true';
}

export function resolveVitestMaxWorkers(
  environment: WorkerEnvironment = process.env,
): number {
  const configured = environment.VITEST_MAX_WORKERS;
  if (configured === undefined) {
    return isCi(environment) ? CI_WORKERS : LOCAL_WORKERS;
  }

  const normalized = configured.trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(
      'VITEST_MAX_WORKERS must be a positive safe integer.',
    );
  }

  const workers = Number(normalized);
  if (!Number.isSafeInteger(workers)) {
    throw new Error(
      'VITEST_MAX_WORKERS must be a positive safe integer.',
    );
  }

  return workers;
}
