import type { Filters } from '@/lib/marketingPerformance/contract';
import { hubSchema, type HubReport } from '@/lib/marketingPerformance/hub';
import type { InitialHubSeed } from '@/lib/marketingPerformance/initialHub';

// One component owns one initial opportunity. StrictMode may replay the same
// pending effect; a changed request, refresh, settlement or mismatch retires it.
export function initialHubAttempt(seed?: InitialHubSeed, owner?: unknown) {
  let retired = !seed;
  let pending: Promise<HubReport> | undefined;
  return {
    take(filters: Filters, revision: number, currentOwner = owner): Promise<HubReport> | null {
      if (retired) return null;
      if (!seed || currentOwner !== owner || revision !== 0 || filters.start !== seed.start || filters.end !== seed.end) { retired = true; return null; }
      pending ??= Promise.resolve(seed.result).then(result => {
        if (!result.ok) throw new Error(result.error);
        const report = hubSchema.safeParse(result.report);
        if (!report.success || report.data.start !== seed.start || report.data.end !== seed.end)
          throw new Error('The evidence could not be verified. No partial totals are shown.');
        return report.data;
      }, () => { throw new Error('The hub could not be loaded. Please retry.'); })
        .finally(() => { retired = true; });
      return pending;
    },
    retire() { retired = true; },
  };
}
