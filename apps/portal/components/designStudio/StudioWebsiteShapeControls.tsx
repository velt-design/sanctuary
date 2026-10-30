"use client";
import { memo, useMemo, type ReactNode } from "react";
import type { StudioWebsiteDesign } from "@/lib/designStudio/websiteDesign";
import { resolveStudioWebsiteDesign } from "@/lib/designStudio/websiteDesign";
import css from "./StudioWebsite.module.css";
type Props = {
  value: StudioWebsiteDesign;
  onChange: (value: StudioWebsiteDesign) => void;
  connectionControls?: ReactNode;
};
function StudioWebsiteShapeControls({ value, onChange, connectionControls }: Props) {
  const roof = value.selection.roof,
    validity = useMemo(()=>resolveStudioWebsiteDesign(value, value.objectId),[value]);
  return (
    <>
      <h2>Size</h2>
      <div className={css.dimensionFields}>
        {(["widthMm", "projectionMm"] as const).map((field) => (
          <label className={css.field} key={field}>
            {field === "widthMm" ? "Width" : "Projection"}
            <div>
              <input
                aria-label={
                  field === "widthMm"
                    ? "Width in millimetres"
                    : "Projection in millimetres"
                }
                inputMode="numeric"
                aria-describedby={
                  !validity.ok &&
                  "field" in validity &&
                  validity.field === field
                    ? `website-${field}-error`
                    : undefined
                }
                aria-invalid={
                  !validity.ok &&
                  "field" in validity &&
                  validity.field === field
                }
                value={value.rawDimensions[field]}
                onChange={(event) =>
                  onChange({
                    ...value,
                    rawDimensions: {
                      ...value.rawDimensions,
                      [field]: event.target.value,
                    },
                  })
                }
              />
              <span>mm</span>
            </div>
            {!validity.ok &&
              "field" in validity &&
              validity.field === field && (
                <span id={`website-${field}-error`} className={css.fieldError}>
                  {validity.message}
                </span>
              )}
          </label>
        ))}
      </div>
      {connectionControls}
      <h3>Roof</h3>
      <div className={css.choices}>
        {(["mono", "gable", "box"] as const).map((family) => (
          <button
            key={family}
            aria-pressed={roof.family === family}
            onClick={() =>
              onChange({
                ...value,
                selection: { ...value.selection, roof: { ...roof, family } },
              })
            }
          >
            <img
              src={`/studio/roof-${family}.svg`}
              width="88"
              height="64"
              alt=""
            />
            <span>
              {family === "mono"
                ? "Pitched"
                : family === "gable"
                  ? "Gable"
                  : "Box"}
            </span>
          </button>
        ))}
      </div>
      {!validity.ok &&
        "field" in validity &&
        (validity.field === "connection" || validity.field === "level") && (
          <p role="alert" className={css.fieldError}>
            {validity.message}
          </p>
        )}
    </>
  );
}
export default memo(StudioWebsiteShapeControls);
/** Infrequent controls follow the frequently used material/tint/finish fields. */
export function StudioWebsiteShapeDetails({ value, onChange }: Props) {
  const roof = value.selection.roof,
    changeRoof = (next: typeof roof) =>
      onChange({ ...value, selection: { ...value.selection, roof: next } });
  return (
    <details className={css.designDisclosure}>
      <summary>
        {roof.family === "gable" ? "Ridge, infills & site level" : "Site level"}
      </summary>
      {roof.family === "gable" && (
        <>
          <label className={css.field}>
            Ridge direction
            <select
              value={roof.orientation}
              onChange={(event) =>
                changeRoof({
                  ...roof,
                  orientation: event.target.value as "parallel" | "away",
                })
              }
            >
              <option value="parallel">Across the width</option>
              <option value="away">Along the projection</option>
            </select>
          </label>
          <label className={css.check}>
            <input
              type="checkbox"
              checked={roof.infills}
              onChange={(event) =>
                changeRoof({ ...roof, infills: event.target.checked })
              }
            />
            Gable infills
          </label>
        </>
      )}
      <label className={css.field}>
        Site level
        <select
          value={value.selection.input.level}
          onChange={(event) =>
            onChange({
              ...value,
              selection: {
                ...value.selection,
                input: {
                  ...value.selection.input,
                  level: event.target.value as "ground" | "elevated",
                },
              },
            })
          }
        >
          <option value="ground">Ground</option>
          <option
            value="elevated"
            disabled={roof.attachmentIntent === "freestanding"}
          >
            Elevated
          </option>
        </select>
      </label>
    </details>
  );
}
/** Explicit model support choice, separate from an applied house relationship. */
export function StudioSupportModelControls({ value, onChange }: Props) {
  const roof = value.selection.roof;
  return (
    <div className={css.choices}>
      {(["attached", "freestanding", "unsure"] as const).map((intent) => (
        <button
          key={intent}
          aria-pressed={(roof.attachmentIntent ?? "attached") === intent}
          onClick={() => {
            const next = { ...roof };
            if (intent === "attached") delete next.attachmentIntent;
            else next.attachmentIntent = intent;
            onChange({
              ...value,
              selection: { ...value.selection, roof: next },
            });
          }}
        >
          {intent === "attached"
            ? "House-supported model"
            : intent === "freestanding"
              ? "Independent supports"
              : "Undecided supports"}
        </button>
      ))}
    </div>
  );
}
