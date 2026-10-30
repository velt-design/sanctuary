"use client";
import { useEffect, useState } from "react";
import { attachmentUnavailable } from "@sp/configurator/geometry";
import type { ResolvedStudioScene } from "@/lib/designStudio/interaction/resolvedScene";
import { readStudioFacadeClearance } from "@/lib/designStudio/studioFacadeClearance";
import { CUSTOMER_DIMENSION_BOUNDS } from "@sp/configurator/core";
import type { useStudioConnectionTask } from "./useStudioConnectionTask";
import css from "./StudioHouseConnectionControls.module.css";
import { studioProductIssue } from "@/lib/designStudio/studioProductIssue";
export default function StudioHouseConnectionControls({
  task,
  product,
  onProductRepair,
}: {
  task: ReturnType<typeof useStudioConnectionTask>;
  product: ResolvedStudioScene["rows"][number];
  onProductRepair?: () => void;
}) {
  const value = product.value!,
    design = product.design ?? value.selection;
  const free =
    !task.choice &&
    !task.binding &&
    value.selection.roof.attachmentIntent === "freestanding";
  const actual =
    product.attachment && "measurements" in product.attachment
      ? product.attachment.measurements?.roofClearanceMm
      : undefined;
  const legacy =
    !!task.binding &&
    task.binding.method === "facade" &&
    value.facadeClearanceMm === undefined;
  const basis =
    value.facadeClearanceMm ??
    (legacy
      ? actual === undefined
        ? ""
        : String(Math.round(actual * 10) / 10)
      : "200");
  const [raw, setRaw] = useState(basis);
  useEffect(() => setRaw(basis), [basis, product.object.id]);
  let invalid = false;
  try {
    readStudioFacadeClearance(raw);
  } catch {
    invalid = true;
  }
  const commit = () => {
    if (raw !== basis) task.dispatch({ kind: "clearance", raw });
  };
  const issue = task.preview.error ?? product.error;
  const m = task.repairMeasurements,
    heightIssue =
      m?.supportDatumMm !== undefined &&
      (m.supportDatumMm < CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.minimum ||
        m.supportDatumMm > CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.maximum);
  const target = task.choice ?? task.binding;
  const needsActualEdge =
    !product.studioAttachment &&
    product.error?.startsWith("Choose the actual house edge") === true;
  const productIssue = studioProductIssue(product);
  const methodLabel = (method: typeof task.method) =>
    method === "facade" ? "Façade" : method === "fascia" ? "Fascia" : "Soffit";
  const refusedChoice = task.choice && task.preview.error;
  return (
    <section className={css.connection} aria-label="House connection">
      <h3>House connection</h3>
      <div className={css.methods}>
        {(["facade", "fascia", "soffit"] as const).map((method) => {
          const reason = attachmentUnavailable(
            design.input,
            design.roof,
            method,
          );
          return (
            <button
              data-studio-connection={method}
              key={method}
              aria-pressed={!free && task.method === method}
              disabled={!!reason}
              title={reason ?? undefined}
              onClick={() => task.dispatch({ kind: "method", method })}
            >
              {method === "facade"
                ? "Façade"
                : method === "fascia"
                  ? "Fascia"
                  : "Soffit"}
            </button>
          );
        })}
      </div>
      <button
        className={css.free}
        aria-pressed={free}
        onClick={() => task.dispatch({ kind: "freestanding" })}
      >
        Freestanding
      </button>
      {issue && (
        <div className={css.repair}>
          <p role="alert" className={css.error}>
            {refusedChoice && (
              <>
                {methodLabel(task.choice!.method)} could not be applied.{" "}
                {task.binding
                  ? `${product.error ? "Retained connection reference" : "Current connection"}: ${methodLabel(task.binding.method)} (${task.currentEdgeLabel}).`
                  : "Not connected."}{" "}
              </>
            )}
            {issue}
          </p>
          {productIssue && onProductRepair ? (
            <button onClick={onProductRepair}>{productIssue.label}</button>
          ) : (
            !needsActualEdge &&
            !(task.method === "facade" && invalid) &&
            (task.choice || task.binding) && (
              <>
                <button
                  onClick={() =>
                    task.dispatch({
                      kind: "repair",
                      target: "house",
                      ...(heightIssue ? { focus: "height" as const } : {}),
                    })
                  }
                >
                  {heightIssue
                    ? "Check house height"
                    : "Check house dimensions"}
                </button>
                {m && (
                  <dl>
                    {!heightIssue && (
                      <>
                        <div>
                          <dt>Available house edge</dt>
                          <dd>
                            {Math.round(m.availableSpanMm).toLocaleString(
                              "en-NZ",
                            )}{" "}
                            mm
                          </dd>
                        </div>
                        <div>
                          <dt>Required connection span</dt>
                          <dd>
                            {Math.round(m.requiredSpanMm).toLocaleString(
                              "en-NZ",
                            )}{" "}
                            mm
                          </dd>
                        </div>
                      </>
                    )}
                    <div>
                      <dt>House contact height</dt>
                      <dd>
                        {Math.round(m.targetAttachmentHeightMm).toLocaleString(
                          "en-NZ",
                        )}{" "}
                        mm
                      </dd>
                    </div>
                    {m.supportDatumMm !== undefined && (
                      <div>
                        <dt>Proposed support underside</dt>
                        <dd>
                          {Math.round(m.supportDatumMm).toLocaleString("en-NZ")}{" "}
                          mm
                        </dd>
                      </div>
                    )}
                    {heightIssue && (
                      <div>
                        <dt>Supported height range</dt>
                        <dd>
                          {CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.minimum}–
                          {CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.maximum} mm
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
                <button onClick={() => task.dispatch({ kind: "highlight" })}>
                  Show affected edge in Plan
                </button>
              </>
            )
          )}
        </div>
      )}
      {!free && (
        <>
          <label className={css.field}>
            House edge
            <select
              aria-label="House edge"
              value={
                target && !needsActualEdge
                  ? `${target.houseId}:${target.edge}`
                  : ""
              }
              onChange={(event) => {
                const selected = task.targets.find(
                  (t) => `${t.houseId}:${t.side}` === event.target.value,
                );
                if (selected)
                  task.dispatch({ kind: "target", target: selected });
              }}
            >
              <option value="" disabled>
                Choose a house edge
              </option>
              {task.targets.map((t) => (
                <option
                  key={`${t.houseId}:${t.side}`}
                  value={`${t.houseId}:${t.side}`}
                  disabled={!!t.error}
                >
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {task.method === "facade" && (
            <>
              <label className={css.field}>
                Roof clearance
                <div>
                  <input
                    aria-label="Roof clearance in millimetres"
                    inputMode="decimal"
                    aria-invalid={invalid && (!legacy || raw !== basis)}
                    value={raw}
                    onChange={(event) => setRaw(event.target.value)}
                    onBlur={commit}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                  />
                  <span>mm</span>
                </div>
              </label>
              <small>
                {legacy
                  ? `${actual === undefined ? "Existing connection" : "Existing measured clearance"}. Enter 200 mm or more to change it.`
                  : "Top of pergola roof to underside of house eave or gutter. Minimum 200 mm."}
              </small>
            </>
          )}
        </>
      )}
    </section>
  );
}
