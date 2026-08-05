import type { CostingConfigV1 } from './engine/config';

function effectiveCostingManifestVersion(config: CostingConfigV1): string {
  return config.appliedControlManifestVersion ?? String(config.manifest.version);
}

export function isCostingManifestAtLeast(
  config: CostingConfigV1,
  requiredMajor: number,
  requiredMinor: number,
): boolean {
  const match = /^v(\d+)\.(\d+)/.exec(effectiveCostingManifestVersion(config));
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > requiredMajor || (major === requiredMajor && minor >= requiredMinor);
}
