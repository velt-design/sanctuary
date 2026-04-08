import 'server-only';

export function isSanctuaryGeometryWorkbenchEnabled(): boolean {
  return process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH?.trim() === '1';
}

export function isSanctuaryGeometryWorkbenchFixturesEnabled(): boolean {
  return process.env.ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES?.trim() === '1';
}
