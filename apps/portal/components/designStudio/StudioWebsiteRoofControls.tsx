"use client";
import { memo } from "react";
import type { StudioWebsiteDesign } from "@/lib/designStudio/websiteDesign";
import css from "./StudioWebsite.module.css";
import { CUSTOMER_ACRYLIC_TINT_OPTIONS } from "@sp/configurator/core";
type Props = {
  value: StudioWebsiteDesign;
  onChange: (v: StudioWebsiteDesign) => void;
  compact?: boolean;
};
import {
  DEFAULT_ROOF_FINISH,
  REPRESENTATIVE_ROOF_PROFILE_OPTIONS,
  REPRESENTATIVE_ROOF_TRAY_WIDTHS,
} from "@sp/geometry";
import { allowsHouseBand } from "@sp/configurator/geometry";
import {
  TIMBER_PROFILES,
  DEFAULT_ROOF_BATTENS,
  parseRoofBattens,
} from "@sp/configurator/website";
import Gap from "./StudioWebsiteGap";
import {
  changeStudioGap,
  clearStudioGap,
} from "@/lib/designStudio/websiteDesign";
function StudioWebsiteRoofControls({
  value,
  onChange,
  compact = false,
}: Props) {
  const roof = value.selection.roof,
    finish = roof.finish ?? DEFAULT_ROOF_FINISH;
  const changeRoof = (next: typeof roof) =>
    onChange({ ...value, selection: { ...value.selection, roof: next } });
  const batten = (patch: Partial<NonNullable<typeof roof.roofBattens>>) => {
    const next =
      Object.hasOwn(patch, "profile") ||
      Object.hasOwn(patch, "edge") ||
      Object.hasOwn(patch, "customGap")
        ? clearStudioGap(value, "roof")
        : value;
    onChange({
      ...next,
      selection: {
        ...next.selection,
        roof: {
          ...roof,
          roofBattens: parseRoofBattens({ ...roof.roofBattens, ...patch })!,
        },
      },
    });
  };
  return (
    <>
      {compact ? <h3>Roof material</h3> : <h2>Roof & ceiling</h2>}
      <div className={css.choices}>
        {(["acrylic", "solid", "combination"] as const).map((material) => (
          <button
            key={material}
            aria-pressed={finish.material === material}
            onClick={() =>
              changeRoof({
                ...roof,
                finish: {
                  ...finish,
                  material,
                  ...(material !== "acrylic" && !finish.ceiling
                    ? { ceiling: "thermopine-150" as const }
                    : {}),
                },
              })
            }
          >
            <span
              aria-hidden="true"
              className={`${css.materialSwatch} ${css[material]}`}
            >
              {material === "combination" && (
                <img
                  className={css.mixedSwatch}
                  alt=""
                  src={`/studio/mixed-${roof.family}-${roof.family === "gable" ? roof.orientation : "parallel"}-${allowsHouseBand(roof) ? finish.layout : "central"}-${finish.ceiling ?? "thermopine-150"}.svg`}
                />
              )}
            </span>
            <span>
              {material === "combination"
                ? "Mixed"
                : material === "solid"
                  ? "Solid + timber"
                  : "Acrylic"}
            </span>
          </button>
        ))}
      </div>
      {finish.material !== "solid" && (
        <label className={css.field}>
          Acrylic tint
          <select
            value={roof.acrylicTint ?? "clear"}
            onChange={(e) =>
              changeRoof({
                ...roof,
                acrylicTint: e.target.value as NonNullable<
                  typeof roof.acrylicTint
                >,
              })
            }
          >
            {CUSTOMER_ACRYLIC_TINT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={css.field}>
        Finish
        <div>
          <span
            className={css.finishChip}
            style={{
              background:
                value.selection.roof.frameFinish === "white"
                  ? "#f0f1ed"
                  : "#222622",
            }}
            aria-hidden="true"
          />
          <select
            aria-label="Frame finish"
            value={value.selection.roof.frameFinish ?? "black"}
            onChange={(e) =>
              onChange({
                ...value,
                selection: {
                  ...value.selection,
                  roof: {
                    ...value.selection.roof,
                    frameFinish: e.target.value as "black" | "white",
                  },
                },
              })
            }
          >
            <option value="black">Black</option>
            <option value="white">White</option>
          </select>
        </div>
      </label>

      <details className={css.designDisclosure} data-studio-roof-options>
        <summary>Ceiling & battens</summary>{" "}
        {finish.material !== "acrylic" && (
          <>
            <label className={css.field}>
              Ceiling
              <select
                value={finish.ceiling ?? "thermopine-150"}
                onChange={(e) =>
                  changeRoof({
                    ...roof,
                    finish: {
                      ...finish,
                      ceiling: e.target.value as NonNullable<
                        typeof finish.ceiling
                      >,
                    },
                  })
                }
              >
                <option value="thermopine-150">ThermoPine · 150 mm</option>
                <option value="thermopine-100">ThermoPine · 100 mm</option>
                <option value="cedar-150">Cedar · 150 mm</option>
                <option value="cedar-100">Cedar · 100 mm</option>
              </select>
            </label>
            <label className={css.field}>
              Roof profile
              <select
                value={finish.profile}
                onChange={(e) =>
                  changeRoof({
                    ...roof,
                    finish: {
                      ...finish,
                      profile: e.target.value as typeof finish.profile,
                    },
                  })
                }
              >
                {REPRESENTATIVE_ROOF_PROFILE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {finish.material !== "acrylic" && finish.profile === "tray" && (
          <label className={css.field}>
            Tray width
            <select
              value={finish.trayWidth}
              onChange={(e) =>
                changeRoof({
                  ...roof,
                  finish: {
                    ...finish,
                    trayWidth: Number(e.target.value) as 300 | 400 | 500,
                  },
                })
              }
            >
              {REPRESENTATIVE_ROOF_TRAY_WIDTHS.map((n) => (
                <option key={n} value={n}>
                  {n} mm
                </option>
              ))}
            </select>
          </label>
        )}
        {finish.material === "combination" && (
          <label className={css.field}>
            Skylight arrangement
            <select
              value={finish.layout}
              onChange={(e) =>
                changeRoof({
                  ...roof,
                  finish: {
                    ...finish,
                    layout: e.target.value as "central" | "house",
                  },
                })
              }
            >
              <option value="central">Central band</option>
              {allowsHouseBand(roof) && (
                <option value="house">House-side band</option>
              )}
            </select>
          </label>
        )}
        {finish.material !== "solid" && (
          <section className={css.optionGroup}>
            <h3>Timber under your roof</h3>
            <label className={css.check}>
              <input
                type="checkbox"
                checked={!!roof.roofBattens}
                onChange={(e) => {
                  const next = { ...roof };
                  if (e.target.checked)
                    next.roofBattens = { ...DEFAULT_ROOF_BATTENS };
                  else delete next.roofBattens;
                  changeRoof(next);
                }}
              />
              Roof battens
            </label>
            {roof.roofBattens && (
              <>
                <label className={css.field}>
                  Timber
                  <select
                    value={roof.roofBattens.species ?? "cedar"}
                    onChange={(e) =>
                      batten({
                        species: e.target.value as "cedar" | "thermopine",
                      })
                    }
                  >
                    <option value="thermopine">ThermoPine</option>
                    <option value="cedar">Cedar</option>
                  </select>
                </label>
                <label className={css.field}>
                  Batten size
                  <select
                    value={roof.roofBattens.profile}
                    onChange={(e) =>
                      batten({
                        profile: e.target.value as NonNullable<
                          typeof roof.roofBattens
                        >["profile"],
                      })
                    }
                  >
                    {TIMBER_PROFILES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                {roof.roofBattens.profile !== "39x39" && (
                  <label className={css.check}>
                    <input
                      type="checkbox"
                      checked={roof.roofBattens.edge}
                      onChange={(e) => batten({ edge: e.target.checked })}
                    />
                    Narrow edge facing out
                  </label>
                )}
                <Gap
                  key={
                    roof.roofBattens.profile +
                    String(roof.roofBattens.customGap)
                  }
                  label="Roof batten gap"
                  value={roof.roofBattens.gap}
                  raw={value.rawGaps?.roof}
                  onChange={(raw) =>
                    onChange(changeStudioGap(value, "roof", raw))
                  }
                />
                <button
                  className={css.quietButton}
                  disabled={
                    !roof.roofBattens.customGap &&
                    value.rawGaps?.roof === undefined
                  }
                  onClick={() => batten({ customGap: false })}
                >
                  Use profile default
                </button>
              </>
            )}
          </section>
        )}
      </details>
    </>
  );
}

export default memo(StudioWebsiteRoofControls);
