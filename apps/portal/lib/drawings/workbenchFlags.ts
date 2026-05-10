import 'server-only';

// The hidden `?fixture=…` route mounts baked QA fixtures with sample geometry.
// Production never serves these — keep it opt-in so they can't be loaded by accident.
export function isSanctuaryGeometryWorkbenchFixturesEnabled(): boolean {
  return process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES?.trim() === '1';
}
