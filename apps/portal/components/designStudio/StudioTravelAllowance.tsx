"use client";
import { useEffect, useId, useRef, useState } from "react";
import { STUDIO_TRAVEL_POLICY } from "@sp/costing";
import { apiJson } from "@/lib/repo/apiClient";
import {
  parseStudioTravelAllowance,
  parseStudioSelectedAddressProof,
  studioTravelTotalCents,
  studioTravelPlanTotalCents,
  studioTravelPlanFieldError,
  type StudioSelectedAddressProof,
  type StudioTravelReceipt,
  type StudioTravelAllowance as Allowance,
} from "@/lib/designStudio/studioTravelAllowance";
import {studioTravelTripPlanIssue,studioTravelPlanForReceipt,studioTravelPlanWithNights,studioTravelUsesSiteDays} from '@/lib/designStudio/studioTravelPlan';
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import type { StudioJsonObject } from "@/lib/designStudio/contracts";
import css from "./StudioTravelAllowance.module.css";
type Props = {
  projectId: string;
  edit: StudioAuthoringEdit;
  disabled: boolean;
  siteDays?: number | null;
  estimatePending?: boolean;
  selected: StudioSelectedAddressProof | null;
  getCurrent: () => StudioAuthoringEdit | null;
  onChange: (edit: StudioAuthoringEdit) => void;
  onDerivedChange: (edit: StudioAuthoringEdit) => void;
};
export default function StudioTravelAllowance({
  projectId,
  edit,
  disabled,
  siteDays = null,
  estimatePending = false,
  selected,
  getCurrent,
  onChange,
  onDerivedChange,
}: Props) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState<{ message: string; retry: boolean } | null>(
      null,
    ),
    [metrics, setMetrics] = useState<{
      outboundSeconds: number;
      returnSeconds: number;
    } | null>(null);
  const live = useRef(true),
    request = useRef<AbortController | null>(null),
    latest = useRef({ disabled, getCurrent, onChange, onDerivedChange, selected, siteDays });
  latest.current = { disabled, getCurrent, onChange, onDerivedChange, selected, siteDays };
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (disabled) {
      request.current?.abort();
      setPending(false);
    }
  }, [disabled]);
  let basis: Allowance | null = null;
  try {
    if (edit.site.travelAllowance !== undefined)
      basis = parseStudioTravelAllowance(edit.site.travelAllowance);
  } catch {
    /* Server rejects malformed saved data. */
  }
  const automatic = basis?.mode === "automatic" ? basis : null;
  const statusId = useId(),
    tripsIssueId = useId(),
    nightsIssueId = useId();
  const [trips, setTrips] = useState(automatic?.plannedRoundTrips ?? "1"),
    [nights, setNights] = useState(automatic?.plannedNights ?? "0");
  useEffect(() => {
    setTrips(automatic?.plannedRoundTrips ?? "1");
    setNights(automatic?.plannedNights ?? "0");
  }, [automatic?.plannedRoundTrips, automatic?.plannedNights]);
  const tripsIssue = automatic
    ? studioTravelPlanFieldError("plannedRoundTrips", trips)
    : null;
  const nightsIssue = automatic
    ? studioTravelPlanFieldError("plannedNights", nights)
    : null;
  const planIssue=studioTravelTripPlanIssue(automatic??undefined,siteDays);
  let incomplete = Boolean(tripsIssue || nightsIssue || planIssue);
  if (automatic)
    try {
      studioTravelTotalCents({
        ...automatic,
        plannedRoundTrips: trips,
        plannedNights: nights,
      });
    } catch {
      incomplete = true;
    }
  const money = (cents: number) =>
    new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
    }).format(cents / 100);
  function apply(
    next: Allowance,
    current: StudioAuthoringEdit,
    addressProof?: StudioSelectedAddressProof,
    derived = false,
  ) {
    let amount = current.site.travelExGst ?? "0";
    if (next.mode === "automatic" && next.plannedNights !== ""
      && !(next.tripCountSource==='site_days' && next.plannedRoundTrips===''))
      amount = (studioTravelTotalCents(next) / 100).toFixed(2);
    latest.current[derived?'onDerivedChange':'onChange']({
      ...current,
      site: {
        ...current.site,
        travelAllowance: next,
        travelExGst: amount,
        ...(addressProof ? { siteAddressProof: addressProof } : {}),
      } as StudioJsonObject,
    });
  }
  useEffect(() => {
    if(disabled || pending || !Number.isSafeInteger(siteDays) || Number(siteDays)<1) return;
    const current=latest.current.getCurrent();
    if(!current) return;
    const value=current.site.travelAllowance;
    if(value===undefined) return;
    let currentBasis:Allowance;
    try{currentBasis=parseStudioTravelAllowance(value);}
    catch{return; /* Keep the refused draft editable through manual/address recovery. */}
    if(currentBasis.mode!=='automatic' || !studioTravelUsesSiteDays(currentBasis)
      || (currentBasis.tripCountSource!=='site_days' && currentBasis.tripCountSource!=='overnight')) return;
    if(currentBasis.tripCountSource==='site_days' && currentBasis.plannedRoundTrips===String(siteDays)) return;
    try{apply({...currentBasis,tripCountSource:'site_days',plannedRoundTrips:String(siteDays)},current,undefined,true);}
    catch(failure){setError({message:(failure as Error).message,retry:true});}
  },[siteDays,disabled,pending,automatic?.tripCountSource,automatic?.plannedNights,automatic?.plannedRoundTrips]);
  async function calculate(selection = latest.current.selected) {
    if (latest.current.disabled || request.current) return;
    const current = latest.current.getCurrent();
    if (!current) return;
    try {
      const currentBasis =
        current.site.travelAllowance === undefined
          ? null
          : parseStudioTravelAllowance(current.site.travelAllowance);
      if (currentBasis?.mode === "automatic")
        studioTravelPlanTotalCents(currentBasis);
    } catch (failure) {
      setError({ message: (failure as Error).message, retry: false });
      return;
    }
    const before = JSON.stringify(current.site.travelAllowance),
      controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    setMetrics(null);
    try {
      const storedProof = parseStudioSelectedAddressProof(
        current.site.siteAddressProof,
      );
      const selectedProof =
        storedProof &&
        (!selection || storedProof.issuedAt >= selection.issuedAt)
          ? storedProof
          : selection;
      const result = await apiJson<{
        receipt: StudioTravelReceipt;
        outboundSeconds: number;
        returnSeconds: number;
        selectedAddressProof?: StudioSelectedAddressProof;
      }>(`/api/projects/${encodeURIComponent(projectId)}/site-travel`, {
        method: "POST",
        signal: controller.signal,
        skipSaveTracking: true,
        body: JSON.stringify(
          selectedProof
            ? { selectedAddressProof: selectedProof }
            : { allowance: current.site.travelAllowance },
        ),
      });
      const now = latest.current.getCurrent();
      if (
        !live.current ||
        controller.signal.aborted ||
        latest.current.disabled ||
        !now ||
        latest.current.selected !== selection ||
        JSON.stringify(now.site.travelAllowance) !== before
      )
        return;
      const next = studioTravelPlanForReceipt(now.site.travelAllowance,result.receipt,latest.current.siteDays);
      const returnedProof = parseStudioSelectedAddressProof(
        result.selectedAddressProof,
      );
      if (
        returnedProof &&
        (returnedProof.projectId !== projectId ||
          returnedProof.destinationCanonical !==
            result.receipt.destinationCanonical)
      )
        throw Error(
          "The selected site address could not be confirmed. Retry travel calculation.",
        );
      apply(next, now, returnedProof ?? undefined);
      setMetrics(result);
    } catch (failure) {
      if (live.current && !controller.signal.aborted)
        setError({
          message:
            failure instanceof Error
              ? failure.message
              : "Travel calculation failed. Retry.",
          retry: true,
        });
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (live.current) setPending(false);
      }
    }
  }
  const lastSelection = useRef<StudioSelectedAddressProof | null>(null);
  useEffect(() => {
    if (selected && lastSelection.current !== selected) {
      lastSelection.current = selected;
      request.current?.abort();
      request.current = null;
      void calculate(selected);
    }
  }, [selected]);
  function updatePlan() {
    const current = latest.current.getCurrent();
    if (!current || latest.current.disabled || !automatic) return;
    try {
      const currentBasis = parseStudioTravelAllowance(
        current.site.travelAllowance,
      );
      if (
        currentBasis.mode !== "automatic" ||
        JSON.stringify(currentBasis.receipt) !==
          JSON.stringify(automatic.receipt)
      )
        return;
      apply(
        currentBasis,
        current,
      );
      setError(null);
    } catch (failure) {
      setError({ message: (failure as Error).message, retry: false });
    }
  }
  function draftPlan(
    field: "plannedRoundTrips" | "plannedNights",
    value: string,
  ) {
    const current = latest.current.getCurrent();
    if (!current || latest.current.disabled || !automatic) return;
    const currentBasis = parseStudioTravelAllowance(
      current.site.travelAllowance,
    );
    if (
      currentBasis.mode !== "automatic" ||
      JSON.stringify(currentBasis.receipt) !== JSON.stringify(automatic.receipt)
    )
      return;
    const next = field==='plannedRoundTrips'
      ? {...currentBasis,plannedRoundTrips:value,tripCountSource:'manual' as const}
      : studioTravelPlanWithNights(currentBasis,value,latest.current.siteDays);
    // Raw plan drafts share the existing authored owner, so price/preparation see
    // invalid quantities immediately rather than silently using the last plan.
    latest.current.onChange({
      ...current,
      site: { ...current.site, travelAllowance: next } as StudioJsonObject,
    });
    try {
      studioTravelTotalCents(next);
      setError(null);
    } catch (failure) {
      setError({ message: (failure as Error).message, retry: false });
    }
  }
  function choosePlan(source:'site_days'|'manual') {
    const current=latest.current.getCurrent();
    if(!current || latest.current.disabled) return;
    const currentBasis=parseStudioTravelAllowance(current.site.travelAllowance);
    if(currentBasis.mode!=='automatic') return;
    if(source==='site_days' && (!Number.isSafeInteger(siteDays) || Number(siteDays)<1 || !studioTravelUsesSiteDays(currentBasis)))return;
    try{
      apply({...currentBasis,tripCountSource:source,plannedRoundTrips:source==='site_days'?String(siteDays):currentBasis.plannedRoundTrips},current);
      setError(null);
    }catch(failure){setError({message:(failure as Error).message,retry:false});}
  }
  function manual() {
    const current = latest.current.getCurrent();
    if (!current) return;
    request.current?.abort();
    request.current = null;
    setPending(false);
    apply({ mode: "manual" }, current);
    setMetrics(null);
    setError(null);
  }
  return (
    <div className={css.control}>
      <label>
        Travel cost excluding GST
        <input
          aria-label="Travel cost excluding GST"
          value={
            automatic && incomplete ? "" : String(edit.site.travelExGst ?? "0")
          }
          placeholder={
            automatic && incomplete ? "Complete the travel plan" : undefined
          }
          aria-invalid={(automatic && incomplete) || Boolean(error?.retry)}
          aria-describedby={statusId}
          readOnly={!!automatic}
          disabled={disabled || pending}
          onChange={(event) => {
            const current = latest.current.getCurrent();
            if (current)
              latest.current.onChange({
                ...current,
                site: {
                  ...current.site,
                  travelExGst: event.target.value,
                  travelAllowance: { mode: "manual" },
                },
              });
          }}
        />
      </label>
      <div className={css.actions}>
        <span
          id={statusId}
          className={css.status}
          role={error ? "alert" : "status"}
          title={error?.message??planIssue?.message}
        >
          {error?.retry
            ? error.message
            : automatic
              ? planIssue?.kind==='confirm'
                ? 'Confirm return trips'
                : planIssue?.kind==='updating' || (planIssue?.kind==='unavailable'&&estimatePending)
                  ? 'Updating return trips'
                : incomplete
                ? nights === ""
                  ? "Decision needed"
                  : "Check travel plan"
                : "Calculated allowance"
              : basis?.mode === "pending"
                ? "Calculation needed"
                : "Manual allowance"}
        </span>
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => void calculate()}
        >
          {pending
            ? "Calculating…"
            : error?.retry
              ? "Retry travel"
              : automatic
                ? "Recalculate travel"
                : "Calculate travel"}
        </button>
        {basis?.mode !== "manual" && basis !== null && (
          <button type="button" disabled={disabled} onClick={manual}>
            Enter manually
          </button>
        )}
      </div>
      {automatic && (
        <>
          <div className={css.plan}>
            <label>
              <span className={css.labelLine}>
                {tripsIssue ? "Whole trips, minimum 1" : "Planned return trips"}
              </span>
              <input
                aria-label="Planned return trips"
                inputMode="numeric"
                maxLength={64}
                value={trips}
                aria-invalid={Boolean(tripsIssue)}
                aria-describedby={tripsIssue ? tripsIssueId : undefined}
                disabled={disabled || pending}
                onChange={(e) => {
                  setTrips(e.target.value);
                  draftPlan("plannedRoundTrips", e.target.value);
                }}
                onBlur={updatePlan}
              />
              {tripsIssue && (
                <span id={tripsIssueId} className={css.srOnly}>
                  {tripsIssue}
                </span>
              )}
            </label>
            <label>
              <span className={css.labelLine}>
                {nightsIssue
                  ? nights === ""
                    ? "Nights needed (0 allowed)"
                    : "Whole nights, 0 or more"
                  : "Planned nights away"}
              </span>
              <input
                aria-label="Planned nights away"
                inputMode="numeric"
                maxLength={64}
                value={nights}
                aria-invalid={Boolean(nightsIssue)}
                aria-describedby={nightsIssue ? nightsIssueId : undefined}
                disabled={disabled || pending}
                onChange={(e) => {
                  setNights(e.target.value);
                  draftPlan("plannedNights", e.target.value);
                }}
                onBlur={updatePlan}
              />
              {nightsIssue && (
                <span id={nightsIssueId} className={css.srOnly}>
                  {nightsIssue}
                </span>
              )}
            </label>
          </div>
          <small>Installation estimate: {siteDays!==null?`${siteDays} site days.`:estimatePending?'Updating…':'Unavailable. Enter return trips or retry price.'}</small>
          {studioTravelUsesSiteDays(automatic) && automatic.tripCountSource!=='site_days' && (
            <div className={`${css.actions} ${css.planActions}`}>
              <button type="button" disabled={disabled||pending||!siteDays} onClick={()=>choosePlan('site_days')}>Use site days{siteDays?` (${siteDays})`:''}</button>
              {automatic.tripCountSource===undefined && <button type="button" disabled={disabled||pending||!!tripsIssue||!!nightsIssue} onClick={()=>choosePlan('manual')}>Keep existing trips</button>}
            </div>
          )}
          {!studioTravelUsesSiteDays(automatic) && automatic.tripCountSource===undefined && <div className={`${css.actions} ${css.planActions}`}><button type="button" disabled={disabled||pending||!!tripsIssue||!!nightsIssue} onClick={()=>choosePlan('manual')}>Confirm return journeys</button></div>}
          <small>From {STUDIO_TRAVEL_POLICY.base}</small>
          <small className={css.formula}>
            {money(automatic.receipt.drivingCostPerRoundTripCents)} ×{" "}
            {tripsIssue ? "?" : trips} return trips + $300 ×{" "}
            {nightsIssue ? "?" : nights} nights.
          </small>
          <small>
            Whole crew: $75 per driving hour. No separate kilometre charge.
            {automatic.receipt.overnightEligible &&
              " Outward travel exceeds 1 hour 45 minutes. Enter actual planned nights, or 0 for a day trip."}
          </small>
        </>
      )}
      {metrics && (
        <small>
          Driving: {Math.ceil(metrics.outboundSeconds / 60)} min out,{" "}
          {Math.ceil(metrics.returnSeconds / 60)} min return.{" "}
          <span className={css.attribution} translate="no">
            Google Maps
          </span>
        </small>
      )}
      {error && !error.retry && (
        <span className={css.srOnly} role="alert">
          {error.message}
        </span>
      )}
    </div>
  );
}
