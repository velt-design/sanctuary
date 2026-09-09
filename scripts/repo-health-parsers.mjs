export function parseRootCompatibilityReport(output) {
  const match = output.match(
    /(\d+) new-growth file\(s\),\s+(\d+) changed file\(s\),\s+(\d+) legacy-compatible file\(s\)\./,
  );
  if (match) {
    return {
      newGrowthFiles: Number.parseInt(match[1], 10),
      changedFiles: Number.parseInt(match[2], 10),
      legacyCompatibleFiles: Number.parseInt(match[3], 10),
    };
  }
  if (/No (?:changed )?root compatibility files detected\./i.test(output)) {
    return {
      newGrowthFiles: 0,
      changedFiles: 0,
      legacyCompatibleFiles: 0,
    };
  }
  throw new Error('repo-health-trends: could not parse root compatibility report summary');
}
