"use client";
import type { StudioHouseField } from "@/lib/designStudio/studioHouseGeometry";
import type {
  StudioHouseProperty,
  useStudioHouseDraft,
} from "./useStudioHouseDraft";
import css from "./StudioWebsite.module.css";
import {
  REPRESENTATIVE_ROOF_PROFILE_OPTIONS,
  REPRESENTATIVE_ROOF_TRAY_WIDTHS,
} from "@sp/geometry";

/** Controlled presentation. Raw draft/storage survives this form unmounting. */
export default function StudioHouseInspector({
  owner,
  applicationError,
}: {
  owner: ReturnType<typeof useStudioHouseDraft>;
  applicationError: string | null;
}) {
  const {
    currentHouse,
    fieldErrors,
    heightNotice,
    inspectorError: houseError,
    replace: setHouseDraft,
  } = owner;
  if (!currentHouse) return null;
  const pendingHouse = owner.pending && owner.draft?.id === currentHouse.id;
  const appearance = currentHouse.source.appearance;
  const colour = /^#[0-9a-fA-F]{6}$/.test(appearance?.roofColour ?? "")
    ? appearance!.roofColour!
    : "#343b39";
  const completion = (name: StudioHouseProperty) => ({
    "data-studio-house-field": name,
    onBlur: (event: React.FocusEvent<HTMLInputElement>) =>
      owner.complete(name, event.currentTarget.value),
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        owner.complete(name, event.currentTarget.value);
      }
    },
  });
  function field(
    k: "widthMm" | "depthMm" | "wallHeightMm" | "eaveHeightMm",
    label: string,
  ) {
    if (!currentHouse) return null;
    return (
      <label className={css.field}>
        {label}
        <input
          {...completion(k)}
          aria-label={label}
          value={currentHouse[k] ?? ""}
          placeholder={
            k === "eaveHeightMm" && heightNotice
              ? String(heightNotice.lowestRoofEdgeMm)
              : undefined
          }
          onChange={(e) =>
            setHouseDraft({ ...currentHouse, [k]: e.target.value })
          }
          aria-invalid={!!fieldErrors[k]}
          aria-describedby={fieldErrors[k] ? `house-${k}-error` : undefined}
        />
        {fieldMessage(k)}
      </label>
    );
  }
  function fieldMessage(k: StudioHouseField) {
    return fieldErrors[k] ? (
      <span id={`house-${k}-error`} className={css.fieldError} role="alert">
        {fieldErrors[k]}
      </span>
    ) : null;
  }
  return (
    <div className={`${css.rail} ${css.houseTask}`}>
      <div className={css.inspectorBody}>
        {owner.draft && owner.draft.id !== currentHouse.id ? (
          <p role="status">
            Unapplied changes for {owner.draft.label} are retained. Select that
            house to review them.
          </p>
        ) : (
          owner.notice && <p role="status">{owner.notice}</p>
        )}
        {applicationError && (
          <p className={css.fieldError} role="alert">
            {applicationError}
          </p>
        )}
        <div className={css.dimensionFields}>
          {field("widthMm", "Width (mm)")}
          {field("depthMm", "Depth (mm)")}
        </div>
        {field("wallHeightMm", "Wall height (mm)")}
        {field("eaveHeightMm", "Eave height (mm)")}
        {heightNotice && <p role="status">{heightNotice.text}</p>}
        <label className={css.field}>
          Wall material
          <select
            aria-label="House wall material"
            value={appearance?.wallMaterial ?? "plaster"}
            onChange={(event) =>
              owner.complete(
                "source.appearance.wallMaterial",
                event.target.value,
              )
            }
          >
            <option value="plaster">Plaster</option>
            <option value="weatherboard">Weatherboard</option>
            <option value="brick">Brick</option>
          </select>
        </label>
        <h3>Roof</h3>
        <div className={css.houseRoofChoices}>
          {(["flat", "mono", "hipped"] as const).map((form, i) => (
            <button
              key={form}
              aria-pressed={currentHouse.roof.form === form}
              onClick={() => owner.complete("roof.form", form)}
            >
              <svg viewBox="0 0 80 36" aria-hidden="true">
                <path
                  d={
                    i === 0
                      ? "M8 25H72"
                      : i === 1
                        ? "M8 25L72 9"
                        : "M8 25L26 9H54L72 25"
                  }
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
              {form === "mono"
                ? "Single slope"
                : form === "hipped"
                  ? "Hipped"
                  : "Flat"}
            </button>
          ))}
        </div>
        {currentHouse.roof.form !== "flat" && (
          <label className={css.field}>
            Roof pitch (degrees)
            <input
              {...completion("roof.pitchDeg")}
              aria-label="Roof pitch (degrees)"
              aria-invalid={!!fieldErrors.pitchDeg}
              aria-describedby={
                fieldErrors.pitchDeg ? "house-pitchDeg-error" : undefined
              }
              value={currentHouse.roof.pitchDeg}
              onChange={(e) =>
                setHouseDraft({
                  ...currentHouse,
                  roof: {
                    ...currentHouse.roof,
                    pitchDeg: e.target.value,
                  },
                })
              }
            />
            {fieldMessage("pitchDeg")}
          </label>
        )}
        {currentHouse.roof.form === "mono" && (
          <label className={css.field}>
            Falls toward
            <select
              value={currentHouse.roof.fall}
              onChange={(e) => owner.complete("roof.fall", e.target.value)}
            >
              {["front", "right", "rear", "left"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
        <label className={css.field}>
          Roof profile
          <select
            aria-label="House roof profile"
            value={appearance?.roofProfile ?? "corrugated"}
            onChange={(event) =>
              owner.complete(
                "source.appearance.roofProfile",
                event.target.value,
              )
            }
          >
            {REPRESENTATIVE_ROOF_PROFILE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {appearance?.roofProfile === "tray" && (
          <label className={css.field}>
            Tray width
            <select
              aria-label="House roof tray width"
              value={appearance.roofTrayWidth ?? 400}
              onChange={(event) =>
                owner.complete(
                  "source.appearance.roofTrayWidth",
                  event.target.value,
                )
              }
            >
              {REPRESENTATIVE_ROOF_TRAY_WIDTHS.map((width) => (
                <option key={width} value={width}>
                  {width} mm
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={css.field}>
          Roof colour
          <div className={css.houseColour}>
            <input
              type="color"
              aria-label="House roof colour"
              value={colour}
              onChange={(event) =>
                owner.complete(
                  "source.appearance.roofColour",
                  event.target.value,
                )
              }
            />
            <input
              aria-label="House roof colour HEX"
              data-studio-house-field="source.appearance.roofColour"
              value={appearance?.roofColour ?? "#343b39"}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={!!owner.appearanceError}
              aria-describedby={
                owner.appearanceError ? "house-roof-colour-error" : undefined
              }
              onChange={(event) =>
                setHouseDraft({
                  ...currentHouse,
                  source: {
                    ...currentHouse.source,
                    appearance: {
                      ...appearance,
                      roofColour: event.target.value,
                    },
                  },
                })
              }
              onBlur={(event) => {
                if (appearance?.roofColour !== undefined)
                  owner.complete(
                    "source.appearance.roofColour",
                    event.currentTarget.value,
                  );
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (appearance?.roofColour !== undefined)
                    owner.complete(
                      "source.appearance.roofColour",
                      event.currentTarget.value,
                    );
                }
              }}
            />
          </div>
          {owner.appearanceError && (
            <span
              id="house-roof-colour-error"
              className={css.fieldError}
              role="alert"
            >
              {owner.appearanceError}
            </span>
          )}
        </label>
        <details>
          <summary>Roof edge</summary>
          <label className={css.field}>
            Overhang (mm)
            <input
              {...completion("roof.overhangMm")}
              aria-label="Overhang (mm)"
              aria-invalid={!!fieldErrors.overhangMm}
              aria-describedby={
                fieldErrors.overhangMm ? "house-overhangMm-error" : undefined
              }
              value={currentHouse.roof.overhangMm}
              onChange={(e) =>
                setHouseDraft({
                  ...currentHouse,
                  roof: {
                    ...currentHouse.roof,
                    overhangMm: e.target.value,
                  },
                })
              }
            />
            {fieldMessage("overhangMm")}
          </label>
          {(
            [
              "fasciaHeightMm",
              "soffitDepthMm",
              "gutterWidthMm",
              "gutterDepthMm",
              "gutterProjectionMm",
            ] as const
          ).map((k, i) => (
            <label className={css.field} key={k}>
              {
                [
                  "Fascia height",
                  "Soffit depth",
                  "Gutter width",
                  "Gutter depth",
                  "Gutter projection",
                ][i]
              }{" "}
              (mm)
              <input
                {...completion(
                  k === "fasciaHeightMm"
                    ? "roof.fasciaHeightMm"
                    : `source.${k}`,
                )}
                aria-label={`${["Fascia height", "Soffit depth", "Gutter width", "Gutter depth", "Gutter projection"][i]} (mm)`}
                value={
                  k === "fasciaHeightMm"
                    ? (currentHouse.roof.fasciaHeightMm ?? "")
                    : (currentHouse.source[k] ?? "")
                }
                onChange={(e) =>
                  setHouseDraft({
                    ...currentHouse,
                    source: {
                      ...currentHouse.source,
                      [k]: e.target.value,
                    },
                    ...(k === "fasciaHeightMm"
                      ? {
                          roof: {
                            ...currentHouse.roof,
                            fasciaHeightMm: e.target.value,
                          },
                        }
                      : {}),
                  })
                }
              />
            </label>
          ))}
        </details>
        <details>
          <summary>Position</summary>
          {(["xMm", "yMm", "rotationDeg"] as const).map((k) => (
            <label key={k} className={css.field}>
              {k === "rotationDeg"
                ? "Rotation (degrees)"
                : `${k === "xMm" ? "X" : "Y"} (mm)`}
              <input
                {...completion(`position.${k}`)}
                aria-label={`House ${k}`}
                aria-invalid={!!fieldErrors[k]}
                aria-describedby={
                  fieldErrors[k] ? `house-${k}-error` : undefined
                }
                value={currentHouse.position[k]}
                onChange={(e) =>
                  setHouseDraft({
                    ...currentHouse,
                    position: {
                      ...currentHouse.position,
                      [k]: e.target.value,
                    },
                  })
                }
              />
              {fieldMessage(k)}
            </label>
          ))}
          <button
            className={css.quietButton}
            disabled={!!fieldErrors.rotationDeg}
            data-studio-house-action="rotation"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() =>
              owner.completeRotation(
                String(Number(currentHouse.position.rotationDeg) + 90),
              )
            }
          >
            Turn 90°
          </button>
        </details>
        {houseError && !Object.keys(fieldErrors).length && !owner.appearanceError && (
          <p className={css.fieldError} role="alert">
            {houseError}
          </p>
        )}
      </div>
      <footer className={css.inspectorFooter}>
        {pendingHouse ? (
          <>
            <button
              data-studio-house-action="discard"
              className={css.quietButton}
              onPointerDown={(e) => e.preventDefault()}
              onClick={owner.discard}
            >
              Discard unfinished input
            </button>
          </>
        ) : (
          <span>
            {owner.pending
              ? "Select the house with retained input to review or discard it."
              : "Changes are kept when you press Enter or leave a field. Drag the house in Plan to move it."}
          </span>
        )}
      </footer>
    </div>
  );
}
