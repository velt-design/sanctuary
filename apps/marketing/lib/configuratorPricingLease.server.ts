import 'server-only';
import { after } from 'next/server';
import { getPublishedCostingConfiguration } from './publishedCostingConfiguration.server';
import { CONFIGURATOR_PRICE_LEASE_MS } from './configuratorPriceLease';

type Published = Awaited<ReturnType<typeof getPublishedCostingConfiguration>>;
export type ConfiguratorPricingLease = { resolved: Published; expiresAt: number };

/** Private, bounded reuse of an immutable version under a live publication lease.
 * The approval pin is checked on every request. Browser and server leases share
 * this original deadline, so their validity cannot accumulate to sixty seconds.
 */
export function createConfiguratorPricingLease(resolve = getPublishedCostingConfiguration,
  retain: (work: Promise<void>) => void = work => after(() => work)) {
  let approvedPin: string | undefined;
  let lease: ConfiguratorPricingLease | null = null;
  let pending: Promise<ConfiguratorPricingLease> | null = null;
  let generation = 0;
  function validate(approved: string) {
    if (pending) return pending;
    const started = Date.now(), requestGeneration = generation;
    pending = (async () => {
      try {
        const resolved = await resolve();
        const expiresAt = started + CONFIGURATOR_PRICE_LEASE_MS;
        if (requestGeneration !== generation || resolved.provenance.versionId !== approved || expiresAt <= Date.now()) {
          throw new Error('Published pricing authorization changed');
        }
        lease = { resolved, expiresAt };
        return lease;
      } catch (error) {
        if (requestGeneration === generation) lease = null;
        throw error;
      } finally {
        if (requestGeneration === generation) pending = null;
      }
    })();
    return pending;
  }
  return async (approved: string): Promise<ConfiguratorPricingLease> => {
    if (approvedPin !== approved) {
      approvedPin = approved; lease = null; pending = null; generation++;
    }
    if (!approved) throw new Error('Published pricing is disabled');
    if (lease && lease.expiresAt > Date.now()) {
      const authorized = lease;
      if (lease.expiresAt - Date.now() <= CONFIGURATOR_PRICE_LEASE_MS / 2 && !pending) {
        // Keep validation alive after the route responds on serverless hosts.
        // Failure clears authority in validate(); only its already-handled promise
        // is retained here. The returned price keeps the ORIGINAL expiry.
        retain(validate(approved).then(() => {}, () => {}));
      }
      return authorized;
    }
    return validate(approved);
  };
}

export const getLeasedConfiguratorPricing = createConfiguratorPricingLease();
