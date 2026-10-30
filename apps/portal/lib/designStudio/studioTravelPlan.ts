import {parseStudioTravelAllowance,studioTravelPlanFieldError,type StudioTravelAllowance,type StudioTravelPlan,type StudioTravelReceipt,type RetainedTravelPlan} from './studioTravelAllowance';

export type StudioTravelTripPlanIssue = { kind: 'confirm' | 'updating' | 'unavailable'; message: string };

/** Route cost and journey planning have separate provenance. Never infer that an
 * old default1 was an intentional override, or turn overnight stays into daily trips. */
export function studioTravelTripPlanIssue(value: unknown, siteDays: number | null): StudioTravelTripPlanIssue | null {
  if (value === undefined) return null;
  const basis = parseStudioTravelAllowance(value);
  if (basis.mode !== 'automatic') return null;
  if (basis.tripCountSource === undefined) return { kind: 'confirm', message: 'Confirm return trips for this existing travel plan.' };
  if (basis.tripCountSource === 'manual') return null;
  if (basis.tripCountSource === 'overnight') return studioTravelUsesSiteDays(basis)
    ? { kind: 'updating', message: 'Updating daily return trips for the current installation estimate.' } : null;
  if (!studioTravelUsesSiteDays(basis))
    return { kind: 'confirm', message: 'Enter the actual return journeys for this travel plan.' };
  if (!Number.isSafeInteger(siteDays) || Number(siteDays) < 1)
    return { kind: 'unavailable', message: 'Installation days are unavailable. Enter return trips or retry the installation estimate.' };
  return Number(basis.plannedRoundTrips) === siteDays ? null
    : { kind: 'updating', message: 'Updating return trips for the current installation estimate.' };
}

export function studioTravelUsesSiteDays(basis: Pick<StudioTravelPlan,'plannedNights'>) {
  return studioTravelPlanFieldError('plannedNights',basis.plannedNights)===null && Number(basis.plannedNights)===0;
}

function retainedPlan(value: StudioTravelAllowance | null): RetainedTravelPlan | null {
  if (value?.mode === 'pending') return value.previousPlan ?? null;
  if (value?.mode !== 'automatic') return null;
  return { plannedRoundTrips: value.plannedRoundTrips, plannedNights: value.plannedNights,
    destinationCanonical: value.receipt.destinationCanonical,
    ...(value.tripCountSource ? {tripCountSource: value.tripCountSource} : {}) };
}

/** Preserve plan intent while replacing the address/route; never retain an old
 * financial receipt as the basis for the new destination. */
export function studioPendingTravelAllowance(value: unknown): Extract<StudioTravelAllowance, { mode: 'pending' }> {
  const plan = retainedPlan(value === undefined ? null : parseStudioTravelAllowance(value));
  return {mode: 'pending', ...(plan ? {previousPlan: plan} : {})};
}

export function studioTravelPlanForReceipt(value: unknown, receipt: StudioTravelReceipt, siteDays: number | null): Extract<StudioTravelAllowance, { mode: 'automatic' }> {
  const previous = retainedPlan(value === undefined ? null : parseStudioTravelAllowance(value));
  const changedAddress = previous?.destinationCanonical !== receipt.destinationCanonical;
  if (previous && (previous.tripCountSource === 'manual' || previous.tripCountSource === undefined)) {
    return {mode: 'automatic', receipt, plannedRoundTrips: previous.plannedRoundTrips,
      plannedNights: changedAddress && receipt.overnightEligible && studioTravelUsesSiteDays(previous) ? '' : previous.plannedNights,
      ...(previous.tripCountSource ? {tripCountSource: previous.tripCountSource} : {})};
  }
  const nights = !changedAddress && previous ? previous.plannedNights : receipt.overnightEligible ? '' : '0';
  const daily=studioTravelUsesSiteDays({plannedNights:nights});
  return {mode: 'automatic', receipt, plannedNights: nights,
    tripCountSource: daily ? 'site_days' : 'overnight',
    plannedRoundTrips: daily ? Number.isSafeInteger(siteDays) && Number(siteDays) > 0 ? String(siteDays) : '' : '1'};
}

export function studioTravelPlanWithNights(basis: Extract<StudioTravelAllowance, { mode: 'automatic' }>, nights: string, siteDays: number | null) {
  if (basis.tripCountSource === 'manual' || basis.tripCountSource === undefined) return {...basis, plannedNights: nights};
  const daily=studioTravelUsesSiteDays({plannedNights:nights});
  return {...basis, plannedNights: nights, tripCountSource: daily ? 'site_days' as const : 'overnight' as const,
    plannedRoundTrips: daily ? Number.isSafeInteger(siteDays) && Number(siteDays) > 0 ? String(siteDays) : '' : '1'};
}
